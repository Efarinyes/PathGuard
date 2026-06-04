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

export interface LocationSegment {
  coordinates: [number, number][];
  isRecovered: boolean;
}

export function perpendicularDistance(
  point: [number, number],
  start: [number, number],
  end: [number, number]
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const dLat = point[0] - start[0];
    const dLng = point[1] - start[1];
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }
  const t = Math.max(0, Math.min(1,
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSq
  ));
  const projLat = start[0] + t * dx;
  const projLng = start[1] + t * dy;
  const dLat = point[0] - projLat;
  const dLng = point[1] - projLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function douglasPeucker(
  points: [number, number][],
  epsilon: number
): [number, number][] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

export function segmentLocations(
  locations: LocationPayload[],
  epsilon?: number
): LocationSegment[] {
  const validLocations = locations.filter(
    (loc) => Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)
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

  if (epsilon !== undefined && epsilon > 0) {
    return segments.map((seg) => ({
      ...seg,
      coordinates: seg.isRecovered
        ? seg.coordinates
        : douglasPeucker(seg.coordinates, epsilon),
    }));
  }

  return segments;
}

export default function MapRenderer({ locations, isPatientOffline }: MapRendererProps) {
  const mapRef = useRef<LeafletMap | null>(null);

  const segments = useMemo(() => segmentLocations(locations, 0.00003), [locations]);

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
