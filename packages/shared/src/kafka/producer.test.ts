import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Producer, RecordMetadata } from 'kafkajs';
import { createProducer, publishJSON, publishJSONSafe } from './producer';

const { fakeProducer } = vi.hoisted(() => ({
  fakeProducer: {
    connect: vi.fn(),
    send: vi.fn(),
  },
}));

vi.mock('./client', () => ({
  createKafkaClient: vi.fn(() => ({
    producer: vi.fn(() => fakeProducer),
  })),
}));

function makeProducer(): Producer {
  return { send: fakeProducer.send } as unknown as Producer;
}

const metadata: RecordMetadata[] = [
  { topicName: 'task.events', partition: 0, errorCode: 0, offset: '0' },
];

beforeEach(() => {
  fakeProducer.connect.mockReset();
  fakeProducer.send.mockReset();
});

describe('createProducer', () => {
  it('connects and returns the producer', async () => {
    fakeProducer.connect.mockResolvedValue(undefined);

    const producer = await createProducer('task-service');

    expect(producer).toBe(fakeProducer);
    expect(fakeProducer.connect).toHaveBeenCalledTimes(1);
  });

  it('propagates connection failures', async () => {
    fakeProducer.connect.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(createProducer('task-service')).rejects.toThrow('ECONNREFUSED');
  });
});

describe('publishJSON', () => {
  it('returns an empty array and does not send when producer is null', async () => {
    const result = await publishJSON(null, 'task.events', { a: 1 }, 'key-1');

    expect(result).toEqual([]);
    expect(fakeProducer.send).not.toHaveBeenCalled();
  });

  it('serialises the payload and forwards topic and key', async () => {
    fakeProducer.send.mockResolvedValue(metadata);
    const payload = { eventType: 'task.created', taskId: 't1' };

    const result = await publishJSON(makeProducer(), 'task.events', payload, 't1');

    expect(fakeProducer.send).toHaveBeenCalledWith({
      topic: 'task.events',
      messages: [{ key: 't1', value: JSON.stringify(payload) }],
    });
    expect(result).toEqual(metadata);
  });

  it('defaults the key to null when none is supplied', async () => {
    fakeProducer.send.mockResolvedValue(metadata);

    await publishJSON(makeProducer(), 'media.events', { a: 1 });

    const sent = fakeProducer.send.mock.calls[0][0];
    expect(sent.messages[0].key).toBeNull();
  });

  it('propagates a send failure to the caller', async () => {
    fakeProducer.send.mockRejectedValue(new Error('broker down'));

    await expect(
      publishJSON(makeProducer(), 'task.events', { a: 1 })
    ).rejects.toThrow('broker down');
  });

  it('round-trips a payload containing non-ASCII characters', async () => {
    fakeProducer.send.mockResolvedValue(metadata);
    const payload = { title: 'Tâche ütf-8' };

    await publishJSON(makeProducer(), 'task.events', payload);

    const sent = fakeProducer.send.mock.calls[0][0];
    expect(JSON.parse(sent.messages[0].value)).toEqual(payload);
  });
});

describe('publishJSONSafe', () => {
  it('is a no-op when the producer is null', async () => {
    await expect(
      publishJSONSafe(null, 'task.events', { a: 1 })
    ).resolves.toBeUndefined();

    expect(fakeProducer.send).not.toHaveBeenCalled();
  });

  it('publishes through to the producer when everything works', async () => {
    fakeProducer.send.mockResolvedValue(metadata);

    await publishJSONSafe(makeProducer(), 'task.events', { a: 1 }, 'k1');

    expect(fakeProducer.send).toHaveBeenCalledTimes(1);
  });

  it('swallows send failures instead of rejecting', async () => {
    fakeProducer.send.mockRejectedValue(new Error('broker down'));

    await expect(
      publishJSONSafe(makeProducer(), 'task.events', { a: 1 })
    ).resolves.toBeUndefined();
  });
});
