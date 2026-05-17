'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface SOSAlertData {
  patient_id: number;
  walk_id: number | null;
  sos_count: number;
  timestamp: string;
}

interface SOSAlertContextValue {
  activeAlert: SOSAlertData | null;
  showAlert: (data: SOSAlertData) => void;
  dismissAlert: () => void;
}

const SOSAlertContext = createContext<SOSAlertContextValue | undefined>(undefined);

export function SOSAlertProvider({ children }: { children: React.ReactNode }) {
  const [activeAlert, setActiveAlert] = useState<SOSAlertData | null>(null);

  const showAlert = useCallback((data: SOSAlertData) => {
    setActiveAlert(data);
  }, []);

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  return (
    <SOSAlertContext.Provider value={{ activeAlert, showAlert, dismissAlert }}>
      {children}
    </SOSAlertContext.Provider>
  );
}

export function useSOSAlert() {
  const context = useContext(SOSAlertContext);
  if (context === undefined) {
    throw new Error("useSOSAlert must be used within an SOSAlertProvider");
  }
  return context;
}