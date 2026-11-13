import React from 'react';
import { FireRichText } from './FireRichText';
import { hasFireTokens } from '../../services/fireEmojiService';

interface FirePickerTriggerProps {
  onClick: () => void;
  title?: string;
  size?: 'sm' | 'md';
  active?: boolean;
  className?: string;
}

/**
 * Circular Fire Character button placed next to inputs/composers.
 */
export const FirePickerTrigger: React.FC<FirePickerTriggerProps> = ({
  onClick,
  title = 'Insert MOTHERLAND Fire Emoji',
  size = 'md',
  active = false,
  className = '',
}) => {
  const dim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const imgDim = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`${dim} rounded-full flex-shrink-0 flex items-center justify-center border transition-all active:scale-90 ${
        active
          ? 'bg-orange-500/25 border-orange-400 shadow-md shadow-orange-500/25'
          : 'bg-[#171f33] hover:bg-orange-500/15 border-orange-500/30 hover:border-orange-400/60'
      } ${className}`}
    >
      <img
        src="/assets/fire-emojis/expressions/exp_01.png"
        alt="Fire Emoji Picker"
        className={`${imgDim} object-contain`}
      />
    </button>
  );
};

interface FireDraftPreviewProps {
  value: string;
  className?: string;
}

/**
 * Live visual inline preview shown when a composer string contains `[[fire:<id>]]` tokens,
 * so users immediately see the actual Fire Emoji artwork before posting/sending.
 */
export const FireDraftPreview: React.FC<FireDraftPreviewProps> = ({ value, className = '' }) => {
  if (!hasFireTokens(value)) return null;

  return (
    <div
      className={`px-3 py-1.5 rounded-xl bg-[#12192b]/90 border border-orange-500/20 text-xs text-slate-200 flex items-start gap-2 ${className}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex-shrink-0 mt-0.5">
        Preview:
      </span>
      <div className="flex-1 min-w-0 leading-relaxed">
        <FireRichText text={value} emojiSize="sm" animatedStickersOnly={false} />
      </div>
    </div>
  );
};
