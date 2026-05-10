'use client';

import React, { useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

interface InviteCaregiverModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupName?: string;
}

export default function InviteCaregiverModal({ isOpen, onClose, groupName }: InviteCaregiverModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationCode, setInvitationCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('pg_user_token');
      const response = await fetch(`${API_BASE_URL}/auth/generate-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al generar la invitació');
      }

      const data = await response.json();
      setInvitationCode(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError(null);
    setInvitationCode(null);
    onClose();
  };

  const copyToClipboard = () => {
    if (invitationCode) {
      navigator.clipboard.writeText(invitationCode);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-[#1E3A8A] px-6 py-4">
          <h3 className="text-white font-bold text-lg">Convida un nou cuidador</h3>
          <p className="text-blue-200 text-sm mt-1">Comparteix el codi perquè pugui unir-se al grup</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {!invitationCode ? (
            <>
              <p className="text-slate-600 text-sm mb-4">
                Introdueix el correu electrònic de la persona que vulguis convidar al grup <span className="font-semibold">{groupName || 'família'}</span>.
              </p>

              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Correu electrònic
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent outline-none transition-all"
                    placeholder="cuidador@exemple.com"
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                    disabled={isLoading}
                  >
                    Cancel·lar
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !email}
                    className="flex-1 px-4 py-2 bg-[#1E3A8A] text-white font-bold rounded-lg hover:bg-[#1E3A8A]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Generant...' : 'Generar codi'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <p className="text-slate-600 text-sm">Codi generat correctament!</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Codi d'invitació
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 px-4 py-3 bg-slate-100 rounded-lg font-mono text-2xl tracking-widest text-center text-[#1E3A8A] font-bold">
                    {invitationCode}
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
                    title="Copiar al porta-retalls"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Instruccions:</strong> Comparteix aquest codi amb la persona que vulguis convidar. Ella ha d&apos;obrir l&apos;aplicació PathGuard, anar a la pàgina de cuidador i introduir el codi juntament amb la contrasenya.
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-[#1E3A8A] text-white font-bold rounded-lg hover:bg-[#1E3A8A]/90 transition-colors"
              >
                Tancar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}