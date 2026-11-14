/**
 * Client-side 7-day Watched Video & Short Suppression Registry (User-Scoped)
 * Ensures watched videos/shorts do not reappear in MOTHERLAND or YouTube feeds
 * for 7 days (configurable), and tracks in-session recently shown IDs so
 * Home / Video clicks & pull-to-refresh always deliver fresh unseen videos.
 */

export const WATCH_SUPPRESSION_BASE_KEY = 'motherland_watched_suppress_v2';
export const WATCH_SUPPRESSION_LEGACY_KEY = 'motherland_watched_suppress_v1';
export const WATCH_SUPPRESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const WATCH_SUPPRESSED_EVENT = 'motherland:watch-suppressed';

let activeWatchUserId: string | null = null;

// In-memory session-only tracker of recently displayed items (clears on app reload)
const sessionShownFeedIds: Record<string, string[]> = {
  home: [],
  video: [],
  shorts: [],
  youtube: [],
};

export function setWatchSuppressionUserId(userId?: string | null): void {
  activeWatchUserId = userId ? String(userId).trim() : null;
}

function getStorageKey(): string {
  return activeWatchUserId
    ? `${WATCH_SUPPRESSION_BASE_KEY}_${activeWatchUserId}`
    : `${WATCH_SUPPRESSION_BASE_KEY}_guest`;
}

interface SuppressedMap {
  [videoId: string]: number; // watchedAt epoch ms
}

function readRawMap(): SuppressedMap {
  if (typeof window === 'undefined') return {};
  try {
    const key = getStorageKey();
    let raw = localStorage.getItem(key);
    // Migrate legacy entries safely once for seamless continuity
    if (!raw && activeWatchUserId) {
      const legacyRaw = localStorage.getItem(WATCH_SUPPRESSION_LEGACY_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
      }
    }
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const now = Date.now();
    const cleaned: SuppressedMap = {};
    let changed = false;
    for (const [k, ts] of Object.entries(parsed)) {
      const n = Number(ts);
      if (k && Number.isFinite(n) && now - n <= WATCH_SUPPRESSION_TTL_MS) {
        cleaned[k] = n;
      } else {
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeRawMap(map: SuppressedMap): void {
  if (typeof window === 'undefined') return;
  try {
    const entries = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1500);
    const trimmed: SuppressedMap = {};
    for (const [k, v] of entries) {
      trimmed[k] = v;
    }
    localStorage.setItem(getStorageKey(), JSON.stringify(trimmed));
  } catch {
    // Ignore quota error
  }
}

export function normalizeSuppressId(id?: string | null): string {
  if (!id) return '';
  return String(id)
    .trim()
    .replace(/^yt_feed_/, '')
    .replace(/^yt_/, '');
}

export function recordWatchedSuppression(id?: string | null, youtubeId?: string | null): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const candidates = new Set<string>();
  if (id) {
    candidates.add(String(id).trim());
    const norm = normalizeSuppressId(id);
    if (norm) candidates.add(norm);
  }
  if (youtubeId) {
    candidates.add(String(youtubeId).trim());
    const norm = normalizeSuppressId(youtubeId);
    if (norm) candidates.add(norm);
  }
  if (candidates.size === 0) return;

  const map = readRawMap();
  let added = false;
  for (const key of candidates) {
    if (!map[key]) added = true;
    map[key] = now;
  }
  writeRawMap(map);

  window.dispatchEvent(
    new CustomEvent(WATCH_SUPPRESSED_EVENT, {
      detail: { ids: Array.from(candidates), isNew: added },
    })
  );
}

export function getSuppressedVideoIdsSet(): Set<string> {
  const map = readRawMap();
  const set = new Set<string>();
  for (const key of Object.keys(map)) {
    set.add(key);
    const norm = normalizeSuppressId(key);
    if (norm) set.add(norm);
  }
  return set;
}

export function getSuppressedIdsHeaderValue(limit = 200): string {
  const map = readRawMap();
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => normalizeSuppressId(k) || k)
    .filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx)
    .slice(0, limit)
    .join(',');
}

export function recordShownFeedIds(
  bucket: 'home' | 'video' | 'shorts' | 'youtube',
  ids: Array<string | undefined | null>
): void {
  const clean = ids
    .map((id) => normalizeSuppressId(id))
    .filter((v): v is string => Boolean(v));
  if (clean.length === 0) return;
  const existing = sessionShownFeedIds[bucket] || [];
  const merged = [...clean, ...existing.filter((x) => !clean.includes(x))].slice(0, 40);
  sessionShownFeedIds[bucket] = merged;
}

export function getRecentlyShownIds(bucket: 'home' | 'video' | 'shorts' | 'youtube'): string[] {
  return [...(sessionShownFeedIds[bucket] || [])];
}

export function clearRecentlyShownIds(bucket?: 'home' | 'video' | 'shorts' | 'youtube'): void {
  if (bucket) {
    sessionShownFeedIds[bucket] = [];
    return;
  }
  sessionShownFeedIds.home = [];
  sessionShownFeedIds.video = [];
  sessionShownFeedIds.shorts = [];
  sessionShownFeedIds.youtube = [];
}

export function isVideoSuppressed(
  id?: string | null,
  youtubeId?: string | null,
  suppressedSet?: Set<string>
): boolean {
  const set = suppressedSet || getSuppressedVideoIdsSet();
  if (set.size === 0) return false;
  if (id) {
    if (set.has(id)) return true;
    const norm = normalizeSuppressId(id);
    if (norm && set.has(norm)) return true;
  }
  if (youtubeId) {
    if (set.has(youtubeId)) return true;
    const norm = normalizeSuppressId(youtubeId);
    if (norm && set.has(norm)) return true;
  }
  return false;
}

export function filterUnsuppressed<
  T extends { id?: string; youtubeId?: string; externalId?: string; mediaType?: string }
>(items: T[], onlyVideoPosts = false): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const set = getSuppressedVideoIdsSet();
  if (set.size === 0) return items;
  return items.filter((item) => {
    if (onlyVideoPosts && item.mediaType !== 'video' && !item.youtubeId && !item.externalId) {
      return true;
    }
    return !isVideoSuppressed(item.id, item.youtubeId || item.externalId, set);
  });
}

export function clearSuppressionEntry(videoId: string): void {
  const map = readRawMap();
  delete map[videoId];
  const norm = normalizeSuppressId(videoId);
  if (norm) delete map[norm];
  writeRawMap(map);
}
