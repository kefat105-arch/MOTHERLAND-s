/**
 * Dedicated YouTube Shorts Vertical Swipe Feed for MOTHERLAND YouTube
 * - True 9:16 vertical viewport
 * - Natural finger swipe navigation (Swipe UP -> Next Short, Swipe DOWN -> Previous Short)
 * - Touch action & gesture threshold handling (prevents accidental triggers during control interactions)
 * - Keyboard (ArrowUp / ArrowDown) and Wheel support
 * - Dynamic infinite pagination from YouTube Data API v3
 * - Official YouTube IFrame player with sound and like/comment/share interactions
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Loader2,
  Music2,
  CheckCircle2,
  Disc3,
  X,
  Send,
} from 'lucide-react';
import { UnifiedVideo } from '../../types/video';
import { api } from '../../api';
import {
  filterUnsuppressed,
  recordWatchedSuppression,
  recordShownFeedIds,
  WATCH_SUPPRESSED_EVENT,
} from '../../services/watchSuppression';
import { FireLikeIcon, FireDislikeIcon, TalkIcon, BoostIcon } from '../fire/MotherlandIcons';
import { FireEmojiPicker } from '../fire/FireEmojiPicker';
import { FireRichText } from '../fire/FireRichText';
import { FireDraftPreview, FirePickerTrigger } from '../fire/FireComposerBar';
import { CollapsibleDescription } from '../common/ExpandableTranslatableText';
import { VideoBrandOverlay } from '../common/VideoBrandOverlay';
import {
  buildYouTubeEmbedUrl,
  sendYTCommand,
  registerYTListeningHandshake,
  parseYTInfoMessage,
  recordVideoSwitchMetric,
} from '../../utils/youtubePlayerBridge';
import { buildMotherlandVideoShareUrl, warmVideoThumbnail } from '../../utils/videoShareLinks';

interface YouTubeShortsFeedProps {
  onBackToHome?: () => void;
  onOpenDetails?: (video: UnifiedVideo) => void;
  refreshSignal?: number;
}

export const YouTubeShortsFeed: React.FC<YouTubeShortsFeedProps> = ({
  onBackToHome,
  onOpenDetails,
  refreshSignal = 0,
}) => {
  const [shorts, setShorts] = useState<UnifiedVideo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({});
  const [dislikedMap, setDislikedMap] = useState<Record<string, boolean>>({});
  const [subscribedMap, setSubscribedMap] = useState<Record<string, boolean>>({});
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentList, setCommentList] = useState<Array<{ id: string; user: string; text: string; time: string }>>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsNotice, setCommentsNotice] = useState('');
  const [newComment, setNewComment] = useState('');
  const [firePickerOpen, setFirePickerOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Gesture handling refs
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const shortsAbortRef = useRef<AbortController | null>(null);

  // 2-Slot Pooled YouTube IFrames for instant zero-black-screen swipe transitions
  const [ytFrameReady, setYtFrameReady] = useState(false);
  const [ytBuffering, setYtBuffering] = useState(true);
  const [ytSlotUrls, setYtSlotUrls] = useState<[string, string]>(['', '']);
  const ytSlotRefs = useRef<[HTMLIFrameElement | null, HTMLIFrameElement | null]>([null, null]);
  const ytSlotInitialSrcRef = useRef<[string, string]>(['', '']);
  const ytSlotBoundIdRef = useRef<[string, string]>(['', '']);
  const ytSlotReadyIdRef = useRef<[string, string]>(['', '']);
  const switchStartMsRef = useRef<number>(performance.now());
  const metricLoggedIdRef = useRef<string>('');

  const mapFeedItemToShort = (item: any): UnifiedVideo | null => {
    if (typeof item.durationSeconds !== 'number' || item.durationSeconds <= 0 || item.durationSeconds > 180) {
      return null;
    }
    const videoId = String(item.youtubeId || item.id || '').trim();
    if (!videoId) return null;
    return {
      id: item.id || `yt_${videoId}`,
      platform: 'youtube',
      videoId,
      title: item.title || 'YouTube Short',
      creatorName: item.channel?.title || 'Creator',
      creatorAvatar: item.channel?.avatar || '',
      originalVideoUrl: `https://youtube.com/shorts/${videoId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
      thumbnailUrl: item.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: item.duration || '',
      publishedAt: item.publishedAt,
      playbackAvailability: 'playable_embed',
      aspectRatio: '9:16',
      description: item.description,
      sourceMetadata: {
        isOfficialEmbed: true,
        likes: item.stats?.likes ?? 0,
        comments: item.stats?.comments ?? 0,
      },
    };
  };

  // Load YouTube Shorts fresh from backend strict-duration Shorts feed (chained multi-page retry if first batch is heavily suppressed)
  const loadInitialShorts = useCallback(async () => {
    shortsAbortRef.current?.abort();
    const controller = new AbortController();
    shortsAbortRef.current = controller;

    setInitialLoading(true);
    try {
      let curToken: string | undefined = undefined;
      let curPage = 1;
      let keepTrying = true;
      const accumulated: UnifiedVideo[] = [];
      const initialLikes: Record<string, number> = {};
      let attempts = 0;

      while (attempts < 3 && keepTrying && accumulated.length < 4 && !controller.signal.aborted) {
        attempts++;
        const res = await api.getYouTubeFeed({
          type: 'shorts',
          category: 'shorts',
          page: curPage,
          pageToken: curToken,
          pageSize: 16,
          signal: controller.signal,
        });

        for (const item of res.items || []) {
          const mapped = mapFeedItemToShort(item);
          if (!mapped) continue;
          if (!seenIdsRef.current.has(mapped.id) && !seenIdsRef.current.has(mapped.videoId)) {
            seenIdsRef.current.add(mapped.id);
            seenIdsRef.current.add(mapped.videoId);
            const cleanBatch = filterUnsuppressed([mapped]);
            if (cleanBatch.length > 0) {
              accumulated.push(mapped);
              initialLikes[mapped.videoId] = Number(item.stats?.likes ?? 0);
            }
          }
        }

        curToken = res.nextPageToken || undefined;
        keepTrying = Boolean(curToken) || (res as any).hasMore !== false;
        curPage++;
        if (!curToken) break;
      }

      if (controller.signal.aborted) return;

      setShorts(accumulated);
      setLikeCountMap(initialLikes);
      setCurrentIndex(0);
      setPage(Math.max(1, curPage - 1));
      setNextPageToken(curToken);
      setHasMore(keepTrying);
      recordShownFeedIds('shorts', accumulated.map((s) => s.videoId));
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Failed loading initial shorts:', err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setInitialLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    seenIdsRef.current.clear();
    loadInitialShorts();
    return () => {
      shortsAbortRef.current?.abort();
    };
  }, [refreshSignal, loadInitialShorts]);

  // Listen for live watch suppression events
  useEffect(() => {
    const onSuppressed = () => {
      setShorts((prev) => filterUnsuppressed(prev));
    };
    window.addEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
    return () => window.removeEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
  }, []);

  // Track 4s genuine Short watch for 7-day suppression + preload next 3 Short thumbnails
  const activeShortForTrack = shorts[currentIndex];
  const nextShortForPreload = shorts[currentIndex + 1];
  const activeYtSlot = (currentIndex % 2) as 0 | 1;
  const preloadYtSlot = ((currentIndex + 1) % 2) as 0 | 1;

  useEffect(() => {
    if (!activeShortForTrack) return;
    [shorts[currentIndex + 1], shorts[currentIndex + 2], shorts[currentIndex + 3]].forEach((upcoming) => {
      if (upcoming?.thumbnailUrl) warmVideoThumbnail(upcoming.thumbnailUrl);
    });
    const timer = window.setTimeout(() => {
      if (isPlaying) {
        recordWatchedSuppression(activeShortForTrack.id, activeShortForTrack.videoId);
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [activeShortForTrack?.id, currentIndex, isPlaying, shorts]);

  // Manage 2-Slot Pooled YouTube Shorts switching & next-video cueing
  useEffect(() => {
    if (!activeShortForTrack?.videoId) return;
    switchStartMsRef.current = performance.now();
    metricLoggedIdRef.current = '';

    const activeId = activeShortForTrack.videoId;
    const isPreCued = ytSlotReadyIdRef.current[activeYtSlot] === activeId;
    setYtFrameReady(isPreCued);
    setYtBuffering(!isPreCued);

    if (!ytSlotInitialSrcRef.current[activeYtSlot]) {
      const url = buildYouTubeEmbedUrl(activeId, {
        autoplay: true,
        controls: false,
        loop: true,
        mute: isMuted,
        nocookie: true,
      });
      ytSlotInitialSrcRef.current[activeYtSlot] = url;
      ytSlotBoundIdRef.current[activeYtSlot] = activeId;
      setYtSlotUrls((prev) => {
        const copy: [string, string] = [...prev] as [string, string];
        copy[activeYtSlot] = url;
        return copy;
      });
    } else {
      const frame = ytSlotRefs.current[activeYtSlot];
      if (ytSlotBoundIdRef.current[activeYtSlot] === activeId) {
        sendYTCommand(frame, 'seekTo', [0, true]);
        sendYTCommand(frame, isMuted ? 'mute' : 'unMute');
        sendYTCommand(frame, 'playVideo');
      } else {
        ytSlotBoundIdRef.current[activeYtSlot] = activeId;
        ytSlotReadyIdRef.current[activeYtSlot] = '';
        sendYTCommand(frame, 'loadVideoById', [{ videoId: activeId, startSeconds: 0 }]);
        sendYTCommand(frame, isMuted ? 'mute' : 'unMute');
      }
    }

    // Pause inactive slot immediately
    if (ytSlotRefs.current[preloadYtSlot]) {
      sendYTCommand(ytSlotRefs.current[preloadYtSlot], 'pauseVideo');
      sendYTCommand(ytSlotRefs.current[preloadYtSlot], 'mute');
    }

    const cueTimer = window.setTimeout(() => {
      const nextId = nextShortForPreload?.videoId;
      if (!nextId) return;
      if (!ytSlotInitialSrcRef.current[preloadYtSlot]) {
        const url = buildYouTubeEmbedUrl(nextId, {
          autoplay: false,
          controls: false,
          loop: true,
          mute: true,
          nocookie: true,
        });
        ytSlotInitialSrcRef.current[preloadYtSlot] = url;
        ytSlotBoundIdRef.current[preloadYtSlot] = nextId;
        setYtSlotUrls((prev) => {
          const copy: [string, string] = [...prev] as [string, string];
          copy[preloadYtSlot] = url;
          return copy;
        });
      } else if (ytSlotBoundIdRef.current[preloadYtSlot] !== nextId) {
        ytSlotBoundIdRef.current[preloadYtSlot] = nextId;
        ytSlotReadyIdRef.current[preloadYtSlot] = '';
        sendYTCommand(ytSlotRefs.current[preloadYtSlot], 'mute');
        sendYTCommand(ytSlotRefs.current[preloadYtSlot], 'cueVideoById', [{ videoId: nextId, startSeconds: 0 }]);
      }
    }, 240);

    const revealTimer = window.setTimeout(() => {
      setYtFrameReady(true);
      setYtBuffering(false);
    }, 1800);

    return () => {
      window.clearTimeout(cueTimer);
      window.clearTimeout(revealTimer);
    };
  }, [activeShortForTrack?.videoId, nextShortForPreload?.videoId, activeYtSlot, preloadYtSlot]);

  // Sync play/pause & mute directly to active slot iframe via postMessage
  useEffect(() => {
    if (!activeShortForTrack?.videoId) return;
    sendYTCommand(ytSlotRefs.current[activeYtSlot], isPlaying ? 'playVideo' : 'pauseVideo');
    if (!isPlaying) setYtBuffering(false);
  }, [isPlaying, activeYtSlot, activeShortForTrack?.videoId]);

  useEffect(() => {
    if (!activeShortForTrack?.videoId) return;
    sendYTCommand(ytSlotRefs.current[activeYtSlot], isMuted ? 'mute' : 'unMute');
  }, [isMuted, activeYtSlot, activeShortForTrack?.videoId]);

  // Listen to per-slot YouTube player messages
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const activeFrame = ytSlotRefs.current[activeYtSlot];
      const activeParsed = activeFrame ? parseYTInfoMessage(event, activeFrame) : null;
      if (activeParsed) {
        const expectedId = activeShortForTrack?.videoId;
        if (!activeParsed.videoId || !expectedId || activeParsed.videoId === expectedId) {
          if (typeof activeParsed.playerState === 'number') {
            if (activeParsed.playerState === 1) {
              setIsPlaying(true);
              setYtBuffering(false);
              setYtFrameReady(true);
              if (expectedId) ytSlotReadyIdRef.current[activeYtSlot] = expectedId;
              if (expectedId && metricLoggedIdRef.current !== expectedId) {
                metricLoggedIdRef.current = expectedId;
                recordVideoSwitchMetric({
                  player: 'yt_shorts',
                  videoId: expectedId,
                  reusedPlayer: currentIndex > 0,
                  startupMs: Math.round(performance.now() - switchStartMsRef.current),
                });
              }
            } else if (activeParsed.playerState === 2) {
              setIsPlaying(false);
              setYtBuffering(false);
              setYtFrameReady(true);
            } else if (activeParsed.playerState === 3) {
              setYtBuffering(true);
            } else if (activeParsed.playerState === 5 && expectedId) {
              ytSlotReadyIdRef.current[activeYtSlot] = expectedId;
            }
          }
          if (typeof activeParsed.muted === 'boolean') setIsMuted(activeParsed.muted);
        }
        return;
      }

      const preloadFrame = ytSlotRefs.current[preloadYtSlot];
      const preloadParsed = preloadFrame ? parseYTInfoMessage(event, preloadFrame) : null;
      if (preloadParsed && preloadParsed.playerState === 5 && nextShortForPreload?.videoId) {
        if (!preloadParsed.videoId || preloadParsed.videoId === nextShortForPreload.videoId) {
          ytSlotReadyIdRef.current[preloadYtSlot] = nextShortForPreload.videoId;
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [activeYtSlot, preloadYtSlot, currentIndex, activeShortForTrack?.videoId, nextShortForPreload?.videoId]);

  // Fetch more shorts when approaching end of list
  const fetchMoreShorts = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const controller = new AbortController();

    try {
      const nextPage = page + 1;
      const res = await api.getYouTubeFeed({
        type: 'shorts',
        category: 'shorts',
        pageToken: nextPageToken || undefined,
        page: nextPage,
        pageSize: 16,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      const newShorts: UnifiedVideo[] = [];
      const extraLikes: Record<string, number> = {};
      for (const item of res.items || []) {
        const mapped = mapFeedItemToShort(item);
        if (!mapped) continue;
        if (!seenIdsRef.current.has(mapped.id) && !seenIdsRef.current.has(mapped.videoId)) {
          seenIdsRef.current.add(mapped.id);
          seenIdsRef.current.add(mapped.videoId);
          newShorts.push(mapped);
          extraLikes[mapped.videoId] = Number(item.stats?.likes ?? 0);
        }
      }

      const unsuppressedNew = filterUnsuppressed(newShorts);
      if (unsuppressedNew.length > 0) {
        setShorts((prev) => [...prev, ...unsuppressedNew]);
        setLikeCountMap((prev) => ({ ...extraLikes, ...prev }));
        recordShownFeedIds('shorts', unsuppressedNew.map((s) => s.videoId));
      }
      setPage(nextPage);
      setNextPageToken(res.nextPageToken || undefined);
      if (!res.nextPageToken && (res as any).hasMore === false) {
        setHasMore(false);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Pagination load shorts error:', err);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, nextPageToken, page]);

  // Navigate to next short
  const goToNextShort = useCallback(() => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsPlaying(true);
      // Pre-fetch more when 4 items remain
      if (currentIndex >= shorts.length - 4) {
        fetchMoreShorts();
      }
    }
  }, [currentIndex, shorts.length, fetchMoreShorts]);

  // Navigate to previous short
  const goToPreviousShort = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsPlaying(true);
    }
  }, [currentIndex]);

  // Natural Touch Gestures (Swipe UP / DOWN)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    isSwipingRef.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!isSwipingRef.current) return;
    isSwipingRef.current = false;

    const deltaY = touchStartY.current - touchEndY.current;
    const deltaX = touchStartX.current - touchEndX.current;

    // Ensure vertical gesture dominates horizontal gesture
    if (Math.abs(deltaY) > 50 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
      if (deltaY > 0) {
        // Swiped UP -> Next Short
        goToNextShort();
      } else {
        // Swiped DOWN -> Previous Short
        goToPreviousShort();
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goToNextShort();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goToPreviousShort();
      } else if (e.key === ' ' && !commentsOpen) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextShort, goToPreviousShort, commentsOpen]);

  // Wheel gesture for desktop
  const lastWheelTime = useRef<number>(0);
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 400) return; // Debounce wheel
    if (Math.abs(e.deltaY) > 30) {
      lastWheelTime.current = now;
      if (e.deltaY > 0) {
        goToNextShort();
      } else {
        goToPreviousShort();
      }
    }
  };

  const activeShort = shorts[currentIndex];

  const openRealComments = async () => {
    setCommentsOpen(true);
    if (!activeShort?.videoId) return;
    setCommentsLoading(true);
    setCommentsNotice('');
    setCommentList([]);
    try {
      const res = await api.getYouTubeComments(activeShort.videoId);
      if (res.commentsDisabled) {
        setCommentsNotice(res.message || 'Comments are turned off for this video.');
      } else {
        setCommentList(
          (res.items || []).map((c) => ({
            id: c.id,
            user: c.authorDisplayName || 'YouTube User',
            text: c.textDisplay || '',
            time: c.publishedAt ? new Date(c.publishedAt).toLocaleDateString() : '',
          }))
        );
      }
    } catch {
      setCommentsNotice('Could not load YouTube comments.');
    } finally {
      setCommentsLoading(false);
    }
  };

  const toggleLike = (id: string) => {
    const isLiked = !!likedMap[id];
    setLikedMap((prev) => ({ ...prev, [id]: !isLiked }));
    setLikeCountMap((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + (isLiked ? -1 : 1)),
    }));
    if (dislikedMap[id]) {
      setDislikedMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleDislike = (id: string) => {
    setDislikedMap((prev) => ({ ...prev, [id]: !prev[id] }));
    if (likedMap[id]) {
      setLikedMap((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleSubscribe = (channel: string) => {
    setSubscribedMap((prev) => ({ ...prev, [channel]: !prev[channel] }));
  };

  const handleShare = async () => {
    if (!activeShort) return;
    const shareUrl = buildMotherlandVideoShareUrl({
      id: activeShort.id,
      youtubeId: activeShort.videoId,
      source: 'youtube',
      isShort: true,
    });
    if (navigator.share) {
      try {
        await navigator.share({ title: activeShort.title, url: shareUrl });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    navigator.clipboard.writeText(shareUrl);
    setShareNotice('MOTHERLAND link copied to clipboard!');
    setTimeout(() => setShareNotice(null), 2500);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommentsNotice('Posting public comments on YouTube videos requires Google OAuth channel authentication on YouTube.');
    setNewComment('');
  };

  if (initialLoading) {
    return (
      <div className="w-full h-[80vh] flex flex-col items-center justify-center gap-3 text-slate-300">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
        <span className="text-sm font-semibold">Loading YouTube Shorts feed...</span>
      </div>
    );
  }

  if (!activeShort) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-400 px-4 text-center">
        <Sparkles className="w-8 h-8 text-red-500" />
        <p className="text-sm font-semibold text-white">No unseen Shorts available in this batch.</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              seenIdsRef.current.clear();
              void loadInitialShorts();
            }}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-xs"
          >
            Load Fresh Shorts
          </button>
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs"
            >
              Return to YouTube Home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full max-w-md mx-auto h-[calc(100dvh-130px)] sm:h-[800px] max-h-[860px] bg-black rounded-none sm:rounded-3xl overflow-hidden shadow-2xl select-none flex flex-col justify-between border-0 sm:border border-white/10"
      style={{ touchAction: 'pan-y' }}
    >
      {/* 2-Slot Pre-Warmed Short Video Player Stage (Instant Swipe · Zero Black-Screen) */}
      <div className="absolute inset-0 w-full h-full bg-black z-0 flex items-center justify-center overflow-hidden">
        {([0, 1] as const).map((slot) => {
          const isActive = slot === activeYtSlot;
          const slotShort = isActive ? activeShort : nextShortForPreload;
          return (
            <div
              key={`yt-feed-slot-${slot}`}
              className={`absolute inset-0 w-full h-full ${
                isActive ? 'z-[2] opacity-100' : 'z-0 opacity-0 pointer-events-none'
              }`}
            >
              {ytSlotUrls[slot] && (
                <iframe
                  ref={(el) => {
                    ytSlotRefs.current[slot] = el;
                  }}
                  src={ytSlotUrls[slot]}
                  onLoad={() => {
                    registerYTListeningHandshake(ytSlotRefs.current[slot], slot + 10);
                    if (
                      slotShort?.videoId &&
                      ytSlotBoundIdRef.current[slot] &&
                      ytSlotBoundIdRef.current[slot] !== slotShort.videoId
                    ) {
                      ytSlotBoundIdRef.current[slot] = slotShort.videoId;
                      sendYTCommand(
                        ytSlotRefs.current[slot],
                        isActive ? 'loadVideoById' : 'cueVideoById',
                        [{ videoId: slotShort.videoId, startSeconds: 0 }]
                      );
                    }
                  }}
                  title={slotShort?.title || 'YouTube Short'}
                  className="w-full h-full object-cover scale-[1.02] pointer-events-none border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          );
        })}

        {/* Crisp Thumbnail Transition Layer until Active Video Confirms First Frame */}
        {activeShort.thumbnailUrl && (
          <img
            src={activeShort.thumbnailUrl}
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 z-[5] w-full h-full object-cover pointer-events-none transition-opacity duration-200 ${
              ytFrameReady ? 'opacity-0' : 'opacity-95'
            }`}
          />
        )}

        {/* Click-to-Play/Pause Overlay + Branded Paused/Buffering Original Logo Overlay */}
        <div
          onClick={() => setIsPlaying((p) => !p)}
          className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center bg-transparent"
        >
          <VideoBrandOverlay
            mode={isPlaying && ytBuffering ? 'buffering' : 'paused'}
            visible={!isPlaying || (isPlaying && ytBuffering && !ytFrameReady)}
          />
        </div>
      </div>

      {/* Top Overlay: Category / Volume / Counter */}
      <div className="relative z-20 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md">
            Shorts
          </span>
          <span className="text-[11px] font-mono text-slate-300 drop-shadow-md">
            {currentIndex + 1} / {shorts.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-white border border-white/20 transition-all shadow-md active:scale-95"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <a
            href={activeShort.originalVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-slate-300 hover:text-white border border-white/20 transition-all shadow-md"
            title="Open on official YouTube"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Right Interaction Sidebar (Thumbnails, Fire Like, Dislikes, Talk, Boost) */}
      <div className="relative z-20 self-end pr-2.5 sm:pr-4 flex flex-col items-center gap-4 mb-20 sm:mb-24">
        {/* Fire Like Button */}
        <button
          onClick={() => toggleLike(activeShort.videoId)}
          className="flex flex-col items-center gap-1 group"
          title="Fire Like"
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-lg active:scale-90 ${
              likedMap[activeShort.videoId]
                ? 'bg-orange-500/35 border border-orange-400 shadow-orange-900/60'
                : 'bg-black/50 hover:bg-black/70 text-white border border-white/20'
            }`}
          >
            <FireLikeIcon className="w-6 h-6" active={Boolean(likedMap[activeShort.videoId])} />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md tabular-nums">
            {(likeCountMap[activeShort.videoId] ?? 0).toLocaleString()}
          </span>
        </button>

        {/* Dislike Button */}
        <button
          onClick={() => toggleDislike(activeShort.videoId)}
          className="flex flex-col items-center gap-1 group"
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-lg active:scale-90 ${
              dislikedMap[activeShort.videoId]
                ? 'bg-orange-500/35 border border-orange-400 text-white'
                : 'bg-black/50 hover:bg-black/70 text-white border border-white/20'
            }`}
          >
            <FireDislikeIcon className="w-5 h-5" active={Boolean(dislikedMap[activeShort.videoId])} />
          </div>
          <span className="text-[10px] font-semibold text-slate-300 drop-shadow-md">Dislike</span>
        </button>

        {/* Talk (Comments) Button */}
        <button
          onClick={openRealComments}
          className="flex flex-col items-center gap-1 group"
          title="Talk"
        >
          <div className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center backdrop-blur-md transition-all shadow-lg active:scale-90">
            <TalkIcon className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md tabular-nums">
            {Number(activeShort.sourceMetadata?.comments ?? commentList.length).toLocaleString()}
          </span>
        </button>

        {/* Boost (Share) Button */}
        <button onClick={handleShare} className="flex flex-col items-center gap-1 group" title="Boost">
          <div className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center backdrop-blur-md transition-all shadow-lg active:scale-90">
            <BoostIcon className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-semibold text-white drop-shadow-md">Boost</span>
        </button>

        {/* Spinning Vinyl Disc / Music Track */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 border-2 border-white/40 flex items-center justify-center shadow-lg animate-spin" style={{ animationDuration: '4s' }}>
          <Disc3 className="w-6 h-6 text-red-500" />
        </div>
      </div>

      {/* Bottom Overlay: Creator info, Title, Audio tag, Up/Down helper controls */}
      <div className="relative z-20 p-3 sm:p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-2">
        {/* Creator Channel Strip & Support Button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-md">
              {activeShort.creatorName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-sm text-white truncate block drop-shadow-md">
                @{activeShort.creatorName.replace(/\s+/g, '')}
              </span>
            </div>
          </div>

          <button
            onClick={() => toggleSubscribe(activeShort.creatorName)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-md active:scale-95 flex-shrink-0 ${
              subscribedMap[activeShort.creatorName]
                ? 'bg-white/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-white text-black hover:bg-slate-200'
            }`}
          >
            {subscribedMap[activeShort.creatorName] ? 'Supporting' : 'Support'}
          </button>
        </div>

        {/* Video Title / Description (1-line collapsed + See More + Auto-Translate) */}
        <CollapsibleDescription
          text={activeShort.description || activeShort.title}
          minLengthToCollapse={65}
          className="text-xs sm:text-sm text-white font-medium drop-shadow-md leading-snug"
          buttonClassName="!text-red-400"
        />

        {/* Audio Track Tag */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 overflow-hidden">
          <Music2 className="w-3.5 h-3.5 text-red-400 flex-shrink-0 animate-pulse" />
          <span className="truncate">Original Sound • {activeShort.creatorName}</span>
        </div>

        {/* Navigation Buttons */}
        <div className="pt-2 flex items-center justify-between text-slate-400 border-t border-white/10">
          <span className="text-[10px] font-mono flex items-center gap-1 text-slate-400">
            <span>YouTube Shorts</span>
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousShort}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 disabled:opacity-30 text-white"
              title="Previous Short"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={goToNextShort}
              disabled={currentIndex >= shorts.length - 1 && !hasMore}
              className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 disabled:opacity-30 text-white"
              title="Next Short"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Share Toast */}
      {shareNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-white/20 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{shareNotice}</span>
        </div>
      )}

      {/* Talk Drawer / Bottom Sheet */}
      {commentsOpen && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in slide-in-from-bottom duration-200">
          <div className="w-full bg-[#111728] rounded-t-3xl border-t border-white/15 p-4 max-h-[70%] flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-bold text-sm text-white flex items-center gap-2">
                <TalkIcon className="w-4 h-4" active />
                <span>Talk ({commentList.length})</span>
              </span>
              <button
                onClick={() => setCommentsOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
              {commentsNotice && (
                <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-400/25 rounded-xl p-2.5">
                  {commentsNotice}
                </p>
              )}
              {commentsLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
                </div>
              ) : commentList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No comments loaded yet.</p>
              ) : (
                commentList.map((c) => (
                  <div key={c.id} className="text-xs space-y-0.5">
                    <div className="flex items-center justify-between text-slate-400 text-[10px]">
                      <span className="font-bold text-white">{c.user}</span>
                      <span>{c.time}</span>
                    </div>
                    <p className="text-slate-200">
                      <FireRichText text={c.text} emojiSize="sm" />
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Composer */}
            <form onSubmit={handleAddComment} className="pt-2 border-t border-white/10 space-y-1.5">
              <FireDraftPreview value={newComment} />
              <div className="flex items-center gap-2">
                <FirePickerTrigger
                  size="sm"
                  onClick={() => setFirePickerOpen(true)}
                  active={firePickerOpen}
                  title="Insert Fire Emoji"
                />
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a talk on this Short..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="p-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FireEmojiPicker
        isOpen={firePickerOpen}
        onClose={() => setFirePickerOpen(false)}
        onSelect={(emoji) => {
          setNewComment((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${emoji.token} `);
        }}
      />
    </div>
  );
};
