import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from 'shared';
import * as taskController from './task.controller';
import * as taskService from '../services/task.service';

vi.mock('../services/task.service', () => ({
  createTask: vi.fn(),
  listTasks: vi.fn(),
  findTaskById: vi.fn(),
  updateTask: vi.fn(),
  deleteTaskById: vi.fn(),
}));

const mockedCreateTask = vi.mocked(taskService.createTask);
const mockedListTasks = vi.mocked(taskService.listTasks);
const mockedFindTaskById = vi.mocked(taskService.findTaskById);
const mockedUpdateTask = vi.mocked(taskService.updateTask);
const mockedDeleteTaskById = vi.mocked(taskService.deleteTaskById);

const publicTask = {
  id: 'task-1',
  title: 'Write the tests',
  status: 'pending' as const,
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const rawTask = {
  id: 'task-1',
  title: 'Write the tests',
  status: 'pending' as const,
  created_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

function makeContext({
  body,
  params,
  headers,
}: {
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
} = {}) {
  const store: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    store[key.toLowerCase()] = value;
  }

  const req = {
    body,
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

describe('createTask', () => {
  it('responds 201 with the created task', async () => {
    mockedCreateTask.mockResolvedValue(publicTask);
    const { req, res, next } = makeContext({
      body: { title: 'Write the tests' },
      headers: identity,
    });

    await taskController.createTask(req, res, next);

    expect(mockedCreateTask).toHaveBeenCalledWith(
      { title: 'Write the tests' },
      'user-1'
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { task: publicTask },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('throws 401 when x-user-id is missing', async () => {
    const { req, res, next } = makeContext({
      body: { title: 'Write the tests' },
      headers: { 'x-user-role': 'user' },
    });

    await taskController.createTask(req, res, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Missing x-user-id header');
    expect(mockedCreateTask).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('throws 401 when x-user-role is missing', async () => {
    const { req, res, next } = makeContext({
      body: { title: 'Write the tests' },
      headers: { 'x-user-id': 'user-1' },
    });

    await taskController.createTask(req, res, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Missing x-user-role header');
  });

  it('forwards a service failure', async () => {
    const failure = new AppError(403, 'Forbidden');
    mockedCreateTask.mockRejectedValue(failure);
    const { req, res, next } = makeContext({
      body: { title: 'Write the tests' },
      headers: identity,
    });

    await taskController.createTask(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('listTasks', () => {
  it('responds 200 with the task list', async () => {
    mockedListTasks.mockResolvedValue([rawTask]);
    const { req, res, next } = makeContext({ headers: identity });

    await taskController.listTasks(req, res, next);

    expect(mockedListTasks).toHaveBeenCalledWith('user-1', 'user');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { tasks: [rawTask] },
    });
  });

  it('responds 200 with an empty list', async () => {
    mockedListTasks.mockResolvedValue([]);
    const { req, res, next } = makeContext({ headers: identity });

    await taskController.listTasks(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { tasks: [] },
    });
  });

  it('forwards a service failure', async () => {
    const failure = new AppError(401, 'Missing x-user-id header');
    mockedListTasks.mockRejectedValue(failure);
    const { req, res, next } = makeContext({ headers: identity });

    await taskController.listTasks(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});

describe('findTaskById', () => {
  it('responds 200 with the task', async () => {
    mockedFindTaskById.mockResolvedValue(publicTask);
    const { req, res, next } = makeContext({
      params: { id: 'task-1' },
      headers: identity,
    });

    await taskController.findTaskById(req, res, next);

    expect(mockedFindTaskById).toHaveBeenCalledWith('task-1', 'user-1', 'user');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { task: publicTask },
    });
  });

  it('forwards a 404 from the service', async () => {
    const failure = new AppError(404, 'Task not found');
    mockedFindTaskById.mockRejectedValue(failure);
    const { req, res, next } = makeContext({
      params: { id: 'missing' },
      headers: identity,
    });

    await taskController.findTaskById(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});

describe('updateTask', () => {
  it('responds 200 with the updated task', async () => {
    const updated = { ...publicTask, title: 'Updated', status: 'completed' as const };
    mockedUpdateTask.mockResolvedValue(updated);
    const { req, res, next } = makeContext({
      body: { title: 'Updated', status: 'completed' },
      params: { id: 'task-1' },
      headers: identity,
    });

    await taskController.updateTask(req, res, next);

    expect(mockedUpdateTask).toHaveBeenCalledWith(
      'task-1',
      { title: 'Updated', status: 'completed' },
      'user-1',
      'user'
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { task: updated },
    });
  });

  it('forwards a 403 from the service', async () => {
    const failure = new AppError(403, "Forbidden, you don't have access to this task");
    mockedUpdateTask.mockRejectedValue(failure);
    const { req, res, next } = makeContext({
      body: { title: 'Updated', status: 'pending' },
      params: { id: 'task-1' },
      headers: identity,
    });

    await taskController.updateTask(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});

describe('deleteTaskById', () => {
  it('reports success when the repository deleted a row', async () => {
    mockedDeleteTaskById.mockResolvedValue(true);
    const { req, res, next } = makeContext({
      params: { id: 'task-1' },
      headers: identity,
    });

    await taskController.deleteTaskById(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { result: 'Task deleted successfully' },
    });
  });

  it('reports not found when no row was deleted', async () => {
    mockedDeleteTaskById.mockResolvedValue(false);
    const { req, res, next } = makeContext({
      params: { id: 'task-1' },
      headers: identity,
    });

    await taskController.deleteTaskById(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { result: 'Task not found' },
    });
  });

  it('forwards a service failure', async () => {
    const failure = new AppError(404, 'Task not found');
    mockedDeleteTaskById.mockRejectedValue(failure);
    const { req, res, next } = makeContext({
      params: { id: 'missing' },
      headers: identity,
    });

    await taskController.deleteTaskById(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
