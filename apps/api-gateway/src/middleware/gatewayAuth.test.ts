import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { signToken } from 'shared';
import { gatewayAuth } from './gatewayAuth';

const ORIGINAL_SECRET = process.env.GATEWAY_SECRET;

function makeReq({
  method = 'GET',
  baseUrl = '',
  path = '/',
  headers = {},
}: {
  method?: string;
  baseUrl?: string;
  path?: string;
  headers?: Record<string, string>;
} = {}) {
  const store: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    store[key.toLowerCase()] = value;
  }

  const req = {
    method,
    baseUrl,
    path,
    headers: store,
    header(name: string) {
      return store[name.toLowerCase()];
    },
  };

  return req as unknown as Request & {
    headers: Record<string, string | undefined>;
  };
}

function run(req: Request) {
  const res = {} as Response;
  const next = vi.fn();

  gatewayAuth(req, res, next);

  return { req, next };
}

beforeEach(() => {
  process.env.GATEWAY_SECRET = 'test-gateway-secret';
  process.env.JWT_SECRET = 'test-jwt-secret';
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.GATEWAY_SECRET;
  } else {
    process.env.GATEWAY_SECRET = ORIGINAL_SECRET;
  }
});

describe('gatewayAuth - identity header handling', () => {
  it('attaches the configured gateway secret', () => {
    const req = makeReq({ baseUrl: '/auth', path: '/login', method: 'POST' });

    run(req);

    expect(req.headers['x-gateway-secret']).toBe('test-gateway-secret');
  });

  it('strips a client-supplied x-user-id', () => {
    const req = makeReq({
      method: 'POST',
      baseUrl: '/auth',
      path: '/login',
      headers: { 'x-user-id': 'attacker' },
    });

    run(req);

    expect(req.headers['x-user-id']).toBeUndefined();
  });

  it('strips a client-supplied x-user-role', () => {
    const req = makeReq({
      method: 'POST',
      baseUrl: '/auth',
      path: '/login',
      headers: { 'x-user-role': 'admin' },
    });

    run(req);

    expect(req.headers['x-user-role']).toBeUndefined();
  });

  it('strips a client-supplied gateway secret before setting the real one', () => {
    const req = makeReq({
      method: 'POST',
      baseUrl: '/auth',
      path: '/login',
      headers: { 'x-gateway-secret': 'forged' },
    });

    run(req);

    expect(req.headers['x-gateway-secret']).toBe('test-gateway-secret');
  });

  it('responds with 500 when GATEWAY_SECRET is not configured', () => {
    delete process.env.GATEWAY_SECRET;
    const req = makeReq({ baseUrl: '/auth', path: '/login', method: 'POST' });

    const { next } = run(req);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('GATEWAY_SECRET is not configured');
  });
});

describe('gatewayAuth - public routes', () => {
  it('lets login through without an authorization header', () => {
    const req = makeReq({ method: 'POST', baseUrl: '/auth', path: '/login' });

    const { next } = run(req);

    expect(next).toHaveBeenCalledWith();
    expect(req.headers['x-user-id']).toBeUndefined();
    expect(req.headers['x-gateway-secret']).toBe('test-gateway-secret');
  });

  it('lets register through without an authorization header', () => {
    const req = makeReq({
      method: 'POST',
      baseUrl: '/auth',
      path: '/register',
    });

    const { next } = run(req);

    expect(next).toHaveBeenCalledWith();
  });

  it('does not require a token even if one is supplied', () => {
    const req = makeReq({
      method: 'POST',
      baseUrl: '/auth',
      path: '/login',
      headers: { authorization: 'Bearer nonsense' },
    });

    const { next } = run(req);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('gatewayAuth - protected routes', () => {
  it('rejects a missing authorization header with 401', () => {
    const req = makeReq({ baseUrl: '/auth', path: '/me' });

    const { next } = run(req);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Missing authorization header');
  });

  it('rejects an authorization header without the Bearer prefix', () => {
    const req = makeReq({
      baseUrl: '/auth',
      path: '/me',
      headers: { authorization: signToken({ userId: 'u1', role: 'user' }) },
    });

    const { next } = run(req);

    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('rejects an invalid token with 401', () => {
    const req = makeReq({
      baseUrl: '/auth',
      path: '/me',
      headers: { authorization: 'Bearer not-a-real-token' },
    });

    const { next } = run(req);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid or expired token');
  });

  it('forwards the verified identity as headers for a user', () => {
    const token = signToken({ userId: 'u-1', role: 'user' });
    const req = makeReq({
      baseUrl: '/auth',
      path: '/me',
      headers: { authorization: `Bearer ${token}` },
    });

    const { next } = run(req);

    expect(next).toHaveBeenCalledWith();
    expect(req.headers['x-user-id']).toBe('u-1');
    expect(req.headers['x-user-role']).toBe('user');
    expect(req.headers['x-gateway-secret']).toBe('test-gateway-secret');
  });

  it('forwards the verified identity for an admin', () => {
    const token = signToken({ userId: 'a-1', role: 'admin' });
    const req = makeReq({
      method: 'DELETE',
      baseUrl: '/tasks',
      path: '/t-1',
      headers: { authorization: `Bearer ${token}` },
    });

    const { next } = run(req);

    expect(next).toHaveBeenCalledWith();
    expect(req.headers['x-user-id']).toBe('a-1');
    expect(req.headers['x-user-role']).toBe('admin');
  });

  it('overwrites a spoofed identity with the one from the token', () => {
    const token = signToken({ userId: 'real-user', role: 'user' });
    const req = makeReq({
      baseUrl: '/auth',
      path: '/me',
      headers: {
        authorization: `Bearer ${token}`,
        'x-user-id': 'attacker',
        'x-user-role': 'admin',
      },
    });

    const { next } = run(req);

    expect(next).toHaveBeenCalledWith();
    expect(req.headers['x-user-id']).toBe('real-user');
    expect(req.headers['x-user-role']).toBe('user');
  });

  it('rejects a route that has no RBAC rule with 404', () => {
    const token = signToken({ userId: 'u1', role: 'user' });
    const req = makeReq({
      method: 'PATCH',
      baseUrl: '/tasks',
      path: '/t1',
      headers: { authorization: `Bearer ${token}` },
    });

    const { next } = run(req);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Route not found');
  });
});

describe('gatewayAuth - path resolution', () => {
  it('treats a trailing slash on a public route as public', () => {
    const req = makeReq({ method: 'POST', baseUrl: '/auth', path: '/login/' });

    const { next } = run(req);

    expect(next).toHaveBeenCalledWith();
  });

  it('requires a token before deciding an unknown path does not exist', () => {
    const req = makeReq({ method: 'GET', baseUrl: '/nope', path: '/' });

    const { next } = run(req);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Missing authorization header');
  });
});
