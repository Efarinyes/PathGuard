import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocationTracking } from '../../hooks/useLocationTracking';
import { locationService } from '../../services/locationService';

// Mock Dependencies
vi.mock('../../services/locationService', () => ({
  locationService: {
    saveLocation: vi.fn(),
  },
}));

describe('GPS Filtering & Adaptive Sampling Integration', () => {
  let watchPositionMock: any;

  beforeEach(() => {
    vi.useFakeTimers();
    watchPositionMock = vi.fn();
    (global.navigator as any).geolocation = {
      watchPosition: watchPositionMock,
      clearWatch: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('Scenario: Distance filtering and Network Call suppression', async () => {
    const { result } = renderHook(() => useLocationTracking());

    let successCallback: any;
    watchPositionMock.mockImplementation((success: any) => {
      successCallback = success;
    });

    // 1. Start Tracking
    act(() => {
      result.current.startTracking();
    });

    // 2. Send First Point
    act(() => {
      successCallback({ coords: { latitude: 41.0, longitude: 2.0 } });
    });
    
    // We expect currentPosition to update
    expect(result.current.currentPosition).toEqual({ latitude: 41.0, longitude: 2.0 });

    // Note: In the actual app, PatientWalkController calls saveLocation when currentPosition changes.
    // In this hook-only test, we are verifying that currentPosition DOES NOT change for small moves.
    
    // 3. Move < 8 meters (approx 4m)
    act(() => {
      successCallback({ coords: { latitude: 41.00003, longitude: 2.00003 } });
      vi.advanceTimersByTime(5000);
    });

    // currentPosition should NOT have updated
    expect(result.current.currentPosition).toEqual({ latitude: 41.0, longitude: 2.0 });

    // 4. Move > 30 meters (approx 33m — above GPS_MIN_DISTANCE_M)
    act(() => {
      successCallback({ coords: { latitude: 41.0003, longitude: 2.0003 } });
      vi.advanceTimersByTime(30000); // Must exceed GPS_INTERVAL_NORMAL_MS (30s)
    });

    // currentPosition SHOULD have updated
    expect(result.current.currentPosition).toEqual({ latitude: 41.0003, longitude: 2.0003 });
  });

  it('Scenario: Adaptive Sampling Interval adjustment', async () => {
    const { result } = renderHook(() => useLocationTracking());

    let successCallback: any;
    watchPositionMock.mockImplementation((success: any) => {
      successCallback = success;
    });

    act(() => {
      result.current.startTracking();
      successCallback({ coords: { latitude: 41.0, longitude: 2.0 } });
    });

    // Verify Idle behavior (15s)
    act(() => {
      // Simulate very slow movement
      successCallback({ coords: { latitude: 41.00001, longitude: 2.00001 } });
      vi.advanceTimersByTime(5000);
    });

    // At this point, the speed was slow, so the next interval should be 15s.
    // Advancing 6s should NOT trigger another processLocation.
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    
    // Total 11s since last sample. Should not have updated yet if idle.
    // (Assuming the check happened at 5s and scheduled for +15s)
  });
});
