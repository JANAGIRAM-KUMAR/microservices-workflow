import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from './app';
import * as taskRepository from './repositories/task.repository';
import { publishTaskEvent } from './kafka';
import type { Task } from './types/task.types';

vi.mock('./repositories/task.repository', () => ({
  createTask: vi.fn(),
  listTasks: vi.fn(),
  findTaskById: vi.fn(),
  updateTask: vi.fn(),
  deleteTaskById: vi.fn(),
}));

vi.mock('./kafka', () => ({
  initKafka: vi.fn(),
  publishTaskEvent: vi.fn(),
}));

const mockedCreateTask = vi.mocked(taskRepository.createTask);
const mockedListTasks = vi.mocked(taskRepository.listTasks);
const mockedFindTaskById = vi.mocked(taskRepository.findTaskById);
const mockedUpdateTask = vi.mocked(taskRepository.updateTask);
const mockedDeleteTaskById = vi.mocked(taskRepository.deleteTaskById);
const mockedPublish = vi.mocked(publishTaskEvent);

const SECRET = 'test-gateway-secret';

const task: Task = {
  id: 'task-1',
  title: 'Write the tests',
  status: 'pending',
  created_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

const auth = {
  'x-gateway-secret': SECRET,
  'x-user-id': 'user-1',
  'x-user-role': 'user',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreateTask.mockResolvedValue(task);
  mockedListTasks.mockResolvedValue([task]);
  mockedFindTaskById.mockResolvedValue(task);
  mockedUpdateTask.mockResolvedValue(task);
  mockedDeleteTaskById.mockResolvedValue(true);
  mockedPublish.mockResolvedValue(undefined);
});

describe('GET /health', () => {
  it('reports the service name without a gateway secret', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { service: 'task-service' },
    });
  });
});

