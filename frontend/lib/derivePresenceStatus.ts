import type { PresenceStatus } from './wsEventTypes';

/** Align with backend ConnectionManager.get_presence_status thresholds. */
export const GPS_ONLINE_MAX_AGE_SECONDS = 60;
export const LIMBO_MAX_AGE_SECONDS = 300;

/**
 * Recompute caregiver presence as time passes.
 * WS `online` is authoritative while the patient socket is alive.
 * Otherwise age of last location drives gps_online → limbo → offline
 * so the UI does not stick on a stale server broadcast.
 */
export function derivePresenceStatus(
  wsPresence: PresenceStatus,
  lastLocationTimestamp: string | null | undefined,
  nowMs: number = Date.now()
): PresenceStatus {
  if (wsPresence === 'online') {
    return 'online';
  }

  if (!lastLocationTimestamp) {
    return 'offline';
  }

  const ageSeconds = (nowMs - new Date(lastLocationTimestamp).getTime()) / 1000;
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0) {
    return 'offline';
  }
  if (ageSeconds < GPS_ONLINE_MAX_AGE_SECONDS) {
    return 'gps_online';
  }
  if (ageSeconds < LIMBO_MAX_AGE_SECONDS) {
    return 'limbo';
  }
  return 'offline';
}
