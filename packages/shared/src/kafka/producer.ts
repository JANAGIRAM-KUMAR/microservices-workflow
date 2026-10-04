import type { Producer, RecordMetadata } from "kafkajs";
import { createKafkaClient } from "./client";
import { logger } from "../logger/logger";

export async function createProducer(clientId: string) : Promise<Producer> {
    const kafka = createKafkaClient(clientId);

    const producer = kafka.producer();
    await producer.connect(); 

    logger.info({clientId}, 'Kafka producer connected');
    return producer;
}

export async function publishJSON(
    producer: Producer | null,
    topic: string,
    payload: Record<string, unknown>,
    key?: string
): Promise<RecordMetadata[]> {
    if (!producer) {
        logger.warn({ topic }, 'producer is not connected');
        return [];
    }

    const result = await producer.send({
        topic,
        messages: [
            {
                key: key ?? null,
                value: JSON.stringify(payload)
            }
        ]
    });

    logger.info({topic,payload}, 'Kafka event published');
    return result;
}

export async function publishJSONSafe(
    producer: Producer | null,
    topic: string,
    payload: Record<string, unknown>,
    key?: string
): Promise<void> {
    if(!producer){
        logger.warn({topic}, `producer is not connected`);
        return;
    }

    try {
        await publishJSON(producer, topic, payload, key);
    } catch(err){
        logger.error({err, topic}, 'Failed to publish message');
    }
}