import React from 'react';

interface LiveSpyEmblemProps {
  className?: string;
}

/**
 * Custom LIVE SPY game emblem featuring fedora/spy silhouette,
 * glowing surveillance lens, and live crimson-teal pulse indicator.
 */
export const LiveSpyEmblem: React.FC<LiveSpyEmblemProps> = ({ className = 'w-11 h-11' }) => (
  <svg
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="spy_bg" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#132234" />
        <stop offset="100%" stopColor="#090D16" />
      </linearGradient>
      <linearGradient id="spy_gold" x1="16" y1="18" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#14B8A6" />
      </linearGradient>
    </defs>

    <rect x="3" y="3" width="58" height="58" rx="16" fill="url(#spy_bg)" stroke="url(#spy_gold)" strokeWidth="2.2" />

    {/* Spy fedora crown & brim */}
    <path
      d="M21 27L24.5 16.5C25.1 14.9 26.8 14.1 28.4 14.7L32 16L35.6 14.7C37.2 14.1 38.9 14.9 39.5 16.5L43 27H21Z"
      fill="#1E293B"
      stroke="#F59E0B"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
    <path d="M13 28.5C21 26 43 26 51 28.5C45 30.8 19 30.8 13 28.5Z" fill="#F59E0B" />

    {/* Shades / Mask eyes */}
    <rect x="19" y="32.5" width="10.5" height="6.5" rx="3" fill="#0F172A" stroke="#14B8A6" strokeWidth="1.7" />
    <rect x="34.5" y="32.5" width="10.5" height="6.5" rx="3" fill="#0F172A" stroke="#14B8A6" strokeWidth="1.7" />
    <path d="M29.5 35.5H34.5" stroke="#14B8A6" strokeWidth="1.7" />

    {/* Trench collar */}
    <path
      d="M17 50C18.8 43.2 24.4 41.2 32 41.2C39.6 41.2 45.2 43.2 47 50"
      stroke="#E2E8F0"
      strokeWidth="2"
      strokeLinecap="round"
    />

    {/* Live Camera Dot */}
    <circle cx="50" cy="14" r="4" fill="#EF4444" />
    <circle cx="50" cy="14" r="6.5" stroke="#EF4444" strokeOpacity="0.45" strokeWidth="1.5" />
  </svg>
);
