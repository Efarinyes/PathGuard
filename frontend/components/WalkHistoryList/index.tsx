'use client';

import React from 'react';

export interface WalkHistoryItem {
  id: number;
  start_time: string;
  end_time?: string | null;
  duration_seconds: number;
}

export interface WalkHistoryListProps {
  walks: WalkHistoryItem[];
  /** Handler fired when a caregiver clicks a specific walk to view its map */
  onWalkClick: (walkId: number) => void;
}

/**
 * Format helper for displaying date in Catalan nicely
 * e.g. "12 d'octubre a les 14:30"
 */
function formatWalkDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('ca-ES', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format helper to turn duration seconds into highly readable strings
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Displays an interactable vertical list of past walks.
 * Exclusively uses minimalistic layout properties conforming to the PathGuard Design System.
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
    <div className="w-full flex flex-col gap-3">
      {walks.map((walk) => (
        <button
          key={walk.id}
          onClick={() => onWalkClick(walk.id)}
          className="w-full text-left bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-[#1E3A8A]/30 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] flex flex-row items-center cursor-pointer group"
        >
          {/* Minimalist dot indicator replacing complex icons */}
          <div className="shrink-0 mr-4">
            <div className="h-3 w-3 rounded-full bg-[#1E3A8A] opacity-80 group-hover:opacity-100 transition-opacity" />
          </div>
          
          <div className="flex-grow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
            {/* Primary Info: Date */}
            <p className="text-[#0F172A] font-semibold text-base tracking-wide">
              {formatWalkDate(walk.start_time)}
            </p>
            
            {/* Secondary Info: Duration */}
            <p className="text-slate-500 text-sm font-medium whitespace-nowrap">
              {walk.duration_seconds > 0 ? formatDuration(walk.duration_seconds) : "Menys d'un minut"}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
