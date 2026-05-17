'use client';

import React from 'react';
import { formatTimeAgo, formatBatteryTime } from '@/lib/formatTimeAgo';

interface PatientStatusCardProps {
  patientName: string;
  isConnected: boolean;
  isActive: boolean;
  isPatientConnected: boolean;
  isMonitoringPaused: boolean;
  currentLocation: { timestamp: string } | null;
  routeHistory: unknown[];
  deviceStatus: { battery_level: number; is_charging: boolean; timestamp: string } | null;
  timeAgo: string;
  batteryTimeAgo: string;
  watchersCount: number;
  onPauseMonitoring: () => void;
  onResumeMonitoring: () => void;
}

export default function PatientStatusCard({
  patientName,
  isConnected,
  isActive,
  isPatientConnected,
  isMonitoringPaused,
  currentLocation,
  routeHistory,
  deviceStatus,
  timeAgo,
  batteryTimeAgo,
  watchersCount,
  onPauseMonitoring,
  onResumeMonitoring,
}: PatientStatusCardProps) {
  const getStatusColor = () => {
    if (!isConnected || !isActive || isMonitoringPaused) return 'bg-slate-400';
    return isPatientConnected ? 'bg-[#22C55E]' : 'bg-[#F59E0B]';
  };

  const getStatusPingColor = () => {
    if (!isConnected || !isActive || isMonitoringPaused) return 'bg-slate-400';
    return isPatientConnected ? 'bg-[#22C55E]' : 'bg-[#F59E0B]';
  };

  const getStatusText = () => {
    if (isMonitoringPaused) return 'Mode Tauler - Seguiment pausat';
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

      {watchersCount > 1 && (
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1.5">
          <span className="flex h-1.5 w-1.5 rounded-full bg-blue-400"></span>
          {watchersCount - 1 === 1 ? '1 altre cuidador connectat ara' : `${watchersCount - 1} altres cuidadors connectats ara`}
        </p>
      )}

      {isActive && !isMonitoringPaused && (
        <button
          onClick={onPauseMonitoring}
          className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 text-[#1E3A8A] font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 border border-slate-200 mt-2 group shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><path d="M18 6L6 18M6 6l12 12"/></svg>
          Aturar seguiment en directe
        </button>
      )}

      {isMonitoringPaused && (
        <button
          onClick={onResumeMonitoring}
          className="w-full py-3 px-4 bg-[#1E3A8A] text-white rounded-lg font-bold text-sm shadow-md hover:bg-[#1E3A8A]/90 transition-all"
        >
          Reprendre seguiment
        </button>
      )}

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
              <p className="text-slate-400 text-sm italic">No disponible en el dispositiu del pacient</p>
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