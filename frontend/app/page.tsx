"use client";

import { useRouter } from "next/navigation";
import { useEffect } from 'react';
import { useAppState } from "@/hooks/useAppState";
import { Shield } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { deviceToken, userToken, isHydrated } = useAppState();

  useEffect(() => {
    if (!isHydrated) return;

    // Deterministic startup routing (Strict priority)
    if (deviceToken) {
      router.replace("/patient");
    } else if (userToken) {
      router.replace("/caregiver");
    } else {
      router.replace("/register");
    }
  }, [deviceToken, userToken, isHydrated, router]);

  // Loading screen while evaluating hydration and redirecting
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
      <div className="w-16 h-16 bg-[#1E3A8A] rounded-2xl flex items-center justify-center mb-4 shadow-sm animate-pulse">
        <Shield className="text-white" size={32} />
      </div>
    </main>
  );
}


