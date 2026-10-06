import type { Consumer, EachMessagePayload } from "kafkajs";
import { logger } from "../logger/logger";
import { createKafkaClient } from "./client";



export async function createConsumer(
    clientId: string,
    groupId: string,
): Promise<Consumer> {
    const kafka = createKafkaClient(clientId);
    const consumer = kafka.consumer({ groupId });
    await consumer.connect();
    logger.info({clientId, groupId}, 'Kafka consumer connected');
    return consumer;
}

export async function runConsumer(
    consumer: Consumer,
    topics: string[],
    handler: (payload: EachMessagePayload) => Promise<void>,
    options? : {fromBeginning : boolean}
): Promise<void> {
    await consumer.subscribe({ 
        topics,
        fromBeginning: options?.fromBeginning ?? false 
    });
    await consumer.run({
        eachMessage: async (payload) => {
            const {topic, partition, message} = payload;
            logger.info({
                topic,
                partition,
                offset: message.offset,
                key: message.key?.toString(),
                value: message.value?.toString()
            }, 'Kafka message received');
            await handler(payload);
        }
    });
}


