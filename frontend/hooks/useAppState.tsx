'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useOfflineRecovery } from "./useOfflineRecovery";
import { STORAGE_KEYS } from "@/lib/config";

interface AppState {
  userToken: string | null;
  deviceToken: string | null;
  patientId: number | null;
  activeWalkId: number | null;
  sosEnabled: boolean;
  isHydrated: boolean;
  setUserSession: (token: string) => void;
  setPatientSession: (token: string, id: number) => void;
  startWalk: (walkId: number) => void;
  endWalk: () => void;
  setSosEnabled: (enabled: boolean) => void;
  clearAll: () => void;
  clearUserSession: () => void;
}


const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [userToken, setUserToken] = useState<string | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [activeWalkId, setActiveWalkId] = useState<number | null>(null);
  const [sosEnabled, setSosEnabled] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const hydrationRef = useRef(false);

  useOfflineRecovery();

  useEffect(() => {
    if (hydrationRef.current) return;

    const storedUserToken = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
    const storedDeviceToken = localStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN);
    const storedPatientId = localStorage.getItem(STORAGE_KEYS.PATIENT_ID);
    const storedWalkId = localStorage.getItem(STORAGE_KEYS.ACTIVE_WALK_ID);

    if (storedUserToken) setUserToken(storedUserToken);
    if (storedDeviceToken) setDeviceToken(storedDeviceToken);
    if (storedPatientId) setPatientId(parseInt(storedPatientId, 10));
    if (storedWalkId) setActiveWalkId(parseInt(storedWalkId, 10));
    
    setIsHydrated(true);
    hydrationRef.current = true;
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.USER_TOKEN) setUserToken(e.newValue);
      if (e.key === STORAGE_KEYS.DEVICE_TOKEN) setDeviceToken(e.newValue);
      if (e.key === STORAGE_KEYS.PATIENT_ID) setPatientId(e.newValue ? parseInt(e.newValue, 10) : null);
      if (e.key === STORAGE_KEYS.ACTIVE_WALK_ID) setActiveWalkId(e.newValue ? parseInt(e.newValue, 10) : null);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (userToken) localStorage.setItem(STORAGE_KEYS.USER_TOKEN, userToken);
    else localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
  }, [userToken, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (deviceToken) localStorage.setItem(STORAGE_KEYS.DEVICE_TOKEN, deviceToken);
    else localStorage.removeItem(STORAGE_KEYS.DEVICE_TOKEN);
  }, [deviceToken, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (patientId !== null) localStorage.setItem(STORAGE_KEYS.PATIENT_ID, patientId.toString());
    else localStorage.removeItem(STORAGE_KEYS.PATIENT_ID);
  }, [patientId, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    if (activeWalkId !== null) localStorage.setItem(STORAGE_KEYS.ACTIVE_WALK_ID, activeWalkId.toString());
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_WALK_ID);
  }, [activeWalkId, isHydrated]);

  const setUserSession = (token: string) => setUserToken(token);

  const setPatientSession = (token: string, id: number) => {
    setDeviceToken(token);
    setPatientId(id);
  };

  const startWalk = (walkId: number) => setActiveWalkId(walkId);
  const endWalk = () => setActiveWalkId(null);

  const clearAll = () => {
    setUserToken(null);
    setDeviceToken(null);
    setPatientId(null);
    setActiveWalkId(null);
    setSosEnabled(false);
  };

  const clearUserSession = () => {
    setUserToken(null);
  };

  return (
    <AppStateContext.Provider value={{
      userToken, deviceToken, patientId, activeWalkId, sosEnabled, isHydrated,
      setUserSession, setPatientSession, startWalk, endWalk, setSosEnabled, clearAll, clearUserSession
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