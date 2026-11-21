/**
 * Direct Browser <-> YouTube Data API v3 Engine (Server-Independent)
 * Runs 100% independently from the MOTHERLAND backend server so even if MOTHERLAND's
 * server goes down or restarts, all YouTube discovery, search, feeds, Shorts, comments,
 * channels, and embeds keep playing uninterrupted whenever the user has internet.
 */

import type {
  LongVideo,
  Post,
  ShortVideo,
  YouTubeCommentThread,
} from '../types';
import {
  getActiveYouTubeApiKey,
  setActiveYouTubeApiKey,
  PROVIDED_YOUTUBE_API_KEY,
  VERIFIED_YOUTUBE_VIDEOS,
} from './youtubeService';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
const GOOGLE_AUTH_STORAGE_KEY = 'motherland_google_youtube_auth_v3';
const YT_DIRECT_POST_CACHE_KEY = 'motherland_yt_direct_posts_cache_v1';
const YT_DIRECT_SHORTS_CACHE_KEY = 'motherland_yt_direct_shorts_cache_v1';

interface CachedChannelMeta {
  avatar: string;
  subscriberCount: string;
  title?: string;
  cachedAt: number;
}

const channelMetaCache = new Map<string, CachedChannelMeta>();
const CHANNEL_CACHE_TTL_MS = 30 * 60 * 1000;

const POPULAR_REGION_CODES = ['BD', 'US', 'GB', 'IN', 'CA', 'SG', 'AU', 'MY'];
const YOUTUBE_CHART_CATEGORY_IDS = ['0', '10', '20', '24', '28', '17', '22', '25', '1', '23'];

const CATEGORY_QUERIES: Record<string, string[]> = {
  all: [
    'Bangladesh travel documentary 4K',
    'trending music video 4K',
    'science technology documentary',
    'cricket highlights world',
    'world street food tour',
    'nature wildlife 4K documentary',
    'gaming showcase gameplay 4K',
  ],
  trending: ['trending viral video 4K', 'top music hits global', 'Bangladesh trending video'],
  bangla: ['Bangla natok official', 'Coke Studio Bangla', 'Bangladesh travel vlog 4K', 'Dhaka street food'],
  music: ['official music video 4K', 'Coke Studio Bangla', 'lofi acoustic live session', 'world music concert'],
  gaming: ['4K open world gameplay', 'esports championship highlights', 'minecraft roblox adventure showcase'],
  sports: ['cricket match highlights', 'football champions highlights', 'badminton olympic rally'],
  tech: ['AI technology breakthrough explained', 'smartphone review 4K', 'space rocket launch 4K'],
  news: ['world news documentary', 'Bangladesh news report', 'economy global documentary'],
  entertainment: ['comedy show highlights', 'cinema behind the scenes', 'magic illusion stage'],
  education: ['cosmos universe documentary 4K', 'history civilization documentary', 'how things are made factory'],
  travel: ['Switzerland Alps 4K scenic', 'Sundarbans Coxs Bazar Bangladesh 4K', 'Tokyo Kyoto walking tour 4K'],
  food: ['Old Dhaka biryani street food', 'master chef cooking 4K', 'Asian street food night market'],
};

const SHORTS_QUERIES = [
  '#shorts satisfying art creative',
  '#shorts cricket amazing catch',
  '#shorts nature waterfall 4K',
  '#shorts Dhaka Bangladesh travel',
  '#shorts cute pets funny animals',
  '#shorts science experiment cool',
  '#shorts street food quick recipe',
  '#shorts tech gadget trick',
];

function b64UrlEncode(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((b) => {
      bin += String.fromCharCode(b);
    });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function b64UrlDecode(str: string): string {
  try {
    const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

interface DirectCursor {
  mode: 'api_chart' | 'api_search' | 'catalog';
  qIdx: number;
  rIdx: number;
  chartIdx: number;
  pageToken: string;
  offset: number;
}

function encodeCursor(c: DirectCursor): string {
  return 'ytd_' + b64UrlEncode(JSON.stringify(c));
}

function decodeCursor(raw: string): DirectCursor | null {
  if (!raw || !raw.startsWith('ytd_')) return null;
  try {
    const parsed = JSON.parse(b64UrlDecode(raw.slice(4)));
    if (parsed && typeof parsed === 'object') {
      return {
        mode: parsed.mode === 'api_chart' || parsed.mode === 'catalog' ? parsed.mode : 'api_search',
        qIdx: Number(parsed.qIdx) || 0,
        rIdx: Number(parsed.rIdx) || 0,
        chartIdx: Number(parsed.chartIdx) || 0,
        pageToken: typeof parsed.pageToken === 'string' ? parsed.pageToken : '',
        offset: Number(parsed.offset) || 0,
      };
    }
  } catch {
    // ignore malformed cursor
  }
  return null;
}

export function getClientGoogleOAuthToken(): string {
  try {
    const raw = localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (parsed?.accessToken && (!parsed.expiresAt || Number(parsed.expiresAt) > Date.now())) {
      return String(parsed.accessToken);
    }
  } catch {
    // ignore
  }
  return '';
}

export function parseIsoDurationToSeconds(iso?: string): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] || '0', 10) * 3600 +
    parseInt(match[2] || '0', 10) * 60 +
    parseInt(match[3] || '0', 10)
  );
}

