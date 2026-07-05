import { registerPlugin, Plugin, PluginListenerHandle } from '@capacitor/core';

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

export interface NetworkStatus {
  connected: boolean;
}

export interface LocationSyncPlugin extends Plugin {
  startTracking(options: StartTrackingOptions): Promise<void>;
  stopTracking(): Promise<void>;
  updateWalkId(options: { walkId: number }): Promise<void>;
  getStatus(): Promise<TrackingStatus>;
  markBackgrounded(): Promise<void>;
  markForegrounded(): Promise<void>;
  getNetworkStatus(): Promise<NetworkStatus>;
  addListener(
    eventName: 'networkStatusChange',
    listenerFunc: (status: NetworkStatus) => void
  ): Promise<PluginListenerHandle>;
}

const LocationSync = registerPlugin<LocationSyncPlugin>('LocationSync');

export default LocationSync;
export { LocationSync };
