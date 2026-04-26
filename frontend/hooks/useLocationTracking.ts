import { useState, useRef, useCallback, useEffect } from "react";
import { getDistanceHaversine, estimateSpeed, Position } from "../lib/gpsUtils";

// Constants for Adaptive Sampling & Filtering
const MIN_DISTANCE_M = 8;        // Don't send if moved < 8m
const SPEED_IDLE_M_MIN = 5;     // < 5m/min is idle
const INTERVAL_IDLE_MS = 15000; // 15s when idle
const INTERVAL_NORMAL_MS = 5000; // 5s when walking
const INTERVAL_FAST_MS = 2000;   // 2s when running

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
    let nextInterval = INTERVAL_NORMAL_MS;

    if (latestPositionRef.current && lastSentPositionRef.current) {
      const speed = estimateSpeed(lastSentPositionRef.current, latestPositionRef.current, timeDelta);

      if (speed < SPEED_IDLE_M_MIN) {
        nextInterval = INTERVAL_IDLE_MS;
      } else if (speed > 100) { // Fast movement (>100m/min ~ 6km/h)
        nextInterval = INTERVAL_FAST_MS;
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
      if (distance < MIN_DISTANCE_M) {
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
        latestPositionRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        // Initial point
        if (!lastSentPositionRef.current) {
          processLocation();
        }
      },
      (err) => {
        setError(err.message);
        stopTracking();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Initial processing cycle
    scheduleNextSample();
  }, [processLocation, stopTracking]);

  useEffect(() => {
    return () => stopTracking();
  }, [stopTracking]);

  return { isTracking, currentPosition, error, startTracking, stopTracking };
};
