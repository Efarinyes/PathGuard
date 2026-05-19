/**
 * trajectoryService.ts
 * Logic for cleaning, smoothing, and validating GPS trajectories.
 * Maintains the DUALITY between RAW data (source of truth) and DERIVED data (visualization).
 */
import { getDistanceHaversine, Position } from "../lib/gpsUtils";

export interface GPSPoint extends Position {
  timestamp: string;
  client_id?: string;
  id?: number;
}

const JITTER_THRESHOLD_M = 4; // 4 meters

export const trajectoryService = {
  /**
   * Cleans a raw trajectory by removing duplicates and jitter.
   * Ensures strict chronological ordering.
   * @param rawPoints The source-of-truth points.
   */
  cleanTrajectory(rawPoints: GPSPoint[]): GPSPoint[] {
    if (rawPoints.length === 0) return [];

    // 1. Sort by timestamp (Strict ordering)
    const sorted = [...rawPoints].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const cleaned: GPSPoint[] = [];
    
    for (const current of sorted) {
      if (cleaned.length === 0) {
        cleaned.push(current);
        continue;
      }

      const last = cleaned[cleaned.length - 1];
      const distance = getDistanceHaversine(last, current);

      // 2. Consecutive Duplicate Removal (within tolerance)
      if (distance < 0.5) { // Sub-meter duplicate
        continue;
      }

      // 3. Jitter Filtering (suppress oscillations < threshold)
      if (distance < JITTER_THRESHOLD_M) {
        // If it's the last point of the raw set, we might keep it for accuracy,
        // but generally jitter points are noise.
        continue;
      }

      cleaned.push(current);
    }

    return cleaned;
  },

  /**

   * Validates walk integrity (Monotonicity and Continuity).
   */
  validateIntegrity(points: GPSPoint[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (points.length < 2) return { valid: true, errors: [] };

    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];

      // 1. Monotonicity check
      if (new Date(p2.timestamp).getTime() < new Date(p1.timestamp).getTime()) {
        errors.push(`Temporal regression detected at index ${i}`);
      }

      // 2. Gap detection (> 5 minutes)
      const gapMs = new Date(p2.timestamp).getTime() - new Date(p1.timestamp).getTime();
      if (gapMs > 300000) {
        errors.push(`Trajectory gap detected: ${Math.round(gapMs/1000)}s`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};
