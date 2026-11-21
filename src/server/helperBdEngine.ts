import type { Request, Response } from 'express';
import type { LongVideo, Post, ShortVideo } from '../types';

export type SocialPlatform =
  | 'tiktok'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'x'
  | 'reddit'
  | 'archive'
  | 'motherland'
  | 'direct';

export interface HelperBdFormat {
  id: string;
  label: string;
  quality: string;
  ext: 'mp4' | 'mp3' | 'webm';
  mimeType: string;
  hasAudio: boolean;
  watermarkFree: boolean;
  directUrl: string;
  proxyStreamUrl: string;
  proxyDownloadUrl: string;
  proxyVerified?: boolean;
  sizeBytes?: number;
}

export interface HelperBdVideoItem {
  id: string;
  platform: SocialPlatform;
  platformLabel: string;
  sourceUrl: string;
  title: string;
  author: string;
  authorAvatar?: string;
  thumbnailUrl: string;
  duration?: string;
  durationSeconds?: number;
  kind: 'video' | 'short';
  playUrl?: string;
  downloadUrl?: string;
  watermarkFree: boolean;
  requiresResolve?: boolean;
  formats: HelperBdFormat[];
}

export interface OfflinePackCatalogEntry {
  id: string;
  kind: 'long' | 'short';
  title: string;
  author: string;
  authorAvatar?: string;
  thumbnailUrl: string;
  videoUrl: string;
  duration: string;
  durationSeconds: number;
  source: 'motherland' | 'tiktok' | 'archive';
  payload: LongVideo | ShortVideo;
}

const REQUEST_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

export function isSafeExternalMediaUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (!host) return false;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function looksLikeUrl(input: string): boolean {
  const s = input.trim();
  if (!s || /\s/.test(s)) return false;
  if (/^https?:\/\//i.test(s)) return true;
  return /^(www\.)?(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com|instagram\.com|facebook\.com|fb\.watch|fb\.com|youtube\.com|youtu\.be|m\.youtube\.com|x\.com|twitter\.com|reddit\.com|v\.redd\.it)\//i.test(
    s
  );
}

export function normalizeInputUrl(input: string): string {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

export function detectSocialPlatform(rawUrl: string): SocialPlatform {
  const lower = rawUrl.toLowerCase();
  if (lower.includes('tiktok.com')) return 'tiktok';
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.com')) {
    return 'facebook';
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('x.com/') || lower.includes('twitter.com/')) return 'x';
  if (lower.includes('reddit.com') || lower.includes('v.redd.it')) return 'reddit';
  if (lower.includes('archive.org')) return 'archive';
  return 'direct';
}

export function getPlatformLabel(platform: SocialPlatform): string {
  switch (platform) {
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    case 'facebook':
      return 'Facebook';
    case 'youtube':
      return 'YouTube';
    case 'x':
      return 'X / Twitter';
    case 'reddit':
      return 'Reddit';
    case 'archive':
      return 'Archive HD';
    case 'motherland':
      return 'MOTHERLAND';
    default:
      return 'Social Video';
  }
}

function buildSafeFilename(title: string, ext: string): string {
  const base = (title || 'helper-bd-video')
    .replace(/[^\w\u0980-\u09FF\s-]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 48);
  return `${base || 'helper_bd_video'}.${ext}`;
}

export function buildStreamProxyUrl(targetUrl: string, title = 'helper_bd_video', download = false): string {
  if (!targetUrl) return '';
  if (targetUrl.startsWith('/uploads/') || targetUrl.startsWith('/api/media/')) {
    return targetUrl;
  }
  const params = new URLSearchParams({ url: targetUrl });
  if (download) {
    params.set('download', '1');
    params.set('filename', buildSafeFilename(title, 'mp4'));
  }
  return `/api/helper-bd/stream?${params.toString()}`;
}

