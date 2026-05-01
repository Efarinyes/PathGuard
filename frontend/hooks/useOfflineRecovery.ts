import { useEffect } from 'react';
import { locationService } from '../services/locationService';

/**
 * useOfflineRecovery
 * Global hook to manage DOM event listeners for offline recovery.
 * Triggers queue synchronization when the app returns online or comes to the foreground.
 */
export function useOfflineRecovery() {
  useEffect(() => {
    // Check if we are in the browser
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log("[useOfflineRecovery] Network online, triggering sync.");
      locationService.syncQueuedPoints();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[useOfflineRecovery] App foregrounded, triggering sync.");
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
