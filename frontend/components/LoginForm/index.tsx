'use client';

import React, { useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export interface LoginFormProps {
  /** Callback fired upon successful authentication, providing the JWT access token */
  onLoginSuccess: (token: string) => void;
}

/**
 * Clean, minimalistic login form.
 * Directly integrates with the backend FastAPI OAuth2 password flow.
 */
export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorError, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // FastAPI OAuth2PasswordRequestForm expects form-urlencoded data
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Credencials invàlides');
      }

      const data = await response.json();
      
      // Pass the returned JWT token up to the parent application state
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
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">Benvingut/da</h1>
        <p className="text-slate-500 mt-2 text-sm">Introdueix les teves dades per continuar.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        {errorError && (
          <div className="w-full p-3 bg-red-50 border border-red-100 rounded-lg text-[#EF4444] text-sm text-center font-medium">
            {errorError}
          </div>
        )}

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

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold text-[#0F172A] ml-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" />
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
          {isLoading ? 'Iniciant sessió...' : 'Iniciar sessió'}
        </button>
      </form>
    </div>
  );
}
