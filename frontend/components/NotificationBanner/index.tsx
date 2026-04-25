'use client';

import React, { useEffect, useState } from 'react';

export type NotificationType = 'info' | 'success' | 'warning';

export interface NotificationBannerProps {
  message: string;
  type?: NotificationType;
  /** Automatically dismiss the notification after X milliseconds. 0 disables auto-dismiss. */
  durationMs?: number;
  onDismiss?: () => void;
}

/**
 * A highly subtle Notification Banner.
 * Designed specifically to avoid "flashing" or aggressive UX.
 * Renders cleanly at the bottom center of the screen avoiding standard icon libraries.
 */
export default function NotificationBanner({ 
  message, 
  type = 'info', 
  durationMs = 4000,
  onDismiss 
}: NotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Trigger a soft fade-in on mount
  useEffect(() => {
    // Slight delay to allow DOM render before triggering opacity transition
    const showTimer = setTimeout(() => setIsVisible(true), 50);
    
    let hideTimer: NodeJS.Timeout;
    if (durationMs > 0) {
      hideTimer = setTimeout(() => {
        setIsVisible(false);
        if (onDismiss) {
          // Wait for fade-out transition to complete before totally unmounting/dismissing
          setTimeout(onDismiss, 500);
        }
      }, durationMs);
    }

    return () => {
      clearTimeout(showTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [durationMs, onDismiss]);

  // Determine the subtle semantic dot color based on the PathGuard design system
  const dotColorClass = {
    info: 'bg-[#1E3A8A]',      // Primary blue
    success: 'bg-[#22C55E]',   // Secondary green
    warning: 'bg-[#F59E0B]',   // Amber warning
  }[type];

  return (
    <div 
      className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 transition-opacity duration-500 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-white/95 backdrop-blur-sm shadow-sm border border-slate-200 px-6 py-3 rounded-full flex items-center gap-3">
        {/* Subtle dot indicator replacing heavy icons */}
        <span className={`h-2 w-2 rounded-full ${dotColorClass}`} />
        
        {/* Crisp, clean typography */}
        <span className="text-[#0F172A] font-medium text-sm tracking-wide">
          {message}
        </span>
      </div>
    </div>
  );
}
