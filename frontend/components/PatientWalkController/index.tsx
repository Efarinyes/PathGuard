'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAppState } from '../../hooks/useAppState';
import { locationService } from '../../services/locationService';
import NotificationBanner from '../NotificationBanner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

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
  const { deviceToken, activeWalkId, startWalk, endWalk } = useAppState();
  const isWalking = activeWalkId !== null;
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const geoWatchId = useRef<number | null>(null);
  const notifCounter = useRef(0);

  const showNotification = (message: string, type: Notification['type']) => {
    notifCounter.current += 1;
    setNotification({ message, type, id: notifCounter.current });
  };

  // Start sending GPS positions while walk is active
  useEffect(() => {
    if (!isWalking || !activeWalkId) {
      // Stop watching position when walk ends
      if (geoWatchId.current !== null) {
        navigator.geolocation.clearWatch(geoWatchId.current);
        geoWatchId.current = null;
      }
      return;
    }

    if (!navigator.geolocation) return;

    geoWatchId.current = navigator.geolocation.watchPosition(
      (position) => {
        locationService.saveLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: new Date().toISOString(),
          walk_id: activeWalkId,
        });
      },
      () => {
        showNotification('Connexió perduda temporalment', 'warning');
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
    );

    return () => {
      if (geoWatchId.current !== null) {
        navigator.geolocation.clearWatch(geoWatchId.current);
        geoWatchId.current = null;
      }
    };
  }, [isWalking, activeWalkId]);

  const handleStartWalk = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/walks/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deviceToken ? { 'X-Patient-Token': deviceToken } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData = { detail: 'Unknown error' };
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData.detail = errorText || `HTTP ${response.status}`;
        }

        // 🛠️ AUTO-RECOVERY: If the backend has a stuck active walk, stop it and retry
        if (response.status === 400 && errorData.detail === 'Walk already active') {
          await fetch(`${API_BASE_URL}/walks/stop`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(deviceToken ? { 'X-Patient-Token': deviceToken } : {}),
            },
          });
          return handleStartWalk();
        }

        console.error(`[PatientWalkController] Start walk failed (HTTP ${response.status}):`, errorData);
        throw new Error(errorData.detail || 'Failed to start walk');
      }

      const data = await response.json();
      const walkId = typeof data === "number" ? data : data.walk_id;

      startWalk(walkId);
      showNotification('Passeig iniciat', 'success');
    } catch {
      showNotification('No s\'ha pogut iniciar. Torna a intentar-ho.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopWalk = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/walks/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deviceToken ? { 'X-Patient-Token': deviceToken } : {}),
        },
      });
      if (!response.ok) throw new Error();
      endWalk();
      showNotification('Passeig finalitzat', 'info');
    } catch {
      showNotification('No s\'ha pogut aturar. Torna a intentar-ho.', 'warning');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-between p-6 pt-16 pb-12">

      {/* Status Label — calm, non-alarming */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${isWalking ? 'bg-[#22C55E]' : 'bg-slate-300'}`} />
          <p className="text-slate-500 text-base font-medium tracking-wide">
            {isWalking ? 'Passeig en curs' : 'Preparat per sortir'}
          </p>
        </div>
      </div>

      {/* Central Message — H1, maximum legibility */}
      <div className="text-center px-4">
        <h1 className="text-4xl font-bold text-[#0F172A] leading-tight">
          {isWalking
            ? 'Bon passeig!'
            : 'Quan vulguis sortir,\nprem el botó.'}
        </h1>
      </div>

      {/* Single Primary Action — minimum 64px tall for accessibility */}
      <div className="w-full max-w-xs">
        {!isWalking ? (
          <button
            onClick={handleStartWalk}
            disabled={isLoading}
            className="w-full min-h-[64px] bg-[#22C55E] hover:bg-[#22C55E]/90 active:scale-[0.98] text-white font-bold text-xl rounded-2xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#22C55E]/30"
          >
            {isLoading ? '...' : 'Comença a passejar'}
          </button>
        ) : (
          <button
            onClick={handleStopWalk}
            disabled={isLoading}
            className="w-full min-h-[64px] bg-[#EF4444] hover:bg-[#EF4444]/90 active:scale-[0.98] text-white font-bold text-xl rounded-2xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#EF4444]/30"
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
    </main>
  );
}
