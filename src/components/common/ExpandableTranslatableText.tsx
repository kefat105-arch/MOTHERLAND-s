import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Languages } from 'lucide-react';
import {
  getLanguageShortLabel,
  queueTranslation,
  useTranslationPrefs,
} from '../../services/translationService';

interface TranslatableTextProps {
  text: string;
  translate?: boolean;
  showToggle?: boolean;
  className?: string;
  badgeClassName?: string;
  renderText?: (value: string) => React.ReactNode;
}

export const TranslatableText: React.FC<TranslatableTextProps> = ({
  text,
  translate = true,
  showToggle = true,
  className = '',
  badgeClassName = '',
  renderText,
}) => {
  const prefs = useTranslationPrefs();
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    setTranslated(null);
    setShowOriginal(false);
    if (!translate || !prefs.enabled || !text || !text.trim()) return;

    const controller = new AbortController();
    queueTranslation(text, prefs.targetLang, controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      if (!res.unchanged && res.translatedText && res.translatedText !== text) {
        setTranslated(res.translatedText);
      }
    });

    return () => controller.abort();
  }, [text, translate, prefs.enabled, prefs.targetLang]);

  const isShowingTranslation = Boolean(prefs.enabled && translated && !showOriginal);
  const displayValue = isShowingTranslation && translated ? translated : text;

  return (
    <span className={className}>
      {renderText ? renderText(displayValue) : displayValue}
      {showToggle && prefs.enabled && translated && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowOriginal((prev) => !prev);
          }}
          className={`mt-1 inline-flex items-center gap-1 text-[10px] font-semibold opacity-75 hover:opacity-100 hover:underline ${badgeClassName}`}
        >
          <Languages className="w-3 h-3 shrink-0" />
          <span>
            {showOriginal
              ? `Translate to ${getLanguageShortLabel(prefs.targetLang)}`
              : `Translated to ${getLanguageShortLabel(prefs.targetLang)} · Show original`}
          </span>
        </button>
      )}
    </span>
  );
};

interface CollapsibleDescriptionProps {
  text: string;
  minLengthToCollapse?: number;
  translate?: boolean;
  className?: string;
  buttonClassName?: string;
  renderText?: (value: string) => React.ReactNode;
}

export const CollapsibleDescription: React.FC<CollapsibleDescriptionProps> = ({
  text,
  minLengthToCollapse = 80,
  translate = true,
  className = '',
  buttonClassName = '',
  renderText,
}) => {
  const prefs = useTranslationPrefs();
  const [expanded, setExpanded] = useState(false);
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setTranslated(null);
    setShowOriginal(false);
    if (!translate || !prefs.enabled || !text || !text.trim()) return;

    const controller = new AbortController();
    queueTranslation(text, prefs.targetLang, controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      if (!res.unchanged && res.translatedText && res.translatedText !== text) {
        setTranslated(res.translatedText);
      }
    });

    return () => controller.abort();
  }, [text, translate, prefs.enabled, prefs.targetLang]);

  if (!text) return null;

  const isShowingTranslation = Boolean(prefs.enabled && translated && !showOriginal);
  const displayValue = isShowingTranslation && translated ? translated : text;
  const shouldCollapse =
    displayValue.length > minLengthToCollapse || displayValue.includes('\n');

  return (
    <div className="space-y-1">
      <div
        className={`${className} whitespace-pre-wrap break-words ${
          shouldCollapse && !expanded ? 'line-clamp-1' : ''
        }`}
      >
        {renderText ? renderText(displayValue) : displayValue}
      </div>

      {(shouldCollapse || (prefs.enabled && translated)) && (
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          {shouldCollapse && (
            <button
              type="button"
              data-testid="see-more-desc-btn"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
              }}
              className={`text-xs font-bold text-[var(--accent-primary)] inline-flex items-center gap-0.5 hover:underline ${buttonClassName}`}
            >
              <span>{expanded ? 'Show less' : 'See More'}</span>
              {expanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {prefs.enabled && translated && (
            <button
              type="button"
              data-testid="toggle-translation-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowOriginal((prev) => !prev);
              }}
              className="text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 hover:underline"
            >
              <Languages className="w-3 h-3 shrink-0" />
              <span>
                {showOriginal
                  ? `Translate to ${getLanguageShortLabel(prefs.targetLang)}`
                  : `Translated to ${getLanguageShortLabel(prefs.targetLang)} · Show original`}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
