/**
 * Client-side 14-day Watched Video & Short Suppression Registry
 * Ensures watched videos/shorts do not reappear in MOTHERLAND or YouTube feeds
 * for at least 14 days (for both guest and signed-in users), and broadcasts updates live.
 */

export const WATCH_SUPPRESSION_STORAGE_KEY = 'motherland_watched_suppress_v1';
export const WATCH_SUPPRESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const WATCH_SUPPRESSED_EVENT = 'motherland:watch-suppressed';

interface SuppressedMap {
  [videoId: string]: number; // watchedAt epoch ms
}

function readRawMap(): SuppressedMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(WATCH_SUPPRESSION_STORAGE_KEY);
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
      localStorage.setItem(WATCH_SUPPRESSION_STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return {};
  }
}

function writeRawMap(map: SuppressedMap): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep up to 1500 most recent entries to stay compact
    const entries = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 1500);
    const trimmed: SuppressedMap = {};
    for (const [k, v] of entries) {
      trimmed[k] = v;
    }
    localStorage.setItem(WATCH_SUPPRESSION_STORAGE_KEY, JSON.stringify(trimmed));
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
