'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { walkService } from '@/services/walkService';
import { WalkHistoryItem } from '@/services/walkService';
import { X, AlertCircle } from 'lucide-react';

const DynamicCaregiverMap = dynamic(() => import('@/components/CaregiverMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[300px] rounded-xl flex items-center justify-center bg-slate-50 border border-slate-200">
      <div className="flex flex-col items-center text-slate-400">
        <div className="w-8 h-8 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mb-2" />
        <span className="text-sm font-medium">Carregant el mapa...</span>
      </div>
    </div>
  ),
});

interface WalkDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  walk: WalkHistoryItem | null;
  token: string;
}

export default function WalkDetailModal({ isOpen, onClose, walk, token }: WalkDetailModalProps) {
  const [locations, setLocations] = useState<Array<{ latitude: number; longitude: number; timestamp: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!walk || !token) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await walkService.getWalkLocations(token, walk.id);
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperat');
    } finally {
      setIsLoading(false);
    }
  }, [walk, token]);

  useEffect(() => {
    if (isOpen && walk) {
      fetchLocations();
    }
  }, [isOpen, walk, fetchLocations]);

  if (!isOpen || !walk) return null;

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('ca-ES');
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="absolute inset-4 md:inset-10 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-[#0F172A] font-bold text-lg">Detall del passeig</h3>
            <p className="text-slate-500 text-sm">
              {formatDate(walk.start_time)} · {formatTime(walk.start_time)}
              {walk.end_time && ` → ${formatTime(walk.end_time)}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-[#0F172A] hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 py-8 text-red-600 text-sm justify-center">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!isLoading && !error && (
            <div className="space-y-4">
              {/* Mapa */}
              <div className="w-full h-[50vh] min-h-[300px] rounded-xl overflow-hidden border border-slate-200">
                {locations.length > 0 ? (
                  <DynamicCaregiverMap locations={locations} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-50">
                    <p className="text-slate-500 text-sm">No hi ha punts de ruta disponibles.</p>
                  </div>
                )}
              </div>

              {/* Estadístiques ràpides */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Punts de ruta</p>
                  <p className="text-xl font-black text-[#0F172A]">{locations.length}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Durada</p>
                  <p className="text-xl font-black text-[#0F172A]">
                    {Math.floor(walk.duration_seconds / 60)} min
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
