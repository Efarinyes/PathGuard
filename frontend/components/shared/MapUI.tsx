"use client";

import React from "react";

interface MapUIProps {
  currentPos?: { lat: number; lng: number };
  route?: Array<{ lat: number; lng: number }>;
  className?: string;
  label?: string;
}

export const MapUI: React.FC<MapUIProps> = ({
  className = "",
  label = "Mataró, Centre"
}) => {
  // Mock SVG Map to follow PathGuard rules strictly without external deps
  return (
    <div className={`relative w-full aspect-video bg-blue-50/30 rounded-xl overflow-hidden border border-blue-100/50 ${className}`}>
      {/* Grid Pattern Background */}
      <svg className="absolute inset-0 w-full h-full opacity-10" width="100%" height="100%">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Route Line (Light Blue Line) */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
        <path
          d="M 50 150 Q 150 50 250 120 T 350 80"
          fill="none"
          stroke="#93C5FD" // Light blue (blue-300)
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-70"
        />
      </svg>

      {/* Current Position (Soft Blue Dot) */}
      <div className="absolute left-[340px] top-[75px]">
        <div className="relative flex h-6 w-6">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-20"></span>
          <span className="relative inline-flex rounded-full h-6 w-6 bg-primary border-4 border-white shadow-sm"></span>
        </div>
      </div>

      {/* Minimal Overlay Info */}
      <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-primary shadow-sm">
        {label}
      </div>
    </div>
  );
};
