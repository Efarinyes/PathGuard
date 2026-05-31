'use client';

import React from 'react';
import { formatTimeAgo } from '@/lib/formatTimeAgo';

interface PatientStatusCardProps {
  isConnected: boolean;
  isActive: boolean;
  isPatientConnected: boolean;
  currentLocation: { timestamp: string } | null;
  timeAgo: string;
}

export default function PatientStatusCard({
  isConnected,
  isActive,
  isPatientConnected,
  currentLocation,
  timeAgo,
}: PatientStatusCardProps) {
  const getStatusColor = () => {
    if (!isConnected || !isActive) return 'bg-slate-400';
    return isPatientConnected ? 'bg-success' : 'bg-warning';
  };

  const getStatusPingColor = () => {
    if (!isConnected || !isActive) return 'bg-slate-400';
    return isPatientConnected ? 'bg-success' : 'bg-warning';
  };

  const getStatusText = () => {
    if (isConnected && isActive) {
      return isPatientConnected ? 'Passeig actiu - En línia' : 'Passeig actiu - Sense cobertura';
    }
    if (isActive) return 'Passeig actiu - Connectant...';
    return 'Passeig finalitzat';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4 sticky top-6">
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getStatusPingColor()}`}></span>
          <span className={`relative inline-flex rounded-full h-3 w-3 ${getStatusColor()}`}></span>
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