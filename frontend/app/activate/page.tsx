'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import { API_BASE_URL } from '@/lib/config';

export default function ActivatePage() {
  const router = useRouter();
  const { setPatientSession, isHydrated } = useAppState();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/activate-device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 410) {
          throw new Error('Aquest codi ja ha estat utilitzat. Demana\'n un de nou al cuidador.');
        }
        if (response.status === 404) {
          throw new Error('Codi no vàlid. Comprova que l\'has escrit correctament.');
        }
        throw new Error(data?.detail || 'No s\'ha pogut activar el dispositiu');
      }

      const data = await response.json();
      setPatientSession(data.device_token, data.patient_id);
      router.push('/patient');
    } catch (err: any) {
      setError(err.message || 'Hi ha hagut un problema en connectar.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isHydrated) return null;

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#22C55E] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Activar dispositiu</h1>
          <p className="text-slate-500 mt-3 text-base">
            Introdueix el codi que t&apos;ha donat el cuidador per vincular aquest dispositiu.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
          {error && (
            <div className="w-full p-4 bg-red-50 border border-red-100 rounded-xl text-[#EF4444] text-sm text-center font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="activationCode" className="text-sm font-bold text-[#0F172A] ml-1">
              Codi d&apos;activació
            </label>
            <input
              id="activationCode"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full px-4 py-4 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] text-2xl font-black tracking-[0.3em] text-center placeholder-slate-300 placeholder-normal placeholder:text-base placeholder:tracking-normal placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent transition-all"
              placeholder="Ex: A3K7M"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || code.length < 6}
            className="w-full bg-[#22C55E] hover:bg-[#22C55E]/90 active:scale-[0.98] text-white font-bold text-xl py-4 rounded-2xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#22C55E]/30"
          >
            {isLoading ? 'Activant...' : 'Activar'}
          </button>
        </form>

        <p className="text-slate-400 text-sm text-center mt-6">
          No tens un codi? Demana\'l al cuidador que va crear l&apos;entorn familiar.
        </p>
      </div>
    </main>
  );
}