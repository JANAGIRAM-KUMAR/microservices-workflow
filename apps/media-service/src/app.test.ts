import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from './app';
import * as mediaRepository from './repositories/media.repository';
import { uploadBuffer } from './utils/storage';
import { publishMediaEvent } from './kafka';
import type { Attachment } from './types/media.types';

vi.mock('./repositories/media.repository', () => ({
  findTaskAccess: vi.fn(),
  createAttachment: vi.fn(),
  listAttachments: vi.fn(),
}));

vi.mock('./utils/storage', () => ({
  uploadBuffer: vi.fn(),
}));

vi.mock('./kafka', () => ({
  initKafka: vi.fn(),
  publishMediaEvent: vi.fn(),
}));

const mockedFindTaskAccess = vi.mocked(mediaRepository.findTaskAccess);
const mockedCreateAttachment = vi.mocked(mediaRepository.createAttachment);
const mockedListAttachments = vi.mocked(mediaRepository.listAttachments);
const mockedUploadBuffer = vi.mocked(uploadBuffer);
const mockedPublish = vi.mocked(publishMediaEvent);

const SECRET = 'test-gateway-secret';
const image = Buffer.from('fake-image-bytes');

const taskAccess = { id: 'task-1', created_by: 'user-1' };

const attachment: Attachment = {
  id: 'att-1',
  task_id: 'task-1',
  image_url: 'http://127.0.0.1:9000/test-bucket/support-tasks/uuid-1',
  public_id: 'support-tasks/uuid-1',
  uploaded_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

const auth = {
  'x-gateway-secret': SECRET,
  'x-user-id': 'user-1',
  'x-user-role': 'user',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedFindTaskAccess.mockResolvedValue(taskAccess);
  mockedCreateAttachment.mockResolvedValue(attachment);
  mockedListAttachments.mockResolvedValue([attachment]);
  mockedUploadBuffer.mockResolvedValue({
    imageUrl: attachment.image_url,
    publicId: attachment.public_id,
  });
  mockedPublish.mockResolvedValue(undefined);
});

describe('GET /health', () => {
  it('reports the service name without a gateway secret', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { service: 'media-service' },
    });
  });
});

describe('gateway secret enforcement', () => {
  it('rejects a request without the secret', async () => {
    const res = await request(app)
      .get('/tasks/task-1/attachments')
      .set({ 'x-user-id': 'user-1', 'x-user-role': 'user' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
    expect(mockedListAttachments).not.toHaveBeenCalled();
  });

  it('rejects a request with a wrong secret', async () => {
    const res = await request(app)
      .get('/tasks/task-1/attachments')
      .set({ ...auth, 'x-gateway-secret': 'nope' });

    expect(res.status).toBe(403);
  });
});

describe('POST /tasks/:taskId/attachments', () => {
  it('uploads an image and returns 201', async () => {
    const res = await request(app)
      .post('/tasks/task-1/attachments')
      .set(auth)
      .attach('image', image, {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.attachment).toEqual({
      id: 'att-1',
      taskId: 'task-1',
      imageUrl: attachment.image_url,
      publicId: 'support-tasks/uuid-1',
      uploadedBy: 'user-1',
      createdAt: attachment.created_at.toISOString(),
    });
    expect(mockedUploadBuffer).toHaveBeenCalledWith(image, 'image/png');
    expect(mockedCreateAttachment).toHaveBeenCalledWith({
      taskId: 'task-1',
      imageUrl: attachment.image_url,
      publicId: attachment.public_id,
      uploadedBy: 'user-1',
    });
    expect(mockedPublish).toHaveBeenCalledWith('task-1', 'user-1');
    expect(res.text).not.toContain('image_url');
  });

  it('rejects a non-image file', async () => {
    const res = await request(app)
      .post('/tasks/task-1/attachments')
      .set(auth)
      .attach('image', Buffer.from('%PDF-1.4'), {
        filename: 'notes.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only image files are allowed');
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
    expect(mockedCreateAttachment).not.toHaveBeenCalled();
  });

  it('rejects a request with no file part', async () => {
    const res = await request(app)
      .post('/tasks/task-1/attachments')
      .set(auth)
      .send({ note: 'no file here' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('No file found');
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
  });

  it('returns 404 when the task does not exist', async () => {
    mockedFindTaskAccess.mockResolvedValue(null);

    const res = await request(app)
      .post('/tasks/missing/attachments')
      .set(auth)
      .attach('image', image, {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Task not found');
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
  });

  it('returns 403 when the task belongs to someone else', async () => {
    const res = await request(app)
      .post('/tasks/task-1/attachments')
      .set({ ...auth, 'x-user-id': 'someone-else' })
      .attach('image', image, {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "Forbidden, you don't have access to this task"
    );
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
  });

  it('returns 401 when the gateway forwarded no user id', async () => {
    const res = await request(app)
      .post('/tasks/task-1/attachments')
      .set({ 'x-gateway-secret': SECRET, 'x-user-role': 'user' })
      .attach('image', image, {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing x-user-id header');
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
  });

  it('returns 401 when the gateway forwarded no user role', async () => {
    const res = await request(app)
      .post('/tasks/task-1/attachments')
      .set({ 'x-gateway-secret': SECRET, 'x-user-id': 'user-1' })
      .attach('image', image, {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing x-user-role header');
  });

  it('returns a generic 500 when storage is not configured', async () => {
    mockedUploadBuffer.mockRejectedValue(
      new Error('AWS credentials are not configured')
    );

    const res = await request(app)
      .post('/tasks/task-1/attachments')
      .set(auth)
      .attach('image', image, {
        filename: 'photo.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: 'Internal Server Error',
    });
  });
});

describe('GET /tasks/:taskId/attachments', () => {
  it('returns the attachment list for the task owner', async () => {
    const res = await request(app)
      .get('/tasks/task-1/attachments')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.getAttachments).toHaveLength(1);
    expect(mockedListAttachments).toHaveBeenCalledWith('task-1');
    expect(res.text).not.toContain('image_url');
  });

  it('returns an empty list when there are no attachments', async () => {
    mockedListAttachments.mockResolvedValue([]);

    const res = await request(app)
      .get('/tasks/task-1/attachments')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data.getAttachments).toEqual([]);
  });

  it('returns 404 for an unknown task', async () => {
    mockedFindTaskAccess.mockResolvedValue(null);

    const res = await request(app)
      .get('/tasks/missing/attachments')
      .set(auth);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Task not found');
  });

  it('returns 403 for another user task', async () => {
    const res = await request(app)
      .get('/tasks/task-1/attachments')
      .set({ ...auth, 'x-user-id': 'someone-else' });

    expect(res.status).toBe(403);
    expect(mockedListAttachments).not.toHaveBeenCalled();
  });

  it('lets an admin list any task attachments', async () => {
    const res = await request(app)
      .get('/tasks/task-1/attachments')
      .set({ ...auth, 'x-user-id': 'admin-1', 'x-user-role': 'admin' });

    expect(res.status).toBe(200);
    expect(mockedListAttachments).toHaveBeenCalledWith('task-1');
  });
});

describe('routing', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/definitely-missing');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Route not found',
    });
  });
});
