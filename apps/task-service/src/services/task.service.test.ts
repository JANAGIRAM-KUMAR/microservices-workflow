import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from 'shared';
import * as taskService from './task.service';
import * as taskRepository from '../repositories/task.repository';
import { publishTaskEvent } from '../kafka';
import type { Task } from '../types/task.types';

vi.mock('../repositories/task.repository', () => ({
  createTask: vi.fn(),
  listTasks: vi.fn(),
  findTaskById: vi.fn(),
  updateTask: vi.fn(),
  deleteTaskById: vi.fn(),
}));

vi.mock('../kafka', () => ({
  initKafka: vi.fn(),
  publishTaskEvent: vi.fn(),
}));

const mockedCreateTask = vi.mocked(taskRepository.createTask);
const mockedListTasks = vi.mocked(taskRepository.listTasks);
const mockedFindTaskById = vi.mocked(taskRepository.findTaskById);
const mockedUpdateTask = vi.mocked(taskRepository.updateTask);
const mockedDeleteTaskById = vi.mocked(taskRepository.deleteTaskById);
const mockedPublish = vi.mocked(publishTaskEvent);

const task: Task = {
  id: 'task-1',
  title: 'Write the tests',
  status: 'pending',
  created_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(() => {
  mockedCreateTask.mockReset();
  mockedListTasks.mockReset();
  mockedFindTaskById.mockReset();
  mockedUpdateTask.mockReset();
  mockedDeleteTaskById.mockReset();
  mockedPublish.mockReset();
  mockedPublish.mockResolvedValue(undefined);
});

describe('taskService.createTask', () => {
  it('creates the task, publishes an event and returns the public task', async () => {
    mockedCreateTask.mockResolvedValue(task);

    const result = await taskService.createTask({ title: 'Write the tests' }, 'user-1');

    expect(mockedCreateTask).toHaveBeenCalledWith({
      title: 'Write the tests',
      createdBy: 'user-1',
    });
    expect(mockedPublish).toHaveBeenCalledWith('task-1', 'user-1');
    expect(result).toEqual({
      id: 'task-1',
      title: 'Write the tests',
      status: 'pending',
      createdBy: 'user-1',
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    });
  });

  it('never exposes created_by under its column name', async () => {
    mockedCreateTask.mockResolvedValue(task);

    const result = (await taskService.createTask(
      { title: 'Write the tests' },
      'user-1'
    )) as Record<string, unknown>;

    expect(result).not.toHaveProperty('created_by');
  });

  it('propagates a publish failure to the caller', async () => {
    mockedCreateTask.mockResolvedValue(task);
    mockedPublish.mockRejectedValue(new Error('broker down'));

    await expect(
      taskService.createTask({ title: 'Write the tests' }, 'user-1')
    ).rejects.toThrow('broker down');
  });

  it('propagates a database failure before publishing', async () => {
    mockedCreateTask.mockRejectedValue(new Error('relation missing'));

    await expect(
      taskService.createTask({ title: 'Write the tests' }, 'user-1')
    ).rejects.toThrow('relation missing');
    expect(mockedPublish).not.toHaveBeenCalled();
  });
});

describe('taskService.listTasks', () => {
  it('passes the user id and role through to the repository', async () => {
    mockedListTasks.mockResolvedValue([task]);

    const result = await taskService.listTasks('user-1', 'user');

    expect(mockedListTasks).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'user',
    });
    expect(result).toEqual([task]);
  });

  it('passes an admin role through', async () => {
    mockedListTasks.mockResolvedValue([task]);

    await taskService.listTasks('admin-1', 'admin');

    expect(mockedListTasks).toHaveBeenCalledWith({
      userId: 'admin-1',
      role: 'admin',
    });
  });

  it('returns an empty list when there are no tasks', async () => {
    mockedListTasks.mockResolvedValue([]);

    expect(await taskService.listTasks('user-1', 'user')).toEqual([]);
  });
});

describe('taskService.findTaskById', () => {
  it('returns the task to its owner', async () => {
    mockedFindTaskById.mockResolvedValue(task);

    const result = await taskService.findTaskById('task-1', 'user-1', 'user');

    expect(result.createdBy).toBe('user-1');
  });

  it('returns the task to an admin regardless of owner', async () => {
    mockedFindTaskById.mockResolvedValue(task);

    const result = await taskService.findTaskById('task-1', 'admin-1', 'admin');

    expect(result.createdBy).toBe('user-1');
  });

  it('denies access to a non-owner non-admin', async () => {
    mockedFindTaskById.mockResolvedValue(task);

    await expect(
      taskService.findTaskById('task-1', 'someone-else', 'user')
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden, you don't have access to this task",
    });
  });

  it('throws 404 when the task does not exist', async () => {
    mockedFindTaskById.mockResolvedValue(null);

    await expect(
      taskService.findTaskById('missing', 'user-1', 'user')
    ).rejects.toMatchObject({ statusCode: 404, message: 'Task not found' });
  });
});

