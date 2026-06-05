import { LocationPayload } from '../services/locationService';
import { WSEventType, WalkSnapshotMessage } from './wsEventTypes';
import { getDistanceHaversine } from './gpsUtils';

export interface WalkState {
  currentLocation: LocationPayload | null;
  routeHistory: LocationPayload[];
  isActive: boolean;
}

export interface BatchLocationUpdatePayload {
  locations: LocationPayload[];
  walk_id: number;
}

export type { WalkSnapshotMessage } from './wsEventTypes';

export interface WalkLocationMessage {
  type?: 'location';
  timestamp?: string;
  event_id?: string;
  latitude: number;
  longitude: number;
  walk_id?: number;
  [key: string]: unknown;
}

export interface WalkEventMessage {
  type: 'walk_started' | 'walk_stopped';
  timestamp?: string;
  event_id?: string;
  [key: string]: unknown;
}

interface SnapshotPayload {
  active_walk?: ActiveWalkData;
  [key: string]: unknown;
}

interface ActiveWalkData {
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
}

export type WalkAction =
  | { type: 'SNAPSHOT'; payload: SnapshotPayload }
  | { type: 'WALK_STARTED'; timestamp: number }
  | { type: 'WALK_STOPPED' }
  | { type: 'LOCATION_UPDATE'; payload: LocationPayload }
  | { type: 'BATCH_LOCATION_UPDATE'; payload: BatchLocationUpdatePayload }
  | { type: 'RESET' };

/**
 * Helper to safely append a location point to a history array.
 * Ensures immutability, deduplication by timestamp, and chronological sorting.
 */
const appendLocation = (history: LocationPayload[], newPoint: LocationPayload): LocationPayload[] => {
  if (history.some((p) => p.timestamp === newPoint.timestamp)) return history;

  return [...history, newPoint].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );
};

export class WalkEventProcessor {
  private processedEvents = new Set<string>();
  private latestTimestamp = 0;

  /**
   * Evaluates if a raw message should be processed, based on deduplication and chronological ordering.
   * Returns true if valid, false if it should be ignored.
   */
  public shouldProcessMessage(message: unknown): boolean {
    if (!message || typeof message !== 'object') return false;

    const msg = message as Record<string, unknown>;

    // A. Event Deduplication (Strict UUID check)
    const eventId = msg.event_id;
    if (typeof eventId === 'string') {
      if (this.processedEvents.has(eventId)) {
        return false;
      }
      this.processedEvents.add(eventId);

      // Keep memory usage low by capping the set
      if (this.processedEvents.size > 200) {
        const first = this.processedEvents.values().next().value;
        if (first) this.processedEvents.delete(first);
      }
    }

    // B. Chronological Ordering (Strict Timestamp check) - Only for locations
    const msgType = msg.type;
    const isLocationMsg =
      msgType === 'location' ||
      (!msgType && typeof msg.latitude === 'number' && typeof msg.longitude === 'number');

    if (isLocationMsg) {
      const tsRaw = msg.timestamp;
      const eventTime = typeof tsRaw === 'string' ? new Date(tsRaw).getTime() : 0;
      if (eventTime > 0 && eventTime < this.latestTimestamp - 30_000) {
        return false;
      }
      if (eventTime > 0) this.latestTimestamp = eventTime;
    }

    return true;
  }

  /**
   * Classifies a raw WebSocket message into a strongly-typed WSEventType.
   * Returns null if the message is unrecognised or malformed.
   */
  public classifyEvent(rawMessage: unknown): WSEventType | null {
    if (!rawMessage || typeof rawMessage !== 'object') {
      return null;
    }

    const msg = rawMessage as Record<string, unknown>;
    const msgType = msg.type;

    // 1. Snapshot
    if (msgType === 'snapshot') {
      return { type: 'snapshot', payload: msg as WalkSnapshotMessage };
    }

    // 2. Walk lifecycle
    if (msgType === 'walk_started') {
      const ts = msg.timestamp ? new Date(msg.timestamp as string).getTime() : Date.now();
      return { type: 'walk_started', timestamp: ts };
    }

    if (msgType === 'walk_stopped') {
      return { type: 'walk_stopped' };
    }

    // 3. Patient presence
    if (msgType === 'patient_online') {
      return { type: 'patient_online' };
    }

    if (msgType === 'patient_offline') {
      return { type: 'patient_offline' };
    }

    if (msgType === 'patient_status') {
      const status = msg.status as string;
      if (status === 'online' || status === 'gps_online' || status === 'limbo' || status === 'offline') {
        return {
          type: 'patient_status',
          status,
          group_id: typeof msg.group_id === 'number' ? msg.group_id : 0,
        };
      }
      return null;
    }

    // 4. Watchers update
    if (msgType === 'watchers_update') {
      const count = typeof msg.count === 'number' ? msg.count : 0;
      return { type: 'watchers_update', count };
    }

    // 5. SOS alert
    if (msgType === 'sos_alert') {
      if (
        typeof msg.patient_id === 'number' &&
        typeof msg.sos_count === 'number' &&
        typeof msg.timestamp === 'string'
      ) {
        return {
          type: 'sos_alert',
          patient_id: msg.patient_id,
          walk_id: typeof msg.walk_id === 'number' ? msg.walk_id : null,
          sos_count: msg.sos_count,
          timestamp: msg.timestamp,
        };
      }
      return null;
    }

    // 6. Location update (explicit type or typeless with lat/lng)
    const isLocation =
      msgType === 'location' ||
      (!msgType && typeof msg.latitude === 'number' && typeof msg.longitude === 'number');

    if (isLocation && typeof msg.latitude === 'number' && typeof msg.longitude === 'number') {
      return {
        type: 'location_update',
        payload: {
          latitude: msg.latitude,
          longitude: msg.longitude,
          timestamp: typeof msg.timestamp === 'string' ? msg.timestamp : new Date().toISOString(),
          walk_id: typeof msg.walk_id === 'number' ? msg.walk_id : undefined,
          is_recovered: typeof msg.is_recovered === 'boolean' ? msg.is_recovered : false,
        },
      };
    }

    return null;
  }

