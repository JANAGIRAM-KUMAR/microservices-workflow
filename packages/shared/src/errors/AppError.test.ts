import { describe, expect, it } from 'vitest';
import { AppError } from './AppError';

describe('AppError', () => {
  it('carries the status code and message', () => {
    const err = new AppError(404, 'Task not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Task not found');
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it('defaults to an operational error', () => {
    expect(new AppError(400, 'Bad request').isOperational).toBe(true);
  });

  it('honours an explicit operational flag', () => {
    expect(new AppError(500, 'Boom', false).isOperational).toBe(false);
    expect(new AppError(500, 'Boom', true).isOperational).toBe(true);
  });

  it('defines statusCode as an own property from the constructor', () => {
    const err = new AppError(403, 'Forbidden');
    expect(Object.prototype.hasOwnProperty.call(err, 'statusCode')).toBe(true);
    expect(err.statusCode).toBe(403);
  });

  it('keeps a usable stack trace', () => {
    const err = new AppError(500, 'Server exploded');
    expect(err.stack).toContain('AppError');
  });
});
