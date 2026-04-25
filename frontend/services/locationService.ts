/**
 * locationService.ts
 * Minimal and clean API service for handling location tracking data.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export interface LocationPayload {
  latitude: number;
  longitude: number;
  timestamp: string;
  walk_id?: number; // Included as the FastAPI backend requires a walk_id for active walks
}

export const locationService = {
  /**
   * Sends the current GPS coordinates to the backend silently.
   * Catches and suppresses any network errors to avoid UI spam
   * (e.g., if the user temporarily loses internet connection during a walk).
   */

  async saveLocation(payload: LocationPayload): Promise<void> {
    try {
      const deviceToken =
        typeof window !== "undefined"
          ? localStorage.getItem("pg_device_token")
          : null;

      const response = await fetch(`${API_BASE_URL}/locations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(deviceToken ? { "X-Patient-Token": deviceToken } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn("Location rejected:", response.status);
      }
    } catch (error) {
      console.debug("Location network failure:", error);
    }
  }
}