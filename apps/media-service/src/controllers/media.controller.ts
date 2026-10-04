import {Request, Response, NextFunction} from 'express';
import { AppError, successResponse } from "shared";
import * as mediaService from '../services/media.service';

function requireId(req : Request) {
    const userId = req.header("x-user-id");
    const userRole = req.header("x-user-role");
    if(!userId){
        throw new AppError(401, "Missing x-user-id header");
    }
    if(!userRole){
        throw new AppError(401, "Missing x-user-role header");
    }

    return {userId, userRole};
}

export async function uploadAttachment(
    req : Request,
    res : Response,
    next : NextFunction
) {
    try {
        const {userId, userRole} = requireId(req);
        const taskId = req.params.taskId as string;
        const attachment = await mediaService.uploadAttachment({
            taskId,
            userId,
            userRole,
            file: req.file
        })
        successResponse(res, {attachment}, 201);

    } catch(err){
        next(err);
    }
}

export async function listAttachments(
    req : Request,
    res : Response,
    next : NextFunction
) {
    try {
        const {userId, userRole} = requireId(req);
        const taskId = req.params.taskId as string;
        const getAttachments = await mediaService.listAttachments(taskId, userId, userRole);
        successResponse(res, {getAttachments});
    } catch(err){
        next(err);
    }
}