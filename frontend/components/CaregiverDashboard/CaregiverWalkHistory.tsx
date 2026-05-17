'use client';

import React from 'react';
import { WalkHistoryItem } from '../WalkHistoryList';
import WalkHistoryList from '../WalkHistoryList';
import { ErrorBoundary } from '../WalkHistoryList/ErrorBoundary';

interface CaregiverWalkHistoryProps {
  walks: WalkHistoryItem[];
  onWalkClick: (walkId: number) => void;
}

export default function CaregiverWalkHistory({ walks, onWalkClick }: CaregiverWalkHistoryProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h3 className="text-[#0F172A] font-bold text-base">Historial detallat</h3>
      </div>
      <div className="p-2">
        <ErrorBoundary>
          <WalkHistoryList walks={walks} onWalkClick={onWalkClick} />
        </ErrorBoundary>
      </div>
    </div>
  );
}