'use client';

import React, { createContext, useContext, useState, useEffect } from "react";

interface AppState {
  userToken: string | null;
  deviceToken: string | null;
  patientId: number | null;
  activeWalkId: number | null;
  isHydrated: boolean;
  setUserSession: (token: string) => void;
  setPatientSession: (token: string, id: number, caregiverToken?: string) => void;
  startWalk: (walkId: number) => void;
  endWalk: () => void;
  clearAll: () => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [activeWalkId, setActiveWalkId] = useState<number | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // 🔄 Hydration
  useEffect(() => {
    const storedUserToken = localStorage.getItem('pg_user_token');
    const storedDeviceToken = localStorage.getItem('pg_device_token');
    const storedPatientId = localStorage.getItem('pg_patient_id');
    const storedWalkId = localStorage.getItem('pg_active_walk_id');

    if (storedUserToken) setUserToken(storedUserToken);
    if (storedDeviceToken) setDeviceToken(storedDeviceToken);
    if (storedPatientId) setPatientId(parseInt(storedPatientId, 10));
    if (storedWalkId) setActiveWalkId(parseInt(storedWalkId, 10));
    
    setIsHydrated(true);
  }, []);

  // 💾 Persistence
  useEffect(() => {
    if (!isHydrated) return;
    if (userToken) localStorage.setItem('pg_user_token', userToken);
    else localStorage.removeItem('pg_user_token');
  }, [userToken, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (deviceToken) localStorage.setItem('pg_device_token', deviceToken);
    else localStorage.removeItem('pg_device_token');
  }, [deviceToken, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (patientId !== null) localStorage.setItem('pg_patient_id', patientId.toString());
    else localStorage.removeItem('pg_patient_id');
  }, [patientId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (activeWalkId !== null) localStorage.setItem('pg_active_walk_id', activeWalkId.toString());
    else localStorage.removeItem('pg_active_walk_id');
  }, [activeWalkId, isHydrated]);

  const setUserSession = (token: string) => setUserToken(token);
  
  const setPatientSession = (token: string, id: number, caregiverToken?: string) => {
    setDeviceToken(token);
    setPatientId(id);
    if (caregiverToken) {
      setUserToken(caregiverToken);
    } else {
      setUserToken(null);
    }
  };

  const startWalk = (walkId: number) => setActiveWalkId(walkId);
  const endWalk = () => setActiveWalkId(null);

  const clearAll = () => {
    setUserToken(null);
    setDeviceToken(null);
    setPatientId(null);
    setActiveWalkId(null);
  };

  return (
    <AppStateContext.Provider value={{
      userToken, deviceToken, patientId, activeWalkId, isHydrated,
      setUserSession, setPatientSession, startWalk, endWalk, clearAll
    }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}