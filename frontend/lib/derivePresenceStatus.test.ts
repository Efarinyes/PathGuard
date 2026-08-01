import { describe, expect, it } from 'vitest';
import {
  derivePresenceStatus,
  GPS_ONLINE_MAX_AGE_SECONDS,
  LIMBO_MAX_AGE_SECONDS,
} from './derivePresenceStatus';

describe('derivePresenceStatus', () => {
  const now = Date.parse('2026-08-01T16:00:00.000Z');

  it('keeps online when WS presence is online', () => {
    const stale = new Date(now - 600_000).toISOString();
    expect(derivePresenceStatus('online', stale, now)).toBe('online');
  });

  it('returns gps_online for fresh location without WS', () => {
    const ts = new Date(now - 30_000).toISOString();
    expect(derivePresenceStatus('limbo', ts, now)).toBe('gps_online');
    expect(derivePresenceStatus('offline', ts, now)).toBe('gps_online');
  });

  it('returns limbo between 60s and 300s', () => {
    const ts = new Date(now - 120_000).toISOString();
    expect(derivePresenceStatus('gps_online', ts, now)).toBe('limbo');
  });

  it('returns offline after limbo window (e.g. 7 minutes)', () => {
    const ts = new Date(now - 7 * 60_000).toISOString();
    expect(derivePresenceStatus('limbo', ts, now)).toBe('offline');
  });

  it('returns offline when no location timestamp', () => {
    expect(derivePresenceStatus('limbo', null, now)).toBe('offline');
    expect(derivePresenceStatus('gps_online', undefined, now)).toBe('offline');
  });

  it('uses the same thresholds as backend constants', () => {
    expect(GPS_ONLINE_MAX_AGE_SECONDS).toBe(60);
    expect(LIMBO_MAX_AGE_SECONDS).toBe(300);
  });
});