function buildFormatObject(
  opts: {
    id: string;
    label: string;
    quality: string;
    ext?: 'mp4' | 'mp3' | 'webm';
    mimeType?: string;
    hasAudio?: boolean;
    watermarkFree?: boolean;
    directUrl: string;
    title: string;
    proxyVerified?: boolean;
    sizeBytes?: number;
  }
): HelperBdFormat {
  const ext = opts.ext || 'mp4';
  const proxyBase =
    opts.directUrl.startsWith('/uploads/') || opts.directUrl.startsWith('/api/media/')
      ? opts.directUrl
      : `/api/helper-bd/stream?${new URLSearchParams({ url: opts.directUrl }).toString()}`;
  const proxyDownload =
    opts.directUrl.startsWith('/uploads/') || opts.directUrl.startsWith('/api/media/')
      ? opts.directUrl
      : `/api/helper-bd/stream?${new URLSearchParams({
          url: opts.directUrl,
          download: '1',
          filename: buildSafeFilename(opts.title, ext),
        }).toString()}`;

  return {
    id: opts.id,
    label: opts.label,
    quality: opts.quality,
    ext,
    mimeType: opts.mimeType || (ext === 'mp3' ? 'audio/mpeg' : 'video/mp4'),
    hasAudio: opts.hasAudio !== false,
    watermarkFree: opts.watermarkFree !== false,
    directUrl: opts.directUrl,
    proxyStreamUrl: proxyBase,
    proxyDownloadUrl: proxyDownload,
    proxyVerified: opts.proxyVerified,
    sizeBytes: opts.sizeBytes,
  };
}

async function probeStreamableFromServer(url: string): Promise<boolean> {
  if (!isSafeExternalMediaUrl(url)) return false;
  try {
    const referer = url.includes('tiktok') ? 'https://www.tiktok.com/' : undefined;
    const headers: Record<string, string> = {
      'User-Agent': REQUEST_UA,
      Range: 'bytes=0-511',
    };
    if (referer) headers.Referer = referer;
    const res = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return false;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    return (
      ct.includes('video') ||
      ct.includes('audio') ||
      ct.includes('octet-stream') ||
      res.status === 206
    );
  } catch {
    return false;
  }
}

