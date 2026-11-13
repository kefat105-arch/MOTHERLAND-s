/**
 * MOTHERLAND Premium Bangladesh Logo Component
 * Clean geometric square enclosure inspired by refined BTV television framing,
 * with iconic National Shaheed Minar (শহীদ মিনার) central architecture,
 * Bangladesh flag green background, vibrant red circle containing the Bangladesh map silhouette,
 * and delicate integrated Jatiyo Sriti Shoudho & Bengal tiger motif.
 *
 * Scalable vector SVG, transparent background compatible, pixel-perfect at 32px, 64px, or large display.
 */

import React from 'react';

interface MotherlandLogoProps {
  className?: string;
  size?: number | string;
  showText?: boolean;
  subtitle?: string;
}

export const MotherlandLogo: React.FC<MotherlandLogoProps> = ({
  className = '',
  size = 40,
  showText = false,
  subtitle = 'বাংলাদেশ',
}) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Premium BTV-inspired Clean Square Enclosure */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center rounded-2xl overflow-hidden shadow-lg shadow-emerald-950/50 border border-emerald-400/40"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Subtle Outer Frame / Bevel (Natural Bottle Green #006a4e) */}
          <rect width="120" height="120" rx="24" fill="#006A4E" />
          <rect
            x="3"
            y="3"
            width="114"
            height="114"
            rx="21"
            stroke="#10B981"
            strokeOpacity="0.35"
            strokeWidth="2"
          />

          {/* Inner Clean Square TV Frame border */}
          <rect
            x="8"
            y="8"
            width="104"
            height="104"
            rx="18"
            fill="#054A37"
            stroke="#ffffff"
            strokeOpacity="0.12"
            strokeWidth="1.5"
          />

          {/* Central Sun Disc - Red (#F42A41) */}
          <circle cx="60" cy="58" r="28" fill="#F42A41" />

          {/* Bangladesh Map Silhouette overlay inside red circle */}
          <g opacity="0.32" fill="#FFFFFF">
            {/* Elegant simplified map contour of Bangladesh */}
            <path d="M52 42C54 40 58 39 62 41C66 43 69 42 70 45C72 48 70 51 72 53C74 55 75 59 73 62C72 65 74 69 71 73C68 76 65 74 63 77C60 78 57 76 56 73C54 70 55 67 52 64C49 61 47 57 48 53C49 48 48 45 52 42Z" />
          </g>

          {/* Subtle Jatiyo Sriti Shoudho & Bengal Tiger Stripe emblem in core */}
          <g fill="#FFFFFF" opacity="0.45">
            {/* Monument Triangle Peak */}
            <polygon points="60,46 56,66 64,66" />
            <polygon points="60,50 54,66 66,66" opacity="0.4" />
            {/* Tiger Whisker/Stripe accents */}
            <path d="M50 56C53 57 55 59 55 61" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
            <path d="M70 56C67 57 65 59 65 61" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
          </g>

          {/* SHAHEED MINAR (শহীদ মিনার) - Core Architectural Master Silhouette */}
          {/* Base Platform (শহীদ মিনার বেদি) */}
          <rect x="22" y="86" width="76" height="5" rx="1.5" fill="#FFFFFF" />
          <rect x="28" y="82" width="64" height="4" rx="1" fill="#FFFFFF" opacity="0.9" />

          {/* Outer Left Vertical Column */}
          <rect x="32" y="52" width="5" height="30" rx="1.5" fill="#FFFFFF" />

          {/* Inner Left Vertical Column */}
          <rect x="42" y="44" width="5" height="38" rx="1.5" fill="#FFFFFF" />

          {/* Central Main Tallest Column (Angled Top Facing Forward) */}
          <path
            d="M57 32L63 32C64.5 32 65.5 33 65.5 34.5L65.5 82H54.5L54.5 34.5C54.5 33 55.5 32 57 32Z"
            fill="#FFFFFF"
          />
          {/* Main Column Bowed Forward Top Beam */}
          <path
            d="M52 38C55 35 65 35 68 38L66 42C64 40 56 40 54 42L52 38Z"
            fill="#FFFFFF"
          />

          {/* Inner Right Vertical Column */}
          <rect x="73" y="44" width="5" height="38" rx="1.5" fill="#FFFFFF" />

          {/* Outer Right Vertical Column */}
          <rect x="83" y="52" width="5" height="30" rx="1.5" fill="#FFFFFF" />

          {/* Tiny Red Accent Star on Plinth */}
          <circle cx="60" cy="84" r="1.5" fill="#F42A41" />
        </svg>
      </div>

      {/* Optional Typography */}
      {showText && (
        <div className="flex flex-col text-left leading-none">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base sm:text-lg tracking-wider text-[var(--text-primary)]">
              MOTHERLAND
            </span>
            <span className="hidden md:inline-flex text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] font-bold border border-[var(--accent-primary-border)]">
              BD
            </span>
          </div>
          {subtitle && (
            <span className="text-[10px] text-[var(--accent-primary)] font-semibold mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
