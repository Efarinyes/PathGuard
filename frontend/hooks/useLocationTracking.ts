"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Position {
  latitude: number;
  longitude: number;
}

export const useLocationTracking = (sampleIntervalMs: number = 7000) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const watchId = useRef<number | null>(null);
  const latestPositionRef = useRef<Position | null>(null);
  const intervalId = useRef<NodeJS.Timeout | null>(null);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    
    if (intervalId.current) {
      clearInterval(intervalId.current);
      intervalId.current = null;
    }

    latestPositionRef.current = null;
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    setError(null);
    setIsTracking(true);

    // 1. Start watching position (highly accurate updates from OS/GPS)
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        latestPositionRef.current = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        
        // Immediate first update if null
        if (!currentPosition && latestPositionRef.current) {
          setCurrentPosition(latestPositionRef.current);
        }
      },
      (err) => {
        setError(err.message);
        stopTracking();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // 2. Emit updates to the state every 5-10 seconds
    intervalId.current = setInterval(() => {
      if (latestPositionRef.current) {
        setCurrentPosition(latestPositionRef.current);
      }
    }, sampleIntervalMs);
  }, [currentPosition, sampleIntervalMs, stopTracking]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (intervalId.current) clearInterval(intervalId.current);
    };
  }, []);

  return {
    isTracking,
    currentPosition,
    error,
    startTracking,
    stopTracking,
  };
};
