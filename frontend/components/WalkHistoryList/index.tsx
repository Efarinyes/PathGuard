'use client';

import React from 'react';
import { formatDate, formatTime, formatDuration } from '@/lib/formatTimeAgo';

export interface WalkHistoryItem {
  id: number;
  start_time: string;
  end_time?: string | null;
  active: boolean;
  duration_seconds: number;
  distance_meters?: number;
  incidents_count?: number;
  signal_loss?: boolean;
}

export interface WalkHistoryListProps {
  walks: WalkHistoryItem[];
  onWalkClick: (walkId: number) => void;
}

/**
 * Displays an interactable table of past walks.
 */
export default function WalkHistoryList({ walks, onWalkClick }: WalkHistoryListProps) {
  if (walks.length === 0) {
    return (
      <div className="w-full text-center p-8 bg-slate-50 border border-slate-200 rounded-xl">
        <p className="text-slate-500 font-medium tracking-wide">
          Encara no hi ha historial disponible.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <th className="py-3 px-2">Data</th>
            <th className="py-3 px-2">Inici</th>
            <th className="py-3 px-2">Final</th>
            <th className="py-3 px-2 text-center">Durada</th>
            <th className="py-3 px-2 text-center">Distància</th>
            <th className="py-3 px-2 text-center">Incidents</th>
            <th className="py-3 px-2 text-center">Pèrdua Senyal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {walks.map((walk) => (
            <tr 
              key={walk.id}
              onClick={() => onWalkClick(walk.id)}
              className="group hover:bg-slate-50/80 cursor-pointer transition-colors"
            >
              <td className="py-3 px-2 text-sm font-semibold text-[#0F172A]">
                {formatDate(walk.start_time)}
              </td>
              <td className="py-3 px-2 text-sm text-slate-600">
                {formatTime(walk.start_time)}
              </td>
              <td className="py-3 px-2 text-sm text-slate-600">
                {walk.active ? 'Actiu' : formatTime(walk.end_time)}
              </td>
              <td className="py-3 px-2 text-sm text-slate-600 text-center font-medium">
                {walk.active ? '--' : formatDuration(walk.duration_seconds)}
              </td>
              <td className="py-3 px-2 text-sm text-slate-500 text-center">
                {walk.distance_meters ? `${(walk.distance_meters / 1000).toFixed(1)} km` : '--'}
              </td>
              <td className="py-3 px-2 text-center">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${walk.incidents_count ? 'bg-red-50 text-red-600' : 'text-slate-400'}`}>
                  {walk.incidents_count || 0}
                </span>
              </td>
              <td className="py-3 px-2 text-center">
                {walk.signal_loss ? (
                  <span className="text-amber-500 text-[10px] font-black uppercase tracking-tight">Sí</span>
                ) : (
                  <span className="text-slate-300 text-[10px] font-bold">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
