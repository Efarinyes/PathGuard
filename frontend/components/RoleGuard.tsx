'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import { Shield } from 'lucide-react';

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const { deviceToken, userToken, isHydrated } = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;

    let redirectPath = null;

    if (pathname === '/') {
      if (deviceToken) redirectPath = '/patient';
      else if (userToken) redirectPath = '/caregiver';
      else redirectPath = '/register';
    } else if (pathname === '/patient' && !deviceToken) {
      redirectPath = '/register';
    }

    if (redirectPath) {
      router.replace(redirectPath);
    } else {
      setIsReady(true);
    }
  }, [isHydrated, deviceToken, userToken, pathname, router]);

  // Show loading spinner until hydration is complete and we've determined no redirect is needed
  if (!isHydrated || !isReady) {
    // Only show spinner on routes that might redirect to prevent flicker on valid pages like /caregiver
    if (pathname === '/' || pathname === '/patient') {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
          <div className="w-16 h-16 bg-[#1E3A8A] rounded-2xl flex items-center justify-center mb-4 shadow-sm animate-pulse">
            <Shield className="text-white" size={32} />
          </div>
        </main>
      );
    }
  }

  // Prevent flashing protected content before redirect
  if (pathname === '/' || (pathname === '/patient' && !deviceToken)) {
    return null;
  }

  return <>{children}</>;
}
