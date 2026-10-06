import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('shared')>();
  return {
    ...actual,
    createProducer: vi.fn(),
    publishJSONSafe: vi.fn(),
  };
});

type KafkaModule = typeof import('./kafka');

async function setup() {
  vi.resetModules();
  const kafka = await import('./kafka.js');
  const shared = await import('shared');
  return {
    kafka,
    topics: shared.TOPICS,
    createProducer: vi.mocked(shared.createProducer),
    publishJSONSafe: vi.mocked(shared.publishJSONSafe),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('initKafka', () => {
  it('creates a producer identified as task-service', async () => {
    const ctx = await setup();
    ctx.createProducer.mockResolvedValue({} as never);

    await ctx.kafka.initKafka();

    expect(ctx.createProducer).toHaveBeenCalledWith('task-service');
  });

  it('propagates a connection failure', async () => {
    const ctx = await setup();
    ctx.createProducer.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(ctx.kafka.initKafka()).rejects.toThrow('ECONNREFUSED');
    expect(ctx.publishJSONSafe).not.toHaveBeenCalled();
  });
});

describe('publishTaskEvent', () => {
  it('publishes a task.created event with the task id as key', async () => {
    const ctx = await setup();
    const producer = { connect: vi.fn() };
    ctx.createProducer.mockResolvedValue(producer as never);
    ctx.publishJSONSafe.mockResolvedValue(undefined);
    await ctx.kafka.initKafka();

    await ctx.kafka.publishTaskEvent('task-1', 'user-1');

    expect(ctx.publishJSONSafe).toHaveBeenCalledTimes(1);
    const [sentProducer, topic, payload, key] =
      ctx.publishJSONSafe.mock.calls[0];

    expect(sentProducer).toBe(producer);
    expect(topic).toBe(ctx.topics.TASK_EVENTS);
    expect(key).toBe('task-1');
    expect(payload).toMatchObject({
      eventType: 'task.created',
      taskId: 'task-1',
      userId: 'user-1',
      message: 'Task created successfully!',
    });
  });

  it('uses an ISO 8601 timestamp', async () => {
    const ctx = await setup();
    ctx.createProducer.mockResolvedValue({} as never);
    ctx.publishJSONSafe.mockResolvedValue(undefined);
    await ctx.kafka.initKafka();

    await ctx.kafka.publishTaskEvent('task-1', 'user-1');

    const timestamp = ctx.publishJSONSafe.mock.calls[0][2].timestamp as string;
    expect(timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
    );
  });

  it('does not throw when no producer has been initialised', async () => {
    const ctx = await setup();
    ctx.publishJSONSafe.mockResolvedValue(undefined);

    await expect(
      ctx.kafka.publishTaskEvent('task-1', 'user-1')
    ).resolves.toBeUndefined();

    expect(ctx.publishJSONSafe).toHaveBeenCalledTimes(1);
    const [sentProducer, , payload] = ctx.publishJSONSafe.mock.calls[0];
    expect(sentProducer).toBeNull();
    expect(payload.taskId).toBe('task-1');
  });

  it('lets a publish failure surface to the caller', async () => {
    const ctx = await setup();
    ctx.createProducer.mockResolvedValue({} as never);
    ctx.publishJSONSafe.mockRejectedValue(new Error('broker down'));
    await ctx.kafka.initKafka();

    await expect(
      ctx.kafka.publishTaskEvent('task-1', 'user-1')
    ).rejects.toThrow('broker down');
  });
});
