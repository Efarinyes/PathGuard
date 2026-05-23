'use client';

import React, { useState, useRef, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/config';
import NotificationBanner from '../NotificationBanner';

interface SOSButtonProps {
  deviceToken: string | null;
  patientName?: string;
}

type Phase = 'idle' | 'pressing' | 'confirming';

const PRESS_THRESHOLD_MS = 3000;

export default function SOSButton({ deviceToken, patientName }: SOSButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [countdown, setCountdown] = useState(3);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = useCallback(() => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  const handlePressStart = () => {
    if (phase !== 'idle') return;

    setPhase('pressing');
    setCountdown(3);
    setNotificationMessage('Demanant ajuda. Atent a les trucades... 3');

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        const newValue = prev - 1;
        if (newValue <= 0) {
          clearInterval(countdownIntervalRef.current!);
          setNotificationMessage('Demanant ajuda. Atent a les trucades...');
          return 0;
        }
        setNotificationMessage(`Demanant ajuda. Atent a les trucades... ${newValue}`);
        return newValue;
      });
    }, 1000);

    pressTimerRef.current = setTimeout(async () => {
      clearAllTimers();
      await triggerSOS();
    }, PRESS_THRESHOLD_MS);
  };

  const handlePressEnd = () => {
    if (phase !== 'pressing') return;

    clearAllTimers();
    setPhase('idle');
    setCountdown(3);
    setNotificationMessage(null);
  };

  const triggerSOS = async () => {
    if (!deviceToken) return;

    try {
      const response = await fetch(`${API_BASE_URL}/sos/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Patient-Token': deviceToken,
        },
      });

      if (response.ok) {
        setPhase('confirming');
        setNotificationMessage('Els teus cuidadors han rebut l\'avís');
        setTimeout(() => {
          setPhase('idle');
          setNotificationMessage(null);
        }, 5000);
      } else {
        setPhase('idle');
        setNotificationMessage(null);
      }
    } catch {
      setPhase('idle');
      setNotificationMessage(null);
    }
  };

  const getButtonClasses = () => {
    const base = 'w-full h-[80px] relative overflow-hidden rounded-2xl shadow-lg focus:outline-none focus-visible:ring-4 flex items-center justify-center';

    switch (phase) {
      case 'pressing':
        return `${base} bg-danger-dark focus-visible:ring-danger-dark/40`;
      case 'confirming':
        return `${base} bg-success focus-visible:ring-success/40`;
      default:
        return `${base} bg-danger hover:bg-danger/90 focus-visible:ring-danger/30`;
    }
  };

  return (
    <div className="w-full max-w-xs">
      <button
        type="button"
        className={getButtonClasses()}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onPointerCancel={handlePressEnd}
        aria-label="Botó d'emergència per demanar ajuda"
      >
        <div className="flex flex-col items-center justify-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span className="text-xs font-semibold">Ajuda</span>
        </div>

        {phase === 'pressing' && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/30 origin-left"
            style={{ animation: 'sos-hold-progress 3s linear forwards' }}
          />
        )}
      </button>

      <p className={`text-center text-xs text-slate-400 mt-2 transition-opacity duration-200 ${phase === 'idle' && !notificationMessage ? 'opacity-100' : 'opacity-0'}`}>
        Mantén premut per enviar ajuda
      </p>

      {notificationMessage && (
        <NotificationBanner
          message={notificationMessage}
          type={phase === 'confirming' ? 'success' : 'warning'}
          durationMs={0}
          position="top"
          onDismiss={() => {
            if (phase === 'idle') {
              setNotificationMessage(null);
            }
          }}
        />
      )}
    </div>
  );
}