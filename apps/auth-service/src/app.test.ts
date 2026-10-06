import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from './app';
import {
  createUser,
  findByEmail,
  findById,
} from './repositories/user.repository';
import type { User } from './types/auth.types';

vi.mock('./repositories/user.repository', () => ({
  createUser: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
}));

const mockedFindByEmail = vi.mocked(findByEmail);
const mockedCreateUser = vi.mocked(createUser);
const mockedFindById = vi.mocked(findById);

const SECRET = 'test-gateway-secret';

const storedUser: User = {
  id: 'user-1',
  name: 'Janani',
  email: 'janani@example.com',
  password_hash: bcrypt.hashSync('secret1', 4),
  role: 'user',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

beforeEach(() => {
  mockedFindByEmail.mockReset();
  mockedCreateUser.mockReset();
  mockedFindById.mockReset();
  mockedFindByEmail.mockResolvedValue(null);
  mockedFindById.mockResolvedValue(null);
});

describe('GET /health', () => {
  it('reports the service name without needing the gateway secret', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { service: 'auth-service' },
    });
  });
});

describe('gateway secret enforcement', () => {
  it('rejects a request without the secret', async () => {
    const res = await request(app).post('/auth/login').send({});

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
  });

  it('rejects a request with a wrong secret', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-gateway-secret', 'wrong')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Forbidden');
  });

  it('accepts a request with the right secret', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-gateway-secret', SECRET)
      .send({ email: 'a@b.com', password: 'secret1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User not found');
  });
});

describe('POST /auth/register', () => {
  it('creates a user and returns 201', async () => {
    mockedCreateUser.mockImplementation(async (input) => ({
      ...storedUser,
      name: input.name,
      email: input.email,
      password_hash: input.passwordHash,
    }));

    const res = await request(app)
      .post('/auth/register')
      .set('x-gateway-secret', SECRET)
      .send({ name: 'Janani', email: 'janani@example.com', password: 'secret1' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toEqual({
      id: 'user-1',
      name: 'Janani',
      email: 'janani@example.com',
      role: 'user',
      created_at: storedUser.created_at.toISOString(),
    });
    expect(res.text).not.toContain('password_hash');
    expect(mockedCreateUser.mock.calls[0][0].passwordHash).not.toBe('secret1');
  });

  it('rejects a duplicate email with 400', async () => {
    mockedFindByEmail.mockResolvedValue(storedUser);

    const res = await request(app)
      .post('/auth/register')
      .set('x-gateway-secret', SECRET)
      .send({ name: 'Janani', email: 'janani@example.com', password: 'secret1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already exists');
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it('rejects an invalid body before reaching the service', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('x-gateway-secret', SECRET)
      .send({ name: 'Jo', email: 'not-an-email', password: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Name must be at least 3 characters long');
    expect(res.body.message).toContain('Invalid email address');
    expect(res.body.message).toContain(
      'Password must be at least 6 characters long'
    );
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it('rejects a missing body', async () => {
    const res = await request(app)
      .post('/auth/register')
      .set('x-gateway-secret', SECRET);

    expect(res.status).toBe(400);
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });
});

describe('POST /auth/login', () => {
  it('returns a token for valid credentials', async () => {
    mockedFindByEmail.mockResolvedValue(storedUser);

    const res = await request(app)
      .post('/auth/login')
      .set('x-gateway-secret', SECRET)
      .send({ email: 'janani@example.com', password: 'secret1' });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.user.token).toBe('string');
    expect(res.body.data.user.user.email).toBe('janani@example.com');
    expect(res.text).not.toContain('password_hash');
    expect(res.text).not.toContain('$2a$');
  });

  it('rejects an unknown email with 400', async () => {
    mockedFindByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post('/auth/login')
      .set('x-gateway-secret', SECRET)
      .send({ email: 'ghost@example.com', password: 'secret1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User not found');
  });

  it('rejects a wrong password with 400', async () => {
    mockedFindByEmail.mockResolvedValue(storedUser);

    const res = await request(app)
      .post('/auth/login')
      .set('x-gateway-secret', SECRET)
      .send({ email: 'janani@example.com', password: 'wrong1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid password');
  });

  it('rejects an invalid email shape with 400', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('x-gateway-secret', SECRET)
      .send({ email: 'nope', password: 'secret1' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid email address');
    expect(mockedFindByEmail).not.toHaveBeenCalled();
  });
});

describe('GET /auth/me', () => {
  it('returns the current user', async () => {
    mockedFindById.mockResolvedValue(storedUser);

    const res = await request(app)
      .get('/auth/me')
      .set('x-gateway-secret', SECRET)
      .set('x-user-id', 'user-1');

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: 'user-1',
      name: 'Janani',
      email: 'janani@example.com',
      role: 'user',
      created_at: storedUser.created_at.toISOString(),
    });
    expect(res.text).not.toContain('password_hash');
  });

  it('returns 401 when the gateway did not forward a user id', async () => {
    const res = await request(app)
      .get('/auth/me')
      .set('x-gateway-secret', SECRET);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing x-user-id header');
    expect(mockedFindById).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown user id', async () => {
    mockedFindById.mockResolvedValue(null);

    const res = await request(app)
      .get('/auth/me')
      .set('x-gateway-secret', SECRET)
      .set('x-user-id', 'missing');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found');
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

  it('hides unexpected database failures behind a generic 500', async () => {
    mockedFindByEmail.mockRejectedValue(new Error('password_hash column missing'));

    const res = await request(app)
      .post('/auth/login')
      .set('x-gateway-secret', SECRET)
      .send({ email: 'janani@example.com', password: 'secret1' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: 'Internal Server Error',
    });
    expect(res.text).not.toContain('password_hash');
    expect(res.text).not.toContain('column missing');
  });
});
