import React, { useId } from 'react';

interface FireIconProps {
  className?: string;
  size?: number;
  active?: boolean;
}

export const FIRE_ACTION_BOX_CLASS =
  'border border-orange-500/25 bg-orange-500/[0.06] hover:bg-orange-500/15 hover:border-orange-400/45 text-[var(--text-primary)] transition-all';

export const FIRE_ACTION_BOX_ACTIVE_CLASS =
  'border border-orange-400/60 bg-orange-500/18 text-orange-400 font-bold shadow-[0_0_12px_rgba(249,115,22,0.22)]';

/**
 * Fire Like — Original Fire Character icon from MOTHERLAND's featured reaction set
 */
export const FireLikeIcon: React.FC<FireIconProps> = ({
  className = '',
  size = 20,
  active = false,
}) => (
  <img
    src="/assets/fire-emojis/reactions/like.png"
    alt="Fire Like"
    width={size}
    height={size}
    style={{ width: size, height: size }}
    className={`object-contain select-none transition-transform duration-200 ${
      active ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,140,0,0.85)]' : 'opacity-90 grayscale-[18%]'
    } ${className}`}
    draggable={false}
  />
);

/**
 * Fire Dislike — Warm ember downward reaction icon matching MOTHERLAND's Fire system
 */
export const FireDislikeIcon: React.FC<FireIconProps> = ({
  className = '',
  size = 18,
  active = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `mthDislikeGrad_${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-110 drop-shadow-[0_0_6px_rgba(251,146,60,0.75)]' : ''} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#FDBA74' : '#FB923C'} />
          <stop offset="100%" stopColor={active ? '#EF4444' : '#EA580C'} />
        </linearGradient>
      </defs>
      <path
        d="M17 3H20C20.55 3 21 3.45 21 4V12C21 12.55 20.55 13 20 13H17M17 3V13M17 13L13.2 20.2C12.8 20.9 11.7 20.7 11.5 19.9L10.7 15.2H5.1C3.9 15.2 3.1 14 3.4 12.9L5.2 5.4C5.5 4.0 6.7 3 8.1 3H17Z"
        fill={active ? `url(#${gradId})` : 'rgba(251, 146, 60, 0.14)'}
        stroke={`url(#${gradId})`}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Talk (replaces Comment) — Fire-themed speech bubble containing a small expressive Fire Character
 */
export const TalkIcon: React.FC<FireIconProps> = ({
  className = '',
  size = 18,
  active = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const bubbleGrad = `mthTalkBubbleGrad_${uid}`;
  const flameGrad = `mthTalkFlameGrad_${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-110' : ''} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bubbleGrad} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={active ? '#FF9D2E' : '#FB923C'} />
          <stop offset="100%" stopColor={active ? '#EF4444' : '#EA580C'} />
        </linearGradient>
        <linearGradient id={flameGrad} x1="12" y1="6.2" x2="12" y2="15.2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF7AE" />
          <stop offset="55%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5C6.75 2.5 2.5 6.3 2.5 11C2.5 13.45 3.68 15.66 5.56 17.2L4.4 21.1C4.24 21.62 4.78 22.06 5.26 21.8L9.38 19.55C10.22 19.74 11.1 19.85 12 19.85C17.25 19.85 21.5 15.7 21.5 11C21.5 6.3 17.25 2.5 12 2.5Z"
        fill={active ? `url(#${bubbleGrad})` : 'rgba(251, 146, 60, 0.14)'}
        stroke={`url(#${bubbleGrad})`}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12.3 5.8C12.9 7.3 14.5 8.1 15.1 9.9C15.65 11.55 14.7 13.95 12.1 14.15C9.75 14.3 8.55 12.45 9.0 10.35C9.28 9.05 10.2 8.2 10.65 7.45C10.95 8.2 11.4 8.55 11.7 8.45C11.95 7.5 11.85 6.6 12.3 5.8Z"
        fill={`url(#${flameGrad})`}
        stroke={active ? '#7C2D12' : '#FB923C'}
        strokeWidth="0.65"
      />
      <circle cx="11.0" cy="11.0" r="0.65" fill="#1E1B18" />
      <circle cx="13.1" cy="11.0" r="0.65" fill="#1E1B18" />
      <path d="M11.15 12.25C11.65 12.75 12.45 12.75 12.95 12.25" stroke="#1E1B18" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
};

/**
 * Boost (replaces Share) — Flame-inspired sharing symbol made of connected glowing fire nodes
 */
export const BoostIcon: React.FC<FireIconProps> = ({
  className = '',
  size = 18,
  active = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `mthBoostGrad_${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-110' : ''} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
      </defs>
      <path
        d="M7.8 10.7L15.6 6.4M7.8 13.3L15.6 17.6"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5.5 8.5C6.8 9.8 8.3 10.6 8.3 12.4C8.3 14.1 7.0 15.3 5.4 15.3C3.8 15.3 2.5 14.1 2.5 12.4C2.5 10.8 3.9 9.7 5.5 8.5Z"
        fill={`url(#${gradId})`}
        stroke="#FFF7ED"
        strokeWidth="0.6"
      />
      <path
        d="M18.0 2.3C19.3 3.7 20.8 4.6 20.8 6.4C20.8 8.1 19.5 9.3 17.9 9.3C16.3 9.3 15.0 8.1 15.0 6.4C15.0 4.8 16.4 3.6 18.0 2.3Z"
        fill={`url(#${gradId})`}
        stroke="#FFF7ED"
        strokeWidth="0.6"
      />
      <path
        d="M18.0 14.5C19.3 15.9 20.8 16.8 20.8 18.6C20.8 20.3 19.5 21.5 17.9 21.5C16.3 21.5 15.0 20.3 15.0 18.6C15.0 17.0 16.4 15.8 18.0 14.5Z"
        fill={`url(#${gradId})`}
        stroke="#FFF7ED"
        strokeWidth="0.6"
      />
      <circle cx="5.4" cy="12.6" r="1.1" fill="#FEF9C3" />
      <circle cx="17.9" cy="6.6" r="1.1" fill="#FEF9C3" />
      <circle cx="17.9" cy="18.8" r="1.1" fill="#FEF9C3" />
    </svg>
  );
};

/**
 * Vault (replaces Save) — Flame-shaped bookmark / Fire Vault symbol
 */
export const VaultIcon: React.FC<FireIconProps> = ({
  className = '',
  size = 18,
  active = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `mthVaultGrad_${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-110 drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]' : ''} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="2" x2="18" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="55%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.2C13.6 3.7 16.8 5.2 17.6 8.2C18 9.7 18 11.8 18 14.5V21.2L12 17.6L6 21.2V14.5C6 11.4 6 9.3 6.8 7.5C7.5 5.9 9.2 4.8 10.1 3.7C10.5 4.6 11.1 5.0 11.5 4.8C11.9 4.0 11.8 3.0 12 2.2Z"
        fill={active ? `url(#${gradId})` : 'rgba(245, 158, 11, 0.14)'}
        stroke={`url(#${gradId})`}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.2C12.7 9.4 13.8 10.2 13.8 11.6C13.8 12.7 13.0 13.5 12.0 13.5C11.0 13.5 10.2 12.7 10.2 11.6C10.2 10.2 11.3 9.4 12 8.2Z"
        fill={active ? '#FFFBEB' : '#FBBF24'}
      />
    </svg>
  );
};

/**
 * Replay (replaces Repost) — Fire-inspired circular replay emblem
 */
export const ReplayIcon: React.FC<FireIconProps> = ({
  className = '',
  size = 18,
  active = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `mthReplayGrad_${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-110' : ''} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EF4444" />
        </linearGradient>
      </defs>
      <path
        d="M18.4 7.5A7.8 7.8 0 0 0 5.3 9.5M5.6 16.5A7.8 7.8 0 0 0 18.7 14.5"
        stroke={`url(#${gradId})`}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <path d="M19.5 4.3V8.2H15.6" stroke="#FDE047" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 19.7V15.8H8.4" stroke="#FB923C" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M12 9.0C12.6 10.2 13.7 10.9 13.7 12.2C13.7 13.2 12.9 14.0 12 14.0C11.1 14.0 10.3 13.2 10.3 12.2C10.3 10.9 11.4 10.2 12 9.0Z"
        fill={`url(#${gradId})`}
      />
    </svg>
  );
};

/**
 * Pulse (replaces Notifications Bell) — Fire-themed notification pulse beacon
 */
export const PulseIcon: React.FC<FireIconProps> = ({
  className = '',
  size = 18,
  active = false,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `mthPulseGrad_${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`transition-transform duration-200 ${active ? 'scale-110' : ''} ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="12" y1="2" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <path
        d="M5.4 6.8C3.9 8.4 3.2 10.5 3.4 12.8M18.6 6.8C20.1 8.4 20.8 10.5 20.6 12.8"
        stroke="#FDBA74"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity={active ? '1' : '0.78'}
      />
      <path
        d="M12.3 3.2C13.3 5.5 16.4 7.0 17.2 10.4C18.0 13.6 15.8 17.5 12.0 17.8C8.3 18.0 6.1 14.5 6.8 11.0C7.3 8.8 8.9 7.6 9.6 6.3C10.1 7.6 10.8 8.2 11.3 8.0C11.7 6.5 11.6 4.7 12.3 3.2Z"
        fill={`url(#${gradId})`}
        stroke="#FFF7ED"
        strokeWidth="0.7"
      />
      <path d="M9.5 20.5H14.5" stroke="#FACC15" strokeWidth="2.1" strokeLinecap="round" />
      <circle cx="12" cy="13" r="1.4" fill="#FFFBEB" />
    </svg>
  );
};
