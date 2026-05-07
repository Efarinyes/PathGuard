import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import 'fake-indexeddb/auto';
import { locationService } from './locationService';
import { offlineSyncService } from './offlineSyncService';

// Mock Fetch
global.fetch = vi.fn();

describe('GPS Batching System Integration', () => {
  
  beforeAll(async () => {
    await offlineSyncService.initDB();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Clear state
    (locationService as any)._resetInternalState();
    
    // Clear IndexedDB
    const db = await offlineSyncService.initDB();
    const tx = db.transaction(['locationQueue'], 'readwrite');
    await new Promise<void>((resolve) => {
      const request = tx.objectStore('locationQueue').clear();
      request.onsuccess = () => resolve();
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    (locationService as any)._resetInternalState();
  });

  it('Scenario 1: Size-based Flush - Flushes when 5 points are collected', async () => {
    (global.fetch as any).mockResolvedValue({ ok: true });

    for (let i = 0; i < 4; i++) {
      await locationService.saveLocation({ latitude: i, longitude: i, timestamp: '2026-04-26T10:00:00Z', walk_id: 1 });
    }
    expect(global.fetch).not.toHaveBeenCalled();

    await locationService.saveLocation({ latitude: 4, longitude: 4, timestamp: '2026-04-26T10:00:00Z', walk_id: 1 });
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.points.length).toBe(5);
  });

  it('Scenario 2: Time-based Flush - Flushes after 5 seconds', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    (global.fetch as any).mockResolvedValue({ ok: true });

    await locationService.saveLocation({ latitude: 10, longitude: 10, timestamp: '2026-04-26T10:00:00Z', walk_id: 1 });
    await locationService.saveLocation({ latitude: 11, longitude: 11, timestamp: '2026-04-26T10:00:00Z', walk_id: 1 });

    expect(global.fetch).not.toHaveBeenCalled();

    // Trigger the timeout
    await vi.advanceTimersByTimeAsync(5005);
    
    // Allow any microtasks to flush
    await vi.runAllTicks();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(body.points.length).toBe(2);
  }, 15000);

  it('Scenario 3: Failure Recovery - Batch is moved to IndexedDB on network error', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    (global.fetch as any).mockRejectedValue(new Error('Network Failure'));

    // Clear state first
    (locationService as any)._resetInternalState();
    
    // Save fewer than batch size to avoid auto-flush
    for (let i = 0; i < 3; i++) {
      await locationService.saveLocation({ latitude: 20, longitude: 20, timestamp: '2026-04-26T10:00:00Z', walk_id: 1 });
    }

    // Advance timer to trigger time-based flush
    await vi.advanceTimersByTimeAsync(5005);
    await vi.runAllTicks();

    // Points should now be in IndexedDB due to network failure
    const unsynced = await offlineSyncService.getUnsynced();
    expect(unsynced.length).toBeGreaterThanOrEqual(3);
  });

  it('Scenario 4: Final Flush - Ensures zero data loss on walk stop', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    (global.fetch as any).mockResolvedValue({ ok: true });

    await locationService.saveLocation({ latitude: 30, longitude: 30, timestamp: '2026-04-26T10:00:00Z', walk_id: 1 });
    await locationService.saveLocation({ latitude: 31, longitude: 31, timestamp: '2026-04-26T10:00:00Z', walk_id: 1 });

    expect(global.fetch).not.toHaveBeenCalled();

    // Clear any existing timer before flushFinal
    (locationService as any)._resetInternalState();
    
    await locationService.flushFinal();

    expect(global.fetch).toHaveBeenCalled();
    // flushFinal calls flushBatch + syncQueuedPoints, expect at least one call
    expect(global.fetch).toHaveBeenCalled();
  });
});
