'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import { useOwnerData } from '@/hooks/useOwnerData';
import LoginForm from '@/components/LoginForm';
import CaregiverHeader from '@/components/CaregiverDashboard/CaregiverHeader';
import ActivationCodeDisplay from '@/components/ActivationCodeDisplay';
import SOSToggle from '@/components/SOSToggle';
import InviteCaregiverModal from '@/components/InviteCaregiverModal';

export default function OwnerDashboardPage() {
  const { userToken } = useAppState();
  const router = useRouter();
  const { patientName, isOwner, groupName, sosEnabled, isLoading } = useOwnerData(userToken);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [showActivationCode, setShowActivationCode] = useState(false);

  // Auth gate
  if (!userToken) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <LoginForm onLoginSuccess={() => { /* AppStateProvider ho gestiona */ }} />
      </main>
    );
  }

  // Owner guard — redirect non-owners
  if (!isLoading && !isOwner) {
    router.replace('/caregiver');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Carregant configuració...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header amb menú drawer */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 md:px-6 md:py-4">
        <CaregiverHeader
          patientName={patientName}
          isOwner={isOwner}
          groupName={groupName}
          title="Configuració del grup"
        />
      </div>

      {/* Contingut del dashboard */}
      <main className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuració del grup</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona el dispositiu i les preferències del familiar</p>
        </div>

        {/* 4.1.4: Codi d'activació (ocult per defecte) */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-foreground font-bold text-base">Dispositiu del familiar</h2>
          </div>
          <div className="p-6">
            {!showActivationCode ? (
              <button
                onClick={() => setShowActivationCode(true)}
                className="w-full py-3 px-4 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 border border-primary/20"
              >
                Codi activacio usuari
              </button>
            ) : (
              <div className="space-y-4">
                {userToken && <ActivationCodeDisplay token={userToken} />}
                <button
                  onClick={() => setShowActivationCode(false)}
                  className="w-full py-2 text-slate-500 text-sm font-medium hover:text-foreground transition-colors"
                >
                  Amagar codi
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 4.1.3: SOS Toggle */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-foreground font-bold text-base">SOS</h2>
          </div>
          <div className="p-6">
            {userToken && <SOSToggle token={userToken} initialEnabled={sosEnabled} />}
          </div>
        </section>

        {/* Cuidadors — afegir cuidador */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-foreground font-bold text-base">Cuidadors</h2>
          </div>
          <div className="p-6">
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="w-full py-3 px-4 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 border border-primary/20"
            >
              Afegir nou cuidador
            </button>
          </div>
        </section>
      </main>

      {isInviteModalOpen && (
        <InviteCaregiverModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          groupName={groupName}
        />
      )}
    </div>
  );
}
