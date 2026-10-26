import React from 'react';
import { IptvChannel } from '../utils/m3uParser';

interface ChannelArtworkProps {
  channel: IptvChannel;
  className?: string;
  showCallSign?: boolean;
}

interface SceneTheme {
  skyTop: string;
  skyBottom: string;
  glowPrimary: string;
  glowSecondary: string;
  accent: string;
  sceneType:
    | 'cyberpunk'
    | 'alpine'
    | 'citadel'
    | 'orbital'
    | 'newsroom'
    | 'tokyo'
    | 'paris'
    | 'forest'
    | 'noir'
    | 'glacier'
    | 'concert'
    | 'terrace';
}

function getSceneTheme(channel: IptvChannel): SceneTheme {
  const id = channel.id.toLowerCase();
  if (id.includes('kinowave')) {
    return {
      skyTop: '#0F0A1C',
      skyBottom: '#2A112B',
      glowPrimary: '#E11D48',
      glowSecondary: '#F59E0B',
      accent: '#FB7185',
      sceneType: 'cyberpunk',
    };
  }
  if (id.includes('redbull') || channel.category === 'Sports') {
    return {
      skyTop: '#071624',
      skyBottom: '#0E2A38',
      glowPrimary: '#06B6D4',
      glowSecondary: '#3B82F6',
      accent: '#38BDF8',
      sceneType: 'alpine',
    };
  }
  if (id.includes('sintel')) {
    return {
      skyTop: '#1F1118',
      skyBottom: '#3B1D1A',
      glowPrimary: '#F97316',
      glowSecondary: '#E11D48',
      accent: '#FDBA74',
      sceneType: 'citadel',
    };
  }
  if (id.includes('nasa') || channel.category === 'Sci-Fi & Tech') {
    return {
      skyTop: '#050814',
      skyBottom: '#0F1A3A',
      glowPrimary: '#3B82F6',
      glowSecondary: '#6366F1',
      accent: '#60A5FA',
      sceneType: 'orbital',
    };
  }
  if (id.includes('nhk')) {
    return {
      skyTop: '#111326',
      skyBottom: '#291730',
      glowPrimary: '#EC4899',
      glowSecondary: '#6366F1',
      accent: '#F472B6',
      sceneType: 'tokyo',
    };
  }
  if (id.includes('france24')) {
    return {
      skyTop: '#0B1628',
      skyBottom: '#182942',
      glowPrimary: '#38BDF8',
      glowSecondary: '#E11D48',
      accent: '#7DD3FC',
      sceneType: 'paris',
    };
  }
  if (id.includes('animation') || channel.category === 'Animation') {
    return {
      skyTop: '#0E1F22',
      skyBottom: '#1B3830',
      glowPrimary: '#10B981',
      glowSecondary: '#FBBF24',
      accent: '#34D399',
      sceneType: 'forest',
    };
  }
  if (id.includes('criterion') || id.includes('noir')) {
    return {
      skyTop: '#0E1015',
      skyBottom: '#222632',
      glowPrimary: '#F59E0B',
      glowSecondary: '#94A3B8',
      accent: '#FCD34D',
      sceneType: 'noir',
    };
  }
  if (id.includes('alpine') || channel.category === 'Documentary') {
    return {
      skyTop: '#091A1E',
      skyBottom: '#143336',
      glowPrimary: '#14B8A6',
      glowSecondary: '#0EA5E9',
      accent: '#2DD4BF',
      sceneType: 'glacier',
    };
  }
  if (id.includes('berlin') || channel.category === 'Music') {
    return {
      skyTop: '#1B0D24',
      skyBottom: '#2E1230',
      glowPrimary: '#D946EF',
      glowSecondary: '#F43F5E',
      accent: '#F0ABFC',
      sceneType: 'concert',
    };
  }
  if (id.includes('epic') || channel.category === 'Lifestyle') {
    return {
      skyTop: '#21130D',
      skyBottom: '#382014',
      glowPrimary: '#F59E0B',
      glowSecondary: '#EA580C',
      accent: '#FBBF24',
      sceneType: 'terrace',
    };
  }
  if (channel.category === 'News') {
    return {
      skyTop: '#0A1324',
      skyBottom: '#142442',
      glowPrimary: '#2563EB',
      glowSecondary: '#06B6D4',
      accent: '#60A5FA',
      sceneType: 'newsroom',
    };
  }
  return {
    skyTop: '#140D1F',
    skyBottom: '#29152C',
    glowPrimary: '#E11D48',
    glowSecondary: '#F59E0B',
    accent: '#FB7185',
    sceneType: 'cyberpunk',
  };
}

