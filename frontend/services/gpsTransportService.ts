const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface TransportPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  walk_id?: number;
  client_id: string; // The UUID
  is_recovered?: boolean;
}

export interface BatchPayload {
  walk_id: number;
  batch_id: string;
  points: TransportPoint[];
}

export const gpsTransportService = {
  /**
   * Sends a batch of GPS points to the backend.
   * Throws an error if the network is offline or the request fails (other than 409).
   */
  async sendBatch(payload: BatchPayload, deviceToken: string | null): Promise<void> {
    if (!navigator.onLine) {
      throw new Error("Offline");
    }

    const response = await fetch(`${API_BASE_URL}/locations/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(deviceToken ? { "X-Patient-Token": deviceToken } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (response.ok || response.status === 409) {
      return; // Success or duplicate
    }

    const errorText = await response.text();
    throw new Error(`Batch sync failed: ${response.status} - ${errorText}`);
  },

  /**
   * Sends a single GPS point to the backend (used for syncing queued points).
   * Returns true if successful (or 409 duplicate), false otherwise.
   */
  async sendPoint(point: TransportPoint, deviceToken: string | null): Promise<boolean> {
    if (!navigator.onLine) {
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/locations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceToken ? { "X-Patient-Token": deviceToken } : {}),
        },
        body: JSON.stringify(point),
      });

      return response.ok || response.status === 409;
    } catch (error) {
      return false;
    }
  }
};