export async function resolveSocialMediaVideo(rawInputUrl: string): Promise<HelperBdVideoItem | null> {
  const normalizedUrl = normalizeInputUrl(rawInputUrl);
  if (!isSafeExternalMediaUrl(normalizedUrl)) return null;

  const platform = detectSocialPlatform(normalizedUrl);

  // Direct MP4/WebM link
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(normalizedUrl)) {
    const title = decodeURIComponent(normalizedUrl.split('/').pop()?.split('?')[0] || 'Direct Video');
    const fmt = buildFormatObject({
      id: 'direct_mp4',
      label: 'MP4 Original (No Watermark)',
      quality: 'HD',
      directUrl: normalizedUrl,
      title,
      proxyVerified: true,
    });
    return {
      id: `hbd_${Buffer.from(normalizedUrl).toString('base64url').slice(0, 18)}`,
      platform,
      platformLabel: getPlatformLabel(platform),
      sourceUrl: normalizedUrl,
      title,
      author: getPlatformLabel(platform),
      thumbnailUrl: '',
      kind: 'video',
      playUrl: fmt.proxyStreamUrl,
      downloadUrl: fmt.proxyDownloadUrl,
      watermarkFree: true,
      formats: [fmt],
    };
  }

  // 1. TikTok via TikWM (fastest & cleanest watermark-free MP4 API)
  if (platform === 'tiktok') {
    try {
      const form = new URLSearchParams({ url: normalizedUrl, hd: '1' });
      const r = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': REQUEST_UA,
        },
        body: form.toString(),
        signal: AbortSignal.timeout(9000),
      });
      if (r.ok) {
        const j: any = await r.json();
        const d = j?.data;
        if (j?.code === 0 && d && (d.hdplay || d.play)) {
          const title = String(d.title || 'TikTok Video').trim() || 'TikTok Video';
          const formats: HelperBdFormat[] = [];
          if (d.hdplay) {
            formats.push(
              buildFormatObject({
                id: 'tk_hd',
                label: 'HD MP4 (Without Watermark)',
                quality: 'HD 1080p',
                directUrl: d.hdplay,
                title,
                watermarkFree: true,
                proxyVerified: true,
                sizeBytes: Number(d.hd_size || 0) || undefined,
              })
            );
          }
          if (d.play) {
            formats.push(
              buildFormatObject({
                id: 'tk_sd',
                label: 'MP4 (Without Watermark)',
                quality: 'Standard',
                directUrl: d.play,
                title,
                watermarkFree: true,
                proxyVerified: true,
                sizeBytes: Number(d.size || 0) || undefined,
              })
            );
          }
          if (d.music) {
            formats.push(
              buildFormatObject({
                id: 'tk_mp3',
                label: 'Original Sound (MP3 Audio)',
                quality: 'Audio',
                ext: 'mp3',
                mimeType: 'audio/mpeg',
                directUrl: d.music,
                title,
                watermarkFree: true,
                proxyVerified: true,
              })
            );
          }
          return {
            id: `hbd_tk_${d.id || Date.now()}`,
            platform: 'tiktok',
            platformLabel: 'TikTok',
            sourceUrl: normalizedUrl,
            title,
            author: d.author?.nickname || d.author?.unique_id || 'TikTok Creator',
            authorAvatar: d.author?.avatar,
            thumbnailUrl: d.cover || d.origin_cover || '',
            durationSeconds: Number(d.duration || 0) || undefined,
            kind: 'short',
            playUrl: formats[0]?.proxyStreamUrl,
            downloadUrl: formats[0]?.proxyDownloadUrl,
            watermarkFree: true,
            formats,
          };
        }
      }
    } catch {
      // fall through to Clipto
    }
  }

  // 2. Clipto Multi-Platform Extractor (supports TikTok, Facebook, YouTube, Instagram, etc.)
  try {
    const r = await fetch('https://www.clipto.com/api/youtube', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://www.clipto.com',
        Referer: 'https://www.clipto.com/',
        'User-Agent': REQUEST_UA,
      },
      body: JSON.stringify({ url: normalizedUrl }),
      signal: AbortSignal.timeout(10000),
    });

    if (r.ok) {
      const j: any = await r.json();
      if (j?.success && Array.isArray(j?.medias) && j.medias.length > 0) {
        const title = String(j.title || `${getPlatformLabel(platform)} Video`).trim();
        const rawMedias = j.medias as any[];
        const candidates = rawMedias
          .filter((m) => m && m.url && isSafeExternalMediaUrl(m.url))
          .sort((a, b) => {
            const qa = String(a.quality || '').toLowerCase();
            const qb = String(b.quality || '').toLowerCase();
            const score = (m: any, q: string) =>
              (q.includes('hd_no_watermark') ? 100 : 0) +
              (q.includes('no_watermark') ? 80 : 0) +
              (q.includes('hd') ? 50 : 0) +
              (m.type === 'video' ? 30 : 0) +
              (m.audioAvailable !== false && !m.is_audio ? 20 : 0);
            return score(b, qb) - score(a, qa);
          });

        const topCheck = candidates.slice(0, 3);
        const verifyResults = await Promise.all(
          topCheck.map(async (m) => probeStreamableFromServer(m.url))
        );

        const formats: HelperBdFormat[] = candidates.slice(0, 6).map((m, idx) => {
          const extRaw = String(m.extension || '').toLowerCase();
          const ext: 'mp4' | 'mp3' | 'webm' =
            extRaw === 'mp3' || extRaw === 'm4a' || m.type === 'audio'
              ? 'mp3'
              : extRaw === 'webm'
              ? 'webm'
              : 'mp4';
          const q = String(m.quality || (ext === 'mp3' ? 'Audio' : 'MP4')).trim();
          const isNoWm = !q.includes('watermark') || q.includes('no_watermark') || platform !== 'tiktok';
          const verified = idx < topCheck.length ? verifyResults[idx] : false;
          return buildFormatObject({
            id: `cl_${idx}_${m.itag || q}`,
            label:
              ext === 'mp3'
                ? 'Audio (MP3)'
                : isNoWm
                ? `${q.replace(/_/g, ' ').toUpperCase()} (Without Watermark)`
                : `${q.replace(/_/g, ' ').toUpperCase()}`,
            quality: q.replace(/_/g, ' '),
            ext,
            hasAudio: m.type !== 'video' || m.audioAvailable !== false,
            watermarkFree: isNoWm,
            directUrl: m.url,
            title,
            proxyVerified: verified,
          });
        });

        const preferred =
          formats.find((f) => f.ext === 'mp4' && f.hasAudio && f.proxyVerified) ||
          formats.find((f) => f.ext === 'mp4' && f.proxyVerified) ||
          formats.find((f) => f.ext === 'mp4' && f.hasAudio) ||
          formats[0];

        if (preferred) {
          return {
            id: `hbd_cl_${Buffer.from(normalizedUrl).toString('base64url').slice(0, 14)}`,
            platform,
            platformLabel: getPlatformLabel(platform),
            sourceUrl: normalizedUrl,
            title,
            author: String(j.author || getPlatformLabel(platform)),
            thumbnailUrl: String(j.thumbnail || ''),
            durationSeconds: Number(j.duration || 0) || undefined,
            kind: platform === 'tiktok' ? 'short' : 'video',
            playUrl: preferred.proxyVerified ? preferred.proxyStreamUrl : preferred.directUrl,
            downloadUrl: preferred.proxyVerified ? preferred.proxyDownloadUrl : preferred.directUrl,
            watermarkFree: true,
            formats,
          };
        }
      }
    }
  } catch {
    // fall through
  }

  // 3. Secondary YouTube / TikTok extractor fallback
  if (platform === 'youtube') {
    try {
      const r = await fetch(
        `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(normalizedUrl)}`,
        { signal: AbortSignal.timeout(9000) }
      );
      if (r.ok) {
        const j: any = await r.json();
        const resObj = j?.result;
        if (j?.success && resObj?.download_url && isSafeExternalMediaUrl(resObj.download_url)) {
          const title = String(resObj.title || 'YouTube Video').trim();
          const verified = await probeStreamableFromServer(resObj.download_url);
          const fmt = buildFormatObject({
            id: 'dc_ytmp4',
            label: `${resObj.quality || '360p'} MP4`,
            quality: resObj.quality || '360p',
            directUrl: resObj.download_url,
            title,
            proxyVerified: verified,
          });
          return {
            id: `hbd_yt_${Date.now()}`,
            platform: 'youtube',
            platformLabel: 'YouTube',
            sourceUrl: normalizedUrl,
            title,
            author: 'YouTube',
            thumbnailUrl: resObj.thumbnail || '',
            kind: 'video',
            playUrl: verified ? fmt.proxyStreamUrl : fmt.directUrl,
            downloadUrl: verified ? fmt.proxyDownloadUrl : fmt.directUrl,
            watermarkFree: true,
            formats: [fmt],
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

// =========================================================================
// OFFLINE PACK MP4 CATALOG CACHE (Real Playable MP4s up to 480 Items)
// =========================================================================
interface CatalogCache {
  fetchedAt: number;
  items: OfflinePackCatalogEntry[];
}

let catalogCache: CatalogCache = { fetchedAt: 0, items: [] };
let inFlightCatalogPromise: Promise<OfflinePackCatalogEntry[]> | null = null;

function formatSec(sec: number): string {
  const s = Math.max(1, Math.round(sec || 30));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

async function fetchTikWmFeedBatch(): Promise<OfflinePackCatalogEntry[]> {
  const out: OfflinePackCatalogEntry[] = [];
  const seen = new Set<string>();
  const regions = ['BD', 'PK', 'IN'];

  for (const region of regions) {
    try {
      const r = await fetch(`https://www.tikwm.com/api/feed/list?region=${region}&count=30`, {
        headers: { 'User-Agent': REQUEST_UA },
        signal: AbortSignal.timeout(4500),
      });
      if (r.ok) {
        const j: any = await r.json();
        const rows: any[] = Array.isArray(j?.data) ? j.data : [];
        for (const item of rows) {
          const vid = String(item?.video_id || item?.id || '');
          const play = item?.play || item?.hdplay;
          if (!vid || !play || !isSafeExternalMediaUrl(play) || seen.has(vid)) continue;
          seen.add(vid);
          const title = String(item?.title || `Trending Clip #${vid.slice(-4)}`).trim();
          const authorName = item?.author?.nickname || item?.author?.unique_id || 'Creator';
          const authorAvatar = item?.author?.avatar || '';
          const thumb = item?.cover || item?.origin_cover || '';
          const durSec = Math.max(8, Math.min(180, Number(item?.duration || 22)));
          const proxyPlayUrl = buildStreamProxyUrl(play, title, false);

          const shortPayload: ShortVideo = {
            id: `ml_tk_${vid}`,
            source: 'motherland',
            videoUrl: proxyPlayUrl,
            thumbnailUrl: thumb,
            title,
            caption: title,
            durationSeconds: durSec,
            aspectRatio: '9:16',
            hashtags: ['Offline', 'Trending'],
            creator: {
              id: `tk_creator_${item?.author?.id || vid}`,
              name: authorName,
              username: String(item?.author?.unique_id || 'creator'),
              avatar: authorAvatar,
              isVerified: true,
            },
            stats: {
              likes: Number(item?.digg_count || 0),
              comments: Number(item?.comment_count || 0),
              shares: Number(item?.share_count || 0),
              views: Number(item?.play_count || 0),
            },
            createdAt: 'অফলাইন রেডি',
          };

          out.push({
            id: shortPayload.id,
            kind: 'short',
            title,
            author: authorName,
            authorAvatar,
            thumbnailUrl: thumb,
            videoUrl: proxyPlayUrl,
            duration: formatSec(durSec),
            durationSeconds: durSec,
            source: 'tiktok',
            payload: shortPayload,
          });
        }
      }
    } catch {
      // skip region failure
    }
    if (out.length >= 60) break;
    await new Promise((resolve) => setTimeout(resolve, 650));
  }
  return out;
}

async function fetchArchiveMp4Batch(neededCount: number, queryFilter?: string): Promise<OfflinePackCatalogEntry[]> {
  const results: OfflinePackCatalogEntry[] = [];
  const seen = new Set<string>();
  const pages = Math.min(8, Math.max(1, Math.ceil((neededCount + 20) / 40)));

  const baseQ = queryFilter
    ? `(${queryFilter}) AND mediatype:movies AND format:"MPEG4" AND item_size:[400000 TO 22000000]`
    : `mediatype:movies AND format:"MPEG4" AND item_size:[600000 TO 18000000] AND NOT subject:"test"`;

  for (let page = 1; page <= pages && results.length < neededCount; page++) {
    try {
      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
        baseQ
      )}&fl[]=identifier,title,creator,downloads,item_size&sort[]=downloads+desc&rows=50&page=${page}&output=json`;

      const sr = await fetch(searchUrl, { signal: AbortSignal.timeout(8000) });
      if (!sr.ok) break;
      const sj: any = await sr.json();
      const docs: any[] = sj?.response?.docs || [];
      if (docs.length === 0) break;

      // Resolve actual .mp4 file path cleanly in chunks of 20
      for (let i = 0; i < docs.length && results.length < neededCount; i += 20) {
        const chunk = docs.slice(i, i + 20);
        const resolvedChunk = await Promise.all(
          chunk.map(async (doc): Promise<OfflinePackCatalogEntry | null> => {
            const identifier = String(doc?.identifier || '').trim();
            if (!identifier || seen.has(identifier)) return null;
            seen.add(identifier);
            try {
              const mr = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`, {
                signal: AbortSignal.timeout(4000),
              });
              if (!mr.ok) return null;
              const mj: any = await mr.json();
              const files: any[] = Array.isArray(mj?.files) ? mj.files : [];
              const mp4File =
                files.find(
                  (f) =>
                    typeof f?.name === 'string' &&
                    f.name.toLowerCase().endsWith('.mp4') &&
                    Number(f.size || 0) >= 200_000 &&
                    Number(f.size || 0) <= 22_000_000
                ) ||
                files.find(
                  (f) => typeof f?.name === 'string' && f.name.toLowerCase().endsWith('.mp4')
                );
              if (!mp4File?.name) return null;

              const rawMp4Url = `https://archive.org/download/${encodeURIComponent(
                identifier
              )}/${mp4File.name
                .split('/')
                .map((seg: string) => encodeURIComponent(seg))
                .join('/')}`;
              const thumbUrl = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;
              const title = String(doc?.title || mj?.metadata?.title || identifier).trim();
              const creator = String(
                Array.isArray(doc?.creator) ? doc.creator[0] : doc?.creator || mj?.metadata?.creator || 'Archive Creator'
              ).trim();
              const durSec = Math.max(15, Math.min(900, Number(mp4File.length || 95)));
              const proxyVideoUrl = buildStreamProxyUrl(rawMp4Url, title, false);

              const longPayload: LongVideo = {
                id: `ml_ar_${identifier}`,
                source: 'motherland',
                videoUrl: proxyVideoUrl,
                thumbnailUrl: thumbUrl,
                title,
                description: typeof mj?.metadata?.description === 'string' ? mj.metadata.description.slice(0, 260) : title,
                duration: formatSec(durSec),
                channel: {
                  id: `ar_ch_${creator.toLowerCase().replace(/\W+/g, '_').slice(0, 18) || 'archive'}`,
                  title: creator || 'Archive Video',
                  avatar: '',
                  isVerified: true,
                },
                stats: {
                  views: Number(doc?.downloads || 1200),
                  likes: Math.round(Number(doc?.downloads || 500) / 45),
                  comments: 0,
                },
                publishedAt: 'অফলাইন HD ✓',
              };

              return {
                id: longPayload.id,
                kind: 'long',
                title,
                author: creator || 'Archive Video',
                thumbnailUrl: thumbUrl,
                videoUrl: proxyVideoUrl,
                duration: longPayload.duration,
                durationSeconds: durSec,
                source: 'archive',
                payload: longPayload,
              };
            } catch {
              return null;
            }
          })
        );
        for (const item of resolvedChunk) {
          if (item && results.length < neededCount) results.push(item);
        }
      }
    } catch {
      break;
    }
  }

  return results;
}

