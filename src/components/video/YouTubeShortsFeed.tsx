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
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Share2,
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
import { searchYouTube } from '../../services/youtubeService';

interface YouTubeShortsFeedProps {
  onBackToHome?: () => void;
  onOpenDetails?: (video: UnifiedVideo) => void;
}

export const YouTubeShortsFeed: React.FC<YouTubeShortsFeedProps> = ({
  onBackToHome,
  onOpenDetails,
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
  const [commentList, setCommentList] = useState<Array<{ id: string; user: string; text: string; time: string }>>([
    { id: 'c1', user: 'Tanvir Hossain', text: 'This Short is super creative! Love the edit 🔥', time: '2h ago' },
    { id: 'c2', user: 'Sadia Rahman', text: 'Watching on Motherland Super App, great quality! 🇧🇩', time: '5h ago' },
  ]);
  const [newComment, setNewComment] = useState('');

  // Pagination
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
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

  // Load initial YouTube Shorts
  useEffect(() => {
    let active = true;
    async function loadShorts() {
      setInitialLoading(true);
      try {
        const res = await searchYouTube({
          query: 'Bangladesh shorts viral comedy trending 2026',
          regionCode: 'BD',
          safeSearch: 'none',
          pageSize: 24,
        });

        if (!active) return;
        const validShorts: UnifiedVideo[] = [];
        for (const v of res.videos) {
          if (!seenIdsRef.current.has(v.id) && !seenIdsRef.current.has(v.videoId)) {
            seenIdsRef.current.add(v.id);
            seenIdsRef.current.add(v.videoId);
            validShorts.push({
              ...v,
              aspectRatio: '9:16',
            });
          }
        }

        setShorts(validShorts);
        setNextPageToken(res.nextPageToken);
      } catch (err) {
        console.warn('Failed loading initial shorts:', err);
      } finally {
        if (active) setInitialLoading(false);
      }
    }

    loadShorts();
    return () => {
      active = false;
    };
  }, []);

  // Fetch more shorts when approaching end of list
  const fetchMoreShorts = useCallback(async () => {
    if (isLoadingMore || !nextPageToken) return;
    setIsLoadingMore(true);

    try {
      const res = await searchYouTube({
        query: 'Bangladesh shorts viral comedy music 2026',
        pageToken: nextPageToken,
        regionCode: 'BD',
        safeSearch: 'none',
        pageSize: 24,
      });

      const newShorts: UnifiedVideo[] = [];
      for (const v of res.videos) {
        if (!seenIdsRef.current.has(v.id) && !seenIdsRef.current.has(v.videoId)) {
          seenIdsRef.current.add(v.id);
          seenIdsRef.current.add(v.videoId);
          newShorts.push({
            ...v,
            aspectRatio: '9:16',
          });
        }
      }

      setShorts((prev) => [...prev, ...newShorts]);
      setNextPageToken(res.nextPageToken);
    } catch (err) {
      console.warn('Pagination load shorts error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextPageToken]);

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

  const toggleLike = (id: string) => {
    const isLiked = !!likedMap[id];
    setLikedMap((prev) => ({ ...prev, [id]: !isLiked }));
    setLikeCountMap((prev) => ({
      ...prev,
      [id]: (prev[id] || 1200) + (isLiked ? -1 : 1),
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

  const handleShare = () => {
    if (!activeShort) return;
    navigator.clipboard.writeText(activeShort.originalVideoUrl);
    setShareNotice('Short link copied to clipboard!');
    setTimeout(() => setShareNotice(null), 2500);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setCommentList((prev) => [
      { id: 'c_' + Date.now(), user: 'You (Motherland)', text: newComment.trim(), time: 'Just now' },
      ...prev,
    ]);
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
      <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Sparkles className="w-8 h-8 text-red-500" />
        <p className="text-sm font-semibold">No YouTube Shorts available right now.</p>
        <button
          onClick={onBackToHome}
          className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs"
        >
          Return to YouTube Home
        </button>
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
      {/* Active Short Video Player (Full 9:16 Area) */}
      <div className="absolute inset-0 w-full h-full bg-black z-0 flex items-center justify-center overflow-hidden">
        <iframe
          key={activeShort.videoId}
          src={`https://www.youtube-nocookie.com/embed/${activeShort.videoId}?autoplay=1&mute=${
            isMuted ? '1' : '0'
          }&controls=0&loop=1&playlist=${activeShort.videoId}&modestbranding=1&rel=0&playsinline=1`}
          title={activeShort.title}
          className="w-full h-full object-cover scale-[1.02] pointer-events-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />

        {/* Click-to-Play/Pause & Sound Tap Overlay */}
        <div
          onClick={() => setIsPlaying(!isPlaying)}
          className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center bg-transparent"
        >
          {!isPlaying && (
            <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white shadow-xl animate-in zoom-in-75">
              <Play className="w-8 h-8 fill-white ml-1" />
            </div>
          )}
        </div>
      </div>

      {/* Top Overlay: Category / Volume / Counter */}
      <div className="relative z-20 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-b from-black/70 via-black/30 to-transparent">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[10px] font-black tracking-wider uppercase flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
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

      {/* Right Interaction Sidebar (Thumbnails, Likes, Dislikes, Comments, Share) */}
      <div className="relative z-20 self-end pr-2.5 sm:pr-4 flex flex-col items-center gap-4 mb-20 sm:mb-24">
        {/* Like Button */}
        <button
          onClick={() => toggleLike(activeShort.videoId)}
          className="flex flex-col items-center gap-1 group"
        >
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md transition-all shadow-lg active:scale-90 ${
              likedMap[activeShort.videoId]
                ? 'bg-red-600 text-white shadow-red-900/60'
                : 'bg-black/50 hover:bg-black/70 text-white border border-white/20'
            }`}
          >
            <ThumbsUp className={`w-5 h-5 ${likedMap[activeShort.videoId] ? 'fill-white' : ''}`} />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md">
            {likeCountMap[activeShort.videoId] || 1200}
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
                ? 'bg-slate-700 text-white'
                : 'bg-black/50 hover:bg-black/70 text-white border border-white/20'
            }`}
          >
            <ThumbsDown className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-300 drop-shadow-md">Dislike</span>
        </button>

        {/* Comments Button */}
        <button
          onClick={() => setCommentsOpen(true)}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center backdrop-blur-md transition-all shadow-lg active:scale-90">
            <MessageCircle className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold text-white drop-shadow-md">{commentList.length}</span>
        </button>

        {/* Share Button */}
        <button onClick={handleShare} className="flex flex-col items-center gap-1 group">
          <div className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 text-white border border-white/20 flex items-center justify-center backdrop-blur-md transition-all shadow-lg active:scale-90">
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold text-white drop-shadow-md">Share</span>
        </button>

        {/* Spinning Vinyl Disc / Music Track */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-900 to-slate-800 border-2 border-white/40 flex items-center justify-center shadow-lg animate-spin" style={{ animationDuration: '4s' }}>
          <Disc3 className="w-6 h-6 text-red-500" />
        </div>
      </div>

      {/* Bottom Overlay: Creator info, Title, Audio tag, Up/Down helper controls */}
      <div className="relative z-20 p-3 sm:p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent space-y-2">
        {/* Creator Channel Strip & Subscribe Button */}
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
                ? 'bg-white/20 text-slate-200 border border-white/20'
                : 'bg-white text-black hover:bg-slate-200'
            }`}
          >
            {subscribedMap[activeShort.creatorName] ? 'Subscribed' : 'Subscribe'}
          </button>
        </div>

        {/* Video Title */}
        <p className="text-xs sm:text-sm text-white font-medium line-clamp-2 drop-shadow-md leading-snug">
          {activeShort.title}
        </p>

        {/* Audio Track Tag */}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-300 overflow-hidden">
          <Music2 className="w-3.5 h-3.5 text-red-400 flex-shrink-0 animate-pulse" />
          <span className="truncate">Original Sound • {activeShort.creatorName}</span>
        </div>

        {/* Navigation Swipe Hint & Buttons (Swipe or click) */}
        <div className="pt-2 flex items-center justify-between text-slate-400 border-t border-white/10">
          <span className="text-[10px] font-mono flex items-center gap-1 text-slate-400">
            <span>👆 Swipe UP for next Short</span>
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousShort}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 disabled:opacity-30 text-white"
              title="Previous Short (Swipe Down)"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={goToNextShort}
              disabled={currentIndex === shorts.length - 1}
              className="p-1.5 rounded-lg bg-black/40 hover:bg-black/60 disabled:opacity-30 text-white"
              title="Next Short (Swipe Up)"
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

      {/* Comments Drawer / Bottom Sheet */}
      {commentsOpen && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col justify-end animate-in slide-in-from-bottom duration-200">
          <div className="w-full bg-[#111728] rounded-t-3xl border-t border-white/15 p-4 max-h-[70%] flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-bold text-sm text-white">Comments ({commentList.length})</span>
              <button
                onClick={() => setCommentsOpen(false)}
                className="p-1 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1">
              {commentList.map((c) => (
                <div key={c.id} className="text-xs space-y-0.5">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="font-bold text-white">{c.user}</span>
                    <span>{c.time}</span>
                  </div>
                  <p className="text-slate-200">{c.text}</p>
                </div>
              ))}
            </div>

            {/* Comment Composer */}
            <form onSubmit={handleAddComment} className="pt-2 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment on this Short..."
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="p-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
