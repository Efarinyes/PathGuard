'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAppState } from "@/hooks/useAppState"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';



export interface RegistrationFormProps {
  /** Callback fired upon successful registration, providing the deviceToken and patientId */
  onRegisterSuccess: (deviceToken: string, patientId: number) => void;
}

/**
 * Clean, minimalistic registration form.
 * Directly integrates with the backend /register endpoint.
 */
export default function RegistrationForm({ onRegisterSuccess }: RegistrationFormProps) {
  const router = useRouter();
  const [patientName, setPatientName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { setPatientSession } = useAppState();

  const [isLoading, setIsLoading] = useState(false);
  const [errorError, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        patient_name: patientName,
        caregivers: [
          {
            email: email,
            password: password,
          }
        ]
      };
      console.log('REGISTER URL:', `${API_BASE_URL}/auth/register`);
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify(payload),
      });
      console.log('STATUS:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'No s\'ha pogut completar el registre');
      }

      const data = await response.json();

      if (data.device_token && data.patient_id) {
        setPatientSession(data.device_token, data.patient_id);
        router.push('/patient');
      }
    } catch (err: any) {
      setError(err.message || 'Hi ha hagut un problema en connectar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Registre</h1>
        <p className="text-slate-500 mt-2 text-sm">Crea un compte pel pacient i el cuidador.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {errorError && (
          <div className="w-full p-3 bg-red-50 border border-red-100 rounded-lg text-[#EF4444] text-sm text-center font-medium">
            {errorError}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="patientName" className="text-sm font-semibold text-[#0F172A] ml-1">
            Nom del Pacient
          </label>
          <input
            id="patientName"
            type="text"
            required
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition-all"
            placeholder="Ex: Joan Pérez"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-[#0F172A] ml-1">
            Correu del Cuidador
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition-all"
            placeholder="correu@exemple.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-[#0F172A] ml-1">
            Contrasenya
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition-all"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-semibold py-3.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? 'Registrant...' : 'Registrar-se'}
        </button>
      </form>
    </div>
  );
}
