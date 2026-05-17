'use client';

import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationPayload } from '../../services/locationService';
import { PulseDotIcon, StartFlagIcon, OfflinePulseDotIcon } from './CustomIcons';

export interface MapRendererProps {
  locations: LocationPayload[];
  isPatientOffline?: boolean;
}

interface LocationSegment {
  coordinates: [number, number][];
  isRecovered: boolean;
}

function segmentLocations(locations: LocationPayload[]): LocationSegment[] {
  const validLocations = locations.filter(
    (loc) => typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
  );

  if (validLocations.length === 0) return [];

  const segments: LocationSegment[] = [];
  let currentSegment: [number, number][] = [];
  let currentIsRecovered: boolean | undefined;

  for (const loc of validLocations) {
    const coord: [number, number] = [loc.latitude, loc.longitude];
    const isRecovered = loc.is_recovered ?? false;

    if (currentIsRecovered === undefined) {
      currentIsRecovered = isRecovered;
    }

    if (isRecovered === currentIsRecovered) {
      currentSegment.push(coord);
    } else {
      if (currentSegment.length > 0) {
        segments.push({
          coordinates: currentSegment,
          isRecovered: currentIsRecovered,
        });
      }
      currentSegment = [coord];
      currentIsRecovered = isRecovered;
    }
  }

  if (currentSegment.length > 0) {
    segments.push({
      coordinates: currentSegment,
      isRecovered: currentIsRecovered ?? false,
    });
  }

  return segments;
}

export default function MapRenderer({ locations, isPatientOffline }: MapRendererProps) {
  const mapRef = useRef<LeafletMap | null>(null);

  const segments = useMemo(() => segmentLocations(locations), [locations]);

  const allCoordinates = useMemo(
    () => segments.flatMap((seg) => seg.coordinates),
    [segments]
  );

  const currentPosition = allCoordinates.length > 0 ? allCoordinates[allCoordinates.length - 1] : null;
  const startPosition = allCoordinates.length > 0 ? allCoordinates[0] : null;

  useEffect(() => {
    if (mapRef.current && currentPosition) {
      mapRef.current.setView(currentPosition, mapRef.current.getZoom(), {
        animate: true,
        duration: 1.5,
      });
    }
  }, [currentPosition]);

  const defaultCenter: [number, number] = [41.5912, 1.5209];

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-slate-200">
      <MapContainer
        center={currentPosition || defaultCenter}
        zoom={15}
        ref={mapRef}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {segments.map((segment, index) =>
          segment.coordinates.length > 1 ? (
            <Polyline
              key={index}
              positions={segment.coordinates}
              color={segment.isRecovered ? '#F59E0B' : '#1E3A8A'}
              weight={4}
              opacity={0.6}
              lineCap="round"
              lineJoin="round"
              dashArray={segment.isRecovered ? '10, 10' : undefined}
            />
          ) : null
        )}

        {startPosition && (
          <Marker position={startPosition} icon={StartFlagIcon} />
        )}

        {currentPosition && (
          <Marker position={currentPosition} icon={isPatientOffline ? OfflinePulseDotIcon : PulseDotIcon} />
        )}
      </MapContainer>

    </div>
  );
}
