'use client';

import React, { useEffect, useState } from 'react';
import CaregiverMap from '../CaregiverMap';
import NotificationBanner from '../NotificationBanner';
import InviteCaregiverModal from '../InviteCaregiverModal';
import SOSAlertModal from '../SOSAlertModal';
import { useLivePatientLocation } from '@/hooks/useLivePatientLocation';
import { useSOSAlert } from '@/hooks/useSOSAlert';
import { useAppState } from '@/hooks/useAppState';
import { walkService } from '@/services/walkService';
import { useCaregiverAnalytics } from '@/hooks/useCaregiverAnalytics';
import { formatTimeAgo } from '@/lib/formatTimeAgo';

import CaregiverHeader from './CaregiverHeader';
import PatientStatusCard from './PatientStatusCard';
import CaregiverWalkHistory from './CaregiverWalkHistory';
import CaregiverDashboardLayout from './CaregiverDashboardLayout';

export default function CaregiverDashboard() {
  const { userToken } = useAppState();
  const locationHook = useLivePatientLocation();
  const { currentLocation, routeHistory, isConnected, isPatientConnected, isLoading, isActive, latestSosData } = locationHook;
  const { showAlert } = useSOSAlert();
  const [timeAgo, setTimeAgo] = useState<string>('Esperant dades...');
  const [notification, setNotification] = useState<{ message: string, type: 'info' | 'warning' } | null>(null);

  const [patientName, setPatientName] = useState<string>('el Pacient');
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [groupName, setGroupName] = useState<string>('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const { walks } = useCaregiverAnalytics(userToken, isActive);

  useEffect(() => {
    if (latestSosData) {
      showAlert(latestSosData);
    }
  }, [latestSosData, showAlert]);

  useEffect(() => {
    if (!userToken) return;

    walkService.getUserGroupInfo(userToken)
      .then(data => {
        setPatientName(data.patient_name);
        setIsOwner(data.is_owner);
        setGroupName(data.group_name);
      })
      .catch(err => {
        console.error('Error fetching group info:', err);
      });
  }, [userToken]);

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
    if (isLoading || !isActive) return;

    if (!isPatientConnected) {
      setNotification({ message: 'El familiar ha perdut la cobertura', type: 'warning' });
    } else {
      setNotification({ message: 'El familiar ha recuperat la cobertura', type: 'info' });
    }
  }, [isPatientConnected, isActive, isLoading]);

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
            onInviteClick={() => setIsInviteModalOpen(true)}
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
            routeHistory={routeHistory}
            timeAgo={timeAgo}
          />
        }
        walkHistory={
          <div className="mt-6">
            <CaregiverWalkHistory walks={walks} onWalkClick={(id) => console.log('View walk map:', id)} />
          </div>
        }
        inviteModal={
          <InviteCaregiverModal
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            groupName={groupName}
          />
        }
      />
      <SOSAlertModal patientName={patientName} />
    </>
  );
}