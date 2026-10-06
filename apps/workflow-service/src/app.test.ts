import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from './app';
import * as workflowRepository from './repositories/workflow.repository';
import type { Workflow } from './types/types';

vi.mock('./repositories/workflow.repository', () => ({
  findTaskOwner: vi.fn(),
  createWorkflow: vi.fn(),
  listWorkflows: vi.fn(),
}));

const mockedFindTaskOwner = vi.mocked(workflowRepository.findTaskOwner);
const mockedListWorkflows = vi.mocked(workflowRepository.listWorkflows);

const SECRET = 'test-gateway-secret';

const workflow: Workflow = {
  id: 'wf-1',
  task_id: 'task-1',
  event_type: 'task.created',
  message: 'Task created successfully!',
  created_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

const auth = {
  'x-gateway-secret': SECRET,
  'x-user-id': 'user-1',
  'x-user-role': 'user',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedFindTaskOwner.mockResolvedValue({ created_by: 'user-1' });
  mockedListWorkflows.mockResolvedValue([workflow]);
});

describe('GET /health', () => {
  it('reports the service name without a gateway secret', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { service: 'workflow-service' },
    });
  });
});

describe('gateway secret enforcement', () => {
  it('rejects a route request without the secret', async () => {
    const res = await request(app)
      .get('/tasks/task-1/workflows')
      .set({ 'x-user-id': 'user-1', 'x-user-role': 'user' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it('rejects a route request with a wrong secret', async () => {
    const res = await request(app)
      .get('/tasks/task-1/workflows')
      .set({ ...auth, 'x-gateway-secret': 'nope' });

    expect(res.status).toBe(403);
  });

  it('does not apply the secret to the health route', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
  });
});

describe('GET /tasks/:taskId/workflows', () => {
  it('returns the workflow history for the task owner', async () => {
    const res = await request(app)
      .get('/tasks/task-1/workflows')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.workflows).toEqual([
      {
        id: 'wf-1',
        task_id: 'task-1',
        event_type: 'task.created',
        message: 'Task created successfully!',
        created_by: 'user-1',
        created_at: workflow.created_at.toISOString(),
      },
    ]);
    expect(mockedFindTaskOwner).toHaveBeenCalledWith('task-1');
    expect(mockedListWorkflows).toHaveBeenCalledWith('task-1');
  });

  it('returns an empty list when the task has no history', async () => {
    mockedListWorkflows.mockResolvedValue([]);

    const res = await request(app)
      .get('/tasks/task-1/workflows')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.workflows).toEqual([]);
  });

  it('returns 401 when the gateway forwarded no user id', async () => {
    const res = await request(app)
      .get('/tasks/task-1/workflows')
      .set({ 'x-gateway-secret': SECRET, 'x-user-role': 'user' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing x-user-id header');
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it('returns 401 when the gateway forwarded no user role', async () => {
    const res = await request(app)
      .get('/tasks/task-1/workflows')
      .set({ 'x-gateway-secret': SECRET, 'x-user-id': 'user-1' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing x-user-role header');
  });

  it('returns 404 for an unknown task', async () => {
    mockedFindTaskOwner.mockResolvedValue(null);

    const res = await request(app)
      .get('/tasks/missing/workflows')
      .set(auth);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Task not found');
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it('returns 403 for another user task', async () => {
    mockedFindTaskOwner.mockResolvedValue({ created_by: 'someone-else' });

    const res = await request(app)
      .get('/tasks/task-1/workflows')
      .set(auth);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "Forbidden, you don't have access to this task"
    );
    expect(mockedListWorkflows).not.toHaveBeenCalled();
  });

  it('lets an admin read any task history', async () => {
    mockedFindTaskOwner.mockResolvedValue({ created_by: 'someone-else' });

    const res = await request(app)
      .get('/tasks/task-1/workflows')
      .set({ ...auth, 'x-user-id': 'admin-1', 'x-user-role': 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.data.workflows).toHaveLength(1);
  });

  it('returns a generic 500 when the database fails', async () => {
    mockedListWorkflows.mockRejectedValue(new Error('connection reset'));

    const res = await request(app)
      .get('/tasks/task-1/workflows')
      .set(auth);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: 'Internal Server Error',
    });
    expect(res.text).not.toContain('connection reset');
  });
});

describe('routing', () => {
  it('applies the gateway secret to every non-health route', async () => {
    const res = await request(app).get('/definitely-missing');

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
  });

  it('returns 404 for unknown routes once the secret is supplied', async () => {
    const res = await request(app)
      .get('/definitely-missing')
      .set('x-gateway-secret', SECRET);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found',
    });
  });

  it('does not expose routes for other HTTP methods', async () => {
    const res = await request(app)
      .post('/tasks/task-1/workflows')
      .set(auth);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Route not found');
  });
});