export async function getOfflinePlayablePackCatalog(
  targetCount: number,
  nativeVideos: LongVideo[],
  nativeShorts: ShortVideo[],
  nativePosts: Post[]
): Promise<OfflinePackCatalogEntry[]> {
  const safeTarget = Math.min(480, Math.max(1, targetCount));
  const combined: OfflinePackCatalogEntry[] = [];
  const seenIds = new Set<string>();

  const pushUnique = (entry: OfflinePackCatalogEntry) => {
    if (seenIds.has(entry.id)) return;
    seenIds.add(entry.id);
    combined.push(entry);
  };

  // 1. Native MOTHERLAND Long Videos FIRST
  for (const v of nativeVideos) {
    if (v.videoUrl) {
      pushUnique({
        id: v.id,
        kind: 'long',
        title: v.title,
        author: v.channel?.title || 'MOTHERLAND',
        authorAvatar: v.channel?.avatar,
        thumbnailUrl: v.thumbnailUrl || '',
        videoUrl: v.videoUrl,
        duration: v.duration || '1:00',
        durationSeconds: 60,
        source: 'motherland',
        payload: { ...v, source: 'motherland' },
      });
    }
  }

  // 2. Native MOTHERLAND Video Posts
  for (const p of nativePosts) {
    if (p.source === 'motherland' && p.mediaType === 'video' && p.mediaUrl) {
      const vid: LongVideo = {
        id: p.id,
        source: 'motherland',
        videoUrl: p.mediaUrl,
        thumbnailUrl: p.thumbnailUrl || '',
        title: p.content || `${p.author?.displayName || 'Creator'} Video`,
        description: p.content || '',
        duration: 'Video',
        channel: {
          id: p.author?.id || 'motherland',
          title: p.author?.displayName || 'MOTHERLAND',
          avatar: p.author?.avatar || '',
          isVerified: p.author?.isVerified,
        },
        stats: { views: 0, likes: p.stats?.likes || 0, comments: p.stats?.comments || 0 },
        publishedAt: 'MOTHERLAND',
      };
      pushUnique({
        id: vid.id,
        kind: 'long',
        title: vid.title,
        author: vid.channel.title,
        authorAvatar: vid.channel.avatar,
        thumbnailUrl: vid.thumbnailUrl,
        videoUrl: p.mediaUrl,
        duration: 'Video',
        durationSeconds: 45,
        source: 'motherland',
        payload: vid,
      });
    }
  }

  // 3. Native MOTHERLAND Shorts
  for (const s of nativeShorts) {
    if (s.videoUrl) {
      pushUnique({
        id: s.id,
        kind: 'short',
        title: s.title,
        author: s.creator?.name || 'Creator',
        authorAvatar: s.creator?.avatar,
        thumbnailUrl: s.thumbnailUrl || '',
        videoUrl: s.videoUrl,
        duration: formatSec(s.durationSeconds || 25),
        durationSeconds: s.durationSeconds || 25,
        source: 'motherland',
        payload: { ...s, source: 'motherland' },
      });
    }
  }

  if (combined.length >= safeTarget) {
    return combined.slice(0, safeTarget);
  }

  // 4. Cached / freshly fetched real TikTok + Archive MP4 catalog
  const isCacheFresh =
    Date.now() - catalogCache.fetchedAt < 25 * 60 * 1000 &&
    catalogCache.items.length >= Math.min(safeTarget - combined.length, 480);

  let externalItems: OfflinePackCatalogEntry[] = [];
  if (isCacheFresh) {
    externalItems = catalogCache.items;
  } else {
    if (!inFlightCatalogPromise) {
      inFlightCatalogPromise = (async () => {
        const neededExternal = Math.max(45, Math.min(500, safeTarget + 10));
        const [tikItems, archItems] = await Promise.all([
          fetchTikWmFeedBatch(),
          fetchArchiveMp4Batch(neededExternal),
        ]);
        const merged = [...tikItems, ...archItems];
        if (merged.length > 0) {
          catalogCache = { fetchedAt: Date.now(), items: merged };
        }
        return merged;
      })().finally(() => {
        inFlightCatalogPromise = null;
      });
    }
    externalItems = await inFlightCatalogPromise;
    if (externalItems.length < safeTarget - combined.length && safeTarget > 80) {
      // Top up archive cache when requesting larger tiers like 240 / 480
      const extra = await fetchArchiveMp4Batch(safeTarget + 30);
      if (extra.length > externalItems.length) {
        const uniq = new Map<string, OfflinePackCatalogEntry>();
        for (const e of [...externalItems, ...extra]) uniq.set(e.id, e);
        externalItems = Array.from(uniq.values());
        catalogCache = { fetchedAt: Date.now(), items: externalItems };
      }
    }
  }

  for (const item of externalItems) {
    pushUnique(item);
    if (combined.length >= safeTarget) break;
  }

  return combined.slice(0, safeTarget);
}

