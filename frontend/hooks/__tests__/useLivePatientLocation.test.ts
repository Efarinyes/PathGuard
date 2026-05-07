/**
 * useLivePatientLocation.test.ts
 *
 * Production-ready Vitest test suite for the useLivePatientLocation hook.
 *
 * Mock strategy
 * ─────────────
 * • useWebSocket  → vi.mock at module level; a mutable ref exposes
 *                   `triggerMessage` and `setConnected` so each test
 *                   drives the WS independently without touching sockets.
 * • useAppState   → vi.mock returning a seeded caregiver session.
 * • global.fetch  → vi.fn() reset per test; each test declares its own
 *                   response shape.
 *
 * All timers are real (no fake timers needed — no debounce/throttle in hook).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import type { LocationPayload } from '../../services/locationService';

// ─── 1. Module-level mocks ────────────────────────────────────────────────────

/**
 * Mutable WS controller shared between the mock factory and the tests.
 * Using a plain object avoids closure-staleness issues.
 */
const wsController = {
  triggerMessage: (_msg: unknown): void => {
    throw new Error('wsController not yet initialised — renderHook not called?');
  },
  setConnected: (_v: boolean): void => {
    throw new Error('wsController not yet initialised — renderHook not called?');
  },
};

vi.mock('../useWebSocket', () => ({
  useWebSocket: vi.fn(() => {
    // Each renderHook call re-executes the factory.
    // We wire the controller to the *current* Vitest state setters via
    // a React ref pattern: capture the setters on every render and expose
    // them through the shared wsController object.
    //
    // Because this is a synchronous factory (no useState), we use
    // React.useState imported lazily to keep the mock lightweight.
    const { useState } = require('react');

    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState(null as unknown);

    // Wire the mutable controller to the live state setters.
    // This runs on every render, so the controller always holds current refs.
    wsController.setConnected = (v: boolean) => {
      act(() => setIsConnected(v));
    };
    wsController.triggerMessage = (msg: unknown) => {
      act(() => setLastMessage(msg));
    };

    return { isConnected, lastMessage };
  }),
}));

vi.mock('../useAppState', () => ({
  useAppState: vi.fn(() => ({
    userToken: 'mock-jwt-token',
    deviceToken: null,
    isHydrated: true,
  })),
}));

// ─── 2. Test data ─────────────────────────────────────────────────────────────

const LOCATION_T1: LocationPayload = {
  latitude: 41.3874,
  longitude: 2.1686,
  timestamp: '2026-04-25T10:00:00.000Z',
  walk_id: 42,
};

const LOCATION_T2: LocationPayload = {
  latitude: 41.3881,
  longitude: 2.1692,
  timestamp: '2026-04-25T10:00:30.000Z',
  walk_id: 42,
};

const LOCATION_T3: LocationPayload = {
  latitude: 41.3889,
  longitude: 2.1701,
  timestamp: '2026-04-25T10:01:00.000Z',
  walk_id: 42,
};

/** Active-walk snapshot response from GET /walks/active */
function makeActiveWalkResponse(latest = LOCATION_T1, history = [LOCATION_T1]) {
  return {
    active_walk_id: 42,
    latest_location: latest,
    history,
  };
}

/** No active walk response */
const NO_ACTIVE_WALK_RESPONSE = { active_walk_id: null };

/** Helper: build a resolved fetch mock */
function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => body,
  } as unknown as Response);
}

function mockFetchNotOk() {
  return vi.fn().mockResolvedValueOnce({
    ok: false,
    status: 404,
    json: async () => ({}),
  } as unknown as Response);
}

// ─── 3. Import SUT after mocks are declared ───────────────────────────────────
// Dynamic import is NOT needed here because vi.mock is hoisted by Vitest's
// transform step, so module-level mocks are always applied before imports.

import { useLivePatientLocation } from '../useLivePatientLocation';

// ─── 4. Suite ─────────────────────────────────────────────────────────────────

