'use client';

import React, { useEffect, useState } from 'react';

export type NotificationType = 'info' | 'success' | 'warning';

export interface NotificationBannerProps {
  message: string;
  type?: NotificationType;
  /** Automatically dismiss the notification after X milliseconds. 0 disables auto-dismiss. */
  durationMs?: number;
  onDismiss?: () => void;
  /** Position of the banner on screen. Default: bottom */
  position?: 'top' | 'bottom';
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
  onDismiss,
  position = 'bottom'
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
    info: 'bg-primary',      // Primary blue
    success: 'bg-success',   // Secondary green
    warning: 'bg-warning',   // Amber warning
  }[type];

  const positionClasses = position === 'top' ? 'top-6' : 'bottom-6';

  return (
    <div
      className={`fixed ${positionClasses} left-1/2 transform -translate-x-1/2 z-50 transition-opacity duration-500 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-white/95 backdrop-blur-sm shadow-sm border border-slate-200 px-6 py-3 rounded-full flex items-center gap-3">
        {/* Subtle dot indicator replacing heavy icons */}
        <span className={`h-2 w-2 rounded-full ${dotColorClass}`} />
        
        {/* Crisp, clean typography */}
        <span className="text-foreground font-medium text-sm tracking-wide">
          {message}
        </span>
      </div>
    </div>
  );
}
