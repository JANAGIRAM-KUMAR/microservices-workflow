import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { failedResponse, successResponse } from './response';

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockImplementation(function (this: unknown, code: number) {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((payload: unknown) => {
    res.body = payload;
    return res;
  });
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('successResponse', () => {
  it('defaults to 200 with a success envelope', () => {
    const res = makeRes();

    const returned = successResponse(res, { service: 'auth-service' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { service: 'auth-service' },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { service: 'auth-service' },
    });
    expect(returned).toBe(res);
  });

  it('honours an explicit status code', () => {
    const res = makeRes();

    successResponse(res, { user: { id: '1' } }, 201);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { user: { id: '1' } },
    });
  });

  it('allows a null payload', () => {
    const res = makeRes();

    successResponse(res, null);

    expect(res.body).toEqual({ success: true, data: null });
  });
});

describe('failedResponse', () => {
  it('defaults to 400 with a failure envelope', () => {
    const res = makeRes();

    failedResponse(res, 'Validation failed');

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      success: false,
      message: 'Validation failed',
    });
  });

  it('honours an explicit status code', () => {
    const res = makeRes();

    failedResponse(res, 'Too many requests', 429);

    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({
      success: false,
      message: 'Too many requests',
    });
  });
});
