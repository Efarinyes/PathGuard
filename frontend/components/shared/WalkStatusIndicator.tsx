"use client";

import React from "react";
import { Footprints, Circle } from "lucide-react";
import { translations } from "@/lib/i18n";

interface WalkStatusIndicatorProps {
  isWalking: boolean;
  language?: "ca" | "en";
  className?: string;
}

export const WalkStatusIndicator: React.FC<WalkStatusIndicatorProps> = ({
  isWalking,
  language = "ca",
  className = "",
}) => {
  const t = translations[language].patient;

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2 bg-white/50 backdrop-blur-sm rounded-full border border-gray-100 shadow-sm ${className}`}>
      {/* Subtle Icon */}
      <div className="shrink-0">
        {isWalking ? (
          <div className="relative flex items-center justify-center">
            {/* Pulsing effect for active state */}
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-secondary opacity-40"></span>
            <Footprints size={16} className="text-secondary relative" />
          </div>
        ) : (
          <Circle size={10} className="text-gray-300 fill-gray-300" />
        )}
      </div>

      {/* Status Text */}
      <span className={`text-sm font-semibold ${isWalking ? "text-secondary" : "text-gray-500"}`}>
        {isWalking ? t.status_active : t.status_inactive}
      </span>
    </div>
  );
};
