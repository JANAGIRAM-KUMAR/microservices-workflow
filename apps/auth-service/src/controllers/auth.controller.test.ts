import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from 'shared';
import * as authController from './auth.controller';
import * as authService from '../services/auth.service';

vi.mock('../services/auth.service', () => ({
  register: vi.fn(),
  login: vi.fn(),
  getMe: vi.fn(),
}));

const mockedRegister = vi.mocked(authService.register);
const mockedLogin = vi.mocked(authService.login);
const mockedGetMe = vi.mocked(authService.getMe);

const publicUser = {
  id: 'user-1',
  name: 'Janani',
  email: 'janani@example.com',
  role: 'user' as const,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

function makeContext(overrides: {
  body?: unknown;
  headers?: Record<string, string>;
} = {}) {
  const store: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides.headers ?? {})) {
    store[key.toLowerCase()] = value;
  }

  const req = {
    body: overrides.body,
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

beforeEach(() => {
  mockedRegister.mockReset();
  mockedLogin.mockReset();
  mockedGetMe.mockReset();
});

describe('authController.register', () => {
  it('responds 201 with the created user', async () => {
    mockedRegister.mockResolvedValue(publicUser);
    const { req, res, next } = makeContext({ body: { email: 'a@b.com' } });

    await authController.register(req, res, next);

    expect(mockedRegister).toHaveBeenCalledWith({ email: 'a@b.com' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user: publicUser },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards failures to the error handler', async () => {
    const failure = new AppError(400, 'User already exists');
    mockedRegister.mockRejectedValue(failure);
    const { req, res, next } = makeContext({ body: {} });

    await authController.register(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('authController.login', () => {
  it('responds 200 with the token and user', async () => {
    const payload = { token: 'jwt-token', user: publicUser };
    mockedLogin.mockResolvedValue(payload);
    const { req, res, next } = makeContext({
      body: { email: 'a@b.com', password: 'secret1' },
    });

    await authController.login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user: payload },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards failures to the error handler', async () => {
    const failure = new AppError(400, 'Invalid password');
    mockedLogin.mockRejectedValue(failure);
    const { req, res, next } = makeContext({ body: {} });

    await authController.login(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('authController.getMe', () => {
  it('responds 200 when the x-user-id header is present', async () => {
    mockedGetMe.mockResolvedValue(publicUser);
    const { req, res, next } = makeContext({
      headers: { 'x-user-id': 'user-1' },
    });

    await authController.getMe(req, res, next);

    expect(mockedGetMe).toHaveBeenCalledWith('user-1');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user: publicUser },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('throws 401 when the x-user-id header is missing', async () => {
    const { req, res, next } = makeContext();

    await authController.getMe(req, res, next);

    expect(mockedGetMe).not.toHaveBeenCalled();
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Missing x-user-id header');
    expect(res.json).not.toHaveBeenCalled();
  });

  it('forwards a lookup failure to the error handler', async () => {
    const failure = new AppError(404, 'User not found');
    mockedGetMe.mockRejectedValue(failure);
    const { req, res, next } = makeContext({
      headers: { 'x-user-id': 'missing' },
    });

    await authController.getMe(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
