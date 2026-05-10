import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import { useAppState } from './useAppState';
import { LocationPayload } from '../services/locationService';
import { walkService } from '../services/walkService';
import { WalkEventProcessor } from '../lib/WalkEventProcessor';
import { CaregiverConnectionManager, ConnectionEventCallbacks } from '../lib/CaregiverConnectionManager';

export interface UseLivePatientLocationReturn {
  currentLocation: LocationPayload | null;
  routeHistory: LocationPayload[];
  isActive: boolean;
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
  const [isPatientConnected, setIsPatientConnected] = useState(true);
  const [watchersCount, setWatchersCount] = useState(0);

  const connectionManagerRef = useRef<CaregiverConnectionManager | null>(null);
  const stateRef = useRef<{
    currentLocation: LocationPayload | null;
    routeHistory: LocationPayload[];
    isActive: boolean;
  }>({
    currentLocation: null,
    routeHistory: initialHistory,
    isActive: false,
  });

  const [, forceUpdate] = useState({});

  const dispatchState = useCallback((newState: typeof stateRef.current) => {
    stateRef.current = newState;
    forceUpdate({});
  }, []);

  const handleSnapshot = useCallback((payload: unknown) => {
    console.log('[useLivePatientLocation] Snapshot received');
  }, []);

  const handleWalkStarted = useCallback((timestamp: number) => {
    console.log('[useLivePatientLocation] Walk started');
  }, []);

  const handleWalkStopped = useCallback(() => {
    console.log('[useLivePatientLocation] Walk stopped');
  }, []);

  const handleLocationUpdate = useCallback((location: LocationPayload) => {
    console.log('[useLivePatientLocation] Location update');
  }, []);

  const handlePatientOnline = useCallback(() => {
    setIsPatientConnected(true);
  }, []);

  const handlePatientOffline = useCallback(() => {
    setIsPatientConnected(false);
  }, []);

  const handleWatchersUpdate = useCallback((count: number) => {
    setWatchersCount(count);
  }, []);

  const handleConnectionChange = useCallback((connected: boolean) => {
    console.log('[useLivePatientLocation] Connection changed:', connected);
  }, []);

  const callbacks: ConnectionEventCallbacks = {
    onSnapshot: handleSnapshot,
    onWalkStarted: handleWalkStarted,
    onWalkStopped: handleWalkStopped,
    onLocationUpdate: handleLocationUpdate,
    onPatientOnline: handlePatientOnline,
    onPatientOffline: handlePatientOffline,
    onWatchersUpdate: handleWatchersUpdate,
    onConnectionChange: handleConnectionChange,
  };

  useEffect(() => {
    const processor = new WalkEventProcessor();

    connectionManagerRef.current = new CaregiverConnectionManager(
      processor,
      callbacks,
      dispatchState
    );
  }, [callbacks, dispatchState]);

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
      if (snapshot && connectionManagerRef.current) {
        const payload = {
          type: 'snapshot',
          active_walk: {
            id: snapshot.id,
            history: (snapshot.locations || []).map((loc: { latitude: number; longitude: number; timestamp: string }) => ({
              latitude: loc.latitude,
              longitude: loc.longitude,
              timestamp: loc.timestamp,
            })),
          },
        };
        connectionManagerRef.current.handleMessage(payload);
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

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && appIsHydrated && (userToken || deviceToken)) {
        console.log('[useLivePatientLocation] App returned to foreground, re-syncing state...');
        connectionManagerRef.current?.resetProcessor();
        rehydrateState(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [appIsHydrated, userToken, deviceToken]);

  const wsUrlParams = userToken ? `?token=${userToken}` : deviceToken ? `?patient_token=${deviceToken}` : '';
  const { lastMessage, isConnected } = useWebSocket<any>(isReady, wsUrlParams);

  useEffect(() => {
    if (isConnected && connectionManagerRef.current) {
      connectionManagerRef.current.resetProcessor();
      rehydrateState(true);
    }
  }, [isConnected]);

  useEffect(() => {
    if (lastMessage && connectionManagerRef.current) {
      connectionManagerRef.current.handleMessage(lastMessage);
    }
  }, [lastMessage]);

  return {
    ...stateRef.current,
    isConnected,
    isPatientConnected,
    isLoading,
    watchersCount,
  };
}