import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod/v3';
import { validateBody } from './validationBody';
import { AppError } from '../errors/AppError';

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long'),
});

function run(body: unknown) {
  const req = { body } as Request;
  const res = {} as Response;
  const next = vi.fn();

  validateBody(schema)(req, res, next);

  return { req, next };
}

describe('validateBody', () => {
  it('passes valid input through to the next middleware', () => {
    const { req, next } = run({ title: 'Write the report' });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ title: 'Write the report' });
  });

  it('rejects invalid input with a 400 AppError', () => {
    const { next } = run({ title: 'hi' });

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Title must be at least 5 characters long');
  });

  it('rejects a body of the wrong shape', () => {
    const { next } = run({ nope: true });

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(400);
  });

  it('joins multiple issue messages with a comma', () => {
    const multi = z.object({
      name: z.string().min(3, 'name too short'),
      email: z.string().email('bad email'),
    });

    const req = { body: { name: 'a', email: 'nope' } } as Request;
    const next = vi.fn();

    validateBody(multi)(req, {} as Response, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('name too short');
    expect(err.message).toContain('bad email');
    expect(err.message.split(', ')).toHaveLength(2);
  });

  it('replaces req.body with the parsed (coerced) value', () => {
    const coerced = z.object({ count: z.coerce.number() });

    const req = { body: { count: '42' } } as Request;
    const next = vi.fn();

    validateBody(coerced)(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ count: 42 });
  });
});
