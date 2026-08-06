import { describe, expect, it } from 'vitest';
import { resolveMarkerConfidence } from './CurrentPositionMarker';
import type { LocationPayload } from '@/services/locationService';

function point(
  overrides: Partial<LocationPayload> & { timestamp: string }
): LocationPayload {
  return {
    latitude: 41.5,
    longitude: 2.4,
    is_recovered: false,
    ...overrides,
  };
}

describe('SPEC-189 resolveMarkerConfidence', () => {
  const now = Date.parse('2026-08-06T16:00:00.000Z');

  it('returns live for fresh point while patient connected', () => {
    const locations = [point({ timestamp: new Date(now - 10_000).toISOString() })];
    expect(resolveMarkerConfidence(locations, 0, false, now)).toBe('live');
  });

  it('returns last_known when patient is offline/silent', () => {
    const locations = [point({ timestamp: new Date(now - 10_000).toISOString() })];
    expect(resolveMarkerConfidence(locations, 0, true, now)).toBe('last_known');
  });

  it('returns last_known when point is older than 60s even if connected', () => {
    const locations = [point({ timestamp: new Date(now - 90_000).toISOString() })];
    expect(resolveMarkerConfidence(locations, 0, false, now)).toBe('last_known');
  });

  it('prefers last_known over recovered during silence', () => {
    const locations = [
      point({
        timestamp: new Date(now - 5_000).toISOString(),
        is_recovered: true,
      }),
    ];
    expect(resolveMarkerConfidence(locations, 0, true, now)).toBe('last_known');
  });

  it('returns recovered for fresh recovered point while connected', () => {
    const locations = [
      point({
        timestamp: new Date(now - 5_000).toISOString(),
        is_recovered: true,
      }),
    ];
    expect(resolveMarkerConfidence(locations, 0, false, now)).toBe('recovered');
  });
});
