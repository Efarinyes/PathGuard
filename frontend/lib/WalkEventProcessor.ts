import { LocationPayload } from '../services/locationService';

export interface WalkState {
  currentLocation: LocationPayload | null;
  routeHistory: LocationPayload[];
  isActive: boolean;
}

export interface BatchLocationUpdatePayload {
  locations: LocationPayload[];
  walk_id: number;
}

export interface WalkSnapshotMessage {
  type: 'snapshot';
  timestamp?: string;
  event_id?: string;
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

export type WalkMessage = WalkSnapshotMessage | WalkLocationMessage | WalkEventMessage;

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
  public shouldProcessMessage(message: WalkMessage | null): boolean {
    if (!message) return false;

    // A. Event Deduplication (Strict UUID check)
    if (message.event_id) {
      if (this.processedEvents.has(message.event_id)) {
        return false;
      }
      this.processedEvents.add(message.event_id);

      // Keep memory usage low by capping the set
      if (this.processedEvents.size > 200) {
        const first = this.processedEvents.values().next().value;
        if (first) this.processedEvents.delete(first);
      }
    }

    // B. Chronological Ordering (Strict Timestamp check)
    const eventTime = message.timestamp ? new Date(message.timestamp).getTime() : 0;
    if (eventTime > 0 && eventTime < this.latestTimestamp) {
      console.debug('[WalkEventProcessor] Ignoring out-of-order event:', message);
      return false;
    }
    if (eventTime > 0) this.latestTimestamp = eventTime;

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
          .map((p: { latitude: number; longitude: number; timestamp: string; walk_id?: number }): LocationPayload => ({
            latitude: p.latitude,
            longitude: p.longitude,
            timestamp: p.timestamp,
            walk_id: p.walk_id ?? walkId,
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
          }))
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        let mergedHistory = [...state.routeHistory];
        for (const loc of validLocations) {
          mergedHistory = appendLocation(mergedHistory, loc);
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
