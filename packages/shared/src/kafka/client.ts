import {Kafka, logLevel, type KafkaConfig} from 'kafkajs';
export function createKafkaClient(
    clientId: string,
    config : Partial<KafkaConfig> = {}
) {
    const brokers = (process.env.KAFKA_BROKER || 'localhost:9092').split(',').map(broker => broker.trim()).filter(Boolean);

    if(brokers.length === 0){
        throw new Error('KAFKA_BROKER is not set');
    }
    
    return new  Kafka({
        clientId,
        brokers,
        logLevel: logLevel.ERROR,
        retry: {
            retries: 8,
        },
        ...config
    })
}