export const ChannelArtwork: React.FC<ChannelArtworkProps> = ({
  channel,
  className = '',
  showCallSign = true,
}) => {
  const theme = getSceneTheme(channel);
  const uid = `scene-${channel.id.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div
      className={`relative overflow-hidden select-none bg-[#0B0E17] ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 640 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="640" y2="360" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={theme.skyTop} />
            <stop offset="100%" stopColor={theme.skyBottom} />
          </linearGradient>

          <radialGradient
            id={`${uid}-sun`}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(450 135) rotate(130) scale(290 220)"
          >
            <stop offset="0%" stopColor={theme.glowPrimary} stopOpacity="0.55" />
            <stop offset="50%" stopColor={theme.glowSecondary} stopOpacity="0.22" />
            <stop offset="100%" stopColor={theme.skyTop} stopOpacity="0" />
          </radialGradient>

          <linearGradient id={`${uid}-horizon`} x1="0" y1="180" x2="0" y2="360" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={theme.glowPrimary} stopOpacity="0.18" />
            <stop offset="100%" stopColor="#07090E" stopOpacity="0.96" />
          </linearGradient>

          <linearGradient id={`${uid}-scrim`} x1="0" y1="0" x2="0" y2="360" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#07090E" stopOpacity="0.55" />
            <stop offset="40%" stopColor="#07090E" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#07090E" stopOpacity="0.92" />
          </linearGradient>
        </defs>

        {/* Base Atmospheric Sky & Volumetric Glow */}
        <rect width="640" height="360" fill={`url(#${uid}-sky)`} />
        <rect width="640" height="360" fill={`url(#${uid}-sun)`} />

        {/* Subtle Anamorphic Lens Flare & Film Perspective Grid */}
        <ellipse cx="450" cy="135" rx="220" ry="3" fill={theme.accent} fillOpacity="0.22" />
        <circle cx="450" cy="135" r="56" fill={theme.glowPrimary} fillOpacity="0.24" />
        <circle cx="450" cy="135" r="32" fill={theme.accent} fillOpacity="0.35" />

        {/* Scene-Specific Rich Architectural / Landscape Silhouettes */}
        {theme.sceneType === 'cyberpunk' && (
          <g>
            {/* Distant Metropolis Skyline */}
            <path
              d="M0 270 L55 270 L55 185 L95 185 L95 235 L130 235 L130 150 L185 150 L185 250 L225 250 L225 170 L280 170 L280 240 L335 240 L335 125 L395 125 L395 255 L440 255 L440 165 L505 165 L505 230 L555 230 L555 140 L605 140 L605 260 L640 260 L640 360 L0 360 Z"
              fill="#0B0E17"
              fillOpacity="0.88"
            />
            {/* Illuminated Tower Windows & Neon Beams */}
            <rect x="142" y="165" width="6" height="65" fill={theme.accent} fillOpacity="0.45" />
            <rect x="350" y="140" width="8" height="90" fill={theme.glowSecondary} fillOpacity="0.5" />
            <rect x="570" y="155" width="6" height="75" fill={theme.glowPrimary} fillOpacity="0.5" />
            <path d="M0 285 H640" stroke={theme.accent} strokeOpacity="0.3" strokeWidth="1.5" />
          </g>
        )}

        {(theme.sceneType === 'alpine' || theme.sceneType === 'glacier') && (
          <g>
            {/* Distant Mountain Range */}
            <path
              d="M0 280 L110 165 L205 235 L330 115 L455 225 L545 145 L640 245 L640 360 L0 360 Z"
              fill="#0E1B28"
              fillOpacity="0.85"
            />
            {/* Highlighted Ridges */}
            <path
              d="M330 115 L395 225 L310 250 Z"
              fill={theme.accent}
              fillOpacity="0.22"
            />
            <path
              d="M545 145 L595 245 L525 255 Z"
              fill={theme.glowPrimary}
              fillOpacity="0.18"
            />
            {/* Foreground Slope */}
            <path
              d="M0 295 L230 195 L410 275 L640 215 L640 360 L0 360 Z"
              fill="#080D15"
              fillOpacity="0.95"
            />
          </g>
        )}

        {theme.sceneType === 'citadel' && (
          <g>
            {/* Desert Dunes & Ancient Spire */}
            <path
              d="M0 275 Q160 210 340 255 T640 225 L640 360 L0 360 Z"
              fill="#1A0E12"
              fillOpacity="0.9"
            />
            <path d="M260 255 L285 135 L310 255 Z" fill={theme.accent} fillOpacity="0.28" />
            {/* Soaring Dragon / Wing Motif */}
            <path
              d="M390 115 Q435 90 470 120 Q505 90 545 110 Q495 130 470 145 Q435 125 390 115 Z"
              fill={theme.accent}
              fillOpacity="0.65"
            />
          </g>
        )}

        {theme.sceneType === 'orbital' && (
          <g>
            {/* Earth Atmospheric Limb Curve */}
            <ellipse
              cx="320"
              cy="470"
              rx="490"
              ry="230"
              fill="#081229"
              stroke={theme.accent}
              strokeOpacity="0.55"
              strokeWidth="3"
            />
            <ellipse
              cx="320"
              cy="470"
              rx="502"
              ry="238"
              stroke={theme.glowPrimary}
              strokeOpacity="0.25"
              strokeWidth="8"
            />
            {/* Orbital Station Solar Array Silhouette */}
            <g transform="translate(420 115) rotate(-14)">
              <rect x="-55" y="-4" width="110" height="8" fill={theme.accent} fillOpacity="0.7" />
              <rect x="-42" y="-32" width="22" height="64" stroke={theme.accent} strokeOpacity="0.6" strokeWidth="1.5" fill="#0F172A" fillOpacity="0.7" />
              <rect x="20" y="-32" width="22" height="64" stroke={theme.accent} strokeOpacity="0.6" strokeWidth="1.5" fill="#0F172A" fillOpacity="0.7" />
            </g>
          </g>
        )}

        {(theme.sceneType === 'newsroom' || theme.sceneType === 'paris' || theme.sceneType === 'tokyo') && (
          <g>
            {/* Global Broadcast Latitude/Longitude Rings */}
            <circle cx="450" cy="165" r="105" stroke={theme.accent} strokeOpacity="0.28" strokeWidth="1.5" />
            <ellipse cx="450" cy="165" rx="58" ry="105" stroke={theme.accent} strokeOpacity="0.2" strokeWidth="1" />
            <ellipse cx="450" cy="165" rx="105" ry="38" stroke={theme.glowSecondary} strokeOpacity="0.22" strokeWidth="1" />
            <line x1="320" y1="165" x2="580" y2="165" stroke={theme.accent} strokeOpacity="0.3" strokeWidth="1" />
            {/* Broadcast Tower Spire */}
            <path d="M165 290 L195 135 L225 290 Z" stroke={theme.accent} strokeOpacity="0.35" strokeWidth="1.5" fill={theme.glowPrimary} fillOpacity="0.1" />
            <circle cx="195" cy="135" r="5" fill={theme.accent} />
          </g>
        )}

        {(theme.sceneType === 'forest' ||
          theme.sceneType === 'noir' ||
          theme.sceneType === 'concert' ||
          theme.sceneType === 'terrace') && (
          <g>
            {/* Dramatic Stage / Spotlight Beams */}
            <path d="M180 0 L340 360 H80 Z" fill={theme.accent} fillOpacity="0.12" />
            <path d="M440 0 L590 360 H330 Z" fill={theme.glowPrimary} fillOpacity="0.16" />
            {/* Architectural Arches / Stage Curve */}
            <path
              d="M0 265 Q320 205 640 265 L640 360 L0 360 Z"
              fill="#090C14"
              fillOpacity="0.92"
            />
            <path
              d="M0 265 Q320 205 640 265"
              stroke={theme.accent}
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
          </g>
        )}

        <rect y="180" width="640" height="180" fill={`url(#${uid}-horizon)`} />
        <rect width="640" height="360" fill={`url(#${uid}-scrim)`} />
      </svg>

      {/* Station Emblem & Unboxed Metadata in Top Left */}
      {showCallSign && (
        <div className="absolute top-3 left-3.5 right-14 flex items-center gap-2 text-[11px] font-mono-tabular tracking-wider text-white/90">
          <span className="font-semibold text-white">{channel.countryCode}</span>
          <span aria-hidden="true" className="text-white/40">·</span>
          <span className="text-white/85">{channel.resolution}</span>
        </div>
      )}
    </div>
  );
};
