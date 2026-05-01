"use client";

import { useEffect, useState } from "react";

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the default browser prompt
      e.preventDefault();
      // Store the event for later use
      setInstallPrompt(e);
      // Show our custom prompt after a short delay
      setTimeout(() => setIsVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    // Show the browser install prompt
    installPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setIsVisible(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <div className="bg-primary/10 p-3 rounded-xl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900">Instal·la PathGuard</h3>
            <p className="text-sm text-slate-500 leading-snug">
              Afegeix l'aplicació a la teva pantalla d'inici per a un accés ràpid i segur.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsVisible(false)}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Més tard
          </button>
          <button 
            onClick={handleInstallClick}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
          >
            Instal·lar ara
          </button>
        </div>
      </div>
    </div>
  );
}
