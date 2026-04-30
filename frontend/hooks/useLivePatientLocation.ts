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
 * Helper to safely append a location point to a history array.
 * Ensures immutability, deduplication by timestamp, and chronological sorting.
 */
const appendLocation = (history: LocationPayload[], newPoint: LocationPayload): LocationPayload[] => {
  if (history.some((p) => p.timestamp === newPoint.timestamp)) return history;

  return [...history, newPoint].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );
};

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

  // Helper to apply a full state snapshot (Atomic Join Consistency)
  const applySnapshot = (walk: any) => {
    const walkData = (walk && 'active_walk' in walk) ? walk.active_walk : walk;
    const walkId = walkData?.id ?? walkData?.active_walk_id;
    
    if (!walkData || walkId === undefined || walkId === null) {
      setIsActive(false);
      setCurrentLocation(null);
      setRouteHistory([]);
      latestTimestamp.current = 0;
      processedEvents.current.clear();
      return;
    }

    setIsActive(true);

    // Normalize and sort history
    const history = (walkData.history || [])
      .map((p: any) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: p.timestamp,
        ...(p.walk_id !== undefined ? { walk_id: p.walk_id } : { walk_id: walkId }),
      }))
      .sort((a: any, b: any) => a.timestamp.localeCompare(b.timestamp));

    setRouteHistory(history);

    // Set currentLocation = last element
    if (history.length > 0) {
      const latest = history[history.length - 1];
      setCurrentLocation(latest);
      latestTimestamp.current = new Date(latest.timestamp).getTime();
    } else if (walkData.latest_location) {
      const normalized = {
        latitude: walkData.latest_location.latitude,
        longitude: walkData.latest_location.longitude,
        timestamp: walkData.latest_location.timestamp,
        ...(walkData.latest_location.walk_id !== undefined ? { walk_id: walkData.latest_location.walk_id } : { walk_id: walkId }),
      };
      setCurrentLocation(normalized);
      latestTimestamp.current = new Date(normalized.timestamp).getTime();
    }
  };

  // 1. Snapshot Recovery: Fetch active walk state (REST Initial Load)
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

      if (response?.ok) {
        const data = await response.json();
        applySnapshot(data);
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
  const wsUrlParams = userToken ? `?token=${userToken}` : deviceToken ? `?patient_token=${deviceToken}` : '';
  const { lastMessage, isConnected } = useWebSocket<any>(isReady, wsUrlParams);

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
    if (lastMessage.type === 'snapshot') {
      applySnapshot(lastMessage);
      return;
    }

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

    const isLocation = lastMessage.type === 'location' || 
                       (!lastMessage.type && lastMessage.latitude != null && lastMessage.longitude != null);

    if (isLocation) {
      if (typeof lastMessage.latitude !== 'number' || typeof lastMessage.longitude !== 'number') {
        return;
      }

      const normalized: LocationPayload = {
        latitude: lastMessage.latitude,
        longitude: lastMessage.longitude,
        timestamp: lastMessage.timestamp,
        ...(lastMessage.walk_id !== undefined ? { walk_id: lastMessage.walk_id } : {}),
      };

      setIsActive(true);
      setRouteHistory((prevHistory) => {
        const next = appendLocation(prevHistory, normalized);
        const latest = next[next.length - 1];

        // Ensure we don't overwrite with older data
        const latestTs = new Date(latest.timestamp).getTime();
        if (latestTs >= latestTimestamp.current) {
          setCurrentLocation(latest);
          latestTimestamp.current = latestTs;
        }
        return next;
      });
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