  private static readonly MAX_SPEED_MS = 5;
  private static readonly MAX_JUMP_M = 100;

  private validateLocation(
    point: LocationPayload,
    lastPoint: LocationPayload | null,
  ): boolean {
    if (!lastPoint) return true;

    const distance = getDistanceHaversine(
      { latitude: lastPoint.latitude, longitude: lastPoint.longitude },
      { latitude: point.latitude, longitude: point.longitude },
    );

    const dt = (
      new Date(point.timestamp).getTime()
      - new Date(lastPoint.timestamp).getTime()
    ) / 1000;

    if (dt <= 0) return false;
    if (distance / dt > WalkEventProcessor.MAX_SPEED_MS) return false;
    if (distance > WalkEventProcessor.MAX_JUMP_M) return false;

    return true;
  }

  /**
   * Resets the internal deduplication and timestamp tracking.
   */
  public reset() {
    this.processedEvents.clear();
    this.latestTimestamp = 0;
  }

  /**
   * Updates the tracking state based on the provided action.
   */
  public reduceState(state: WalkState, action: WalkAction): WalkState {
    switch (action.type) {
      case 'SNAPSHOT': {
        const rawPayload = action.payload as Record<string, unknown>;
        const activeWalk = rawPayload.active_walk as ActiveWalkData | undefined;
        const walkData = activeWalk || rawPayload as unknown as ActiveWalkData | undefined;
        
        if (!walkData || !walkData.id) {
          this.reset();
          return { isActive: false, currentLocation: null, routeHistory: [] };
        }

        const walkId = walkData.id;
        const history: LocationPayload[] = (walkData.history || [])
          .map((p: { latitude: number; longitude: number; timestamp: string; walk_id?: number; is_recovered?: boolean }): LocationPayload => ({
            latitude: p.latitude,
            longitude: p.longitude,
            timestamp: p.timestamp,
            walk_id: p.walk_id ?? walkId,
            is_recovered: p.is_recovered ?? false,
          }))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        let latestLoc: LocationPayload | null = null;
        if (history.length > 0) {
          latestLoc = history[history.length - 1];
          this.latestTimestamp = new Date(latestLoc.timestamp).getTime();
        } else if (walkData.latest_location) {
          latestLoc = {
            latitude: walkData.latest_location.latitude,
            longitude: walkData.latest_location.longitude,
            timestamp: walkData.latest_location.timestamp,
            walk_id: walkData.latest_location.walk_id ?? walkId,
            is_recovered: (walkData.latest_location as { is_recovered?: boolean }).is_recovered ?? false,
          };
          this.latestTimestamp = new Date(latestLoc.timestamp).getTime();
        }

        return {
          isActive: true,
          routeHistory: history,
          currentLocation: latestLoc
        };
      }

      case 'WALK_STARTED': {
        this.processedEvents.clear();
        this.latestTimestamp = action.timestamp;
        return {
          isActive: true,
          currentLocation: null,
          routeHistory: []
        };
      }

      case 'WALK_STOPPED': {
        this.latestTimestamp = 0;
        return {
          ...state,
          isActive: false,
          currentLocation: null
        };
      }

      case 'LOCATION_UPDATE': {
        const lastPoint = state.routeHistory.length > 0
          ? state.routeHistory[state.routeHistory.length - 1]
          : null;
        if (!this.validateLocation(action.payload, lastPoint)) return state;

        const nextHistory = appendLocation(state.routeHistory, action.payload);
        const latest = nextHistory[nextHistory.length - 1];

        // Ensure we don't overwrite with older data
        const latestTs = new Date(latest.timestamp).getTime();
        let nextCurrentLocation = state.currentLocation;
        
        if (latestTs >= this.latestTimestamp) {
          nextCurrentLocation = latest;
          this.latestTimestamp = latestTs;
        }

        return {
          ...state,
          isActive: true,
          routeHistory: nextHistory,
          currentLocation: nextCurrentLocation
        };
      }

      case 'BATCH_LOCATION_UPDATE': {
        const { locations, walk_id } = action.payload;
        if (!locations || locations.length === 0) return state;

        const validLocations = locations
          .map((loc) => ({
            latitude: loc.latitude,
            longitude: loc.longitude,
            timestamp: loc.timestamp,
            walk_id: loc.walk_id ?? walk_id,
            is_recovered: loc.is_recovered ?? false,
          }))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        let mergedHistory = [...state.routeHistory];
        let lastValid = mergedHistory.length > 0
          ? mergedHistory[mergedHistory.length - 1]
          : null;
        for (const loc of validLocations) {
          if (!this.validateLocation(loc, lastValid)) continue;
          mergedHistory = appendLocation(mergedHistory, loc);
          lastValid = mergedHistory[mergedHistory.length - 1];
        }

        const latestLoc = mergedHistory[mergedHistory.length - 1];
        const latestTs = new Date(latestLoc.timestamp).getTime();
        if (latestTs > this.latestTimestamp) {
          this.latestTimestamp = latestTs;
        }

        return {
          ...state,
          isActive: true,
          routeHistory: mergedHistory,
          currentLocation: latestLoc
        };
      }

      case 'RESET': {
        this.reset();
        return { isActive: false, currentLocation: null, routeHistory: [] };
      }

      default:
        return state;
    }
  }
}