export function formatIsoDuration(iso?: string): string {
  const totalSec = parseIsoDurationToSeconds(iso);
  if (totalSec <= 0) return '0:00';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatSubscriberLabel(rawCount?: string | number | null): string {
  const n = Number(rawCount);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M subscribers`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K subscribers`;
  return `${n.toLocaleString()} subscribers`;
}

function classifyCategory(title: string, description: string, ytCatId?: string): { categoryId: string; categoryLabel: string } {
  const text = `${title} ${description}`.toLowerCase();
  if (ytCatId === '10' || /song|music|coke studio|audio|official video|concert/.test(text)) {
    return { categoryId: 'music', categoryLabel: 'Music' };
  }
  if (ytCatId === '20' || /gameplay|gaming|minecraft|roblox|esports|pubg|valorant/.test(text)) {
    return { categoryId: 'gaming', categoryLabel: 'Gaming' };
  }
  if (ytCatId === '17' || /cricket|football|goal|match|ipl|bpl|world cup/.test(text)) {
    return { categoryId: 'sports', categoryLabel: 'Sports' };
  }
  if (ytCatId === '28' || /\bai\b|tech|iphone|samsung|coding|space|rocket/.test(text)) {
    return { categoryId: 'tech', categoryLabel: 'Science & Tech' };
  }
  if (ytCatId === '25' || /news|breaking|report|documentary/.test(text)) {
    return { categoryId: 'news', categoryLabel: 'News & Doc' };
  }
  if (/bangla|dhaka|bangladesh|natok|sylhet|coxs/.test(text)) {
    return { categoryId: 'bangla', categoryLabel: 'Bangla' };
  }
  if (/food|recipe|biryani|cooking|kitchen/.test(text)) {
    return { categoryId: 'food', categoryLabel: 'Food' };
  }
  if (/travel|tour|mountains|4k|scenic/.test(text)) {
    return { categoryId: 'travel', categoryLabel: 'Travel' };
  }
  return { categoryId: 'entertainment', categoryLabel: 'Entertainment' };
}

async function callYouTubeDirectApi(
  endpoint: string,
  params: Record<string, string>,
  signal?: AbortSignal,
  oauthToken?: string
): Promise<any> {
  const url = new URL(`${YT_API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, v);
    }
  }
  const headers: Record<string, string> = {};
  if (oauthToken) {
    headers.Authorization = `Bearer ${oauthToken}`;
  } else {
    const key = getActiveYouTubeApiKey();
    if (!key) {
      const err: any = new Error('NO_API_KEY');
      err.code = 'NO_API_KEY';
      throw err;
    }
    url.searchParams.set('key', key);
  }

  const res = await fetch(url.toString(), { headers, signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || '';
    const err: any = new Error(data?.error?.message || `YouTube API error (${res.status})`);
    err.status = res.status;
    err.reason = reason;
    err.youtubeError = data?.error;
    throw err;
  }
  return data;
}

async function fetchChannelMetaMapDirect(channelIds: string[], signal?: AbortSignal): Promise<Map<string, CachedChannelMeta>> {
  const result = new Map<string, CachedChannelMeta>();
  const now = Date.now();
  const missing: string[] = [];

  for (const rawId of channelIds) {
    const cid = String(rawId || '').trim();
    if (!cid || cid === 'yt' || cid === 'yt_live') continue;
    const cached = channelMetaCache.get(cid);
    if (cached && now - cached.cachedAt < CHANNEL_CACHE_TTL_MS) {
      result.set(cid, cached);
    } else if (!missing.includes(cid)) {
      missing.push(cid);
    }
  }

  for (let i = 0; i < missing.length; i += 45) {
    const batch = missing.slice(i, i + 45);
    try {
      const chData = await callYouTubeDirectApi(
        'channels',
        { part: 'snippet,statistics', id: batch.join(',') },
        signal
      );
      for (const ch of chData.items || []) {
        const avatar =
          ch.snippet?.thumbnails?.medium?.url ||
          ch.snippet?.thumbnails?.high?.url ||
          ch.snippet?.thumbnails?.default?.url ||
          '';
        const subCount = ch.statistics?.hiddenSubscriberCount
          ? ''
          : formatSubscriberLabel(ch.statistics?.subscriberCount);
        const entry: CachedChannelMeta = {
          avatar,
          subscriberCount: subCount,
          title: ch.snippet?.title,
          cachedAt: now,
        };
        channelMetaCache.set(ch.id, entry);
        result.set(ch.id, entry);
      }
    } catch {
      // Non-fatal: continue even if channel enrichment hits quota
    }
  }
  return result;
}

function mapVideoItem(rawItem: any, channelMap?: Map<string, CachedChannelMeta>) {
  const channelId = rawItem?.snippet?.channelId || '';
  const chMeta = channelId ? channelMap?.get(channelId) : undefined;
  const title = rawItem?.snippet?.title || 'YouTube Video';
  const description = rawItem?.snippet?.description || '';
  const cls = classifyCategory(title, description, rawItem?.snippet?.categoryId);
  return {
    id: rawItem.id,
    source: 'youtube' as const,
    youtubeId: rawItem.id,
    title,
    description,
    publishedAt: rawItem?.snippet?.publishedAt || new Date().toISOString(),
    channel: {
      id: channelId,
      title: rawItem?.snippet?.channelTitle || chMeta?.title || 'YouTube Creator',
      avatar: chMeta?.avatar || '',
      subscriberCount: chMeta?.subscriberCount || '',
      url: channelId ? `https://www.youtube.com/channel/${channelId}` : undefined,
      isVerified: Boolean(rawItem?.snippet?.channelTitle),
    },
    thumbnailUrl:
      rawItem?.snippet?.thumbnails?.maxres?.url ||
      rawItem?.snippet?.thumbnails?.high?.url ||
      rawItem?.snippet?.thumbnails?.medium?.url ||
      `https://i.ytimg.com/vi/${rawItem.id}/hqdefault.jpg`,
    duration: formatIsoDuration(rawItem?.contentDetails?.duration),
    durationSeconds: parseIsoDurationToSeconds(rawItem?.contentDetails?.duration),
    stats: {
      views: Number(rawItem?.statistics?.viewCount) || 0,
      likes: Number(rawItem?.statistics?.likeCount) || 0,
      comments: Number(rawItem?.statistics?.commentCount) || 0,
    },
    categoryId: cls.categoryId,
    categoryLabel: cls.categoryLabel,
  };
}

