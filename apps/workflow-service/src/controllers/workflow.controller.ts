import { AppError, successResponse } from "shared";
import { Request, Response, NextFunction } from "express";
import * as workflowService from '../services/workflow.service';

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

export async function listWorkflows(
    req : Request,
    res : Response,
    next : NextFunction
) {
    try {
        const {userId, userRole} = requireId(req);
        const taskId = req.params.taskId as string;
        const workflows = await workflowService.listWorkflows(taskId, userId, userRole);
        successResponse(res, {workflows});
    } catch(err){
        next(err);
    }
}

