import { FIRE_EMOJI_CATALOG, FIRE_EMOJI_MAP, FireEmojiCategory, FireEmojiItem } from '../data/fireEmojiCatalog';

const RECENT_KEY = 'motherland_fire_emojis_recent_v1';
const FAVORITES_KEY = 'motherland_fire_emojis_favorites_v1';

const DEFAULT_RECENT_IDS = [
  'react_like',
  'react_love',
  'react_haha',
  'react_cool',
  'exp_01',
  'love_03',
  'act_fire_heart',
  'obj_flag_bd',
];

function readStringArray(key: string, fallback: string[]): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : fallback;
  } catch {
    return fallback;
  }
}

function writeStringArray(key: string, values: string[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore quota errors
  }
}

export function getRecentFireEmojis(): FireEmojiItem[] {
  const ids = readStringArray(RECENT_KEY, DEFAULT_RECENT_IDS);
  return ids.map((id) => FIRE_EMOJI_MAP[id]).filter((item): item is FireEmojiItem => Boolean(item));
}

export function recordRecentFireEmoji(id: string): string[] {
  const current = readStringArray(RECENT_KEY, DEFAULT_RECENT_IDS);
  const next = [id, ...current.filter((item) => item !== id)].slice(0, 24);
  writeStringArray(RECENT_KEY, next);
  return next;
}

export function getFavoriteFireEmojiIds(): string[] {
  return readStringArray(FAVORITES_KEY, ['react_love', 'act_fire_heart', 'obj_flag_bd', 'nat_tiger']);
}

export function getFavoriteFireEmojis(): FireEmojiItem[] {
  const ids = getFavoriteFireEmojiIds();
  return ids.map((id) => FIRE_EMOJI_MAP[id]).filter((item): item is FireEmojiItem => Boolean(item));
}

export function toggleFavoriteFireEmoji(id: string): string[] {
  const current = getFavoriteFireEmojiIds();
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [id, ...current].slice(0, 48);
  writeStringArray(FAVORITES_KEY, next);
  return next;
}

export function filterFireEmojis(options: {
  query?: string;
  category?: FireEmojiCategory | 'All' | 'Recent' | 'Favorites';
}): FireEmojiItem[] {
  const q = (options.query || '').trim().toLowerCase();
  const cat = options.category || 'All';

  let baseList: FireEmojiItem[];
  if (cat === 'Recent') {
    baseList = getRecentFireEmojis();
  } else if (cat === 'Favorites') {
    baseList = getFavoriteFireEmojis();
  } else if (cat === 'All') {
    baseList = FIRE_EMOJI_CATALOG;
  } else {
    baseList = FIRE_EMOJI_CATALOG.filter((item) => item.category === cat);
  }

  if (!q) return baseList;

  return baseList.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.keywords.some((kw) => kw.toLowerCase().includes(q))
  );
}

/**
 * Convert `[[fire:<id>]]` tokens into human-readable fallback text ONLY for external URLs
 * (such as wa.me / external shares) while preserving `[[fire:<id>]]` inside MOTHERLAND storage.
 */
export function fireTokensToExternalText(text: string): string {
  if (!text) return '';
  return text.replace(/\[\[fire:([a-z0-9_]+)\]\]/gi, (_, id: string) => {
    const found = FIRE_EMOJI_MAP[id.toLowerCase()];
    return found ? `🔥(${found.name})` : '🔥';
  });
}

export function hasFireTokens(text: string): boolean {
  return /\[\[fire:[a-z0-9_]+\]\]/i.test(text);
}
