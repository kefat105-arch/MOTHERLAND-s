import { useEffect, useState } from 'react';
import type { LongVideo, Post, ShortVideo, Story } from '../types';
import type { UnifiedVideo } from '../types/video';

export const OFFLINE_TIER_OPTIONS = [40, 80, 120, 240, 480] as const;
export type OfflinePackTier = (typeof OFFLINE_TIER_OPTIONS)[number];

const DB_NAME = 'motherland_offline_db_v1';
const DB_VERSION = 2;
const STORE_VIDEOS = 'offline_videos';
const STORE_POSTS = 'offline_posts';
const STORE_STORIES = 'offline_stories';
const STORE_META = 'offline_meta';
const STORE_BLOBS = 'offline_blobs';
const MEDIA_CACHE_NAME = 'motherland-offline-media-v1';
const VAULT_EVENT = 'motherland:offline-vault-updated';
const CONNECTIVITY_EVENT = 'motherland:connectivity-changed';
const META_LS_KEY = 'motherland_offline_meta_ls_v1';

export interface OfflineVaultMeta {
  targetPackCount: OfflinePackTier | null;
  syncedCount: number;
  lastSyncedAt: number | null;
}

export interface OfflineStoredVideoRecord {
  id: string;
  kind: 'long' | 'short' | 'post';
  manualDownload: boolean;
  cachedAt: number;
  title: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  youtubeId?: string;
  source?: string;
  hasFullVideoBlob?: boolean;
  payload: any;
}

interface OfflineBlobRecord {
  key: string;
  blob: Blob;
  mimeType: string;
  size: number;
  cachedAt: number;
}

export interface OfflinePlayableItem {
  id: string;
  kind: 'long' | 'short' | 'post';
  title: string;
  subtitle: string;
  thumbnailUrl?: string;
  hasFullVideoBlob: boolean;
  manualDownload: boolean;
  source?: string;
  payload: any;
}

export interface OfflineVaultSnapshot {
  targetPackCount: OfflinePackTier | null;
  syncedCount: number;
  manualCount: number;
  playableFullCount: number;
  totalVideosCount: number;
  lastSyncedAt: number | null;
  downloadedIds: Set<string>;
  playableBlobKeys: Set<string>;
  playableItems: OfflinePlayableItem[];
  isSyncing: boolean;
  syncProgress: { done: number; total: number } | null;
  statusMessage: string;
}

let inMemorySyncing = false;
let inMemoryProgress: { done: number; total: number } | null = null;
let inMemoryStatus = '';
let inferredNetworkDown = false;
const objectUrlCache = new Map<string, string>();
const inFlightObjectUrlLookups = new Map<string, Promise<string>>();

function notifyVaultUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VAULT_EVENT));
  }
}

export function normalizeMediaKey(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  try {
    if (url.startsWith('/')) return url;
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (typeof window !== 'undefined' && u.origin === window.location.origin) {
      return u.pathname + u.search;
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function isAppOnline(): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  return !inferredNetworkDown;
}

export function markConnectivityOffline() {
  if (!inferredNetworkDown) {
    inferredNetworkDown = true;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CONNECTIVITY_EVENT));
    }
  }
}

export function markConnectivityOnline() {
  if (inferredNetworkDown) {
    inferredNetworkDown = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CONNECTIVITY_EVENT));
    }
  }
}

function readFastMeta(): OfflineVaultMeta {
  try {
    const raw = localStorage.getItem(META_LS_KEY);
    if (!raw) return { targetPackCount: null, syncedCount: 0, lastSyncedAt: null };
    const p = JSON.parse(raw);
    return {
      targetPackCount: OFFLINE_TIER_OPTIONS.includes(p?.targetPackCount) ? p.targetPackCount : null,
      syncedCount: Number(p?.syncedCount || 0),
      lastSyncedAt: p?.lastSyncedAt ? Number(p.lastSyncedAt) : null,
    };
  } catch {
    return { targetPackCount: null, syncedCount: 0, lastSyncedAt: null };
  }
}

function writeFastMeta(meta: OfflineVaultMeta) {
  try {
    localStorage.setItem(META_LS_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage quota errors
  }
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) {
        db.createObjectStore(STORE_VIDEOS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_POSTS)) {
        db.createObjectStore(STORE_POSTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_STORIES)) {
        db.createObjectStore(STORE_STORIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open offline DB'));
  });
}

