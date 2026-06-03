'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '@/hooks/useAppState';
import { useLocationTracking } from '@/hooks/useLocationTracking';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWalkSession } from '@/hooks/useWalkSession';
import { locationService } from '@/services/locationService';
import { patientService } from '@/services/patientService';
import NotificationBanner from '../NotificationBanner';
import SOSButton from '../SOSButton';
import { WS_HEARTBEAT_INTERVAL_MS } from '@/lib/config';

interface Notification {
  message: string;
  type: 'success' | 'warning' | 'info';
  id: number;
}

/**
 * PatientWalkController
 * The primary patient-facing screen.
 * Enforces the CRITICAL RULESET: single action, minimal text, no jargon.
 */
export default function PatientWalkController() {
  const { deviceToken, activeWalkId, sosEnabled, setSosEnabled } = useAppState();
  const { isTracking, currentPosition, startTracking, stopTracking } = useLocationTracking();
  const { isWalking, isLoading, handleStartWalk, handleStopWalk } = useWalkSession();
  const [notification, setNotification] = useState<Notification | null>(null);
  const notifCounter = useRef(0);

  useEffect(() => {
    if (!deviceToken) return;
    patientService.getPatientStatus(deviceToken)
      .then((status) => setSosEnabled(status.sos_enabled))
      .catch(() => setSosEnabled(false));
  }, [deviceToken, setSosEnabled]);

  // Presence WebSocket for Heartbeat
  const wsUrlParams = deviceToken ? `?patient_token=${deviceToken}` : '';
  const { isConnected, sendMessage } = useWebSocket(!!deviceToken, wsUrlParams);

  useEffect(() => {
    if (!isConnected) return;

    sendMessage({ type: 'heartbeat' });
    const interval = setInterval(() => {
      sendMessage({ type: 'heartbeat' });
    }, WS_HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isConnected, sendMessage]);

  const showNotification = (message: string, type: Notification['type']) => {
    notifCounter.current += 1;
    setNotification({ message, type, id: notifCounter.current });
  };

  // Sync hook tracking with active walk state
  useEffect(() => {
    if (isWalking && !isTracking) {
      if (deviceToken && activeWalkId) {
        startTracking({ deviceToken, walkId: activeWalkId });
      }
    } else if (!isWalking && isTracking) {
      stopTracking();
    }
  }, [isWalking, isTracking, deviceToken, activeWalkId, startTracking, stopTracking]);

  // Push updates to API when the hook emits a valid, filtered point
  useEffect(() => {
    if (isWalking && activeWalkId && currentPosition) {
      locationService.saveLocation({
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
        timestamp: new Date().toISOString(),
        walk_id: activeWalkId,
      });
    }
  }, [currentPosition, isWalking, activeWalkId]);

  const onStartWalk = async () => {
    const result = await handleStartWalk();
    if (result.success) {
      showNotification('Passeig iniciat', 'success');
    } else {
      showNotification('No s\'ha pogut iniciar. Torna a intentar-ho.', 'warning');
    }
  };

  const onStopWalk = async () => {
    const result = await handleStopWalk();
    if (result.success) {
      showNotification('Passeig finalitzat', 'info');
    } else {
      showNotification('No s\'ha pogut aturar. Torna a intentar-ho.', 'warning');
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-between p-6 pt-16 pb-12">

      {/* Status Label — calm, non-alarming */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isWalking ? 'bg-success' : 'bg-slate-300'}`} />
          <p className="text-slate-500 text-base font-medium tracking-wide">
            {isWalking ? 'Passeig en curs' : 'Preparat per sortir'}
          </p>
        </div>
      </div>

      {/* Central Message — H1, maximum legibility */}
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold text-foreground leading-tight">
          {isWalking
            ? 'Bon passeig!'
            : 'Quan vulguis sortir,\nprem el botó.'}
        </h1>
      </div>

      {/* Single Primary Action — minimum 64px tall for accessibility */}
      <div className="w-full max-w-xs">
        {!isWalking ? (
          <button
            onClick={onStartWalk}
            disabled={isLoading}
            className="w-full min-h-[64px] bg-success hover:bg-success/90 active:scale-[0.98] text-white font-bold text-xl rounded-2xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-success/30"
          >
            {isLoading ? '...' : 'Comença a passejar'}
          </button>
        ) : (
          <button
            onClick={onStopWalk}
            disabled={isLoading}
            className="w-full min-h-[64px] bg-danger hover:bg-danger/90 active:scale-[0.98] text-white font-bold text-xl rounded-2xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-danger/30"
          >
            {isLoading ? '...' : 'Parem!'}
          </button>
        )}
      </div>

      {/* Subtle Notification (no flashing) */}
      {notification && (
        <NotificationBanner
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onDismiss={() => setNotification(null)}
        />
      )}

      {/* SOS Button - only visible when walk is active and enabled */}
      {sosEnabled && deviceToken && isWalking && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <SOSButton deviceToken={deviceToken} />
        </div>
      )}
    </main>
  );
}
