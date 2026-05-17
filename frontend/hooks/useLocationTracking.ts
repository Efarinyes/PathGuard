import { useState, useRef, useCallback, useEffect } from "react";
import { getDistanceHaversine, estimateSpeed, Position } from "../lib/gpsUtils";
import { GPS_MIN_DISTANCE_M, GPS_SPEED_IDLE_THRESHOLD_M_MIN, GPS_INTERVAL_IDLE_MS, GPS_INTERVAL_NORMAL_MS, GPS_INTERVAL_FAST_MS, GPS_TIMEOUT_MS, GPS_RETRY_DELAY_MS } from "@/lib/config";

export const useLocationTracking = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTrackingRef = useRef(false);
  const watchId = useRef<number | null>(null);
  const latestPositionRef = useRef<Position | null>(null);
  const lastSentPositionRef = useRef<Position | null>(null);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const lastSampleTime = useRef<number>(Date.now());

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    isTrackingRef.current = false;
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
    latestPositionRef.current = null;
    lastSentPositionRef.current = null;
  }, []);

  const scheduleNextSample = useCallback(() => {
    if (!isTrackingRef.current) return;

    const now = Date.now();
    const timeDelta = now - lastSampleTime.current;
    let nextInterval = GPS_INTERVAL_NORMAL_MS;

    if (latestPositionRef.current && lastSentPositionRef.current) {
      const speed = estimateSpeed(lastSentPositionRef.current, latestPositionRef.current, timeDelta);

      if (speed < GPS_SPEED_IDLE_THRESHOLD_M_MIN) {
        nextInterval = GPS_INTERVAL_IDLE_MS;
      } else if (speed > 100) { // Fast movement (>100m/min ~ 6km/h)
        nextInterval = GPS_INTERVAL_FAST_MS;
      }
    }

    timeoutId.current = setTimeout(() => {
      if (isTrackingRef.current) processLocation();
    }, nextInterval);
  }, []);

  const processLocation = useCallback(() => {
    if (!isTrackingRef.current) return;

    if (!latestPositionRef.current) {
      scheduleNextSample();
      return;
    }

    const current = latestPositionRef.current;
    lastSampleTime.current = Date.now();

    // ⚡ Haversine Filtering (Redundancy suppression)
    if (lastSentPositionRef.current) {
      const distance = getDistanceHaversine(lastSentPositionRef.current, current);
      if (distance < GPS_MIN_DISTANCE_M) {
        // Suppress update but keep tracking local state
        scheduleNextSample();
        return;
      }
    }

    // Update state & reference
    setCurrentPosition(current);
    lastSentPositionRef.current = current;
    scheduleNextSample();
  }, [scheduleNextSample]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported.");
      return;
    }

    setError(null);
    setIsTracking(true);
    isTrackingRef.current = true;
    lastSampleTime.current = Date.now();

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        console.log(`[GEO] watchPosition fired: ${position.coords.latitude}, ${position.coords.longitude}`);
        latestPositionRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        // Initial point
        if (!lastSentPositionRef.current) {
          console.log('[GEO] Processing initial point');
          processLocation();
        }
      },
      (err) => {
        console.error(`[GEO] watchPosition error: ${err.message}. Retrying in 5s...`);
        setError(`GPS Error: ${err.message}`);
        
        // Don't kill tracking on transient errors (e.g. timeout, signal loss)
        // Only stop on permanent failures if desired, but for PWA we retry
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
        setTimeout(() => {
          if (isTrackingRef.current) startTracking();
        }, GPS_RETRY_DELAY_MS);
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 }
    );

    // Initial processing cycle
    scheduleNextSample();
  }, [processLocation, stopTracking]);

  // Handle app foregrounding: ensure tracking is still alive
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isTrackingRef.current) {
        console.log("[GEO] App returned to foreground, verifying tracking state...");
        // Re-sync the processing cycle in case timeout was suspended
        processLocation();
        
        // If watchId was somehow lost, restart it
        if (watchId.current === null) {
          startTracking();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [processLocation, startTracking]);

  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);


  return { isTracking, currentPosition, error, startTracking, stopTracking };
};
