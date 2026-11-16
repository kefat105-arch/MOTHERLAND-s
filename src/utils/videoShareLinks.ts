/**
 * MOTHERLAND-Native Video & Post Share URL Builder + Deep-Link Parser
 *
 * Ensures every Share / Copy Link / Boost action generates a MOTHERLAND domain link
 * (https://<motherland-host>/video/<id> or /shorts/<id>) that opens directly inside
 * the MOTHERLAND player, while preserving underlying external attribution separately.
 */

const warmedImages = new Set<string>();
const warmedMediaUrls = new Set<string>();

export function getMotherlandOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://motherland.app';
}

export function getCanonicalVideoId(opts: {
  id?: string;
  youtubeId?: string;
  source?: string;
}): string {
  const yt = (opts.youtubeId || '').trim();
  if (yt && (opts.source === 'youtube' || !opts.id || opts.id === yt || opts.id.startsWith('yt_'))) {
    return yt.startsWith('yt_') ? yt : `yt_${yt}`;
  }
  if (yt) {
    return yt.startsWith('yt_') ? yt : `yt_${yt}`;
  }
  return (opts.id || '').trim();
}

export function buildMotherlandVideoShareUrl(opts: {
  id?: string;
  youtubeId?: string;
  source?: string;
  isShort?: boolean;
}): string {
  const origin = getMotherlandOrigin();
  const canonicalId = getCanonicalVideoId(opts);
  if (!canonicalId) return origin;
  const route = opts.isShort ? 'shorts' : 'video';
  return `${origin}/${route}/${encodeURIComponent(canonicalId)}`;
}

export function buildMotherlandPostShareUrl(post: {
  id: string;
  source?: string;
  externalId?: string;
  mediaType?: string;
}): string {
  const origin = getMotherlandOrigin();
  if (post.source === 'youtube' && post.externalId) {
    return `${origin}/video/${encodeURIComponent(
      post.externalId.startsWith('yt_') ? post.externalId : `yt_${post.externalId}`
    )}`;
  }
  if (post.mediaType === 'video' && post.id) {
    return `${origin}/video/${encodeURIComponent(post.id)}`;
  }
  return `${origin}/post/${encodeURIComponent(post.id)}`;
}

export interface MotherlandDeepLink {
  kind: 'video' | 'short' | 'post';
  id: string;
}

export function parseMotherlandDeepLink(
  pathname: string,
  search = ''
): MotherlandDeepLink | null {
  const cleanPath = (pathname || '').replace(/\/+$/, '');
  const shortMatch = cleanPath.match(/^\/shorts\/([^/]+)$/);
  if (shortMatch?.[1]) {
    try {
      return { kind: 'short', id: decodeURIComponent(shortMatch[1]) };
    } catch {
      return { kind: 'short', id: shortMatch[1] };
    }
  }

  const videoMatch = cleanPath.match(/^\/video\/([^/]+)$/);
  if (videoMatch?.[1]) {
    try {
      return { kind: 'video', id: decodeURIComponent(videoMatch[1]) };
    } catch {
      return { kind: 'video', id: videoMatch[1] };
    }
  }

  const postMatch = cleanPath.match(/^\/post\/([^/]+)$/);
  if (postMatch?.[1]) {
    try {
      return { kind: 'post', id: decodeURIComponent(postMatch[1]) };
    } catch {
      return { kind: 'post', id: postMatch[1] };
    }
  }

  if (search) {
    const params = new URLSearchParams(search);
    const s = params.get('short');
    if (s) return { kind: 'short', id: s };
    const v = params.get('video') || params.get('v');
    if (v) return { kind: 'video', id: v };
    const p = params.get('post');
    if (p) return { kind: 'post', id: p };
  }

  return null;
}

export function warmVideoThumbnail(url?: string): void {
  if (!url || typeof Image === 'undefined' || warmedImages.has(url)) return;
  if (warmedImages.size > 160) {
    const first = warmedImages.values().next().value;
    if (first) warmedImages.delete(first);
  }
  warmedImages.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
}

export function warmNativeVideoStream(url?: string): void {
  if (!url || typeof document === 'undefined' || warmedMediaUrls.has(url)) return;
  if (url.startsWith('data:') || url.includes('youtube.com')) return;
  if (warmedMediaUrls.size > 30) {
    const first = warmedMediaUrls.values().next().value;
    if (first) warmedMediaUrls.delete(first);
  }
  warmedMediaUrls.add(url);
  try {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'video';
    link.href = url;
    document.head.appendChild(link);
  } catch {
    // ignore invalid URLs or unsupported prefetch
  }
}
