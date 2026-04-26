/**
 * locationService.ts
 * Minimal and clean API service for handling location tracking data with Offline-First buffering.
 */
import { offlineSyncService } from "./offlineSyncService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export interface LocationPayload {
  latitude: number;
  longitude: number;
  timestamp: string;
  walk_id?: number;
}

export const locationService = {
  /**
   * Sends the current GPS coordinates with Offline-First buffering.
   * 1. Always write to IndexedDB first (idempotency key generation).
   * 2. Attempt to sync immediately if online.
   */
  async saveLocation(payload: LocationPayload): Promise<void> {
    // Generate unique ID for deduplication (idempotency)
    const eventId = crypto.randomUUID();
    
    try {
      // A. Persistent Buffer (Reliability)
      await offlineSyncService.enqueue({
        id: eventId,
        ...payload,
        walk_id: payload.walk_id || 0
      });

      // B. Immediate Sync Attempt
      if (navigator.onLine) {
        await this.syncQueuedPoints();
      }
    } catch (error) {
      console.debug("[locationService] Buffering failed:", error);
    }
  },

  /**
   * Flushes all unsynced points from the IndexedDB queue to the backend.
   * Ensures chronological order and handles retries.
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
            client_id: point.id, // Idempotency key
            latitude: point.latitude,
            longitude: point.longitude,
            timestamp: point.timestamp,
            walk_id: point.walk_id
          }),
        });

        if (response.ok || response.status === 409) {
          // 409 Conflict means it was already synced (backend deduplication)
          await offlineSyncService.markSynced(point.id);
        } else {
          // Stop syncing if backend rejects (e.g. walk finished)
          break;
        }
      } catch (error) {
        // Network still down, stop flushing
        break;
      }
    }
    
    // Clean up synced items to save space
    await offlineSyncService.clearSynced();
  }
};

// Auto-sync when network returns
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.debug("[locationService] Back online. Flushing queue...");
    locationService.syncQueuedPoints();
  });
}