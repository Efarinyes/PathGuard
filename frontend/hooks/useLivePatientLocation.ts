import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { useAppState } from './useAppState';
import { LocationPayload } from '../services/locationService';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export interface UseLivePatientLocationReturn {
  currentLocation: LocationPayload | null;
  routeHistory: LocationPayload[];
  isConnected: boolean;
  isLoading: boolean;
  isActive: boolean;
}

/**
 * A hook that manages the live state of a walk session.
 */
export function useLivePatientLocation(
  initialHistory: LocationPayload[] = []
): UseLivePatientLocationReturn {
  const { userToken, deviceToken, isHydrated: appIsHydrated } = useAppState();

  const [currentLocation, setCurrentLocation] = useState<LocationPayload | null>(null);
  const [routeHistory, setRouteHistory] = useState<LocationPayload[]>(initialHistory);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);

  // ⚡ Robust Deduplication & Ordering refs
  const processedEvents = useRef<Set<string>>(new Set());
  const latestTimestamp = useRef<number>(0);

  // 1. Snapshot Recovery: Fetch active walk state
  async function rehydrateState(isReconnect = false) {
    if (isLoading && isReconnect) return;

    if (!userToken && !deviceToken) {
      setIsLoading(false);
      setIsReady(true);
      return;
    }

    try {
      if (!isReconnect) setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/walks/active`, {
        headers: {
          'Content-Type': 'application/json',
          ...(userToken ? { 'Authorization': `Bearer ${userToken}` } : {}),
          ...(deviceToken ? { 'X-Patient-Token': deviceToken } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.active_walk) {
          const walk = data.active_walk;

          // Detect walk transition (important for multi-tab or reconnect)
          setIsActive(true);

          if (walk.latest_location) {
            setCurrentLocation(walk.latest_location);
            const ts = new Date(walk.latest_location.timestamp).getTime();
            if (ts > latestTimestamp.current) latestTimestamp.current = ts;
          }

          if (walk.history) {
            setRouteHistory((prevHistory) => {
              const existingTimestamps = new Set(prevHistory.map(p => p.timestamp));
              const newPoints = walk.history.filter((p: any) => !existingTimestamps.has(p.timestamp));

              const combined = [...prevHistory, ...newPoints];

              const sorted = combined.sort((a, b) =>
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );

              if (sorted.length > 0) {
                const lastTs = new Date(sorted[sorted.length - 1].timestamp).getTime();
                if (lastTs > latestTimestamp.current) latestTimestamp.current = lastTs;
              }

              return sorted;
            });
          }
        } else {
          setIsActive(false);
          setCurrentLocation(null);
          setRouteHistory([]);
          latestTimestamp.current = 0;
          processedEvents.current.clear();
        }
      }
    } catch (error) {
      console.error('[useLivePatientLocation] Recovery failed:', error);
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  }

  useEffect(() => {
    if (appIsHydrated) {
      rehydrateState();
    }
  }, [userToken, deviceToken, appIsHydrated]);

  // 2. Real-time Updates: Connect WS only after we have the REST snapshot
  const { lastMessage, isConnected } = useWebSocket<any>(isReady);

  // ⚡ Re-fetch on reconnect
  useEffect(() => {
    if (isConnected && isReady) {
      rehydrateState(true);
    }
  }, [isConnected]);

  // 3. Seamless Integration: Handle new messages with Deduplication & Ordering
  useEffect(() => {
    if (!lastMessage) return;

    // A. Event Deduplication (Strict UUID check)
    if (lastMessage.event_id) {
      if (processedEvents.current.has(lastMessage.event_id)) {
        return; // Already processed
      }
      processedEvents.current.add(lastMessage.event_id);

      // Keep memory usage low by capping the set
      if (processedEvents.current.size > 200) {
        const first = processedEvents.current.values().next().value;
        if (first) processedEvents.current.delete(first);
      }
    }

    // B. Chronological Ordering (Strict Timestamp check)
    const eventTime = lastMessage.timestamp ? new Date(lastMessage.timestamp).getTime() : 0;
    if (eventTime > 0 && eventTime < latestTimestamp.current) {
      console.debug('[WS] Ignoring out-of-order event:', lastMessage);
      return;
    }
    if (eventTime > 0) latestTimestamp.current = eventTime;

    // C. Event Dispatch
    if (lastMessage.type === 'walk_started') {
      setIsActive(true);
      setCurrentLocation(null);
      setRouteHistory([]);
      processedEvents.current.clear();
      latestTimestamp.current = eventTime;
      return;
    }

    if (lastMessage.type === 'walk_stopped') {
      setIsActive(false);
      setCurrentLocation(null);
      latestTimestamp.current = 0;
      return;
    }

    if (lastMessage.type === 'location' || !lastMessage.type) {
      if (typeof lastMessage.latitude !== 'number' || typeof lastMessage.longitude !== 'number') {
        return;
      }

      setIsActive(true);
      setCurrentLocation(lastMessage);
      setRouteHistory((prevHistory) => [...prevHistory, lastMessage]);
    }
  }, [lastMessage]);

  return {
    currentLocation,
    routeHistory,
    isConnected,
    isLoading,
    isActive
  };
}
