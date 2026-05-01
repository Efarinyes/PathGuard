import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { locationService } from './locationService';
import { offlineSyncService } from './offlineSyncService';

// Mock Fetch globally
global.fetch = vi.fn();

describe('Offline GPS Queue Integration', () => {
  
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset IndexedDB for each test
    const db = await offlineSyncService.initDB();
    const transaction = db.transaction(['locationQueue'], 'readwrite');
    transaction.objectStore('locationQueue').clear();
    
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  it('Scenario 1: Offline Buffering - Stores points in IndexedDB when network is down', async () => {
    // 1. Simulate Offline
    Object.defineProperty(navigator, 'onLine', { value: false });
    (global.fetch as any).mockRejectedValue(new Error('Network Down'));

    // 2. Generate GPS points
    const points = [
      { latitude: 41.1, longitude: 2.1, timestamp: '2026-04-26T10:00:00Z', walk_id: 1 },
      { latitude: 41.2, longitude: 2.2, timestamp: '2026-04-26T10:01:00Z', walk_id: 1 },
    ];

    for (const p of points) {
      await locationService.saveLocation(p);
    }

    // 3. Assertions
    const unsynced = await offlineSyncService.getUnsynced();
    expect(unsynced.length).toBe(2);
    expect(unsynced[0].latitude).toBe(41.1);
    expect(global.fetch).not.toHaveBeenCalled(); // Should not have synced yet
  });

  it('Scenario 2: Recovery Sync - Flushes queued points chronologically on reconnection', async () => {
    // 1. Start Offline and buffer points
    Object.defineProperty(navigator, 'onLine', { value: false });
    await locationService.saveLocation({ latitude: 10, longitude: 10, timestamp: '2026-04-26T10:00:00Z', walk_id: 1 });
    await locationService.saveLocation({ latitude: 20, longitude: 20, timestamp: '2026-04-26T10:05:00Z', walk_id: 1 });

    expect((await offlineSyncService.getUnsynced()).length).toBe(2);

    // 2. Restore Network and Trigger Sync
    Object.defineProperty(navigator, 'onLine', { value: true });
    (global.fetch as any).mockResolvedValue({ ok: true });

    await locationService.syncQueuedPoints();

    // 3. Assertions
    const unsyncedAfter = await offlineSyncService.getUnsynced();
    expect(unsyncedAfter.length).toBe(0); // All points should be marked synced/cleared
    
    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    // Verify chronological order in calls
    const firstCall = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    const secondCall = JSON.parse((global.fetch as any).mock.calls[1][1].body);
    
    expect(firstCall.latitude).toBe(10);
    expect(secondCall.latitude).toBe(20);
  });

  it('Scenario 3: Duplication Safety - Handles 409 Conflict from backend correctly', async () => {
    // 1. Buffer a point
    Object.defineProperty(navigator, 'onLine', { value: false });
    await locationService.saveLocation({ latitude: 30, longitude: 30, timestamp: '2026-04-26T10:10:00Z', walk_id: 1 });

    // 2. Simulate Conflict (Already Synced)
    Object.defineProperty(navigator, 'onLine', { value: true });
    (global.fetch as any).mockResolvedValue({ ok: false, status: 409 });

    await locationService.syncQueuedPoints();

    // 3. Assertions
    const unsynced = await offlineSyncService.getUnsynced();
    expect(unsynced.length).toBe(0); // Should be cleared as it was already on server
  });
});
