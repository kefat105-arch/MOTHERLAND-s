import React from 'react';
import { FIRE_EMOJI_MAP } from '../../data/fireEmojiCatalog';
import { FireEmojiIcon } from './FireEmojiIcon';

interface FireRichTextProps {
  text: string;
  className?: string;
  emojiSize?: 'xs' | 'sm' | 'md' | 'lg';
  animatedStickersOnly?: boolean;
}

const FIRE_TOKEN_SPLIT_REGEX = /(\[\[fire:[a-z0-9_]+\]\])/gi;
const FIRE_TOKEN_MATCH_REGEX = /^\[\[fire:([a-z0-9_]+)\]\]$/i;

/**
 * Renders normal text, Unicode emojis (for existing backward compatibility),
 * AND custom MOTHERLAND `[[fire:<id>]]` emoji tokens as crisp inline artwork.
 */
export const FireRichText: React.FC<FireRichTextProps> = ({
  text,
  className = '',
  emojiSize = 'sm',
  animatedStickersOnly = true,
}) => {
  if (!text) return null;

  const parts = text.split(FIRE_TOKEN_SPLIT_REGEX).filter((p) => p.length > 0);
  const nonEmptyTextParts = parts.filter(
    (p) => !FIRE_TOKEN_MATCH_REGEX.test(p) && p.trim().length > 0
  );
  const fireParts = parts.filter((p) => FIRE_TOKEN_MATCH_REGEX.test(p));
  const isPureStickers =
    nonEmptyTextParts.length === 0 && fireParts.length >= 1 && fireParts.length <= 4;

  const resolvedSize = isPureStickers ? 'lg' : emojiSize;

  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, idx) => {
        const match = part.match(FIRE_TOKEN_MATCH_REGEX);
        if (match) {
          const emojiId = match[1].toLowerCase();
          const item = FIRE_EMOJI_MAP[emojiId];
          if (item) {
            return (
              <FireEmojiIcon
                key={`${emojiId}_${idx}`}
                item={item}
                size={resolvedSize}
                animated={animatedStickersOnly && isPureStickers}
                className="mx-0.5 -mt-0.5"
              />
            );
          }
          return (
            <span key={idx} className="text-amber-400">
              [{emojiId}]
            </span>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </span>
  );
};
