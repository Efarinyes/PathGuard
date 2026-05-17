'use client';

import React from 'react';
import { formatTimeAgo, formatBatteryTime } from '@/lib/formatTimeAgo';

interface PatientStatusCardProps {
  isConnected: boolean;
  isActive: boolean;
  isPatientConnected: boolean;
  currentLocation: { timestamp: string } | null;
  routeHistory: unknown[];
  deviceStatus: { battery_level: number; is_charging: boolean; timestamp: string } | null;
  timeAgo: string;
  batteryTimeAgo: string;
}

export default function PatientStatusCard({
  isConnected,
  isActive,
  isPatientConnected,
  currentLocation,
  routeHistory,
  deviceStatus,
  timeAgo,
  batteryTimeAgo,
}: PatientStatusCardProps) {
  const getStatusColor = () => {
    if (!isConnected || !isActive) return 'bg-slate-400';
    return isPatientConnected ? 'bg-[#22C55E]' : 'bg-[#F59E0B]';
  };

  const getStatusPingColor = () => {
    if (!isConnected || !isActive) return 'bg-slate-400';
    return isPatientConnected ? 'bg-[#22C55E]' : 'bg-[#F59E0B]';
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
        <p className="text-[#0F172A] font-semibold">
          {currentLocation ? timeAgo : '---'}
        </p>
      </div>

      {currentLocation && (
        <div>
          <p className="text-sm text-slate-500 font-medium mb-1">Punts de ruta</p>
          <p className="text-[#0F172A] font-semibold">{routeHistory.length}</p>
        </div>
      )}

      {isActive && (
        <div>
          <p className="text-sm text-slate-500 font-medium mb-1">Estat de la bateria</p>
          {deviceStatus ? (
            deviceStatus.battery_level === -1 ? (
              <p className="text-slate-400 text-sm italic">No disponible en el dispositiu</p>
            ) : (
              <p className="text-[#0F172A] font-semibold flex items-center gap-1.5">
                <span role="img" aria-label="battery">
                  {deviceStatus.is_charging ? '⚡🔋' : deviceStatus.battery_level > 20 ? '🔋' : '🪫'}
                </span>
                {deviceStatus.battery_level}%
                <span className="text-xs text-slate-400 font-normal ml-1">
                  ({batteryTimeAgo})
                </span>
              </p>
            )
          ) : (
            <p className="text-slate-400 text-sm italic">Pendent de rebre dades...</p>
          )}
        </div>
      )}
    </div>
  );
}