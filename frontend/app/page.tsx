'use client';

import Link from 'next/link';
import { Shield, Users, Heart, Smartphone } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-[#1E3A8A] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/20">
            <Shield className="text-white" size={40} />
          </div>
          
          <h1 className="text-4xl font-bold text-[#0F172A] mb-3 tracking-tight">
            PathGuard
          </h1>
          
          <p className="text-slate-500 text-lg mb-10">
            Protegeix els que més estimes amb seguiment en temps real
          </p>

          <div className="space-y-4">
            <Link
              href="/register"
              className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/10"
            >
              <Heart className="w-5 h-5" />
              Crear entorn familiar
            </Link>
            
            <Link
              href="/activate"
              className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-[#22C55E] hover:bg-[#22C55E]/90 text-white font-bold rounded-xl transition-all shadow-lg shadow-green-900/10"
            >
              <Smartphone className="w-5 h-5" />
              Activar dispositiu
            </Link>

            <Link
              href="/caregiver"
              className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-white border-2 border-slate-200 hover:border-[#1E3A8A]/30 text-[#0F172A] font-bold rounded-xl transition-all"
            >
              <Users className="w-5 h-5" />
              Accedir com a cuidador
            </Link>
          </div>

          <p className="text-slate-400 text-sm mt-8">
            Si ja formes part d&apos;un grup, demana al propietari un codi d&apos;invitació
          </p>
        </div>
      </div>
    </main>
  );
}