function mapItemToPost(item: ReturnType<typeof mapVideoItem>): Post {
  const tags = [item.categoryLabel, 'YouTube'].filter(Boolean);
  return {
    id: `yt_${item.youtubeId}`,
    source: 'youtube',
    externalId: item.youtubeId,
    author: {
      id: item.channel.id || `yt_ch_${item.youtubeId}`,
      username: (item.channel.title || 'youtube').toLowerCase().replace(/[^a-z0-9]/g, '') || 'youtube',
      displayName: item.channel.title || 'YouTube',
      avatar: item.channel.avatar || '',
      isVerified: true,
      url: item.channel.url,
    },
    content: item.title,
    mediaType: 'video',
    mediaUrl: `https://www.youtube.com/watch?v=${item.youtubeId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${item.youtubeId}?enablejsapi=1`,
    thumbnailUrl: item.thumbnailUrl,
    duration: item.duration,
    mediaAspectRatio: '16:9',
    hashtags: tags,
    audience: 'public',
    stats: {
      likes: item.stats.likes || 0,
      comments: item.stats.comments || 0,
      shares: Math.max(0, Math.floor((item.stats.likes || 0) * 0.08)),
      views: item.stats.views || 0,
    },
    createdAt: item.publishedAt || new Date().toISOString(),
  } as Post;
}

function mapItemToShort(item: ReturnType<typeof mapVideoItem>): ShortVideo {
  return {
    id: item.youtubeId,
    source: 'youtube',
    youtubeId: item.youtubeId,
    videoUrl: '',
    durationSeconds: item.durationSeconds || 45,
    thumbnailUrl: item.thumbnailUrl,
    title: item.title,
    caption: item.description || item.title,
    hashtags: ['Shorts', item.categoryLabel || 'Trending'],
    creator: {
      id: item.channel.id,
      name: item.channel.title,
      username: (item.channel.title || 'creator').toLowerCase().replace(/\s+/g, ''),
      avatar: item.channel.avatar || '',
      isVerified: true,
    },
    stats: {
      views: item.stats.views || 0,
      likes: item.stats.likes || 0,
      comments: item.stats.comments || 0,
      shares: 0,
    },
    createdAt: item.publishedAt || new Date().toISOString(),
  };
}

function readLocalCache<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocalCache<T extends { id: string }>(key: string, items: T[]): void {
  try {
    if (!items.length) return;
    const prev = readLocalCache<T>(key);
    const map = new Map<string, T>();
    for (const it of items) map.set(it.id, it);
    for (const old of prev) if (!map.has(old.id)) map.set(old.id, old);
    localStorage.setItem(key, JSON.stringify(Array.from(map.values()).slice(0, 80)));
  } catch {
    // ignore quota errors
  }
}

function getFallbackLongPool(category = 'all') {
  const cached = readLocalCache<ReturnType<typeof mapVideoItem>>(YT_DIRECT_POST_CACHE_KEY);
  const fromCatalog = VERIFIED_YOUTUBE_VIDEOS.map((v) => ({
    id: v.videoId,
    source: 'youtube' as const,
    youtubeId: v.videoId,
    title: v.title,
    description: v.description || v.title,
    publishedAt: v.publishedAt || new Date().toISOString(),
    channel: {
      id: v.sourceMetadata?.channelId || `ch_${v.videoId}`,
      title: v.creatorName,
      avatar: '',
      subscriberCount: '',
      url: v.creatorHandle ? `https://www.youtube.com/${v.creatorHandle}` : undefined,
      isVerified: true,
    },
    thumbnailUrl: v.thumbnailUrl,
    duration: v.duration || '4:15',
    durationSeconds: (() => {
      const parts = String(v.duration || '4:15').split(':').map(Number);
      if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
        return parts[0] * 60 + parts[1];
      }
      if (parts.length === 3 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && Number.isFinite(parts[2])) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      return 255;
    })(),
    stats: { views: 120000, likes: 4800, comments: 210 },
    categoryId: v.category || 'entertainment',
    categoryLabel: v.category || 'Entertainment',
  }));
  const mergedMap = new Map<string, ReturnType<typeof mapVideoItem>>();
  for (const c of cached) mergedMap.set(c.id, c);
  for (const v of fromCatalog) if (!mergedMap.has(v.id)) mergedMap.set(v.id, v);
  let pool = Array.from(mergedMap.values());
  if (category && category !== 'all' && category !== 'trending') {
    const filtered = pool.filter(
      (it) => it.categoryId === category || it.title.toLowerCase().includes(category.toLowerCase())
    );
    if (filtered.length >= 4) pool = filtered;
  }
  return pool;
}

