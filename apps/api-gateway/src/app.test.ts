import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import request from 'supertest';
import { signToken } from 'shared';

type SeenRequest = {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
};

type Stub = {
  server: http.Server;
  url: string;
  seen: SeenRequest[];
};

const stubs: Record<'auth' | 'task' | 'media' | 'workflow', Stub | null> = {
  auth: null,
  task: null,
  media: null,
  workflow: null,
};

let app: Express;

function startStub(): Promise<Stub> {
  const seen: SeenRequest[] = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      seen.push({
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ stub: true }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        seen,
      });
    });
  });
}

beforeAll(async () => {
  stubs.auth = await startStub();
  stubs.task = await startStub();
  stubs.media = await startStub();
  stubs.workflow = await startStub();

  process.env.AUTH_SERVICE_URL = stubs.auth.url;
  process.env.TASK_SERVICE_URL = stubs.task.url;
  process.env.MEDIA_SERVICE_URL = stubs.media.url;
  process.env.WORKFLOW_SERVICE_URL = stubs.workflow.url;
  process.env.GATEWAY_SECRET = 'test-gateway-secret';
  process.env.JWT_SECRET = 'test-jwt-secret';

  const appModule = (await import('./app.js')) as unknown as {
    default: Express;
  };
  app = appModule.default;
});

afterAll(async () => {
  for (const stub of Object.values(stubs)) {
    if (!stub) continue;
    await new Promise<void>((resolve) => stub.server.close(() => resolve()));
  }
});

function userToken() {
  return signToken({ userId: 'user-1', role: 'user' });
}

function adminToken() {
  return signToken({ userId: 'admin-1', role: 'admin' });
}

function resetStubs() {
  for (const stub of Object.values(stubs)) {
    if (stub) stub.seen.length = 0;
  }
}

describe('api-gateway health and errors', () => {
  it('serves its own health endpoint without proxying', async () => {
    resetStubs();

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { service: 'api-gateway' },
    });
    expect(stubs.auth!.seen).toHaveLength(0);
    expect(stubs.task!.seen).toHaveLength(0);
  });

  it('returns a 404 envelope for unknown routes', async () => {
    const res = await request(app).get('/definitely-not-a-route');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found',
    });
  });

  it('sets hardened security headers', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('api-gateway -> auth service', () => {
  it('proxies a public login and injects the gateway secret', async () => {
    resetStubs();

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'a@b.com', password: 'secret1' });

    expect(res.status).toBe(200);
    expect(stubs.auth!.seen).toHaveLength(1);
    expect(stubs.auth!.seen[0].url).toBe('/auth/login');
    expect(stubs.auth!.seen[0].headers['x-gateway-secret']).toBe(
      'test-gateway-secret'
    );
  });

  it('strips a spoofed identity header on a public route', async () => {
    resetStubs();

    await request(app)
      .post('/auth/register')
      .set('x-user-id', 'attacker')
      .set('x-user-role', 'admin')
      .send({ name: 'Attacker', email: 'x@y.com', password: 'secret1' });

    expect(stubs.auth!.seen[0].headers['x-user-id']).toBeUndefined();
    expect(stubs.auth!.seen[0].headers['x-user-role']).toBeUndefined();
  });

  it('blocks a protected auth route without a token', async () => {
    resetStubs();

    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing authorization header');
    expect(stubs.auth!.seen).toHaveLength(0);
  });

  it('blocks a protected auth route with a bad token', async () => {
    resetStubs();

    const res = await request(app)
      .get('/auth/me')
      .set('authorization', 'Bearer garbage');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid or expired token');
    expect(stubs.auth!.seen).toHaveLength(0);
  });

  it('forwards the verified identity for a valid token', async () => {
    resetStubs();

    const res = await request(app)
      .get('/auth/me')
      .set('authorization', `Bearer ${userToken()}`);

    expect(res.status).toBe(200);
    expect(stubs.auth!.seen[0].url).toBe('/auth/me');
    expect(stubs.auth!.seen[0].headers['x-user-id']).toBe('user-1');
    expect(stubs.auth!.seen[0].headers['x-user-role']).toBe('user');
    expect(stubs.auth!.seen[0].headers['x-gateway-secret']).toBe(
      'test-gateway-secret'
    );
  });
});

describe('api-gateway task routing', () => {
  it('routes a plain task path to the task service', async () => {
    resetStubs();

    const res = await request(app)
      .get('/tasks')
      .set('authorization', `Bearer ${userToken()}`);

    expect(res.status).toBe(200);
    expect(stubs.task!.seen).toHaveLength(1);
    expect(stubs.task!.seen[0].url).toBe('/tasks/');
    expect(stubs.media!.seen).toHaveLength(0);
    expect(stubs.workflow!.seen).toHaveLength(0);
  });

  it('routes a single task to the task service and rewrites the path', async () => {
    resetStubs();

    await request(app)
      .get('/tasks/t-1')
      .set('authorization', `Bearer ${userToken()}`);

    expect(stubs.task!.seen[0].url).toBe('/tasks/t-1');
  });

  it('forwards a task creation body to the task service', async () => {
    resetStubs();

    const res = await request(app)
      .post('/tasks')
      .set('authorization', `Bearer ${userToken()}`)
      .send({ title: 'Write the tests' });

    expect(res.status).toBe(200);
    expect(stubs.task!.seen[0].method).toBe('POST');
    expect(JSON.parse(stubs.task!.seen[0].body)).toEqual({
      title: 'Write the tests',
    });
  });

  it('routes attachment paths to the media service', async () => {
    resetStubs();

    await request(app)
      .get('/tasks/t-1/attachments')
      .set('authorization', `Bearer ${userToken()}`);

    expect(stubs.media!.seen).toHaveLength(1);
    expect(stubs.media!.seen[0].url).toBe('/tasks/t-1/attachments');
    expect(stubs.task!.seen).toHaveLength(0);
  });

  it('routes workflow paths to the workflow service', async () => {
    resetStubs();

    await request(app)
      .get('/tasks/t-1/workflows')
      .set('authorization', `Bearer ${userToken()}`);

    expect(stubs.workflow!.seen).toHaveLength(1);
    expect(stubs.workflow!.seen[0].url).toBe('/tasks/t-1/workflows');
    expect(stubs.task!.seen).toHaveLength(0);
  });

  it('rejects a method with no RBAC rule before proxying', async () => {
    resetStubs();

    const res = await request(app)
      .patch('/tasks/t-1')
      .set('authorization', `Bearer ${userToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Route not found');
    expect(stubs.task!.seen).toHaveLength(0);
  });

  it('does not require a token for routes outside the gateway rules', async () => {
    resetStubs();

    const res = await request(app).post('/tasks').send({ title: 'no token' });

    expect(res.status).toBe(401);
    expect(stubs.task!.seen).toHaveLength(0);
  });

  it('accepts an admin token on a delete', async () => {
    resetStubs();

    const res = await request(app)
      .delete('/tasks/t-1')
      .set('authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(stubs.task!.seen[0].method).toBe('DELETE');
    expect(stubs.task!.seen[0].headers['x-user-role']).toBe('admin');
  });
});
