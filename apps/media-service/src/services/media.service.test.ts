import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from 'shared';
import * as mediaService from './media.service';
import * as mediaRepository from '../repositories/media.repository';
import { uploadBuffer } from '../utils/storage';
import { publishMediaEvent } from '../kafka';
import type { Attachment } from '../types/media.types';

vi.mock('../repositories/media.repository', () => ({
  findTaskAccess: vi.fn(),
  createAttachment: vi.fn(),
  listAttachments: vi.fn(),
}));

vi.mock('../utils/storage', () => ({
  uploadBuffer: vi.fn(),
}));

vi.mock('../kafka', () => ({
  initKafka: vi.fn(),
  publishMediaEvent: vi.fn(),
}));

const mockedFindTaskAccess = vi.mocked(mediaRepository.findTaskAccess);
const mockedCreateAttachment = vi.mocked(mediaRepository.createAttachment);
const mockedListAttachments = vi.mocked(mediaRepository.listAttachments);
const mockedUploadBuffer = vi.mocked(uploadBuffer);
const mockedPublish = vi.mocked(publishMediaEvent);

const taskAccess = { id: 'task-1', created_by: 'user-1' };

const attachment: Attachment = {
  id: 'att-1',
  task_id: 'task-1',
  image_url: 'http://127.0.0.1:9000/test-bucket/support-tasks/uuid-1',
  public_id: 'support-tasks/uuid-1',
  uploaded_by: 'user-1',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

const file: Express.Multer.File = {
  buffer: Buffer.from('image-bytes'),
  mimetype: 'image/png',
  originalname: 'photo.png',
  size: 11,
  fieldname: 'image',
  encoding: '7bit',
  stream: undefined as unknown as import('stream').Readable,
  destination: '',
  filename: '',
  path: '',
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

describe('mediaService.uploadAttachment', () => {
  it('rejects when no file was supplied', async () => {
    await expect(
      mediaService.uploadAttachment({
        taskId: 'task-1',
        userId: 'user-1',
        userRole: 'user',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'No file found',
    });
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
    expect(mockedFindTaskAccess).not.toHaveBeenCalled();
  });

  it('throws 404 when the task does not exist', async () => {
    mockedFindTaskAccess.mockResolvedValue(null);

    await expect(
      mediaService.uploadAttachment({
        taskId: 'missing',
        userId: 'user-1',
        userRole: 'user',
        file,
      })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Task not found' });
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
  });

  it('throws 403 when the task belongs to someone else', async () => {
    await expect(
      mediaService.uploadAttachment({
        taskId: 'task-1',
        userId: 'someone-else',
        userRole: 'user',
        file,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden, you don't have access to this task",
    });
    expect(mockedUploadBuffer).not.toHaveBeenCalled();
    expect(mockedCreateAttachment).not.toHaveBeenCalled();
  });

  it('lets an admin upload to any task', async () => {
    const result = await mediaService.uploadAttachment({
      taskId: 'task-1',
      userId: 'admin-1',
      userRole: 'admin',
      file,
    });

    expect(result.publicId).toBe('support-tasks/uuid-1');
    expect(mockedCreateAttachment).toHaveBeenCalledTimes(1);
  });

  it('uploads, stores the row, publishes an event and returns the attachment', async () => {
    const result = await mediaService.uploadAttachment({
      taskId: 'task-1',
      userId: 'user-1',
      userRole: 'user',
      file,
    });

    expect(mockedFindTaskAccess).toHaveBeenCalledWith('task-1');
    expect(mockedUploadBuffer).toHaveBeenCalledWith(
      Buffer.from('image-bytes'),
      'image/png'
    );
    expect(mockedCreateAttachment).toHaveBeenCalledWith({
      taskId: 'task-1',
      imageUrl: attachment.image_url,
      publicId: attachment.public_id,
      uploadedBy: 'user-1',
    });
    expect(mockedPublish).toHaveBeenCalledWith('task-1', 'user-1');
    expect(result).toEqual({
      id: 'att-1',
      taskId: 'task-1',
      imageUrl: attachment.image_url,
      publicId: 'support-tasks/uuid-1',
      uploadedBy: 'user-1',
      createdAt: attachment.created_at,
    });
  });

  it('falls back to image/jpeg when the file has no mimetype', async () => {
    await mediaService.uploadAttachment({
      taskId: 'task-1',
      userId: 'user-1',
      userRole: 'user',
      file: { ...file, mimetype: '' },
    });

    expect(mockedUploadBuffer).toHaveBeenCalledWith(
      Buffer.from('image-bytes'),
      'image/jpeg'
    );
  });

  it('does not persist a row when the upload fails', async () => {
    mockedUploadBuffer.mockRejectedValue(new AppError(400, 'S3 unavailable'));

    await expect(
      mediaService.uploadAttachment({
        taskId: 'task-1',
        userId: 'user-1',
        userRole: 'user',
        file,
      })
    ).rejects.toThrow('S3 unavailable');
    expect(mockedCreateAttachment).not.toHaveBeenCalled();
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it('does not publish when the row cannot be persisted', async () => {
    mockedCreateAttachment.mockRejectedValue(new Error('insert failed'));

    await expect(
      mediaService.uploadAttachment({
        taskId: 'task-1',
        userId: 'user-1',
        userRole: 'user',
        file,
      })
    ).rejects.toThrow('insert failed');
    expect(mockedPublish).not.toHaveBeenCalled();
  });

  it('propagates a publish failure', async () => {
    mockedPublish.mockRejectedValue(new Error('broker down'));

    await expect(
      mediaService.uploadAttachment({
        taskId: 'task-1',
        userId: 'user-1',
        userRole: 'user',
        file,
      })
    ).rejects.toThrow('broker down');
  });
});

describe('mediaService.listAttachments', () => {
  it('returns public attachments for the task owner', async () => {
    const result = await mediaService.listAttachments(
      'task-1',
      'user-1',
      'user'
    );

    expect(mockedFindTaskAccess).toHaveBeenCalledWith('task-1');
    expect(mockedListAttachments).toHaveBeenCalledWith('task-1');
    expect(result).toEqual([
      {
        id: 'att-1',
        taskId: 'task-1',
        imageUrl: attachment.image_url,
        publicId: 'support-tasks/uuid-1',
        uploadedBy: 'user-1',
        createdAt: attachment.created_at,
      },
    ]);
  });

  it('returns an empty list when there are no attachments', async () => {
    mockedListAttachments.mockResolvedValue([]);

    expect(
      await mediaService.listAttachments('task-1', 'user-1', 'user')
    ).toEqual([]);
  });

  it('throws 404 when the task does not exist', async () => {
    mockedFindTaskAccess.mockResolvedValue(null);

    await expect(
      mediaService.listAttachments('missing', 'user-1', 'user')
    ).rejects.toMatchObject({ statusCode: 404, message: 'Task not found' });
    expect(mockedListAttachments).not.toHaveBeenCalled();
  });

  it('throws 403 for a non-owner non-admin', async () => {
    await expect(
      mediaService.listAttachments('task-1', 'someone-else', 'user')
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockedListAttachments).not.toHaveBeenCalled();
  });

  it('lets an admin list any task attachments', async () => {
    const result = await mediaService.listAttachments(
      'task-1',
      'admin-1',
      'admin'
    );

    expect(result).toHaveLength(1);
  });
});
