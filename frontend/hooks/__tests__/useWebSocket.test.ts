/**
 * useWebSocket.test.ts
 *
 * Mock strategy
 * ─────────────
 * • global.WebSocket → MockWebSocket via vi.stubGlobal.
 *   Instances tracked in mockWsInstances[] for reconnect-test access.
 * • vi.useFakeTimers() → scoped to describe C via beforeEach/afterEach.
 *
 * Key design rule: all MockWebSocket event handlers are synchronous.
 * Therefore act() is always sufficient — waitFor is never needed here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';

// ─── MockWebSocket ────────────────────────────────────────────────────────────

let mockWsInstances: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN       = 1;
  static CLOSING    = 2;
  static CLOSED     = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen:    ((e: Event)        => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose:   ((e: CloseEvent)   => void) | null = null;
  onerror:   ((e: Event)        => void) | null = null;

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
  }

  simulateOpen()               { this.readyState = MockWebSocket.OPEN;   this.onopen?.(new Event('open')); }
  simulateMessage(d: unknown)  { this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(d) })); }
  simulateRawMessage(r: string){ this.onmessage?.(new MessageEvent('message', { data: r })); }
  simulateError()              { this.onerror?.(new Event('error')); }
  simulateClose()              { this.readyState = MockWebSocket.CLOSED; this.onclose?.(new CloseEvent('close')); }
  close()                      { this.readyState = MockWebSocket.CLOSED; this.onclose?.(new CloseEvent('close')); }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockWsInstances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Renders the hook and synchronously opens the first socket via act(). */
