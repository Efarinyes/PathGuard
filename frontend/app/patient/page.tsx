'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import PatientWalkController from '@/components/PatientWalkController';

export default function PatientPage() {
  const { deviceToken, isHydrated } = useAppState();
  const router = useRouter();


  useEffect(() => {
    if (isHydrated && !deviceToken) {
      router.replace('/register');
    }
  }, [isHydrated, deviceToken, router]);

  if (!isHydrated) {
    return null;
  }
  if (!deviceToken) {
    return null;
  }

  return <PatientWalkController />;
}