export const directYouTubeService = {
  async getStatus(): Promise<{
    configured: boolean;
    quotaExceeded: boolean;
    connected: boolean;
    directYouTubeMode: boolean;
    keyPreview: string;
  }> {
    const key = getActiveYouTubeApiKey();
    if (!key) {
      return {
        configured: false,
        quotaExceeded: false,
        connected: false,
        directYouTubeMode: true,
        keyPreview: '',
      };
    }
    try {
      await callYouTubeDirectApi('videos', { part: 'id', id: 'dQw4w9WgXcQ' });
      return {
        configured: true,
        quotaExceeded: false,
        connected: true,
        directYouTubeMode: true,
        keyPreview: `${key.slice(0, 8)}...${key.slice(-4)}`,
      };
    } catch (err: any) {
      const quota = err?.status === 403 && /quota/i.test(String(err?.message || err?.reason || ''));
      return {
        configured: true,
        quotaExceeded: quota,
        connected: !quota && err?.status !== 400,
        directYouTubeMode: true,
        keyPreview: `${key.slice(0, 8)}...${key.slice(-4)}`,
      };
    }
  },

  async setApiKey(
    apiKey: string
  ): Promise<{ success: boolean; keyPreview: string; message?: string; error?: string }> {
    const clean = String(apiKey || '').trim();
    if (!clean) {
      setActiveYouTubeApiKey('');
      return { success: true, keyPreview: `${PROVIDED_YOUTUBE_API_KEY.slice(0, 8)}...` };
    }
    const prev = getActiveYouTubeApiKey();
    setActiveYouTubeApiKey(clean);
    try {
      await callYouTubeDirectApi('videos', { part: 'id', id: 'dQw4w9WgXcQ' });
      return {
        success: true,
        keyPreview: `${clean.slice(0, 8)}...${clean.slice(-4)}`,
        message: 'YouTube API Key verified directly with Google YouTube servers.',
      };
    } catch (err: any) {
      setActiveYouTubeApiKey(prev === PROVIDED_YOUTUBE_API_KEY ? '' : prev);
      throw new Error(err?.message || 'Invalid YouTube Data API v3 Key');
    }
  },

  async searchVideos(
    query: string,
    pageToken = '',
    maxResults = 15,
    videoDuration = '',
    options?: { continuous?: boolean; signal?: AbortSignal }
  ): Promise<{
    items: any[];
    nextPageToken: string | null;
    prevPageToken?: string | null;
    quotaFallback?: boolean;
    message?: string;
  }> {
    const clean = String(query || '').trim() || 'Bangladesh trending 4K';
    const baseTokens = clean.split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
    const queryChain = [clean, `${baseTokens} full video`, `${baseTokens} documentary`, `${baseTokens} 2025`];

    let qIdx = 0;
    let ytToken = pageToken || '';
    if (pageToken.startsWith('ytds_')) {
      try {
        const parsed = JSON.parse(b64UrlDecode(pageToken.slice(5)));
        qIdx = Number(parsed?.qIdx) || 0;
        ytToken = String(parsed?.pt || '');
      } catch {
        // ignore
      }
    }

    const activeQuery = queryChain[qIdx % queryChain.length] || clean;
    try {
      const searchParams: Record<string, string> = {
        part: 'snippet',
        q: activeQuery,
        type: 'video',
        maxResults: String(Math.min(25, Math.max(5, maxResults))),
        safeSearch: 'moderate',
      };
      if (ytToken) searchParams.pageToken = ytToken;
      if (videoDuration) searchParams.videoDuration = videoDuration;

      const searchData = await callYouTubeDirectApi('search', searchParams, options?.signal);
      const videoIds = (searchData.items || [])
        .map((it: any) => it?.id?.videoId)
        .filter(Boolean);

      let mapped: any[] = [];
      if (videoIds.length > 0) {
        const statsData = await callYouTubeDirectApi(
          'videos',
          { part: 'snippet,contentDetails,statistics', id: videoIds.slice(0, 25).join(',') },
          options?.signal
        );
        const channelIds = (statsData.items || []).map((v: any) => v.snippet?.channelId).filter(Boolean);
        const chMap = await fetchChannelMetaMapDirect(channelIds, options?.signal);
        mapped = (statsData.items || []).map((v: any) => mapVideoItem(v, chMap));
        writeLocalCache(YT_DIRECT_POST_CACHE_KEY, mapped);
      }

      let nextToken: string | null = null;
      if (searchData.nextPageToken) {
        nextToken = options?.continuous
          ? 'ytds_' + b64UrlEncode(JSON.stringify({ qIdx, pt: searchData.nextPageToken }))
          : searchData.nextPageToken;
      } else if (options?.continuous && qIdx + 1 < queryChain.length) {
        nextToken = 'ytds_' + b64UrlEncode(JSON.stringify({ qIdx: qIdx + 1, pt: '' }));
      }

      return {
        items: mapped,
        nextPageToken: nextToken,
        prevPageToken: searchData.prevPageToken || null,
        quotaFallback: false,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      const lower = clean.toLowerCase();
      const pool = getFallbackLongPool('all').filter(
        (v) =>
          v.title.toLowerCase().includes(lower) ||
          v.channel.title.toLowerCase().includes(lower) ||
          v.description.toLowerCase().includes(lower)
      );
      const resultPool = pool.length > 0 ? pool : getFallbackLongPool('all');
      return {
        items: resultPool.slice(0, maxResults),
        nextPageToken: null,
        quotaFallback: true,
      };
    }
  },

  async getVideosByIds(ids: string, signal?: AbortSignal): Promise<{ items: any[] }> {
    const cleanIds = String(ids || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (!cleanIds.length) return { items: [] };
    try {
      const data = await callYouTubeDirectApi(
        'videos',
        { part: 'snippet,contentDetails,statistics', id: cleanIds.join(',') },
        signal
      );
      const chIds = (data.items || []).map((it: any) => it.snippet?.channelId).filter(Boolean);
      const chMap = await fetchChannelMetaMapDirect(chIds, signal);
      return {
        items: (data.items || []).map((it: any) => mapVideoItem(it, chMap)),
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      const pool = getFallbackLongPool('all');
      return {
        items: pool.filter((it) => cleanIds.includes(it.youtubeId)),
      };
    }
  },

  async getFeed(options: {
    type?: 'long' | 'shorts';
    category?: string;
    pageToken?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
    excludeIds?: Set<string>;
  } = {}): Promise<{
    items: any[];
    nextPageToken: string | null;
    page: number;
    hasMore: boolean;
    category: string;
    type: string;
    quotaExceeded?: boolean;
    exhaustedReason?: string;
  }> {
    const type = options.type === 'shorts' ? 'shorts' : 'long';
    const category = options.category || 'all';
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(25, Math.max(4, options.pageSize || 12));
    const queryList =
      type === 'shorts'
        ? SHORTS_QUERIES
        : CATEGORY_QUERIES[category] || [`${category} 4K video`, `${category} Bangladesh`];

    let cursor: DirectCursor = decodeCursor(options.pageToken || '') || {
      mode: type !== 'shorts' && (category === 'all' || category === 'trending') ? 'api_chart' : 'api_search',
      qIdx: 0,
      rIdx: Math.floor(Math.random() * 4),
      chartIdx: 0,
      pageToken: '',
      offset: 0,
    };

    const seen = new Set<string>();
    const items: any[] = [];
    let quotaExceeded = false;
    let attempts = 0;
    const maxAttempts = type === 'shorts' ? 4 : 3;

    try {
      while (items.length < pageSize && attempts < maxAttempts) {
        attempts++;
        if (cursor.mode === 'api_chart') {
          const region = POPULAR_REGION_CODES[cursor.rIdx % POPULAR_REGION_CODES.length] || 'BD';
          const catId = YOUTUBE_CHART_CATEGORY_IDS[cursor.chartIdx % YOUTUBE_CHART_CATEGORY_IDS.length] || '0';
          const data = await callYouTubeDirectApi(
            'videos',
            {
              part: 'snippet,contentDetails,statistics',
              chart: 'mostPopular',
              regionCode: region,
              videoCategoryId: catId,
              maxResults: String(Math.min(25, pageSize + 6)),
              pageToken: cursor.pageToken,
            },
            options.signal
          );
          const chIds = (data.items || []).map((v: any) => v.snippet?.channelId).filter(Boolean);
          const chMap = await fetchChannelMetaMapDirect(chIds, options.signal);
          for (const raw of data.items || []) {
            if (!raw?.id || seen.has(raw.id) || options.excludeIds?.has(raw.id)) continue;
            const mapped = mapVideoItem(raw, chMap);
            if (type === 'shorts' && (mapped.durationSeconds <= 0 || mapped.durationSeconds > 180)) continue;
            seen.add(raw.id);
            items.push(mapped);
          }
          if (data.nextPageToken) {
            cursor = { ...cursor, pageToken: data.nextPageToken };
          } else {
            cursor = {
              mode: attempts % 2 === 1 ? 'api_search' : 'api_chart',
              qIdx: (cursor.qIdx + 1) % queryList.length,
              rIdx: (cursor.rIdx + 1) % POPULAR_REGION_CODES.length,
              chartIdx: (cursor.chartIdx + 1) % YOUTUBE_CHART_CATEGORY_IDS.length,
              pageToken: '',
              offset: 0,
            };
          }
        } else {
          const q = queryList[cursor.qIdx % queryList.length] || 'Bangladesh trending 4K';
          const searchData = await callYouTubeDirectApi(
            'search',
            {
              part: 'snippet',
              q,
              type: 'video',
              maxResults: String(Math.min(20, pageSize + 6)),
              videoDuration: type === 'shorts' ? 'short' : '',
              pageToken: cursor.pageToken,
              safeSearch: 'moderate',
            },
            options.signal
          );
          const vids = (searchData.items || [])
            .map((it: any) => it?.id?.videoId as string | undefined)
            .filter(
              (id: string | undefined): id is string =>
                typeof id === 'string' && id.length > 0 && !seen.has(id) && !options.excludeIds?.has(id)
            );

          if (vids.length > 0) {
            const vidData = await callYouTubeDirectApi(
              'videos',
              { part: 'snippet,contentDetails,statistics', id: vids.slice(0, 25).join(',') },
              options.signal
            );
            const chIds = (vidData.items || []).map((v: any) => v.snippet?.channelId).filter(Boolean);
            const chMap = await fetchChannelMetaMapDirect(chIds, options.signal);
            for (const raw of vidData.items || []) {
              if (!raw?.id || seen.has(raw.id)) continue;
              const mapped = mapVideoItem(raw, chMap);
              if (type === 'shorts' && (mapped.durationSeconds <= 0 || mapped.durationSeconds > 180)) continue;
              seen.add(raw.id);
              items.push(mapped);
            }
          }

          cursor = {
            mode: searchData.nextPageToken ? 'api_search' : (category === 'all' && type !== 'shorts' ? 'api_chart' : 'api_search'),
            qIdx: searchData.nextPageToken ? cursor.qIdx : (cursor.qIdx + 1) % queryList.length,
            rIdx: (cursor.rIdx + 1) % POPULAR_REGION_CODES.length,
            chartIdx: (cursor.chartIdx + 1) % YOUTUBE_CHART_CATEGORY_IDS.length,
            pageToken: searchData.nextPageToken || '',
            offset: 0,
          };
        }
      }
      if (items.length > 0) {
        writeLocalCache(type === 'shorts' ? YT_DIRECT_SHORTS_CACHE_KEY : YT_DIRECT_POST_CACHE_KEY, items);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      quotaExceeded = err?.status === 403 || /quota/i.test(String(err?.message || err?.reason || ''));
    }

    if (items.length === 0) {
      const pool = getFallbackLongPool(category).filter((it) =>
        type === 'shorts' ? it.durationSeconds <= 180 : true
      );
      const start = ((page - 1) * pageSize) % Math.max(1, pool.length);
      const slice = pool.slice(start, start + pageSize);
      return {
        items: slice,
        nextPageToken: pool.length > pageSize ? encodeCursor({ mode: 'catalog', qIdx: 0, rIdx: 0, chartIdx: 0, pageToken: '', offset: start + pageSize }) : null,
        page,
        hasMore: pool.length > pageSize,
        category,
        type,
        quotaExceeded,
      };
    }

    const nextTok = encodeCursor(cursor);
    return {
      items: items.slice(0, pageSize),
      nextPageToken: nextTok,
      page,
      hasMore: true,
      category,
      type,
      quotaExceeded,
    };
  },

  async getDirectHomePosts(options: {
    page?: number;
    pageSize?: number;
    ytCursor?: string;
    signal?: AbortSignal;
    excludeIds?: Set<string>;
  } = {}): Promise<{
    posts: Post[];
    nextYtCursor: string | null;
    quotaExceeded?: boolean;
  }> {
    const res = await this.getFeed({
      type: 'long',
      category: 'all',
      page: options.page || 1,
      pageSize: options.pageSize || 8,
      pageToken: options.ytCursor || '',
      signal: options.signal,
      excludeIds: options.excludeIds,
    });
    return {
      posts: res.items.map(mapItemToPost),
      nextYtCursor: res.nextPageToken,
      quotaExceeded: res.quotaExceeded,
    };
  },

  async getDirectShortsFeed(options: {
    page?: number;
    pageSize?: number;
    pageToken?: string;
    signal?: AbortSignal;
    excludeIds?: Set<string>;
  } = {}): Promise<{
    shorts: ShortVideo[];
    nextPageToken: string | null;
    hasMore: boolean;
    quotaExceeded?: boolean;
  }> {
    const res = await this.getFeed({
      type: 'shorts',
      category: 'shorts',
      page: options.page || 1,
      pageSize: options.pageSize || 12,
      pageToken: options.pageToken || '',
      signal: options.signal,
      excludeIds: options.excludeIds,
    });
    return {
      shorts: res.items.map(mapItemToShort),
      nextPageToken: res.nextPageToken,
      hasMore: res.hasMore,
      quotaExceeded: res.quotaExceeded,
    };
  },

  async getComments(
    videoId: string,
    pageToken = '',
    order = 'relevance'
  ): Promise<{
    commentsDisabled: boolean;
    message?: string;
    items: YouTubeCommentThread[];
    nextPageToken?: string | null;
  }> {
    try {
      const data = await callYouTubeDirectApi('commentThreads', {
        part: 'snippet,replies',
        videoId,
        maxResults: '20',
        order,
        pageToken,
      });
      const items: YouTubeCommentThread[] = (data.items || []).map((thread: any) => {
        const top = thread.snippet?.topLevelComment?.snippet;
        const repliesData = thread.replies?.comments || [];
        return {
          id: thread.id,
          authorDisplayName: top?.authorDisplayName || 'YouTube User',
          authorProfileImageUrl: top?.authorProfileImageUrl || '',
          authorChannelUrl: top?.authorChannelUrl || '',
          textDisplay: top?.textDisplay || top?.textOriginal || '',
          likeCount: Number(top?.likeCount) || 0,
          publishedAt: top?.publishedAt || new Date().toISOString(),
          totalReplyCount: Number(thread.snippet?.totalReplyCount) || 0,
          replies: repliesData.map((reply: any) => ({
            id: reply.id,
            authorDisplayName: reply.snippet?.authorDisplayName || 'User',
            authorProfileImageUrl: reply.snippet?.authorProfileImageUrl || '',
            textDisplay: reply.snippet?.textDisplay || '',
            likeCount: Number(reply.snippet?.likeCount) || 0,
            publishedAt: reply.snippet?.publishedAt || '',
          })),
        };
      });
      return {
        commentsDisabled: false,
        items,
        nextPageToken: data.nextPageToken || null,
      };
    } catch (err: any) {
      if (err?.reason === 'commentsDisabled' || /disabled/i.test(String(err?.message || ''))) {
        return {
          commentsDisabled: true,
          message: 'Comments are disabled on this YouTube video.',
          items: [],
        };
      }
      return {
        commentsDisabled: false,
        message: err?.message,
        items: [],
      };
    }
  },

  async getLiveStreams(pageToken = '', q = ''): Promise<{
    items: LongVideo[];
    nextPageToken?: string | null;
    requiresApiKey?: boolean;
    error?: string;
    message?: string;
  }> {
    try {
      const searchData = await callYouTubeDirectApi('search', {
        part: 'snippet',
        eventType: 'live',
        type: 'video',
        maxResults: '18',
        q: q.trim() || 'Bangladesh live news music nature cam',
        pageToken,
      });
      const ids = (searchData.items || []).map((it: any) => it?.id?.videoId).filter(Boolean);
      if (!ids.length) {
        return { items: [], nextPageToken: null };
      }
      const vidData = await callYouTubeDirectApi('videos', {
        part: 'snippet,contentDetails,statistics,liveStreamingDetails',
        id: ids.join(','),
      });
      const chIds = (vidData.items || []).map((v: any) => v.snippet?.channelId).filter(Boolean);
      const chMap = await fetchChannelMetaMapDirect(chIds);
      const items: LongVideo[] = (vidData.items || []).map((v: any) => {
        const mapped = mapVideoItem(v, chMap);
        return {
          id: mapped.youtubeId,
          source: 'youtube',
          youtubeId: mapped.youtubeId,
          title: mapped.title,
          description: mapped.description,
          duration: 'LIVE',
          thumbnailUrl: mapped.thumbnailUrl,
          videoUrl: `https://www.youtube.com/watch?v=${mapped.youtubeId}`,
          channel: mapped.channel,
          stats: mapped.stats,
          publishedAt: mapped.publishedAt,
          tags: ['LIVE'],
        };
      });
      return {
        items,
        nextPageToken: searchData.nextPageToken || null,
      };
    } catch (err: any) {
      return {
        items: [],
        nextPageToken: null,
        error: 'LIVE_FETCH_NOTICE',
        message: err?.message || 'Unable to load live streams right now.',
      };
    }
  },

  async getChannelProfile(channelId: string, pageToken = ''): Promise<{
    channel: {
      id: string;
      source: 'youtube';
      title: string;
      description: string;
      customUrl?: string;
      avatar: string;
      bannerUrl?: string;
      subscriberCount: string;
      rawSubscriberCount: number | null;
      videoCount: number;
      viewCount: number;
      country?: string;
      publishedAt?: string;
      url: string;
    };
    videos: (LongVideo & { isShort?: boolean })[];
    smallVideos: (LongVideo & { isShort?: boolean })[];
    nextPageToken?: string | null;
  }> {
    const chData = await callYouTubeDirectApi('channels', {
      part: 'snippet,statistics,contentDetails,brandingSettings',
      id: channelId,
    });
    const chItem = chData?.items?.[0];
    if (!chItem) throw new Error('YouTube channel not found.');
    const uploadsPlaylistId = chItem.contentDetails?.relatedPlaylists?.uploads || '';
    const avatar =
      chItem.snippet?.thumbnails?.high?.url ||
      chItem.snippet?.thumbnails?.medium?.url ||
      chItem.snippet?.thumbnails?.default?.url ||
      '';
    const subLabel = chItem.statistics?.hiddenSubscriberCount
      ? 'Hidden'
      : formatSubscriberLabel(chItem.statistics?.subscriberCount) || '0 subscribers';

    const channel = {
      id: chItem.id,
      source: 'youtube' as const,
      title: chItem.snippet?.title || 'YouTube Channel',
      description: chItem.snippet?.description || '',
      customUrl: chItem.snippet?.customUrl || '',
      avatar,
      bannerUrl: chItem.brandingSettings?.image?.bannerExternalUrl || '',
      subscriberCount: subLabel,
      rawSubscriberCount: chItem.statistics?.hiddenSubscriberCount ? null : Number(chItem.statistics?.subscriberCount || 0),
      videoCount: Number(chItem.statistics?.videoCount || 0),
      viewCount: Number(chItem.statistics?.viewCount || 0),
      country: chItem.snippet?.country || '',
      publishedAt: chItem.snippet?.publishedAt || '',
      url: `https://www.youtube.com/channel/${chItem.id}`,
    };

    let videos: (LongVideo & { isShort?: boolean })[] = [];
    let smallVideos: (LongVideo & { isShort?: boolean })[] = [];
    let nextPageToken: string | null = null;

    if (uploadsPlaylistId) {
      const plData = await callYouTubeDirectApi('playlistItems', {
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: '25',
        pageToken,
      });
      nextPageToken = plData.nextPageToken || null;
      const vidIds = (plData.items || [])
        .map((it: any) => it?.contentDetails?.videoId || it?.snippet?.resourceId?.videoId)
        .filter(Boolean);
      if (vidIds.length > 0) {
        const vidData = await callYouTubeDirectApi('videos', {
          part: 'snippet,contentDetails,statistics',
          id: vidIds.join(','),
        });
        const mapped = (vidData.items || []).map((v: any) => {
          const m = mapVideoItem(v);
          const isShort = m.durationSeconds > 0 && m.durationSeconds <= 180;
          return {
            id: m.youtubeId,
            source: 'youtube' as const,
            youtubeId: m.youtubeId,
            title: m.title,
            description: m.description,
            duration: m.duration,
            thumbnailUrl: m.thumbnailUrl,
            videoUrl: `https://www.youtube.com/watch?v=${m.youtubeId}`,
            channel: { ...m.channel, avatar: avatar || m.channel.avatar, subscriberCount: subLabel },
            stats: m.stats,
            publishedAt: m.publishedAt,
            tags: [],
            isShort,
          };
        });
        videos = mapped;
        smallVideos = mapped.filter((m: any) => m.isShort);
      }
    }
    return { channel, videos, smallVideos, nextPageToken };
  },

  async resolveDeepLinkYouTube(rawId: string, preferredType?: 'video' | 'short' | 'post') {
    const vid = rawId.startsWith('yt_') ? rawId.slice(3) : rawId;
    if (!/^[a-zA-Z0-9_-]{11}$/.test(vid)) return null;
    try {
      const res = await this.getVideosByIds(vid);
      const item = res.items?.[0];
      if (!item) return null;
      if (preferredType === 'post') {
        return { found: true, kind: 'post' as const, post: mapItemToPost(item) };
      }
      if (preferredType === 'short' || (item.durationSeconds > 0 && item.durationSeconds <= 180)) {
        return { found: true, kind: 'short' as const, short: mapItemToShort(item) };
      }
      const video: LongVideo = {
        id: item.youtubeId,
        source: 'youtube',
        youtubeId: item.youtubeId,
        title: item.title,
        description: item.description,
        duration: item.duration,
        thumbnailUrl: item.thumbnailUrl,
        videoUrl: `https://www.youtube.com/watch?v=${item.youtubeId}`,
        channel: item.channel,
        stats: item.stats,
        publishedAt: item.publishedAt,
        tags: [item.categoryLabel],
      };
      return { found: true, kind: 'long' as const, video };
    } catch {
      return null;
    }
  },

  // Direct Client OAuth YouTube Write / Account APIs
  async getSubscriptionStatus(channelId: string) {
    const token = getClientGoogleOAuthToken();
    if (!token) return { connected: false, hasScope: false, subscribed: false, subscriptionId: null };
    try {
      const data = await callYouTubeDirectApi(
        'subscriptions',
        { part: 'id', mine: 'true', forChannelId: channelId },
        undefined,
        token
      );
      const subId = data?.items?.[0]?.id || null;
      return { connected: true, hasScope: true, subscribed: Boolean(subId), subscriptionId: subId };
    } catch {
      return { connected: true, hasScope: false, subscribed: false, subscriptionId: null };
    }
  },

  async subscribeChannel(channelId: string, action: 'subscribe' | 'unsubscribe' = 'subscribe') {
    const token = getClientGoogleOAuthToken();
    if (!token) {
      throw new Error('Sign in with your Google/YouTube account to subscribe.');
    }
    const existing = await this.getSubscriptionStatus(channelId);
    if (action === 'unsubscribe') {
      if (existing.subscriptionId) {
        const res = await fetch(`${YT_API_BASE}/subscriptions?id=${encodeURIComponent(existing.subscriptionId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to unsubscribe on YouTube');
      }
      return { success: true, subscribed: false, subscriptionId: null };
    }
    if (existing.subscribed) {
      return { success: true, subscribed: true, subscriptionId: existing.subscriptionId };
    }
    const res = await fetch(`${YT_API_BASE}/subscriptions?part=snippet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snippet: { resourceId: { kind: 'youtube#channel', channelId } } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Failed to subscribe on YouTube');
    return { success: true, subscribed: true, subscriptionId: data.id || null };
  },

  async rateVideo(videoId: string, rating: 'like' | 'dislike' | 'none' = 'like') {
    const token = getClientGoogleOAuthToken();
    if (!token) {
      throw new Error('Sign in with your Google/YouTube account to rate YouTube videos.');
    }
    const res = await fetch(
      `${YT_API_BASE}/videos/rate?id=${encodeURIComponent(videoId)}&rating=${encodeURIComponent(rating)}`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error?.message || 'Failed to rate YouTube video');
    }
    return { success: true, videoId, rating };
  },

  async postComment(videoId: string, text: string): Promise<{ success: boolean; comment: YouTubeCommentThread }> {
    const token = getClientGoogleOAuthToken();
    if (!token) {
      throw new Error('Sign in with your Google/YouTube account to post a YouTube comment.');
    }
    const res = await fetch(`${YT_API_BASE}/commentThreads?part=snippet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: text } },
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || 'Failed to post YouTube comment');
    }
    const top = data.snippet?.topLevelComment?.snippet;
    return {
      success: true,
      comment: {
        id: data.id || `ytc_${Date.now()}`,
        authorDisplayName: top?.authorDisplayName || 'You',
        authorProfileImageUrl: top?.authorProfileImageUrl || '',
        authorChannelUrl: top?.authorChannelUrl || '',
        textDisplay: top?.textDisplay || text,
        likeCount: 0,
        publishedAt: top?.publishedAt || new Date().toISOString(),
        totalReplyCount: 0,
        replies: [],
      },
    };
  },

  async getMyChannelVideos(tokenOverride?: string) {
    const token = tokenOverride || getClientGoogleOAuthToken();
    if (!token) {
      throw new Error('Please connect your Google/YouTube account first.');
    }
    const chData = await callYouTubeDirectApi(
      'channels',
      { part: 'snippet,statistics,contentDetails', mine: 'true' },
      undefined,
      token
    );
    const ch = chData?.items?.[0];
    if (!ch) {
      return { hasChannel: false, channel: null, videos: [] };
    }
    const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads;
    let videos: any[] = [];
    if (uploadsId) {
      const pl = await callYouTubeDirectApi(
        'playlistItems',
        { part: 'snippet,contentDetails', playlistId: uploadsId, maxResults: '25' },
        undefined,
        token
      );
      const ids = (pl.items || []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
      if (ids.length > 0) {
        const vd = await callYouTubeDirectApi(
          'videos',
          { part: 'snippet,contentDetails,statistics,status', id: ids.join(',') },
          undefined,
          token
        );
        videos = (vd.items || []).map((v: any) => ({
          id: v.id,
          youtubeId: v.id,
          title: v.snippet?.title || '',
          description: v.snippet?.description || '',
          thumbnailUrl: v.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
          publishedAt: v.snippet?.publishedAt || '',
          privacyStatus: v.status?.privacyStatus || 'public',
          madeForKids: v.status?.selfDeclaredMadeForKids,
          categoryId: v.snippet?.categoryId,
          tags: v.snippet?.tags || [],
          duration: formatIsoDuration(v.contentDetails?.duration),
          stats: {
            views: Number(v.statistics?.viewCount) || 0,
            likes: Number(v.statistics?.likeCount) || 0,
            comments: Number(v.statistics?.commentCount) || 0,
          },
        }));
      }
    }
    return {
      hasChannel: true,
      channel: {
        id: ch.id,
        title: ch.snippet?.title,
        avatar: ch.snippet?.thumbnails?.medium?.url || '',
        subscribers: ch.statistics?.subscriberCount || '0',
      },
      videos,
    };
  },

  async updateMyVideo(
    videoId: string,
    payload: { title?: string; description?: string; privacyStatus?: 'public' | 'unlisted' | 'private'; tags?: string[] },
    tokenOverride?: string
  ) {
    const token = tokenOverride || getClientGoogleOAuthToken();
    if (!token) throw new Error('Google OAuth token required');
    const current = await callYouTubeDirectApi('videos', { part: 'snippet,status', id: videoId }, undefined, token);
    const existing = current?.items?.[0];
    if (!existing) throw new Error('Video not found');
    const res = await fetch(`${YT_API_BASE}/videos?part=snippet,status`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: videoId,
        snippet: {
          ...existing.snippet,
          title: payload.title ?? existing.snippet?.title,
          description: payload.description ?? existing.snippet?.description,
          tags: payload.tags ?? existing.snippet?.tags,
          categoryId: existing.snippet?.categoryId || '22',
        },
        status: {
          ...existing.status,
          privacyStatus: payload.privacyStatus ?? existing.status?.privacyStatus ?? 'public',
        },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Failed to update video');
    return { success: true, video: data };
  },

  async deleteMyVideo(videoId: string, tokenOverride?: string) {
    const token = tokenOverride || getClientGoogleOAuthToken();
    if (!token) throw new Error('Google OAuth token required');
    const res = await fetch(`${YT_API_BASE}/videos?id=${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error?.message || 'Failed to delete YouTube video');
    }
    return { success: true, videoId };
  },
};
