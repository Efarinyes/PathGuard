'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import { useOwnerData } from '@/hooks/useOwnerData';
import { useCaregiverAnalytics } from '@/hooks/useCaregiverAnalytics';
import LoginForm from '@/components/LoginForm';
import CaregiverHeader from '@/components/CaregiverDashboard/CaregiverHeader';
import ActivationCodeDisplay from '@/components/ActivationCodeDisplay';
import SOSToggle from '@/components/SOSToggle';
import CaregiverAnalytics from '@/components/CaregiverDashboard/CaregiverAnalytics';
import CaregiverWalkHistory from '@/components/CaregiverDashboard/CaregiverWalkHistory';
import WalkDetailModal from '@/components/WalkDetailModal';
import { WalkHistoryItem } from '@/services/walkService';

export default function OwnerDashboardPage() {
  const { userToken } = useAppState();
  const router = useRouter();
  const { patientName, isOwner, groupName, sosEnabled, isLoading } = useOwnerData(userToken);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [showActivationCode, setShowActivationCode] = useState(false);
  const [selectedWalk, setSelectedWalk] = useState<WalkHistoryItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { walks, analytics } = useCaregiverAnalytics(userToken, false);

  const handleWalkClick = (walkId: number) => {
    const walk = walks.find(w => w.id === walkId) || null;
    setSelectedWalk(walk);
    setIsDetailModalOpen(true);
  };

  // Auth gate
  if (!userToken) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Carregant configuració...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header amb menú drawer */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 md:px-6 md:py-4">
        <CaregiverHeader
          patientName={patientName}
          isOwner={isOwner}
          groupName={groupName}
          onInviteClick={() => setIsInviteModalOpen(true)}
        />
      </div>

      {/* Contingut del dashboard */}
      <main className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Configuració del grup</h1>
          <p className="text-slate-500 text-sm mt-1">Gestiona el dispositiu i les preferències del familiar</p>
        </div>

        {/* 4.1.4: Codi d'activació (ocult per defecte) */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-[#0F172A] font-bold text-base">Dispositiu del familiar</h2>
          </div>
          <div className="p-6">
            {!showActivationCode ? (
              <button
                onClick={() => setShowActivationCode(true)}
                className="w-full py-3 px-4 bg-[#1E3A8A]/10 hover:bg-[#1E3A8A]/20 text-[#1E3A8A] font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 border border-[#1E3A8A]/20"
              >
                Codi activacio usuari
              </button>
            ) : (
              <div className="space-y-4">
                {userToken && <ActivationCodeDisplay token={userToken} />}
                <button
                  onClick={() => setShowActivationCode(false)}
                  className="w-full py-2 text-slate-500 text-sm font-medium hover:text-[#0F172A] transition-colors"
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
            <h2 className="text-[#0F172A] font-bold text-base">SOS</h2>
          </div>
          <div className="p-6">
            {userToken && <SOSToggle token={userToken} initialEnabled={sosEnabled} />}
          </div>
        </section>

        {/* 4.1.2: Historial de passejades */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-[#0F172A] font-bold text-base">Historial de passejades</h2>
          </div>
          <div className="p-2">
            <CaregiverWalkHistory walks={walks} onWalkClick={handleWalkClick} />
          </div>
        </section>

        {/* 4.1.5: CaregiverAnalytics (opt-in) */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-[#0F172A] font-bold text-base">Informació d'activitat</h2>
          </div>
          <div className="p-4">
            <CaregiverAnalytics
              analytics={analytics}
              walks={walks}
              isExtraInfoOpen={isAnalyticsOpen}
              onToggleInfo={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
              onWalkClick={(id) => console.log('View walk:', id)}
            />
          </div>
        </section>
      </main>

      {/* Modal de detall del passeig */}
      <WalkDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        walk={selectedWalk}
        token={userToken || ''}
      />
    </div>
  );
}
