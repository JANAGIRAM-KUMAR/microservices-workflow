import { AppError } from "shared";
import * as mediaRepository from '../repositories/media.repository';
import { uploadBuffer } from "../utils/storage";
import { convertToPublicMediaAttachment } from "../utils/media.utils";
import { publishMediaEvent } from "../kafka";


async function assetTaskAccess(
    taskId : string,
    userId : string,
    userRole : string,
) {
    const task = await mediaRepository.findTaskAccess(taskId);
    if(!task){
        throw new AppError(404, "Task not found");
    }
    if(userRole !== 'admin' && task.created_by !== userId){
        throw new AppError(403, "Forbidden, you don't have access to this task");
    }
}

export async function uploadAttachment(input : {
    taskId : string,
    userId : string,
    userRole : string,
    file? : Express.Multer.File
}) {
    if(!input.file){
        throw new AppError(400, "No file found");
    }

    await assetTaskAccess(input.taskId, input.userId, input.userRole);

    const uploaded = await uploadBuffer(
        input.file.buffer,
        input.file.mimetype || 'image/jpeg'
    )

    const attachment = await mediaRepository.createAttachment({
        taskId : input.taskId,
        imageUrl : uploaded.imageUrl,
        publicId : uploaded.publicId,
        uploadedBy : input.userId
    });

    // After uploading the attachment publish an event

    await publishMediaEvent(input.taskId, input.userId);
    
    return convertToPublicMediaAttachment(attachment);
}

export async function listAttachments(taskId : string, userId : string, role : string){
    await assetTaskAccess(taskId, userId, role);
    const attachments =  await mediaRepository.listAttachments(taskId);
    return attachments.map(convertToPublicMediaAttachment);
}