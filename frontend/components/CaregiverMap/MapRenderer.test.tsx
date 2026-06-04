import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        mergeOptions: vi.fn(),
      },
    },
    divIcon: vi.fn(() => ({})),
  },
}));

vi.mock('react-leaflet', () => ({
  MapContainer: 'div',
  TileLayer: 'div',
  Polyline: 'div',
  Marker: 'div',
}));

import { segmentLocations, perpendicularDistance, douglasPeucker } from './MapRenderer';

describe('perpendicularDistance', () => {
  it('should return 0 when point is on the line', () => {
    const result = perpendicularDistance([1, 1], [0, 0], [2, 2]);
    expect(result).toBeCloseTo(0, 10);
  });

  it('should return correct distance for point off the line', () => {
    const result = perpendicularDistance([1, 0], [0, 0], [2, 0]);
    expect(result).toBeCloseTo(0, 10);
  });

  it('should handle degenerate line (start === end)', () => {
    const result = perpendicularDistance([1, 1], [0, 0], [0, 0]);
    expect(result).toBeCloseTo(Math.SQRT2, 5);
  });
});

describe('douglasPeucker', () => {
  it('T1.5a: should return same points for 2 or fewer points', () => {
    const emptyResult = douglasPeucker([], 1);
    expect(emptyResult).toEqual([]);

    const singleResult = douglasPeucker([[0, 0]], 1);
    expect(singleResult).toEqual([[0, 0]]);

    const twoResult = douglasPeucker([[0, 0], [1, 1]], 1);
    expect(twoResult).toEqual([[0, 0], [1, 1]]);
  });

  it('T1.5b: should remove middle point when 3 collinear', () => {
    const result = douglasPeucker([[0, 0], [1, 1], [2, 2]], 0.5);
    expect(result).toEqual([[0, 0], [2, 2]]);
  });

  it('T1.5c: should keep middle point when it deviates beyond epsilon', () => {
    const result = douglasPeucker([[0, 0], [1, 0], [0, 1]], 0.5);
    expect(result).toEqual([[0, 0], [1, 0], [0, 1]]);
  });

  it('T1.5d: epsilon=0 with non-collinear keeps all points', () => {
    const result = douglasPeucker([[0, 0], [0, 1], [1, 0], [1, 1]], 0);
    expect(result).toHaveLength(4);
  });
});

describe('segmentLocations with Douglas-Peucker', () => {
  it('T1.5e: should simplify non-recovered segments when epsilon provided', () => {
    const locations = [
      { latitude: 0, longitude: 0, timestamp: '2026-01-01T00:00:00Z' },
      { latitude: 1, longitude: 1, timestamp: '2026-01-01T00:00:01Z' },
      { latitude: 2, longitude: 2, timestamp: '2026-01-01T00:00:02Z' },
      { latitude: 3, longitude: 3, timestamp: '2026-01-01T00:00:03Z' },
    ];

    const noEpsilon = segmentLocations(locations);
    const withEpsilon = segmentLocations(locations, 1);

    expect(noEpsilon).toHaveLength(1);
    expect(noEpsilon[0].coordinates).toHaveLength(4);

    expect(withEpsilon).toHaveLength(1);
    expect(withEpsilon[0].coordinates.length).toBeLessThan(4);
    expect(withEpsilon[0].coordinates[0]).toEqual([0, 0]);
    expect(withEpsilon[0].coordinates[withEpsilon[0].coordinates.length - 1]).toEqual([3, 3]);
  });

  it('T1.5f: should not simplify recovered segments even with epsilon', () => {
    const locations = [
      { latitude: 0, longitude: 0, timestamp: '2026-01-01T00:00:00Z', is_recovered: true },
      { latitude: 1, longitude: 1, timestamp: '2026-01-01T00:00:01Z', is_recovered: true },
      { latitude: 2, longitude: 2, timestamp: '2026-01-01T00:00:02Z', is_recovered: true },
    ];

    const result = segmentLocations(locations, 1);

    expect(result).toHaveLength(1);
    expect(result[0].isRecovered).toBe(true);
    expect(result[0].coordinates).toHaveLength(3);
  });

  it('T1.5g: should filter out NaN coordinates before processing', () => {
    const locations = [
      { latitude: 0, longitude: 0, timestamp: '2026-01-01T00:00:00Z' },
      { latitude: NaN, longitude: 1, timestamp: '2026-01-01T00:00:01Z' },
      { latitude: 2, longitude: NaN, timestamp: '2026-01-01T00:00:02Z' },
      { latitude: 3, longitude: 3, timestamp: '2026-01-01T00:00:03Z' },
    ];

    const result = segmentLocations(locations);

    expect(result).toHaveLength(1);
    expect(result[0].coordinates).toHaveLength(2);
  });
});