async function idbGetAll<T>(storeName: string): Promise<T[]> {
  try {
    const db = await openOfflineDb();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbGetByKey<T>(storeName: string, key: string): Promise<T | null> {
  if (!key) return null;
  try {
    const db = await openOfflineDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function idbGetAllKeys(storeName: string): Promise<string[]> {
  try {
    const db = await openOfflineDb();
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAllKeys();
      req.onsuccess = () => resolve((req.result || []).map(String));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbPutBatch(storeName: string, items: any[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const item of items) {
        if (item && (item.id || item.key)) {
          store.put(item);
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore idb errors
  }
}

async function idbDeleteKey(storeName: string, key: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

async function idbClearAllStores(): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const stores = [STORE_VIDEOS, STORE_POSTS, STORE_STORIES, STORE_META, STORE_BLOBS].filter((s) =>
        db.objectStoreNames.contains(s)
      );
      const tx = db.transaction(stores, 'readwrite');
      for (const s of stores) tx.objectStore(s).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

function isCacheableMediaUrl(url?: string): url is string {
  if (!url || typeof url !== 'string') return false;
  if (
    url.startsWith('/uploads/') ||
    url.startsWith('/api/media/') ||
    url.startsWith('/api/helper-bd/stream')
  ) {
    return true;
  }
  if (
    url.startsWith('https://i.ytimg.com/') ||
    url.startsWith('https://yt3.ggpht.com/') ||
    url.startsWith('https://archive.org/services/img/') ||
    url.includes('tiktokcdn')
  ) {
    return true;
  }
  if (
    typeof window !== 'undefined' &&
    (url.startsWith(window.location.origin + '/uploads/') ||
      url.startsWith(window.location.origin + '/api/media/') ||
      url.startsWith(window.location.origin + '/api/helper-bd/stream'))
  ) {
    return true;
  }
  return false;
}

function isSameOriginVideoFile(url: string): boolean {
  const norm = normalizeMediaKey(url);
  return (
    norm.startsWith('/uploads/') ||
    norm.startsWith('/api/media/') ||
    norm.startsWith('/api/helper-bd/stream')
  );
}

async function cacheSingleAsset(rawUrl: string): Promise<{ ok: boolean; bytes: number }> {
  const normKey = normalizeMediaKey(rawUrl);
  if (!normKey || !isCacheableMediaUrl(rawUrl)) return { ok: false, bytes: 0 };

  const existingBlob = await idbGetByKey<OfflineBlobRecord>(STORE_BLOBS, normKey);
  if (existingBlob && existingBlob.size > 0) {
    return { ok: true, bytes: existingBlob.size };
  }

  const sameOrigin = isSameOriginVideoFile(rawUrl);
  try {
    const res = await fetch(rawUrl, {
      mode: sameOrigin ? 'same-origin' : 'cors',
      credentials: sameOrigin ? 'include' : 'omit',
    });
    if (!res || !res.ok) {
      throw new Error('non-ok');
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (sameOrigin && (ct.includes('application/json') || ct.includes('text/html'))) {
      throw new Error('unexpected-text-payload');
    }

    const rawBlob = await res.blob();
    if (rawBlob.size <= 0) {
      throw new Error('empty-blob');
    }
    if (sameOrigin && rawBlob.size < 2048) {
      throw new Error('truncated-media');
    }

    const mime =
      rawBlob.type && !rawBlob.type.includes('octet-stream')
        ? rawBlob.type
        : sameOrigin
        ? /\.(webm)(\?|$)/i.test(normKey)
          ? 'video/webm'
          : 'video/mp4'
        : 'image/jpeg';
    const typedBlob = new Blob([rawBlob], { type: mime });

    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        await cache.put(
          normKey,
          new Response(typedBlob, {
            status: 200,
            headers: {
              'Content-Type': mime,
              'Content-Length': String(typedBlob.size),
            },
          })
        );
      } catch {
        // ignore cacheStorage quota errors
      }
    }

    await idbPutBatch(STORE_BLOBS, [
      {
        key: normKey,
        blob: typedBlob,
        mimeType: mime,
        size: typedBlob.size,
        cachedAt: Date.now(),
      } satisfies OfflineBlobRecord,
    ]);
    return { ok: true, bytes: typedBlob.size };
  } catch {
    if (!sameOrigin && typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const res = await fetch(rawUrl, { mode: 'no-cors' });
        if (res && (res.ok || res.type === 'opaque')) {
          await cache.put(normKey, res.clone());
          return { ok: true, bytes: 0 };
        }
      } catch {
        // ignore
      }
    }
  }
  return { ok: false, bytes: 0 };
}

async function cacheAssetUrls(
  urls: Array<string | undefined>,
  onAssetDone?: (completed: number, total: number, bytesAdded: number) => void
): Promise<Set<string>> {
  const unique = Array.from(new Set(urls.filter(isCacheableMediaUrl)));
  const succeeded = new Set<string>();
  if (unique.length === 0) return succeeded;

  const prioritized = [
    ...unique.filter((u) => isSameOriginVideoFile(u)),
    ...unique.filter((u) => !isSameOriginVideoFile(u)),
  ];

  let doneCount = 0;
  const chunkSize = 3;
  for (let i = 0; i < prioritized.length; i += chunkSize) {
    const slice = prioritized.slice(i, i + chunkSize);
    await Promise.all(
      slice.map(async (url) => {
        const res = await cacheSingleAsset(url);
        if (res.ok) succeeded.add(normalizeMediaKey(url));
        doneCount += 1;
        onAssetDone?.(doneCount, prioritized.length, res.bytes);
      })
    );
  }
  return succeeded;
}

/**
 * Resolves a cached local Blob ObjectURL from IndexedDB or Cache Storage.
 * Safe & stable across renders (memoized in `objectUrlCache`).
 */
export async function resolveOfflineMediaUrl(url?: string, forceCached = false): Promise<string> {
  if (!url) return '';
  if (!forceCached && isAppOnline()) return url;

  const normKey = normalizeMediaKey(url);
  if (!normKey) return url;

  const memoized = objectUrlCache.get(normKey);
  if (memoized) return memoized;

  const existingPromise = inFlightObjectUrlLookups.get(normKey);
  if (existingPromise) return existingPromise;

  const lookupPromise = (async () => {
    try {
      // 1. Primary: IndexedDB full binary Blob store (works 100% with seeking & zero SW dependency)
      const blobRec = await idbGetByKey<OfflineBlobRecord>(STORE_BLOBS, normKey);
      if (blobRec?.blob && blobRec.blob.size > 0) {
        const objUrl = URL.createObjectURL(blobRec.blob);
        objectUrlCache.set(normKey, objUrl);
        return objUrl;
      }

      // 2. Secondary: Cache Storage
      if (typeof caches !== 'undefined') {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const match = (await cache.match(normKey)) || (await cache.match(url));
        if (match && match.type !== 'opaque') {
          const blob = await match.blob();
          if (blob.size > 0) {
            const objUrl = URL.createObjectURL(blob);
            objectUrlCache.set(normKey, objUrl);
            return objUrl;
          }
        }
      }
    } catch {
      // fallback to raw URL
    } finally {
      inFlightObjectUrlLookups.delete(normKey);
    }
    return url;
  })();

  inFlightObjectUrlLookups.set(normKey, lookupPromise);
  return lookupPromise;
}

export function useOfflineMediaSrc(rawUrl?: string, forcePreferCached = false): string {
  const { isOnline } = useOfflineConnectivity();
  const [src, setSrc] = useState<string>(() => {
    if (!rawUrl) return '';
    const norm = normalizeMediaKey(rawUrl);
    return objectUrlCache.get(norm) || rawUrl;
  });

  useEffect(() => {
    let cancelled = false;
    if (!rawUrl) {
      setSrc('');
      return;
    }
    const shouldResolveCached = !isOnline || forcePreferCached;
    if (!shouldResolveCached) {
      setSrc(rawUrl);
      return;
    }
    void resolveOfflineMediaUrl(rawUrl, true).then((resolved) => {
      if (!cancelled && resolved) {
        setSrc(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [rawUrl, isOnline, forcePreferCached]);

  return src;
}

export function useOfflineConnectivity(): {
  isOnline: boolean;
  isOfflineModeActive: boolean;
} {
  const [isOnline, setIsOnline] = useState<boolean>(() => isAppOnline());

  useEffect(() => {
    const sync = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        inferredNetworkDown = false;
      }
      setIsOnline(isAppOnline());
    };
    const onOffline = () => setIsOnline(false);
    const onCustom = () => setIsOnline(isAppOnline());

    window.addEventListener('online', sync);
    window.addEventListener('offline', onOffline);
    window.addEventListener(CONNECTIVITY_EVENT, onCustom);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(CONNECTIVITY_EVENT, onCustom);
    };
  }, []);

  return {
    isOnline,
    isOfflineModeActive: !isOnline,
  };
}

export async function getOfflineVaultSnapshot(): Promise<OfflineVaultSnapshot> {
  const fastMeta = readFastMeta();
  const [records, blobKeys] = await Promise.all([
    idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS),
    idbGetAllKeys(STORE_BLOBS),
  ]);
  const playableBlobKeys = new Set<string>(blobKeys);
  const downloadedIds = new Set<string>();
  const playableItems: OfflinePlayableItem[] = [];
  let manualCount = 0;
  let playableFullCount = 0;

  for (const r of records) {
    const videoKey = normalizeMediaKey(r.videoUrl);
    const hasBlob = Boolean(videoKey && playableBlobKeys.has(videoKey));
    if (!hasBlob) continue;

    playableFullCount += 1;
    if (r.manualDownload) {
      manualCount += 1;
      downloadedIds.add(r.id);
      if (r.youtubeId) downloadedIds.add(r.youtubeId);
      if (r.payload?.externalId) downloadedIds.add(String(r.payload.externalId));
    }

    if (r.payload) {
      const safePayload =
        r.kind === 'post'
          ? { ...r.payload, source: 'motherland', mediaType: 'video', mediaUrl: r.videoUrl }
          : { ...r.payload, source: 'motherland', videoUrl: r.videoUrl };
      playableItems.push({
        id: r.id,
        kind: r.kind,
        title: r.title,
        subtitle:
          r.payload?.channel?.title ||
          r.payload?.creator?.name ||
          r.payload?.author?.displayName ||
          'MOTHERLAND',
        thumbnailUrl: r.thumbnailUrl,
        hasFullVideoBlob: true,
        manualDownload: r.manualDownload,
        source: 'motherland',
        payload: safePayload,
      });
    }
  }

  // Sort: manual downloads first, then newest
  playableItems.sort(
    (a, b) => Number(b.manualDownload) - Number(a.manualDownload)
  );

  return {
    targetPackCount: fastMeta.targetPackCount,
    syncedCount: playableFullCount,
    manualCount,
    playableFullCount,
    totalVideosCount: playableFullCount,
    lastSyncedAt: fastMeta.lastSyncedAt,
    downloadedIds,
    playableBlobKeys,
    playableItems,
    isSyncing: inMemorySyncing,
    syncProgress: inMemoryProgress,
    statusMessage: inMemoryStatus,
  };
}

export function useOfflineVaultState(): OfflineVaultSnapshot {
  const [snap, setSnap] = useState<OfflineVaultSnapshot>(() => {
    const m = readFastMeta();
    return {
      targetPackCount: m.targetPackCount,
      syncedCount: m.syncedCount,
      manualCount: 0,
      playableFullCount: 0,
      totalVideosCount: m.syncedCount,
      lastSyncedAt: m.lastSyncedAt,
      downloadedIds: new Set<string>(),
      playableBlobKeys: new Set<string>(),
      playableItems: [],
      isSyncing: inMemorySyncing,
      syncProgress: inMemoryProgress,
      statusMessage: inMemoryStatus,
    };
  });

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void getOfflineVaultSnapshot().then((next) => {
        if (mounted) setSnap(next);
      });
    };
    refresh();
    window.addEventListener(VAULT_EVENT, refresh);
    return () => {
      mounted = false;
      window.removeEventListener(VAULT_EVENT, refresh);
    };
  }, []);

  return snap;
}

async function tryResolvePlayableStreamUrl(sourceUrl?: string): Promise<string | undefined> {
  if (!sourceUrl) return undefined;
  try {
    const r = await fetch('/api/helper-bd/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: sourceUrl }),
    });
    if (!r.ok) return undefined;
    const j = await r.json();
    const item = j?.item;
    const fmt = item?.formats?.find(
      (f: any) => f.ext === 'mp4' && f.proxyVerified && f.proxyStreamUrl
    );
    return fmt?.proxyStreamUrl || (item?.playUrl?.startsWith('/api/helper-bd/stream') ? item.playUrl : undefined);
  } catch {
    return undefined;
  }
}

export async function saveVideoOffline(video: LongVideo): Promise<boolean> {
  if (!video?.id) return false;
  let targetVideoUrl = video.videoUrl;
  let effectivePayload: LongVideo = video;

  if (!targetVideoUrl && video.youtubeId) {
    const resolvedStream = await tryResolvePlayableStreamUrl(
      `https://www.youtube.com/watch?v=${encodeURIComponent(video.youtubeId)}`
    );
    if (resolvedStream) {
      targetVideoUrl = resolvedStream;
      effectivePayload = {
        ...video,
        source: 'motherland',
        videoUrl: resolvedStream,
      };
    }
  }

  const cachedKeys = await cacheAssetUrls([
    targetVideoUrl,
    video.thumbnailUrl,
    video.channel?.avatar,
  ]);
  const videoKey = normalizeMediaKey(targetVideoUrl);
  const hasFullVideoBlob = Boolean(videoKey && cachedKeys.has(videoKey));

  if (!hasFullVideoBlob) {
    inMemoryStatus = `এই ভিডিওটি সরাসরি MP4 ডাউনলোড করা যায়নি — অফলাইন প্যাকের (40/80/120) ভিডিওগুলো সম্পূর্ণ অফলাইনে চলবে`;
    notifyVaultUpdated();
    return false;
  }

  const rec: OfflineStoredVideoRecord = {
    id: video.id,
    kind: 'long',
    manualDownload: true,
    cachedAt: Date.now(),
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    videoUrl: targetVideoUrl,
    youtubeId: video.youtubeId,
    source: effectivePayload.source,
    hasFullVideoBlob: true,
    payload: effectivePayload,
  };
  await idbPutBatch(STORE_VIDEOS, [rec]);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const playableOnly = all.filter((r) => r.hasFullVideoBlob);
  const meta = readFastMeta();
  writeFastMeta({ ...meta, syncedCount: playableOnly.length, lastSyncedAt: Date.now() });
  inMemoryStatus = `"${video.title}" পূর্ণ ভিডিও অফলাইনের জন্য ডাউনলোড সম্পন্ন হয়েছে ✓`;
  notifyVaultUpdated();
  return true;
}

export async function saveUnifiedVideoOffline(vid: UnifiedVideo): Promise<boolean> {
  const mapped: LongVideo = {
    id: vid.id,
    source: 'youtube',
    youtubeId: vid.videoId,
    thumbnailUrl: vid.thumbnailUrl,
    title: vid.title,
    description: vid.description || '',
    duration: vid.duration || '0:00',
    channel: {
      id: String(vid.sourceMetadata?.channelId || vid.creatorName || 'yt'),
      title: vid.creatorName,
      avatar: vid.creatorAvatar || '',
    },
    stats: { views: 0, likes: 0, comments: 0 },
    publishedAt: vid.publishedAt || 'YouTube',
  };
  return saveVideoOffline(mapped);
}

export async function saveShortOffline(short: ShortVideo): Promise<boolean> {
  if (!short?.id) return false;
  let targetVideoUrl = short.videoUrl;
  let effectivePayload: ShortVideo = short;

  if (!targetVideoUrl && short.youtubeId) {
    const resolvedStream = await tryResolvePlayableStreamUrl(
      `https://www.youtube.com/shorts/${encodeURIComponent(short.youtubeId)}`
    );
    if (resolvedStream) {
      targetVideoUrl = resolvedStream;
      effectivePayload = {
        ...short,
        source: 'motherland',
        videoUrl: resolvedStream,
      };
    }
  }

  const cachedKeys = await cacheAssetUrls([
    targetVideoUrl,
    short.thumbnailUrl,
    short.creator?.avatar,
  ]);
  const videoKey = normalizeMediaKey(targetVideoUrl);
  const hasFullVideoBlob = Boolean(videoKey && cachedKeys.has(videoKey));

  if (!hasFullVideoBlob) {
    inMemoryStatus = `এই শর্টস ভিডিওটি সরাসরি ডাউনলোড করা যায়নি`;
    notifyVaultUpdated();
    return false;
  }

  const rec: OfflineStoredVideoRecord = {
    id: short.id,
    kind: 'short',
    manualDownload: true,
    cachedAt: Date.now(),
    title: short.title,
    thumbnailUrl: short.thumbnailUrl,
    videoUrl: targetVideoUrl,
    youtubeId: short.youtubeId,
    source: effectivePayload.source,
    hasFullVideoBlob: true,
    payload: effectivePayload,
  };
  await idbPutBatch(STORE_VIDEOS, [rec]);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const meta = readFastMeta();
  writeFastMeta({
    ...meta,
    syncedCount: all.filter((r) => r.hasFullVideoBlob).length,
    lastSyncedAt: Date.now(),
  });
  inMemoryStatus = `"${short.title}" শর্টস পূর্ণ ভিডিও ডাউনলোড সম্পন্ন ✓`;
  notifyVaultUpdated();
  return true;
}

export async function savePostVideoOffline(post: Post): Promise<boolean> {
  if (!post?.id) return false;
  await idbPutBatch(STORE_POSTS, [{ ...post, cachedAt: Date.now() }]);
  const cachedKeys = await cacheAssetUrls([
    post.mediaUrl,
    post.thumbnailUrl,
    post.author?.avatar,
    ...(post.images || []),
  ]);
  const videoKey = normalizeMediaKey(post.mediaUrl);
  const hasFullVideoBlob = Boolean(videoKey && cachedKeys.has(videoKey));

  if (post.mediaType === 'video' && !hasFullVideoBlob) {
    inMemoryStatus = `পোস্টের ভিডিওটি অফলাইনে ডাউনলোড করা যায়নি`;
    notifyVaultUpdated();
    return false;
  }

  const rec: OfflineStoredVideoRecord = {
    id: post.id,
    kind: 'post',
    manualDownload: true,
    cachedAt: Date.now(),
    title: post.content || post.author.displayName,
    thumbnailUrl: post.thumbnailUrl,
    videoUrl: post.mediaUrl,
    youtubeId: post.externalId,
    source: post.source,
    hasFullVideoBlob,
    payload: post,
  };
  await idbPutBatch(STORE_VIDEOS, [rec]);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const meta = readFastMeta();
  writeFastMeta({
    ...meta,
    syncedCount: all.filter((r) => r.hasFullVideoBlob).length,
    lastSyncedAt: Date.now(),
  });
  inMemoryStatus = hasFullVideoBlob
    ? `ভিডিও পোস্ট পূর্ণ ফাইলসহ অফলাইনে সেভ হয়েছে ✓`
    : `পোস্ট অফলাইনে সেভ হয়েছে ✓`;
  notifyVaultUpdated();
  return true;
}

export async function removeOfflineVideo(videoId: string): Promise<void> {
  if (!videoId) return;
  await idbDeleteKey(STORE_VIDEOS, videoId);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const meta = readFastMeta();
  writeFastMeta({ ...meta, syncedCount: all.filter((r) => r.hasFullVideoBlob).length });
  notifyVaultUpdated();
}

export async function clearAllOfflineCache(): Promise<void> {
  inMemorySyncing = false;
  inMemoryProgress = null;
  inMemoryStatus = 'অফলাইন ক্যাশ ক্লিয়ার করা হয়েছে — এখন নতুন প্যাক বেছে নিতে পারবেন';
  objectUrlCache.forEach((objUrl) => {
    try {
      URL.revokeObjectURL(objUrl);
    } catch {
      // ignore
    }
  });
  objectUrlCache.clear();
  await idbClearAllStores();
  if (typeof caches !== 'undefined') {
    try {
      await caches.delete(MEDIA_CACHE_NAME);
    } catch {
      // ignore
    }
  }
  writeFastMeta({ targetPackCount: null, syncedCount: 0, lastSyncedAt: null });
  notifyVaultUpdated();
}

/**
 * Prepares & downloads REAL playable MP4 binary Blobs up to `targetCount` (40 / 80 / 120 / 240 / 480).
 * Every item stored in the Offline Vault from this pack is verified with a real video Blob in IndexedDB
 * so turning off mobile data / Wi-Fi plays every single downloaded video cleanly offline!
 */
export async function prepareOfflinePack(targetCount: OfflinePackTier): Promise<number> {
  if (inMemorySyncing) {
    return readFastMeta().syncedCount;
  }
  if (!isAppOnline()) {
    inMemoryStatus = 'ইন্টারনেট সংযোগ নেই — অনলাইনে এসে ডাউনলোড প্যাক সিলেক্ট করুন';
    notifyVaultUpdated();
    return 0;
  }

  inMemorySyncing = true;
  inMemoryProgress = { done: 0, total: targetCount };
  inMemoryStatus = `${targetCount}টি আসল ভিডিও প্যাক খোঁজা হচ্ছে...`;
  writeFastMeta({ ...readFastMeta(), targetPackCount: targetCount });
  notifyVaultUpdated();

  const existingRecords = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const byId = new Map<string, OfflineStoredVideoRecord>();
  for (const r of existingRecords) {
    if (r.manualDownload && r.hasFullVideoBlob) byId.set(r.id, r);
  }

  const collectedPosts: Post[] = [];
  const candidateRecords: OfflineStoredVideoRecord[] = [];
  const thumbUrls: Array<string | undefined> = [];

  try {
    // 1. Fetch Home Feed posts & Stories (native MOTHERLAND videos + photos for offline Home feed)
    await Promise.all([
      (async () => {
        try {
          for (let pPage = 1; pPage <= 3; pPage++) {
            const r = await fetch(`/api/posts?feedType=all&source=motherland&page=${pPage}&pageSize=15`);
            if (!r.ok) break;
            const data = await r.json();
            const list: Post[] = data?.posts || [];
            if (list.length === 0) break;
            for (const p of list) {
              collectedPosts.push(p);
              thumbUrls.push(p.thumbnailUrl, p.author?.avatar, ...(p.images || []));
            }
          }
        } catch {
          // ignore
        }
      })(),
      (async () => {
        try {
          const sr = await fetch('/api/stories');
          if (sr.ok) {
            const sData = await sr.json();
            if (Array.isArray(sData?.stories) && sData.stories.length > 0) {
              await idbPutBatch(STORE_STORIES, sData.stories.slice(0, 30));
              for (const st of sData.stories) {
                if (st.mediaType !== 'video') thumbUrls.push(st.mediaUrl);
                thumbUrls.push(st.author?.avatar);
              }
            }
          }
        } catch {
          // ignore
        }
      })(),
    ]);

    // 2. Fetch FULL Playable MP4 Pack Catalog from server (/api/offline/pack-catalog)
    // Includes ALL native MOTHERLAND MP4s + verified TikWM / Archive MP4 clips up to targetCount!
    const catRes = await fetch(`/api/offline/pack-catalog?count=${targetCount}`);
    if (catRes.ok) {
      const catJson = await catRes.json();
      const entries: any[] = Array.isArray(catJson?.items) ? catJson.items : [];
      for (const entry of entries) {
        if (!entry?.id || !entry?.videoUrl) continue;
        if (byId.has(entry.id)) continue;
        const rec: OfflineStoredVideoRecord = {
          id: entry.id,
          kind: entry.kind === 'short' ? 'short' : 'long',
          manualDownload: false,
          cachedAt: Date.now(),
          title: entry.title || 'Offline Video',
          thumbnailUrl: entry.thumbnailUrl,
          videoUrl: entry.videoUrl,
          source: 'motherland',
          hasFullVideoBlob: false,
          payload: entry.payload,
        };
        candidateRecords.push(rec);
        thumbUrls.push(entry.thumbnailUrl, entry.authorAvatar);
      }
    }

    // 3. Download REAL binary MP4 Blobs sequentially in batches of 3 until we fill `targetCount`!
    const needed = Math.max(0, targetCount - byId.size);
    let downloadedNow = 0;
    let totalBytes = 0;
    inMemoryProgress = { done: byId.size, total: Math.max(1, Math.min(targetCount, byId.size + candidateRecords.length)) };
    inMemoryStatus = `ভিডিও ফাইল ডাউনলোড হচ্ছে (0/${targetCount})...`;
    notifyVaultUpdated();

    const batchSize = 3;
    for (let i = 0; i < candidateRecords.length && downloadedNow < needed; i += batchSize) {
      const slice = candidateRecords.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (rec) => {
          if (!rec.videoUrl) return;
          const res = await cacheSingleAsset(rec.videoUrl);
          if (res.ok) {
            rec.hasFullVideoBlob = true;
            rec.cachedAt = Date.now();
            byId.set(rec.id, rec);
            downloadedNow += 1;
            totalBytes += res.bytes;
          }
        })
      );

      // Persist progressively so even interrupting mid-pack keeps everything already downloaded!
      const confirmedSlice = slice.filter((r) => r.hasFullVideoBlob);
      if (confirmedSlice.length > 0) {
        await idbPutBatch(STORE_VIDEOS, confirmedSlice);
      }

      const mbText = (totalBytes / (1024 * 1024)).toFixed(1);
      inMemoryProgress = {
        done: Math.min(targetCount, byId.size),
        total: targetCount,
      };
      inMemoryStatus = `${Math.min(targetCount, byId.size)}/${targetCount}টি আসল ভিডিও ডাউনলোড হচ্ছে (${mbText} MB)...`;
      notifyVaultUpdated();
    }

    // Cache thumbnails & feed posts in background without slowing MP4 downloads
    void cacheAssetUrls(thumbUrls.slice(0, targetCount * 2));
    if (collectedPosts.length > 0) {
      const downloadablePosts = collectedPosts.filter(
        (p) => p.mediaType !== 'video' || (p.source === 'motherland' && Boolean(p.mediaUrl))
      );
      if (downloadablePosts.length > 0) {
        await idbPutBatch(STORE_POSTS, downloadablePosts);
      }
    }

    const finalRecords = Array.from(byId.values()).filter((r) => r.hasFullVideoBlob);
    const totalPlayable = finalRecords.length;
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);

    writeFastMeta({
      targetPackCount: targetCount,
      syncedCount: totalPlayable,
      lastSyncedAt: Date.now(),
    });
    inMemoryStatus =
      totalPlayable > 0
        ? `${totalPlayable}টি আসল ভিডিও (${totalMb} MB) ডাউনলোড সম্পন্ন — এখন নেট বন্ধ করলেও প্লে হবে ✓`
        : 'ভিডিও ডাউনলোড করা যায়নি — দয়া করে পুনরায় চেষ্টা করুন';
    return totalPlayable;
  } finally {
    inMemorySyncing = false;
    inMemoryProgress = null;
    notifyVaultUpdated();
  }
}