export async function searchHelperBdCatalog(params: {
  query: string;
  nativeVideos: LongVideo[];
  nativeShorts: ShortVideo[];
  youtubeItems?: any[];
}): Promise<{ mode: 'url' | 'search'; items: HelperBdVideoItem[] }> {
  const q = params.query.trim();
  if (!q) return { mode: 'search', items: [] };

  // 1. Direct URL Mode -> resolve watermark-free download formats immediately
  if (looksLikeUrl(q)) {
    const resolved = await resolveSocialMediaVideo(q);
    return {
      mode: 'url',
      items: resolved ? [resolved] : [],
    };
  }

  // 2. Keyword / Voice Search Mode -> MOTHERLAND matches + Archive direct MP4s + YouTube search matches
  const lower = q.toLowerCase();
  const out: HelperBdVideoItem[] = [];
  const seen = new Set<string>();

  for (const v of params.nativeVideos) {
    if (v.videoUrl && `${v.title} ${v.description} ${v.channel?.title}`.toLowerCase().includes(lower)) {
      const fmt = buildFormatObject({
        id: `ml_fmt_${v.id}`,
        label: 'HD MP4 (Without Watermark)',
        quality: 'HD',
        directUrl: v.videoUrl,
        title: v.title,
        proxyVerified: true,
      });
      seen.add(v.id);
      out.push({
        id: v.id,
        platform: 'motherland',
        platformLabel: 'MOTHERLAND',
        sourceUrl: v.videoUrl,
        title: v.title,
        author: v.channel?.title || 'MOTHERLAND',
        authorAvatar: v.channel?.avatar,
        thumbnailUrl: v.thumbnailUrl || '',
        duration: v.duration,
        kind: 'video',
        playUrl: fmt.proxyStreamUrl,
        downloadUrl: fmt.proxyDownloadUrl,
        watermarkFree: true,
        formats: [fmt],
      });
    }
  }

  for (const s of params.nativeShorts) {
    if (s.videoUrl && `${s.title} ${s.caption} ${s.creator?.name}`.toLowerCase().includes(lower)) {
      const fmt = buildFormatObject({
        id: `ml_sfmt_${s.id}`,
        label: 'HD MP4 (Without Watermark)',
        quality: 'HD',
        directUrl: s.videoUrl,
        title: s.title,
        proxyVerified: true,
      });
      seen.add(s.id);
      out.push({
        id: s.id,
        platform: 'motherland',
        platformLabel: 'MOTHERLAND',
        sourceUrl: s.videoUrl,
        title: s.title,
        author: s.creator?.name || 'Creator',
        authorAvatar: s.creator?.avatar,
        thumbnailUrl: s.thumbnailUrl || '',
        duration: formatSec(s.durationSeconds || 25),
        durationSeconds: s.durationSeconds,
        kind: 'short',
        playUrl: fmt.proxyStreamUrl,
        downloadUrl: fmt.proxyDownloadUrl,
        watermarkFree: true,
        formats: [fmt],
      });
    }
  }

  // Real Archive.org keyword MP4 search (instant watermark-free MP4 downloads!)
  const archPromise = fetchArchiveMp4Batch(8, q).catch(() => []);
  const archHits = await archPromise;
  for (const a of archHits) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const rawUrl = new URLSearchParams(a.videoUrl.split('?')[1] || '').get('url') || a.videoUrl;
    const fmt = buildFormatObject({
      id: `ar_fmt_${a.id}`,
      label: 'MP4 Direct (Without Watermark)',
      quality: 'HD MP4',
      directUrl: rawUrl,
      title: a.title,
      proxyVerified: true,
    });
    out.push({
      id: a.id,
      platform: 'archive',
      platformLabel: 'Direct MP4',
      sourceUrl: rawUrl,
      title: a.title,
      author: a.author,
      thumbnailUrl: a.thumbnailUrl,
      duration: a.duration,
      durationSeconds: a.durationSeconds,
      kind: 'video',
      playUrl: fmt.proxyStreamUrl,
      downloadUrl: fmt.proxyDownloadUrl,
      watermarkFree: true,
      formats: [fmt],
    });
  }

  // Append YouTube search hits with on-demand link resolution support
  for (const yt of params.youtubeItems || []) {
    const ytId = String(yt?.youtubeId || yt?.id || '').replace(/^yt_/, '');
    if (!ytId || seen.has(ytId)) continue;
    seen.add(ytId);
    const ytUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(ytId)}`;
    out.push({
      id: `yt_${ytId}`,
      platform: 'youtube',
      platformLabel: 'YouTube',
      sourceUrl: ytUrl,
      title: String(yt?.title || 'YouTube Video'),
      author: String(yt?.channel?.title || 'YouTube'),
      authorAvatar: yt?.channel?.avatar,
      thumbnailUrl: String(yt?.thumbnailUrl || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`),
      duration: yt?.duration,
      durationSeconds: yt?.durationSeconds,
      kind: 'video',
      watermarkFree: true,
      requiresResolve: true,
      formats: [],
    });
  }

  return { mode: 'search', items: out };
}

