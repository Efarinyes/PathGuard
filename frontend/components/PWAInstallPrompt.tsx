"use client";

import { useEffect, useState } from "react";

export function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIosFallback, setIsIosFallback] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsVisible(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setTimeout(() => setIsVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // iOS Safari fallback detection
    const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const isSafari = /safari/.test(window.navigator.userAgent.toLowerCase()) && !/chrome/.test(window.navigator.userAgent.toLowerCase());
    
    if (isIos && isSafari) {
      setIsIosFallback(true);
      setTimeout(() => setIsVisible(true), 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
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
              {isIosFallback 
                ? "Prem el botó de compartir (quadrat amb fletxa cap amunt) i selecciona 'Afegir a la pantalla d'inici' per a una millor experiència."
                : "Afegeix l'aplicació a la teva pantalla d'inici per a un accés ràpid i segur."}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2 mt-2">
          <button 
            onClick={() => setIsVisible(false)}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Més tard
          </button>
          
          {!isIosFallback && (
            <button 
              onClick={handleInstallClick}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              Instal·lar ara
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
