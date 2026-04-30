'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import CaregiverDashboard from '@/components/CaregiverDashboard';
import LoginForm from '@/components/LoginForm';

export default function CaregiverPage() {
  const { userToken, deviceToken, isHydrated, setUserSession } = useAppState();
  const router = useRouter();

  // 🔒 Lock patient devices to /patient
  useEffect(() => {
    if (isHydrated && deviceToken) {
      router.replace('/patient');
    }
  }, [isHydrated, deviceToken, router]);

  // 🔄 Hydration gate
  if (!isHydrated) return null;
  if (deviceToken) return null; // Prevent flicker

  // 🔑 Auth gate
  if (!userToken) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <LoginForm onLoginSuccess={(token) => setUserSession(token)} />
      </main>
    );
  }

  return <CaregiverDashboard />;
}