export async function proxyHelperBdStream(req: Request, res: Response): Promise<void> {
  const rawUrl = String(req.query.url || '').trim();
  const isDownload = req.query.download === '1' || req.query.download === 'true';
  const requestedName = String(req.query.filename || 'helper_bd_video.mp4').trim();

  if (!isSafeExternalMediaUrl(rawUrl)) {
    res.status(400).json({ error: 'INVALID_URL', message: 'A valid public http/https video URL is required.' });
    return;
  }

  const upstreamHeaders: Record<string, string> = {
    'User-Agent': REQUEST_UA,
    Accept: '*/*',
  };
  if (req.headers.range) {
    upstreamHeaders.Range = String(req.headers.range);
  }
  if (rawUrl.includes('tiktok')) {
    upstreamHeaders.Referer = 'https://www.tiktok.com/';
  } else if (rawUrl.includes('fbcdn') || rawUrl.includes('facebook')) {
    upstreamHeaders.Referer = 'https://www.facebook.com/';
  } else if (rawUrl.includes('instagram') || rawUrl.includes('cdninstagram')) {
    upstreamHeaders.Referer = 'https://www.instagram.com/';
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
      signal: AbortSignal.timeout(45000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status === 403 ? 502 : upstream.status).json({
        error: 'UPSTREAM_BLOCKED',
        status: upstream.status,
        message: 'This video host rejected direct server streaming. Use direct link instead.',
      });
      return;
    }

    const ct = upstream.headers.get('content-type') || 'video/mp4';
    const cl = upstream.headers.get('content-length');
    const cr = upstream.headers.get('content-range');

    res.status(upstream.status);
    res.setHeader('Content-Type', ct);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (cl) res.setHeader('Content-Length', cl);
    if (cr) res.setHeader('Content-Range', cr);

    if (isDownload) {
      const safeName = requestedName.replace(/["\\\r\n;]/g, '_');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    let clientClosed = false;
    req.on('close', () => {
      clientClosed = true;
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done || clientClosed) break;
      if (value) {
        const canContinue = res.write(Buffer.from(value));
        if (!canContinue) {
          await new Promise<void>((resolve) => res.once('drain', resolve));
        }
      }
    }
    res.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(502).json({
        error: 'STREAM_PROXY_FAILED',
        message: err?.message || 'Failed to stream media file',
      });
    } else {
      res.end();
    }
  }
}
