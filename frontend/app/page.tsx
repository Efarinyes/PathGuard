"use client";

import { useRouter } from "next/navigation";
import { useEffect } from 'react'
import { useAppState } from "@/hooks/useAppState";
import { User, HeartPulse, Shield, ClipboardList } from "lucide-react";
import { Button } from "@/components/shared/Button";

export default function Home() {
  const router = useRouter();
  const { deviceToken, userToken, isHydrated } = useAppState();

  useEffect(() => {
    if (!isHydrated) return;

    if (deviceToken) {
      router.push("/patient");
    } else if (userToken) {
      router.push("/caregiver");
    }
  }, [deviceToken, userToken, isHydrated, router]);


  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-[#0F172A] p-6">

      {/* Brand Identity */}
      <div className="flex flex-col items-center mb-12">
        <div className="w-16 h-16 bg-[#1E3A8A] rounded-2xl flex items-center justify-center mb-4 shadow-sm">
          <Shield className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-bold text-[#1E3A8A]">
          PathGuard
        </h1>
        <p className="text-slate-500 font-medium">Geo-protecció Discreta</p>
      </div>

      {/* Navigation Options */}
      <div className="w-full max-w-sm space-y-4">

        {/* Register / Registre */}
        <Button
          variant="primary"
          fullWidth
          onClick={() => router.push("/register")}
          className="py-8 gap-4 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90"
        >
          <ClipboardList size={24} />
          Registre
        </Button>

        {/* Patient Screen / Pantalla Pacient */}
        <Button
          variant="secondary"
          fullWidth
          onClick={() => router.push("/patient")}
          className="py-8 gap-4 bg-white border-slate-200 text-[#0F172A] hover:bg-slate-50"
        >
          <User size={24} />
          Pantalla Pacient
        </Button>

        {/* Caregiver Login / Accés Cuidador */}
        <Button
          variant="secondary"
          fullWidth
          onClick={() => router.push("/caregiver")}
          className="py-8 gap-4 bg-white border-slate-200 text-[#0F172A] hover:bg-slate-50"
        >
          <HeartPulse size={24} />
          Accés Cuidador
        </Button>

      </div>

      {/* Subtle Hint */}
      <p className="mt-12 text-sm text-slate-400 text-center max-w-[240px] leading-relaxed">
        Seguiment de geolocalització per a la tranquil·litat de la família.
      </p>
    </main>
  );
}

