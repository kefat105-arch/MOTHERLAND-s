// Lightweight YouTube IFrame Player API bridge using native postMessage.
// Lets Shorts & Watch Player control real playback (play/pause/mute/seek)
// and read real currentTime/duration/playerState without extra script races.

export interface YTPlayerStateMessage {
  currentTime?: number;
  duration?: number;
  playerState?: number; // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  muted?: boolean;
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoplay?: boolean;
    controls?: boolean;
    loop?: boolean;
    mute?: boolean;
  } = {}
): string {
  const { autoplay = true, controls = true, loop = false, mute = false } = options;
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
  if (loop) {
    params.set('loop', '1');
    params.set('playlist', videoId);
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export function sendYTCommand(
  iframe: HTMLIFrameElement | null,
  func: 'playVideo' | 'pauseVideo' | 'mute' | 'unMute' | 'seekTo',
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

export function parseYTInfoMessage(event: MessageEvent): YTPlayerStateMessage | null {
  if (
    !event.origin.includes('youtube.com') &&
    !event.origin.includes('youtube-nocookie.com')
  ) {
    return null;
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

  // YouTube posts both `infoDelivery` and `onStateChange`
  if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
    const out: YTPlayerStateMessage = {};
    if (typeof data.info.currentTime === 'number') out.currentTime = data.info.currentTime;
    if (typeof data.info.duration === 'number') out.duration = data.info.duration;
    if (typeof data.info.playerState === 'number') out.playerState = data.info.playerState;
    if (typeof data.info.muted === 'boolean') out.muted = data.info.muted;
    return out;
  }

  if (data.event === 'onStateChange' && typeof data.info === 'number') {
    return { playerState: data.info };
  }

  return null;
}
