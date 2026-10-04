import { getPool } from "shared";
import { Attachment, TaskAccess } from "../types/media.types";


export async function findTaskAccess(taskId : string) : Promise<TaskAccess | null> {
    const result = await getPool().query<TaskAccess>(`
        SELECT id, created_by
        FROM tasks
        WHERE id = $1    
    `, [taskId]);
    return result.rows[0] || null;      
}

export async function createAttachment(input:{
    taskId : string,
    imageUrl : string,
    publicId : string,
    uploadedBy: string
}) : Promise<Attachment> {
    const result = await getPool().query<Attachment>(`
            INSERT INTO attachments (task_id, image_url, public_id, uploaded_by)
            VALUES ($1, $2, $3, $4)
            RETURNING id, task_id, image_url, public_id, uploaded_by, created_at   
            `, 
        [input.taskId, input.imageUrl, input.publicId, input.uploadedBy]);

    return result.rows[0];
}

export async function listAttachments(taskId : string) : Promise<Attachment[]> {
    const result = await getPool().query<Attachment>(`
        SELECT id, task_id, image_url, public_id, uploaded_by, created_at
        FROM attachments
        WHERE task_id = $1
    `, [taskId]);
    return result.rows;
}