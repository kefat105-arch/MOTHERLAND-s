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
  if (url.startsWith('/uploads/') || url.startsWith('/api/media/')) return true;
  if (url.startsWith('https://i.ytimg.com/') || url.startsWith('https://yt3.ggpht.com/')) return true;
  if (
    typeof window !== 'undefined' &&
    (url.startsWith(window.location.origin + '/uploads/') ||
      url.startsWith(window.location.origin + '/api/media/'))
  ) {
    return true;
  }
  return false;
}

function isSameOriginVideoFile(url: string): boolean {
  const norm = normalizeMediaKey(url);
  return norm.startsWith('/uploads/') || norm.startsWith('/api/media/');
}

async function cacheSingleAsset(rawUrl: string): Promise<boolean> {
  const normKey = normalizeMediaKey(rawUrl);
  if (!normKey || !isCacheableMediaUrl(rawUrl)) return false;

  // Already in IndexedDB blob store?
  const existingBlob = await idbGetByKey<OfflineBlobRecord>(STORE_BLOBS, normKey);
  if (existingBlob && existingBlob.size > 0) {
    return true;
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

    // Store in CacheStorage (for Service Worker Range 206 requests)
    if (typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        await cache.put(normKey, res.clone());
      } catch {
        // ignore cacheStorage quota errors
      }
    }

    // Store real binary Blob directly inside IndexedDB so playback works even without SW!
    const rawBlob = await res.blob();
    if (rawBlob.size > 0) {
      const mime =
        rawBlob.type ||
        (/\.(mp4|m4v)(\?|$)/i.test(normKey)
          ? 'video/mp4'
          : /\.(webm)(\?|$)/i.test(normKey)
          ? 'video/webm'
          : 'image/jpeg');
      const typedBlob = rawBlob.type ? rawBlob : new Blob([rawBlob], { type: mime });
      await idbPutBatch(STORE_BLOBS, [
        {
          key: normKey,
          blob: typedBlob,
          mimeType: mime,
          size: typedBlob.size,
          cachedAt: Date.now(),
        } satisfies OfflineBlobRecord,
      ]);
      return true;
    }
  } catch {
    // Fallback for cross-origin images with no-cors into Cache Storage only
    if (!sameOrigin && typeof caches !== 'undefined') {
      try {
        const cache = await caches.open(MEDIA_CACHE_NAME);
        const res = await fetch(rawUrl, { mode: 'no-cors' });
        if (res && (res.ok || res.type === 'opaque')) {
          await cache.put(normKey, res.clone());
          return true;
        }
      } catch {
        // ignore
      }
    }
  }
  return false;
}