describe('taskService.updateTask', () => {
  it('updates a task the caller owns', async () => {
    mockedFindTaskById.mockResolvedValue(task);
    mockedUpdateTask.mockResolvedValue({
      ...task,
      title: 'Updated',
      status: 'completed',
    });

    const result = await taskService.updateTask(
      'task-1',
      { title: 'Updated', status: 'completed' },
      'user-1',
      'user'
    );

    expect(mockedUpdateTask).toHaveBeenCalledWith('task-1', {
      title: 'Updated',
      status: 'completed',
    });
    expect(result.title).toBe('Updated');
    expect(result.status).toBe('completed');
  });

  it('lets an admin update someone else task', async () => {
    mockedFindTaskById.mockResolvedValue(task);
    mockedUpdateTask.mockResolvedValue({
      ...task,
      title: 'Updated',
      status: 'pending',
    });

    const result = await taskService.updateTask(
      'task-1',
      { title: 'Updated', status: 'pending' },
      'admin-1',
      'admin'
    );

    expect(mockedFindTaskById).toHaveBeenCalledWith('task-1');
    expect(mockedUpdateTask).toHaveBeenCalledWith('task-1', {
      title: 'Updated',
      status: 'pending',
    });
    expect(result.title).toBe('Updated');
  });

  it('denies a non-owner non-admin', async () => {
    mockedFindTaskById.mockResolvedValue(task);

    await expect(
      taskService.updateTask(
        'task-1',
        { title: 'Updated', status: 'pending' },
        'someone-else',
        'user'
      )
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockedUpdateTask).not.toHaveBeenCalled();
  });

  it('throws 404 when the task does not exist', async () => {
    mockedFindTaskById.mockResolvedValue(null);

    await expect(
      taskService.updateTask(
        'missing',
        { title: 'Updated', status: 'pending' },
        'user-1',
        'user'
      )
    ).rejects.toMatchObject({ statusCode: 404, message: 'Task not found' });
  });

  it('throws 404 when the update reports no affected row', async () => {
    mockedFindTaskById.mockResolvedValue(task);
    mockedUpdateTask.mockResolvedValue(undefined as unknown as Task);

    await expect(
      taskService.updateTask(
        'task-1',
        { title: 'Updated', status: 'pending' },
        'user-1',
        'user'
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'Error in updating task',
    });
  });
});

describe('taskService.deleteTaskById', () => {
  it('deletes a task the caller owns and returns the repository result', async () => {
    mockedFindTaskById.mockResolvedValue(task);
    mockedDeleteTaskById.mockResolvedValue(true);

    const result = await taskService.deleteTaskById('task-1', 'user-1', 'user');

    expect(mockedDeleteTaskById).toHaveBeenCalledWith('task-1');
    expect(result).toBe(true);
  });

  it('returns false when the row was already gone', async () => {
    mockedFindTaskById.mockResolvedValue(task);
    mockedDeleteTaskById.mockResolvedValue(false);

    const result = await taskService.deleteTaskById('task-1', 'user-1', 'user');

    expect(result).toBe(false);
  });

  it('lets an admin delete someone else task', async () => {
    mockedFindTaskById.mockResolvedValue(task);
    mockedDeleteTaskById.mockResolvedValue(true);

    await expect(
      taskService.deleteTaskById('task-1', 'admin-1', 'admin')
    ).resolves.toBe(true);
  });

  it('denies a non-owner non-admin', async () => {
    mockedFindTaskById.mockResolvedValue(task);

    await expect(
      taskService.deleteTaskById('task-1', 'someone-else', 'user')
    ).rejects.toBeInstanceOf(AppError);
    expect(mockedDeleteTaskById).not.toHaveBeenCalled();
  });

  it('throws 404 when the task does not exist', async () => {
    mockedFindTaskById.mockResolvedValue(null);

    await expect(
      taskService.deleteTaskById('missing', 'user-1', 'user')
    ).rejects.toMatchObject({ statusCode: 404, message: 'Task not found' });
  });
});
