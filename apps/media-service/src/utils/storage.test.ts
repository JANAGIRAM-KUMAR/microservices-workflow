import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from 'shared';

const { clientConfigs, sendMock, commands } = vi.hoisted(() => ({
  clientConfigs: [] as unknown[],
  sendMock: vi.fn(),
  commands: [] as unknown[],
}));

vi.mock('@aws-sdk/client-s3', () => {
  class S3Client {
    send = sendMock;
    constructor(config: unknown) {
      clientConfigs.push(config);
    }
  }

  class PutObjectCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
      commands.push(input);
    }
  }

  return { S3Client, PutObjectCommand };
});

import { uploadBuffer } from './storage';

const ORIGINAL = {
  STORAGE_BUCKET: process.env.STORAGE_BUCKET,
  AWS_ENDPOINT_URL_S3: process.env.AWS_ENDPOINT_URL_S3,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setCompleteConfig() {
  process.env.STORAGE_BUCKET = 'test-bucket';
  process.env.AWS_ENDPOINT_URL_S3 = 'http://127.0.0.1:9000';
  process.env.AWS_ACCESS_KEY_ID = 'test-access-key';
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.AWS_REGION = 'us-east-1';
}

beforeEach(() => {
  setCompleteConfig();
  sendMock.mockReset();
  sendMock.mockResolvedValue({});
  clientConfigs.length = 0;
  commands.length = 0;
});

afterEach(restoreEnv);

describe('uploadBuffer', () => {
  it('uploads the buffer and returns a public URL and key', async () => {
    const buffer = Buffer.from('fake-image-bytes');

    const result = await uploadBuffer(buffer, 'image/png');

    expect(result.imageUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:9000\/test-bucket\/support-tasks\/[0-9a-f-]{36}$/
    );
    expect(result.publicId).toMatch(/^support-tasks\/[0-9a-f-]{36}$/);
    expect(result.imageUrl).toContain(result.publicId);
  });

  it('sends a PutObjectCommand carrying the buffer and content type', async () => {
    const buffer = Buffer.from('fake-image-bytes');

    await uploadBuffer(buffer, 'image/png');

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      Bucket: 'test-bucket',
      Body: buffer,
      ContentType: 'image/png',
    });
    expect((commands[0] as { Key: string }).Key).toMatch(
      /^support-tasks\/[0-9a-f-]{36}$/
    );
  });

  it('defaults the content type to image/jpeg', async () => {
    await uploadBuffer(Buffer.from('bytes'));

    expect(commands[0]).toMatchObject({ ContentType: 'image/jpeg' });
  });

  it('produces a unique key for every upload', async () => {
    const first = await uploadBuffer(Buffer.from('a'));
    const second = await uploadBuffer(Buffer.from('b'));

    expect(first.publicId).not.toBe(second.publicId);
  });

  it('strips a trailing slash from the configured endpoint', async () => {
    process.env.AWS_ENDPOINT_URL_S3 = 'http://127.0.0.1:9000/';

    const result = await uploadBuffer(Buffer.from('bytes'));

    expect(result.imageUrl.startsWith('http://127.0.0.1:9000/')).toBe(true);
    expect(result.imageUrl).not.toContain('9000//');
  });

  it('configures the client with the supplied credentials and path style', async () => {
    await uploadBuffer(Buffer.from('bytes'));

    expect(clientConfigs).toHaveLength(1);
    expect(clientConfigs[0]).toMatchObject({
      endpoint: 'http://127.0.0.1:9000',
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: 'test-access-key',
        secretAccessKey: 'test-secret-key',
      },
    });
  });

  it('throws 400 when STORAGE_BUCKET is missing', async () => {
    delete process.env.STORAGE_BUCKET;

    await expect(uploadBuffer(Buffer.from('bytes'))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('throws 400 when the endpoint is missing', async () => {
    delete process.env.AWS_ENDPOINT_URL_S3;

    await expect(uploadBuffer(Buffer.from('bytes'))).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('throws 400 when an access key is missing', async () => {
    delete process.env.AWS_ACCESS_KEY_ID;

    await expect(uploadBuffer(Buffer.from('bytes'))).rejects.toBeInstanceOf(
      AppError
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('throws 400 when a secret key is missing', async () => {
    delete process.env.AWS_SECRET_ACCESS_KEY;

    await expect(uploadBuffer(Buffer.from('bytes'))).rejects.toMatchObject({
      statusCode: 400,
      message: 'AWS credentials are not configured',
    });
  });

  it('throws 400 when the region is missing', async () => {
    delete process.env.AWS_REGION;

    await expect(uploadBuffer(Buffer.from('bytes'))).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('propagates an S3 failure', async () => {
    sendMock.mockRejectedValue(new Error('SlowDown'));

    await expect(uploadBuffer(Buffer.from('bytes'))).rejects.toThrow(
      'SlowDown'
    );
  });
});
