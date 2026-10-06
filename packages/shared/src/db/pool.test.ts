import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from './pool';

const ORIGINAL_URL = process.env.DATABASE_URL;

function restoreUrl() {
  if (ORIGINAL_URL === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = ORIGINAL_URL;
  }
}

beforeEach(() => {
  process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/test_db';
});

afterEach(async () => {
  await closePool();
  restoreUrl();
});

describe('getPool', () => {
  it('throws when DATABASE_URL is not set', () => {
    delete process.env.DATABASE_URL;

    expect(() => getPool()).toThrow('DATABASE_URL is not set');
  });

  it('returns a pool for a configured connection string', () => {
    const pool = getPool();

    expect(pool).toBeDefined();
    expect(typeof pool.query).toBe('function');
  });

  it('returns the same instance on repeated calls', () => {
    const first = getPool();
    const second = getPool();

    expect(second).toBe(first);
  });

  it('recreates the pool after closePool', async () => {
    const before = getPool();

    await closePool();

    const after = getPool();
    expect(after).not.toBe(before);
  });
});

describe('closePool', () => {
  it('resolves when there is no pool to close', async () => {
    await expect(closePool()).resolves.toBeUndefined();
  });

  it('resolves when called twice in a row', async () => {
    getPool();

    await expect(closePool()).resolves.toBeUndefined();
    await expect(closePool()).resolves.toBeUndefined();
  });

  it('forces the next getPool to build a fresh pool', async () => {
    getPool();
    await closePool();

    const fresh = getPool();
    expect(fresh).toBeDefined();
  });
});
