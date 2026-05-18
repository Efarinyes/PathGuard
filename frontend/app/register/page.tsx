'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RegistrationForm from '@/components/RegistrationForm';
import { useAppState } from '@/hooks/useAppState';

export default function RegisterPage() {
  const router = useRouter();
  const { deviceToken, isHydrated, setPatientSession, setUserSession } = useAppState();
  const [activationCode, setActivationCode] = useState<string | null>(null);
  const [caregiverJwt, setCaregiverJwt] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (isHydrated && deviceToken) {
      router.replace('/patient');
    }
  }, [isHydrated, deviceToken, router]);

  const handleRegisterSuccess = (deviceToken: string, patientId: number, caregiverJwt: string, code: string) => {
    setActivationCode(code);
    setCaregiverJwt(caregiverJwt);
    setShowCode(true);
  };

  const handleGoToCaregiver = () => {
    if (caregiverJwt) {
      setUserSession(caregiverJwt);
    }
    router.push('/caregiver');
  };

  if (!isHydrated) return null;
  if (deviceToken) return null;

  if (showCode && activationCode) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-[#22C55E] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-[#0F172A] mb-3">Entorn creat!</h1>
          <p className="text-slate-500 text-base mb-8">
            Comparteix aquest codi amb la persona que portarà el dispositiu per activar-lo.
          </p>

          <div className="bg-white border-2 border-[#1E3A8A]/20 rounded-2xl p-6 mb-8">
            <p className="text-sm text-slate-500 font-medium mb-2">Codi d&apos;activació</p>
            <p className="text-4xl font-black text-[#1E3A8A] tracking-[0.3em]">{activationCode}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGoToCaregiver}
              className="w-full py-4 px-6 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/10"
            >
              Anar al dashboard del cuidador
            </button>

            <p className="text-slate-400 text-sm">
              La persona amb el dispositiu pot anar a la pàgina principal i seleccionar &quot;Activar dispositiu&quot;
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <RegistrationForm onRegisterSuccess={handleRegisterSuccess} />
      </div>
    </div>
  );
}