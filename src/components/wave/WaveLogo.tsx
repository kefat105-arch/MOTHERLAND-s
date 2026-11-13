import React from 'react';

interface WaveLogoProps {
  size?: number;
  showWordmark?: boolean;
  compact?: boolean;
  className?: string;
}

export const WaveLogo: React.FC<WaveLogoProps> = ({
  size = 28,
  showWordmark = false,
  compact = false,
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-2 shrink-0 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 drop-shadow-sm"
      >
        <defs>
          <linearGradient id="mlWaveBg" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1B3C59" />
            <stop offset="55%" stopColor="#2A6F72" />
            <stop offset="100%" stopColor="#162D45" />
          </linearGradient>
          <linearGradient id="mlWaveGold" x1="9" y1="15" x2="31" y2="27" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E6C987" />
            <stop offset="100%" stopColor="#C9A25B" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#mlWaveBg)" stroke="#C9A25B" strokeOpacity="0.45" strokeWidth="1.2" />
        {/* Harmonic Wave Crest */}
        <path
          d="M8.5 20.5C11.2 14.8 14.3 14.8 16.8 20.2C19.3 25.6 22.3 25.6 24.8 19.6C26.7 15 29.2 14.8 31.5 18.8"
          stroke="url(#mlWaveGold)"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10.5 25.8C13.2 22.6 15.8 22.6 18.4 25.6C21 28.6 23.8 28.4 26.5 24.8C27.9 22.9 29.2 22.6 30.6 23.6"
          stroke="#7AD3CE"
          strokeOpacity="0.9"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="30" cy="11.5" r="2.1" fill="#E6C987" />
      </svg>
      {showWordmark && (
        <span className="inline-flex flex-col leading-none text-left">
          <span className="font-display font-bold tracking-tight text-sm text-[var(--ml-text-primary)] whitespace-nowrap">
            {compact ? 'WAVE' : 'MOTHERLAND WAVE'}
          </span>
          {!compact && (
            <span className="text-[10px] font-medium tracking-[0.12em] uppercase text-[var(--ml-accent-teal)]">
              Direct &amp; Calls
            </span>
          )}
        </span>
      )}
    </span>
  );
};
