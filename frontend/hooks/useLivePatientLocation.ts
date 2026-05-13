import { useState, useEffect, useRef, useReducer } from 'react';
import { useWebSocket } from './useWebSocket';
import { useAppState } from './useAppState';
import { LocationPayload } from '../services/locationService';
import { walkService } from '../services/walkService';
import { WalkEventProcessor, WalkState, WalkAction } from '../lib/WalkEventProcessor';

export interface UseLivePatientLocationReturn extends WalkState {
  isConnected: boolean;
  isPatientConnected: boolean;
  isLoading: boolean;
  watchersCount: number;
}

export function useLivePatientLocation(
  initialHistory: LocationPayload[] = []
): UseLivePatientLocationReturn {
  const { userToken, deviceToken, isHydrated: appIsHydrated } = useAppState();

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize the event processor
  const processor = useRef(new WalkEventProcessor());

  // Core state managed by reducer
  const [walkState, dispatch] = useReducer(
    (state: WalkState, action: WalkAction) => processor.current.reduceState(state, action),
    { currentLocation: null, routeHistory: initialHistory, isActive: false }
  );

  const [isPatientConnected, setIsPatientConnected] = useState(true);
  const [watchersCount, setWatchersCount] = useState(0);

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

      const snapshot = await walkService.getActiveWalk(userToken, deviceToken);
      if (snapshot) {
        dispatch({
          type: 'SNAPSHOT',
          payload: {
            active_walk: {
              ...snapshot,
              latest_location: snapshot.latest_location || undefined,
            },
          },
        });
      }
      // On rehydration, we assume patient might be connected if walk is active, 
      // but the WS events will provide the definitive state.
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

  // Handle app foregrounding for the caregiver (recovery after inactivity)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && appIsHydrated && (userToken || deviceToken)) {
        console.log("[useLivePatientLocation] App returned to foreground, re-syncing state...");
        rehydrateState(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [appIsHydrated, userToken, deviceToken]);

  // 2. Real-time Updates: Connect WS only after we have the REST snapshot
  const wsUrlParams = userToken ? `?token=${userToken}` : deviceToken ? `?patient_token=${deviceToken}` : '';
  const { lastMessage, isConnected } = useWebSocket<any>(isReady, wsUrlParams);



  // 3. Seamless Integration: Handle new messages via Processor
  useEffect(() => {
    if (!processor.current.shouldProcessMessage(lastMessage)) {
      return;
    }

    const eventTime = lastMessage.timestamp ? new Date(lastMessage.timestamp).getTime() : 0;

    if (lastMessage.type === 'snapshot') {
      dispatch({ type: 'SNAPSHOT', payload: lastMessage });
      if (typeof lastMessage.watchers_count === 'number') {
        console.debug(`[WS] Watchers from snapshot: ${lastMessage.watchers_count}`);
        setWatchersCount(lastMessage.watchers_count);
      }
    } else if (lastMessage.type === 'walk_started') {
      dispatch({ type: 'WALK_STARTED', timestamp: eventTime });
    } else if (lastMessage.type === 'walk_stopped') {
      dispatch({ type: 'WALK_STOPPED' });
    } else if (lastMessage.type === 'patient_online') {
      setIsPatientConnected(true);
    } else if (lastMessage.type === 'patient_offline') {
      setIsPatientConnected(false);
    } else if (lastMessage.type === 'watchers_update') {
      console.debug(`[WS] Watchers update: ${lastMessage.count}`);
      setWatchersCount(lastMessage.count || 0);
    } else {
      const isLocation = lastMessage.type === 'location' || 
                         (!lastMessage.type && lastMessage.latitude != null && lastMessage.longitude != null);

      if (isLocation && typeof lastMessage.latitude === 'number' && typeof lastMessage.longitude === 'number') {
        const normalized: LocationPayload = {
          latitude: lastMessage.latitude,
          longitude: lastMessage.longitude,
          timestamp: lastMessage.timestamp,
          ...(lastMessage.walk_id !== undefined ? { walk_id: lastMessage.walk_id } : {}),
        };
        dispatch({ type: 'LOCATION_UPDATE', payload: normalized });
      }
    }
  }, [lastMessage]);

  return {
    ...walkState,
    isConnected,
    isPatientConnected,
    isLoading,
    watchersCount
  };
}
