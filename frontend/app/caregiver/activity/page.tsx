'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/hooks/useAppState';
import { useOwnerData } from '@/hooks/useOwnerData';
import { useCaregiverAnalytics } from '@/hooks/useCaregiverAnalytics';
import LoginForm from '@/components/LoginForm';
import CaregiverHeader from '@/components/CaregiverDashboard/CaregiverHeader';
import CaregiverWalkHistory from '@/components/CaregiverDashboard/CaregiverWalkHistory';
import CaregiverAnalytics from '@/components/CaregiverDashboard/CaregiverAnalytics';
import WalkDetailModal from '@/components/WalkDetailModal';
import { WalkHistoryItem } from '@/services/walkService';

export default function ActivityPage() {
  const { userToken } = useAppState();
  const router = useRouter();
  const { patientName, isOwner, groupName, isLoading } = useOwnerData(userToken);

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
          <p className="text-slate-500 text-sm font-medium">Carregant activitat...</p>
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
          title="Activitat del familiar"
        />
      </div>

      {/* Contingut */}
      <main className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activitat del familiar</h1>
          <p className="text-slate-500 text-sm mt-1">Historial de passejos i tendències</p>
        </div>

        {/* Resum d'activitat */}
        {analytics && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6">
              <CaregiverAnalytics analytics={analytics} />
            </div>
          </section>
        )}

        {/* Historial de passejades */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-foreground font-bold text-base">Historial de passejades</h2>
          </div>
          <div className="p-2">
            <CaregiverWalkHistory walks={walks} onWalkClick={handleWalkClick} />
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
