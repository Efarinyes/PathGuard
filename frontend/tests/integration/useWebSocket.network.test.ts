import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { useWebSocket } from '@/hooks/useWebSocket';
import LocationSync from '@/plugins/location-sync';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
  },
}));

vi.mock('@/plugins/location-sync', () => ({
  default: {
    addListener: vi.fn(),
    getNetworkStatus: vi.fn(),
  },
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = MockWebSocket.CONNECTING;

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string | URL) {
    this.url = String(url);
    MockWebSocket.instances.push(this);
  }

  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    // no-op for tests
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

describe('useWebSocket native iOS network reachability', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    MockWebSocket.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not register native listener on web platform', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web');

    renderHook(() => useWebSocket(true));

    expect(LocationSync.addListener).not.toHaveBeenCalled();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('registers native listener on iOS platform', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(LocationSync.addListener).mockResolvedValue({ remove: vi.fn() });

    renderHook(() => useWebSocket(true));

    await act(async () => Promise.resolve());

    expect(LocationSync.addListener).toHaveBeenCalledWith(
      'networkStatusChange',
      expect.any(Function)
    );
  });

  it('reconnects immediately when native iOS event reports connected', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');

    let networkListener: ((status: { connected: boolean }) => void) | null = null;
    vi.mocked(LocationSync.addListener).mockImplementation((eventName, listener) => {
      if (eventName === 'networkStatusChange') {
        networkListener = listener as (status: { connected: boolean }) => void;
      }
      return Promise.resolve({ remove: vi.fn() });
    });

    renderHook(() => useWebSocket(true));

    expect(MockWebSocket.instances).toHaveLength(1);
    const firstSocket = MockWebSocket.instances[0];

    act(() => {
      firstSocket.readyState = MockWebSocket.CLOSED;
      firstSocket.onclose?.();
    });

    // A reconnect is scheduled but has not fired yet. Simulating network
    // restore before the scheduled reconnect should create a new socket
    // immediately.
    act(() => {
      networkListener?.({ connected: true });
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('cancels pending reconnect when native iOS event reports disconnected', () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');

    let networkListener: ((status: { connected: boolean }) => void) | null = null;
    vi.mocked(LocationSync.addListener).mockImplementation((eventName, listener) => {
      if (eventName === 'networkStatusChange') {
        networkListener = listener as (status: { connected: boolean }) => void;
      }
      return Promise.resolve({ remove: vi.fn() });
    });

    renderHook(() => useWebSocket(true));
    const firstSocket = MockWebSocket.instances[0];

    act(() => {
      firstSocket.readyState = MockWebSocket.CLOSED;
      firstSocket.onclose?.();
    });

    const countAfterClose = MockWebSocket.instances.length;

    act(() => {
      networkListener?.({ connected: false });
    });

    // The first scheduled reconnect would fire at WS_RECONNECT_BASE_DELAY_MS
    // (1000 ms). Advancing a few seconds verifies it was cancelled, while
    // staying below WS_HEALTH_PING_INTERVAL_MS (15000 ms) so the independent
    // health ping does not create a new socket either.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(MockWebSocket.instances.length).toBe(countAfterClose);
  });

  it('removes native listener on unmount', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');

    const removeMock = vi.fn();
    vi.mocked(LocationSync.addListener).mockResolvedValue({ remove: removeMock });

    const { unmount } = renderHook(() => useWebSocket(true));

    await act(async () => Promise.resolve());

    unmount();

    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it('keeps working when native listener registration fails', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(LocationSync.addListener).mockRejectedValue(new Error('Plugin unavailable'));

    renderHook(() => useWebSocket(true));

    await act(async () => Promise.resolve());

    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
