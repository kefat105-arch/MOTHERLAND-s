import { useEffect, useState } from 'react';
import type { LongVideo, Post, ShortVideo, Story } from '../types';
import type { UnifiedVideo } from '../types/video';

export const OFFLINE_TIER_OPTIONS = [40, 80, 120, 240, 480] as const;
export type OfflinePackTier = (typeof OFFLINE_TIER_OPTIONS)[number];

const DB_NAME = 'motherland_offline_db_v1';
const DB_VERSION = 1;
const STORE_VIDEOS = 'offline_videos';
const STORE_POSTS = 'offline_posts';
const STORE_STORIES = 'offline_stories';
const STORE_META = 'offline_meta';
const MEDIA_CACHE_NAME = 'motherland-offline-media-v1';
const VAULT_EVENT = 'motherland:offline-vault-updated';
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
  payload: any;
}

export interface OfflineVaultSnapshot {
  targetPackCount: OfflinePackTier | null;
  syncedCount: number;
  manualCount: number;
  totalVideosCount: number;
  lastSyncedAt: number | null;
  downloadedIds: Set<string>;
  isSyncing: boolean;
  syncProgress: { done: number; total: number } | null;
  statusMessage: string;
}

let inMemorySyncing = false;
let inMemoryProgress: { done: number; total: number } | null = null;
let inMemoryStatus = '';

function notifyVaultUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VAULT_EVENT));
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
      const tx = db.transaction([STORE_VIDEOS, STORE_POSTS, STORE_STORIES, STORE_META], 'readwrite');
      tx.objectStore(STORE_VIDEOS).clear();
      tx.objectStore(STORE_POSTS).clear();
      tx.objectStore(STORE_STORIES).clear();
      tx.objectStore(STORE_META).clear();
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
  if (url.startsWith(window.location.origin + '/uploads/') || url.startsWith(window.location.origin + '/api/media/')) {
    return true;
  }
  return false;
}

async function cacheAssetUrls(urls: Array<string | undefined>): Promise<void> {
  if (typeof caches === 'undefined') return;
  const unique = Array.from(new Set(urls.filter(isCacheableMediaUrl)));
  if (unique.length === 0) return;

  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    // Process in modest batches to stay friendly to mobile network/battery
    const chunkSize = 4;
    for (let i = 0; i < unique.length; i += chunkSize) {
      const slice = unique.slice(i, i + chunkSize);
      await Promise.all(
        slice.map(async (url) => {
          try {
            const existing = await cache.match(url);
            if (existing) return;
            const isExternal = url.startsWith('http') && !url.startsWith(window.location.origin);
            const res = await fetch(url, { mode: isExternal ? 'no-cors' : 'same-origin' });
            if (res && (res.ok || res.type === 'opaque')) {
              await cache.put(url, res.clone());
            }
          } catch {
            // Best effort caching; do not break batch
          }
        })
      );
    }
  } catch {
    // ignore cache errors
  }
}

export async function resolveOfflineMediaUrl(url?: string): Promise<string> {
  if (!url) return '';
  if (typeof navigator !== 'undefined' && navigator.onLine) return url;
  if (typeof caches === 'undefined') return url;
  try {
    const cache = await caches.open(MEDIA_CACHE_NAME);
    const match = await cache.match(url);
    if (!match) return url;
    const blob = await match.blob();
    if (blob.size > 0) {
      return URL.createObjectURL(blob);
    }
  } catch {
    // fallback
  }
  return url;
}

export function isAppOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

export function useOfflineConnectivity(): {
  isOnline: boolean;
  isOfflineModeActive: boolean;
} {
  const [isOnline, setIsOnline] = useState<boolean>(() => isAppOnline());

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return {
    isOnline,
    isOfflineModeActive: !isOnline,
  };
}

