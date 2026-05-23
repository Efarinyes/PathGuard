'use client';

import React from 'react';

interface CommonStartHour {
  hour: number;
}

interface WalkFrequency {
  date: string;
  count: number;
}

interface AnalyticsData {
  avg_duration_minutes: number;
  common_start_hours: CommonStartHour[];
  walk_frequency: WalkFrequency[];
}

interface CaregiverAnalyticsProps {
  analytics: AnalyticsData | null;
  walks: unknown[];
  isExtraInfoOpen: boolean;
  onToggleInfo: () => void;
  onWalkClick: (walkId: number) => void;
}

export default function CaregiverAnalytics({
  analytics,
  isExtraInfoOpen,
  onToggleInfo,
}: CaregiverAnalyticsProps) {
  return (
    <>
      <button
        onClick={onToggleInfo}
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

      <div className={`${isExtraInfoOpen ? 'block' : 'hidden'} transition-all duration-300`}>
        {analytics && (
          <div className="mt-6">
            <h3 className="text-foreground font-bold text-lg mb-4 ml-1">Resum d'activitat</h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Durada mitjana</p>
                  <p className="text-xl font-black text-foreground">{analytics.avg_duration_minutes} min</p>
                </div>
                <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Hores més freqÜents</p>
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
      </div>
    </>
  );
}