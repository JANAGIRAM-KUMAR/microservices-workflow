import { Request, Response, NextFunction } from "express";
import * as taskService from '../services/task.service';
import { AppError, successResponse } from "shared";

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

export async function createTask(
    req : Request,
    res : Response,
    next : NextFunction
) {
    try {

        const {userId} = requireId(req);
        const task = await taskService.createTask(req.body, userId);
        successResponse(res, {task}, 201);
    } catch(err){
        next(err);
    }
}

export async function listTasks(
    req : Request,
    res : Response,
    next : NextFunction
) {
    try {
        const {userId, userRole} = requireId(req);
        const tasks = await taskService.listTasks(userId, userRole);
        successResponse(res, {tasks});
    } catch(err){
        next(err); 
    }
}

export async function findTaskById(
    req : Request,
    res : Response,
    next : NextFunction
) {
    try {
        const {userId, userRole} = requireId(req);
        const task = await taskService.findTaskById(req.params.id as string, userId, userRole);
        successResponse(res, {task});
    } catch(err){
        next(err);
    }
}


export async function updateTask(
    req : Request,
    res : Response,
    next : NextFunction
) {
    try {
        const {userId, userRole} = requireId(req);
        const task = await taskService.updateTask(req.params.id as string, req.body, userId, userRole);
        successResponse(res, {task});
    } catch(err){
        next(err);
    }
}

export async function deleteTaskById(
    req : Request,
    res : Response,
    next : NextFunction
) {
    try {
        let result;
        const {userId, userRole} = requireId(req);
        const task = await taskService.deleteTaskById(req.params.id as string, userId, userRole);
        if(task === false){
            result = "Task not found";
        } else {
            result = "Task deleted successfully";
        }
        successResponse(res, {result});
    } catch(err){
        next(err);
    }
}