async function cacheAssetUrls(urls: Array<string | undefined>): Promise<Set<string>> {
  const unique = Array.from(new Set(urls.filter(isCacheableMediaUrl)));
  const succeeded = new Set<string>();
  if (unique.length === 0) return succeeded;

  // Put same-origin MP4 video/media files FIRST so they are always downloaded completely!
  const prioritized = [
    ...unique.filter((u) => isSameOriginVideoFile(u) && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)),
    ...unique.filter((u) => isSameOriginVideoFile(u) && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)),
    ...unique.filter((u) => !isSameOriginVideoFile(u)),
  ];

  const chunkSize = 3;
  for (let i = 0; i < prioritized.length; i += chunkSize) {
    const slice = prioritized.slice(i, i + chunkSize);
    await Promise.all(
      slice.map(async (url) => {
        const ok = await cacheSingleAsset(url);
        if (ok) succeeded.add(normalizeMediaKey(url));
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
    const hasBlob = Boolean(
      r.hasFullVideoBlob || (videoKey && playableBlobKeys.has(videoKey))
    );
    if (hasBlob) playableFullCount += 1;

    if (r.manualDownload) {
      manualCount += 1;
      downloadedIds.add(r.id);
      if (r.youtubeId) downloadedIds.add(r.youtubeId);
      if (r.payload?.externalId) downloadedIds.add(String(r.payload.externalId));
    }

    if (r.payload) {
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
        hasFullVideoBlob: hasBlob,
        manualDownload: r.manualDownload,
        source: r.source,
        payload: r.payload,
      });
    }
  }

  // Sort: full playable MP4 videos first, then manual downloads, then newest
  playableItems.sort(
    (a, b) =>
      Number(b.hasFullVideoBlob) - Number(a.hasFullVideoBlob) ||
      Number(b.manualDownload) - Number(a.manualDownload)
  );

  return {
    targetPackCount: fastMeta.targetPackCount,
    syncedCount: fastMeta.syncedCount || records.length,
    manualCount,
    playableFullCount,
    totalVideosCount: records.length,
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

export async function saveVideoOffline(video: LongVideo): Promise<boolean> {
  if (!video?.id) return false;
  const cachedKeys = await cacheAssetUrls([video.videoUrl, video.thumbnailUrl, video.channel?.avatar]);
  const videoKey = normalizeMediaKey(video.videoUrl);
  const hasFullVideoBlob = Boolean(videoKey && cachedKeys.has(videoKey));

  const rec: OfflineStoredVideoRecord = {
    id: video.id,
    kind: 'long',
    manualDownload: true,
    cachedAt: Date.now(),
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    videoUrl: video.videoUrl,
    youtubeId: video.youtubeId,
    source: video.source,
    hasFullVideoBlob,
    payload: video,
  };
  await idbPutBatch(STORE_VIDEOS, [rec]);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const meta = readFastMeta();
  writeFastMeta({ ...meta, syncedCount: all.length, lastSyncedAt: Date.now() });
  inMemoryStatus = hasFullVideoBlob
    ? `"${video.title}" পূর্ণ ভিডিও অফলাইনের জন্য ডাউনলোড সম্পন্ন হয়েছে ✓`
    : `"${video.title}" প্রিভিউ অফলাইনে সেভ হয়েছে (YouTube ভিডিও প্লে করতে নেট প্রয়োজন)`;
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
  const cachedKeys = await cacheAssetUrls([short.videoUrl, short.thumbnailUrl, short.creator?.avatar]);
  const videoKey = normalizeMediaKey(short.videoUrl);
  const hasFullVideoBlob = Boolean(videoKey && cachedKeys.has(videoKey));

  const rec: OfflineStoredVideoRecord = {
    id: short.id,
    kind: 'short',
    manualDownload: true,
    cachedAt: Date.now(),
    title: short.title,
    thumbnailUrl: short.thumbnailUrl,
    videoUrl: short.videoUrl,
    youtubeId: short.youtubeId,
    source: short.source,
    hasFullVideoBlob,
    payload: short,
  };
  await idbPutBatch(STORE_VIDEOS, [rec]);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const meta = readFastMeta();
  writeFastMeta({ ...meta, syncedCount: all.length, lastSyncedAt: Date.now() });
  inMemoryStatus = hasFullVideoBlob
    ? `"${short.title}" শর্টস পূর্ণ ভিডিও ডাউনলোড সম্পন্ন ✓`
    : `"${short.title}" শর্টস প্রিভিউ সেভ হয়েছে`;
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
  writeFastMeta({ ...meta, syncedCount: all.length, lastSyncedAt: Date.now() });
  inMemoryStatus = hasFullVideoBlob
    ? `ভিডিও পোস্ট পূর্ণ ফাইলসহ অফলাইনে সেভ হয়েছে ✓`
    : `পোস্ট প্রিভিউ অফলাইনে সেভ হয়েছে`;
  notifyVaultUpdated();
  return true;
}

export async function removeOfflineVideo(videoId: string): Promise<void> {
  if (!videoId) return;
  await idbDeleteKey(STORE_VIDEOS, videoId);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const meta = readFastMeta();
  writeFastMeta({ ...meta, syncedCount: all.length });
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
 * Prepares & caches a complete offline video + post library up to `targetCount` (40 / 80 / 120 / 240 / 480).
 * Prioritizes full MP4 downloads for ALL native MOTHERLAND videos, Shorts & posts FIRST so they play offline 100%.
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
  inMemoryStatus = `${targetCount}টি ভিডিও ও হোম ফিড ডাউনলোড হচ্ছে...`;
  writeFastMeta({ ...readFastMeta(), targetPackCount: targetCount });
  notifyVaultUpdated();

  const existingRecords = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const byId = new Map<string, OfflineStoredVideoRecord>();
  for (const r of existingRecords) {
    if (r.manualDownload) byId.set(r.id, r);
  }

  const collectedPosts: Post[] = [];
  const nativeVideoUrls: Array<string | undefined> = [];
  const thumbUrls: Array<string | undefined> = [];

  try {
    // 1. Fetch ALL native MOTHERLAND long videos FIRST (playable 100% offline!)
    try {
      const r = await fetch('/api/videos/long?includeWatched=1');
      if (r.ok) {
        const data = await r.json();
        for (const v of (data?.videos || []) as LongVideo[]) {
          if (byId.size >= targetCount) break;
          byId.set(v.id, {
            id: v.id,
            kind: 'long',
            manualDownload: byId.get(v.id)?.manualDownload || false,
            cachedAt: Date.now(),
            title: v.title,
            thumbnailUrl: v.thumbnailUrl,
            videoUrl: v.videoUrl,
            youtubeId: v.youtubeId,
            source: v.source,
            hasFullVideoBlob: Boolean(v.videoUrl),
            payload: v,
          });
          if (v.videoUrl) nativeVideoUrls.push(v.videoUrl);
          thumbUrls.push(v.thumbnailUrl, v.channel?.avatar);
        }
      }
    } catch {
      // ignore
    }

    // 2. Fetch Home Feed posts (includes native MOTHERLAND video posts + photos!)
    try {
      for (let pPage = 1; pPage <= 5; pPage++) {
        const r = await fetch(`/api/posts?feedType=all&source=all&page=${pPage}&pageSize=15`);
        if (!r.ok) break;
        const data = await r.json();
        const list: Post[] = data?.posts || [];
        if (list.length === 0) break;
        for (const p of list) {
          collectedPosts.push(p);
          if (p.source === 'motherland' && p.mediaType === 'video' && p.mediaUrl) {
            nativeVideoUrls.push(p.mediaUrl);
            if (!byId.has(p.id) && byId.size < targetCount) {
              byId.set(p.id, {
                id: p.id,
                kind: 'post',
                manualDownload: false,
                cachedAt: Date.now(),
                title: p.content || p.author.displayName,
                thumbnailUrl: p.thumbnailUrl,
                videoUrl: p.mediaUrl,
                source: p.source,
                hasFullVideoBlob: true,
                payload: p,
              });
            }
          }
          thumbUrls.push(p.thumbnailUrl, p.author?.avatar, ...(p.images || []));
        }
      }
    } catch {
      // ignore
    }

    // 3. Fetch Shorts (prioritize native MOTHERLAND Shorts MP4s so vertical swipe plays offline!)
    try {
      const shortsBudget = Math.max(12, Math.round(targetCount * 0.25));
      let sPage = 1;
      let sToken = '';
      let sCount = 0;
      while (sCount < shortsBudget && sPage <= 8) {
        const qs = new URLSearchParams({
          includeWatched: '1',
          page: String(sPage),
          pageSize: '20',
        });
        if (sToken) qs.set('pageToken', sToken);
        const r = await fetch(`/api/videos/shorts?${qs.toString()}`);
        if (!r.ok) break;
        const data = await r.json();
        const list: ShortVideo[] = data?.shorts || [];
        if (list.length === 0) break;
        for (const s of list) {
          if (sCount >= shortsBudget) break;
          byId.set(s.id, {
            id: s.id,
            kind: 'short',
            manualDownload: byId.get(s.id)?.manualDownload || false,
            cachedAt: Date.now(),
            title: s.title,
            thumbnailUrl: s.thumbnailUrl,
            videoUrl: s.videoUrl,
            youtubeId: s.youtubeId,
            source: s.source,
            hasFullVideoBlob: Boolean(s.videoUrl),
            payload: s,
          });
          if (s.videoUrl) nativeVideoUrls.push(s.videoUrl);
          thumbUrls.push(s.thumbnailUrl, s.creator?.avatar);
          sCount += 1;
        }
        sToken = data?.nextPageToken || '';
        sPage += 1;
        if (!sToken && list.length < 8) break;
      }
    } catch {
      // ignore
    }

    // 4. Fetch Stories for offline Home carousel
    try {
      const sr = await fetch('/api/stories');
      if (sr.ok) {
        const sData = await sr.json();
        if (Array.isArray(sData?.stories) && sData.stories.length > 0) {
          await idbPutBatch(STORE_STORIES, sData.stories.slice(0, 30));
          for (const st of sData.stories) {
            if (st.mediaType === 'video' && st.mediaUrl) nativeVideoUrls.push(st.mediaUrl);
            else thumbUrls.push(st.mediaUrl);
            thumbUrls.push(st.author?.avatar);
          }
        }
      }
    } catch {
      // ignore
    }

    inMemoryProgress = { done: Math.min(targetCount, byId.size), total: targetCount };
    notifyVaultUpdated();

    // 5. Fill remaining slots up to targetCount from paginated Long feed
    let page = 1;
    let pageToken = '';
    while (byId.size < targetCount && page <= 16) {
      try {
        const qs = new URLSearchParams({
          type: 'long',
          category: 'all',
          page: String(page),
          pageSize: '30',
        });
        if (pageToken) qs.set('pageToken', pageToken);
        const r = await fetch(`/api/youtube/feed?${qs.toString()}`);
        if (!r.ok) break;
        const data = await r.json();
        const items: LongVideo[] = data?.items || [];
        if (items.length === 0) break;
        for (const v of items) {
          if (byId.size >= targetCount) break;
          if (!byId.has(v.id)) {
            byId.set(v.id, {
              id: v.id,
              kind: 'long',
              manualDownload: false,
              cachedAt: Date.now(),
              title: v.title,
              thumbnailUrl: v.thumbnailUrl,
              videoUrl: v.videoUrl,
              youtubeId: v.youtubeId,
              source: v.source,
              hasFullVideoBlob: Boolean(v.videoUrl),
              payload: v,
            });
            if (v.videoUrl) nativeVideoUrls.push(v.videoUrl);
            thumbUrls.push(v.thumbnailUrl, v.channel?.avatar);
          }
        }
        inMemoryProgress = { done: Math.min(targetCount, byId.size), total: targetCount };
        notifyVaultUpdated();

        pageToken = data?.nextPageToken || '';
        page += 1;
        if (!pageToken && items.length < 10) break;
      } catch {
        break;
      }
    }

    // 6. Download & verify ALL native video MP4 blobs FIRST, then thumbnails!
    const cachedVideoKeys = await cacheAssetUrls(nativeVideoUrls);
    void cacheAssetUrls(thumbUrls.slice(0, targetCount * 2));

    // Update exact `hasFullVideoBlob` flags based on confirmed binary blobs
    const allRecords = Array.from(byId.values()).map((r) => {
      const k = normalizeMediaKey(r.videoUrl);
      const confirmed = Boolean(k && cachedVideoKeys.has(k));
      return { ...r, hasFullVideoBlob: confirmed };
    });

    await idbPutBatch(STORE_VIDEOS, allRecords);
    if (collectedPosts.length > 0) {
      await idbPutBatch(STORE_POSTS, collectedPosts);
    }

    const totalSaved = allRecords.length;
    const fullCount = allRecords.filter((r) => r.hasFullVideoBlob).length;
    writeFastMeta({
      targetPackCount: targetCount,
      syncedCount: totalSaved,
      lastSyncedAt: Date.now(),
    });
    inMemoryStatus = `${totalSaved}টি আইটেম ক্যাশড (পূর্ণ MP4 ভিডিও: ${fullCount}টি অফলাইনে চলবে ✓)`;
    return totalSaved;
  } finally {
    inMemorySyncing = false;
    inMemoryProgress = null;
    notifyVaultUpdated();
  }
}

// Passive online mirroring
export async function mirrorOnlinePosts(posts: Post[]): Promise<void> {
  if (!posts || posts.length === 0) return;
  const meta = readFastMeta();
  const limit = meta.targetPackCount || 40;
  const slice = posts.slice(0, limit);
  await idbPutBatch(STORE_POSTS, slice);
  const nativeUrls = slice
    .filter((p) => p.source === 'motherland' && p.mediaType === 'video' && p.mediaUrl)
    .map((p) => p.mediaUrl);
  void cacheAssetUrls([...nativeUrls, ...slice.slice(0, 12).flatMap((p) => [p.thumbnailUrl, p.author?.avatar])]);
}

export async function mirrorOnlineLongVideos(videos: LongVideo[]): Promise<void> {
  if (!videos || videos.length === 0) return;
  const meta = readFastMeta();
  const limit = meta.targetPackCount || 40;
  const existing = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  if (existing.length >= limit) return;
  const records: OfflineStoredVideoRecord[] = videos.slice(0, 30).map((v) => ({
    id: v.id,
    kind: 'long',
    manualDownload: false,
    cachedAt: Date.now(),
    title: v.title,
    thumbnailUrl: v.thumbnailUrl,
    videoUrl: v.videoUrl,
    youtubeId: v.youtubeId,
    source: v.source,
    hasFullVideoBlob: false,
    payload: v,
  }));
  await idbPutBatch(STORE_VIDEOS, records);
  const nativeUrls = videos.filter((v) => v.source === 'motherland' && v.videoUrl).map((v) => v.videoUrl);
  void cacheAssetUrls([...nativeUrls, ...videos.slice(0, 10).map((v) => v.thumbnailUrl)]);
}

export async function mirrorOnlineShorts(shorts: ShortVideo[]): Promise<void> {
  if (!shorts || shorts.length === 0) return;
  const meta = readFastMeta();
  const limit = meta.targetPackCount || 40;
  const existing = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  if (existing.length >= limit) return;
  const records: OfflineStoredVideoRecord[] = shorts.slice(0, 20).map((s) => ({
    id: s.id,
    kind: 'short',
    manualDownload: false,
    cachedAt: Date.now(),
    title: s.title,
    thumbnailUrl: s.thumbnailUrl,
    videoUrl: s.videoUrl,
    youtubeId: s.youtubeId,
    source: s.source,
    hasFullVideoBlob: false,
    payload: s,
  }));
  await idbPutBatch(STORE_VIDEOS, records);
  const nativeUrls = shorts.filter((s) => s.source === 'motherland' && s.videoUrl).map((s) => s.videoUrl);
  void cacheAssetUrls(nativeUrls);
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
      r.hasFullVideoBlob || (r.videoUrl && blobKeys.has(normalizeMediaKey(r.videoUrl)))
    );
    if (r.kind === 'long') {
      items.push({
        score: (isPlayable ? 10 : 0) + (r.manualDownload ? 2 : 0),
        cachedAt: r.cachedAt,
        video: r.payload as LongVideo,
      });
    } else if (r.kind === 'post' && isPlayable && r.payload.mediaUrl) {
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

export async function getOfflineShorts(): Promise<ShortVideo[]> {
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const blobKeys = new Set(await idbGetAllKeys(STORE_BLOBS));
  return all
    .filter((r) => r.kind === 'short' && r.payload)
    .sort((a, b) => {
      const aFull = Boolean(a.hasFullVideoBlob || (a.videoUrl && blobKeys.has(normalizeMediaKey(a.videoUrl))));
      const bFull = Boolean(b.hasFullVideoBlob || (b.videoUrl && blobKeys.has(normalizeMediaKey(b.videoUrl))));
      return (
        Number(bFull) - Number(aFull) ||
        Number(b.manualDownload) - Number(a.manualDownload) ||
        b.cachedAt - a.cachedAt
      );
    })
    .map((r) => r.payload as ShortVideo);
}

export async function getOfflinePosts(): Promise<Post[]> {
  const allPosts = await idbGetAll<Post>(STORE_POSTS);
  const videoRecs = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const blobKeys = new Set(await idbGetAllKeys(STORE_BLOBS));
  const byId = new Map<string, Post>();
  for (const r of videoRecs) {
    if (r.kind === 'post' && r.payload?.id) {
      byId.set(r.payload.id, r.payload as Post);
    }
  }
  for (const p of allPosts) {
    if (p?.id && !byId.has(p.id)) {
      byId.set(p.id, p);
    }
  }
  // Put MOTHERLAND native playable videos & posts FIRST when offline!
  return Array.from(byId.values()).sort((a, b) => {
    const aPlayable = Boolean(a.mediaUrl && blobKeys.has(normalizeMediaKey(a.mediaUrl)));
    const bPlayable = Boolean(b.mediaUrl && blobKeys.has(normalizeMediaKey(b.mediaUrl)));
    return (
      Number(bPlayable) - Number(aPlayable) ||
      Number(b.source === 'motherland') - Number(a.source === 'motherland')
    );
  });
}

export async function getOfflineStories(): Promise<Story[]> {
  return idbGetAll<Story>(STORE_STORIES);
}
