'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import RegistrationForm from '@/components/RegistrationForm';
import { useAppState } from '@/hooks/useAppState';

export default function RegisterPage() {
  const router = useRouter();
  const { deviceToken, isHydrated, setPatientSession } = useAppState();

  // 🔒 Lock patient devices to /patient
  useEffect(() => {
    if (isHydrated && deviceToken) {
      router.replace('/patient');
    }
  }, [isHydrated, deviceToken, router]);

  const handleRegisterSuccess = (deviceToken: string, patientId: number, activateAsPatient: boolean) => {
    if (activateAsPatient) {
      // 1. Store locally effectively via global state manager
      setPatientSession(deviceToken, patientId);
      // 2. Redirect to dashboard
      router.push('/patient');
    } else {
      // If not activating as patient, redirect to caregiver login
      router.push('/caregiver');
    }
  };

  if (!isHydrated) return null;
  if (deviceToken) return null; // Prevent flicker before redirect

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <RegistrationForm onRegisterSuccess={handleRegisterSuccess} />
      </div>
    </div>
  );
}