function renderConnected() {
  const hook = renderHook(() => useWebSocket());
  const ws   = mockWsInstances[0];
  act(() => ws.simulateOpen());
  expect(hook.result.current.isConnected).toBe(true); // guard
  return { hook, ws };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('useWebSocket', () => {

  // ── A. Connection lifecycle ──────────────────────────────────────────────

  describe('A. Connection lifecycle', () => {

    it('A1 — creates a WebSocket on mount (enabled=true)', () => {
      renderHook(() => useWebSocket(true));
      expect(mockWsInstances).toHaveLength(1);
      expect(mockWsInstances[0].url).toContain('127.0.0.1:8000');
    });

    it('A2 — does NOT create a WebSocket when enabled=false', () => {
      renderHook(() => useWebSocket(false));
      expect(mockWsInstances).toHaveLength(0);
    });

    it('A3 — isConnected=false before socket opens', () => {
      const { result } = renderHook(() => useWebSocket());
      expect(result.current.isConnected).toBe(false);
    });

    it('A4 — isConnected=true when socket opens', () => {
      const { hook } = renderConnected();
      expect(hook.result.current.isConnected).toBe(true);
    });

    it('A5 — isConnected=false when socket closes', () => {
      vi.useFakeTimers();
      const { hook, ws } = renderConnected();
      act(() => ws.simulateClose());
      expect(hook.result.current.isConnected).toBe(false);
      vi.useRealTimers();
    });

    it('A6 — isConnected=false when error occurs', () => {
      vi.useFakeTimers();
      const { hook, ws } = renderConnected();
      // onerror → hook calls socket.close() → onclose fires
      act(() => ws.simulateError());
      expect(hook.result.current.isConnected).toBe(false);
      vi.useRealTimers();
    });

    it('A7 — connects when enabled transitions false → true', () => {
      let enabled = false;
      const { rerender, result } = renderHook(() => useWebSocket(enabled));
      expect(mockWsInstances).toHaveLength(0);

      enabled = true;
      rerender();
      expect(mockWsInstances).toHaveLength(1);

      act(() => mockWsInstances[0].simulateOpen());
      expect(result.current.isConnected).toBe(true);
    });

    it('A8 — does not create a second socket when one is already OPEN', () => {
      renderConnected();
      // Only one instance should ever exist (OPEN guard prevents duplicates)
      expect(mockWsInstances).toHaveLength(1);
    });

  });

  // ── B. Message handling ──────────────────────────────────────────────────

  describe('B. Message handling', () => {

    it('B1 — lastMessage is null before any message arrives', () => {
      const { hook } = renderConnected();
      expect(hook.result.current.lastMessage).toBeNull();
    });

    it('B2 — parses and exposes a location_update message', () => {
      const { hook, ws } = renderConnected();
      const payload = {
        type: 'location_update',
        latitude: 41.3874, longitude: 2.1686,
        timestamp: '2026-04-25T10:00:00.000Z', walk_id: 42,
      };
      act(() => ws.simulateMessage(payload));
      expect(hook.result.current.lastMessage).toEqual(payload);
    });

    it('B3 — parses and exposes a walk_started message', () => {
      const { hook, ws } = renderConnected();
      const payload = { type: 'walk_started' };
      act(() => ws.simulateMessage(payload));
      expect(hook.result.current.lastMessage).toEqual(payload);
    });

    it('B4 — parses and exposes a walk_stopped message', () => {
      const { hook, ws } = renderConnected();
      const payload = { type: 'walk_stopped' };
      act(() => ws.simulateMessage(payload));
      expect(hook.result.current.lastMessage).toEqual(payload);
    });

    it('B5 — silently discards malformed (non-JSON) messages', () => {
      const { hook, ws } = renderConnected();

      // Establish baseline
      act(() => ws.simulateMessage({ type: 'walk_started' }));
      expect(hook.result.current.lastMessage).toEqual({ type: 'walk_started' });

      // Garbage — must not change lastMessage
      act(() => ws.simulateRawMessage('{{invalid-json}}'));
      expect(hook.result.current.lastMessage).toEqual({ type: 'walk_started' });
    });

    it('B6 — updates lastMessage on each successive valid message', () => {
      const { hook, ws } = renderConnected();
      const loc1 = { type: 'location_update', latitude: 41.3874, longitude: 2.1686, timestamp: '2026-04-25T10:00:00.000Z' };
      const loc2 = { type: 'location_update', latitude: 41.3881, longitude: 2.1692, timestamp: '2026-04-25T10:00:30.000Z' };

      act(() => ws.simulateMessage(loc1));
      expect(hook.result.current.lastMessage).toEqual(loc1);

      act(() => ws.simulateMessage(loc2));
      expect(hook.result.current.lastMessage).toEqual(loc2);
    });

  });

  // ── C. Reconnection with exponential backoff ─────────────────────────────

  describe('C. Reconnection logic', () => {

    beforeEach(() => vi.useFakeTimers());
    afterEach(()  => vi.useRealTimers());

    it('C1 — schedules a reconnect after the socket closes', () => {
      const { ws } = renderConnected();

      act(() => ws.simulateClose());
      expect(mockWsInstances).toHaveLength(1); // no new socket yet

      act(() => vi.advanceTimersByTime(1_000));
      expect(mockWsInstances).toHaveLength(2); // reconnected ✓
    });

    it('C2 — exponential backoff: 1s → 2s → 4s → 8s → 10s (capped)', () => {
      const { ws: ws0 } = renderConnected();

      // attempt 0 → 1 000 ms
      act(() => ws0.simulateClose());
      act(() => vi.advanceTimersByTime(999));
      expect(mockWsInstances).toHaveLength(1);
      act(() => vi.advanceTimersByTime(1));
      expect(mockWsInstances).toHaveLength(2);

      // attempt 1 → 2 000 ms
      const ws1 = mockWsInstances[1];
      act(() => ws1.simulateClose());
      act(() => vi.advanceTimersByTime(1_999));
      expect(mockWsInstances).toHaveLength(2);
      act(() => vi.advanceTimersByTime(1));
      expect(mockWsInstances).toHaveLength(3);

      // attempt 2 → 4 000 ms
      const ws2 = mockWsInstances[2];
      act(() => ws2.simulateClose());
      act(() => vi.advanceTimersByTime(4_000));
      expect(mockWsInstances).toHaveLength(4);

      // attempt 3 → 8 000 ms
      const ws3 = mockWsInstances[3];
      act(() => ws3.simulateClose());
      act(() => vi.advanceTimersByTime(8_000));
      expect(mockWsInstances).toHaveLength(5);

      // attempt 4 → 10 000 ms (cap)
      const ws4 = mockWsInstances[4];
      act(() => ws4.simulateClose());
      act(() => vi.advanceTimersByTime(9_999));
      expect(mockWsInstances).toHaveLength(5);
      act(() => vi.advanceTimersByTime(1));
      expect(mockWsInstances).toHaveLength(6);
    });

    it('C3 — stops reconnecting after 5 failed attempts', () => {
      const { ws: first } = renderConnected();
      const delays = [1_000, 2_000, 4_000, 8_000, 10_000];
      let current = first;

      for (const delay of delays) {
        act(() => current.simulateClose());
        act(() => vi.advanceTimersByTime(delay));
        current = mockWsInstances.at(-1)!;
      }

      const countAfterExhaustion = mockWsInstances.length;

      // 6th close — guard fires, no new socket created
      act(() => current.simulateClose());
      act(() => vi.advanceTimersByTime(30_000));
      expect(mockWsInstances).toHaveLength(countAfterExhaustion);
    });

    it('C4 — resets reconnect counter to 0 after a successful open', () => {
      const { ws: ws0 } = renderConnected();

      // Burn 2 attempts without letting new sockets open
      act(() => ws0.simulateClose());
      act(() => vi.advanceTimersByTime(1_000)); // ws1 created

      const ws1 = mockWsInstances[1];
      act(() => ws1.simulateClose());
      act(() => vi.advanceTimersByTime(2_000)); // ws2 created

      // Let ws2 open — counter resets
      const ws2 = mockWsInstances[2];
      act(() => ws2.simulateOpen());

      // Next close should fire at 1 000 ms (not 4 000 ms)
      act(() => ws2.simulateClose());
      act(() => vi.advanceTimersByTime(999));
      expect(mockWsInstances).toHaveLength(3); // not yet

      act(() => vi.advanceTimersByTime(1));
      expect(mockWsInstances).toHaveLength(4); // ✓ reset confirmed
    });

  });

  // ── D. Cleanup and unmount safety ────────────────────────────────────────

  describe('D. Cleanup and unmount safety', () => {

    it('D1 — nulls all socket handlers before closing on unmount', () => {
      const { hook, ws } = renderConnected();
      hook.unmount();
      expect(ws.onopen).toBeNull();
      expect(ws.onmessage).toBeNull();
      expect(ws.onerror).toBeNull();
      expect(ws.onclose).toBeNull();
    });

    it('D2 — closes the socket on unmount', () => {
      const { hook, ws } = renderConnected();
      hook.unmount();
      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    it('D3 — cancels a pending reconnect timer on unmount', () => {
      vi.useFakeTimers();
      const { hook, ws } = renderConnected();

      act(() => ws.simulateClose());    // arms the timer
      hook.unmount();                    // must cancel it

      act(() => vi.advanceTimersByTime(10_000));
      expect(mockWsInstances).toHaveLength(1); // no new socket ✓
      vi.useRealTimers();
    });

    it('D4 — does not throw when unmounting before socket opens', () => {
      const { unmount } = renderHook(() => useWebSocket());
      expect(() => unmount()).not.toThrow();
      expect(mockWsInstances[0].readyState).toBe(MockWebSocket.CLOSED);
    });

    it('D5 — does not throw when unmounting with enabled=false', () => {
      const { unmount } = renderHook(() => useWebSocket(false));
      expect(() => unmount()).not.toThrow();
      expect(mockWsInstances).toHaveLength(0);
    });

    it('D6 — onclose is null after unmount so no reconnect loop fires', () => {
      vi.useFakeTimers();
      const { hook, ws } = renderConnected();
      hook.unmount();

      // Handler was nulled — simulating a close from the server is a no-op
      expect(ws.onclose).toBeNull();
      act(() => vi.advanceTimersByTime(10_000));
      expect(mockWsInstances).toHaveLength(1); // no reconnect ✓
      vi.useRealTimers();
    });

  // ── E. Debounce optimization ─────────────────────────────────────────────

  describe('E. Debounce optimization', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(()  => vi.useRealTimers());

    it('E1 — without debounce, messages update immediately', () => {
      const { hook, ws } = renderConnected();
      const payload = { type: 'location_update', latitude: 41.3874, longitude: 2.1686 };

      act(() => ws.simulateMessage(payload));
      expect(hook.result.current.lastMessage).toEqual(payload);
    });

    it('E2 — with debounce, messages are delayed', () => {
      const hook = renderHook(() => useWebSocket(true, '', { debounceMs: 100 }));
      const ws = mockWsInstances[0];
      act(() => ws.simulateOpen());

      const payload = { type: 'location_update', latitude: 41.3874, longitude: 2.1686 };
      act(() => ws.simulateMessage(payload));

      // Before debounce delay, lastMessage should still be null
      expect(hook.result.current.lastMessage).toBeNull();

      // After debounce delay, lastMessage should be updated
      act(() => vi.advanceTimersByTime(100));
      expect(hook.result.current.lastMessage).toEqual(payload);
    });

    it('E3 — rapid messages are debounced, only last one shows', () => {
      const hook = renderHook(() => useWebSocket(true, '', { debounceMs: 50 }));
      const ws = mockWsInstances[0];
      act(() => ws.simulateOpen());

      act(() => ws.simulateMessage({ type: 'location_update', id: 1 }));
      act(() => ws.simulateMessage({ type: 'location_update', id: 2 }));
      act(() => ws.simulateMessage({ type: 'location_update', id: 3 }));

      expect(hook.result.current.lastMessage).toBeNull();

      act(() => vi.advanceTimersByTime(50));
      expect(hook.result.current.lastMessage).toEqual({ type: 'location_update', id: 3 });
    });

    it('E4 — debounce timeout is cleared on unmount', () => {
      const hook = renderHook(() => useWebSocket(true, '', { debounceMs: 100 }));
      const ws = mockWsInstances[0];
      act(() => ws.simulateOpen());

      act(() => ws.simulateMessage({ type: 'test' }));

      hook.unmount();

      act(() => vi.advanceTimersByTime(100));
      // No error thrown, debounce cleared properly
    });

    it('E5 — debounce of 0 behaves like no debounce', () => {
      const hook = renderHook(() => useWebSocket(true, '', { debounceMs: 0 }));
      const ws = mockWsInstances[0];
      act(() => ws.simulateOpen());

      const payload = { type: 'location_update', latitude: 41.3874, longitude: 2.1686 };
      act(() => ws.simulateMessage(payload));

      expect(hook.result.current.lastMessage).toEqual(payload);
    });
  });

});

});
