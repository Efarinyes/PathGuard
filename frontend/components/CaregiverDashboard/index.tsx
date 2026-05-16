'use client';

import React, { useEffect, useState } from 'react';
import CaregiverMap from '../CaregiverMap';
import NotificationBanner from '../NotificationBanner';
import InviteCaregiverModal from '../InviteCaregiverModal';
import { useLivePatientLocation } from '@/hooks/useLivePatientLocation';
import { useAppState } from '@/hooks/useAppState';
import { walkService } from '@/services/walkService';
import { useCaregiverAnalytics } from '@/hooks/useCaregiverAnalytics';
import { formatTimeAgo, formatBatteryTime } from '@/lib/formatTimeAgo';

import CaregiverHeader from './CaregiverHeader';
import PatientStatusCard from './PatientStatusCard';
import CaregiverAnalytics from './CaregiverAnalytics';
import CaregiverWalkHistory from './CaregiverWalkHistory';
import CaregiverDashboardLayout from './CaregiverDashboardLayout';

export default function CaregiverDashboard() {
  const { userToken } = useAppState();
  const { currentLocation, routeHistory, isConnected, isPatientConnected, isLoading, isActive, watchersCount, deviceStatus } = useLivePatientLocation();
  const [timeAgo, setTimeAgo] = useState<string>('Esperant dades...');
  const [batteryTimeAgo, setBatteryTimeAgo] = useState<string>('');
  const [isExtraInfoOpen, setIsExtraInfoOpen] = useState(false);
  const [isMonitoringPaused, setIsMonitoringPaused] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'info' | 'warning' } | null>(null);

  const [patientName, setPatientName] = useState<string>('el Pacient');
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [groupName, setGroupName] = useState<string>('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  const { walks, analytics } = useCaregiverAnalytics(userToken, isActive);

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
    if (!deviceStatus?.timestamp) return;

    const update = () => {
      setBatteryTimeAgo(formatBatteryTime(deviceStatus.timestamp));
    };

    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [deviceStatus]);

  useEffect(() => {
    if (isLoading || !isActive) return;

    if (!isPatientConnected) {
      setNotification({ message: 'El pacient ha perdut la cobertura', type: 'warning' });
    } else {
      setNotification({ message: 'El pacient ha recuperat la cobertura', type: 'info' });
    }
  }, [isPatientConnected, isActive, isLoading]);

  const renderMapSection = () => {
    if (routeHistory.length > 0 && !isMonitoringPaused) {
      return <CaregiverMap locations={routeHistory} isPatientOffline={!isPatientConnected} />;
    }
    return (
      <div className="w-full h-full min-h-[400px] border border-slate-200 rounded-xl bg-slate-100 flex flex-col items-center justify-center gap-4">
        <span className="text-slate-500 font-medium tracking-wide">
          {isMonitoringPaused ? 'Seguiment en temps real pausat' : 'Pendent de la primera connexió...'}
        </span>
      </div>
    );
  };

  return (
    <CaregiverDashboardLayout
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
          patientName={patientName}
          isConnected={isConnected}
          isActive={isActive}
          isPatientConnected={isPatientConnected}
          isMonitoringPaused={isMonitoringPaused}
          currentLocation={currentLocation}
          routeHistory={routeHistory}
          deviceStatus={deviceStatus}
          timeAgo={timeAgo}
          batteryTimeAgo={batteryTimeAgo}
          watchersCount={watchersCount}
          onPauseMonitoring={() => { setIsMonitoringPaused(true); setIsExtraInfoOpen(true); }}
          onResumeMonitoring={() => setIsMonitoringPaused(false)}
        />
      }
      analyticsSection={
        <CaregiverAnalytics
          analytics={analytics}
          walks={walks}
          isExtraInfoOpen={isExtraInfoOpen}
          onToggleInfo={() => setIsExtraInfoOpen(!isExtraInfoOpen)}
          onWalkClick={(id) => console.log('View walk map:', id)}
        />
      }
      walkHistory={
        <div className={`${isExtraInfoOpen ? 'block' : 'hidden'} transition-all duration-300 mt-6`}>
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
  );
}