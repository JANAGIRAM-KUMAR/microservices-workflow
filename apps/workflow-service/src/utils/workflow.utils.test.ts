import { describe, expect, it } from 'vitest';
import { convertToPublicWorkflow } from './workflow.utils';
import type { Workflow } from '../types/types';

const workflow: Workflow = {
  id: 'wf-1',
  task_id: 'task-1',
  event_type: 'task.created',
  message: 'Task created successfully!',
  created_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('convertToPublicWorkflow', () => {
  it('keeps the workflow fields as they are', () => {
    expect(convertToPublicWorkflow(workflow)).toEqual({
      id: 'wf-1',
      task_id: 'task-1',
      event_type: 'task.created',
      message: 'Task created successfully!',
      created_by: 'user-1',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('returns exactly the whitelisted keys', () => {
    expect(Object.keys(convertToPublicWorkflow(workflow)).sort()).toEqual([
      'created_at',
      'created_by',
      'event_type',
      'id',
      'message',
      'task_id',
    ]);
  });

  it('preserves each event type', () => {
    expect(
      convertToPublicWorkflow({ ...workflow, event_type: 'media.uploaded' })
        .event_type
    ).toBe('media.uploaded');
  });
});
