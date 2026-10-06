import { describe, expect, it } from 'vitest';
import { convertToPublicMediaAttachment } from './media.utils';
import type { Attachment } from '../types/media.types';

const attachment: Attachment = {
  id: 'att-1',
  task_id: 'task-1',
  image_url: 'http://localhost:9000/bucket/support-tasks/uuid-1',
  public_id: 'support-tasks/uuid-1',
  uploaded_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('convertToPublicMediaAttachment', () => {
  it('maps the snake_case columns onto the API shape', () => {
    expect(convertToPublicMediaAttachment(attachment)).toEqual({
      id: 'att-1',
      taskId: 'task-1',
      imageUrl: 'http://localhost:9000/bucket/support-tasks/uuid-1',
      publicId: 'support-tasks/uuid-1',
      uploadedBy: 'user-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('returns exactly the whitelisted keys', () => {
    expect(Object.keys(convertToPublicMediaAttachment(attachment)).sort()).toEqual(
      [
        'createdAt',
        'id',
        'imageUrl',
        'publicId',
        'taskId',
        'uploadedBy',
      ]
    );
  });

  it('does not leak the raw column names', () => {
    const publicAttachment = convertToPublicMediaAttachment(attachment);

    expect(publicAttachment).not.toHaveProperty('task_id');
    expect(publicAttachment).not.toHaveProperty('image_url');
    expect(publicAttachment).not.toHaveProperty('public_id');
    expect(publicAttachment).not.toHaveProperty('uploaded_by');
    expect(publicAttachment).not.toHaveProperty('created_at');
  });
});
