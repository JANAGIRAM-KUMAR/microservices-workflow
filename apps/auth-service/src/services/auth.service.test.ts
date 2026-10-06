import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { AppError, verifyToken } from 'shared';
import * as authService from './auth.service';
import {
  createUser,
  findByEmail,
  findById,
} from '../repositories/user.repository';
import type { User } from '../types/auth.types';

vi.mock('../repositories/user.repository', () => ({
  createUser: vi.fn(),
  findByEmail: vi.fn(),
  findById: vi.fn(),
}));

const mockedFindByEmail = vi.mocked(findByEmail);
const mockedCreateUser = vi.mocked(createUser);
const mockedFindById = vi.mocked(findById);

const existingUser: User = {
  id: 'user-1',
  name: 'Janani',
  email: 'janani@example.com',
  password_hash: 'unused',
  role: 'user',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

const registration = {
  name: 'Janani',
  email: 'janani@example.com',
  password: 'secret1',
};

beforeEach(() => {
  mockedFindByEmail.mockResolvedValue(null);
  mockedFindById.mockResolvedValue(null);
  mockedCreateUser.mockResolvedValue(existingUser);
});

describe('authService.register', () => {
  it('creates a user with a hashed password', async () => {
    mockedCreateUser.mockImplementation(async (input) => ({
      ...existingUser,
      password_hash: input.passwordHash,
    }));

    const user = await authService.register(registration);

    expect(mockedCreateUser).toHaveBeenCalledTimes(1);
    const input = mockedCreateUser.mock.calls[0][0];
    expect(input.name).toBe('Janani');
    expect(input.email).toBe('janani@example.com');
    expect(input.passwordHash).not.toBe('secret1');
    expect(await bcrypt.compare('secret1', input.passwordHash)).toBe(true);
    expect(user).toEqual({
      id: 'user-1',
      name: 'Janani',
      email: 'janani@example.com',
      role: 'user',
      created_at: existingUser.created_at,
    });
  });

  it('returns a public user with no password hash', async () => {
    const user = (await authService.register(registration)) as Record<
      string,
      unknown
    >;

    expect(user).not.toHaveProperty('password_hash');
    expect(JSON.stringify(user)).not.toContain('$2a$');
  });

  it('rejects a duplicate email before touching the database', async () => {
    mockedFindByEmail.mockResolvedValue(existingUser);

    await expect(authService.register(registration)).rejects.toMatchObject({
      statusCode: 400,
      message: 'User already exists',
    });
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it('propagates a database failure from createUser', async () => {
    mockedCreateUser.mockRejectedValue(new Error('connection terminated'));

    await expect(authService.register(registration)).rejects.toThrow(
      'connection terminated'
    );
  });
});

describe('authService.login', () => {
  const validUser: User = {
    ...existingUser,
    password_hash: bcrypt.hashSync('secret1', 4),
  };

  it('returns a verifiable token and the public user', async () => {
    mockedFindByEmail.mockResolvedValue(validUser);

    const result = await authService.login({
      email: 'janani@example.com',
      password: 'secret1',
    });

    expect(result.user).toEqual({
      id: 'user-1',
      name: 'Janani',
      email: 'janani@example.com',
      role: 'user',
      created_at: existingUser.created_at,
    });
    expect(verifyToken(result.token)).toEqual({
      userId: 'user-1',
      role: 'user',
    });
  });

  it('never returns the password hash', async () => {
    mockedFindByEmail.mockResolvedValue(validUser);

    const result = await authService.login({
      email: 'janani@example.com',
      password: 'secret1',
    });

    expect(JSON.stringify(result)).not.toContain('$2a$');
  });

  it('rejects an unknown email', async () => {
    mockedFindByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'ghost@example.com', password: 'secret1' })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'User not found',
    });
  });

  it('rejects a wrong password', async () => {
    mockedFindByEmail.mockResolvedValue(validUser);

    await expect(
      authService.login({ email: 'janani@example.com', password: 'wrong1' })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid password',
    });
  });

  it('does not leak which field was wrong to the caller', async () => {
    mockedFindByEmail.mockResolvedValue(null);

    const unknownEmail = authService.login({
      email: 'ghost@example.com',
      password: 'secret1',
    });
    await expect(unknownEmail).rejects.toBeInstanceOf(AppError);
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });
});

describe('authService.getMe', () => {
  it('returns the public user when it exists', async () => {
    mockedFindById.mockResolvedValue(existingUser);

    const user = await authService.getMe('user-1');

    expect(mockedFindById).toHaveBeenCalledWith('user-1');
    expect(user).toEqual({
      id: 'user-1',
      name: 'Janani',
      email: 'janani@example.com',
      role: 'user',
      created_at: existingUser.created_at,
    });
  });

  it('throws 404 for an unknown user id', async () => {
    mockedFindById.mockResolvedValue(null);

    await expect(authService.getMe('missing')).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('never exposes the password hash', async () => {
    mockedFindById.mockResolvedValue(existingUser);

    const user = (await authService.getMe('user-1')) as Record<string, unknown>;

    expect(user).not.toHaveProperty('password_hash');
  });
});
