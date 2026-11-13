import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, ChevronDown, X } from 'lucide-react';
import type { LongVideo } from '../types';
import { api } from '../api';
import {
  buildYouTubeEmbedUrl,
  sendYTCommand,
  registerYTListeningHandshake,
  parseYTInfoMessage,
} from '../utils/youtubePlayerBridge';

interface PersistentWatchPlayerProps {
  video: LongVideo | null;
  isMinimized: boolean;
  isFullWatchVisible: boolean; // true only when activeNav === 'video' && !isMinimized
  isPausedByOverlay: boolean; // pauses when ShortsPlayerModal is open
  anchorElement: HTMLDivElement | null;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
}

function formatWatchTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const PersistentWatchPlayer: React.FC<PersistentWatchPlayerProps> = ({
  video,
  isMinimized,
  isFullWatchVisible,
  isPausedByOverlay,
  anchorElement,
  onMinimize,
  onExpand,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 390
  );
  const [hostRect, setHostRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const isYouTube = Boolean(video?.source === 'youtube' && video?.youtubeId);

  const watchedSecondsRef = useRef(0);
  const lastReportedSecRef = useRef(0);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  currentTimeRef.current = currentTime;
  durationRef.current = duration;

  // Reset playback counters only when switching to a genuinely different video ID
  useEffect(() => {
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    watchedSecondsRef.current = 0;
    lastReportedSecRef.current = 0;
  }, [video?.id]);

  // Accurate meaningful watch progress reporting (>= 8s or >= 25%) without triggering on accidental clicks
  useEffect(() => {
    if (!video || !api.getToken()) return;
    const flush = (force = false) => {
      const watched = watchedSecondsRef.current;
      const dur = durationRef.current;
      const pos = currentTimeRef.current;
      const ratio = dur > 0 ? pos / dur : 0;
      const meetsThreshold = watched >= 8 || ratio >= 0.25;
      if (!meetsThreshold) return;
      if (!force && watched - lastReportedSecRef.current < 5) return;
      lastReportedSecRef.current = watched;
      api
        .recordWatchProgress({
          videoId: video.id,
          youtubeId: video.youtubeId,
          videoType: 'long',
          source: video.source,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          channelTitle: video.channel.title,
          duration: video.duration,
          watchSeconds: Math.round(Math.max(watched, pos)),
          durationSeconds: Math.round(dur),
          completed: ratio >= 0.9,
        })
        .catch(() => {});
    };

    const tick = window.setInterval(() => {
      if (isPlaying && !isPausedByOverlay) {
        watchedSecondsRef.current += 1;
        flush(false);
      }
    }, 1000);

    return () => {
      window.clearInterval(tick);
      flush(true);
    };
  }, [video?.id, isPlaying, isPausedByOverlay]);

  // Measure anchor element continuously when in full Watch Page mode
  useLayoutEffect(() => {
    const onViewportResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onViewportResize, { passive: true });

    if (!video || !isFullWatchVisible || !anchorElement) {
      setHostRect(null);
      return () => {
        window.removeEventListener('resize', onViewportResize);
      };
    }

    const measure = () => {
      const r = anchorElement.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setHostRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        });
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(anchorElement);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('resize', onViewportResize);
    };
  }, [video, isFullWatchVisible, anchorElement]);

  // Pause active watch player if Shorts player opens on top
  useEffect(() => {
    if (!video || !isPausedByOverlay) return;
    if (isYouTube) {
      sendYTCommand(ytIframeRef.current, 'pauseVideo');
    } else if (nativeVideoRef.current) {
      nativeVideoRef.current.pause();
    }
    setIsPlaying(false);
  }, [isPausedByOverlay, video, isYouTube]);

  // Sync mute state
  useEffect(() => {
    if (!video) return;
    if (isYouTube) {
      sendYTCommand(ytIframeRef.current, isMuted ? 'mute' : 'unMute');
    } else if (nativeVideoRef.current) {
      nativeVideoRef.current.muted = isMuted;
    }
  }, [isMuted, video, isYouTube]);

  // Parse real YouTube time/state updates
  useEffect(() => {
    if (!video || !isYouTube) return;
    const onMessage = (event: MessageEvent) => {
      const parsed = parseYTInfoMessage(event);
      if (!parsed) return;
      if (typeof parsed.currentTime === 'number') setCurrentTime(parsed.currentTime);
      if (typeof parsed.duration === 'number' && parsed.duration > 0) setDuration(parsed.duration);
      if (typeof parsed.playerState === 'number') {
        if (parsed.playerState === 1) setIsPlaying(true);
        else if (parsed.playerState === 2) setIsPlaying(false);
      }
      if (typeof parsed.muted === 'boolean') setIsMuted(parsed.muted);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [video?.id, isYouTube]);

  if (!video) return null;

  const togglePlayPause = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    if (isYouTube) {
      sendYTCommand(ytIframeRef.current, next ? 'playVideo' : 'pauseVideo');
    } else if (nativeVideoRef.current) {
      if (next) nativeVideoRef.current.play().catch(() => {});
      else nativeVideoRef.current.pause();
    }
  };

  const handleSeek = (val: number) => {
    setCurrentTime(val);
    if (isYouTube) {
      sendYTCommand(ytIframeRef.current, 'seekTo', [val, true]);
    } else if (nativeVideoRef.current) {
      nativeVideoRef.current.currentTime = val;
    }
  };

  const handleFullscreen = () => {
    const el = containerRef.current || nativeVideoRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  };

  const showFloatingMiniBar = isMinimized || !isFullWatchVisible;
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Compute CSS layout of the single persistent media wrapper so <video>/<iframe> NEVER remounts
  const mediaBoxStyle: React.CSSProperties = showFloatingMiniBar
    ? {
        position: 'fixed',
        left: viewportWidth >= 640 ? 'auto' : '0.75rem',
        right: viewportWidth >= 640 ? 'calc(1rem + 400px - 114px)' : 'auto',
        bottom: 'calc(74px + env(safe-area-inset-bottom))',
        width: '106px',
        height: '60px',
        zIndex: 42,
        borderRadius: '0.75rem',
        overflow: 'hidden',
      }
    : hostRect
    ? {
        position: 'fixed',
        top: `${hostRect.top}px`,
        left: `${hostRect.left}px`,
        width: `${hostRect.width}px`,
        height: `${hostRect.height}px`,
        zIndex: 35,
        borderRadius: viewportWidth >= 640 ? '1rem' : '0px',
        overflow: 'hidden',
      }
    : {
        position: 'fixed',
        top: '-9999px',
        left: '-9999px',
        width: '320px',
        height: '180px',
        zIndex: 35,
      };

  return (
    <>
      {/* Docked Frosted Glass Mini-Player Background Shell */}
      {showFloatingMiniBar && (
        <div
          data-testid="persistent-mini-player"
          className="fixed left-2 right-2 sm:left-auto sm:right-4 sm:w-[400px] z-40 rounded-2xl ml-glass-elevated overflow-hidden"
          style={{ bottom: 'calc(68px + env(safe-area-inset-bottom))', height: '72px' }}
        >
          {/* Thin live playback progress indicator */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--border-subtle)]">
            <div
              className="h-full bg-[var(--accent-primary)] transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="h-full flex items-center pl-[118px] pr-2 gap-1.5">
            {/* Clickable Title & Channel expands back to Watch Page */}
            <button
              type="button"
              onClick={onExpand}
              className="flex-1 min-w-0 text-left py-1.5 focus:outline-none"
            >
              <p className="text-xs font-bold text-[var(--text-primary)] truncate leading-snug">
                {video.title}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {video.channel.title}
              </p>
            </button>

            {/* Real Play/Pause */}
            <button
              type="button"
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] flex items-center justify-center transition-colors flex-shrink-0"
              aria-label={isPlaying ? 'Pause mini player' : 'Play mini player'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            {/* Close Mini Player */}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] flex items-center justify-center transition-colors flex-shrink-0"
              aria-label="Close mini player"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Single Persistent Player Stage Box — Never unmounted across scroll/minimize */}
      <div
        ref={containerRef}
        data-testid="persistent-watch-stage"
        style={mediaBoxStyle}
        className="bg-black shadow-xl group"
      >
        {/* Single Mounted Video / IFrame Node — Keyed ONLY by video.id */}
        {isYouTube && video.youtubeId ? (
          <iframe
            ref={ytIframeRef}
            key={video.id}
            src={buildYouTubeEmbedUrl(video.youtubeId, {
              autoplay: true,
              controls: true,
              loop: false,
              mute: false,
            })}
            onLoad={() => registerYTListeningHandshake(ytIframeRef.current, 100)}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={`w-full h-full border-0 ${showFloatingMiniBar ? 'pointer-events-none' : ''}`}
          />
        ) : (
          <video
            ref={nativeVideoRef}
            key={video.id}
            src={video.videoUrl}
            poster={video.thumbnailUrl}
            autoPlay
            playsInline
            muted={isMuted}
            onClick={() => {
              if (showFloatingMiniBar) onExpand();
              else togglePlayPause();
            }}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            className="w-full h-full object-contain cursor-pointer"
          />
        )}

        {/* Tap overlay on Mini-Video to expand back to Watch Page */}
        {showFloatingMiniBar && (
          <button
            type="button"
            onClick={onExpand}
            className="absolute inset-0 z-20 bg-transparent cursor-pointer"
            aria-label="Expand watch player"
          />
        )}

        {/* Full Watch Mode Overlay Controls */}
        {!showFloatingMiniBar && (
          <>
            {/* Quick Minimize Corner Button (Top Left) */}
            <button
              type="button"
              onClick={onMinimize}
              className="absolute top-2.5 left-2.5 z-30 min-h-[34px] px-2.5 py-1 rounded-xl bg-black/55 backdrop-blur-md border border-white/15 text-white text-[11px] font-semibold flex items-center gap-1 hover:bg-black/75 transition-colors"
              title="Minimize to Mini-Player"
              aria-label="Minimize video"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mini</span>
            </button>

            {/* Custom Controls Bar for Native MOTHERLAND Videos */}
            {!isYouTube && (
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 space-y-1.5">
                <input
                  type="range"
                  data-no-edge-back="true"
                  min={0}
                  max={duration > 0 ? duration : 100}
                  step={0.25}
                  value={currentTime}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="w-full accent-[#2B8A86] h-1.5 cursor-pointer"
                  aria-label="Seek video"
                />
                <div className="flex items-center justify-between text-white text-xs">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      className="p-1.5 rounded-lg hover:bg-white/15"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMuted((m) => !m)}
                      className="p-1.5 rounded-lg hover:bg-white/15"
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <span className="font-mono text-[11px] tabular-nums">
                      {formatWatchTime(currentTime)} / {formatWatchTime(duration)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleFullscreen}
                    className="p-1.5 rounded-lg hover:bg-white/15"
                    aria-label="Fullscreen"
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};
