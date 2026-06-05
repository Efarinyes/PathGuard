import { registerPlugin } from '@capacitor/core';

export interface StartTrackingOptions {
  serverUrl: string;
  deviceToken: string;
  walkId: number;
}

export interface TrackingStatus {
  isTracking: boolean;
  pointsSent: number;
  lastSentAt: string | null;
}

export interface LocationSyncPlugin {
  startTracking(options: StartTrackingOptions): Promise<void>;
  stopTracking(): Promise<void>;
  updateWalkId(options: { walkId: number }): Promise<void>;
  getStatus(): Promise<TrackingStatus>;
  markBackgrounded(): Promise<void>;
  markForegrounded(): Promise<void>;
}

const LocationSync = registerPlugin<LocationSyncPlugin>('LocationSync');

export default LocationSync;
export { LocationSync };
