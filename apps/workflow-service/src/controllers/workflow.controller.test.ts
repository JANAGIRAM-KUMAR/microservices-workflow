import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from 'shared';
import * as workflowController from './workflow.controller';
import * as workflowService from '../services/workflow.service';

vi.mock('../services/workflow.service', () => ({
  listWorkflows: vi.fn(),
  startKafka: vi.fn(),
}));

const mockedListWorkflows = vi.mocked(workflowService.listWorkflows);

const publicWorkflow = {
  id: 'wf-1',
  task_id: 'task-1',
  event_type: 'task.created',
  message: 'Task created successfully!',
  created_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

function makeContext({
  params,
  headers,
}: {
  params?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  const store: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    store[key.toLowerCase()] = value;
  }

  const req = {
    params: params ?? {},
    headers: store,
    header: (name: string) => store[name.toLowerCase()],
  } as unknown as Request;

  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);

  const next = vi.fn();

  return { req, res: res as unknown as Response, next };
}

const identity = { 'x-user-id': 'user-1', 'x-user-role': 'user' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('workflowController.listWorkflows', () => {
  it('responds 200 with the workflow list', async () => {
    mockedListWorkflows.mockResolvedValue([publicWorkflow]);
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: identity,
    });

    await workflowController.listWorkflows(req, res, next);

    expect(mockedListWorkflows).toHaveBeenCalledWith(
      'task-1',
      'user-1',
      'user'
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { workflows: [publicWorkflow] },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 200 with an empty list', async () => {
    mockedListWorkflows.mockResolvedValue([]);
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: identity,
    });

    await workflowController.listWorkflows(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { workflows: [] },
    });
  });

  it('throws 401 when x-user-id is missing', async () => {
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: { 'x-user-role': 'user' },
    });

    await workflowController.listWorkflows(req, res, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Missing x-user-id header');
    expect(mockedListWorkflows).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('throws 401 when x-user-role is missing', async () => {
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: { 'x-user-id': 'user-1' },
    });

    await workflowController.listWorkflows(req, res, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Missing x-user-role header');
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it('forwards a service failure to the error handler', async () => {
    const failure = new AppError(403, 'Forbidden');
    mockedListWorkflows.mockRejectedValue(failure);
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: identity,
    });

    await workflowController.listWorkflows(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.json).not.toHaveBeenCalled();
  });
});
