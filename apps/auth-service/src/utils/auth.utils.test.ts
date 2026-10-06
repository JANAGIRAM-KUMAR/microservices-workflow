import { describe, expect, it } from 'vitest';
import { convertToPublicUser } from './auth.utils';
import type { User } from '../types/auth.types';

const user: User = {
  id: 'user-1',
  name: 'Janani',
  email: 'janani@example.com',
  password_hash: '$2a$10$supersecrethash',
  role: 'user',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('convertToPublicUser', () => {
  it('maps the user fields onto the public shape', () => {
    expect(convertToPublicUser(user)).toEqual({
      id: 'user-1',
      name: 'Janani',
      email: 'janani@example.com',
      role: 'user',
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('never exposes the password hash', () => {
    const publicUser = convertToPublicUser(user) as Record<string, unknown>;

    expect(publicUser).not.toHaveProperty('password_hash');
    expect(JSON.stringify(publicUser)).not.toContain('$2a$10$');
  });

  it('returns exactly the whitelisted keys', () => {
    expect(Object.keys(convertToPublicUser(user)).sort()).toEqual([
      'created_at',
      'email',
      'id',
      'name',
      'role',
    ]);
  });

  it('preserves the admin role', () => {
    expect(convertToPublicUser({ ...user, role: 'admin' }).role).toBe('admin');
  });
});
