// Lightweight YouTube IFrame Player API bridge using native postMessage.
// Enables player reuse (`loadVideoById`, `cueVideoById`), accurate target-video
// frame-ready detection, and multi-slot iframe isolation without full player tear-down.

export interface YTPlayerStateMessage {
  currentTime?: number;
  duration?: number;
  playerState?: number; // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  muted?: boolean;
  videoId?: string;
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoplay?: boolean;
    controls?: boolean;
    loop?: boolean;
    mute?: boolean;
    nocookie?: boolean;
  } = {}
): string {
  const { autoplay = true, controls = true, loop = false, mute = false, nocookie = false } = options;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    controls: controls ? '1' : '0',
    mute: mute ? '1' : '0',
    enablejsapi: '1',
    modestbranding: '1',
    playsinline: '1',
    rel: '0',
    iv_load_policy: '3',
  });
  if (origin) {
    params.set('origin', origin);
  }
  if (loop && videoId) {
    params.set('loop', '1');
    params.set('playlist', videoId);
  }
  const host = nocookie ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com';
  return `${host}/embed/${videoId}?${params.toString()}`;
}

export type YTCommandName =
  | 'playVideo'
  | 'pauseVideo'
  | 'mute'
  | 'unMute'
  | 'seekTo'
  | 'loadVideoById'
  | 'cueVideoById'
  | 'setPlaybackRate'
  | 'setVolume'
  | 'setLoop';

export function sendYTCommand(
  iframe: HTMLIFrameElement | null,
  func: YTCommandName,
  args: any[] = []
) {
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: 'command',
        func,
        args,
      }),
      '*'
    );
  } catch {
    // Ignore cross-window errors if iframe is unmounting
  }
}

export function registerYTListeningHandshake(iframe: HTMLIFrameElement | null, id = 1) {
  if (!iframe?.contentWindow) return;
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({
        event: 'listening',
        id,
        channel: 'widget',
      }),
      '*'
    );
  } catch {
    // Ignore if frame not ready
  }
}

export function parseYTInfoMessage(
  event: MessageEvent,
  expectedIframe?: HTMLIFrameElement | null
): YTPlayerStateMessage | null {
  if (
    !event.origin.includes('youtube.com') &&
    !event.origin.includes('youtube-nocookie.com')
  ) {
    return null;
  }

  // When checking a specific pooled iframe slot, ensure the message originated from that slot
  if (expectedIframe) {
    if (!expectedIframe.contentWindow || event.source !== expectedIframe.contentWindow) {
      return null;
    }
  }

  let data = event.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (!data || typeof data !== 'object') return null;

  if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
    const out: YTPlayerStateMessage = {};
    if (typeof data.info.currentTime === 'number') out.currentTime = data.info.currentTime;
    if (typeof data.info.duration === 'number') out.duration = data.info.duration;
    if (typeof data.info.playerState === 'number') out.playerState = data.info.playerState;
    if (typeof data.info.muted === 'boolean') out.muted = data.info.muted;
    const vidId = data.info.videoData?.video_id;
    if (typeof vidId === 'string' && vidId) out.videoId = vidId;
    return out;
  }

  if (data.event === 'onStateChange' && typeof data.info === 'number') {
    return { playerState: data.info };
  }

  return null;
}

export function recordVideoSwitchMetric(entry: {
  player: 'watch' | 'shorts' | 'yt_shorts' | 'yt_watch';
  videoId: string;
  reusedPlayer: boolean;
  startupMs: number;
}) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    __MOTHERLAND_VIDEO_METRICS__?: Array<typeof entry & { recordedAt: number }>;
  };
  if (!w.__MOTHERLAND_VIDEO_METRICS__) {
    w.__MOTHERLAND_VIDEO_METRICS__ = [];
  }
  w.__MOTHERLAND_VIDEO_METRICS__.push({ ...entry, recordedAt: Date.now() });
  if (w.__MOTHERLAND_VIDEO_METRICS__.length > 50) {
    w.__MOTHERLAND_VIDEO_METRICS__.shift();
  }
}

// Registry of inline feed videos currently playing/active so background or manual
// feed refreshes and watch-suppression events never interrupt active playback.
const activeInlineVideos = new Map<string, { postId: string; videoId?: string; updatedAt: number }>();

export function markInlineVideoActive(postId: string, videoId?: string): void {
  if (!postId) return;
  activeInlineVideos.set(postId, { postId, videoId, updatedAt: Date.now() });
}

export function markInlineVideoInactive(postId: string): void {
  if (!postId) return;
  activeInlineVideos.delete(postId);
}

export function isInlineVideoActive(postId?: string, videoId?: string): boolean {
  if (postId && activeInlineVideos.has(postId)) return true;
  if (videoId) {
    for (const entry of activeInlineVideos.values()) {
      if (entry.videoId === videoId) return true;
    }
  }
  return false;
}

export function getActiveInlineVideoIds(): Set<string> {
  const ids = new Set<string>();
  for (const entry of activeInlineVideos.values()) {
    ids.add(entry.postId);
    if (entry.videoId) ids.add(entry.videoId);
  }
  return ids;
}

