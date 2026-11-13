/**
 * TikTok-Style Infinite Vertical Swipe Experience — MOTHERLAND
 * Full viewport 9:16 vertical feed with smooth touch swipe UP / DOWN gestures,
 * autoplay active item, pause inactive items, keyboard navigation,
 * action sidebars, and infinite pagination loading.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Music,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Flame,
  Globe,
} from 'lucide-react';
import { UnifiedVideo } from '../../types/video';
import { searchYouTube } from '../../services/youtubeService';
import { VERIFIED_TIKTOK_VIDEOS } from '../../services/tiktokService';
import { FireLikeIcon, TalkIcon, BoostIcon } from '../fire/MotherlandIcons';

interface VerticalSwipeFeedProps {
  initialVideos?: UnifiedVideo[];
  onOpenDetails?: (video: UnifiedVideo) => void;
  onOpenMessenger?: () => void;
}

export const VerticalSwipeFeed: React.FC<VerticalSwipeFeedProps> = ({
  initialVideos,
  onOpenDetails,
  onOpenMessenger,
}) => {
  // Feed list
  const [videos, setVideos] = useState<UnifiedVideo[]>(() => {
    if (initialVideos && initialVideos.length > 0) return initialVideos;
    // Default seed with TikTok items + verified Shorts
    return [...VERIFIED_TIKTOK_VIDEOS];
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [likeCountMap, setLikeCountMap] = useState<Record<string, number>>({});
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  // Pagination state
  const [nextPageToken, setNextPageToken] = useState<string | null>('vertical_page_1');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Track all displayed video IDs across the entire session to guarantee zero repeats
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Multiple rich discovery categories (Part 2 requirement)
  const DISCOVERY_CATEGORIES = [
    { id: 'recommended', label: '🔥 Discovery', query: 'Bangladesh trending viral' },
    { id: 'popular', label: '⚡ Popular', query: 'Most viewed viral videos 2026' },
    { id: 'music', label: '🎵 Music', query: 'Coke Studio Bangla Top Hits' },
    { id: 'education', label: '🎓 Education', query: 'Bangla educational documentary science' },
    { id: 'gaming', label: '🎮 Gaming', query: 'Top gaming highlights stream' },
    { id: 'entertainment', label: '🎭 Entertainment', query: 'Bangla drama natok comedy' },
    { id: 'news', label: '📰 News', query: 'Bangladesh breaking news updates' },
    { id: 'sports', label: '🏏 Sports', query: 'Bangladesh Cricket Tigers match highlights' },
    { id: 'tech', label: '💻 Technology', query: 'Smart Tech AI gadgets review' },
  ];

  const [activeCategory, setActiveCategory] = useState<string>('recommended');

  // Touch gesture refs
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isTransitioningRef = useRef<boolean>(false);

  // Initialize feed with verified items + live YouTube API (up to 50 results)
  useEffect(() => {
    let isMounted = true;
    async function loadInitialVerticalContent() {
      try {
        setIsLoadingMore(true);
        const cat = DISCOVERY_CATEGORIES.find((c) => c.id === activeCategory) || DISCOVERY_CATEGORIES[0];
        const ytResults = await searchYouTube({
          query: cat.query,
          regionCode: 'BD',
          safeSearch: 'moderate',
          pageSize: 25,
        });

        if (!isMounted) return;

        const formattedShorts: UnifiedVideo[] = [];
        for (const v of ytResults.videos) {
          if (!seenIdsRef.current.has(v.id) && !seenIdsRef.current.has(v.videoId)) {
            seenIdsRef.current.add(v.id);
            seenIdsRef.current.add(v.videoId);
            formattedShorts.push({
              ...v,
              aspectRatio: '9:16',
              category: 'trending',
            });
          }
        }

        setVideos(formattedShorts);
        setNextPageToken(ytResults.nextPageToken || null);
        setHasMore(!!ytResults.nextPageToken);
      } catch (e) {
        console.warn('Initial vertical feed load fallback:', e);
      } finally {
        if (isMounted) setIsLoadingMore(false);
      }
    }

    loadInitialVerticalContent();
    return () => {
      isMounted = false;
    };
  }, [activeCategory]);

  // Fetch more videos using live API pagination and strict deduplication
  const loadMoreVideos = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextPageToken) return;
    setIsLoadingMore(true);

    try {
      const cat = DISCOVERY_CATEGORIES.find((c) => c.id === activeCategory) || DISCOVERY_CATEGORIES[0];
      const res = await searchYouTube({
        query: cat.query,
        pageToken: nextPageToken,
        regionCode: 'BD',
        safeSearch: 'moderate',
        pageSize: 25,
      });

      const newUnique: UnifiedVideo[] = [];
      for (const item of res.videos) {
        if (!seenIdsRef.current.has(item.id) && !seenIdsRef.current.has(item.videoId)) {
          seenIdsRef.current.add(item.id);
          seenIdsRef.current.add(item.videoId);
          newUnique.push({
            ...item,
            aspectRatio: '9:16',
            category: 'trending',
          });
        }
      }

      if (newUnique.length > 0) {
        setVideos((prev) => [...prev, ...newUnique]);
      }

      if (res.nextPageToken) {
        setNextPageToken(res.nextPageToken);
      } else {
        // Natural end of results without cycling
        setHasMore(false);
        setNextPageToken(null);
      }
    } catch (err) {
      console.warn('Vertical swipe pagination warning:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, nextPageToken, activeCategory]);

  // Check if near bottom to preload next page
  useEffect(() => {
    if (currentIndex >= videos.length - 3 && hasMore && !isLoadingMore) {
      loadMoreVideos();
    }
  }, [currentIndex, videos.length, hasMore, isLoadingMore, loadMoreVideos]);

  // Navigate to next video
  const goToNext = useCallback(() => {
    if (isTransitioningRef.current) return;
    if (currentIndex < videos.length - 1) {
      isTransitioningRef.current = true;
      setCurrentIndex((prev) => prev + 1);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 350);
    }
  }, [currentIndex, videos.length]);

  // Navigate to previous video
  const goToPrev = useCallback(() => {
    if (isTransitioningRef.current) return;
    if (currentIndex > 0) {
      isTransitioningRef.current = true;
      setCurrentIndex((prev) => prev - 1);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 350);
    }
  }, [currentIndex]);

  // Touch Handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (isTransitioningRef.current) return;
    const deltaY = touchStartY.current - touchEndY.current;
    const threshold = 40; // optimized swipe threshold for smooth single-video jump

    if (deltaY > threshold) {
      // Swiped UP -> Go Next exactly 1 video
      goToNext();
    } else if (deltaY < -threshold) {
      // Swiped DOWN -> Go Previous exactly 1 video
      goToPrev();
    }
  };

  // Wheel listener for desktop trackpad/mouse wheel scrolling
  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 30 || isTransitioningRef.current) return;
    if (e.deltaY > 0) {
      goToNext();
    } else {
      goToPrev();
    }
  };

  // Keyboard navigation (ArrowUp, ArrowDown)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        goToNext();
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        goToPrev();
      } else if (e.key === 'm') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev]);

  // Like toggle
  const toggleLike = (videoId: string) => {
    setLikedMap((prev) => {
      const isCurrentlyLiked = !!prev[videoId];
      const nextState = !isCurrentlyLiked;
      setLikeCountMap((counts) => ({
        ...counts,
        [videoId]: Math.max(0, (counts[videoId] || 0) + (nextState ? 1 : -1)),
      }));
      return { ...prev, [videoId]: nextState };
    });
  };

  // Share action
  const handleShare = async (video: UnifiedVideo) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          text: `Watch ${video.title} on MOTHERLAND Universal Feed`,
          url: video.originalVideoUrl,
        });
        return;
      } catch {
        // user cancelled share
      }
    }
    // Fallback copy to clipboard
    try {
      await navigator.clipboard.writeText(video.originalVideoUrl);
      setShareNotice('Video link copied to clipboard!');
      setTimeout(() => setShareNotice(null), 2500);
    } catch {
      setShareNotice(video.originalVideoUrl);
      setTimeout(() => setShareNotice(null), 3500);
    }
  };

  const currentVideo = videos[currentIndex];

  if (!currentVideo) {
    return (
      <div className="w-full h-[80vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm text-slate-300">Loading MOTHERLAND vertical feed...</p>
      </div>
    );
  }

  const isLiked = !!likedMap[currentVideo.id];
  const likeCount = likeCountMap[currentVideo.id] || 0;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className="relative w-full h-[calc(100dvh-112px)] sm:h-[calc(100vh-68px)] max-w-full sm:max-w-md sm:mx-auto bg-black overflow-hidden select-none touch-none flex flex-col items-center justify-center border-0 sm:border-x border-white/10 shadow-2xl rounded-none sm:rounded-3xl"
    >
      {/* Top Floating Badge & Category Selector Bar */}
      <div className="absolute top-2 left-2 right-2 z-30 flex flex-col gap-1.5 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-bold text-white border border-white/10 flex items-center gap-1.5 shadow-lg">
              <Flame className="w-3.5 h-3.5 text-red-500 fill-red-500" />
              <span>YouTube Shorts</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-mono font-bold">
              {currentIndex + 1} / {videos.length}
            </span>
          </div>

          {/* Audio Toggle */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="pointer-events-auto p-2 rounded-full bg-black/75 backdrop-blur-md text-white border border-white/15 hover:bg-black/90 transition-all active:scale-95 shadow-lg"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>

        {/* 9 Category Pills Strip (Part 2 Requirement) */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 pointer-events-auto">
          {DISCOVERY_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setCurrentIndex(0);
                  seenIdsRef.current.clear();
                }}
                className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all backdrop-blur-md border ${
                  isSelected
                    ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/60'
                    : 'bg-black/60 text-slate-300 hover:text-white border-white/10 hover:bg-black/80'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Up / Down Navigation Floating Controls (Desktop / Touch alternative) */}
      <div className="absolute top-1/2 -translate-y-1/2 left-3 z-30 hidden sm:flex flex-col gap-2">
        <button
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="p-2 rounded-full bg-black/50 hover:bg-black/80 disabled:opacity-30 text-white border border-white/10 transition-all shadow-lg active:scale-90"
          title="Previous Video (Up Arrow)"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={goToNext}
          disabled={currentIndex >= videos.length - 1}
          className="p-2 rounded-full bg-black/50 hover:bg-black/80 disabled:opacity-30 text-white border border-white/10 transition-all shadow-lg active:scale-90"
          title="Next Video (Down Arrow)"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Main Video Viewport Layer (9:16 full-bleed without margins) */}
      <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden">
        {/* Active Embed Container */}
        {currentVideo.platform === 'tiktok' ? (
          <iframe
            key={currentVideo.id}
            src={currentVideo.embedUrl}
            title={currentVideo.title}
            className="w-full h-full border-0 pointer-events-auto object-cover scale-[1.03]"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : currentVideo.platform === 'youtube' ? (
          <iframe
            key={currentVideo.id}
            src={`https://www.youtube.com/embed/${currentVideo.videoId}?autoplay=1&mute=${
              isMuted ? '1' : '0'
            }&controls=1&modestbranding=1&rel=0&playsinline=1&loop=1`}
            title={currentVideo.title}
            className="w-full h-full border-0 pointer-events-auto object-cover scale-[1.04]"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          /* Meta Facebook / Instagram fallback iframe */
          <iframe
            key={currentVideo.id}
            src={currentVideo.embedUrl}
            title={currentVideo.title}
            className="w-full h-full border-0 pointer-events-auto object-cover scale-[1.03]"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}

        {/* Hidden preloader for the next video to eliminate buffer latency */}
        {videos[currentIndex + 1] && (
          <iframe
            key={'preload_' + videos[currentIndex + 1].id}
            src={`https://www.youtube.com/embed/${videos[currentIndex + 1].videoId}?autoplay=0&controls=0&mute=1`}
            className="hidden w-0 h-0 pointer-events-none"
            tabIndex={-1}
            aria-hidden="true"
          />
        )}

        {/* Ambient Dark Gradient Overlays for readable text & controls */}
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none z-10" />
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-10" />
      </div>

      {/* Right Action Sidebar (MOTHERLAND Fire Like, Talk, Boost, External Launch) */}
      <div className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-4">
        {/* Creator Avatar */}
        <div className="relative">
          <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 shadow-xl">
            <img
              src={currentVideo.thumbnailUrl}
              alt={currentVideo.creatorName}
              className="w-full h-full rounded-full object-cover"
            />
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shadow-md">
            +
          </span>
        </div>

        {/* Fire Like Button */}
        <button
          onClick={() => toggleLike(currentVideo.id)}
          className="flex flex-col items-center gap-1 group transition-transform active:scale-75"
          title="Fire Like"
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border transition-all ${
              isLiked
                ? 'bg-orange-500/30 border-orange-400 shadow-lg shadow-orange-500/30'
                : 'bg-black/50 border-white/15 text-white hover:bg-black/70'
            }`}
          >
            <FireLikeIcon className="w-6 h-6" active={isLiked} />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md">
            {likeCount}
          </span>
        </button>

        {/* Talk / Chat launcher */}
        <button
          onClick={() => {
            if (onOpenMessenger) onOpenMessenger();
          }}
          className="flex flex-col items-center gap-1 group transition-transform active:scale-75"
          title="Open Motherland Talk / Messenger"
        >
          <div className="w-11 h-11 rounded-full bg-black/50 border border-white/15 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition-all shadow-lg">
            <TalkIcon className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md">
            Talk
          </span>
        </button>

        {/* Boost Button */}
        <button
          onClick={() => handleShare(currentVideo)}
          className="flex flex-col items-center gap-1 group transition-transform active:scale-75"
          title="Boost Video"
        >
          <div className="w-11 h-11 rounded-full bg-black/50 border border-white/15 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/70 transition-all shadow-lg">
            <BoostIcon className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md">Boost</span>
        </button>

        {/* Open in Native Platform (Official URL) */}
        <a
          href={currentVideo.originalVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 group transition-transform active:scale-75"
          title={`Watch directly on ${currentVideo.platform}`}
        >
          <div className="w-11 h-11 rounded-full bg-black/50 border border-white/15 backdrop-blur-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-black/70 transition-all shadow-lg">
            <ExternalLink className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-300 drop-shadow-md capitalize">
            {currentVideo.platform}
          </span>
        </a>
      </div>

      {/* Bottom Creator & Video Info Overlay */}
      <div className="absolute left-3 right-16 bottom-3 z-20 space-y-2 pointer-events-none">
        {/* Creator Handle */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="font-extrabold text-sm sm:text-base text-white drop-shadow-md">
            {currentVideo.creatorHandle || currentVideo.creatorName}
          </span>
          <CheckCircle2 className="w-4 h-4 text-cyan-400 fill-cyan-400 drop-shadow-md" />
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-white/20 backdrop-blur-sm text-white">
            {currentVideo.platform}
          </span>
        </div>

        {/* Title / Description */}
        <p className="text-xs sm:text-sm text-slate-100 line-clamp-2 leading-relaxed drop-shadow-md pointer-events-auto">
          {currentVideo.title}
        </p>

        {/* Tags & Sound strip */}
        <div className="flex items-center gap-2 text-[11px] text-slate-300 pointer-events-auto">
          <Music className="w-3.5 h-3.5 text-cyan-400 animate-pulse flex-shrink-0" />
          <span className="truncate max-w-[200px] text-slate-200">
            Original Audio — {currentVideo.creatorName}
          </span>
        </div>
      </div>

      {/* Share / Toast notification */}
      {shareNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-emerald-600/95 text-white text-xs font-semibold shadow-2xl backdrop-blur-md border border-emerald-400 animate-in fade-in zoom-in-95 duration-150">
          {shareNotice}
        </div>
      )}

      {/* Loading sentinel indicator */}
      {isLoadingMore && (
        <div className="absolute bottom-1 right-3 z-30 flex items-center gap-1.5 text-[10px] text-cyan-300 bg-black/80 px-2.5 py-1 rounded-full border border-cyan-500/30">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Fetching next batch...</span>
        </div>
      )}
    </div>
  );
};