// Passive online mirroring (ONLY caches real native MOTHERLAND playable video posts/videos)
export async function mirrorOnlinePosts(posts: Post[]): Promise<void> {
  if (!posts || posts.length === 0) return;
  const meta = readFastMeta();
  const limit = meta.targetPackCount || 40;
  const nativeOnly = posts
    .filter((p) => p.source === 'motherland' || p.mediaType !== 'video')
    .slice(0, limit);
  if (nativeOnly.length > 0) {
    await idbPutBatch(STORE_POSTS, nativeOnly);
    const nativeUrls = nativeOnly
      .filter((p) => p.source === 'motherland' && p.mediaType === 'video' && p.mediaUrl)
      .map((p) => p.mediaUrl);
    void cacheAssetUrls([...nativeUrls, ...nativeOnly.slice(0, 12).flatMap((p) => [p.thumbnailUrl, p.author?.avatar])]);
  }
}

export async function mirrorOnlineLongVideos(videos: LongVideo[]): Promise<void> {
  if (!videos || videos.length === 0) return;
  const nativeVideos = videos.filter((v) => v.source === 'motherland' && v.videoUrl).slice(0, 20);
  if (nativeVideos.length === 0) return;
  for (const v of nativeVideos) {
    if (!v.videoUrl) continue;
    const existing = await idbGetByKey<OfflineStoredVideoRecord>(STORE_VIDEOS, v.id);
    if (existing?.hasFullVideoBlob) continue;
    const ok = await cacheSingleAsset(v.videoUrl);
    if (ok.ok) {
      await idbPutBatch(STORE_VIDEOS, [
        {
          id: v.id,
          kind: 'long',
          manualDownload: false,
          cachedAt: Date.now(),
          title: v.title,
          thumbnailUrl: v.thumbnailUrl,
          videoUrl: v.videoUrl,
          source: 'motherland',
          hasFullVideoBlob: true,
          payload: v,
        } satisfies OfflineStoredVideoRecord,
      ]);
    }
  }
}

