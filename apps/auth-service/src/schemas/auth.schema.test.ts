import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.schema';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const result = registerSchema.safeParse({
      name: 'Janani',
      email: 'janani@example.com',
      password: 'secret1',
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      name: 'Janani',
      email: 'janani@example.com',
      password: 'secret1',
    });
  });

  it('rejects a name shorter than 3 characters', () => {
    const result = registerSchema.safeParse({
      name: 'Jo',
      email: 'janani@example.com',
      password: 'secret1',
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      'Name must be at least 3 characters long'
    );
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({
      name: 'Janani',
      email: 'not-an-email',
      password: 'secret1',
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Invalid email address');
  });

  it('rejects a password shorter than 6 characters', () => {
    const result = registerSchema.safeParse({
      name: 'Janani',
      email: 'janani@example.com',
      password: 'abc',
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      'Password must be at least 6 characters long'
    );
  });

  it('rejects missing fields', () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
    expect(
      registerSchema.safeParse({ name: 'Janani', email: 'a@b.com' }).success
    ).toBe(false);
  });

  it('strips unknown fields', () => {
    const result = registerSchema.safeParse({
      name: 'Janani',
      email: 'janani@example.com',
      password: 'secret1',
      role: 'admin',
      id: 'injected',
    });

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('role');
    expect(result.data).not.toHaveProperty('id');
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    const result = loginSchema.safeParse({
      email: 'janani@example.com',
      password: 'secret1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'nope',
      password: 'secret1',
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe('Invalid email address');
  });

  it('rejects a short password', () => {
    const result = loginSchema.safeParse({
      email: 'janani@example.com',
      password: '12345',
    });

    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(
      'Password must be at least 6 characters long'
    );
  });

  it('does not require a name', () => {
    expect(
      loginSchema.safeParse({
        email: 'janani@example.com',
        password: 'secret1',
        name: 'ignored',
      }).success
    ).toBe(true);
  });
});