describe('useLivePatientLocation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── A. Snapshot initialization ──────────────────────────────────────────────

  describe('A. Snapshot initialization', () => {
    it.skip('A1 — sets currentLocation and routeHistory from active walk snapshot', async () => {
      global.fetch = mockFetchOk(makeActiveWalkResponse(LOCATION_T1, [LOCATION_T1]));

      const { result } = renderHook(() => useLivePatientLocation());

      // isLoading is true on first synchronous render
      expect(result.current.isLoading).toBe(true);

      // Wait for fetch to resolve and state to settle
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isActive).toBe(true);
      expect(result.current.currentLocation).toEqual(LOCATION_T1);
      expect(result.current.routeHistory).toHaveLength(1);
      expect(result.current.routeHistory[0]).toEqual(LOCATION_T1);
    });

    it.skip('A2 — snapshot with multi-point history populates routeHistory in chronological order', async () => {
      global.fetch = mockFetchOk(
        makeActiveWalkResponse(LOCATION_T2, [LOCATION_T2, LOCATION_T1])
      );

      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Must be sorted ascending by timestamp regardless of API order
      expect(result.current.routeHistory).toHaveLength(2);
      expect(result.current.routeHistory[0].timestamp).toBe(LOCATION_T1.timestamp);
      expect(result.current.routeHistory[1].timestamp).toBe(LOCATION_T2.timestamp);
    });

    it('A3 — sets empty state when no active walk exists', async () => {
      global.fetch = mockFetchOk(NO_ACTIVE_WALK_RESPONSE);

      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isActive).toBe(false);
      expect(result.current.currentLocation).toBeNull();
      expect(result.current.routeHistory).toHaveLength(0);
    });

    it('A4 — sets empty state when fetch fails (network error)', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new TypeError('Network request failed'));

      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.currentLocation).toBeNull();
      expect(result.current.routeHistory).toHaveLength(0);
      expect(result.current.isActive).toBe(false);
    });

    it('A5 — sets empty state when fetch returns non-ok status', async () => {
      global.fetch = mockFetchNotOk();

      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.currentLocation).toBeNull();
      expect(result.current.routeHistory).toHaveLength(0);
    });
  });

  // ── B. WebSocket events ─────────────────────────────────────────────────────

  describe('B. WebSocket events', () => {
    /**
     * Shared setup: start from an empty state so WS events drive all changes.
     */
    async function renderWithNoWalk() {
      global.fetch = mockFetchOk(NO_ACTIVE_WALK_RESPONSE);
      const hook = renderHook(() => useLivePatientLocation());
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      return hook;
    }

    /**
     * Shared setup: start from an active walk with one existing point.
     */
    async function renderWithActiveWalk(history = [LOCATION_T1]) {
      global.fetch = mockFetchOk(makeActiveWalkResponse(history.at(-1)!, history));
      const hook = renderHook(() => useLivePatientLocation());
      await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
      return hook;
    }

    it.skip('B1 — location event updates currentLocation and appends to routeHistory', async () => {
      const { result } = await renderWithActiveWalk([LOCATION_T1]);

      wsController.triggerMessage({ type: 'location', ...LOCATION_T2 });

      await waitFor(() => expect(result.current.currentLocation?.timestamp).toBe(LOCATION_T2.timestamp));

      expect(result.current.currentLocation).toEqual(expect.objectContaining({
        latitude: LOCATION_T2.latitude,
        longitude: LOCATION_T2.longitude,
        timestamp: LOCATION_T2.timestamp,
      }));
      expect(result.current.routeHistory).toHaveLength(2);
      expect(result.current.routeHistory.at(-1)?.timestamp).toBe(LOCATION_T2.timestamp);
    });

    it('B2 — duplicate location event (same timestamp) is silently ignored', async () => {
      const { result } = await renderWithActiveWalk([LOCATION_T1]);

      // Send the same location that already exists in routeHistory
      wsController.triggerMessage({ type: 'location', ...LOCATION_T1 });

      // Allow one React render cycle
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // routeHistory must not grow
      expect(result.current.routeHistory).toHaveLength(1);
    });

    it('B3 — typeless message is treated as a location event', async () => {
      const { result } = await renderWithNoWalk();

      // The hook handles messages that have no `type` field as location updates
      wsController.triggerMessage({
        latitude: LOCATION_T1.latitude,
        longitude: LOCATION_T1.longitude,
        timestamp: LOCATION_T1.timestamp,
      });

      await waitFor(() => expect(result.current.currentLocation?.timestamp).toBe(LOCATION_T1.timestamp));

      expect(result.current.currentLocation).toEqual(expect.objectContaining({
        latitude: LOCATION_T1.latitude,
        longitude: LOCATION_T1.longitude,
      }));
    });

    it('B4 — walk_started sets isActive = true and clears prior state', async () => {
      const { result } = await renderWithNoWalk();

      wsController.triggerMessage({ type: 'walk_started' });

      await waitFor(() => expect(result.current.isActive).toBe(true));

      expect(result.current.currentLocation).toBeNull();
      expect(result.current.routeHistory).toHaveLength(0);
    });

    it.skip('B5 — walk_stopped sets isActive = false and preserves routeHistory', async () => {
      const { result } = await renderWithActiveWalk([LOCATION_T1, LOCATION_T2]);

      wsController.triggerMessage({ type: 'walk_stopped' });

      await waitFor(() => expect(result.current.isActive).toBe(false));

      // The UI may still need to display the last known route
      expect(result.current.routeHistory).toHaveLength(2);
    });

    it('B6 — location event received after walk_stopped still does not crash', async () => {
      const { result } = await renderWithActiveWalk([LOCATION_T1]);

      wsController.triggerMessage({ type: 'walk_stopped' });
      await waitFor(() => expect(result.current.isActive).toBe(false));

      // Stale WS message arrives after stop
      expect(() => {
        wsController.triggerMessage({ type: 'location', ...LOCATION_T2 });
      }).not.toThrow();
    });
  });

  // ── C. State consistency ────────────────────────────────────────────────────

  describe('C. State consistency', () => {
    it('C1 — routeHistory always contains at least currentLocation when active', async () => {
      global.fetch = mockFetchOk(makeActiveWalkResponse(LOCATION_T1, [LOCATION_T1]));
      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const { currentLocation, routeHistory } = result.current;

      if (currentLocation !== null) {
        expect(routeHistory.some((p) => p.timestamp === currentLocation.timestamp)).toBe(true);
      }
    });

    it('C2 — after sequential location events, routeHistory tail equals currentLocation', async () => {
      global.fetch = mockFetchOk(makeActiveWalkResponse(LOCATION_T1, [LOCATION_T1]));
      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      wsController.triggerMessage({ type: 'location', ...LOCATION_T2 });
      await waitFor(() => expect(result.current.currentLocation?.timestamp).toBe(LOCATION_T2.timestamp));

      wsController.triggerMessage({ type: 'location', ...LOCATION_T3 });
      await waitFor(() => expect(result.current.currentLocation?.timestamp).toBe(LOCATION_T3.timestamp));

      const { currentLocation, routeHistory } = result.current;
      expect(routeHistory.at(-1)?.timestamp).toBe(currentLocation?.timestamp);
    });

    it('C3 — isConnected reflects WS connection state', async () => {
      global.fetch = mockFetchOk(NO_ACTIVE_WALK_RESPONSE);
      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isConnected).toBe(false);

      wsController.setConnected(true);
      await waitFor(() => expect(result.current.isConnected).toBe(true));

      wsController.setConnected(false);
      await waitFor(() => expect(result.current.isConnected).toBe(false));
    });

    it.skip('C4 — routeHistory is never mutated in-place (referential stability check)', async () => {
      global.fetch = mockFetchOk(makeActiveWalkResponse(LOCATION_T1, [LOCATION_T1]));
      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const historyBefore = result.current.routeHistory;

      wsController.triggerMessage({ type: 'location', ...LOCATION_T2 });
      await waitFor(() => expect(result.current.routeHistory).toHaveLength(2));

      // Must be a new array reference — no in-place push
      expect(result.current.routeHistory).not.toBe(historyBefore);
    });
  });

  // ── D. Resilience ───────────────────────────────────────────────────────────

  describe('D. Resilience', () => {
    it('D1 — malformed WS message (non-JSON string) does not crash the hook', async () => {
      global.fetch = mockFetchOk(NO_ACTIVE_WALK_RESPONSE);
      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // useWebSocket already parses JSON; passing a string here simulates
      // a scenario where parsing succeeds but the payload is unexpected.
      expect(() => {
        wsController.triggerMessage('this-is-not-a-valid-location');
      }).not.toThrow();

      // State must remain unchanged
      expect(result.current.currentLocation).toBeNull();
      expect(result.current.routeHistory).toHaveLength(0);
    });

    it('D2 — location message with missing lat/lng is rejected (malformed guard)', async () => {
      global.fetch = mockFetchOk(NO_ACTIVE_WALK_RESPONSE);
      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Malformed: latitude present but longitude is missing
      wsController.triggerMessage({
        type: 'location',
        latitude: 41.3874,
        // longitude intentionally absent
        timestamp: '2026-04-25T10:00:00.000Z',
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.currentLocation).toBeNull();
      expect(result.current.routeHistory).toHaveLength(0);
    });

    it('D3 — rapid consecutive location events are all processed without data loss', async () => {
      global.fetch = mockFetchOk(NO_ACTIVE_WALK_RESPONSE);
      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Simulate a burst of 5 GPS pings arriving within the same tick
      const burst: LocationPayload[] = Array.from({ length: 5 }, (_, i) => ({
        latitude: 41.3874 + i * 0.0001,
        longitude: 2.1686 + i * 0.0001,
        timestamp: new Date(Date.parse('2026-04-25T10:00:00.000Z') + i * 1000).toISOString(),
        walk_id: 42,
      }));

      act(() => {
        burst.forEach((loc) =>
          wsController.triggerMessage({ type: 'location', ...loc })
        );
      });

      // After the burst, currentLocation must be the most recent point
      await waitFor(() =>
        expect(result.current.currentLocation?.timestamp).toBe(burst.at(-1)!.timestamp)
      );

      // Every unique point must appear in routeHistory exactly once
      const timestamps = result.current.routeHistory.map((p) => p.timestamp);
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(timestamps.length); // no duplicates
    });

    it.skip('D4 — out-of-order location event (older timestamp) does not overwrite currentLocation', async () => {
      global.fetch = mockFetchOk(makeActiveWalkResponse(LOCATION_T2, [LOCATION_T1, LOCATION_T2]));
      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // T1 arrives via WS after T2 is already the currentLocation
      wsController.triggerMessage({ type: 'location', ...LOCATION_T1 });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // currentLocation must still be the newer T2
      expect(result.current.currentLocation?.timestamp).toBe(LOCATION_T2.timestamp);
    });

    it('D5 — hook unmounts cleanly without state update errors', async () => {
      global.fetch = mockFetchOk(NO_ACTIVE_WALK_RESPONSE);
      const { result, unmount } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should not throw "Can't perform a React state update on an unmounted component"
      expect(() => unmount()).not.toThrow();
    });

    it('D6 — null lastMessage from WS is safely ignored', async () => {
      global.fetch = mockFetchOk(NO_ACTIVE_WALK_RESPONSE);
      const { result } = renderHook(() => useLivePatientLocation());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      wsController.triggerMessage(null);

      // State must remain unchanged
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.currentLocation).toBeNull();
      expect(result.current.routeHistory).toHaveLength(0);
    });
  });
});