export async function mirrorOnlineShorts(shorts: ShortVideo[]): Promise<void> {
  if (!shorts || shorts.length === 0) return;
  const nativeShorts = shorts.filter((s) => s.source === 'motherland' && s.videoUrl).slice(0, 20);
  for (const s of nativeShorts) {
    if (!s.videoUrl) continue;
    const existing = await idbGetByKey<OfflineStoredVideoRecord>(STORE_VIDEOS, s.id);
    if (existing?.hasFullVideoBlob) continue;
    const ok = await cacheSingleAsset(s.videoUrl);
    if (ok.ok) {
      await idbPutBatch(STORE_VIDEOS, [
        {
          id: s.id,
          kind: 'short',
          manualDownload: false,
          cachedAt: Date.now(),
          title: s.title,
          thumbnailUrl: s.thumbnailUrl,
          videoUrl: s.videoUrl,
          source: 'motherland',
          hasFullVideoBlob: true,
          payload: s,
        } satisfies OfflineStoredVideoRecord,
      ]);
    }
  }
}

export async function mirrorOnlineStories(stories: Story[]): Promise<void> {
  if (!stories || stories.length === 0) return;
  await idbPutBatch(STORE_STORIES, stories.slice(0, 30));
}

export async function getOfflineLongVideos(): Promise<LongVideo[]> {
  const meta = readFastMeta();
  const limit = meta.targetPackCount || 480;
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const blobKeys = new Set(await idbGetAllKeys(STORE_BLOBS));

  const items: Array<{ score: number; cachedAt: number; video: LongVideo }> = [];
  for (const r of all) {
    if (!r.payload) continue;
    const isPlayable = Boolean(
      r.videoUrl && (blobKeys.has(normalizeMediaKey(r.videoUrl)) || r.hasFullVideoBlob)
    );
    // Strict guarantee: NEVER return unplayable online-only placeholders offline!
    if (!isPlayable) continue;

    if (r.kind === 'long') {
      items.push({
        score: 10 + (r.manualDownload ? 2 : 0),
        cachedAt: r.cachedAt,
        video: {
          ...(r.payload as LongVideo),
          source: 'motherland',
          videoUrl: r.videoUrl || (r.payload as LongVideo).videoUrl,
        },
      });
    } else if (r.kind === 'short') {
      const s = r.payload as ShortVideo;
      items.push({
        score: 8 + (r.manualDownload ? 2 : 0),
        cachedAt: r.cachedAt,
        video: {
          id: s.id,
          source: 'motherland',
          videoUrl: r.videoUrl || s.videoUrl,
          thumbnailUrl: s.thumbnailUrl || '',
          title: s.title,
          description: s.caption || '',
          duration: formatDurationShort(s.durationSeconds),
          channel: {
            id: s.creator?.id || 'motherland',
            title: s.creator?.name || 'MOTHERLAND',
            avatar: s.creator?.avatar || '',
            isVerified: s.creator?.isVerified,
          },
          stats: {
            views: s.stats?.views || 0,
            likes: s.stats?.likes || 0,
            comments: s.stats?.comments || 0,
          },
          publishedAt: 'অফলাইন ✓',
        },
      });
    } else if (r.kind === 'post' && r.payload.mediaUrl) {
      const p = r.payload as Post;
      items.push({
        score: 9 + (r.manualDownload ? 2 : 0),
        cachedAt: r.cachedAt,
        video: {
          id: p.id,
          source: 'motherland',
          videoUrl: p.mediaUrl,
          thumbnailUrl: p.thumbnailUrl || '',
          title: p.content || `${p.author.displayName} Video`,
          description: p.content || '',
          duration: 'Offline',
          channel: {
            id: p.author.id,
            title: p.author.displayName,
            avatar: p.author.avatar || '',
            isVerified: p.author.isVerified,
          },
          stats: { views: 0, likes: p.stats?.likes || 0, comments: p.stats?.comments || 0 },
          publishedAt: 'অফলাইন ✓',
        },
      });
    }
  }

  return items
    .sort((a, b) => b.score - a.score || b.cachedAt - a.cachedAt)
    .slice(0, limit)
    .map((i) => i.video);
}

