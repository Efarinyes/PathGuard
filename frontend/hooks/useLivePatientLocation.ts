import { useState, useEffect } from 'react';
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
        if (data.active_walk_id) {
          setIsActive(true);
          if (data.latest_location) setCurrentLocation(data.latest_location);
          if (data.history) {
            setRouteHistory((prevHistory) => {
              const existingTimestamps = new Set(prevHistory.map(p => p.timestamp));
              const newPoints = data.history.filter((p: any) => !existingTimestamps.has(p.timestamp));
              return [...prevHistory, ...newPoints].sort((a, b) => 
                new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              );
            });
          }
        } else {
          setIsActive(false);
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
  
  // 3. Seamless Integration: Handle new messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'walk_started') {
      setIsActive(true);
      setCurrentLocation(null);
      setRouteHistory([]);
      return;
    }

    if (lastMessage.type === 'walk_stopped') {
      setIsActive(false);
      setCurrentLocation(null);
      return;
    }

    if (lastMessage.type === 'location' || !lastMessage.type) {
      if (typeof lastMessage.latitude !== 'number' || typeof lastMessage.longitude !== 'number') {
        console.warn('[useLivePatientLocation] Received malformed location message:', lastMessage);
        return;
      }

      setIsActive(true);
      setCurrentLocation((prevCurrent) => {
        const isNewer = !prevCurrent || new Date(lastMessage.timestamp) > new Date(prevCurrent.timestamp);
        if (isNewer) {
          setRouteHistory((prevHistory) => [...prevHistory, lastMessage]);
          return lastMessage;
        }
        return prevCurrent;
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
