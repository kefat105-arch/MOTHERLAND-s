import { useEffect, useState } from 'react';
import type { TranslationPreferences } from '../types';

export const TRANSLATION_PREFS_STORAGE_KEY = 'motherland_translation_prefs_v1';
export const TRANSLATION_PREFS_EVENT = 'motherland:translation-prefs';

export const DEFAULT_TRANSLATION_PREFS: TranslationPreferences = {
  enabled: true,
  targetLang: 'bn',
};

export interface SupportedLanguageOption {
  code: string;
  label: string;
  shortLabel: string;
}

export const SUPPORTED_TRANSLATION_LANGUAGES: SupportedLanguageOption[] = [
  { code: 'bn', label: 'বাংলা (Bengali)', shortLabel: 'বাংলা' },
  { code: 'en', label: 'English', shortLabel: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)', shortLabel: 'हिन्दी' },
  { code: 'ar', label: 'العربية (Arabic)', shortLabel: 'العربية' },
  { code: 'ur', label: 'اردو (Urdu)', shortLabel: 'اردو' },
  { code: 'es', label: 'Español (Spanish)', shortLabel: 'Español' },
  { code: 'fr', label: 'Français (French)', shortLabel: 'Français' },
];

export function getLanguageShortLabel(code: string): string {
  const clean = String(code || 'bn').toLowerCase();
  return (
    SUPPORTED_TRANSLATION_LANGUAGES.find((l) => l.code === clean)?.shortLabel ||
    clean.toUpperCase()
  );
}

export function getTranslationPrefs(): TranslationPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_TRANSLATION_PREFS };
  try {
    const raw = localStorage.getItem(TRANSLATION_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TRANSLATION_PREFS };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled !== false,
      targetLang:
        typeof parsed?.targetLang === 'string' && parsed.targetLang.trim()
          ? parsed.targetLang.trim().toLowerCase()
          : 'bn',
    };
  } catch {
    return { ...DEFAULT_TRANSLATION_PREFS };
  }
}

export function setTranslationPrefs(next: Partial<TranslationPreferences>): TranslationPreferences {
  const current = getTranslationPrefs();
  const merged: TranslationPreferences = {
    enabled: typeof next.enabled === 'boolean' ? next.enabled : current.enabled,
    targetLang:
      typeof next.targetLang === 'string' && next.targetLang.trim()
        ? next.targetLang.trim().toLowerCase()
        : current.targetLang,
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TRANSLATION_PREFS_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // ignore storage quota errors
    }
    window.dispatchEvent(new CustomEvent(TRANSLATION_PREFS_EVENT, { detail: merged }));
  }
  return merged;
}

