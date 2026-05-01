/**
 * locationService.ts
 * API service for handling location tracking data with Adaptive Batching and Offline-First buffering.
 */
import { offlineSyncService } from "./offlineSyncService";
import { gpsTransportService } from "./gpsTransportService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface LocationPayload {
  latitude: number;
  longitude: number;
  timestamp: string;
  walk_id?: number;
}

// In-memory buffer for adaptive batching
let batchBuffer: any[] = [];
let batchTimer: NodeJS.Timeout | null = null;
let _isSyncing = false; // Internal lock for chronological sync
const BATCH_SIZE_THRESHOLD = 5;
const BATCH_TIME_THRESHOLD_MS = 5000;

export const locationService = {
  /**
   * Sends GPS coordinates with Adaptive Batching.
   * 1. Add point to memory buffer.
   * 2. Flush if buffer is full (size threshold) or 5s have passed (time threshold).
   */
  async saveLocation(payload: LocationPayload): Promise<void> {
    console.log(`[locationService] saveLocation called for ${payload.latitude}, ${payload.longitude}`);
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

    batchBuffer.push(point);

    // Threshold check: Size
    if (batchBuffer.length >= BATCH_SIZE_THRESHOLD) {
      console.log(`[locationService] Flushing batch due to size threshold (${batchBuffer.length})`);
      await this.flushBatch();
    } else if (!batchTimer) {
      // Threshold check: Time
      batchTimer = setTimeout(async () => {
        console.log(`[locationService] Flushing batch due to time threshold (5s)`);
        await this.flushBatch();
      }, BATCH_TIME_THRESHOLD_MS);
    }
  },

  /**
   * Sends the current buffer as a single batch to the backend.
   * If network fails, entire batch is moved to persistent IndexedDB.
   */
  async flushBatch(): Promise<void> {
    if (batchBuffer.length === 0 || _isSyncing) return;

    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }

    const currentBatch = [...batchBuffer];
    batchBuffer = [];

    const walkId = currentBatch[0].walk_id;
    const batchId = crypto.randomUUID();
    const deviceToken = typeof window !== "undefined" ? localStorage.getItem("pg_device_token") : null;

    console.log(`[locationService] flushBatch executing. Batch size: ${currentBatch.length}, Walk ID: ${walkId}`);

    try {
      console.log(`[locationService] Sending batch via gpsTransportService...`);
      await gpsTransportService.sendBatch({
        walk_id: walkId,
        batch_id: batchId,
        points: currentBatch.map(p => ({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: p.timestamp,
          walk_id: p.walk_id,
          client_id: p.id
        }))
      }, deviceToken);

      // Success or Conflict (Duplicate): Mark as synced to prevent retries
      for (const point of currentBatch) {
        await offlineSyncService.markSynced(point.id);
      }
      await offlineSyncService.clearSynced();
    } catch (error) {
      console.debug("[locationService] Batch sync failed, buffering to IndexedDB:", error);
      // Resilience: Persist entire batch to IndexedDB for later recovery
      for (const point of currentBatch) {
        try {
          await offlineSyncService.add(point);
        } catch (e) {
          // Already in IndexedDB (from saveLocation), which is fine
        }
      }
    }
  },

  /**
   * Final flush (e.g. on walk stop) to ensure zero data loss.
   */
  async flushFinal(): Promise<void> {
    await this.flushBatch();
    await this.syncQueuedPoints();
  },

  /**
   * Flushes all unsynced points from the IndexedDB queue to the backend.
   */
  async syncQueuedPoints(): Promise<void> {
    if (_isSyncing) return;
    _isSyncing = true;

    try {
      const unsynced = await offlineSyncService.getUnsynced();
      if (unsynced.length === 0) return;

    const deviceToken = typeof window !== "undefined" ? localStorage.getItem("pg_device_token") : null;

    for (const point of unsynced) {
      const success = await gpsTransportService.sendPoint({
        client_id: point.id,
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
        walk_id: point.walk_id
      }, deviceToken);

      if (success) {
        await offlineSyncService.markSynced(point.id);
      } else {
        break; // Stop syncing on first network failure to maintain order
      }
    }
    } finally {
      _isSyncing = false;
      await offlineSyncService.clearSynced();
    }
  },

  /**
   * Internal helper for testing state resets.
   */
  _resetInternalState(): void {
    batchBuffer = [];
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }
  }
};

// DOM Event Listeners (online, visibilitychange, focus) have been moved to hooks/useOfflineRecovery.ts 
// to ensure they are safely mounted within the React lifecycle and adhere to SRP.