describe('Map Location Segmentation', () => {
  it('should return empty array for empty locations', () => {
    const result = segmentLocations([]);
    expect(result).toEqual([]);
  });

  it('should group all real-time locations together', () => {
    const locations = [
      { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-01-01T00:00:00Z' },
      { latitude: 41.3852, longitude: 2.1735, timestamp: '2026-01-01T00:00:01Z' },
      { latitude: 41.3853, longitude: 2.1736, timestamp: '2026-01-01T00:00:02Z' },
    ];

    const result = segmentLocations(locations);

    expect(result).toHaveLength(1);
    expect(result[0].isRecovered).toBe(false);
    expect(result[0].coordinates).toHaveLength(3);
  });

  it('should group all recovered locations together', () => {
    const locations = [
      { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-01-01T00:00:00Z', is_recovered: true },
      { latitude: 41.3852, longitude: 2.1735, timestamp: '2026-01-01T00:00:01Z', is_recovered: true },
      { latitude: 41.3853, longitude: 2.1736, timestamp: '2026-01-01T00:00:02Z', is_recovered: true },
    ];

    const result = segmentLocations(locations);

    expect(result).toHaveLength(1);
    expect(result[0].isRecovered).toBe(true);
    expect(result[0].coordinates).toHaveLength(3);
  });

  it('should separate real-time from recovered locations', () => {
    const locations = [
      { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-01-01T00:00:00Z' },
      { latitude: 41.3852, longitude: 2.1735, timestamp: '2026-01-01T00:00:01Z', is_recovered: true },
      { latitude: 41.3853, longitude: 2.1736, timestamp: '2026-01-01T00:00:02Z', is_recovered: true },
      { latitude: 41.3854, longitude: 2.1737, timestamp: '2026-01-01T00:00:03Z' },
    ];

    const result = segmentLocations(locations);

    expect(result).toHaveLength(3);
    expect(result[0].isRecovered).toBe(false);
    expect(result[0].coordinates).toHaveLength(1);
    expect(result[1].isRecovered).toBe(true);
    expect(result[1].coordinates).toHaveLength(2);
    expect(result[2].isRecovered).toBe(false);
    expect(result[2].coordinates).toHaveLength(1);
  });

  it('should handle mixed alternating locations', () => {
    const locations = [
      { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-01-01T00:00:00Z' },
      { latitude: 41.3852, longitude: 2.1735, timestamp: '2026-01-01T00:00:01Z', is_recovered: true },
      { latitude: 41.3853, longitude: 2.1736, timestamp: '2026-01-01T00:00:02Z' },
      { latitude: 41.3854, longitude: 2.1737, timestamp: '2026-01-01T00:00:03Z', is_recovered: true },
    ];

    const result = segmentLocations(locations);

    expect(result).toHaveLength(4);
    expect(result[0].isRecovered).toBe(false);
    expect(result[1].isRecovered).toBe(true);
    expect(result[2].isRecovered).toBe(false);
    expect(result[3].isRecovered).toBe(true);
  });

  it('should treat undefined is_recovered as false', () => {
    const locations = [
      { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-01-01T00:00:00Z', is_recovered: undefined },
      { latitude: 41.3852, longitude: 2.1735, timestamp: '2026-01-01T00:00:01Z' },
    ];

    const result = segmentLocations(locations);

    expect(result).toHaveLength(1);
    expect(result[0].isRecovered).toBe(false);
  });

  it('should handle single location', () => {
    const locations = [
      { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-01-01T00:00:00Z' },
    ];

    const result = segmentLocations(locations);

    expect(result).toHaveLength(1);
    expect(result[0].coordinates).toHaveLength(1);
  });
});
