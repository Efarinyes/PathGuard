/**
 * locationService.ts
 * API service for handling location tracking data with Adaptive Batching and Offline-First buffering.
 */
import { offlineSyncService } from "./offlineSyncService";
import { gpsTransportService } from "./gpsTransportService";
import { API_BASE_URL, STORAGE_KEYS, BATCH_SIZE_THRESHOLD, BATCH_TIME_THRESHOLD_MS } from '@/lib/config';

export interface LocationPayload {
  latitude: number;
  longitude: number;
  timestamp: string;
  walk_id?: number;
  is_recovered?: boolean;
}

class LocationService {
  // Private state — no module-level mutable state (Golden Rule)
  private batchBuffer: LocationPayload[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isSyncing = false; // Internal lock for chronological sync

  /**
   * Sends GPS coordinates with Adaptive Batching.
   * 1. Add point to memory buffer.
   * 2. Flush if buffer is full (size threshold) or 5s have passed (time threshold).
   */
  async saveLocation(payload: LocationPayload): Promise<void> {
    // Generate unique ID for deduplication (idempotency)
    const eventId = crypto.randomUUID();

    const point = {
      id: eventId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      timestamp: payload.timestamp,
      walk_id: payload.walk_id || 0
    };
    await offlineSyncService.add(point);

    this.batchBuffer.push(point);

    // Threshold check: Size
    if (this.batchBuffer.length >= BATCH_SIZE_THRESHOLD) {
      await this.flushBatch();
    } else if (!this.batchTimer) {
      // Threshold check: Time
      this.batchTimer = setTimeout(async () => {
        await this.flushBatch();
      }, BATCH_TIME_THRESHOLD_MS);
    }
  }

  /**
   * Sends the current buffer as a single batch to the backend.
   * If network fails, entire batch is moved to persistent IndexedDB.
   */
  async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0 || this.isSyncing) return;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    const currentBatch = [...this.batchBuffer];
    this.batchBuffer = [];

    if (currentBatch.length === 0) {
      return;
    }

    const walkId = currentBatch[0].walk_id;
    const batchId = crypto.randomUUID();
    const deviceToken = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN) : null;

    try {
      const pointsWithClientId = currentBatch.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: p.timestamp,
        walk_id: p.walk_id,
        client_id: crypto.randomUUID()
      }));
      await gpsTransportService.sendBatch({
        walk_id: walkId as number,
        batch_id: batchId,
        points: pointsWithClientId
      }, deviceToken);

      // Success or Conflict (Duplicate): Mark as synced to prevent retries
      for (const point of pointsWithClientId) {
        await offlineSyncService.markSynced(point.client_id);
      }
      await offlineSyncService.clearSynced();
    } catch (error) {
      // Resilience: Persist entire batch to IndexedDB for later recovery
      for (const point of currentBatch) {
        if (!point.walk_id) continue;
        try {
          await offlineSyncService.add({
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: point.timestamp,
            walk_id: point.walk_id,
            id: crypto.randomUUID()
          });
        } catch {
          // Already in IndexedDB (from saveLocation), which is fine
        }
      }
    }
  }

  /**
   * Final flush (e.g. on walk stop) to ensure zero data loss.
   */
  async flushFinal(): Promise<void> {
    await this.flushBatch();
    await this.syncQueuedPoints();
  }

  /**
   * Flushes all unsynced points from the IndexedDB queue to the backend.
   */
  async syncQueuedPoints(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const unsynced = await offlineSyncService.getUnsynced();
      if (unsynced.length === 0) return;

      const deviceToken = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN) : null;

      for (const point of unsynced) {
        const success = await gpsTransportService.sendPoint({
          client_id: point.id,
          latitude: point.latitude,
          longitude: point.longitude,
          timestamp: point.timestamp,
          walk_id: point.walk_id,
          is_recovered: true // Mark as recovered when syncing from offline
        }, deviceToken);

        if (success) {
          await offlineSyncService.markSynced(point.id);
        } else {
          break; // Stop syncing on first network failure to maintain order
        }
      }
    } finally {
      this.isSyncing = false;
      await offlineSyncService.clearSynced();
    }
  }

  /**
   * Internal helper for testing state resets.
   * Also resets the isSyncing lock to prevent cross-test contamination.
   */
  _resetInternalState(): void {
    this.batchBuffer = [];
    this.isSyncing = false;
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }
}

export const locationService = new LocationService();

// DOM Event Listeners (online, visibilitychange, focus) have been moved to hooks/useOfflineRecovery.ts 
// to ensure they are safely mounted within the React lifecycle and adhere to SRP.
