'use client';

import React, { useEffect, useState } from 'react';
import CaregiverMap from '../CaregiverMap';
import WalkHistoryList, { WalkHistoryItem } from '../WalkHistoryList';
import { useLivePatientLocation } from '../../hooks/useLivePatientLocation';
import { useAppState } from '../../hooks/useAppState';
import { walkService } from '../../services/walkService';
import { useCaregiverAnalytics } from '../../hooks/useCaregiverAnalytics';
import { useRouter } from 'next/navigation';

/**
 * Clean, minimalistic dashboard serving as the primary interface for caregivers.
 * Split view: Map on top/left, critical status overview card on bottom/right.
 */
export default function CaregiverDashboard() {
  const { userToken, clearUserSession } = useAppState();
  const router = useRouter();
  const { currentLocation, routeHistory, isConnected, isLoading, isActive } = useLivePatientLocation();
  const [timeAgo, setTimeAgo] = useState<string>('Esperant dades...');
  const [isExtraInfoOpen, setIsExtraInfoOpen] = useState(false);
  const [isMonitoringPaused, setIsMonitoringPaused] = useState(false);

  // Consume extracted data fetching logic
  const { walks, analytics } = useCaregiverAnalytics(userToken, isActive);

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
      <div className="flex-grow order-1 md:order-1 h-[60vh] md:h-auto">
        {(routeHistory.length > 0 && !isMonitoringPaused) ? (
          <CaregiverMap locations={routeHistory} />
        ) : (
          <div className="w-full h-full min-h-[400px] border border-slate-200 rounded-xl bg-slate-100 flex flex-col items-center justify-center gap-4">
            <span className="text-slate-500 font-medium tracking-wide">
              {isMonitoringPaused ? 'Seguiment en temps real pausat' : 'Pendent de la primera connexió...'}
            </span>
            {isMonitoringPaused && (
              <button 
                onClick={() => setIsMonitoringPaused(false)}
                className="px-4 py-2 bg-[#1E3A8A] text-white rounded-lg font-bold text-sm shadow-md hover:bg-[#1E3A8A]/90 transition-all"
              >
                Reprendre seguiment
              </button>
            )}
          </div>
        )}
      </div>


      {/* Secondary Area: Status Card */}
      <div className="w-full md:w-[350px] shrink-0 order-2 md:order-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col gap-4 sticky top-6">
          
          <div className="flex justify-between items-start">
            <div className="flex-1">
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
            
            <button
              onClick={() => {
                clearUserSession();
                // NO redirect to '/' - stay on /caregiver to show login form
              }}
              className="ml-4 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-[#EF4444] transition-all border border-slate-200 hover:border-red-100 rounded-lg px-2 py-1 hover:bg-red-50/50 flex flex-col items-center gap-1 group"
              title="Logout caregiver"
              id="logout-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 group-hover:text-red-400 transition-colors">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span>Sortir</span>
            </button>
          </div>

          {/* Action 1: Stop Following Patient */}
          {isActive && !isMonitoringPaused && (
            <button
              onClick={() => setIsMonitoringPaused(true)}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 border border-slate-200 mt-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              Deixar de seguir
            </button>
          )}




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

          {/* CTA to toggle history/analytics */}
          <button 
            onClick={() => setIsExtraInfoOpen(!isExtraInfoOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-600 font-bold text-sm transition-all hover:bg-slate-100 group"
          >
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-blue-600 transition-colors">
                <path d="M12 20v-6M9 20v-10M15 20v-2M3 20h18"/>
              </svg>
              <span>{isExtraInfoOpen ? 'Amagar historial' : 'Veure historial de passejos'}</span>
            </div>
            <svg 
              className={`w-4 h-4 transition-transform duration-300 ${isExtraInfoOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Collapsible Section for Analytics and History */}
        <div className={`${isExtraInfoOpen ? 'block' : 'hidden'} transition-all duration-300`}>
          {/* Analytics Section */}
          {analytics && (
            <div className="mt-6">
              <h3 className="text-[#0F172A] font-bold text-lg mb-4 ml-1">Resum d'activitat</h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Durada mitjana</p>
                    <p className="text-xl font-black text-[#0F172A]">{analytics.avg_duration_minutes} min</p>
                  </div>
                  <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                </div>
                
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Hores més freqüents</p>
                  <div className="flex gap-2">
                    {analytics.common_start_hours.length > 0 ? (
                      analytics.common_start_hours.map((h, i) => (
                        <span key={i} className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-700">
                          {h.hour}:00h
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 text-xs italic">Sense prou dades</span>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">Freqüència (7 dies)</p>
                  <div className="flex items-end gap-1.5 h-16 px-1">
                    {analytics.walk_frequency.map((f, i) => {
                      const maxCount = Math.max(...analytics.walk_frequency.map(d => d.count), 1);
                      const height = (f.count / maxCount) * 100;
                      return (
                        <div 
                          key={i} 
                          className={`w-full rounded-t-sm transition-all duration-500 ${f.count > 0 ? 'bg-blue-500' : 'bg-slate-100'}`}
                          style={{ height: `${f.count > 0 ? height : 15}%` }}
                          title={`${f.date}: ${f.count} passejos`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Walk History Section */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-[#0F172A] font-bold text-base">Historial detallat</h3>
            </div>
            <div className="p-2">
              <WalkHistoryList 
                walks={walks} 
                onWalkClick={(id) => console.log('View walk map:', id)} 
              />
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
