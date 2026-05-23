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
}

export interface WalkHistoryListProps {
  walks: WalkHistoryItem[];
  onWalkClick: (walkId: number) => void;
}

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
      <table className="w-full text-left border-collapse min-w-[480px]">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
            <th className="py-3 px-2">Data</th>
            <th className="py-3 px-2">Inici</th>
            <th className="py-3 px-2">Final</th>
            <th className="py-3 px-2 text-center">Durada</th>
            <th className="py-3 px-2 text-center">Distància</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {walks.map((walk) => (
            <tr
              key={walk.id}
              onClick={() => onWalkClick(walk.id)}
              className="group hover:bg-slate-50/80 cursor-pointer transition-colors"
            >
              <td className="py-3 px-2 text-sm font-semibold text-foreground">
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}