export async function getOfflineVaultSnapshot(): Promise<OfflineVaultSnapshot> {
  const fastMeta = readFastMeta();
  const records = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const downloadedIds = new Set<string>();
  let manualCount = 0;
  for (const r of records) {
    if (r.manualDownload) {
      manualCount += 1;
      downloadedIds.add(r.id);
      if (r.youtubeId) downloadedIds.add(r.youtubeId);
      if (r.payload?.externalId) downloadedIds.add(String(r.payload.externalId));
    }
  }

  return {
    targetPackCount: fastMeta.targetPackCount,
    syncedCount: fastMeta.syncedCount || records.length,
    manualCount,
    totalVideosCount: records.length,
    lastSyncedAt: fastMeta.lastSyncedAt,
    downloadedIds,
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
      totalVideosCount: m.syncedCount,
      lastSyncedAt: m.lastSyncedAt,
      downloadedIds: new Set<string>(),
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
    payload: video,
  };
  await idbPutBatch(STORE_VIDEOS, [rec]);
  await cacheAssetUrls([video.thumbnailUrl, video.channel?.avatar, video.videoUrl]);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const meta = readFastMeta();
  writeFastMeta({ ...meta, syncedCount: all.length, lastSyncedAt: Date.now() });
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
    payload: short,
  };
  await idbPutBatch(STORE_VIDEOS, [rec]);
  await cacheAssetUrls([short.thumbnailUrl, short.creator?.avatar, short.videoUrl]);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const meta = readFastMeta();
  writeFastMeta({ ...meta, syncedCount: all.length, lastSyncedAt: Date.now() });
  notifyVaultUpdated();
  return true;
}

export async function savePostVideoOffline(post: Post): Promise<boolean> {
  if (!post?.id) return false;
  await idbPutBatch(STORE_POSTS, [{ ...post, cachedAt: Date.now() }]);
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
    payload: post,
  };
  await idbPutBatch(STORE_VIDEOS, [rec]);
  await cacheAssetUrls([post.thumbnailUrl, post.author?.avatar, post.mediaUrl]);
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const meta = readFastMeta();
  writeFastMeta({ ...meta, syncedCount: all.length, lastSyncedAt: Date.now() });
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
 * Keeps manual downloads untouched and updates progress live for MenuView.
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
  inMemoryStatus = `${targetCount}টি ভিডিও ও হোম ফিড প্রস্তুত করা হচ্ছে...`;
  writeFastMeta({ ...readFastMeta(), targetPackCount: targetCount });
  notifyVaultUpdated();

  const existingRecords = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  const byId = new Map<string, OfflineStoredVideoRecord>();
  for (const r of existingRecords) {
    if (r.manualDownload) byId.set(r.id, r);
  }

  const collectedPosts: Post[] = [];
  const assetUrlsToCache: Array<string | undefined> = [];

  try {
    // 1. Fetch native MOTHERLAND long videos
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
            payload: v,
          });
          assetUrlsToCache.push(v.thumbnailUrl, v.channel?.avatar, v.videoUrl);
        }
      }
    } catch {
      // ignore
    }

    inMemoryProgress = { done: Math.min(targetCount, byId.size), total: targetCount };
    notifyVaultUpdated();

    // 2. Fetch paginated YouTube/Long feed pages until reaching targetCount (capped safely at 16 pages)
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
            payload: v,
          });
          assetUrlsToCache.push(v.thumbnailUrl, v.channel?.avatar);
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

    // 3. Also grab Shorts & Home Feed posts so Home + Shorts work smoothly offline
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
          const sid = `short_${s.id}`;
          byId.set(sid, {
            id: s.id,
            kind: 'short',
            manualDownload: byId.get(s.id)?.manualDownload || false,
            cachedAt: Date.now(),
            title: s.title,
            thumbnailUrl: s.thumbnailUrl,
            videoUrl: s.videoUrl,
            youtubeId: s.youtubeId,
            source: s.source,
            payload: s,
          });
          assetUrlsToCache.push(s.thumbnailUrl, s.creator?.avatar, s.videoUrl);
          sCount += 1;
        }
        sToken = data?.nextPageToken || '';
        sPage += 1;
        if (!sToken && list.length < 8) break;
      }
    } catch {
      // ignore
    }

    try {
      for (let pPage = 1; pPage <= 3; pPage++) {
        const r = await fetch(`/api/posts?feedType=all&source=all&page=${pPage}&pageSize=15`);
        if (!r.ok) break;
        const data = await r.json();
        const list: Post[] = data?.posts || [];
        if (list.length === 0) break;
        for (const p of list) {
          collectedPosts.push(p);
          assetUrlsToCache.push(p.thumbnailUrl, p.author?.avatar, p.mediaUrl);
        }
      }
    } catch {
      // ignore
    }

    // Persist into IndexedDB cleanly
    const allRecords = Array.from(byId.values());
    await idbPutBatch(STORE_VIDEOS, allRecords);
    if (collectedPosts.length > 0) {
      await idbPutBatch(STORE_POSTS, collectedPosts);
    }

    // Cache thumbnails & native MP4 files into Service Worker/Cache Storage
    await cacheAssetUrls(assetUrlsToCache.slice(0, targetCount * 2));

    const totalSaved = allRecords.length;
    writeFastMeta({
      targetPackCount: targetCount,
      syncedCount: totalSaved,
      lastSyncedAt: Date.now(),
    });
    inMemoryStatus = `${totalSaved}টি ভিডিও অফলাইনে প্রস্তুত (ইন্টারনেট গেলে অটো চালু হবে)`;
    return totalSaved;
  } finally {
    inMemorySyncing = false;
    inMemoryProgress = null;
    notifyVaultUpdated();
  }
}

