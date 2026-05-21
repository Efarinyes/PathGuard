'use client';

import React, { ReactNode } from 'react';

interface CaregiverDashboardLayoutProps {
  headerSection: ReactNode;
  mapSection: ReactNode;
  statusCard: ReactNode;
  analyticsSection?: ReactNode;
  walkHistory?: ReactNode;
  inviteModal: ReactNode;
}

export default function CaregiverDashboardLayout({
  headerSection,
  mapSection,
  statusCard,
  analyticsSection,
  walkHistory,
  inviteModal,
}: CaregiverDashboardLayoutProps) {
  return (
    <div className="w-full flex flex-col md:flex-row gap-6 p-4 md:p-6 bg-[#F8FAFC] min-h-screen">
      <div className="flex-grow order-1 md:order-1 h-[60vh] md:h-auto">
        {mapSection}
      </div>

      <div className="w-full md:w-[350px] shrink-0 order-2 md:order-2">
        {headerSection}
        {statusCard}
        {analyticsSection}
        {walkHistory}
      </div>

      {inviteModal}
    </div>
  );
}