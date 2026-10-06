import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createKafkaClient } from './client';

const ORIGINAL_BROKER = process.env.KAFKA_BROKER;

function restoreBroker() {
  if (ORIGINAL_BROKER === undefined) {
    delete process.env.KAFKA_BROKER;
  } else {
    process.env.KAFKA_BROKER = ORIGINAL_BROKER;
  }
}

beforeEach(() => {
  process.env.KAFKA_BROKER = 'localhost:9092';
});

afterEach(restoreBroker);

describe('createKafkaClient', () => {
  it('returns a usable Kafka client', () => {
    const kafka = createKafkaClient('task-service');

    expect(typeof kafka.producer).toBe('function');
    expect(typeof kafka.consumer).toBe('function');
    expect(typeof kafka.admin).toBe('function');
    expect(typeof kafka.logger).toBe('function');
  });

  it('falls back to localhost:9092 when KAFKA_BROKER is unset', () => {
    delete process.env.KAFKA_BROKER;

    expect(() => createKafkaClient('task-service')).not.toThrow();
  });

  it('accepts several brokers separated by commas', () => {
    process.env.KAFKA_BROKER = 'broker-1:9092, broker-2:9092';

    expect(() => createKafkaClient('task-service')).not.toThrow();
  });

  it('falls back to localhost:9092 when KAFKA_BROKER is empty', () => {
    process.env.KAFKA_BROKER = '';

    expect(() => createKafkaClient('task-service')).not.toThrow();
  });

  it('throws when KAFKA_BROKER contains only separators', () => {
    process.env.KAFKA_BROKER = ' , ,, ';

    expect(() => createKafkaClient('task-service')).toThrow(
      'KAFKA_BROKER is not set'
    );
  });

  it('accepts a config override without throwing', () => {
    expect(() =>
      createKafkaClient('task-service', { retry: { retries: 1 } })
    ).not.toThrow();
  });
});
