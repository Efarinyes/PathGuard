import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocationTracking } from './useLocationTracking';

describe('useLocationTracking - Haversine Filtering & Adaptive Sampling', () => {
  let watchPositionMock: any;

  beforeEach(() => {
    vi.useFakeTimers();
    watchPositionMock = vi.fn();
    
    // Mock navigator.geolocation
    (global.navigator as any).geolocation = {
      watchPosition: watchPositionMock,
      clearWatch: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('Scenario 1: Distance Filtering - Suppresses updates for small movements (< 8m)', async () => {
    const { result } = renderHook(() => useLocationTracking());

    let successCallback: any;
    watchPositionMock.mockImplementation((success: any) => {
      successCallback = success;
    });

    act(() => {
      result.current.startTracking();
    });

    // 1. Initial point
    act(() => {
      successCallback({ coords: { latitude: 41.0, longitude: 2.0 } });
    });
    expect(result.current.currentPosition).toEqual({ latitude: 41.0, longitude: 2.0 });

    // 2. Small movement (approx 4 meters)
    act(() => {
      successCallback({ coords: { latitude: 41.00003, longitude: 2.00003 } });
      vi.advanceTimersByTime(5000); // Trigger next sample check
    });

    // Should still show initial position (filtered)
    expect(result.current.currentPosition).toEqual({ latitude: 41.0, longitude: 2.0 });

    // 3. Large movement (approx 33 meters — above GPS_MIN_DISTANCE_M)
    act(() => {
      successCallback({ coords: { latitude: 41.0003, longitude: 2.0003 } });
      vi.advanceTimersByTime(30000); // Must exceed GPS_INTERVAL_NORMAL_MS (30s)
    });

    expect(result.current.currentPosition).toEqual({ latitude: 41.0003, longitude: 2.0003 });
  });

  it('Scenario 2: Adaptive Sampling - Slows down when idle', async () => {
    const { result } = renderHook(() => useLocationTracking());

    let successCallback: any;
    watchPositionMock.mockImplementation((success: any) => {
      successCallback = success;
    });

    act(() => {
      result.current.startTracking();
      successCallback({ coords: { latitude: 41.0, longitude: 2.0 } });
    });

    // Move slightly (idle threshold)
    act(() => {
      successCallback({ coords: { latitude: 41.00001, longitude: 2.00001 } });
      vi.advanceTimersByTime(5000); // First check
    });

    // Should now be in IDLE mode (15s interval)
    // We expect the next check to happen after 15s
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Still hasn't processed because it's idle
    
    act(() => {
      vi.advanceTimersByTime(11000);
    });
    // Now it should have processed (total > 15s)
  });
});
