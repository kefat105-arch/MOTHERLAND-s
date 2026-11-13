import React from 'react';
import { FIRE_EMOJI_MAP, FireEmojiItem } from '../../data/fireEmojiCatalog';

interface FireEmojiIconProps {
  id?: string;
  item?: FireEmojiItem;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<FireEmojiIconProps['size']>, string> = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-7 h-7',
  lg: 'w-9 h-9',
  xl: 'w-12 h-12',
};

export const FireEmojiIcon: React.FC<FireEmojiIconProps> = ({
  id,
  item,
  size = 'sm',
  animated = false,
  className = '',
}) => {
  const resolved = item || (id ? FIRE_EMOJI_MAP[id] : undefined);
  if (!resolved) return null;

  const animClass = animated
    ? resolved.animationHint === 'wiggle'
      ? 'animate-fire-wiggle'
      : resolved.animationHint === 'bounce'
      ? 'animate-fire-pop'
      : resolved.animationHint === 'pulse'
      ? 'animate-pulse'
      : ''
    : '';

  return (
    <img
      src={resolved.assetUrl}
      alt={resolved.name}
      title={resolved.name}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`inline-block object-contain select-none align-middle drop-shadow-[0_1px_4px_rgba(255,110,0,0.45)] ${SIZE_CLASSES[size]} ${animClass} ${className}`}
    />
  );
};
