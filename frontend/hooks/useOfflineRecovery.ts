import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { locationService } from '../services/locationService';
import { LocationSync } from '../plugins/location-sync/src';

/**
 * useOfflineRecovery
 * Global hook to manage DOM event listeners for offline recovery.
 * Triggers queue synchronization when the app returns online or comes to the foreground.
 * On native (Capacitor), also marks foreground/background state on the LocationSync plugin
 * so that points collected while backgrounded are flagged as recovered.
 */
export function useOfflineRecovery() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      locationService.syncQueuedPoints();
    };

    const handleVisibilityChange = async () => {
      if (Capacitor.isNativePlatform()) {
        if (document.visibilityState === "visible") {
          await LocationSync.markForegrounded().catch(() => {});
          locationService.syncQueuedPoints();
        } else {
          await LocationSync.markBackgrounded().catch(() => {});
        }
      } else if (document.visibilityState === "visible") {
        locationService.syncQueuedPoints();
      }
    };

    const handleFocus = () => {
      locationService.syncQueuedPoints();
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
}
