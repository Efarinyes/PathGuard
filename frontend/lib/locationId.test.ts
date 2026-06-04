import { describe, it, expect } from 'vitest';
import { generateLocationId } from './locationId';

describe('generateLocationId', () => {
  it('T1.3c: produces deterministic output for same input', async () => {
    const id1 = await generateLocationId(1700000000000, 41.123456, 2.123456, 1);
    const id2 = await generateLocationId(1700000000000, 41.123456, 2.123456, 1);
    expect(id1).toBe(id2);
  });

  it('T1.3c: produces different output for different timestamp', async () => {
    const id1 = await generateLocationId(1700000000000, 41.0, 2.0, 1);
    const id2 = await generateLocationId(1700000001000, 41.0, 2.0, 1);
    expect(id1).not.toBe(id2);
  });

  it('T1.3c: produces different output for different walkId', async () => {
    const id1 = await generateLocationId(1700000000000, 41.0, 2.0, 1);
    const id2 = await generateLocationId(1700000000000, 41.0, 2.0, 2);
    expect(id1).not.toBe(id2);
  });

  it('T1.3c: produces 64-char hex string (SHA-256)', async () => {
    const id = await generateLocationId(1700000000000, 41.0, 2.0, 1);
    expect(id).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(id)).toBe(true);
  });

  it('T1.3c: respects 6 decimal precision for lat/lng', async () => {
    const id1 = await generateLocationId(1700000000000, 41.1234567, 2.1234567, 1);
    const id2 = await generateLocationId(1700000000000, 41.1234561, 2.1234561, 1);
    expect(id1).not.toBe(id2);
  });
});
