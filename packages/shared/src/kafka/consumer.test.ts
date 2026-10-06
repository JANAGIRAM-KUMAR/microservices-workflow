import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Consumer, EachMessagePayload } from 'kafkajs';
import { createConsumer, runConsumer } from './consumer';

const { fakeConsumer } = vi.hoisted(() => ({
  fakeConsumer: {
    connect: vi.fn(),
    subscribe: vi.fn(),
    run: vi.fn(),
  },
}));

vi.mock('./client', () => ({
  createKafkaClient: vi.fn(() => ({
    consumer: vi.fn(() => fakeConsumer),
  })),
}));

function makeConsumer(): Consumer {
  return fakeConsumer as unknown as Consumer;
}

function makePayload(value: string | null): EachMessagePayload {
  return {
    topic: 'task.events',
    partition: 0,
    message: {
      key: null,
      value: value === null ? null : Buffer.from(value),
      timestamp: '0',
      offset: '0',
    },
    heartbeat: vi.fn(),
    pause: vi.fn(),
  } as unknown as EachMessagePayload;
}

beforeEach(() => {
  fakeConsumer.connect.mockReset();
  fakeConsumer.subscribe.mockReset();
  fakeConsumer.run.mockReset();
});

describe('createConsumer', () => {
  it('connects and returns the consumer', async () => {
    fakeConsumer.connect.mockResolvedValue(undefined);

    const consumer = await createConsumer('workflow-service', 'my-group');

    expect(consumer).toBe(fakeConsumer);
    expect(fakeConsumer.connect).toHaveBeenCalledTimes(1);
  });

  it('propagates connection failures', async () => {
    fakeConsumer.connect.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      createConsumer('workflow-service', 'my-group')
    ).rejects.toThrow('ECONNREFUSED');
  });
});

describe('runConsumer', () => {
  it('subscribes to every requested topic', async () => {
    fakeConsumer.subscribe.mockResolvedValue(undefined);
    fakeConsumer.run.mockResolvedValue(undefined);

    await runConsumer(makeConsumer(), ['task.events', 'media.events'], vi.fn());

    expect(fakeConsumer.subscribe).toHaveBeenCalledWith({
      topics: ['task.events', 'media.events'],
      fromBeginning: false,
    });
  });

  it('defaults fromBeginning to false', async () => {
    fakeConsumer.subscribe.mockResolvedValue(undefined);
    fakeConsumer.run.mockResolvedValue(undefined);

    await runConsumer(makeConsumer(), ['task.events'], vi.fn());

    expect(fakeConsumer.subscribe.mock.calls[0][0].fromBeginning).toBe(false);
  });

  it('honours an explicit fromBeginning option', async () => {
    fakeConsumer.subscribe.mockResolvedValue(undefined);
    fakeConsumer.run.mockResolvedValue(undefined);

    await runConsumer(makeConsumer(), ['task.events'], vi.fn(), {
      fromBeginning: true,
    });

    expect(fakeConsumer.subscribe).toHaveBeenCalledWith({
      topics: ['task.events'],
      fromBeginning: true,
    });
  });

  it('registers an eachMessage handler', async () => {
    fakeConsumer.subscribe.mockResolvedValue(undefined);
    fakeConsumer.run.mockResolvedValue(undefined);

    await runConsumer(makeConsumer(), ['task.events'], vi.fn());

    expect(fakeConsumer.run).toHaveBeenCalledTimes(1);
    const options = fakeConsumer.run.mock.calls[0][0];
    expect(typeof options.eachMessage).toBe('function');
  });

  it('forwards each message payload to the handler', async () => {
    fakeConsumer.subscribe.mockResolvedValue(undefined);
    let registered: ((payload: EachMessagePayload) => Promise<void>) | undefined;
    fakeConsumer.run.mockImplementation(async (options: {
      eachMessage: (payload: EachMessagePayload) => Promise<void>;
    }) => {
      registered = options.eachMessage;
    });

    const handler = vi.fn().mockResolvedValue(undefined);
    await runConsumer(makeConsumer(), ['task.events'], handler);

    const payload = makePayload(JSON.stringify({ taskId: 't1' }));
    await registered!(payload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('still invokes the handler when the message value is empty', async () => {
    fakeConsumer.subscribe.mockResolvedValue(undefined);
    let registered: ((payload: EachMessagePayload) => Promise<void>) | undefined;
    fakeConsumer.run.mockImplementation(async (options: {
      eachMessage: (payload: EachMessagePayload) => Promise<void>;
    }) => {
      registered = options.eachMessage;
    });

    const handler = vi.fn().mockResolvedValue(undefined);
    await runConsumer(makeConsumer(), ['task.events'], handler);

    await registered!(makePayload(null));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('propagates handler failures', async () => {
    fakeConsumer.subscribe.mockResolvedValue(undefined);
    let registered: ((payload: EachMessagePayload) => Promise<void>) | undefined;
    fakeConsumer.run.mockImplementation(async (options: {
      eachMessage: (payload: EachMessagePayload) => Promise<void>;
    }) => {
      registered = options.eachMessage;
    });

    const handler = vi
      .fn()
      .mockRejectedValue(new Error('workflow insert failed'));
    await runConsumer(makeConsumer(), ['task.events'], handler);

    await expect(registered!(makePayload('{}'))).rejects.toThrow(
      'workflow insert failed'
    );
  });
});
