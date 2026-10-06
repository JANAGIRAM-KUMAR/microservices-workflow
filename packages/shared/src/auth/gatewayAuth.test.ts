import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireGatewaySecret } from './gatewayAuth';
import { AppError } from '../errors/AppError';

const ORIGINAL_SECRET = process.env.GATEWAY_SECRET;

function run(headers: Record<string, string> = {}) {
  const req = {
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
  const res = {} as Response;
  const next = vi.fn();

  requireGatewaySecret(req, res, next);

  return next;
}

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.GATEWAY_SECRET;
  } else {
    process.env.GATEWAY_SECRET = ORIGINAL_SECRET;
  }
});

describe('requireGatewaySecret', () => {
  it('calls next with no arguments when the secret matches', () => {
    process.env.GATEWAY_SECRET = 's3cret';

    const next = run({ 'x-gateway-secret': 's3cret' });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a missing header with 403', () => {
    process.env.GATEWAY_SECRET = 's3cret';

    const next = run();

    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Forbidden');
  });

  it('rejects a wrong secret with 403', () => {
    process.env.GATEWAY_SECRET = 's3cret';

    const next = run({ 'x-gateway-secret': 'wrong' });

    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it('rejects an empty secret header with 403', () => {
    process.env.GATEWAY_SECRET = 's3cret';

    const next = run({ 'x-gateway-secret': '' });

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(403);
  });

  it('responds with 500 when GATEWAY_SECRET is not configured', () => {
    delete process.env.GATEWAY_SECRET;

    const next = run({ 'x-gateway-secret': 'anything' });

    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('GATEWAY_SECRET is not configured');
  });

  it('still rejects when GATEWAY_SECRET is unset and no header sent', () => {
    delete process.env.GATEWAY_SECRET;

    const next = run();

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(500);
  });
});
