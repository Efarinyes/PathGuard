'use client';

import React, { useState, useEffect } from 'react';
import { Mail, Lock, KeyRound, AlertCircle, CheckCircle } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export interface LoginFormProps {
  onLoginSuccess: (token: string) => void;
}

type LoginMode = 'password' | 'invitation';

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validatedCode, setValidatedCode] = useState<{valid: boolean; email?: string; group_name?: string} | null>(null);

  useEffect(() => {
    if (mode === 'invitation' && invitationCode.length === 6) {
      checkInvitationCode();
    } else {
      setValidatedCode(null);
    }
  }, [invitationCode, mode]);

  const checkInvitationCode = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/check-invitation/${invitationCode}`);
      const data = await response.json();
      setValidatedCode(data);
      if (!data.valid) {
        setError('Codi d\'invitació invàlid o expirat');
      } else {
        setError(null);
        setEmail(data.email || '');
      }
    } catch {
      setError('Error en verificar el codi');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let response;

      if (mode === 'invitation' && invitationCode) {
        const body = JSON.stringify({
          code: invitationCode,
          password: password
        });

        response = await fetch(`${API_BASE_URL}/auth/accept-invitation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
        });
      } else {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData,
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Credencials invàlides');
      }

      const data = await response.json();

      if (data.access_token) {
        onLoginSuccess(data.access_token);
      }
    } catch (err: any) {
      setError(err.message || 'Hi ha hagut un problema en connectar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Benvingut/da</h1>
        <p className="text-slate-500 mt-2 text-sm">Introdueix les teves dades per continuar.</p>
      </div>

      <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
        <button
          type="button"
          onClick={() => { setMode('password'); setError(null); setValidatedCode(null); setInvitationCode(''); }}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            mode === 'password'
              ? 'bg-white text-[#0F172A] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Mail className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Correu
        </button>
        <button
          type="button"
          onClick={() => { setMode('invitation'); setError(null); setValidatedCode(null); setEmail(''); }}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
            mode === 'invitation'
              ? 'bg-white text-[#0F172A] shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <KeyRound className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
          Codi
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {error && (
          <div className="flex items-center gap-2 w-full p-3 bg-red-50 border border-red-100 rounded-lg text-[#EF4444] text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {validatedCode?.valid && (
          <div className="flex items-center gap-2 w-full p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Invitació vàlida per a <span className="font-medium">{validatedCode.group_name}</span>
          </div>
        )}

        {mode === 'invitation' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invitationCode" className="text-sm font-semibold text-[#0F172A] ml-1">
              Codi d&apos;invitació
            </label>
            <input
              id="invitationCode"
              type="text"
              required
              maxLength={6}
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-[#0F172A] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:border-transparent transition-all uppercase tracking-widest text-center font-mono text-lg"
              placeholder="XXXXXX"
            />
          </div>
        )}

        {mode === 'password' && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-[#0F172A] ml-1">
              Correu electrònic
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
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-[#0F172A] ml-1 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
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
          disabled={isLoading || (mode === 'invitation' && invitationCode.length !== 6)}
          className="w-full mt-2 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-semibold py-3.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? 'Iniciant sessió...' : 'Iniciar sessió'}
        </button>
      </form>
    </div>
  );
}