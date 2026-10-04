import { AppError, createConsumer, logger, runConsumer, TOPICS } from "shared";
import { DomainEvent } from "../types/types";
import * as workflowRepository from "../repositories/workflow.repository";
import { convertToPublicWorkflow } from "../utils/workflow.utils";


async function handleDomainEvent(data : DomainEvent){
    if(!data.eventType || !data.taskId || !data.userId || !data.message){
        logger.warn({data}, 'Invalid domain event');
        return;
    }

    const workflow = await workflowRepository.createWorkflow({
        taskId: data.taskId,
        eventType: data.eventType,
        message: data.message || data.eventType,
        createdBy: data.userId
    });
        
    logger.info({workflow}, 'Workflow row created');

}

export async function startKafka(){
    const consumer = await createConsumer('workflow-service', 'workflow-service-group');

    void runConsumer(
        consumer, 
        [TOPICS.TASK_EVENTS, TOPICS.MEDIA_EVENTS], 
        async ({message}) => {
            const value = message.value?.toString();
            if(!value){
                return;
            }

            try {
                await handleDomainEvent(JSON.parse(value) as DomainEvent);
            } catch(err) {
                logger.error({err}, 'Workflow consumer failed');
            }
    });
}


export async function listWorkflows(taskId : string, userId : string, userRole : string) {
    const task = await workflowRepository.findTaskOwner(taskId);
    if(!task){
        throw new AppError(404, "Task not found");
    }
    if(userRole !== 'admin' && task.createdBy !== userId){
        throw new AppError(403, "Forbidden, you don't have access to this task");
    }
    const rows = await workflowRepository.listWorkflows(taskId);
    return rows.map(convertToPublicWorkflow);
}
