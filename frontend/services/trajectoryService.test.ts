import { describe, it, expect } from 'vitest';
import { trajectoryService } from './trajectoryService';

describe('trajectoryService - Cleanup and Smoothing', () => {
  
  it('Scenario 1: Duplicate and Jitter Cleanup', () => {
    const rawPoints = [
      { latitude: 41.0, longitude: 2.0, timestamp: '2026-04-26T10:00:00Z' },
      { latitude: 41.0, longitude: 2.0, timestamp: '2026-04-26T10:00:05Z' }, // Exact Duplicate
      { latitude: 41.00001, longitude: 2.00001, timestamp: '2026-04-26T10:00:10Z' }, // Jitter (< 3m)
      { latitude: 41.0005, longitude: 2.0005, timestamp: '2026-04-26T10:00:15Z' }, // Real move
    ];

    const cleaned = trajectoryService.cleanTrajectory(rawPoints);

    // Expect: First point + Real move (2 points)
    expect(cleaned.length).toBe(2);
    expect(cleaned[0].timestamp).toBe('2026-04-26T10:00:00Z');
    expect(cleaned[1].latitude).toBe(41.0005);
  });

  it('Scenario 2: Moving Average Smoothing', () => {
    const points = [
      { latitude: 0, longitude: 0, timestamp: 't1' },
      { latitude: 10, longitude: 10, timestamp: 't2' }, // Spike
      { latitude: 0, longitude: 0, timestamp: 't3' },
    ];

    const smoothed = trajectoryService.smoothTrajectory(points);

    // Mid point should be averaged: (0+10+0)/3 = 3.33
    expect(smoothed[1].latitude).toBeCloseTo(3.33, 1);
    // Endpoints remain unchanged
    expect(smoothed[0].latitude).toBe(0);
    expect(smoothed[2].latitude).toBe(0);
  });

  it('Scenario 3: Integrity Validation', () => {
    const badPoints = [
      { latitude: 10, longitude: 10, timestamp: '2026-04-26T10:10:00Z' },
      { latitude: 10, longitude: 10, timestamp: '2026-04-26T10:00:00Z' }, // Back in time
    ];

    const report = trajectoryService.validateIntegrity(badPoints);
    expect(report.valid).toBe(false);
    expect(report.errors[0]).toContain('Temporal regression');
  });

  it('Scenario 4: Raw Preservation - Input array is never mutated', () => {
    const raw = [
      { latitude: 41.0, longitude: 2.0, timestamp: '2026-04-26T10:00:00Z' },
      { latitude: 41.0, longitude: 2.0, timestamp: '2026-04-26T10:00:05Z' }
    ];
    const rawCopy = JSON.parse(JSON.stringify(raw));

    trajectoryService.cleanTrajectory(raw);
    trajectoryService.smoothTrajectory(raw);

    expect(raw).toEqual(rawCopy);
  });
});
