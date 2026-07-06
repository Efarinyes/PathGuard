import { useState, useRef, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import LocationSync from "@/plugins/location-sync/src";
import { getDistanceHaversine, estimateSpeed, Position } from "../lib/gpsUtils";
import { GPS_MIN_DISTANCE_M, GPS_SPEED_IDLE_THRESHOLD_M_MIN, GPS_INTERVAL_IDLE_MS, GPS_INTERVAL_NORMAL_MS, GPS_INTERVAL_FAST_MS, GPS_TIMEOUT_MS, GPS_RETRY_DELAY_MS, API_BASE_URL } from "@/lib/config";

const isNative = Capacitor.isNativePlatform();

export const useLocationTracking = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTrackingRef = useRef(false);
  const watchId = useRef<string | number | null>(null);
  const latestPositionRef = useRef<Position | null>(null);
  const lastSentPositionRef = useRef<Position | null>(null);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const lastSampleTime = useRef<number>(Date.now());

  const stopTracking = useCallback(async () => {
    setIsTracking(false);
    isTrackingRef.current = false;

    if (isNative) {
      try {
        await LocationSync.stopTracking();
      } catch {
        // Plugin pot no estar iniciat — ignorar
      }
      watchId.current = null;
    } else if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current as number);
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
      } else if (speed > 100) {
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

    if (lastSentPositionRef.current) {
      const distance = getDistanceHaversine(lastSentPositionRef.current, current);
      if (distance < GPS_MIN_DISTANCE_M) {
        scheduleNextSample();
        return;
      }
    }

    setCurrentPosition(current);
    lastSentPositionRef.current = current;
    scheduleNextSample();
  }, [scheduleNextSample]);

  const onPositionUpdate = useCallback((lat: number, lng: number) => {
    latestPositionRef.current = { latitude: lat, longitude: lng };
    if (!lastSentPositionRef.current) {
      processLocation();
    }
  }, [processLocation]);

  const startTracking = useCallback(async (trackingConfig?: { deviceToken: string; walkId: number }) => {
    setError(null);

    if (isNative) {
      if (!trackingConfig) {
        setError("Falten paràmetres de tracking (deviceToken, walkId) en mode nadiu.");
        return;
      }
      try {
        await LocationSync.startTracking({
          serverUrl: API_BASE_URL,
          deviceToken: trackingConfig.deviceToken,
          walkId: trackingConfig.walkId,
        });
        watchId.current = "location-sync";
        setIsTracking(true);
        isTrackingRef.current = true;
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconegut";
        setError(`Error al iniciar el servei de localització nadiu: ${message}`);
        return;
      }
    }

    if (!navigator.geolocation) {
      setError("GPS no disponible en aquest navegador.");
      return;
    }

    setIsTracking(true);
    isTrackingRef.current = true;
    lastSampleTime.current = Date.now();

    const browserId = navigator.geolocation.watchPosition(
      (pos) => {
        onPositionUpdate(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setError(`GPS Error: ${err.message}`);
        if (watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current as number);
          watchId.current = null;
        }
        setTimeout(() => {
          if (isTrackingRef.current) startTracking();
        }, GPS_RETRY_DELAY_MS);
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS }
    );
    watchId.current = browserId;

    scheduleNextSample();
  }, [onPositionUpdate]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && isTrackingRef.current) {
        processLocation();
        if (watchId.current === null) {
          startTracking();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [processLocation, startTracking]);

  useEffect(() => {
    return () => { stopTracking(); };
  }, [stopTracking]);

  return { isTracking, currentPosition, error, startTracking, stopTracking };
};
