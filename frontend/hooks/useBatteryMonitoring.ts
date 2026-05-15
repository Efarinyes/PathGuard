import { useEffect, useRef } from 'react';

/**
 * useBatteryMonitoring
 * Monitors the device battery level and charging state.
 * Triggers onStatusUpdate only when significant changes occur or after a timeout.
 * 
 * @param onStatusUpdate Callback when status should be reported
 * @param enabled Whether monitoring is active
 */
export function useBatteryMonitoring(
  onStatusUpdate: (level: number, isCharging: boolean) => void,
  enabled: boolean = true
) {
  const lastUpdateRef = useRef<{ level: number; time: number; isCharging: boolean } | null>(null);
  const UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const SIGNIFICANT_CHANGE = 1; // 1% (percentage points)

  useEffect(() => {
    if (!enabled) return;

    let battery: any = null;

    const checkAndNotify = (level: number, isCharging: boolean) => {
      const now = Date.now();
      const lastUpdate = lastUpdateRef.current;

      const levelDiff = lastUpdate ? Math.abs(lastUpdate.level - level) : 100;
      const timeDiff = lastUpdate ? now - lastUpdate.time : UPDATE_INTERVAL_MS;
      const chargingChanged = lastUpdate ? lastUpdate.isCharging !== isCharging : true;

      const shouldUpdate = 
        !lastUpdate || 
        levelDiff >= SIGNIFICANT_CHANGE || 
        timeDiff >= UPDATE_INTERVAL_MS ||
        chargingChanged;

      if (shouldUpdate) {
        onStatusUpdate(level, isCharging);
        lastUpdateRef.current = { level, time: now, isCharging };
      }
    };

    const handleBatteryChange = () => {
      if (battery) {
        const level = Math.round(battery.level * 100);
        const isCharging = battery.charging;
        checkAndNotify(level, isCharging);
      }
    };

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any).getBattery().then((res: any) => {
        battery = res;
        // Initial report with a tiny delay to ensure WS is ready
        setTimeout(handleBatteryChange, 500);
        
        battery.addEventListener('levelchange', handleBatteryChange);
        battery.addEventListener('chargingchange', handleBatteryChange);
      });
    } else {
      console.warn('[Battery] Battery Status API is not supported in this browser.');
      // Notify once that it's not supported using a special value (-1)
      onStatusUpdate(-1, false);
    }

    // Periodic check to enforce the 5-minute interval even if level doesn't change
    const interval = setInterval(() => {
      if (battery) {
        handleBatteryChange();
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', handleBatteryChange);
        battery.removeEventListener('chargingchange', handleBatteryChange);
      }
      clearInterval(interval);
    };
  }, [enabled, onStatusUpdate]);
}
