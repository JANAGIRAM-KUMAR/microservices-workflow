import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler } from './ErrorHandler';
import { AppError } from './AppError';

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
  };
}

const req = {} as Request;
const next = vi.fn();

describe('errorHandler', () => {
  it('renders an AppError with its own status code and message', () => {
    const res = makeRes();

    errorHandler(new AppError(404, 'Task not found'), req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Task not found',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('renders a 403 AppError', () => {
    const res = makeRes();

    errorHandler(new AppError(403, 'Forbidden'), req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ success: false, message: 'Forbidden' });
  });

  it('falls back to a generic 500 for non-AppError failures', () => {
    const res = makeRes();

    errorHandler(new Error('secret database password is wrong'), req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: 'Internal Server Error',
    });
  });

  it('does not leak unexpected error messages', () => {
    const res = makeRes();

    errorHandler(new Error('ECONNREFUSED 10.0.0.5:5432'), req, res, next);

    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
  });
});
