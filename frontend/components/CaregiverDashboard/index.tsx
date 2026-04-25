'use client';

import React, { useEffect, useState } from 'react';
import CaregiverMap from '../CaregiverMap';
import { useLivePatientLocation } from '../../hooks/useLivePatientLocation';

/**
 * Clean, minimalistic dashboard serving as the primary interface for caregivers.
 * Split view: Map on top/left, critical status overview card on bottom/right.
 */
export default function CaregiverDashboard() {
  const { currentLocation, routeHistory, isConnected, isLoading, isActive } = useLivePatientLocation();
  const [timeAgo, setTimeAgo] = useState<string>('Esperant dades...');

  // Effect to calculate "Last seen X ago" string based strictly on location payload
  useEffect(() => {
    if (!currentLocation?.timestamp) return;

    const calculateTimeAgo = () => {
      const now = new Date();
      const payloadTime = new Date(currentLocation.timestamp);
      const secondsDiff = Math.floor((now.getTime() - payloadTime.getTime()) / 1000);
      
      if (secondsDiff < 15) {
        setTimeAgo('Ara mateix');
      } else if (secondsDiff < 60) {
        setTimeAgo(`Fa ${secondsDiff} segons`);
      } else {
        const minutes = Math.floor(secondsDiff / 60);
        setTimeAgo(`Fa ${minutes} minut${minutes > 1 ? 's' : ''}`);
      }
    };

    // Calculate immediately
    calculateTimeAgo();

    const updateTimer = setInterval(calculateTimeAgo, 1000);

    return () => clearInterval(updateTimer);
  }, [currentLocation]);


  return (
    <div className="w-full flex flex-col md:flex-row gap-6 p-4 md:p-6 bg-[#F8FAFC] min-h-screen">
      
      {/* Primary Area: The Map */}
      <div className="flex-grow order-2 md:order-1 h-[60vh] md:h-auto">
        {routeHistory.length > 0 ? (
          <CaregiverMap locations={routeHistory} />
        ) : (
          <div className="w-full h-full min-h-[400px] border border-slate-200 rounded-xl bg-slate-100 flex items-center justify-center">
            <span className="text-slate-500 font-medium tracking-wide">Pendent de la primera connexió...</span>
          </div>
        )}
      </div>

      {/* Secondary Area: Status Card */}
      <div className="w-full md:w-[350px] shrink-0 order-1 md:order-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4 sticky top-6">
          
          <div>
            <h2 className="text-[#0F172A] font-bold text-xl mb-1">Estat del passeig</h2>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${(isConnected && isActive) ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${(isConnected && isActive) ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'}`}></span>
              </span>
              <p className="text-slate-600 text-sm font-medium">
                {(isConnected && isActive) ? 'Passeig actiu - En línia' : isActive ? 'Passeig actiu - Connectant...' : 'Passeig finalitzat'}
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full" />

          {/* Minimal info area */}
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

        </div>
      </div>
      
    </div>
  );
}
