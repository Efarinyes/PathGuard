import { LocationPayload } from '../services/locationService';

export interface WalkSnapshotMessage {
  type: 'snapshot';
  timestamp?: string;
  event_id?: string;
  group_id?: number;
  watchers_count?: number;
  active_walk?: {
    id: number;
    active_walk_id?: number;
    history: Array<{
      latitude: number;
      longitude: number;
      timestamp: string;
      walk_id?: number;
    }>;
    latest_location?: {
      latitude: number;
      longitude: number;
      timestamp: string;
      walk_id?: number;
    };
  };
  [key: string]: unknown;
}

export type PresenceStatus = "online" | "gps_online" | "limbo" | "offline";

export type WSEventType =
  | { type: 'snapshot'; payload: WalkSnapshotMessage }
  | { type: 'walk_started'; timestamp: number }
  | { type: 'walk_stopped' }
  | { type: 'patient_online' }
  | { type: 'patient_offline' }
  | { type: 'patient_status'; status: PresenceStatus; group_id: number }
  | { type: 'watchers_update'; count: number }
  | { type: 'sos_alert'; patient_id: number; walk_id: number | null; sos_count: number; timestamp: string }
  | { type: 'location_update'; payload: LocationPayload };

/**
 * Type guard helpers for WSEventType discriminated union.
 */
export function isSnapshotEvent(event: WSEventType): event is Extract<WSEventType, { type: 'snapshot' }> {
  return event.type === 'snapshot';
}

export function isWalkStartedEvent(event: WSEventType): event is Extract<WSEventType, { type: 'walk_started' }> {
  return event.type === 'walk_started';
}

export function isLocationUpdateEvent(event: WSEventType): event is Extract<WSEventType, { type: 'location_update' }> {
  return event.type === 'location_update';
}
