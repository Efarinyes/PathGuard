import { LocationPayload } from '../services/locationService';

export interface ResetableProcessor {
  reset(): void;
  shouldProcessMessage(message: unknown): boolean;
}

export interface WalkState {
  currentLocation: LocationPayload | null;
  routeHistory: LocationPayload[];
  isActive: boolean;
}

export interface ConnectionEventCallbacks {
  onSnapshot?: (payload: unknown) => void;
  onWalkStarted?: (timestamp: number) => void;
  onWalkStopped?: () => void;
  onLocationUpdate?: (location: LocationPayload) => void;
  onPatientOnline?: () => void;
  onPatientOffline?: () => void;
  onWatchersUpdate?: (count: number) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export interface CaregiverConnectionManagerReturn {
  dispatch: (action: unknown) => void;
  resetProcessor: () => void;
  lastMessage: unknown;
  isConnected: boolean;
}

export class CaregiverConnectionManager {
  private processor: ResetableProcessor;
  private state: {
    currentLocation: LocationPayload | null;
    routeHistory: LocationPayload[];
    isActive: boolean;
  };
  private callbacks: ConnectionEventCallbacks;
  private dispatchCallback: (state: typeof this.state) => void;

  constructor(
    processor: ResetableProcessor,
    callbacks: ConnectionEventCallbacks,
    dispatchCallback: (state: typeof this.state) => void
  ) {
    this.processor = processor;
    this.callbacks = callbacks;
    this.dispatchCallback = dispatchCallback;
    this.state = {
      currentLocation: null,
      routeHistory: [],
      isActive: false,
    };
  }

  public resetProcessor(): void {
    this.processor.reset();
    this.state = {
      currentLocation: null,
      routeHistory: [],
      isActive: false,
    };
    this.dispatchCallback(this.state);
  }

  public handleMessage(message: unknown): void {
    if (!this.processor.shouldProcessMessage(message)) {
      return;
    }

    const msg = message as Record<string, unknown>;

    if (msg.type === 'snapshot') {
      this.handleSnapshot(msg);
    } else if (msg.type === 'walk_started') {
      this.handleWalkStarted(msg);
    } else if (msg.type === 'walk_stopped') {
      this.handleWalkStopped();
    } else if (msg.type === 'patient_online') {
      this.callbacks.onPatientOnline?.();
    } else if (msg.type === 'patient_offline') {
      this.callbacks.onPatientOffline?.();
    } else if (msg.type === 'watchers_update') {
      this.callbacks.onWatchersUpdate?.(msg.count as number);
    } else {
      this.handleLocation(msg);
    }
  }

  private handleSnapshot(msg: Record<string, unknown>): void {
    const activeWalk = msg.active_walk as {
      id: number;
      history?: Array<{
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
    } | undefined;

    if (!activeWalk?.id) {
      this.resetProcessor();
      return;
    }

    const walkId = activeWalk.id;
    const history: LocationPayload[] = (activeWalk.history || [])
      .map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: p.timestamp,
        walk_id: p.walk_id ?? walkId,
      }))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    let latestLoc: LocationPayload | null = null;
    if (history.length > 0) {
      latestLoc = history[history.length - 1];
    } else if (activeWalk.latest_location) {
      latestLoc = {
        latitude: activeWalk.latest_location.latitude,
        longitude: activeWalk.latest_location.longitude,
        timestamp: activeWalk.latest_location.timestamp,
        walk_id: activeWalk.latest_location.walk_id ?? walkId,
      };
    }

    this.state = {
      isActive: true,
      routeHistory: history,
      currentLocation: latestLoc,
    };

    this.dispatchCallback(this.state);
    this.callbacks.onSnapshot?.(msg);
  }

  private handleWalkStarted(msg: Record<string, unknown>): void {
    const timestamp = msg.timestamp
      ? new Date(msg.timestamp as string).getTime()
      : Date.now();

    this.processor.reset();

    this.state = {
      isActive: true,
      currentLocation: null,
      routeHistory: [],
    };

    this.dispatchCallback(this.state);
    this.callbacks.onWalkStarted?.(timestamp);
  }

  private handleWalkStopped(): void {
    this.state = {
      ...this.state,
      isActive: false,
      currentLocation: null,
    };

    this.dispatchCallback(this.state);
    this.callbacks.onWalkStopped?.();
  }

  private handleLocation(msg: Record<string, unknown>): void {
    const isLocation =
      msg.type === 'location' ||
      (!msg.type && msg.latitude != null && msg.longitude != null);

    if (
      !isLocation ||
      typeof msg.latitude !== 'number' ||
      typeof msg.longitude !== 'number'
    ) {
      return;
    }

    const newPoint: LocationPayload = {
      latitude: msg.latitude,
      longitude: msg.longitude,
      timestamp: msg.timestamp as string,
      walk_id: msg.walk_id as number,
    };

    const nextHistory = [...this.state.routeHistory];
    if (!nextHistory.some((p) => p.timestamp === newPoint.timestamp)) {
      nextHistory.push(newPoint);
      nextHistory.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    }

    this.state = {
      ...this.state,
      isActive: true,
      routeHistory: nextHistory,
      currentLocation: newPoint,
    };

    this.dispatchCallback(this.state);
    this.callbacks.onLocationUpdate?.(newPoint);
  }
}