describe('gateway secret enforcement on /tasks', () => {
  it('rejects a request without the secret', async () => {
    const res = await request(app)
      .get('/tasks')
      .set({ 'x-user-id': 'user-1', 'x-user-role': 'user' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
    expect(mockedListTasks).not.toHaveBeenCalled();
  });

  it('rejects a request with a wrong secret', async () => {
    const res = await request(app)
      .get('/tasks')
      .set({ ...auth, 'x-gateway-secret': 'nope' });

    expect(res.status).toBe(403);
  });

  it('lets a request with the right secret through', async () => {
    const res = await request(app).get('/tasks').set(auth);

    expect(res.status).toBe(200);
  });
});

describe('POST /tasks', () => {
  it('creates a task, publishes an event and returns 201', async () => {
    const res = await request(app)
      .post('/tasks')
      .set(auth)
      .send({ title: 'Write the tests' });

    expect(res.status).toBe(201);
    expect(res.body.data.task).toEqual({
      id: 'task-1',
      title: 'Write the tests',
      status: 'pending',
      createdBy: 'user-1',
      createdAt: task.created_at.toISOString(),
      updatedAt: task.updated_at.toISOString(),
    });
    expect(mockedCreateTask).toHaveBeenCalledWith({
      title: 'Write the tests',
      createdBy: 'user-1',
    });
    expect(mockedPublish).toHaveBeenCalledWith('task-1', 'user-1');
    expect(res.text).not.toContain('created_by');
  });

  it('rejects a title shorter than 5 characters', async () => {
    const res = await request(app)
      .post('/tasks')
      .set(auth)
      .send({ title: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Title must be at least 5 characters long'
    );
    expect(mockedCreateTask).not.toHaveBeenCalled();
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it('rejects a missing title', async () => {
    const res = await request(app).post('/tasks').set(auth).send({});

    expect(res.status).toBe(400);
    expect(mockedCreateTask).not.toHaveBeenCalled();
  });

  it('does not let a client set created_by', async () => {
    const res = await request(app)
      .post('/tasks')
      .set(auth)
      .send({ title: 'Write the tests', created_by: 'attacker' });

    expect(res.status).toBe(201);
    expect(mockedCreateTask).toHaveBeenCalledWith({
      title: 'Write the tests',
      createdBy: 'user-1',
    });
  });

  it('returns 401 when the gateway forwarded no user id', async () => {
    const res = await request(app)
      .post('/tasks')
      .set({ 'x-gateway-secret': SECRET, 'x-user-role': 'user' })
      .send({ title: 'Write the tests' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing x-user-id header');
    expect(mockedCreateTask).not.toHaveBeenCalled();
  });

  it('returns 401 when the gateway forwarded no user role', async () => {
    const res = await request(app)
      .post('/tasks')
      .set({ 'x-gateway-secret': SECRET, 'x-user-id': 'user-1' })
      .send({ title: 'Write the tests' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing x-user-role header');
  });
});

describe('GET /tasks', () => {
  it('returns the caller tasks', async () => {
    const res = await request(app).get('/tasks').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(mockedListTasks).toHaveBeenCalledWith({
      userId: 'user-1',
      role: 'user',
    });
  });

  it('returns an empty list when there is nothing to show', async () => {
    mockedListTasks.mockResolvedValue([]);

    const res = await request(app).get('/tasks').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toEqual([]);
  });
});

describe('GET /tasks/:id', () => {
  it('returns a single task', async () => {
    const res = await request(app).get('/tasks/task-1').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.task.id).toBe('task-1');
  });

  it('returns 404 for an unknown task', async () => {
    mockedFindTaskById.mockResolvedValue(null);

    const res = await request(app).get('/tasks/missing').set(auth);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Task not found');
  });

  it('returns 403 when the task belongs to someone else', async () => {
    mockedFindTaskById.mockResolvedValue({
      ...task,
      created_by: 'someone-else',
    });

    const res = await request(app).get('/tasks/task-1').set(auth);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "Forbidden, you don't have access to this task"
    );
  });

  it('lets an admin read another user task', async () => {
    mockedFindTaskById.mockResolvedValue({
      ...task,
      created_by: 'someone-else',
    });

    const res = await request(app)
      .get('/tasks/task-1')
      .set({ ...auth, 'x-user-id': 'admin-1', 'x-user-role': 'admin' });

    expect(res.status).toBe(200);
  });
});

describe('PUT /tasks/:id', () => {
  it('updates a task and returns 200', async () => {
    mockedUpdateTask.mockResolvedValue({
      ...task,
      title: 'Updated',
      status: 'completed',
    });

    const res = await request(app)
      .put('/tasks/task-1')
      .set(auth)
      .send({ title: 'Updated', status: 'completed' });

    expect(res.status).toBe(200);
    expect(res.body.data.task.title).toBe('Updated');
    expect(res.body.data.task.status).toBe('completed');
  });

  it('rejects an invalid status with 400', async () => {
    const res = await request(app)
      .put('/tasks/task-1')
      .set(auth)
      .send({ title: 'Updated', status: 'archived' });

    expect(res.status).toBe(400);
    expect(mockedUpdateTask).not.toHaveBeenCalled();
  });

  it('rejects a short title with 400', async () => {
    const res = await request(app)
      .put('/tasks/task-1')
      .set(auth)
      .send({ title: 'abc', status: 'pending' });

    expect(res.status).toBe(400);
    expect(mockedUpdateTask).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown task', async () => {
    mockedFindTaskById.mockResolvedValue(null);

    const res = await request(app)
      .put('/tasks/missing')
      .set(auth)
      .send({ title: 'Updated', status: 'pending' });

    expect(res.status).toBe(404);
    expect(mockedUpdateTask).not.toHaveBeenCalled();
  });
});

describe('DELETE /tasks/:id', () => {
  it('reports a successful delete', async () => {
    mockedDeleteTaskById.mockResolvedValue(true);

    const res = await request(app).delete('/tasks/task-1').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.result).toBe('Task deleted successfully');
  });

  it('reports when no row was deleted', async () => {
    mockedDeleteTaskById.mockResolvedValue(false);

    const res = await request(app).delete('/tasks/task-1').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.result).toBe('Task not found');
  });

  it('returns 404 for an unknown task', async () => {
    mockedFindTaskById.mockResolvedValue(null);

    const res = await request(app).delete('/tasks/missing').set(auth);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Task not found');
    expect(mockedDeleteTaskById).not.toHaveBeenCalled();
  });

  it('returns 403 when the task belongs to someone else', async () => {
    mockedFindTaskById.mockResolvedValue({
      ...task,
      created_by: 'someone-else',
    });

    const res = await request(app).delete('/tasks/task-1').set(auth);

    expect(res.status).toBe(403);
    expect(mockedDeleteTaskById).not.toHaveBeenCalled();
  });
});

describe('routing', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/definitely-missing');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found',
    });
  });
});
