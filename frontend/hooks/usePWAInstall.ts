import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallOptions {
  isPriority?: boolean;
}

export function usePWAInstall(options: PWAInstallOptions = {}) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIosFallback, setIsIosFallback] = useState(false);
  const [isMacSafari, setIsMacSafari] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let timerId: NodeJS.Timeout;

    const checkStandalone = () => {
      return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    };

    // 1. If already installed, do absolutely nothing
    if (checkStandalone()) {
      setIsVisible(false);
      return;
    }

    const showPrompt = (delay: number) => {
      clearTimeout(timerId);
      timerId = setTimeout(() => {
        if (!checkStandalone()) {
          setIsVisible(true);
        }
      }, delay);
    };

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setInstallPrompt(e);
      
      // Chromium/Brave detected - suppress Safari fallback
      setIsIosFallback(false);
      setIsMacSafari(false);
      
      showPrompt(options.isPriority ? 1000 : 4000);
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
      setInstallPrompt(null);
      (window as any).deferredPrompt = null;
      clearTimeout(timerId);
    };

    // Listener for custom event dispatched by head script
    const handleCustomPwaEvent = () => {
      const captured = (window as any).deferredPrompt;
      if (captured) {
        setInstallPrompt(captured);
        showPrompt(options.isPriority ? 1000 : 3000);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("pwa-installable", handleCustomPwaEvent);

    // 2. Browser/Event detection
    const capturedPrompt = (window as any).deferredPrompt;
    const supportsNativePrompt = 'onbeforeinstallprompt' in window;

    if (capturedPrompt) {
      setInstallPrompt(capturedPrompt);
      showPrompt(options.isPriority ? 1000 : 3000);
    } else if (!supportsNativePrompt) {
      // Fallback detection (Safari and other browsers without native prompt support)
      const isApple = /Apple/.test(window.navigator.vendor);
      
      if (isApple) {
        const ua = window.navigator.userAgent.toLowerCase();
        const isIos = /iphone|ipad|ipod/.test(ua);
        const isMac = /macintosh/.test(ua);

        if (isIos) {
          setIsIosFallback(true);
          showPrompt(options.isPriority ? 1500 : 5000);
        } else if (isMac) {
          setIsMacSafari(true);
          showPrompt(options.isPriority ? 2000 : 6000);
        }
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("pwa-installable", handleCustomPwaEvent);
      clearTimeout(timerId);
    };
  }, [options.isPriority]);

  const handleInstallClick = async () => {
    const promptToUse = installPrompt || (window as any).deferredPrompt;
    if (!promptToUse) return;
    
    try {
      await promptToUse.prompt();
      const { outcome } = await promptToUse.userChoice;
      if (outcome === "accepted") {
        setInstallPrompt(null);
        (window as any).deferredPrompt = null;
        setIsVisible(false);
      }
    } catch (err) {
      console.error("PWA Install failed", err);
    }
  };

  const dismissPrompt = () => setIsVisible(false);

  return {
    isVisible,
    isIosFallback,
    isMacSafari,
    handleInstallClick,
    dismissPrompt
  };
}
