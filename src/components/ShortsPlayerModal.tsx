import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ArrowLeft,
  Heart,
  ThumbsDown,
  MessageCircle,
  Share2,
  Bookmark,
  MoreVertical,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Youtube,
  Shield,
  UserPlus,
  UserCheck,
  Check,
  Loader2,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Copy,
  Gauge,
} from 'lucide-react';
import type { ShortVideo } from '../types';
import { api } from '../api';
import {
  buildYouTubeEmbedUrl,
  sendYTCommand,
  registerYTListeningHandshake,
  parseYTInfoMessage,
} from '../utils/youtubePlayerBridge';
import { useBackHandler } from '../hooks/useBackNavigation';
import { recordWatchedSuppression } from '../services/watchSuppression';
import { FireLikeIcon } from './fire/MotherlandIcons';
import { FireRichText } from './fire/FireRichText';

interface ShortsPlayerModalProps {
  isOpen: boolean;
  shorts: ShortVideo[];
  initialIndex?: number;
  onClose: () => void;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  hasMoreShorts?: boolean;
  exhaustedNotice?: string;
  onOpenComments: (info: { postId?: string; youtubeVideoId?: string; title?: string }) => void;
}

function formatShortTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const ShortsPlayerModal: React.FC<ShortsPlayerModalProps> = ({
  isOpen,
  shorts,
  initialIndex = 0,
  onClose,
  onLoadMore,
  isLoadingMore = false,
  hasMoreShorts = true,
  exhaustedNotice = '',
  onOpenComments,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [items, setItems] = useState<ShortVideo[]>(shorts);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [playPulseIcon, setPlayPulseIcon] = useState<'play' | 'pause' | null>(null);
  const [showHeartBurst, setShowHeartBurst] = useState<{ x: number; y: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Per-short local interaction state
  const [dislikedMap, setDislikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  // Playback progress
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Live swipe / drag gesture state
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragHint, setDragHint] = useState<'next' | 'prev' | 'close' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);

  const touchStartYRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const headerDragStartYRef = useRef<number | null>(null);
  const touchMovedRef = useRef(false);
  const lastTouchHandledAtRef = useRef<number>(0);
  const tapTimerRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const hideControlsTimerRef = useRef<number | null>(null);

  // Register global edge-swipe / Android back handler
  useBackHandler('shorts-player-modal', isOpen, onClose, 70);

  useEffect(() => {
    setItems(shorts);
  }, [shorts]);

  useEffect(() => {
    if (isOpen) {
      const clamped = Math.max(0, Math.min(initialIndex, Math.max(0, shorts.length - 1)));
      setCurrentIndex(clamped);
      setIsPlaying(true);
      setDragOffsetY(0);
      setDragHint(null);
      setControlsVisible(true);
      setCurrentTime(0);
      setDuration(0);
      setMoreMenuOpen(false);
    }
  }, [isOpen, initialIndex]);

  // Pre-fetch next batch seamlessly when nearing the end (never show counts)
  useEffect(() => {
    if (!isOpen || !hasMoreShorts || !onLoadMore || isLoadingMore) return;
    if (currentIndex >= Math.max(0, items.length - 3)) {
      onLoadMore();
    }
  }, [isOpen, currentIndex, items.length, onLoadMore, isLoadingMore, hasMoreShorts]);

  const watchedSecondsRef = useRef(0);
  const reportedShortRef = useRef(false);

  // Reset per-video state on index switch
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
    setMoreMenuOpen(false);
    watchedSecondsRef.current = 0;
    reportedShortRef.current = false;
  }, [currentIndex]);

  // Track genuine Shorts watch (>=4s) for Watch History & 14-day discovery suppression (both guests & signed-in users)
  useEffect(() => {
    const activeShort = items[currentIndex];
    if (!isOpen || !activeShort) return;
    const flushShort = () => {
      const w = watchedSecondsRef.current;
      if (reportedShortRef.current || w < 4) return;
      reportedShortRef.current = true;
      recordWatchedSuppression(activeShort.id, activeShort.youtubeId);
      if (api.getToken()) {
        api
          .recordWatchProgress({
            videoId: activeShort.id,
            youtubeId: activeShort.youtubeId,
            videoType: 'short',
            source: activeShort.source,
            title: activeShort.title,
            thumbnailUrl: activeShort.thumbnailUrl,
            channelTitle: activeShort.creator.name,
            watchSeconds: Math.round(w),
            durationSeconds: Math.round(duration || 30),
            completed: duration > 0 ? currentTime / duration >= 0.85 : w >= 12,
          })
          .catch(() => {});
      }
    };
    const tick = window.setInterval(() => {
      if (isPlaying) {
        watchedSecondsRef.current += 1;
        if (watchedSecondsRef.current >= 4) flushShort();
      }
    }, 1000);
    return () => {
      window.clearInterval(tick);
      flushShort();
    };
  }, [isOpen, currentIndex, isPlaying, items, duration, currentTime]);

  // Preload next Short thumbnail so switching feels instant
  useEffect(() => {
    if (!isOpen) return;
    const nextItem = items[currentIndex + 1];
    if (nextItem?.thumbnailUrl) {
      const img = new Image();
      img.src = nextItem.thumbnailUrl;
    }
  }, [isOpen, currentIndex, items]);

  const currentShort = items[currentIndex] || items[0];
  const isYouTube = Boolean(currentShort?.source === 'youtube' && currentShort?.youtubeId);

  // Sync play/pause & mute to native <video> or YouTube iframe (only 1 active video plays)
  useEffect(() => {
    if (!isOpen || !currentShort) return;
    if (isYouTube) {
      sendYTCommand(ytIframeRef.current, isPlaying ? 'playVideo' : 'pauseVideo');
    } else if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isOpen, isPlaying, currentIndex, isYouTube, playbackRate]);

  useEffect(() => {
    if (!isOpen || !currentShort) return;
    if (isYouTube) {
      sendYTCommand(ytIframeRef.current, isMuted ? 'mute' : 'unMute');
    } else if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isOpen, isMuted, isYouTube]);

  // Listen to YouTube IFrame player state & time updates
  useEffect(() => {
    if (!isOpen || !isYouTube) return;
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
  }, [isOpen, isYouTube, currentShort?.youtubeId]);

  const goNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((i) => Math.min(items.length - 1, i + 1));
      setDragOffsetY(0);
      setIsTransitioning(false);
    } else if (hasMoreShorts && onLoadMore && !isLoadingMore) {
      onLoadMore();
    }
  }, [currentIndex, items.length, hasMoreShorts, onLoadMore, isLoadingMore]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => Math.max(0, i - 1));
      setDragOffsetY(0);
      setIsTransitioning(false);
    }
  }, [currentIndex]);

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (moreMenuOpen) setMoreMenuOpen(false);
        else onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, moreMenuOpen, onClose, goNext, goPrev]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      setPlayPulseIcon(next ? 'play' : 'pause');
      setTimeout(() => setPlayPulseIcon(null), 500);
      if (!next) {
        setControlsVisible(true);
        if (hideControlsTimerRef.current) window.clearTimeout(hideControlsTimerRef.current);
      } else {
        setControlsVisible(true);
        if (hideControlsTimerRef.current) window.clearTimeout(hideControlsTimerRef.current);
        hideControlsTimerRef.current = window.setTimeout(() => {
          setControlsVisible(false);
        }, 2800);
      }
      return next;
    });
  }, []);

  const toggleLike = (forceLike = false) => {
    if (!currentShort) return;
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== currentIndex) return item;
        const alreadyLiked = Boolean(item.userInteractions?.isLiked);
        if (forceLike && alreadyLiked) return item;
        const nextLiked = forceLike ? true : !alreadyLiked;
        if (nextLiked && dislikedMap[item.id]) {
          setDislikedMap((d) => ({ ...d, [item.id]: false }));
        }
        return {
          ...item,
          stats: {
            ...item.stats,
            likes: Math.max(0, item.stats.likes + (nextLiked ? 1 : -1)),
          },
          userInteractions: {
            ...item.userInteractions,
            isLiked: nextLiked,
          },
        };
      })
    );
  };

  const toggleDislike = () => {
    if (!currentShort) return;
    const nextDisliked = !dislikedMap[currentShort.id];
    setDislikedMap((prev) => ({ ...prev, [currentShort.id]: nextDisliked }));
    if (nextDisliked && currentShort.userInteractions?.isLiked) {
      toggleLike(false);
    }
  };

  const toggleFollow = () => {
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === currentIndex
          ? {
              ...item,
              creator: { ...item.creator, isFollowing: !item.creator.isFollowing },
            }
          : item
      )
    );
  };

  const handleSurfaceTap = (clientX: number, clientY: number) => {
    if (moreMenuOpen) {
      setMoreMenuOpen(false);
      return;
    }

    const now = Date.now();
    if (now - lastTapTimeRef.current < 250) {
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapTimeRef.current = 0;
      toggleLike(true);

      const rect = stageRef.current?.getBoundingClientRect();
      setShowHeartBurst({
        x: rect ? clientX - rect.left : 180,
        y: rect ? clientY - rect.top : 300,
      });
      setTimeout(() => setShowHeartBurst(null), 700);
      return;
    }

    lastTapTimeRef.current = now;
    tapTimerRef.current = window.setTimeout(() => {
      tapTimerRef.current = null;
      togglePlayPause();
    }, 240);
  };

  // Native non-passive touch handling on the middle interactive capture zone
  const handleStageTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartYRef.current = e.touches[0].clientY;
    touchStartXRef.current = e.touches[0].clientX;
    touchMovedRef.current = false;
    setDragHint(null);
  };

  const handleStageTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null || touchStartXRef.current === null || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - touchStartYRef.current;
    const dx = e.touches[0].clientX - touchStartXRef.current;

    if (Math.abs(dy) > 8 || Math.abs(dx) > 8) {
      touchMovedRef.current = true;
    }

    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      const damped = dy * 0.65;
      setDragOffsetY(Math.max(-220, Math.min(240, damped)));
      if (dy < -42 && (currentIndex < items.length - 1 || hasMoreShorts)) setDragHint('next');
      else if (dy > 42 && currentIndex > 0) setDragHint('prev');
      else if (dy > 85 && currentIndex === 0) setDragHint('close');
      else setDragHint(null);
    }
  };

  const handleStageTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null || touchStartXRef.current === null) return;
    const endY = e.changedTouches[0].clientY;
    const endX = e.changedTouches[0].clientX;
    const dy = endY - touchStartYRef.current;
    const dx = endX - touchStartXRef.current;
    const startX = touchStartXRef.current;

    touchStartYRef.current = null;
    touchStartXRef.current = null;
    setDragHint(null);

    // 1. Left-edge swipe right dismiss
    if (startX <= 32 && dx > 68 && Math.abs(dy) < 60) {
      setDragOffsetY(0);
      onClose();
      return;
    }

    // 2. Vertical swipe navigation
    if (Math.abs(dy) >= 48 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) {
        if (currentIndex < items.length - 1) {
          goNext();
        } else if (hasMoreShorts) {
          setDragOffsetY(0);
          onLoadMore?.();
        } else {
          setDragOffsetY(0);
        }
      } else if (currentIndex > 0) {
        goPrev();
      } else if (dy > 105) {
        setDragOffsetY(0);
        onClose();
      } else {
        setDragOffsetY(0);
      }
      return;
    }

    setDragOffsetY(0);

    // 3. Clean Tap (no drag)
    if (!touchMovedRef.current && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      lastTouchHandledAtRef.current = Date.now();
      handleSurfaceTap(endX, endY);
    }
  };

  // Top Header Swipe-Down Dismiss from ANY index
  const handleHeaderTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    headerDragStartYRef.current = e.touches[0].clientY;
  };
  const handleHeaderTouchMove = (e: React.TouchEvent) => {
    if (headerDragStartYRef.current === null || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - headerDragStartYRef.current;
    if (dy > 0) {
      setDragOffsetY(Math.min(260, dy * 0.75));
      if (dy > 80) setDragHint('close');
    }
  };
  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    if (headerDragStartYRef.current === null) return;
    const dy = e.changedTouches[0].clientY - headerDragStartYRef.current;
    headerDragStartYRef.current = null;
    setDragHint(null);
    setDragOffsetY(0);
    if (dy > 85) {
      onClose();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 42) return;
    if (e.deltaY > 0) goNext();
    else goPrev();
  };

  const handleSeek = (val: number) => {
    setCurrentTime(val);
    if (isYouTube) {
      sendYTCommand(ytIframeRef.current, 'seekTo', [val, true]);
    } else if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleShare = async () => {
    if (!currentShort) return;
    const shareUrl = currentShort.youtubeId
      ? `https://youtube.com/shorts/${currentShort.youtubeId}`
      : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: currentShort.title, url: shareUrl });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    navigator.clipboard?.writeText(shareUrl);
    setCopiedId(currentShort.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen || items.length === 0 || !currentShort) return null;

  const isLiked = Boolean(currentShort.userInteractions?.isLiked);
  const isDisliked = Boolean(dislikedMap[currentShort.id]);
  const isSaved = Boolean(savedMap[currentShort.id]);
  const nextShort = items[currentIndex + 1];
  const prevShort = currentIndex > 0 ? items[currentIndex - 1] : null;
  const atFeedBoundary = currentIndex >= items.length - 1;

  return (
    <div
      data-testid="shorts-player-modal"
      className="fixed inset-0 z-50 bg-[#101319] flex items-center justify-center select-none overflow-hidden"
      onWheel={handleWheel}
    >
      {/* Centered 9:16 Stage */}
      <div
        ref={stageRef}
        className="relative w-full max-w-[440px] h-full sm:h-[94dvh] sm:rounded-3xl overflow-hidden bg-[#13161C] sm:border sm:border-white/15 flex items-center justify-center shadow-2xl"
        style={{
          transform: dragOffsetY !== 0 ? `translateY(${dragOffsetY}px)` : 'translateY(0px)',
          transition:
            dragOffsetY === 0 || isTransitioning
              ? 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)'
              : 'none',
        }}
      >
        {/* Top Overlay Bar (Supports swipe-down dismiss on any video; ZERO total/index counters!) */}
        <div
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleHeaderTouchMove}
          onTouchEnd={handleHeaderTouchEnd}
          className={`absolute top-0 left-0 right-0 z-30 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between touch-none transition-opacity duration-200 ${
            controlsVisible ? 'opacity-100' : 'opacity-80'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white hover:bg-white/25 flex items-center justify-center transition-colors"
            title="Back"
            aria-label="Back from Shorts"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            data-testid="shorts-header-badge"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/12 backdrop-blur-md border border-white/20 text-xs text-white font-semibold"
          >
            <span className="w-2 h-2 rounded-full bg-[#D0AF72]" />
            <span>Shorts</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white hover:bg-white/25 flex items-center justify-center transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-5 h-5 text-[#D0AF72]" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white hover:bg-white/25 flex items-center justify-center transition-colors"
              aria-label="Close Shorts"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Single Active Video Playback Layer (Only 1 Video Ever Plays, Instant Poster Backdrop) */}
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          {currentShort.thumbnailUrl && (
            <img
              src={currentShort.thumbnailUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover opacity-80 pointer-events-none"
            />
          )}
          {isYouTube && currentShort.youtubeId ? (
            <iframe
              ref={ytIframeRef}
              key={currentShort.youtubeId}
              src={buildYouTubeEmbedUrl(currentShort.youtubeId, {
                autoplay: true,
                controls: false,
                loop: true,
                mute: false,
              })}
              onLoad={() => registerYTListeningHandshake(ytIframeRef.current, currentIndex + 1)}
              title={currentShort.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="relative z-[1] w-full h-full border-0 pointer-events-none"
            />
          ) : (
            <video
              ref={videoRef}
              key={currentShort.id}
              src={currentShort.videoUrl}
              poster={currentShort.thumbnailUrl}
              loop
              playsInline
              autoPlay
              muted={isMuted}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              className="w-full h-full object-cover"
            />
          )}

          {/* Full-Stage Transparent Touch & Tap Capture Layer */}
          <div
            data-testid="shorts-gesture-surface"
            data-no-edge-back="true"
            className="absolute inset-0 z-20 touch-none cursor-pointer"
            onTouchStart={handleStageTouchStart}
            onTouchMove={handleStageTouchMove}
            onTouchEnd={handleStageTouchEnd}
            onClick={(e) => {
              if (Date.now() - lastTouchHandledAtRef.current < 450) return;
              if (e.detail >= 0 && !touchMovedRef.current) {
                handleSurfaceTap(e.clientX, e.clientY);
              }
            }}
          />

          {/* Paused / Tap Pulse Feedback */}
          {(!isPlaying || playPulseIcon) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-25">
              <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-md border border-[#D0AF72]/40 text-white flex items-center justify-center shadow-2xl">
                {!isPlaying || playPulseIcon === 'play' ? (
                  <Play className="w-7 h-7 fill-current ml-0.5 text-[#D0AF72]" />
                ) : (
                  <Pause className="w-7 h-7 text-white" />
                )}
              </div>
            </div>
          )}

          {/* Double-Tap Heart Burst */}
          {showHeartBurst && (
            <div
              className="absolute pointer-events-none z-30 -translate-x-1/2 -translate-y-1/2 animate-ping"
              style={{ left: showHeartBurst.x, top: showHeartBurst.y }}
            >
              <Heart className="w-20 h-20 text-[#E05858] fill-current drop-shadow-2xl" />
            </div>
          )}

          {/* Honest Quota / Feed Exhaustion Notice ONLY when genuine */}
          {atFeedBoundary && exhaustedNotice && (
            <div className="absolute top-20 inset-x-6 z-30 flex justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-2xl bg-black/75 backdrop-blur-md border border-white/15 text-white text-xs text-center shadow-xl">
                {exhaustedNotice}
              </div>
            </div>
          )}

          {/* Drag / Swipe Preview Hint Pills */}
          {dragHint === 'next' && nextShort && (
            <div className="absolute bottom-28 inset-x-6 z-30 flex justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-full bg-black/80 backdrop-blur-md border border-[#2B8A86]/50 text-white text-xs font-semibold flex items-center gap-2 shadow-xl">
                <ChevronUp className="w-4 h-4 text-[#2B8A86]" />
                <span className="truncate max-w-[220px]">Next: {nextShort.title}</span>
              </div>
            </div>
          )}
          {dragHint === 'prev' && prevShort && (
            <div className="absolute top-20 inset-x-6 z-30 flex justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-full bg-black/80 backdrop-blur-md border border-[#D0AF72]/50 text-white text-xs font-semibold flex items-center gap-2 shadow-xl">
                <ChevronDown className="w-4 h-4 text-[#D0AF72]" />
                <span className="truncate max-w-[220px]">Prev: {prevShort.title}</span>
              </div>
            </div>
          )}
          {dragHint === 'close' && (
            <div className="absolute top-20 inset-x-6 z-30 flex justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white text-xs font-semibold">
                Release to exit Shorts
              </div>
            </div>
          )}
        </div>

        {/* Bottom Metadata + Scrubber Bar */}
        <div
          className={`absolute left-0 right-0 bottom-0 z-30 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-200 ${
            controlsVisible ? 'opacity-100' : 'opacity-90'
          }`}
        >
          <div className="pr-16 space-y-2">
            <div className="flex items-center gap-2">
              {currentShort.creator.avatar ? (
                <img
                  src={currentShort.creator.avatar}
                  alt={currentShort.creator.name}
                  className="w-9 h-9 rounded-full object-cover border border-[#D0AF72]/50"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-white/15 border border-[#D0AF72]/40 flex items-center justify-center text-xs font-bold text-white">
                  {currentShort.creator.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="font-bold text-sm text-white truncate max-w-[155px]">
                {currentShort.creator.name}
              </span>
              <button
                type="button"
                onClick={toggleFollow}
                className={`min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${
                  currentShort.creator.isFollowing
                    ? 'bg-white/20 text-white border border-white/20'
                    : 'bg-[#2B8A86] hover:bg-[#359E9A] text-white'
                }`}
              >
                {currentShort.creator.isFollowing ? (
                  <>
                    <UserCheck className="w-3 h-3" />
                    <span>Supporting</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3" />
                    <span>Support</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-xs sm:text-sm text-white font-medium line-clamp-2 leading-snug">
              <FireRichText text={currentShort.caption || currentShort.title} emojiSize="sm" />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-white/75">
              {isYouTube ? (
                <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                  <Youtube className="w-3.5 h-3.5" /> YouTube Shorts
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#2B8A86] font-semibold">
                  <Shield className="w-3.5 h-3.5" /> MOTHERLAND Shorts
                </span>
              )}
              <span>·</span>
              <span>Swipe up / down to browse</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <button
              type="button"
              onClick={togglePlayPause}
              className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center flex-shrink-0"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <input
              type="range"
              data-no-edge-back="true"
              min={0}
              max={duration > 0 ? duration : 60}
              step={0.25}
              value={Math.min(currentTime, duration > 0 ? duration : 60)}
              onChange={(e) => handleSeek(Number(e.target.value))}
              aria-label="Seek short"
              className="flex-1 h-1.5 accent-[#2B8A86] cursor-pointer rounded-full"
            />

            <span className="text-[10px] font-mono text-white/80 tabular-nums flex-shrink-0">
              {formatShortTime(currentTime)}
              {duration > 0 ? ` / ${formatShortTime(duration)}` : ''}
            </span>
          </div>
        </div>

        {/* Right Side Action Stack */}
        <div
          className={`absolute right-2.5 bottom-24 z-30 flex flex-col items-center gap-3 text-white transition-opacity duration-200 ${
            controlsVisible ? 'opacity-100' : 'opacity-80'
          }`}
        >
          <div className="hidden sm:flex flex-col gap-1 mb-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center disabled:opacity-30 hover:bg-white/20"
              aria-label="Previous Short"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={currentIndex >= items.length - 1 && !hasMoreShorts}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center disabled:opacity-30 hover:bg-white/20"
              aria-label="Next Short"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => toggleLike(false)}
              className={`w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-transform ${
                isLiked ? 'bg-orange-500/20 border-orange-400/50' : 'text-white'
              }`}
              aria-label="Fire Like short"
            >
              <FireLikeIcon size={22} active={isLiked} />
            </button>
            <span className="text-[10px] font-semibold mt-0.5 tabular-nums drop-shadow">
              {currentShort.stats.likes.toLocaleString()}
            </span>
          </div>

          {!isYouTube && (
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={toggleDislike}
                className={`w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-transform ${
                  isDisliked ? 'text-[#D0AF72] border-[#D0AF72]/50' : 'text-white'
                }`}
                aria-label="Dislike short"
              >
                <ThumbsDown className={`w-5 h-5 ${isDisliked ? 'fill-current' : ''}`} />
              </button>
              <span className="text-[10px] font-semibold mt-0.5 drop-shadow">
                {isDisliked ? 'Disliked' : 'Dislike'}
              </span>
            </div>
          )}

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() =>
                onOpenComments({
                  postId: currentShort.id,
                  youtubeVideoId: currentShort.youtubeId,
                  title: currentShort.title,
                })
              }
              className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-transform"
              aria-label="Comments"
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            <span className="text-[10px] font-semibold mt-0.5 tabular-nums drop-shadow">
              {currentShort.stats.comments.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => {
                const next = !savedMap[currentShort.id];
                setSavedMap((prev) => ({ ...prev, [currentShort.id]: next }));
                if (api.getToken()) {
                  api
                    .toggleSaveVideo({
                      videoId: currentShort.id,
                      videoType: 'short',
                      source: currentShort.source,
                      youtubeId: currentShort.youtubeId,
                      title: currentShort.title,
                      thumbnailUrl: currentShort.thumbnailUrl,
                      channelTitle: currentShort.creator.name,
                      channelAvatar: currentShort.creator.avatar,
                      videoUrl: currentShort.videoUrl,
                    })
                    .catch(() => {});
                }
              }}
              className={`w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-transform ${
                isSaved ? 'text-[#D0AF72] border-[#D0AF72]/50' : 'text-white'
              }`}
              aria-label="Save short"
            >
              <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
            </button>
            <span className="text-[10px] font-semibold mt-0.5 drop-shadow">
              {isSaved ? 'Saved' : 'Save'}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={handleShare}
              className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-transform"
              aria-label="Share short"
            >
              {copiedId === currentShort.id ? (
                <Check className="w-5 h-5 text-[#2B8A86]" />
              ) : (
                <Share2 className="w-5 h-5" />
              )}
            </button>
            <span className="text-[10px] font-semibold mt-0.5 drop-shadow">
              {copiedId === currentShort.id ? 'Copied' : 'Share'}
            </span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((o) => !o)}
              className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-transform"
              aria-label="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {moreMenuOpen && (
              <div className="absolute right-12 bottom-0 w-48 rounded-2xl ml-glass-elevated py-1.5 text-xs text-[var(--text-primary)] z-40">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      currentShort.youtubeId
                        ? `https://youtube.com/shorts/${currentShort.youtubeId}`
                        : window.location.href
                    );
                    setCopiedId(currentShort.id);
                    setMoreMenuOpen(false);
                    setTimeout(() => setCopiedId(null), 1800);
                  }}
                  className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--bg-surface-alt)] flex items-center gap-2.5"
                >
                  <Copy className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>Copy Link</span>
                </button>

                {!isYouTube && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
                      setPlaybackRate(nextRate);
                      setMoreMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--bg-surface-alt)] flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2.5">
                      <Gauge className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>Speed</span>
                    </span>
                    <span className="font-mono text-[var(--accent-gold)]">{playbackRate}x</span>
                  </button>
                )}

                {isYouTube && currentShort.youtubeId && (
                  <a
                    href={`https://youtube.com/shorts/${currentShort.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMoreMenuOpen(false)}
                    className="w-full px-3.5 py-2.5 text-left hover:bg-[var(--bg-surface-alt)] flex items-center gap-2.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-red-500" />
                    <span>Open on YouTube</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin text-[#2B8A86]" />}
        </div>
      </div>
    </div>
  );
};
