'use client';

import React, { useEffect } from 'react';
import { useSOSAlert } from '@/hooks/useSOSAlert';
import { useSOSAlertSound } from '@/hooks/useSOSAlertSound';

interface SOSAlertModalProps {
  patientName?: string;
  durationMs?: number;
}

const ALERT_DURATION_MS = 45000;

export default function SOSAlertModal({ patientName = 'el pacient', durationMs = ALERT_DURATION_MS }: SOSAlertModalProps) {
  const { activeAlert, dismissAlert } = useSOSAlert();
  const { playAlertSound, stopAlertSound } = useSOSAlertSound();

  useEffect(() => {
    if (activeAlert) {
      playAlertSound();

      const timer = setTimeout(() => {
        stopAlertSound();
        dismissAlert();
      }, durationMs);

      return () => {
        clearTimeout(timer);
        stopAlertSound();
      };
    }
  }, [activeAlert, dismissAlert, durationMs, playAlertSound, stopAlertSound]);

  if (!activeAlert) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={dismissAlert}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 flex flex-col items-center gap-6 animate-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#0F172A] mb-2">Avís de seguretat</h2>
          <p className="text-slate-600">
            <span className="font-semibold text-[#0F172A]">{patientName}</span> ha enviat un avís d'emergència
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm text-slate-500 text-center">
          <p>
            <span className="font-medium">Cops enviat: </span>
            {activeAlert.sos_count}
          </p>
          {activeAlert.walk_id && (
            <p>
              <span className="font-medium">Passeig: </span>
              #{activeAlert.walk_id}
            </p>
          )}
        </div>

        <button
          onClick={dismissAlert}
          className="w-full bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-bold py-4 px-6 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A]"
        >
          D'acord, ho he rebut
        </button>

        <p className="text-xs text-slate-400">
          Aquest avís es tancarà automàticament en 45 segons
        </p>
      </div>
    </div>
  );
}