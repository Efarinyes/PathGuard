'use client';

import React, { useEffect, useState } from 'react';
import CaregiverMap from '../CaregiverMap';
import WalkHistoryList, { WalkHistoryItem } from '../WalkHistoryList';
import { useLivePatientLocation } from '../../hooks/useLivePatientLocation';
import { useAppState } from '../../hooks/useAppState';
import { walkService, AnalyticsData } from '../../services/walkService';

/**
 * Clean, minimalistic dashboard serving as the primary interface for caregivers.
 * Split view: Map on top/left, critical status overview card on bottom/right.
 */
export default function CaregiverDashboard() {
  const { userToken } = useAppState();
  const { currentLocation, routeHistory, isConnected, isLoading, isActive } = useLivePatientLocation();
  const [timeAgo, setTimeAgo] = useState<string>('Esperant dades...');
  const [walks, setWalks] = useState<WalkHistoryItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isExtraInfoOpen, setIsExtraInfoOpen] = useState(false);
  
  // Fetch walks history
  useEffect(() => {
    if (!userToken) return;

    const fetchHistory = async () => {
      try {
        const data = await walkService.getWalks(userToken);
        setWalks(data);
      } catch (err) {
        console.error('Failed to fetch walks:', err);
      }
    };

    fetchHistory();
    
    // Refresh history when walk status changes
    const interval = setInterval(fetchHistory, 30000); // Every 30s
    return () => clearInterval(interval);
  }, [userToken, isActive]);

  // Fetch analytics
  useEffect(() => {
    if (!userToken) return;

    const fetchAnalytics = async () => {
      try {
        const data = await walkService.getAnalytics(userToken);
        setAnalytics(data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      }
    };

    fetchAnalytics();
  }, [userToken, isActive]);

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
        {routeHistory.length > 0 ? (
          <CaregiverMap locations={routeHistory} />
        ) : (
          <div className="w-full h-full min-h-[400px] border border-slate-200 rounded-xl bg-slate-100 flex items-center justify-center">
            <span className="text-slate-500 font-medium tracking-wide">Pendent de la primera connexió...</span>
          </div>
        )}
      </div>

      {/* Secondary Area: Status Card */}
      <div className="w-full md:w-[350px] shrink-0 order-2 md:order-2">
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

          {/* Mobile CTA to toggle history/analytics */}
          <button 
            onClick={() => setIsExtraInfoOpen(!isExtraInfoOpen)}
            className="md:hidden w-full flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg border border-slate-100 text-slate-600 font-bold text-sm transition-all hover:bg-slate-100"
          >
            <span>{isExtraInfoOpen ? 'Amagar historial' : 'Veure historial i analítiques'}</span>
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
        <div className={`${isExtraInfoOpen ? 'block' : 'hidden md:block'} transition-all duration-300`}>
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
          <div className="mt-6">
            <h3 className="text-[#0F172A] font-bold text-lg mb-4 ml-1">Activitat recent</h3>
            <WalkHistoryList 
              walks={walks} 
              onWalkClick={(id) => console.log('View walk map:', id)} 
            />
          </div>
        </div>
      </div>
      
    </div>
  );
}
