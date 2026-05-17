'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';

interface CaregiverHeaderProps {
  patientName: string;
  isOwner: boolean;
  groupName: string;
  onInviteClick: () => void;
}

export default function CaregiverHeader({ patientName, isOwner, groupName, onInviteClick }: CaregiverHeaderProps) {
  const { clearUserSession } = useAppState();

  return (
    <>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-[#0F172A] font-bold text-xl mb-1">Estat del passeig</h2>
        </div>
      </div>

      {isOwner && (
        <button
          onClick={onInviteClick}
          className="w-full py-3 px-4 bg-[#1E3A8A]/10 hover:bg-[#1E3A8A]/20 text-[#1E3A8A] font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 border border-[#1E3A8A]/20 mt-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Afegir nou cuidador
        </button>
      )}

      <div className="h-px bg-slate-100 w-full mt-2" />

      <button
        onClick={() => clearUserSession()}
        className="w-full py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center gap-2 group"
        id="logout-btn"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 group-hover:opacity-100 transition-opacity">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Tancar sessió de cuidador
      </button>
    </>
  );
}