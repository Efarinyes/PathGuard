'use client';

import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import { DirectionalPulseDotIcon, type ConfidenceLevel } from './CustomIcons';
import { LocationPayload } from '@/services/locationService';

interface CurrentPositionMarkerProps {
  coordinates: [number, number][];
  locations: LocationPayload[];
  currentIndex: number;
  isPatientOffline?: boolean;
}

const MIN_DISTANCE_M = 30;
const SMOOTHING_WINDOW = 3;

function haversine(
  a: [number, number],
  b: [number, number]
): number {
  const R = 6371000;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const aVal = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(aVal));
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}

function calculateBearing(a: [number, number], b: [number, number]): number {
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

function calculateSmoothedBearing(
  coords: [number, number][],
  windowSize = SMOOTHING_WINDOW
): number | null {
  if (coords.length < 2) return null;

  const recentCoords = coords
    .slice(-windowSize)
    .filter((_, i, arr) => i === 0 || haversine(arr[i - 1], arr[i]) > MIN_DISTANCE_M);

  if (recentCoords.length < 2) return null;

  let sinSum = 0;
  let cosSum = 0;
  for (let i = 1; i < recentCoords.length; i++) {
    const bearing = calculateBearing(recentCoords[i - 1], recentCoords[i]);
    sinSum += Math.sin(bearing * Math.PI / 180);
    cosSum += Math.cos(bearing * Math.PI / 180);
  }
  const avgBearing = Math.atan2(sinSum, cosSum) * 180 / Math.PI;
  return (avgBearing + 360) % 360;
}

function getCurrentConfidence(
  locations: LocationPayload[],
  currentIndex: number
): ConfidenceLevel {
  const loc = locations[currentIndex];
  if (!loc) return 'live';

  const age = Date.now() - new Date(loc.timestamp).getTime();

  if (loc.is_recovered) return 'recovered';
  // low_confidence not yet in frontend type, backend supports it
  if (age > 60_000) return 'stale';
  return 'live';
}

export default function CurrentPositionMarker({
  coordinates,
  locations,
  currentIndex,
  isPatientOffline,
}: CurrentPositionMarkerProps) {
  const bearing = useMemo(
    () => calculateSmoothedBearing(coordinates),
    [coordinates]
  );

  const confidence = useMemo(
    () => getCurrentConfidence(locations, currentIndex),
    [locations, currentIndex]
  );

  const position = coordinates[currentIndex];

  if (!position || bearing === null) return null;

  const effectiveOffline = isPatientOffline || confidence === 'recovered' || confidence === 'stale';

  return (
    <Marker
      position={position}
      icon={DirectionalPulseDotIcon({
        bearing,
        confidence,
        showArrow: true,
      })}
    />
  );
}