import { describe, expect, it } from 'vitest';
import { getAllowedRules, isPublicRoute, publicRoutes } from './rbac';

describe('isPublicRoute', () => {
  it('treats login as public', () => {
    expect(isPublicRoute('POST', '/auth/login')).toBe(true);
  });

  it('treats register as public', () => {
    expect(isPublicRoute('POST', '/auth/register')).toBe(true);
  });

  it('does not treat login as public for other methods', () => {
    expect(isPublicRoute('GET', '/auth/login')).toBe(false);
    expect(isPublicRoute('PUT', '/auth/login')).toBe(false);
  });

  it('keeps /auth/me private', () => {
    expect(isPublicRoute('GET', '/auth/me')).toBe(false);
  });

  it('keeps task routes private', () => {
    expect(isPublicRoute('GET', '/tasks')).toBe(false);
    expect(isPublicRoute('POST', '/tasks')).toBe(false);
  });

  it('does not match a path that merely starts with a public path', () => {
    expect(isPublicRoute('POST', '/auth/login/extra')).toBe(false);
    expect(isPublicRoute('POST', '/authlogins')).toBe(false);
  });

  it('never matches the root path', () => {
    expect(isPublicRoute('POST', '/')).toBe(false);
  });

  it('exposes exactly two public routes', () => {
    expect(publicRoutes).toHaveLength(2);
  });
});

describe('getAllowedRules', () => {
  it('allows both roles on /auth/me', () => {
    expect(getAllowedRules('GET', '/auth/me')).toEqual(['admin', 'user']);
  });

  it('allows both roles on collection routes', () => {
    expect(getAllowedRules('POST', '/tasks')).toEqual(['admin', 'user']);
    expect(getAllowedRules('GET', '/tasks')).toEqual(['admin', 'user']);
  });

  it('matches id path parameters', () => {
    expect(getAllowedRules('GET', '/tasks/abc')).toEqual(['admin', 'user']);
    expect(getAllowedRules('PUT', '/tasks/abc')).toEqual(['admin', 'user']);
    expect(getAllowedRules('DELETE', '/tasks/abc')).toEqual(['admin', 'user']);
  });

  it('matches nested parameter routes', () => {
    expect(getAllowedRules('GET', '/tasks/t1/attachments')).toEqual([
      'admin',
      'user',
    ]);
    expect(getAllowedRules('POST', '/tasks/t1/attachments')).toEqual([
      'admin',
      'user',
    ]);
    expect(getAllowedRules('GET', '/tasks/t1/workflows')).toEqual([
      'admin',
      'user',
    ]);
  });

  it('returns an empty list for methods with no rule', () => {
    expect(getAllowedRules('PATCH', '/tasks')).toEqual([]);
    expect(getAllowedRules('DELETE', '/tasks/t1/attachments')).toEqual([]);
    expect(getAllowedRules('PUT', '/tasks/t1/workflows')).toEqual([]);
  });

  it('returns an empty list for unknown paths', () => {
    expect(getAllowedRules('GET', '/nope')).toEqual([]);
    expect(getAllowedRules('GET', '/auth/login')).toEqual([]);
    expect(getAllowedRules('GET', '/tasks/a/attachments/b')).toEqual([]);
  });

  it('does not match a path segment that only resembles a rule', () => {
    expect(getAllowedRules('GET', '/tasksabc')).toEqual([]);
    expect(getAllowedRules('GET', '/auth/me/extra')).toEqual([]);
  });

  it('takes an exact literal match before comparing segments', () => {
    expect(getAllowedRules('GET', '/tasks/:id')).toEqual(['admin', 'user']);
  });
});
