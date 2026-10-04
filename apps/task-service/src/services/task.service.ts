import { CreateTaskSchema } from "../schemas/task.schemas";
import * as taskRepository from "../repositories/task.repository";
import { convertToPublicTask } from "../utils/task.utils";
import { AppError } from "shared";
import { TaskStatus } from "../types/task.types";
import { publishTaskEvent } from "../kafka";

export async function createTask(input : CreateTaskSchema, userId : string){
    const newlyCreatedTask = await taskRepository.createTask({
        title : input.title,
        createdBy : userId
    });

    //publish an event saying that a new task was created
    await publishTaskEvent(newlyCreatedTask.id, userId);
    return convertToPublicTask(newlyCreatedTask);
}

export async function listTasks(userId : string, role : string){
    return await taskRepository.listTasks({userId, role});
}

export async function findTaskById(id : string, userId : string, role : string){
    const task = await taskRepository.findTaskById(id);
    if(!task){
        throw new AppError(404, "Task not found");
    }
    if(role !== 'admin' && task.created_by !== userId){
        throw new AppError(403, "Forbidden, you don't have access to this task");
    }
    return convertToPublicTask(task);
}

export async function updateTask(id : string, input: {
    title: string, status: TaskStatus
}, userId : string, role : string){
    const task = await taskRepository.findTaskById(id);
    if(!task){
        throw new AppError(404, "Task not found");
    }
    if(role !== 'admin' && task.created_by !== userId){
        throw new AppError(403, "Forbidden, you don't have access to this task");
    }
    const updatedTask = await taskRepository.updateTask(id, {
        title : input.title,
        status : input.status
    });

    if(!updatedTask){
        throw new AppError(404, "Error in updating task");
    }
    return convertToPublicTask(updatedTask);
}


export async function deleteTaskById(id : string, userId : string, role : string){
    const task = await taskRepository.findTaskById(id);
    if(!task){
        throw new AppError(404, "Task not found");
    }
    if(role !== 'admin' && task.created_by !== userId){
        throw new AppError(403, "Forbidden, you don't have access to this task");
    }
    return await taskRepository.deleteTaskById(id);
}

