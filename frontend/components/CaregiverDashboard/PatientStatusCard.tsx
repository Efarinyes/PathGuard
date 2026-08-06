'use client';

import React from 'react';
import type { PresenceStatus } from '@/lib/wsEventTypes';

interface PatientStatusCardProps {
  isConnected: boolean;
  isActive: boolean;
  isPatientConnected: boolean;
  presenceStatus: PresenceStatus;
  currentLocation: { timestamp: string } | null;
  timeAgo: string;
}

const STATUS_CONFIG: Record<PresenceStatus, { color: string; label: string }> = {
  online:     { color: 'bg-success', label: 'Passeig actiu — En línia' },
  gps_online: { color: 'bg-primary', label: 'Passeig actiu — GPS actiu' },
  limbo:      { color: 'bg-warning', label: 'Passeig actiu — Esperant actualització…' },
  offline:    { color: 'bg-warning', label: 'Sense actualitzacions — darrera posició coneguda' },
};

/** SPEC-189 — exported for Vitest */
export function isSilenceStatus(status: PresenceStatus): boolean {
  return status === 'limbo' || status === 'offline';
}

/** SPEC-189 — exported for Vitest */
export function silenceLabel(status: PresenceStatus, timeAgo: string, hasLocation: boolean): string {
  if (status === 'limbo') {
    return STATUS_CONFIG.limbo.label;
  }
  if (!hasLocation) {
    return 'Sense actualitzacions — posició encara no disponible';
  }
  return `Sense actualitzacions (${timeAgo}) — darrera posició coneguda`;
}

export default function PatientStatusCard({
  isConnected,
  isActive,
  presenceStatus,
  currentLocation,
  timeAgo,
}: PatientStatusCardProps) {
  const silent = isConnected && isActive && isSilenceStatus(presenceStatus);

  const getStatusColor = () => {
    if (!isConnected || !isActive) return 'bg-slate-400';
    return STATUS_CONFIG[presenceStatus]?.color ?? 'bg-slate-400';
  };

  const getStatusPingColor = () => {
    if (!isConnected || !isActive) return 'bg-slate-400';
    if (presenceStatus === 'gps_online') return 'bg-primary';
    return STATUS_CONFIG[presenceStatus]?.color ?? 'bg-slate-400';
  };

  const getStatusText = () => {
    if (!isConnected) return 'Desconnectat';
    if (!isActive) return 'Passeig finalitzat';
    if (isSilenceStatus(presenceStatus)) {
      return silenceLabel(presenceStatus, timeAgo, currentLocation !== null);
    }
    return STATUS_CONFIG[presenceStatus]?.label ?? 'Desconegut';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4 sticky top-6">
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          {!silent && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getStatusPingColor()}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${getStatusColor()}`} />
        </span>
        <p className="text-slate-600 text-sm font-medium">
          {getStatusText()}
        </p>
      </div>

      <div className="h-px bg-slate-100 w-full" />

      <div>
        <p className="text-sm text-slate-500 font-medium mb-1">Última actualització</p>
        <p className="text-foreground font-semibold">
          {currentLocation ? timeAgo : '---'}
        </p>
      </div>
    </div>
  );
}
