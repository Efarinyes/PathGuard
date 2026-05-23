'use client';

import dynamic from 'next/dynamic';
import { LocationPayload } from '../../services/locationService';
import { MapErrorBoundary } from './MapErrorBoundary';

// Dynamically import the heavy map rendering component.
// This entirely disables Server-Side Rendering (SSR) for the leaflet logic,
// preventing "window is not defined" crashes during Next.js builds.
const DynamicMapRenderer = dynamic(() => import('./MapRenderer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] rounded-xl flex items-center justify-center bg-slate-50 border border-slate-200">
      <div className="flex flex-col items-center text-slate-400">
        <svg className="animate-spin h-8 w-8 mb-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm font-medium">Carregant el mapa...</span>
      </div>
    </div>
  ),
});

export interface CaregiverMapProps {
  locations: LocationPayload[];
  isPatientOffline?: boolean;
}

export default function CaregiverMap({ locations, isPatientOffline }: CaregiverMapProps) {
  return (
    <MapErrorBoundary>
      <DynamicMapRenderer locations={locations} isPatientOffline={isPatientOffline} />
    </MapErrorBoundary>
  );
}