export function useTranslationPrefs(): TranslationPreferences {
  const [prefs, setPrefs] = useState<TranslationPreferences>(() => getTranslationPrefs());

  useEffect(() => {
    const onCustom = (evt: Event) => {
      const detail = (evt as CustomEvent<TranslationPreferences>).detail;
      if (detail) {
        setPrefs({
          enabled: detail.enabled !== false,
          targetLang: detail.targetLang || 'bn',
        });
      } else {
        setPrefs(getTranslationPrefs());
      }
    };
    const onStorage = (evt: StorageEvent) => {
      if (evt.key === TRANSLATION_PREFS_STORAGE_KEY) {
        setPrefs(getTranslationPrefs());
      }
    };
    window.addEventListener(TRANSLATION_PREFS_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(TRANSLATION_PREFS_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return prefs;
}

const FIRE_TOKEN_RE = /\[\[fire:[^\]]+\]\]/g;
const URL_RE = /https?:\/\/\S+/gi;

export function isAlreadyTargetScript(text: string, targetLang: string): boolean {
  const tl = String(targetLang || 'bn').toLowerCase();
  const stripped = String(text || '')
    .replace(FIRE_TOKEN_RE, ' ')
    .replace(URL_RE, ' ')
    .replace(/[#@][A-Za-z0-9_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped || stripped.length < 2) return true;

  // Must contain at least some alphabetic characters to translate
  const hasLetters = /\p{L}/u.test(stripped);
  if (!hasLetters) return true;

  const bnCount = (stripped.match(/[\u0980-\u09FF]/g) || []).length;
  const hiCount = (stripped.match(/[\u0900-\u097F]/g) || []).length;
  const arCount = (stripped.match(/[\u0600-\u06FF]/g) || []).length;
  const latinCount = (stripped.match(/[A-Za-zÀ-ÿ]/g) || []).length;

  if (tl === 'bn' && bnCount >= 2 && bnCount >= latinCount) return true;
  if (tl === 'hi' && hiCount >= 2 && hiCount >= latinCount) return true;
  if ((tl === 'ar' || tl === 'ur') && arCount >= 2 && arCount >= latinCount) return true;
  if (tl === 'en' && latinCount > 0 && bnCount === 0 && hiCount === 0 && arCount === 0) {
    // Only skip if clearly plain ASCII/Latin with no non-Latin script; note Spanish/French might still translate to English,
    // so only skip short ASCII noise or let server detect Spanish/French -> English cleanly.
    return false;
  }
  return false;
}

export interface TranslationOutcome {
  translatedText: string;
  unchanged: boolean;
  detectedSourceLanguage?: string;
}

const CLIENT_TRANSLATION_CACHE = new Map<string, TranslationOutcome>();
const MAX_CLIENT_CACHE = 2000;

interface PendingTranslationItem {
  text: string;
  maskedText: string;
  tokens: string[];
  targetLang: string;
  cacheKey: string;
  resolve: (outcome: TranslationOutcome) => void;
}

const pendingQueuesByLang = new Map<string, PendingTranslationItem[]>();
const flushTimersByLang = new Map<string, number>();

function maskFireTokens(input: string): { maskedText: string; tokens: string[] } {
  const tokens: string[] = [];
  const maskedText = input.replace(FIRE_TOKEN_RE, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `__MLF${idx}__`;
  });
  return { maskedText, tokens };
}

function restoreFireTokens(translated: string, tokens: string[]): string {
  if (tokens.length === 0) return translated;
  let result = translated.replace(/__\s*MLF\s*(\d+)\s*__/gi, (_, idxStr) => {
    const idx = Number(idxStr);
    return tokens[idx] ?? '';
  });
  // Ensure any token dropped by translator is preserved
  for (const tok of tokens) {
    if (!result.includes(tok)) {
      result = `${result} ${tok}`.trim();
    }
  }
  return result;
}

async function flushLangQueue(targetLang: string): Promise<void> {
  flushTimersByLang.delete(targetLang);
  const queue = pendingQueuesByLang.get(targetLang) || [];
  pendingQueuesByLang.delete(targetLang);
  if (queue.length === 0) return;

  // Process in chunks of 20 matching server batch cap (25)
  for (let i = 0; i < queue.length; i += 20) {
    const chunk = queue.slice(i, i + 20);
    try {
      const res = await fetch('/api/translate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLang,
          items: chunk.map((item, idx) => ({
            id: String(idx),
            text: item.maskedText.slice(0, 1800),
          })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const resultsMap = new Map<string, any>();
      for (const r of data?.results || []) {
        resultsMap.set(String(r.id), r);
      }

      chunk.forEach((item, idx) => {
        const match = resultsMap.get(String(idx));
        if (!match || match.unchanged || !match.translatedText) {
          const fallback: TranslationOutcome = {
            translatedText: item.text,
            unchanged: true,
            detectedSourceLanguage: match?.detectedSourceLanguage || targetLang,
          };
          item.resolve(fallback);
          return;
        }
        const restored = restoreFireTokens(String(match.translatedText), item.tokens);
        const isSame = restored.trim() === item.text.trim();
        const outcome: TranslationOutcome = {
          translatedText: isSame ? item.text : restored,
          unchanged: isSame,
          detectedSourceLanguage: match.detectedSourceLanguage,
        };
        if (CLIENT_TRANSLATION_CACHE.size >= MAX_CLIENT_CACHE) {
          CLIENT_TRANSLATION_CACHE.clear();
        }
        CLIENT_TRANSLATION_CACHE.set(item.cacheKey, outcome);
        item.resolve(outcome);
      });
    } catch {
      chunk.forEach((item) => {
        item.resolve({ translatedText: item.text, unchanged: true });
      });
    }
  }
}

export function queueTranslation(
  text: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<TranslationOutcome> {
  const clean = String(text || '');
  const tl = String(targetLang || 'bn').toLowerCase();

  if (!clean.trim() || isAlreadyTargetScript(clean, tl)) {
    return Promise.resolve({ translatedText: clean, unchanged: true, detectedSourceLanguage: tl });
  }

  const cacheKey = `${tl}:${clean}`;
  const cached = CLIENT_TRANSLATION_CACHE.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  if (signal?.aborted) {
    return Promise.resolve({ translatedText: clean, unchanged: true });
  }

  const { maskedText, tokens } = maskFireTokens(clean);
  if (!maskedText.replace(/__MLF\d+__/g, '').trim()) {
    return Promise.resolve({ translatedText: clean, unchanged: true, detectedSourceLanguage: tl });
  }

  return new Promise<TranslationOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: TranslationOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    if (signal) {
      signal.addEventListener(
        'abort',
        () => finish({ translatedText: clean, unchanged: true }),
        { once: true }
      );
    }

    const q = pendingQueuesByLang.get(tl) || [];
    q.push({
      text: clean,
      maskedText,
      tokens,
      targetLang: tl,
      cacheKey,
      resolve: finish,
    });
    pendingQueuesByLang.set(tl, q);

    if (!flushTimersByLang.has(tl)) {
      const timerId = window.setTimeout(() => {
        void flushLangQueue(tl);
      }, 40);
      flushTimersByLang.set(tl, timerId);
    }
  });
}
