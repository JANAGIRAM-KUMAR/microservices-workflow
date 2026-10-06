import { describe, expect, it } from 'vitest';
import { createTaskSchema, updateTaskSchema } from './task.schemas';

describe('createTaskSchema', () => {
  it('accepts a title of 5 characters or more', () => {
    expect(createTaskSchema.safeParse({ title: 'Hello' }).success).toBe(true);
    expect(
      createTaskSchema.safeParse({ title: 'A much longer title' }).success
    ).toBe(true);
  });

  it('rejects a title shorter than 5 characters', () => {
    const result = createTaskSchema.safeParse({ title: 'abc' });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      'Title must be at least 5 characters long'
    );
  });

  it('rejects a missing title', () => {
    expect(createTaskSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a non-string title', () => {
    expect(createTaskSchema.safeParse({ title: 42 }).success).toBe(false);
  });

  it('strips unknown fields such as created_by', () => {
    const result = createTaskSchema.safeParse({
      title: 'Hello',
      created_by: 'someone-else',
      status: 'completed',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: 'Hello' });
  });
});

describe('updateTaskSchema', () => {
  it('accepts a valid title and status', () => {
    const result = updateTaskSchema.safeParse({
      title: 'Updated title',
      status: 'in_progress',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      title: 'Updated title',
      status: 'in_progress',
    });
  });

  it.each(['pending', 'in_progress', 'completed'] as const)(
    'accepts the %s status',
    (status) => {
      expect(
        updateTaskSchema.safeParse({ title: 'Updated', status }).success
      ).toBe(true);
    }
  );

  it('rejects an unknown status', () => {
    const result = updateTaskSchema.safeParse({
      title: 'Updated',
      status: 'archived',
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      'Invalid option: expected one of "pending"|"in_progress"|"completed"'
    );
  });

  it('rejects a missing status', () => {
    expect(updateTaskSchema.safeParse({ title: 'Updated' }).success).toBe(false);
  });

  it('rejects a short title', () => {
    expect(
      updateTaskSchema.safeParse({ title: 'abc', status: 'pending' }).success
    ).toBe(false);
  });
});
