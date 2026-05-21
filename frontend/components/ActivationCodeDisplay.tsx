'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { walkService } from '@/services/walkService';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface ActivationCodeDisplayProps {
  token: string;
}

interface CodeState {
  code: string;
  isUsed: boolean;
}

export default function ActivationCodeDisplay({ token }: ActivationCodeDisplayProps) {
  const [state, setState] = useState<CodeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCode = useCallback(async (regenerating = false) => {
    if (regenerating) setIsRegenerating(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await walkService.getActivationCode(token);
      setState({ code: data.activation_code, isUsed: data.is_used });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperat');
    } finally {
      setIsLoading(false);
      setIsRegenerating(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-4 text-red-600 text-sm">
        <AlertCircle size={16} />
        <span>{error}</span>
        <button
          onClick={() => fetchCode()}
          className="ml-2 underline hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!state) return null;

  return (
    <div className="space-y-4">
      {/* Estat del codi */}
      <div className="flex items-center gap-2">
        {state.isUsed ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <AlertCircle size={12} />
            Ja utilitzat
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-bold uppercase tracking-wider">
            <CheckCircle size={12} />
            Pendent d&apos;activar
          </span>
        )}
      </div>

      {/* Codi en gran */}
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">
          Codi d&apos;activació
        </p>
        <p className="text-4xl md:text-5xl font-black text-[#1E3A8A] tracking-[0.3em] font-mono">
          {state.code}
        </p>
      </div>

      {/* Instruccions */}
      <p className="text-sm text-slate-500">
        Comparteix aquest codi de 6 caràcters amb la persona que portarà el dispositiu. Ha d&apos;obrir l&apos;aplicació i seleccionar &quot;Activar dispositiu&quot;.
      </p>

      {/* Botó regenerar */}
      <button
        onClick={() => fetchCode(true)}
        disabled={isRegenerating || !state.isUsed}
        className={`w-full py-3 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 border ${
          state.isUsed
            ? 'bg-[#1E3A8A] text-white hover:bg-[#1E3A8A]/90 border-transparent shadow-sm'
            : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
        }`}
      >
        <RefreshCw size={16} className={isRegenerating ? 'animate-spin' : ''} />
        {isRegenerating ? 'Generant...' : state.isUsed ? 'Generar nou codi' : 'Codi actiu'}
      </button>
    </div>
  );
}
