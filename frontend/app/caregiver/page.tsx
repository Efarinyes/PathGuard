'use client';

import { useAppState } from '@/hooks/useAppState';
import CaregiverDashboard from '@/components/CaregiverDashboard';
import LoginForm from '@/components/LoginForm';

export default function CaregiverPage() {
  const { userToken, setUserSession } = useAppState();

  // Hydration is guaranteed to be complete by RoleGuard before this renders
  
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
