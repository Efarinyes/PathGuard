import L from 'leaflet';

const COLORS = {
  primary: '#1E3A8A',
  success: '#22C55E',
  warning: '#F59E0B',
};

export const StartFlagIcon = L.divIcon({
  className: 'custom-map-icon',
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

export const PulseDotIcon = L.divIcon({
  className: 'custom-map-icon',
  html: `
    <div style="
      position: relative;
      width: 24px;
      height: 24px;
    ">
      <div style="
        position: absolute;
        inset: -2px;
        background-color: ${COLORS.success};
        border-radius: 50%;
        animation: map-pulse 2s infinite ease-out;
        opacity: 0.5;
      "></div>
      <div style="
        position: absolute;
        top: 2px; left: 2px; right: 2px; bottom: 2px;
        background-color: ${COLORS.success};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export const OfflinePulseDotIcon = L.divIcon({
  className: 'custom-map-icon',
  html: `
    <div style="
      position: relative;
      width: 24px;
      height: 24px;
    ">
      <div style="
        position: absolute;
        inset: -2px;
        background-color: ${COLORS.warning};
        border-radius: 50%;
        animation: map-pulse-offline 2s infinite ease-out;
        opacity: 0.5;
      "></div>
      <div style="
        position: absolute;
        top: 2px; left: 2px; right: 2px; bottom: 2px;
        background-color: ${COLORS.warning};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});