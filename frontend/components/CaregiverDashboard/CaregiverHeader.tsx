'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import { Menu, UserPlus, LogOut } from 'lucide-react';
import OwnerMenuDrawer from '@/components/OwnerMenuDrawer';

interface CaregiverHeaderProps {
  patientName: string;
  isOwner: boolean;
  groupName: string;
  onInviteClick: () => void;
}

export default function CaregiverHeader({ patientName, isOwner, groupName, onInviteClick }: CaregiverHeaderProps) {
  const { clearUserSession } = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavigate = (path: string) => {
    setIsMenuOpen(false);
    setTimeout(() => {
      router.push(path);
    }, 300);
  };

  const isOnDashboard = pathname === '/caregiver/dashboard';

  return (
    <>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h2 className="text-[#0F172A] font-bold text-xl mb-1">
            {isOnDashboard ? 'Configuració del grup' : 'Estat del passeig'}
          </h2>
        </div>
        {isOwner && (
          <button
            onClick={() => setIsMenuOpen(true)}
            className="p-2 text-slate-400 hover:text-[#1E3A8A] transition-colors rounded-lg hover:bg-slate-100"
            aria-label="Obrir menú"
          >
            <Menu size={20} />
          </button>
        )}
      </div>

      {isOwner && !isOnDashboard && (
        <button
          onClick={onInviteClick}
          className="w-full py-3 px-4 bg-[#1E3A8A]/10 hover:bg-[#1E3A8A]/20 text-[#1E3A8A] font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 border border-[#1E3A8A]/20 mt-2"
        >
          <UserPlus size={16} />
          Afegir nou cuidador
        </button>
      )}

      <div className="h-px bg-slate-100 w-full mt-2" />

      <button
        onClick={() => clearUserSession()}
        className="w-full py-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center gap-2 group"
        id="logout-btn"
      >
        <LogOut size={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
        Tancar sessió de cuidador
      </button>

      <OwnerMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        isOnDashboard={isOnDashboard}
        onNavigate={handleNavigate}
        onLogout={() => {
          setIsMenuOpen(false);
          clearUserSession();
        }}
      />
    </>
  );
}
