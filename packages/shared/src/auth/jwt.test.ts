import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { signToken, verifyToken } from './jwt';

const ORIGINAL = {
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
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

beforeEach(() => {
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '1d';
});

afterEach(restoreEnv);

describe('signToken', () => {
  it('produces a token that verifyToken accepts', () => {
    const token = signToken({ userId: 'user-1', role: 'user' });

    expect(typeof token).toBe('string');
    expect(verifyToken(token)).toEqual({ userId: 'user-1', role: 'user' });
  });

  it('round-trips an admin role', () => {
    const token = signToken({ userId: 'admin-1', role: 'admin' });

    expect(verifyToken(token)).toEqual({ userId: 'admin-1', role: 'admin' });
  });

  it('embeds the subject and issue/expiry times', () => {
    const token = signToken({ userId: 'user-1', role: 'user' });
    const decoded = jwt.decode(token) as jwt.JwtPayload;

    expect(decoded.userId).toBe('user-1');
    expect(decoded.role).toBe('user');
    expect(typeof decoded.iat).toBe('number');
    expect(typeof decoded.exp).toBe('number');
  });

  it('honours JWT_EXPIRES_IN', () => {
    process.env.JWT_EXPIRES_IN = '2h';

    const token = signToken({ userId: 'user-1', role: 'user' });
    const decoded = jwt.decode(token) as jwt.JwtPayload;

    expect(decoded.exp! - decoded.iat!).toBe(7200);
  });

  it('defaults to a 1 day expiry', () => {
    delete process.env.JWT_EXPIRES_IN;

    const token = signToken({ userId: 'user-1', role: 'user' });
    const decoded = jwt.decode(token) as jwt.JwtPayload;

    expect(decoded.exp! - decoded.iat!).toBe(86400);
  });

  it('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;

    expect(() => signToken({ userId: 'user-1', role: 'user' })).toThrow(
      'JWT_SECRET is not set'
    );
  });
});

describe('verifyToken', () => {
  it('throws when JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    const token = 'header.payload.signature';

    expect(() => verifyToken(token)).toThrow('JWT_SECRET is not set');
  });

  it('rejects a malformed token', () => {
    expect(() => verifyToken('not-a-jwt')).toThrow();
  });

  it('rejects an empty token', () => {
    expect(() => verifyToken('')).toThrow();
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign(
      { userId: 'user-1', role: 'user' },
      'some-other-secret'
    );

    expect(() => verifyToken(forged)).toThrow();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(
      { userId: 'user-1', role: 'user' },
      'test-jwt-secret',
      { expiresIn: '-10s' }
    );

    expect(() => verifyToken(expired)).toThrow();
  });

  it('rejects a payload whose role is not user or admin', () => {
    const token = jwt.sign(
      { userId: 'user-1', role: 'superuser' },
      'test-jwt-secret'
    );

    expect(() => verifyToken(token)).toThrow('Invalid token payload');
  });

  it('rejects a payload whose userId is not a string', () => {
    const token = jwt.sign(
      { userId: 42, role: 'user' },
      'test-jwt-secret'
    );

    expect(() => verifyToken(token)).toThrow('Invalid token payload');
  });

  it('rejects a payload with no userId', () => {
    const token = jwt.sign({ role: 'user' }, 'test-jwt-secret');

    expect(() => verifyToken(token)).toThrow('Invalid token payload');
  });

  it('rejects a non-object payload', () => {
    const token = jwt.sign('just a string', 'test-jwt-secret');

    expect(() => verifyToken(token)).toThrow('Invalid token payload');
  });
});
