'use client';

import { useLayoutEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/config';

export function PatientRedirect() {
  useLayoutEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN);
    if (token) {
      window.location.href = '/patient';
    }
  }, []);
  return null;
}
