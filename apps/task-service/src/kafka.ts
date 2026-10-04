import { createProducer, publishJSONSafe, TOPICS } from "shared";

let producer: Awaited<ReturnType<typeof createProducer>> | null = null;

export async function initKafka(){
    producer = await createProducer('task-service');
}

export async function publishTaskEvent(taskId : string, userId : string){
    await publishJSONSafe(
        producer,
        TOPICS.TASK_EVENTS,
        {
            eventType : 'task.created',
            taskId,
            userId,
            message : 'Task created successfully!',
            timestamp : new Date().toISOString()
        },
        taskId
    )
}