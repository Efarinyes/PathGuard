'use client';

import React from 'react';
import { MapPin, LogOut, X } from 'lucide-react';

interface OwnerMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isOnDashboard: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export default function OwnerMenuDrawer({
  isOpen,
  onClose,
  isOnDashboard,
  onNavigate,
  onLogout,
}: OwnerMenuDrawerProps) {
  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-300 ease-out ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay semi-transparent */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`absolute right-0 top-4 h-auto max-h-[70vh] w-64 max-w-[80vw] bg-white/60 shadow-2xl flex flex-col rounded-l-2xl overflow-y-auto transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100/50">
          <h3 className="text-foreground font-bold text-base">Opcions</h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-foreground hover:bg-slate-100/50 rounded-lg transition-colors"
            aria-label="Tancar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu items */}
        <nav className="flex-1 p-2 space-y-1">
          <button
            onClick={() => onNavigate('/caregiver')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
              isOnDashboard
                ? 'text-foreground hover:bg-slate-50'
                : 'text-primary font-semibold bg-blue-50/50'
            }`}
          >
            <MapPin size={18} />
            Monitorització
          </button>

          <button
            onClick={() => onNavigate('/caregiver/dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
              !isOnDashboard
                ? 'text-foreground hover:bg-slate-50'
                : 'text-primary font-semibold bg-blue-50/50'
            }`}
          >
            <MapPin size={18} />
            Configuració del grup
          </button>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100/50">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 text-red-600 font-bold text-sm rounded-lg hover:bg-red-50/50 transition-colors border border-red-200/50"
          >
            <LogOut size={16} />
            Sortir
          </button>
        </div>
      </div>
    </div>
  );
}
