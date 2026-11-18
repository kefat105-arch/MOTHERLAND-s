import React from 'react';

interface MotherlandLiveIconProps {
  className?: string;
  active?: boolean;
}

export const MotherlandLiveIcon: React.FC<MotherlandLiveIconProps> = ({
  className = 'w-4 h-4',
  active = false,
}) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Broadcast Frame */}
      <rect
        x="2.5"
        y="5"
        width="19"
        height="13.5"
        rx="3.2"
        stroke={active ? 'currentColor' : '#E11D48'}
        strokeWidth="1.9"
        fill={active ? 'rgba(255,255,255,0.12)' : 'rgba(225,29,72,0.12)'}
      />
      {/* Antenna / Broadcast Arcs */}
      <path
        d="M8.5 2.5L12 5L15.5 2.5"
        stroke={active ? 'currentColor' : '#F43F5E'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Play / Signal Core */}
      <path
        d="M10.2 9.1L15.2 11.75L10.2 14.4V9.1Z"
        fill={active ? 'currentColor' : '#F43F5E'}
      />
      {/* Stand Base */}
      <path
        d="M8.5 21H15.5"
        stroke={active ? 'currentColor' : '#E11D48'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Live Signal Point */}
      <circle
        cx="17.8"
        cy="8.3"
        r="1.45"
        fill={active ? '#FFFFFF' : '#FB7185'}
      />
    </svg>
  );
};
