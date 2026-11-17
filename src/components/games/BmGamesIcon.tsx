import React from 'react';

interface BmGamesIconProps {
  className?: string;
}

/**
 * Custom BM Games Hub emblem combining a sleek controller crest silhouette
 * with high-contrast "BM" monogram in MOTHERLAND's turquoise-gold palette.
 */
export const BmGamesIcon: React.FC<BmGamesIconProps> = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="bm_hub_ring" x1="4" y1="3" x2="32" y2="33" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#14B8A6" />
        <stop offset="55%" stopColor="#0EA5E9" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
      <linearGradient id="bm_hub_fill" x1="6" y1="7" x2="30" y2="29" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0F172A" />
        <stop offset="100%" stopColor="#0B131E" />
      </linearGradient>
    </defs>

    {/* Gamepad-inspired crest frame */}
    <path
      d="M10.5 7.5H25.5C29.4 7.5 32.3 10.7 32 14.6L31.4 22.8C31.1 26.2 28.4 28.5 25.4 28.5C23.5 28.5 22 27.6 20.9 26.2L19.7 24.7H16.3L15.1 26.2C14 27.6 12.5 28.5 10.6 28.5C7.6 28.5 4.9 26.2 4.6 22.8L4 14.6C3.7 10.7 6.6 7.5 10.5 7.5Z"
      fill="url(#bm_hub_fill)"
      stroke="url(#bm_hub_ring)"
      strokeWidth="2"
      strokeLinejoin="round"
    />

    {/* Subtle top joystick notch accent */}
    <rect x="14.5" y="5.2" width="7" height="2" rx="1" fill="#14B8A6" opacity="0.9" />

    {/* Bold crisp "BM" monogram */}
    <text
      x="18"
      y="20.2"
      textAnchor="middle"
      fill="#F8FAFC"
      fontSize="11.2"
      fontWeight="900"
      fontFamily="Plus Jakarta Sans, Inter, system-ui, sans-serif"
      letterSpacing="-0.5"
    >
      BM
    </text>

    {/* Micro D-pad & action button dots */}
    <circle cx="8.6" cy="21.5" r="1.15" fill="#14B8A6" />
    <circle cx="27.4" cy="21.5" r="1.15" fill="#F59E0B" />
  </svg>
);
