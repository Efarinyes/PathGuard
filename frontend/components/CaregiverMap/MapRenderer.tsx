'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationPayload } from '../../services/locationService';
import { PulseDotIcon, StartFlagIcon } from './CustomIcons';

export interface MapRendererProps {
  locations: LocationPayload[];
}

export default function MapRenderer({ locations }: MapRendererProps) {
  const mapRef = useRef<LeafletMap | null>(null);

  // Derive coordinates array for the Polyline, filtering out any invalid data
  const coordinates: [number, number][] = locations
    .filter(loc => typeof loc.latitude === 'number' && typeof loc.longitude === 'number')
    .map((loc) => [loc.latitude, loc.longitude]);

  // Track the most recent and starting positions for markers
  const currentPosition = coordinates.length > 0 ? coordinates[coordinates.length - 1] : null;
  const startPosition = coordinates.length > 0 ? coordinates[0] : null;

  // Automatically pan map to track the current position as it updates
  useEffect(() => {
    if (mapRef.current && currentPosition) {
      mapRef.current.setView(currentPosition, mapRef.current.getZoom(), {
        animate: true,
        duration: 1.5,
      });
    }
  }, [currentPosition]);

  // Default fallback center if no route is available yet (e.g., center of Catalonia)
  const defaultCenter: [number, number] = [41.5912, 1.5209];

  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-slate-200">
      <MapContainer
        center={currentPosition || defaultCenter}
        zoom={15}
        ref={mapRef}
        className="w-full h-full z-0"
        zoomControl={false} // Disable default chunky UI controls to keep it minimal
      >
        {/* Subtle, standard map tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Route visualization: clean blue line */}
        {coordinates.length > 1 && (
          <Polyline 
            positions={coordinates} 
            color="#1E3A8A" // Primary PathGuard color
            weight={4}
            opacity={0.6}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Start Position Marker */}
        {startPosition && (
          <Marker position={startPosition} icon={StartFlagIcon} />
        )}

        {/* Current Position Pulse Indicator */}
        {currentPosition && (
          <Marker position={currentPosition} icon={PulseDotIcon} />
        )}
      </MapContainer>
    </div>
  );
}
