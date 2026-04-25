'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import RegistrationForm from '@/components/RegistrationForm';
import { useAppState } from '@/hooks/useAppState';

export default function RegisterPage() {
  const router = useRouter();
  const { setPatientSession } = useAppState();

  const handleRegisterSuccess = (deviceToken: string, patientId: number) => {
    // 1. Store locally effectively via global state manager
    setPatientSession(deviceToken, patientId);
    
    // 2. Redirect to dashboard (assuming patient scope default entry)
    router.push('/patient');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <RegistrationForm onRegisterSuccess={handleRegisterSuccess} />
      </div>
    </div>
  );
}
