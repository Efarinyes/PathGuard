import L from 'leaflet';

/**
 * Custom Minimalist Map Icons using pure CSS/HTML
 * Bypasses Leaflet's default image loading, reducing network requests,
 * and perfectly matches the calm, non-alarming PathGuard color palette.
 */

// Colors drawn directly from the mandatory design system
const COLORS = {
  primary: '#1E3A8A', // Trust/Route
  secondary: '#22C55E', // Safe active state
};

// Start Point Flag
export const StartFlagIcon = L.divIcon({
  className: 'custom-map-icon', // Use custom class to strip defaults
  // Uses primary color, minimal footprint
  html: `
    <div style="
      background-color: ${COLORS.primary};
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    "></div>
  `,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Current Position Pulsing Dot
export const PulseDotIcon = L.divIcon({
  className: 'custom-map-icon',
  html: `
    <div style="
      position: relative;
      width: 14px;
      height: 14px;
    ">
      <!-- Outer Pulse -->
      <div style="
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: ${COLORS.primary};
        border-radius: 50%;
        animation: map-pulse 2s infinite ease-out;
        opacity: 0.5;
      "></div>
      
      <!-- Inner Solid Dot -->
      <div style="
        position: absolute;
        top: 2px; left: 2px; right: 2px; bottom: 2px;
        background-color: ${COLORS.primary};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      "></div>
    </div>
    
    <style>
      @keyframes map-pulse {
        0% { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(2.5); opacity: 0; }
      }
      .custom-map-icon {
        background: transparent !important;
        border: none !important;
      }
    </style>
  `,
  iconSize: [20, 20], // Make touch/mouse hit area slightly larger
  iconAnchor: [10, 10], // Center the anchor point directly underneath the dot
});
