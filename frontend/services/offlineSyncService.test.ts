import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { offlineSyncService, QueuedLocation } from './offlineSyncService';

describe('offlineSyncService', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    db = await offlineSyncService.initDB();
    const transaction = db.transaction(['locationQueue'], 'readwrite');
    transaction.objectStore('locationQueue').clear();
  });

  describe('add', () => {
    it('should add a location to the queue', async () => {
      const location = {
        id: 'test-1',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
      };

      await offlineSyncService.add(location);

      const unsynced = await offlineSyncService.getUnsynced();
      expect(unsynced).toHaveLength(1);
      expect(unsynced[0].id).toBe('test-1');
      expect(unsynced[0].synced).toBe(0);
    });

    it('should add location with is_recovered field', async () => {
      const location = {
        id: 'test-2',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
        is_recovered: true,
      };

      await offlineSyncService.add(location);

      const unsynced = await offlineSyncService.getUnsynced();
      expect(unsynced[0].is_recovered).toBe(true);
    });
  });

  describe('getUnsynced', () => {
    it('should return only unsynced locations', async () => {
      await offlineSyncService.add({
        id: 'test-1',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
      });

      await offlineSyncService.markSynced('test-1');

      const unsynced = await offlineSyncService.getUnsynced();
      expect(unsynced).toHaveLength(0);
    });

    it('should return locations in chronological order', async () => {
      await offlineSyncService.add({
        id: 'test-3',
        walk_id: 1,
        latitude: 41.3853,
        longitude: 2.1736,
        timestamp: '2026-05-07T10:02:00Z',
      });
      await offlineSyncService.add({
        id: 'test-1',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
      });
      await offlineSyncService.add({
        id: 'test-2',
        walk_id: 1,
        latitude: 41.3852,
        longitude: 2.1735,
        timestamp: '2026-05-07T10:01:00Z',
      });

      const unsynced = await offlineSyncService.getUnsynced();

      expect(unsynced[0].id).toBe('test-1');
      expect(unsynced[1].id).toBe('test-2');
      expect(unsynced[2].id).toBe('test-3');
    });

    it('should sort by timestamp then id for same-timestamp entries', async () => {
      const timestamp = '2026-05-07T10:00:00Z';
      await offlineSyncService.add({
        id: 'b-id',
        walk_id: 1,
        latitude: 41.3852,
        longitude: 2.1735,
        timestamp,
      });
      await offlineSyncService.add({
        id: 'a-id',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp,
      });

      const unsynced = await offlineSyncService.getUnsynced();

      expect(unsynced[0].id).toBe('a-id');
      expect(unsynced[1].id).toBe('b-id');
    });
  });

  describe('markSynced', () => {
    it('should mark a location as synced', async () => {
      await offlineSyncService.add({
        id: 'test-1',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
      });

      await offlineSyncService.markSynced('test-1');

      const unsynced = await offlineSyncService.getUnsynced();
      expect(unsynced).toHaveLength(0);
    });

    it('should handle marking non-existent id gracefully', async () => {
      await offlineSyncService.add({
        id: 'test-1',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
      });

      await offlineSyncService.markSynced('non-existent');

      const unsynced = await offlineSyncService.getUnsynced();
      expect(unsynced).toHaveLength(1);
    });
  });

  describe('markSyncedBulk', () => {
    it('should mark multiple locations as synced', async () => {
      await offlineSyncService.add({
        id: 'test-1',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
      });
      await offlineSyncService.add({
        id: 'test-2',
        walk_id: 1,
        latitude: 41.3852,
        longitude: 2.1735,
        timestamp: '2026-05-07T10:01:00Z',
      });
      await offlineSyncService.add({
        id: 'test-3',
        walk_id: 1,
        latitude: 41.3853,
        longitude: 2.1736,
        timestamp: '2026-05-07T10:02:00Z',
      });

      await offlineSyncService.markSyncedBulk(['test-1', 'test-2']);

      const unsynced = await offlineSyncService.getUnsynced();
      expect(unsynced).toHaveLength(1);
      expect(unsynced[0].id).toBe('test-3');
    });

    it('should handle empty array', async () => {
      await offlineSyncService.add({
        id: 'test-1',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
      });

      await offlineSyncService.markSyncedBulk([]);

      const unsynced = await offlineSyncService.getUnsynced();
      expect(unsynced).toHaveLength(1);
    });
  });

  describe('clearSynced', () => {
    it('should clear all synced locations', async () => {
      await offlineSyncService.add({
        id: 'test-1',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
      });

      await offlineSyncService.markSynced('test-1');
      await offlineSyncService.clearSynced();

      const transaction = db.transaction(['locationQueue'], 'readonly');
      const store = transaction.objectStore('locationQueue');
      const request = store.getAll();

      const all = await new Promise<QueuedLocation[]>((resolve) => {
        request.onsuccess = () => resolve(request.result as QueuedLocation[]);
      });

      expect(all).toHaveLength(0);
    });
  });

  describe('QueuedLocation interface', () => {
    it('should support is_recovered field', () => {
      const location: QueuedLocation = {
        id: 'test-1',
        walk_id: 1,
        latitude: 41.3851,
        longitude: 2.1734,
        timestamp: '2026-05-07T10:00:00Z',
        synced: 0,
        is_recovered: true,
        client_id: 'uuid-123',
      };

      expect(location.is_recovered).toBe(true);
      expect(location.client_id).toBe('uuid-123');
    });
  });
});