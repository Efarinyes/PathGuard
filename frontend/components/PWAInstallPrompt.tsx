"use client";

import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useAppState } from "@/hooks/useAppState";
import { Smartphone, Monitor, Share, Download } from "lucide-react";

export function PWAInstallPrompt() {
  const { deviceToken } = useAppState();
  const { isVisible, isIosFallback, isMacSafari, handleInstallClick, dismissPrompt } = usePWAInstall({
    isPriority: !!deviceToken
  });

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-6 flex flex-col gap-4 max-w-lg mx-auto">
        <div className="flex items-start gap-4">
          <div className="bg-primary p-3.5 rounded-2xl shadow-lg shadow-primary/20 flex-shrink-0">
            {isIosFallback ? (
              <Smartphone className="text-white" size={24} />
            ) : isMacSafari ? (
              <Monitor className="text-white" size={24} />
            ) : (
              <Download className="text-white" size={24} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-slate-900 text-lg leading-tight">Instal·la PathGuard</h3>
            <p className="text-slate-500 mt-1.5 text-sm leading-relaxed font-medium">
              {isIosFallback 
                ? "Prem el botó de compartir (quadrat amb fletxa cap amunt) i selecciona 'Afegir a la pantalla d'inici'."
                : isMacSafari
                ? "Vés a Arxiu > 'Afegir al Dock' per tenir PathGuard sempre a mà."
                : "Afegeix l'aplicació a la teva pantalla d'inici per a un accés ràpid i seguiment continu."}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3 mt-1">
          <button 
            onClick={dismissPrompt}
            className="flex-1 px-4 py-3 text-sm font-bold text-slate-500 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all border border-slate-200/50"
          >
            Més tard
          </button>
          
          {(!isIosFallback && !isMacSafari) && (
            <button 
              onClick={handleInstallClick}
              className="flex-[2] px-6 py-3 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/10 flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Instal·lar ara
            </button>
          )}

          {(isIosFallback || isMacSafari) && (
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-100">
              <Share size={14} />
              {isIosFallback ? "Usa Safari" : "Usa el menú Arxiu"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
