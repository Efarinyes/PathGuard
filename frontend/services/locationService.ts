/**
 * locationService.ts
 * API service for handling location tracking data with Adaptive Batching and Offline-First buffering.
 */
import { offlineSyncService } from "./offlineSyncService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export interface LocationPayload {
  latitude: number;
  longitude: number;
  timestamp: string;
  walk_id?: number;
}

// In-memory buffer for adaptive batching
let batchBuffer: any[] = [];
let batchTimer: NodeJS.Timeout | null = null;
const BATCH_SIZE_THRESHOLD = 5;
const BATCH_TIME_THRESHOLD_MS = 5000;

export const locationService = {
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

    batchBuffer.push(point);

    // Threshold check: Size
    if (batchBuffer.length >= BATCH_SIZE_THRESHOLD) {
      await this.flushBatch();
    } else if (!batchTimer) {
      // Threshold check: Time
      batchTimer = setTimeout(() => {
        this.flushBatch();
      }, BATCH_TIME_THRESHOLD_MS);
    }
  },

  /**
   * Sends the current buffer as a single batch to the backend.
   * If network fails, entire batch is moved to persistent IndexedDB.
   */
  async flushBatch(): Promise<void> {
    if (batchBuffer.length === 0) return;
    
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }

    const currentBatch = [...batchBuffer];
    batchBuffer = [];

    const walkId = currentBatch[0].walk_id;
    const batchId = crypto.randomUUID();
    const deviceToken = typeof window !== "undefined" ? localStorage.getItem("pg_device_token") : null;

    try {
      // Fast check for connectivity
      if (!navigator.onLine) throw new Error("Offline");

      const response = await fetch(`${API_BASE_URL}/locations/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceToken ? { "X-Patient-Token": deviceToken } : {}),
        },
        body: JSON.stringify({
          walk_id: walkId,
          batch_id: batchId,
          points: currentBatch.map(p => ({
            latitude: p.latitude,
            longitude: p.longitude,
            timestamp: p.timestamp,
            walk_id: p.walk_id,
            client_id: p.id
          }))
        }),
      });

      if (!response.ok) {
        throw new Error("Batch sync failed");
      }
    } catch (error) {
      console.debug("[locationService] Batch sync failed, buffering to IndexedDB:", error);
      // Resilience: Persist entire batch to IndexedDB for later recovery
      for (const point of currentBatch) {
        await offlineSyncService.enqueue(point);
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
    const unsynced = await offlineSyncService.getUnsynced();
    if (unsynced.length === 0) return;

    const deviceToken = typeof window !== "undefined" ? localStorage.getItem("pg_device_token") : null;

    for (const point of unsynced) {
      try {
        const response = await fetch(`${API_BASE_URL}/locations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(deviceToken ? { "X-Patient-Token": deviceToken } : {}),
          },
          body: JSON.stringify({
            client_id: point.id,
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: point.timestamp,
            walk_id: point.walk_id
          }),
        });

        if (response.ok || response.status === 409) {
          await offlineSyncService.markSynced(point.id);
        } else {
          break;
        }
      } catch (error) {
        break;
      }
    }
    await offlineSyncService.clearSynced();
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

// Auto-sync when network returns
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    locationService.syncQueuedPoints();
  });
}