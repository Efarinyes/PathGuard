import L from 'leaflet';

const COLORS = {
  primary: '#1E3A8A',
  success: '#22C55E',
  warning: '#F59E0B',
  foreground: '#0F172A',
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

export type ConfidenceLevel = 'live' | 'recovered' | 'low_confidence' | 'stale';

const CONFIDENCE_CONFIG: Record<ConfidenceLevel, {
  color: string;
  pulseColor: string;
  weight: number;
  opacity: number;
  dashArray?: string;
}> = {
  live: { color: COLORS.primary, pulseColor: COLORS.success, weight: 3, opacity: 1.0 },
  recovered: { color: COLORS.warning, pulseColor: COLORS.warning, weight: 2, opacity: 0.8, dashArray: '10,10' },
  low_confidence: { color: COLORS.foreground, pulseColor: COLORS.foreground, weight: 2, opacity: 0.4, dashArray: '2,8' },
  stale: { color: COLORS.foreground, pulseColor: COLORS.foreground, weight: 1, opacity: 0.2, dashArray: '5,15' },
};

function formatBearingForAria(bearing: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(bearing / 22.5) % 16;
  return `Cap al ${directions[index]}`;
}

function buildArrowHtml(bearing: number, color: string, weight: number): string {
  const size = 16;
  const half = size / 2;
  const headHeight = 8;
  const headWidth = 6;
  const shaftWidth = Math.max(2, weight);
  
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(${bearing}deg); transform-origin: center;">
      <path
        d="M${half} 0 L${half - headWidth/2} ${headHeight} L${half - shaftWidth/2} ${headHeight} L${half - shaftWidth/2} ${size} L${half + shaftWidth/2} ${size} L${half + shaftWidth/2} ${headHeight} L${half + headWidth/2} ${headHeight} Z"
        fill="${color}"
        stroke="white"
        stroke-width="1.5"
      />
    </svg>
  `;
}

function buildIconHtml(bearing: number, confidence: ConfidenceLevel, showArrow: boolean): string {
  const config = CONFIDENCE_CONFIG[confidence];
  const { color, pulseColor, weight, opacity, dashArray } = config;
  
  const strokeDash = dashArray ? `stroke-dasharray: ${dashArray};` : '';
  const arrowHtml = showArrow ? buildArrowHtml(bearing, color, weight) : '';
  const ariaLabel = formatBearingForAria(bearing);

  return `
    <div style="position: relative; width: 28px; height: 28px;" aria-label="${ariaLabel}">
      <div style="
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        border: ${weight}px solid ${pulseColor};
        ${strokeDash}
        animation: map-pulse-${confidence === 'recovered' ? 'offline' : 'live'} 2s infinite ease-out;
        opacity: ${opacity * 0.5};
      "></div>
      <div style="
        position: absolute;
        top: 2px; left: 2px; right: 2px; bottom: 2px;
        border-radius: 50%;
        border: ${weight}px solid ${color};
        ${strokeDash}
        background: transparent;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        opacity: ${opacity};
      ">
        ${arrowHtml}
      </div>
    </div>
  `;
}

export const DirectionalPulseDotIcon = ({
  bearing,
  confidence = 'live',
  showArrow = true,
}: {
  bearing: number;
  confidence?: ConfidenceLevel;
  showArrow?: boolean;
}) => L.divIcon({
  className: 'custom-map-icon',
  html: buildIconHtml(bearing, confidence, showArrow),
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});