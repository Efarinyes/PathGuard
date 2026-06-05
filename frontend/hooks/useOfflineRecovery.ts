import { useEffect } from 'react';
import { locationService } from '../services/locationService';

export function useOfflineRecovery() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      locationService.syncQueuedPoints();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
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
