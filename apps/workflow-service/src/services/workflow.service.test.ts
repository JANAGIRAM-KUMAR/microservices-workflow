import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EachMessagePayload } from 'kafkajs';
import * as workflowService from './workflow.service';
import * as workflowRepository from '../repositories/workflow.repository';
import { createConsumer, runConsumer } from 'shared';
import type { Workflow } from '../types/types';

vi.mock('shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('shared')>();
  return {
    ...actual,
    createConsumer: vi.fn(),
    runConsumer: vi.fn(),
  };
});

vi.mock('../repositories/workflow.repository', () => ({
  findTaskOwner: vi.fn(),
  createWorkflow: vi.fn(),
  listWorkflows: vi.fn(),
}));

const mockedCreateConsumer = vi.mocked(createConsumer);
const mockedRunConsumer = vi.mocked(runConsumer);
const mockedFindTaskOwner = vi.mocked(workflowRepository.findTaskOwner);
const mockedCreateWorkflow = vi.mocked(workflowRepository.createWorkflow);
const mockedListWorkflows = vi.mocked(workflowRepository.listWorkflows);

const workflow: Workflow = {
  id: 'wf-1',
  task_id: 'task-1',
  event_type: 'task.created',
  message: 'Task created successfully!',
  created_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

type ConsumerHandler = (payload: EachMessagePayload) => Promise<void>;

function payloadWith(value: string | Buffer | null): EachMessagePayload {
  return {
    topic: 'task.events',
    partition: 0,
    message: {
      key: null,
      value: value === null ? null : Buffer.isBuffer(value) ? value : Buffer.from(value),
      timestamp: '0',
      offset: '0',
    },
    heartbeat: vi.fn(),
    pause: vi.fn(),
  } as unknown as EachMessagePayload;
}

async function getHandler(): Promise<ConsumerHandler> {
  await workflowService.startKafka();
  return mockedRunConsumer.mock.calls[0][2] as ConsumerHandler;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreateConsumer.mockResolvedValue({} as never);
  mockedRunConsumer.mockResolvedValue(undefined);
  mockedCreateWorkflow.mockResolvedValue(workflow);
  mockedFindTaskOwner.mockResolvedValue({ created_by: 'user-1' });
  mockedListWorkflows.mockResolvedValue([workflow]);
});

describe('workflowService.startKafka', () => {
  it('connects a consumer with the service group', async () => {
    await workflowService.startKafka();

    expect(mockedCreateConsumer).toHaveBeenCalledWith(
      'workflow-service',
      'workflow-service-group'
    );
  });

  it('subscribes to both task and media events', async () => {
    await workflowService.startKafka();

    const [consumer, topics] = mockedRunConsumer.mock.calls[0];
    expect(consumer).toBeDefined();
    expect(topics).toEqual(['task.events', 'media.events']);
  });

  it('registers a message handler', async () => {
    await workflowService.startKafka();

    expect(mockedRunConsumer.mock.calls[0][2]).toBeTypeOf('function');
  });

  it('propagates a consumer connection failure', async () => {
    mockedCreateConsumer.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(workflowService.startKafka()).rejects.toThrow('ECONNREFUSED');
  });
});

describe('workflow consumer handler', () => {
  it('writes a row for a valid domain event', async () => {
    const handler = await getHandler();

    await handler(
      payloadWith(
        JSON.stringify({
          eventType: 'task.created',
          taskId: 'task-1',
          userId: 'user-1',
          message: 'Task created successfully!',
        })
      )
    );

    expect(mockedCreateWorkflow).toHaveBeenCalledWith({
      taskId: 'task-1',
      eventType: 'task.created',
      message: 'Task created successfully!',
      createdBy: 'user-1',
    });
  });

  it('writes a row for a media event', async () => {
    const handler = await getHandler();

    await handler(
      payloadWith(
        JSON.stringify({
          eventType: 'media.uploaded',
          taskId: 'task-1',
          userId: 'user-1',
          message: 'Media uploaded successfully!',
        })
      )
    );

    expect(mockedCreateWorkflow).toHaveBeenCalledWith({
      taskId: 'task-1',
      eventType: 'media.uploaded',
      message: 'Media uploaded successfully!',
      createdBy: 'user-1',
    });
  });

  it.each(['eventType', 'taskId', 'userId', 'message'])(
    'ignores an event with no %s',
    async (field) => {
      const handler = await getHandler();
      const event: Record<string, string> = {
        eventType: 'task.created',
        taskId: 'task-1',
        userId: 'user-1',
        message: 'Task created successfully!',
      };
      delete event[field];

      await handler(payloadWith(JSON.stringify(event)));

      expect(mockedCreateWorkflow).not.toHaveBeenCalled();
    }
  );

  it('ignores an empty message value', async () => {
    const handler = await getHandler();

    await handler(payloadWith(null));

    expect(mockedCreateWorkflow).not.toHaveBeenCalled();
  });

  it('swallows malformed JSON instead of crashing the consumer', async () => {
    const handler = await getHandler();

    await expect(handler(payloadWith('{not json'))).resolves.toBeUndefined();

    expect(mockedCreateWorkflow).not.toHaveBeenCalled();
  });

  it('does not rethrow when the database insert fails', async () => {
    mockedCreateWorkflow.mockRejectedValue(new Error('insert failed'));
    const handler = await getHandler();

    await expect(
      handler(
        payloadWith(
          JSON.stringify({
            eventType: 'task.created',
            taskId: 'task-1',
            userId: 'user-1',
            message: 'ok',
          })
        )
      )
    ).resolves.toBeUndefined();
  });
});

describe('workflowService.listWorkflows', () => {
  it('returns public workflows for the task owner', async () => {
    const result = await workflowService.listWorkflows(
      'task-1',
      'user-1',
      'user'
    );

    expect(mockedFindTaskOwner).toHaveBeenCalledWith('task-1');
    expect(mockedListWorkflows).toHaveBeenCalledWith('task-1');
    expect(result).toEqual([
      {
        id: 'wf-1',
        task_id: 'task-1',
        event_type: 'task.created',
        message: 'Task created successfully!',
        created_by: 'user-1',
        created_at: workflow.created_at,
      },
    ]);
  });

  it('returns an empty list when the task has no history', async () => {
    mockedListWorkflows.mockResolvedValue([]);

    expect(
      await workflowService.listWorkflows('task-1', 'user-1', 'user')
    ).toEqual([]);
  });

  it('throws 404 when the task does not exist', async () => {
    mockedFindTaskOwner.mockResolvedValue(null);

    await expect(
      workflowService.listWorkflows('missing', 'user-1', 'user')
    ).rejects.toMatchObject({ statusCode: 404, message: 'Task not found' });
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it('throws 403 for a non-owner non-admin', async () => {
    await expect(
      workflowService.listWorkflows('task-1', 'someone-else', 'user')
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden, you don't have access to this task",
    });
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it('lets an admin read any task history', async () => {
    const result = await workflowService.listWorkflows(
      'task-1',
      'admin-1',
      'admin'
    );

    expect(result).toHaveLength(1);
  });

  it('propagates a repository failure', async () => {
    mockedListWorkflows.mockRejectedValue(new Error('select failed'));

    await expect(
      workflowService.listWorkflows('task-1', 'user-1', 'user')
    ).rejects.toThrow('select failed');
  });
});
