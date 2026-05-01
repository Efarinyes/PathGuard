/**
 * gpsUtils.ts
 * Utility functions for GPS coordinate calculations.
 */

export interface Position {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function getDistanceHaversine(p1: Position, p2: Position): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (p1.latitude * Math.PI) / 180;
  const φ2 = (p2.latitude * Math.PI) / 180;
  const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Estimates movement speed in meters per minute.
 */
export function estimateSpeed(
  p1: Position,
  p2: Position,
  timeMs: number
): number {
  if (timeMs <= 0) return 0;
  const distance = getDistanceHaversine(p1, p2);
  const minutes = timeMs / 60000;
  return distance / minutes;
}
