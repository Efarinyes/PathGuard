'use client';

import React, { useState, useCallback } from 'react';
import { walkService } from '@/services/walkService';
import { AlertCircle } from 'lucide-react';

interface SOSToggleProps {
  token: string;
  initialEnabled: boolean;
}

export default function SOSToggle({ token, initialEnabled }: SOSToggleProps) {
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await walkService.toggleSOS(token);
      setIsEnabled(data.sos_enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperat');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-foreground font-semibold">
            {isEnabled ? 'SOS activat' : 'SOS desactivat'}
          </p>
          <p className="text-slate-500 text-sm mt-0.5">
            {isEnabled
              ? 'El familiar pot fer servir el botó d\'emergència.'
              : 'El botó d\'emergència està desactivat.'}
          </p>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            isEnabled ? 'bg-success' : 'bg-slate-300'
          } ${isLoading ? 'opacity-60 cursor-wait' : ''}`}
          role="switch"
          aria-checked={isEnabled}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
