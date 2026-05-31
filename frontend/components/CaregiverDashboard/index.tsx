'use client';

import React, { useEffect, useState } from 'react';
import CaregiverMap from '../CaregiverMap';
import NotificationBanner from '../NotificationBanner';
import SOSAlertModal from '../SOSAlertModal';
import { useLivePatientLocation } from '@/hooks/useLivePatientLocation';
import { useSOSAlert } from '@/hooks/useSOSAlert';
import { useAppState } from '@/hooks/useAppState';
import { useOwnerData } from '@/hooks/useOwnerData';
import { formatTimeAgo } from '@/lib/formatTimeAgo';

import CaregiverHeader from './CaregiverHeader';
import PatientStatusCard from './PatientStatusCard';
import CaregiverDashboardLayout from './CaregiverDashboardLayout';

export default function CaregiverDashboard() {
  const { userToken } = useAppState();
  const locationHook = useLivePatientLocation();
  const { currentLocation, routeHistory, isConnected, isPatientConnected, hasReceivedStatus, isLoading, isActive, latestSosData } = locationHook;
  const { showAlert } = useSOSAlert();
  const [timeAgo, setTimeAgo] = useState<string>('Esperant dades...');
  const [notification, setNotification] = useState<{ message: string, type: 'info' | 'warning' } | null>(null);

  const { patientName, isOwner, groupName } = useOwnerData(userToken);

  useEffect(() => {
    if (latestSosData) {
      showAlert(latestSosData);
    }
  }, [latestSosData, showAlert]);

  useEffect(() => {
    if (!currentLocation?.timestamp) return;

    const update = () => {
      setTimeAgo(formatTimeAgo(currentLocation.timestamp));
    };

    update();
    const updateTimer = setInterval(update, 1000);

    return () => clearInterval(updateTimer);
  }, [currentLocation]);

  useEffect(() => {
    if (isLoading || !isActive || !hasReceivedStatus) return;

    if (!isPatientConnected) {
      setNotification({ message: 'El familiar ha perdut la cobertura', type: 'warning' });
    } else {
      setNotification({ message: 'El familiar ha recuperat la cobertura', type: 'info' });
    }
  }, [isPatientConnected, isActive, isLoading, hasReceivedStatus]);

  const renderMapSection = () => {
    if (isActive && routeHistory.length > 0) {
      return <CaregiverMap locations={routeHistory} isPatientOffline={!isPatientConnected} />;
    }
    return (
      <div className="w-full h-full min-h-[400px] border border-slate-200 rounded-xl bg-slate-100 flex flex-col items-center justify-center gap-4">
        <span className="text-slate-500 font-medium tracking-wide">
          Pendent de la primera connexió...
        </span>
      </div>
    );
  };

  return (
    <>
      <CaregiverDashboardLayout
        headerSection={
          <CaregiverHeader
            patientName={patientName}
            isOwner={isOwner}
            groupName={groupName}
            title="Estat del passeig"
          />
        }
        mapSection={
          <>
            {notification && (
              <NotificationBanner
                message={notification.message}
                type={notification.type}
                onDismiss={() => setNotification(null)}
              />
            )}
            {renderMapSection()}
          </>
        }
        statusCard={
          <PatientStatusCard
            isConnected={isConnected}
            isActive={isActive}
            isPatientConnected={isPatientConnected}
            currentLocation={currentLocation}
            timeAgo={timeAgo}
          />
        }
      />
      <SOSAlertModal patientName={patientName} />
    </>
  );
}
