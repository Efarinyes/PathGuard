import { useState, useEffect, useRef, useReducer } from 'react';
import { useWebSocket } from './useWebSocket';
import { useAppState } from './useAppState';
import { LocationPayload } from '../services/locationService';
import { walkService } from '../services/walkService';
import { WalkEventProcessor, WalkState, WalkAction } from '../lib/WalkEventProcessor';

export interface UseLivePatientLocationReturn extends WalkState {
  isConnected: boolean;
  isPatientConnected: boolean;
  hasReceivedStatus: boolean;
  isLoading: boolean;
  watchersCount: number;
  latestSosData: { patient_id: number; walk_id: number | null; sos_count: number; timestamp: string } | null;
}

export function useLivePatientLocation(
  initialHistory: LocationPayload[] = [],
  onSOSAlert?: (data: { patient_id: number; walk_id: number | null; sos_count: number; timestamp: string }) => void
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

  const [isPatientConnected, setIsPatientConnected] = useState(false);
  const [watchersCount, setWatchersCount] = useState(0);
  const [latestSosData, setLatestSosData] = useState<{ patient_id: number; walk_id: number | null; sos_count: number; timestamp: string } | null>(null);
  const lastProcessedSosCount = useRef<number>(0);
  const hasReceivedStatus = useRef(false);

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
    } catch {
      // Silently ignore rehydration errors — WS events will provide definitive state
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
        rehydrateState(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [appIsHydrated, userToken, deviceToken]);

  // 2. Real-time Updates: Connect WS only after we have the REST snapshot
  const wsUrlParams = userToken ? `?token=${userToken}` : deviceToken ? `?patient_token=${deviceToken}` : '';
  const { lastMessage, isConnected } = useWebSocket<unknown>(isReady, wsUrlParams);

  // 3. Seamless Integration: Handle new messages via Processor
  useEffect(() => {
    if (!lastMessage || !processor.current.shouldProcessMessage(lastMessage)) {
      return;
    }

    const classified = processor.current.classifyEvent(lastMessage);
    if (!classified) {
      return;
    }

    switch (classified.type) {
      case 'snapshot': {
        dispatch({ type: 'SNAPSHOT', payload: classified.payload });
        if (typeof classified.payload.watchers_count === 'number') {
          setWatchersCount(classified.payload.watchers_count);
        }
        if (typeof classified.payload.patient_status === 'string') {
          setIsPatientConnected(classified.payload.patient_status === 'online');
          hasReceivedStatus.current = true;
        }
        break;
      }

      case 'walk_started': {
        dispatch({ type: 'WALK_STARTED', timestamp: classified.timestamp });
        break;
      }

      case 'walk_stopped': {
        dispatch({ type: 'WALK_STOPPED' });
        break;
      }

      case 'patient_online': {
        setIsPatientConnected(true);
        hasReceivedStatus.current = true;
        break;
      }

      case 'patient_offline': {
        setIsPatientConnected(false);
        hasReceivedStatus.current = true;
        break;
      }

      case 'watchers_update': {
        setWatchersCount(classified.count);
        break;
      }

      case 'sos_alert': {
        if (classified.sos_count > lastProcessedSosCount.current) {
          lastProcessedSosCount.current = classified.sos_count;
          setLatestSosData({
            patient_id: classified.patient_id,
            walk_id: classified.walk_id,
            sos_count: classified.sos_count,
            timestamp: classified.timestamp,
          });
          onSOSAlert?.(classified);
        }
        break;
      }

      case 'location_update': {
        dispatch({ type: 'LOCATION_UPDATE', payload: classified.payload });
        break;
      }

      default: {
        // Exhaustiveness check — TypeScript ensures all cases are handled
        const _exhaustive: never = classified;
        void _exhaustive;
      }
    }
  }, [lastMessage, onSOSAlert]);

  return {
    ...walkState,
    isConnected,
    isPatientConnected,
    hasReceivedStatus: hasReceivedStatus.current,
    isLoading,
    watchersCount,
    latestSosData,
  };
}