function formatDurationShort(sec?: number): string {
  const s = Math.max(1, Math.round(sec || 30));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

export async function getOfflineShorts(): Promise<ShortVideo[]> {
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const blobKeys = new Set(await idbGetAllKeys(STORE_BLOBS));
  return all
    .filter((r) => {
      if (r.kind !== 'short' || !r.payload) return false;
      return Boolean(
        r.videoUrl && (blobKeys.has(normalizeMediaKey(r.videoUrl)) || r.hasFullVideoBlob)
      );
    })
    .sort((a, b) => Number(b.manualDownload) - Number(a.manualDownload) || b.cachedAt - a.cachedAt)
    .map((r) => ({
      ...(r.payload as ShortVideo),
      source: 'motherland',
      videoUrl: r.videoUrl || (r.payload as ShortVideo).videoUrl,
    }));
}

export async function getOfflinePosts(): Promise<Post[]> {
  const allPosts = await idbGetAll<Post>(STORE_POSTS);
  const videoRecs = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const blobKeys = new Set(await idbGetAllKeys(STORE_BLOBS));
  const byId = new Map<string, Post>();

  for (const r of videoRecs) {
    if (!r.hasFullVideoBlob || !r.videoUrl) continue;
    const isCached = blobKeys.has(normalizeMediaKey(r.videoUrl));
    if (!isCached) continue;

    if (r.kind === 'post' && r.payload?.id) {
      byId.set(r.payload.id, {
        ...(r.payload as Post),
        source: 'motherland',
        mediaType: 'video',
        mediaUrl: r.videoUrl,
      });
    } else if (r.kind === 'long' || r.kind === 'short') {
      // Surface downloaded offline MP4 videos right in the Home feed when offline too!
      const pTitle = r.title;
      const authorName =
        r.payload?.channel?.title || r.payload?.creator?.name || 'Offline Vault';
      const authorAvatar =
        r.payload?.channel?.avatar || r.payload?.creator?.avatar || '';
      byId.set(`offline_post_${r.id}`, {
        id: `offline_post_${r.id}`,
        source: 'motherland',
        mediaType: 'video',
        mediaUrl: r.videoUrl,
        thumbnailUrl: r.thumbnailUrl || '',
        content: pTitle,
        author: {
          id: r.payload?.channel?.id || r.payload?.creator?.id || 'motherland',
          username: 'offline',
          displayName: authorName,
          avatar: authorAvatar,
          isVerified: true,
        },
        createdAt: 'অফলাইনে ডাউনলোডেড ✓',
        hashtags: Array.isArray(r.payload?.hashtags) ? r.payload.hashtags : [],
        audience: 'public',
        stats: {
          likes: r.payload?.stats?.likes || 0,
          comments: r.payload?.stats?.comments || 0,
          shares: 0,
        },
      });
    }
  }

  for (const p of allPosts) {
    if (!p?.id || byId.has(p.id)) continue;
    // Skip unplayable external video posts when offline
    if (p.mediaType === 'video' && (!p.mediaUrl || !blobKeys.has(normalizeMediaKey(p.mediaUrl)))) {
      continue;
    }
    byId.set(p.id, p);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aPlayable = Boolean(a.mediaUrl && blobKeys.has(normalizeMediaKey(a.mediaUrl)));
    const bPlayable = Boolean(b.mediaUrl && blobKeys.has(normalizeMediaKey(b.mediaUrl)));
    return Number(bPlayable) - Number(aPlayable);
  });
}

export async function getOfflineStories(): Promise<Story[]> {
  return idbGetAll<Story>(STORE_STORIES);
}
