'use client';

import React, { useState } from 'react';
import { API_BASE_URL } from '@/lib/config';

export interface RegistrationFormProps {
  onRegisterSuccess: (deviceToken: string, patientId: number, caregiverJwt: string, activationCode: string) => void;
}

export default function RegistrationForm({ onRegisterSuccess }: RegistrationFormProps) {
  const [groupName, setGroupName] = useState('');
  const [patientName, setPatientName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sosEnabled, setSosEnabled] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        group_name: groupName,
        patient_name: patientName,
        email: email,
        password: password,
        sos_enabled: sosEnabled,
      };
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'No s\'ha pogut completar el registre');
      }

      const data = await response.json();

      setGroupName('');
      setPatientName('');
      setEmail('');
      setPassword('');

      if (data.device_token || data.patient_id) {
        onRegisterSuccess(data.device_token, data.patient_id, data.caregiver_jwt, data.activation_code);
      }
    } catch (err: any) {
      setError(err.message || 'Hi ha hagut un problema en connectar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#0F172A] tracking-tight">Crea el teu entorn familiar</h1>
        <p className="text-slate-500 mt-3 text-base">Comença protegint els qui més estimes amb PathGuard.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">

        {error && (
          <div className="w-full p-4 bg-red-50 border border-red-100 rounded-xl text-[#EF4444] text-sm text-center font-medium">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="groupName" className="text-sm font-bold text-[#0F172A] ml-1">
              Nom de la Família / Grup
            </label>
            <input
              id="groupName"
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition-all"
              placeholder="Ex: Família Soler"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="patientName" className="text-sm font-bold text-[#0F172A] ml-1">
              Qui portarà el dispositiu? (Nom)
            </label>
            <input
              id="patientName"
              type="text"
              required
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition-all"
              placeholder="Ex: Avi Joan"
            />
          </div>

          <hr className="my-6 border-slate-100" />

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-bold text-[#0F172A] ml-1">
              El teu correu (Cuidador)
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition-all"
              placeholder="el-teu@correu.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-bold text-[#0F172A] ml-1">
              Contrasenya de seguretat
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="flex items-start gap-3 p-4 bg-red-50/50 rounded-xl border border-red-100/50 mt-2">
            <div className="flex items-center h-5">
              <input
                id="sosEnabled"
                type="checkbox"
                checked={sosEnabled}
                onChange={(e) => setSosEnabled(e.target.checked)}
                className="w-5 h-5 text-[#DC2626] border-slate-300 rounded focus:ring-[#DC2626] transition-all cursor-pointer"
              />
            </div>
            <div className="text-sm">
              <label htmlFor="sosEnabled" className="font-bold text-[#DC2626] cursor-pointer">
                Habilitar avís d&apos;emergència (SOS)
              </label>
              <p className="text-slate-500 mt-0.5">
                Quan estigui activat, el pacient podrà demanar ajuda prement un botó. Els cuidadors rebran una notificació d&apos;emergència.
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-4 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-bold py-4 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/10 transition-all"
        >
          {isLoading ? 'Creant entorn...' : 'Crear entorn familiar'}
        </button>
      </form>
    </div>
  );
}