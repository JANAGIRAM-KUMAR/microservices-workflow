import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from 'shared';
import * as mediaController from './media.controller';
import * as mediaService from '../services/media.service';

vi.mock('../services/media.service', () => ({
  uploadAttachment: vi.fn(),
  listAttachments: vi.fn(),
}));

const mockedUploadAttachment = vi.mocked(mediaService.uploadAttachment);
const mockedListAttachments = vi.mocked(mediaService.listAttachments);

const publicAttachment = {
  id: 'att-1',
  taskId: 'task-1',
  imageUrl: 'http://127.0.0.1:9000/test-bucket/support-tasks/uuid-1',
  publicId: 'support-tasks/uuid-1',
  uploadedBy: 'user-1',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const file = {
  buffer: Buffer.from('bytes'),
  mimetype: 'image/png',
} as Express.Multer.File;

function makeContext({
  body,
  params,
  headers,
  file: uploadedFile,
}: {
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  file?: Express.Multer.File;
} = {}) {
  const store: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    store[key.toLowerCase()] = value;
  }

  const req = {
    body,
    params: params ?? {},
    headers: store,
    file: uploadedFile,
    header: (name: string) => store[name.toLowerCase()],
  } as unknown as Request;

  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);

  const next = vi.fn();

  return { req, res: res as unknown as Response, next };
}

const identity = { 'x-user-id': 'user-1', 'x-user-role': 'user' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mediaController.uploadAttachment', () => {
  it('responds 201 with the created attachment', async () => {
    mockedUploadAttachment.mockResolvedValue(publicAttachment);
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: identity,
      file,
    });

    await mediaController.uploadAttachment(req, res, next);

    expect(mockedUploadAttachment).toHaveBeenCalledWith({
      taskId: 'task-1',
      userId: 'user-1',
      userRole: 'user',
      file,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { attachment: publicAttachment },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards an undefined file through to the service', async () => {
    mockedUploadAttachment.mockRejectedValue(
      new AppError(400, 'No file found')
    );
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: identity,
    });

    await mediaController.uploadAttachment(req, res, next);

    expect(mockedUploadAttachment).toHaveBeenCalledWith({
      taskId: 'task-1',
      userId: 'user-1',
      userRole: 'user',
      file: undefined,
    });
    expect(next.mock.calls[0][0].statusCode).toBe(400);
  });

  it('throws 401 when x-user-id is missing', async () => {
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: { 'x-user-role': 'user' },
      file,
    });

    await mediaController.uploadAttachment(req, res, next);

    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Missing x-user-id header');
    expect(mockedUploadAttachment).not.toHaveBeenCalled();
  });

  it('throws 401 when x-user-role is missing', async () => {
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: { 'x-user-id': 'user-1' },
      file,
    });

    await mediaController.uploadAttachment(req, res, next);

    expect(next.mock.calls[0][0].message).toBe('Missing x-user-role header');
  });

  it('forwards a service failure', async () => {
    const failure = new AppError(403, 'Forbidden');
    mockedUploadAttachment.mockRejectedValue(failure);
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: identity,
      file,
    });

    await mediaController.uploadAttachment(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('mediaController.listAttachments', () => {
  it('responds 200 with the attachment list', async () => {
    mockedListAttachments.mockResolvedValue([publicAttachment]);
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: identity,
    });

    await mediaController.listAttachments(req, res, next);

    expect(mockedListAttachments).toHaveBeenCalledWith(
      'task-1',
      'user-1',
      'user'
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { getAttachments: [publicAttachment] },
    });
  });

  it('responds 200 with an empty list', async () => {
    mockedListAttachments.mockResolvedValue([]);
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: identity,
    });

    await mediaController.listAttachments(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { getAttachments: [] },
    });
  });

  it('throws 401 when x-user-id is missing', async () => {
    const { req, res, next } = makeContext({
      params: { taskId: 'task-1' },
      headers: {},
    });

    await mediaController.listAttachments(req, res, next);

    expect(next.mock.calls[0][0].statusCode).toBe(401);
    expect(mockedListAttachments).not.toHaveBeenCalled();
  });

  it('forwards a service failure', async () => {
    const failure = new AppError(404, 'Task not found');
    mockedListAttachments.mockRejectedValue(failure);
    const { req, res, next } = makeContext({
      params: { taskId: 'missing' },
      headers: identity,
    });

    await mediaController.listAttachments(req, res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
