import { describe, expect, it } from 'vitest';
import { convertToPublicTask } from './task.utils';
import type { Task } from '../types/task.types';

const task: Task = {
  id: 'task-1',
  title: 'Write the tests',
  status: 'pending',
  created_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

describe('convertToPublicTask', () => {
  it('maps snake_case columns onto the camelCase API shape', () => {
    expect(convertToPublicTask(task)).toEqual({
      id: 'task-1',
      title: 'Write the tests',
      status: 'pending',
      createdBy: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
  });

  it('returns exactly the whitelisted keys', () => {
    expect(Object.keys(convertToPublicTask(task)).sort()).toEqual([
      'createdAt',
      'createdBy',
      'id',
      'status',
      'title',
      'updatedAt',
    ]);
  });

  it('preserves each task status', () => {
    expect(convertToPublicTask({ ...task, status: 'in_progress' }).status).toBe(
      'in_progress'
    );
    expect(convertToPublicTask({ ...task, status: 'completed' }).status).toBe(
      'completed'
    );
  });

  it('does not leak the raw created_by column name', () => {
    expect(convertToPublicTask(task)).not.toHaveProperty('created_by');
  });
});