// Passive online mirroring so recent browsing is also ready offline when a pack is active
export async function mirrorOnlinePosts(posts: Post[]): Promise<void> {
  if (!posts || posts.length === 0) return;
  const meta = readFastMeta();
  const limit = meta.targetPackCount || 40;
  const slice = posts.slice(0, limit);
  await idbPutBatch(STORE_POSTS, slice);
  void cacheAssetUrls(slice.slice(0, 12).flatMap((p) => [p.thumbnailUrl, p.author?.avatar]));
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
    payload: v,
  }));
  await idbPutBatch(STORE_VIDEOS, records);
  void cacheAssetUrls(videos.slice(0, 10).map((v) => v.thumbnailUrl));
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
    payload: s,
  }));
  await idbPutBatch(STORE_VIDEOS, records);
}

export async function mirrorOnlineStories(stories: Story[]): Promise<void> {
  if (!stories || stories.length === 0) return;
  await idbPutBatch(STORE_STORIES, stories.slice(0, 30));
}

export async function getOfflineLongVideos(): Promise<LongVideo[]> {
  const meta = readFastMeta();
  const limit = meta.targetPackCount || 480;
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  return all
    .filter((r) => r.kind === 'long' && r.payload)
    .sort((a, b) => Number(b.manualDownload) - Number(a.manualDownload) || b.cachedAt - a.cachedAt)
    .slice(0, limit)
    .map((r) => r.payload as LongVideo);
}

export async function getOfflineShorts(): Promise<ShortVideo[]> {
  const all = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
  return all
    .filter((r) => r.kind === 'short' && r.payload)
    .sort((a, b) => Number(b.manualDownload) - Number(a.manualDownload) || b.cachedAt - a.cachedAt)
    .map((r) => r.payload as ShortVideo);
}

export async function getOfflinePosts(): Promise<Post[]> {
  const allPosts = await idbGetAll<Post>(STORE_POSTS);
  const videoRecs = await idbGetAll<OfflineStoredVideoRecord>(STORE_VIDEOS);
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
  return Array.from(byId.values());
}

export async function getOfflineStories(): Promise<Story[]> {
  return idbGetAll<Story>(STORE_STORIES);
}
