import { describe, expect, it } from 'vitest';
import { TOPICS } from './topics';

describe('TOPICS', () => {
  it('pins the topic names consumed by the workflow service', () => {
    expect(TOPICS.TASK_EVENTS).toBe('task.events');
    expect(TOPICS.MEDIA_EVENTS).toBe('media.events');
  });

  it('exposes no other topics', () => {
    expect(Object.keys(TOPICS).sort()).toEqual(['MEDIA_EVENTS', 'TASK_EVENTS']);
  });
});
