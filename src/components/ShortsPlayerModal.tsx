import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ArrowLeft,
  Heart,
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
  recordVideoSwitchMetric,
} from '../utils/youtubePlayerBridge';
import { buildMotherlandVideoShareUrl, warmVideoThumbnail } from '../utils/videoShareLinks';
import { useBackHandler } from '../hooks/useBackNavigation';
import { recordWatchedSuppression } from '../services/watchSuppression';
import { FireLikeIcon, FireDislikeIcon, TalkIcon, VaultIcon, BoostIcon } from './fire/MotherlandIcons';
import { FireRichText } from './fire/FireRichText';
import type { CreatorProfileTarget } from './CreatorProfileModal';
import { CollapsibleDescription } from './common/ExpandableTranslatableText';
import { VideoBrandOverlay } from './common/VideoBrandOverlay';

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
  onOpenCreator?: (target: CreatorProfileTarget) => void;
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
  onOpenCreator,
}) => {
  const filterStrictShorts = (list: ShortVideo[]) =>
    list.filter((s) =>
      typeof s.durationSeconds === 'number'
        ? s.durationSeconds > 0 && s.durationSeconds <= 180
        : s.source !== 'youtube'
    );

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [items, setItems] = useState<ShortVideo[]>(() => filterStrictShorts(shorts));
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
  const [actionNotice, setActionNotice] = useState<{ text: string; url?: string } | null>(null);

  // Playback progress & instant-switch zero-black-screen state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [frameReady, setFrameReady] = useState(false);

  // Live swipe / drag gesture state
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [dragHint, setDragHint] = useState<'next' | 'prev' | 'close' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 2-Slot Pooled Players (alternating active & preloaded next slot for near-instant swipes)
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoSlotRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const ytSlotRefs = useRef<[HTMLIFrameElement | null, HTMLIFrameElement | null]>([null, null]);
  const ytSlotInitialSrcRef = useRef<[string, string]>(['', '']);
  const ytSlotBoundVideoIdRef = useRef<[string, string]>(['', '']);
  const ytSlotReadyIdRef = useRef<[string, string]>(['', '']);
  const nativeSlotReadyIdRef = useRef<[string, string]>(['', '']);
  const switchStartMsRef = useRef<number>(performance.now());
  const metricLoggedKeyRef = useRef<string>('');
  const [ytSlotUrls, setYtSlotUrls] = useState<[string, string]>(['', '']);

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
    setItems(filterStrictShorts(shorts));
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
    } else {
      // Release iframe slots cleanly on modal close so background audio never lingers
      ytSlotInitialSrcRef.current = ['', ''];
      ytSlotBoundVideoIdRef.current = ['', ''];
      ytSlotReadyIdRef.current = ['', ''];
      nativeSlotReadyIdRef.current = ['', ''];
      setYtSlotUrls(['', '']);
      setFrameReady(false);
      setIsBuffering(false);
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

  // Reset per-video counters & prepare instant frame readiness on index switch
  useEffect(() => {
    switchStartMsRef.current = performance.now();
    metricLoggedKeyRef.current = '';
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(true);
    setMoreMenuOpen(false);
    setActionNotice(null);
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

  // Preload next 3 Shorts thumbnails for zero-flash vertical swipe
  useEffect(() => {
    if (!isOpen) return;
    [items[currentIndex + 1], items[currentIndex + 2], items[currentIndex + 3]].forEach((nextItem) => {
      if (nextItem?.thumbnailUrl) warmVideoThumbnail(nextItem.thumbnailUrl);
    });
  }, [isOpen, currentIndex, items]);

  const currentShort = items[currentIndex] || items[0];
  const nextShortItem = items[currentIndex + 1] || null;
  const activeSlot = (currentIndex % 2) as 0 | 1;
  const preloadSlot = ((currentIndex + 1) % 2) as 0 | 1;
  const isYouTube = Boolean(currentShort?.source === 'youtube' && currentShort?.youtubeId);

  // Manage 2-Slot Pooled Playback & Background Pre-Cueing (Eliminates ~2-3s IFrame tear-down delay!)
  useEffect(() => {
    if (!isOpen || !currentShort) return;

    const alreadyCued = isYouTube
      ? Boolean(currentShort.youtubeId && ytSlotReadyIdRef.current[activeSlot] === currentShort.youtubeId)
      : nativeSlotReadyIdRef.current[activeSlot] === currentShort.id;

    setFrameReady(alreadyCued);
    setIsBuffering(!alreadyCued);

    // 1) Activate current Short on activeSlot
    if (isYouTube && currentShort.youtubeId) {
      const targetYtId = currentShort.youtubeId;
      const existingSrc = ytSlotInitialSrcRef.current[activeSlot];
      if (!existingSrc) {
        const url = buildYouTubeEmbedUrl(targetYtId, {
          autoplay: true,
          controls: false,
          loop: true,
          mute: isMuted,
        });
        ytSlotInitialSrcRef.current[activeSlot] = url;
        ytSlotBoundVideoIdRef.current[activeSlot] = targetYtId;
        setYtSlotUrls((prev) => {
          const copy: [string, string] = [...prev] as [string, string];
          copy[activeSlot] = url;
          return copy;
        });
      } else {
        const iframe = ytSlotRefs.current[activeSlot];
        if (ytSlotBoundVideoIdRef.current[activeSlot] === targetYtId) {
          // Pre-cued slot! Instant unmute/play/restart without network re-bootstrap
          sendYTCommand(iframe, 'seekTo', [0, true]);
          sendYTCommand(iframe, isMuted ? 'mute' : 'unMute');
          sendYTCommand(iframe, 'playVideo');
        } else {
          ytSlotBoundVideoIdRef.current[activeSlot] = targetYtId;
          ytSlotReadyIdRef.current[activeSlot] = '';
          sendYTCommand(iframe, 'loadVideoById', [{ videoId: targetYtId, startSeconds: 0 }]);
          sendYTCommand(iframe, isMuted ? 'mute' : 'unMute');
        }
      }
    } else if (!isYouTube && videoSlotRefs.current[activeSlot]) {
      const vid = videoSlotRefs.current[activeSlot];
      if (vid) {
        vid.playbackRate = playbackRate;
        vid.muted = isMuted;
        vid.currentTime = 0;
        vid.play().catch(() => {});
      }
    }

    // Ensure non-active slot stays paused immediately on switch
    if (ytSlotRefs.current[preloadSlot]) {
      sendYTCommand(ytSlotRefs.current[preloadSlot], 'pauseVideo');
      sendYTCommand(ytSlotRefs.current[preloadSlot], 'mute');
    }
    if (videoSlotRefs.current[preloadSlot]) {
      videoSlotRefs.current[preloadSlot]!.pause();
    }

    // 2) After short settle delay (220ms) so active video gets full startup bandwidth, pre-cue nextShort!
    const preloadTimer = window.setTimeout(() => {
      if (!nextShortItem) return;
      if (nextShortItem.source === 'youtube' && nextShortItem.youtubeId) {
        const nextYtId = nextShortItem.youtubeId;
        if (!ytSlotInitialSrcRef.current[preloadSlot]) {
          const url = buildYouTubeEmbedUrl(nextYtId, {
            autoplay: false,
            controls: false,
            loop: true,
            mute: true,
          });
          ytSlotInitialSrcRef.current[preloadSlot] = url;
          ytSlotBoundVideoIdRef.current[preloadSlot] = nextYtId;
          setYtSlotUrls((prev) => {
            const copy: [string, string] = [...prev] as [string, string];
            copy[preloadSlot] = url;
            return copy;
          });
        } else if (ytSlotBoundVideoIdRef.current[preloadSlot] !== nextYtId) {
          ytSlotBoundVideoIdRef.current[preloadSlot] = nextYtId;
          ytSlotReadyIdRef.current[preloadSlot] = '';
          sendYTCommand(ytSlotRefs.current[preloadSlot], 'mute');
          sendYTCommand(ytSlotRefs.current[preloadSlot], 'cueVideoById', [{ videoId: nextYtId, startSeconds: 0 }]);
        }
      } else if (nextShortItem.videoUrl && videoSlotRefs.current[preloadSlot]) {
        videoSlotRefs.current[preloadSlot]!.load();
      }
    }, 220);

    // Safety reveal fallback if a browser blocks YouTube infoDelivery messages
    const revealTimer = window.setTimeout(() => {
      setFrameReady(true);
      setIsBuffering(false);
    }, 1800);

    return () => {
      window.clearTimeout(preloadTimer);
      window.clearTimeout(revealTimer);
    };
  }, [isOpen, currentIndex, currentShort?.id, currentShort?.youtubeId, nextShortItem?.id, nextShortItem?.youtubeId]);

  // Sync play/pause & speed ONLY on activeSlot
  useEffect(() => {
    if (!isOpen || !currentShort) return;
    if (isYouTube) {
      sendYTCommand(ytSlotRefs.current[activeSlot], isPlaying ? 'playVideo' : 'pauseVideo');
      if (!isPlaying) setIsBuffering(false);
    } else if (videoSlotRefs.current[activeSlot]) {
      const vid = videoSlotRefs.current[activeSlot]!;
      vid.playbackRate = playbackRate;
      if (isPlaying) {
        vid.play().catch(() => {});
      } else {
        vid.pause();
        setIsBuffering(false);
      }
    }
  }, [isOpen, isPlaying, activeSlot, isYouTube, playbackRate, currentShort?.id]);

  // Sync mute state ONLY on activeSlot (preloadSlot stays muted!)
  useEffect(() => {
    if (!isOpen || !currentShort) return;
    if (isYouTube) {
      sendYTCommand(ytSlotRefs.current[activeSlot], isMuted ? 'mute' : 'unMute');
    } else if (videoSlotRefs.current[activeSlot]) {
      videoSlotRefs.current[activeSlot]!.muted = isMuted;
    }
  }, [isOpen, isMuted, activeSlot, isYouTube, currentShort?.id]);

  // Listen to YouTube IFrame player state & time updates per slot cleanly isolated by window source
  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (event: MessageEvent) => {
      // Check active slot first
      const activeFrame = ytSlotRefs.current[activeSlot];
      const activeParsed = activeFrame ? parseYTInfoMessage(event, activeFrame) : null;
      if (activeParsed) {
        const targetYtId = currentShort?.youtubeId;
        if (!activeParsed.videoId || !targetYtId || activeParsed.videoId === targetYtId) {
          if (typeof activeParsed.currentTime === 'number') setCurrentTime(activeParsed.currentTime);
          if (typeof activeParsed.duration === 'number' && activeParsed.duration > 0) setDuration(activeParsed.duration);
          if (typeof activeParsed.playerState === 'number') {
            if (activeParsed.playerState === 1) {
              setIsPlaying(true);
              setIsBuffering(false);
              setFrameReady(true);
              if (targetYtId) ytSlotReadyIdRef.current[activeSlot] = targetYtId;
              if (currentShort && metricLoggedKeyRef.current !== currentShort.id) {
                metricLoggedKeyRef.current = currentShort.id;
                recordVideoSwitchMetric({
                  player: 'shorts',
                  videoId: targetYtId || currentShort.id,
                  reusedPlayer: currentIndex > 0,
                  startupMs: Math.round(performance.now() - switchStartMsRef.current),
                });
              }
            } else if (activeParsed.playerState === 2) {
              setIsPlaying(false);
              setIsBuffering(false);
              setFrameReady(true);
            } else if (activeParsed.playerState === 3) {
              setIsBuffering(true);
            } else if (activeParsed.playerState === 5 && targetYtId) {
              ytSlotReadyIdRef.current[activeSlot] = targetYtId;
            }
          }
          if (typeof activeParsed.muted === 'boolean') setIsMuted(activeParsed.muted);
        }
        return;
      }

      // Check preload slot so we know when nextShort finishes cuing silently in background
      const preloadFrame = ytSlotRefs.current[preloadSlot];
      const preloadParsed = preloadFrame ? parseYTInfoMessage(event, preloadFrame) : null;
      if (preloadParsed && preloadParsed.playerState === 5 && nextShortItem?.youtubeId) {
        if (!preloadParsed.videoId || preloadParsed.videoId === nextShortItem.youtubeId) {
          ytSlotReadyIdRef.current[preloadSlot] = nextShortItem.youtubeId;
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isOpen, activeSlot, preloadSlot, currentIndex, currentShort?.id, currentShort?.youtubeId, nextShortItem?.youtubeId]);

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

  const toggleLike = async (forceLike = false) => {
    if (!currentShort) return;
    if (isYouTube) {
      if (!api.getToken()) {
        setActionNotice({
          text: 'Sign in and connect Google YouTube permission to like on YouTube.',
          url: currentShort.youtubeId ? `https://youtube.com/shorts/${currentShort.youtubeId}` : undefined,
        });
        return;
      }
      const alreadyLiked = Boolean(currentShort.userInteractions?.isLiked);
      const nextLiked = forceLike ? true : !alreadyLiked;
      try {
        await api.rateYouTubeVideo(currentShort.youtubeId || currentShort.id, nextLiked ? 'like' : 'none');
        setActionNotice(null);
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === currentIndex
              ? {
                  ...item,
                  stats: {
                    ...item.stats,
                    likes: Math.max(0, item.stats.likes + (nextLiked === alreadyLiked ? 0 : nextLiked ? 1 : -1)),
                  },
                  userInteractions: { ...item.userInteractions, isLiked: nextLiked },
                }
              : item
          )
        );
      } catch (err: any) {
        setActionNotice({
          text: err?.message || 'YouTube OAuth authorization required to like on YouTube.',
          url: currentShort.youtubeId ? `https://youtube.com/shorts/${currentShort.youtubeId}` : undefined,
        });
      }
      return;
    }

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
    if (!currentShort || isYouTube) return;
    const nextDisliked = !dislikedMap[currentShort.id];
    setDislikedMap((prev) => ({ ...prev, [currentShort.id]: nextDisliked }));
    if (nextDisliked && currentShort.userInteractions?.isLiked) {
      void toggleLike(false);
    }
  };

  const toggleFollow = async () => {
    if (!currentShort) return;
    if (isYouTube) {
      if (!api.getToken()) {
        setActionNotice({
          text: 'Sign in and connect YouTube permission to Support this channel on YouTube.',
          url: `https://www.youtube.com/channel/${encodeURIComponent(currentShort.creator.id)}`,
        });
        return;
      }
      const nextSub = !currentShort.creator.isFollowing;
      try {
        const res = await api.subscribeYouTubeChannel(
          currentShort.creator.id,
          nextSub ? 'subscribe' : 'unsubscribe'
        );
        if (res.success) {
          setActionNotice(null);
          setItems((prev) =>
            prev.map((item, idx) =>
              idx === currentIndex
                ? { ...item, creator: { ...item.creator, isFollowing: Boolean(res.subscribed) } }
                : item
            )
          );
        }
      } catch (err: any) {
        setActionNotice({
          text: err?.message || 'YouTube OAuth scope required to Support this channel.',
          url: `https://www.youtube.com/channel/${encodeURIComponent(currentShort.creator.id)}`,
        });
      }
      return;
    }

    if (!api.getToken()) {
      setActionNotice({ text: 'Sign in to Support MOTHERLAND creators.' });
      return;
    }
    try {
      const res = await api.toggleFollow(currentShort.creator.id);
      setActionNotice(null);
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === currentIndex
            ? { ...item, creator: { ...item.creator, isFollowing: Boolean(res.isFollowing) } }
            : item
        )
      );
    } catch (err: any) {
      setActionNotice({ text: err?.message || 'Could not update Support status.' });
    }
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
      if (!isYouTube) {
        void toggleLike(true);

        const rect = stageRef.current?.getBoundingClientRect();
        setShowHeartBurst({
          x: rect ? clientX - rect.left : 180,
          y: rect ? clientY - rect.top : 300,
        });
        setTimeout(() => setShowHeartBurst(null), 700);
      } else {
        void toggleLike(true);
      }
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
      sendYTCommand(ytSlotRefs.current[activeSlot], 'seekTo', [val, true]);
    } else if (videoSlotRefs.current[activeSlot]) {
      videoSlotRefs.current[activeSlot]!.currentTime = val;
    }
  };

  const handleShare = async () => {
    if (!currentShort) return;
    const shareUrl = buildMotherlandVideoShareUrl({
      id: currentShort.id,
      youtubeId: currentShort.youtubeId,
      source: currentShort.source,
      isShort: true,
    });
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

  if (!isOpen) return null;

  if (items.length === 0 || !currentShort) {
    return (
      <div
        data-testid="shorts-player-modal"
        className="fixed inset-0 z-50 bg-[#101319] flex items-center justify-center select-none overflow-hidden"
      >
        <div className="relative w-full max-w-[440px] h-full sm:h-[94dvh] sm:rounded-3xl overflow-hidden bg-[#13161C] sm:border sm:border-white/15 flex flex-col justify-between p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-white/15 border border-white/20 text-white hover:bg-white/25 flex items-center justify-center"
              aria-label="Back from Small Video"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div
              data-testid="shorts-header-badge"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/12 border border-white/20 text-xs text-white font-semibold"
            >
              <span className="w-2 h-2 rounded-full bg-[#D0AF72]" />
              <span>Small Video</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-white/15 border border-white/20 text-white hover:bg-white/25 flex items-center justify-center"
              aria-label="Close Small Video"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 space-y-4">
            {isLoadingMore ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-[#2B8A86]" />
                <p className="text-sm font-semibold text-white">Loading Small Videos...</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-white">No Small Videos available right now</p>
                <p className="text-xs text-white/70 max-w-xs">
                  {exhaustedNotice || 'Upload a vertical video or check back when creators share Small Videos.'}
                </p>
                <div className="flex items-center gap-2.5">
                  {onLoadMore && (
                    <button
                      type="button"
                      onClick={onLoadMore}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#2B8A86] text-white text-xs font-bold"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-white text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="h-4" />
        </div>
      </div>
    );
  }

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
            aria-label="Back from Small Video"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            data-testid="shorts-header-badge"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/12 backdrop-blur-md border border-white/20 text-xs text-white font-semibold"
          >
            <span className="w-2 h-2 rounded-full bg-[#D0AF72]" />
            <span>Small Video</span>
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
              aria-label="Close Small Video"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2-Slot Pooled Video Playback Layer (Instant Swap · Zero Black-Screen · Pre-Warmed Next Slot) */}
        <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
          {([0, 1] as const).map((slot) => {
            const slotShort = slot === activeSlot ? currentShort : nextShortItem;
            const isActive = slot === activeSlot;
            const slotIsYt = Boolean(slotShort?.source === 'youtube' && slotShort?.youtubeId);
            const hasYtSlotUrl = Boolean(ytSlotUrls[slot]);

            return (
              <div
                key={`shorts-slot-${slot}`}
                className={`absolute inset-0 w-full h-full ${
                  isActive ? 'z-[2] opacity-100' : 'z-0 opacity-0 pointer-events-none'
                }`}
              >
                {hasYtSlotUrl && (slotIsYt || ytSlotUrls[slot]) && (
                  <iframe
                    ref={(el) => {
                      ytSlotRefs.current[slot] = el;
                    }}
                    src={ytSlotUrls[slot]}
                    onLoad={() => {
                      registerYTListeningHandshake(ytSlotRefs.current[slot], slot + 1);
                      if (
                        slotShort?.youtubeId &&
                        ytSlotBoundVideoIdRef.current[slot] &&
                        ytSlotBoundVideoIdRef.current[slot] !== slotShort.youtubeId
                      ) {
                        ytSlotBoundVideoIdRef.current[slot] = slotShort.youtubeId;
                        sendYTCommand(
                          ytSlotRefs.current[slot],
                          isActive ? 'loadVideoById' : 'cueVideoById',
                          [{ videoId: slotShort.youtubeId, startSeconds: 0 }]
                        );
                      }
                    }}
                    title={slotShort?.title || 'Small Video'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className={`w-full h-full border-0 pointer-events-none ${
                      slotShort && !slotIsYt ? 'hidden' : ''
                    }`}
                  />
                )}
                {slotShort && !slotIsYt && slotShort.videoUrl && (
                  <video
                    ref={(el) => {
                      videoSlotRefs.current[slot] = el;
                    }}
                    src={slotShort.videoUrl}
                    poster={slotShort.thumbnailUrl}
                    preload="auto"
                    loop
                    playsInline
                    muted={!isActive || isMuted}
                    onCanPlay={() => {
                      nativeSlotReadyIdRef.current[slot] = slotShort.id;
                      if (isActive) {
                        setFrameReady(true);
                        setIsBuffering(false);
                      }
                    }}
                    onWaiting={() => {
                      if (isActive) setIsBuffering(true);
                    }}
                    onPlaying={() => {
                      nativeSlotReadyIdRef.current[slot] = slotShort.id;
                      if (isActive) {
                        setIsPlaying(true);
                        setFrameReady(true);
                        setIsBuffering(false);
                        if (metricLoggedKeyRef.current !== slotShort.id) {
                          metricLoggedKeyRef.current = slotShort.id;
                          recordVideoSwitchMetric({
                            player: 'shorts',
                            videoId: slotShort.id,
                            reusedPlayer: currentIndex > 0,
                            startupMs: Math.round(performance.now() - switchStartMsRef.current),
                          });
                        }
                      }
                    }}
                    onTimeUpdate={(e) => {
                      if (isActive) setCurrentTime(e.currentTarget.currentTime);
                    }}
                    onLoadedMetadata={(e) => {
                      if (isActive) setDuration(e.currentTarget.duration);
                    }}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            );
          })}

          {/* Instant Thumbnail Backdrop until Active Video Confirms Ready First Frame */}
          {currentShort.thumbnailUrl && (
            <img
              src={currentShort.thumbnailUrl}
              alt=""
              aria-hidden="true"
              className={`absolute inset-0 z-[5] w-full h-full object-cover pointer-events-none transition-opacity duration-200 ${
                frameReady ? 'opacity-0' : 'opacity-95'
              }`}
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

          {/* MOTHERLAND Branded Paused (Rotating Original Logo) vs Genuine Buffering Indicator */}
          <VideoBrandOverlay
            mode={isPlaying && isBuffering ? 'buffering' : 'paused'}
            visible={!isPlaying || (isPlaying && isBuffering && !frameReady) || playPulseIcon === 'pause'}
          />

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

          {/* Honest OAuth / Action Notice */}
          {actionNotice && (
            <div className="absolute top-20 inset-x-4 z-40 flex justify-center">
              <div className="px-3.5 py-2.5 rounded-2xl bg-[#161B26]/95 backdrop-blur-md border border-orange-500/40 text-white text-xs shadow-2xl flex items-center gap-2.5 max-w-sm">
                <span className="flex-1 leading-snug">{actionNotice.text}</span>
                {actionNotice.url && (
                  <a
                    href={actionNotice.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold shrink-0"
                  >
                    YouTube
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setActionNotice(null)}
                  className="text-white/70 hover:text-white font-bold px-1"
                  aria-label="Dismiss notice"
                >
                  ×
                </button>
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
                Release to exit Small Video
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
              <button
                type="button"
                onClick={() =>
                  onOpenCreator?.({
                    userId: currentShort.creator.id,
                    displayName: currentShort.creator.name,
                    username: currentShort.creator.username,
                    avatar: currentShort.creator.avatar,
                    source: currentShort.source,
                    channelId: currentShort.creator.id,
                  })
                }
                className="flex items-center gap-2 min-w-0 text-left hover:opacity-90 cursor-pointer"
              >
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
              </button>
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

            <div className="text-xs sm:text-sm text-white font-medium leading-snug">
              <CollapsibleDescription
                text={currentShort.caption || currentShort.title}
                minLengthToCollapse={65}
                className="text-xs sm:text-sm text-white font-medium leading-snug"
                buttonClassName="!text-[#D0AF72]"
                renderText={(val) => <FireRichText text={val} emojiSize="sm" />}
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-white/75">
              {isYouTube ? (
                <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                  <Youtube className="w-3.5 h-3.5" /> YouTube Small Video
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[#2B8A86] font-semibold">
                  <Shield className="w-3.5 h-3.5" /> MOTHERLAND Small Video
                </span>
              )}
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

        {/* Right Side Action Stack (Flame-inspired Action Boxes, inside mobile viewport bounds) */}
        <div
          className={`absolute right-2 sm:right-2.5 bottom-24 z-30 flex flex-col items-center gap-2.5 text-white transition-opacity duration-200 ${
            controlsVisible ? 'opacity-100' : 'opacity-80'
          }`}
        >
          <div className="hidden sm:flex flex-col gap-1 mb-1">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center disabled:opacity-30 hover:bg-white/20"
              aria-label="Previous Small Video"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={currentIndex >= items.length - 1 && !hasMoreShorts}
              className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center disabled:opacity-30 hover:bg-white/20"
              aria-label="Next Small Video"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => void toggleLike(false)}
              className={`w-11 h-11 rounded-2xl backdrop-blur-md flex items-center justify-center active:scale-90 transition-all ${
                isLiked
                  ? 'border border-orange-400/70 bg-orange-500/25 shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                  : 'border border-orange-500/30 bg-black/55 hover:border-orange-400/50 text-white'
              }`}
              aria-label="Fire Like small video"
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
                className={`w-11 h-11 rounded-2xl backdrop-blur-md flex items-center justify-center active:scale-90 transition-all ${
                  isDisliked
                    ? 'border border-orange-400/70 bg-orange-500/25 shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                    : 'border border-orange-500/30 bg-black/55 hover:border-orange-400/50 text-white'
                }`}
                aria-label="Dislike small video"
              >
                <FireDislikeIcon size={20} active={isDisliked} />
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
              className="w-11 h-11 rounded-2xl border border-orange-500/30 bg-black/55 hover:border-orange-400/50 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all"
              aria-label="Talk"
            >
              <TalkIcon size={20} />
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
              className={`w-11 h-11 rounded-2xl backdrop-blur-md flex items-center justify-center active:scale-90 transition-all ${
                isSaved
                  ? 'border border-orange-400/70 bg-orange-500/25 shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                  : 'border border-orange-500/30 bg-black/55 hover:border-orange-400/50 text-white'
              }`}
              aria-label="Vault small video"
            >
              <VaultIcon size={20} active={isSaved} />
            </button>
            <span className="text-[10px] font-semibold mt-0.5 drop-shadow">
              {isSaved ? 'Vaulted' : 'Vault'}
            </span>
          </div>

          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={handleShare}
              className="w-11 h-11 rounded-2xl border border-orange-500/30 bg-black/55 hover:border-orange-400/50 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all"
              aria-label="Boost small video"
            >
              {copiedId === currentShort.id ? (
                <Check className="w-5 h-5 text-orange-400" />
              ) : (
                <BoostIcon size={20} />
              )}
            </button>
            <span className="text-[10px] font-semibold mt-0.5 drop-shadow">
              {copiedId === currentShort.id ? 'Copied' : 'Boost'}
            </span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreMenuOpen((o) => !o)}
              className="w-11 h-11 rounded-2xl border border-orange-500/30 bg-black/55 hover:border-orange-400/50 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all"
              aria-label="More options"
            >
              <MoreVertical className="w-5 h-5" />
            </button>

            {moreMenuOpen && (
              <div className="absolute right-12 bottom-0 w-48 rounded-2xl ml-glass-elevated py-1.5 text-xs text-[var(--text-primary)] z-40">
                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = buildMotherlandVideoShareUrl({
                      id: currentShort.id,
                      youtubeId: currentShort.youtubeId,
                      source: currentShort.source,
                      isShort: true,
                    });
                    navigator.clipboard?.writeText(shareUrl);
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
