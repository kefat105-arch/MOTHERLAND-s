import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Youtube,
  Shield,
  Loader2,
  X,
  RefreshCw,
  ArrowLeft,
  Heart,
  ThumbsDown,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Radio,
  Flame,
  Upload,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Bell,
  ExternalLink,
  Copy,
  Compass,
  History,
} from 'lucide-react';
import { api } from '../api';
import type { ShortVideo, LongVideo, UserProfile } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';
import { FireLikeIcon } from './fire/MotherlandIcons';

interface VideoSectionProps {
  currentUser: UserProfile | null;
  isVisible: boolean;
  initialShorts: ShortVideo[];
  initialLongVideos: LongVideo[];
  youtubeConnected: boolean;
  watchingVideo: LongVideo | null;
  isWatchMinimized: boolean;
  onWatchVideo: (video: LongVideo) => void;
  onMinimizeWatch: () => void;
  onStageAnchorChange: (el: HTMLDivElement | null) => void;
  onOpenComments: (info: { postId?: string; youtubeVideoId?: string; title?: string }) => void;
  onOpenPlatformHub: () => void;
  onOpenShortsPlayer: (shortsList: ShortVideo[], startIndex: number) => void;
  onOpenUploadVideo: () => void;
  onOpenWatchHistory?: () => void;
  refreshSignal?: number;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending' },
  { id: 'bangla', label: 'Bangla' },
  { id: 'music', label: 'Music' },
  { id: 'tech', label: 'Tech' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'nature', label: '4K Nature' },
];

export const VideoSection: React.FC<VideoSectionProps> = ({
  isVisible,
  initialShorts,
  initialLongVideos,
  youtubeConnected,
  watchingVideo,
  isWatchMinimized,
  onWatchVideo,
  onMinimizeWatch,
  onStageAnchorChange,
  onOpenComments,
  onOpenPlatformHub,
  onOpenShortsPlayer,
  onOpenUploadVideo,
  onOpenWatchHistory,
  refreshSignal = 0,
}) => {
  // Search & Category State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchHistory, setSearchHistory] = useState<string[]>([
    'Bangladesh 4K',
    'Sajek Valley',
    'Web Engineering',
    'Music',
  ]);
  const [showHistory, setShowHistory] = useState(false);

  // Live Section & Dedicated YouTube Live Browsing State
  const [liveStreams, setLiveStreams] = useState<LongVideo[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const [liveNextPageToken, setLiveNextPageToken] = useState<string | null>(null);
  const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [isLoadingMoreLive, setIsLoadingMoreLive] = useState(false);

  // Feeds State (Zero autoplay on homepage load)
  const [shortsCarousel, setShortsCarousel] = useState<ShortVideo[]>(initialShorts);
  const [longVideosList, setLongVideosList] = useState<LongVideo[]>(initialLongVideos);
  const [longPage, setLongPage] = useState(1);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [youtubeFeedNotice, setYoutubeFeedNotice] = useState('');

  // Watch Page Action States (scoped cleanly per video ID)
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [dislikedMap, setDislikedMap] = useState<Record<string, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [subscribedMap, setSubscribedMap] = useState<Record<string, boolean>>({});
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const savedScrollYRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const isWatchPageOpen = Boolean(watchingVideo && !isWatchMinimized);

  // Preserve & restore window scroll when switching between tabs or exiting Watch Page
  useEffect(() => {
    if (isVisible && !isWatchPageOpen && savedScrollYRef.current > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollYRef.current, behavior: 'auto' });
      });
    }
  }, [isVisible, isWatchPageOpen]);

  useEffect(() => {
    if (!isVisible || isWatchPageOpen) return;
    const onScroll = () => {
      savedScrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isVisible, isWatchPageOpen]);

  // Register edge-swipe back handler for Dedicated Live View
  useBackHandler(
    'video-live-browse',
    isVisible && isLiveViewOpen && !isWatchPageOpen,
    () => setIsLiveViewOpen(false),
    40
  );

  // Register edge-swipe back handler when Full Watch Page is active
  useBackHandler(
    'video-watch-page',
    isVisible && isWatchPageOpen,
    () => {
      onMinimizeWatch();
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedScrollYRef.current, behavior: 'auto' });
      });
    },
    45
  );

  // Sync newly uploaded MOTHERLAND long videos
  useEffect(() => {
    if (initialLongVideos.length > 0) {
      setLongVideosList((prev) => {
        const existingIds = new Set(prev.map((v) => v.id));
        const newLocal = initialLongVideos.filter((v) => !existingIds.has(v.id));
        return newLocal.length > 0 ? [...newLocal, ...prev] : prev;
      });
    }
  }, [initialLongVideos]);

  useEffect(() => {
    if (initialShorts.length > 0) {
      setShortsCarousel((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const added = initialShorts.filter((s) => !existingIds.has(s.id));
        return added.length > 0 ? [...added, ...prev] : prev;
      });
    }
  }, [initialShorts]);

  // Reset per-video UI toggles when switching watching video
  useEffect(() => {
    setShowFullDesc(false);
    setMoreMenuOpen(false);
  }, [watchingVideo?.id]);

  // Smart Staleness Auto-Refresh: quietly updates unseen recommendations without disturbing active player
  useEffect(() => {
    if (refreshSignal <= 0) return;
    let active = true;
    Promise.all([
      api.getLongVideos(false).catch(() => ({ videos: initialLongVideos })),
      api.getYouTubeFeed({ type: 'long', category: selectedCategory, page: 1, pageSize: 16 }).catch(() => ({ items: [] })),
      api.getYouTubeFeed({ type: 'shorts', category: 'shorts', page: 1, pageSize: 12 }).catch(() => ({ items: [] })),
    ]).then(([localLong, ytLong, ytShorts]) => {
      if (!active) return;
      const merged = [...(localLong.videos || [])];
      const seen = new Set(merged.map((v) => v.youtubeId || v.id));
      for (const item of ytLong.items || []) {
        const key = item.youtubeId || item.id;
        if (!seen.has(key)) {
          merged.push(item);
          seen.add(key);
        }
      }
      if (merged.length > 0) setLongVideosList(merged);
      if (Array.isArray(ytShorts.items) && ytShorts.items.length > 0) {
        const nextYtShorts: ShortVideo[] = ytShorts.items.map((item: any) => ({
          id: item.id,
          source: 'youtube',
          youtubeId: item.youtubeId,
          videoUrl: '',
          thumbnailUrl: item.thumbnailUrl,
          title: item.title,
          caption: item.description,
          hashtags: ['Shorts'],
          creator: {
            id: item.channel?.id || 'yt',
            name: item.channel?.title || 'Creator',
            username: (item.channel?.title || 'creator').toLowerCase().replace(/\s+/g, '_'),
            avatar: item.channel?.avatar || '',
            isVerified: true,
          },
          stats: {
            likes: item.stats?.likes || 0,
            comments: item.stats?.comments || 0,
            shares: 0,
            views: item.stats?.views || 0,
          },
          createdAt: item.publishedAt || 'Recently',
        }));
        setShortsCarousel((prev) => {
          const localOnly = prev.filter((s) => s.source !== 'youtube');
          const sSeen = new Set(localOnly.map((s) => s.youtubeId || s.id));
          return [...localOnly, ...nextYtShorts.filter((s) => !sSeen.has(s.youtubeId || s.id))];
        });
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  // Load initial Video Homepage data cleanly (NO autoplay)
  useEffect(() => {
    let mounted = true;

    async function loadHomepage() {
      setLiveLoading(true);
      try {
        const liveRes = await api.getYouTubeLive();
        if (mounted) {
          setLiveStreams(liveRes.items || []);
          setLiveNextPageToken(liveRes.nextPageToken || null);
          setLiveMessage(liveRes.message || '');
        }
      } catch {
        if (mounted) setLiveStreams([]);
      } finally {
        if (mounted) setLiveLoading(false);
      }

      try {
        const longRes = await api.getYouTubeFeed({
          type: 'long',
          category: 'all',
          page: 1,
          pageSize: 16,
        });
        if (mounted) {
          if (longRes.items && longRes.items.length > 0) {
            const combined = [...initialLongVideos];
            const seen = new Set(combined.map((v) => v.youtubeId || v.id));
            for (const yt of longRes.items) {
              if (!seen.has(yt.youtubeId || yt.id)) {
                combined.push(yt);
                seen.add(yt.youtubeId || yt.id);
              }
            }
            setLongVideosList(combined);
            setNextPageToken(longRes.nextPageToken || null);
            setYoutubeFeedNotice('');
          } else {
            setYoutubeFeedNotice(
              youtubeConnected
                ? ''
                : 'Showing MOTHERLAND videos. Connect a YouTube Data API v3 key to browse live YouTube catalogs.'
            );
          }
        }
      } catch {
        // Keep initial MOTHERLAND videos
      }

      try {
        const shortsRes = await api.getYouTubeFeed({
          type: 'shorts',
          category: 'shorts',
          page: 1,
          pageSize: 12,
        });
        if (mounted && shortsRes.items && shortsRes.items.length > 0) {
          const ytShorts: ShortVideo[] = shortsRes.items.map((item: any) => ({
            id: item.id,
            source: 'youtube',
            youtubeId: item.youtubeId,
            videoUrl: '',
            thumbnailUrl: item.thumbnailUrl,
            title: item.title,
            caption: item.description,
            hashtags: ['Shorts'],
            creator: {
              id: item.channel?.id || 'yt',
              name: item.channel?.title || 'Creator',
              username: (item.channel?.title || 'creator').toLowerCase().replace(/\s+/g, '_'),
              avatar: item.channel?.avatar || '',
              isVerified: true,
            },
            stats: {
              likes: item.stats?.likes || 0,
              comments: item.stats?.comments || 0,
              shares: Math.floor((item.stats?.likes || 0) / 10),
              views: item.stats?.views || 0,
            },
            createdAt: item.publishedAt || new Date().toISOString(),
          }));

          setShortsCarousel((prev) => {
            const seen = new Set(prev.map((s) => s.youtubeId || s.id));
            return [...prev, ...ytShorts.filter((s) => !seen.has(s.youtubeId || s.id))];
          });
        }
      } catch {
        // Keep initial MOTHERLAND shorts
      }
    }

    loadHomepage();
    return () => {
      mounted = false;
    };
  }, [youtubeConnected]);

  const handleSearch = async (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    setIsSearching(true);
    setShowHistory(false);
    setIsLiveViewOpen(false);
    if (isWatchPageOpen) onMinimizeWatch();

    if (!searchHistory.includes(clean)) {
      setSearchHistory((prev) => [clean, ...prev.slice(0, 5)]);
    }

    try {
      const ytRes = await api.searchYouTube(clean, '', 16);
      const localMatches = initialLongVideos.filter(
        (v) =>
          v.title.toLowerCase().includes(clean.toLowerCase()) ||
          v.description.toLowerCase().includes(clean.toLowerCase())
      );

      const ytVideos: LongVideo[] = (ytRes.items || []).map((item: any) => ({
        id: item.id,
        source: 'youtube',
        youtubeId: item.youtubeId,
        thumbnailUrl: item.thumbnailUrl,
        title: item.title,
        description: item.description,
        duration: item.duration || '0:00',
        channel: item.channel,
        stats: item.stats,
        publishedAt: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Recently',
      }));

      setLongVideosList([...localMatches, ...ytVideos]);
      setNextPageToken(ytRes.nextPageToken || null);
      setLongPage(1);
      setYoutubeFeedNotice(ytRes.message || '');
    } catch (err) {
      console.error('Video search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchLive = async (q = liveSearchQuery, pageToken = '') => {
    if (!pageToken) {
      setLiveLoading(true);
    } else {
      setIsLoadingMoreLive(true);
    }
    try {
      const res = await api.getYouTubeLive(pageToken, q.trim());
      if (pageToken) {
        setLiveStreams((prev) => {
          const seen = new Set(prev.map((x) => x.youtubeId || x.id));
          return [...prev, ...(res.items || []).filter((x) => !seen.has(x.youtubeId || x.id))];
        });
      } else {
        setLiveStreams(res.items || []);
      }
      setLiveNextPageToken(res.nextPageToken || null);
      setLiveMessage(res.message || '');
    } catch {
      // keep existing
    } finally {
      setLiveLoading(false);
      setIsLoadingMoreLive(false);
    }
  };

  const handleSelectCategory = async (cat: { id: string; label: string }) => {
    setSelectedCategory(cat.id);
    setSearchQuery('');
    setIsSearching(true);
    setIsLiveViewOpen(false);
    if (isWatchPageOpen) onMinimizeWatch();

    try {
      const feedRes = await api.getYouTubeFeed({
        type: 'long',
        category: cat.id,
        page: 1,
        pageSize: 16,
      });

      if (feedRes.items && feedRes.items.length > 0) {
        setLongVideosList(cat.id === 'all' ? [...initialLongVideos, ...feedRes.items] : feedRes.items);
        setNextPageToken(feedRes.nextPageToken || null);
        setLongPage(1);
      } else if (cat.id === 'all') {
        setLongVideosList(initialLongVideos);
      }
    } catch (err) {
      console.error('Category switch error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const loadMoreVideos = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      if (searchQuery.trim()) {
        const ytRes = await api.searchYouTube(searchQuery, nextPageToken || '', 12);
        const items: LongVideo[] = (ytRes.items || []).map((item: any) => ({
          id: `${item.id}_${Date.now()}`,
          source: 'youtube',
          youtubeId: item.youtubeId,
          thumbnailUrl: item.thumbnailUrl,
          title: item.title,
          description: item.description,
          duration: item.duration || '0:00',
          channel: item.channel,
          stats: item.stats,
          publishedAt: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Recently',
        }));
        if (items.length > 0) {
          setLongVideosList((prev) => {
            const seen = new Set(prev.map((x) => x.youtubeId || x.id));
            return [...prev, ...items.filter((x) => !seen.has(x.youtubeId || x.id))];
          });
        }
        setNextPageToken(ytRes.nextPageToken || null);
      } else {
        const nextPage = longPage + 1;
        const feedRes = await api.getYouTubeFeed({
          type: 'long',
          category: selectedCategory,
          pageToken: nextPageToken || '',
          page: nextPage,
          pageSize: 12,
        });
        if (feedRes.items && feedRes.items.length > 0) {
          setLongVideosList((prev) => {
            const seen = new Set(prev.map((x) => x.youtubeId || x.id));
            return [...prev, ...feedRes.items.filter((x: LongVideo) => !seen.has(x.youtubeId || x.id))];
          });
          setNextPageToken(feedRes.nextPageToken || null);
          setLongPage(nextPage);
        }
      }
    } catch {
      // Ignore silent pagination errors
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, searchQuery, nextPageToken, longPage, selectedCategory]);

  // Infinite scroll on Video Homepage
  useEffect(() => {
    if (!isVisible || isWatchPageOpen || isLiveViewOpen) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          loadMoreVideos();
        }
      },
      { threshold: 0.1, rootMargin: '350px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isVisible, isWatchPageOpen, isLiveViewOpen, isLoadingMore, loadMoreVideos]);

  const openWatchView = (video: LongVideo) => {
    if (!isWatchPageOpen) {
      savedScrollYRef.current = window.scrollY;
    }
    onWatchVideo(video);
  };

  const handleBackToVideos = () => {
    onMinimizeWatch();
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollYRef.current, behavior: 'auto' });
    });
  };

  const handleShareVideo = async (video: LongVideo) => {
    const shareUrl = video.youtubeId
      ? `https://www.youtube.com/watch?v=${video.youtubeId}`
      : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: video.title, url: shareUrl });
        return;
      } catch {
        // fallback
      }
    }
    navigator.clipboard?.writeText(shareUrl);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const renderVideoCard = (video: LongVideo) => (
    <article
      key={video.id}
      data-testid={`long-video-card-${video.id}`}
      onClick={() => openWatchView(video)}
      className="cursor-pointer rounded-2xl overflow-hidden ml-glass hover:border-[var(--accent-primary)] transition-all group"
    >
      <div className="relative aspect-video bg-black overflow-hidden">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white font-semibold tabular-nums">
          {video.duration}
        </span>
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/65 backdrop-blur-md border border-white/15 text-white text-[10px] font-semibold flex items-center gap-1">
          {video.source === 'youtube' ? (
            <>
              <Youtube className="w-3 h-3 text-red-400" /> YouTube
            </>
          ) : (
            <>
              <Shield className="w-3 h-3 text-[#D0AF72]" /> MOTHERLAND
            </>
          )}
        </span>
      </div>

      <div className="p-3 flex gap-2.5">
        <img
          src={video.channel.avatar}
          alt={video.channel.title}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-[var(--border-subtle)] mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--accent-primary)] transition-colors">
            {video.title}
          </h3>
          <div className="text-[11px] text-[var(--text-secondary)] mt-1 truncate">
            {video.channel.title}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
            {video.stats.views.toLocaleString()} views · {video.publishedAt}
          </div>
        </div>
      </div>
    </article>
  );

  // =========================================================================
  // VIEW B: FIXED SPLIT STICKY LONG-FORM VIDEO WATCH PAGE
  // =========================================================================
  if (watchingVideo && !isWatchMinimized) {
    const recommendedList = longVideosList.filter((v) => v.id !== watchingVideo.id);
    const isLiked = Boolean(likedMap[watchingVideo.id] ?? watchingVideo.userInteractions?.isLiked);
    const isDisliked = Boolean(dislikedMap[watchingVideo.id]);
    const isSaved = Boolean(savedMap[watchingVideo.id]);
    const isSubscribed = Boolean(
      subscribedMap[watchingVideo.channel.id] ?? watchingVideo.userInteractions?.isSubscribed
    );
    const displayLikes = watchingVideo.stats.likes + (isLiked ? 1 : 0);

    return (
      <div
        data-testid="video-watch-split-view"
        className="fixed top-[57px] inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-25 ml-canvas-bg overflow-hidden flex flex-col lg:grid lg:grid-cols-12 max-w-6xl mx-auto"
      >
        {/* Pinned Video Player Header + Anchor (NEVER scrolls away on mobile or desktop!) */}
        <div className="flex-shrink-0 lg:col-span-8 lg:flex lg:flex-col lg:overflow-hidden lg:pt-3 lg:pl-4">
          <div className="flex-shrink-0">
            <div className="ml-glass border-b px-3 py-2 flex items-center justify-between gap-2 sm:rounded-t-2xl">
              <button
                type="button"
                onClick={handleBackToVideos}
                className="min-h-[38px] px-3 rounded-xl bg-[var(--bg-surface-alt)] hover:opacity-90 border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Videos</span>
              </button>

              <span className="text-xs font-semibold text-[var(--text-secondary)] truncate flex-1 text-center">
                {watchingVideo.channel.title}
              </span>

              <button
                type="button"
                onClick={handleBackToVideos}
                className="min-h-[38px] px-3 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary-border)] text-xs font-bold flex items-center gap-1"
                aria-label="Minimize player"
                title="Minimize to persistent Mini-Player"
              >
                <ChevronDown className="w-4 h-4" />
                <span>Mini</span>
              </button>
            </div>

            {/* Single-Mount Player Anchor Box (Stationary while details & Up Next scroll) */}
            <div
              ref={onStageAnchorChange}
              data-testid="watch-player-anchor"
              className="w-full aspect-video bg-black sm:rounded-b-2xl overflow-hidden shadow-lg"
            />
          </div>

          {/* Desktop-only scrollable metadata under pinned player */}
          <div className="hidden lg:block flex-1 overflow-y-auto pt-3.5 pb-6 space-y-3 pr-1">
            <h1 className="text-xl font-extrabold text-[var(--text-primary)] leading-snug">
              {watchingVideo.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] tabular-nums flex-wrap">
              {watchingVideo.isLive ? (
                <span className="text-[var(--danger)] font-bold">
                  LIVE · {watchingVideo.liveViewers?.toLocaleString() || 0} watching
                </span>
              ) : (
                <span>{watchingVideo.stats.views.toLocaleString()} views</span>
              )}
              <span>·</span>
              <span>{watchingVideo.publishedAt}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-semibold">
                {watchingVideo.source === 'youtube' ? (
                  <>
                    <Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube
                  </>
                ) : (
                  <>
                    <Shield className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> MOTHERLAND
                  </>
                )}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => {
                  const next = !isLiked;
                  setLikedMap((m) => ({ ...m, [watchingVideo.id]: next }));
                  if (next && isDisliked) setDislikedMap((m) => ({ ...m, [watchingVideo.id]: false }));
                }}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors flex-shrink-0 ${
                  isLiked
                    ? 'bg-orange-500/15 border-orange-500/35 text-orange-400'
                    : 'ml-glass text-[var(--text-primary)] hover:opacity-90'
                }`}
              >
                <FireLikeIcon size={18} active={isLiked} />
                <span className="tabular-nums">{displayLikes.toLocaleString()}</span>
              </button>

              {watchingVideo.source !== 'youtube' && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !isDisliked;
                    setDislikedMap((m) => ({ ...m, [watchingVideo.id]: next }));
                    if (next && isLiked) setLikedMap((m) => ({ ...m, [watchingVideo.id]: false }));
                  }}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors flex-shrink-0 ${
                    isDisliked
                      ? 'bg-[var(--accent-gold-soft)] border-[var(--accent-gold-border)] text-[var(--accent-gold)]'
                      : 'ml-glass text-[var(--text-primary)] hover:opacity-90'
                  }`}
                >
                  <ThumbsDown className={`w-4 h-4 ${isDisliked ? 'fill-current' : ''}`} />
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  onOpenComments({
                    postId: watchingVideo.id,
                    youtubeVideoId: watchingVideo.youtubeId,
                    title: watchingVideo.title,
                  })
                }
                className="min-h-[40px] px-4 rounded-xl text-xs font-bold ml-glass text-[var(--text-primary)] flex items-center gap-1.5 flex-shrink-0"
              >
                <MessageCircle className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="tabular-nums">{watchingVideo.stats.comments.toLocaleString()} Comments</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !isSaved;
                  setSavedMap((m) => ({ ...m, [watchingVideo.id]: next }));
                  if (api.getToken()) {
                    api
                      .toggleSaveVideo({
                        videoId: watchingVideo.id,
                        videoType: 'long',
                        source: watchingVideo.source,
                        youtubeId: watchingVideo.youtubeId,
                        title: watchingVideo.title,
                        thumbnailUrl: watchingVideo.thumbnailUrl,
                        channelTitle: watchingVideo.channel.title,
                        channelAvatar: watchingVideo.channel.avatar,
                        duration: watchingVideo.duration,
                        videoUrl: watchingVideo.videoUrl,
                      })
                      .catch(() => {});
                  }
                }}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors flex-shrink-0 ${
                  isSaved
                    ? 'bg-[var(--accent-gold-soft)] border-[var(--accent-gold-border)] text-[var(--accent-gold)]'
                    : 'ml-glass text-[var(--text-primary)]'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleShareVideo(watchingVideo)}
                className="min-h-[40px] px-4 rounded-xl text-xs font-bold ml-glass text-[var(--text-primary)] flex items-center gap-1.5 flex-shrink-0"
              >
                {copiedShare ? <Check className="w-4 h-4 text-[var(--accent-primary)]" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedShare ? 'Copied' : 'Share'}</span>
              </button>

              <button
                type="button"
                onClick={() => setMoreMenuOpen((o) => !o)}
                className="min-h-[40px] w-10 rounded-xl ml-glass text-[var(--text-primary)] flex items-center justify-center flex-shrink-0"
                aria-label="More video options"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {moreMenuOpen && (
              <div className="p-2 rounded-2xl ml-glass-elevated flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    handleShareVideo(watchingVideo);
                    setMoreMenuOpen(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-[var(--bg-surface-alt)] text-[var(--text-primary)] font-semibold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span>Copy Link</span>
                </button>
                {watchingVideo.youtubeId && (
                  <a
                    href={`https://www.youtube.com/watch?v=${watchingVideo.youtubeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMoreMenuOpen(false)}
                    className="px-3 py-2 rounded-xl bg-[var(--bg-surface-alt)] text-[var(--text-primary)] font-semibold flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-red-500" />
                    <span>Open on YouTube</span>
                  </a>
                )}
              </div>
            )}

            {/* Channel Card */}
            <div className="p-3.5 rounded-2xl ml-glass flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={watchingVideo.channel.avatar}
                  alt={watchingVideo.channel.title}
                  className="w-10 h-10 rounded-full object-cover border border-[var(--border-subtle)]"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-[var(--text-primary)] truncate">
                    <span>{watchingVideo.channel.title}</span>
                    {watchingVideo.channel.isVerified && (
                      <span className="w-3.5 h-3.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-[8px] font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {watchingVideo.channel.subscriberCount || 'Creator Channel'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setSubscribedMap((m) => ({
                    ...m,
                    [watchingVideo.channel.id]: !isSubscribed,
                  }))
                }
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors flex-shrink-0 ${
                  isSubscribed
                    ? 'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)]'
                }`}
              >
                {isSubscribed && <Bell className="w-3.5 h-3.5 text-[var(--accent-gold)]" />}
                <span>{isSubscribed ? 'Supporting ✓' : 'Support'}</span>
              </button>
            </div>

            {watchingVideo.description && (
              <div className="p-3.5 rounded-2xl ml-glass">
                <p
                  className={`text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap ${
                    showFullDesc ? '' : 'line-clamp-3'
                  }`}
                >
                  {watchingVideo.description}
                </p>
                {watchingVideo.description.length > 140 && (
                  <button
                    type="button"
                    onClick={() => setShowFullDesc((d) => !d)}
                    className="mt-1.5 text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1"
                  >
                    <span>{showFullDesc ? 'Show less' : 'Read more'}</span>
                    {showFullDesc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Body below Pinned Player (Mobile: Metadata + Up Next | Desktop Right Column: Up Next) */}
        <div
          data-testid="watch-scrollable-details"
          className="flex-1 overflow-y-auto px-3 sm:px-4 lg:pl-0 lg:col-span-4 lg:pt-3 pb-8 space-y-4"
        >
          {/* Mobile-only Metadata Block */}
          <div className="lg:hidden pt-3.5 space-y-3">
            <div>
              <h1 className="text-base font-extrabold text-[var(--text-primary)] leading-snug">
                {watchingVideo.title}
              </h1>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] mt-1.5 tabular-nums flex-wrap">
                {watchingVideo.isLive ? (
                  <span className="text-[var(--danger)] font-bold">
                    LIVE · {watchingVideo.liveViewers?.toLocaleString() || 0} watching
                  </span>
                ) : (
                  <span>{watchingVideo.stats.views.toLocaleString()} views</span>
                )}
                <span>·</span>
                <span>{watchingVideo.publishedAt}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  {watchingVideo.source === 'youtube' ? (
                    <>
                      <Youtube className="w-3.5 h-3.5 text-red-500" /> YouTube
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> MOTHERLAND
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => {
                  const next = !isLiked;
                  setLikedMap((m) => ({ ...m, [watchingVideo.id]: next }));
                  if (next && isDisliked) setDislikedMap((m) => ({ ...m, [watchingVideo.id]: false }));
                }}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors flex-shrink-0 ${
                  isLiked
                    ? 'bg-orange-500/15 border-orange-500/35 text-orange-400'
                    : 'ml-glass text-[var(--text-primary)]'
                }`}
              >
                <FireLikeIcon size={18} active={isLiked} />
                <span className="tabular-nums">{displayLikes.toLocaleString()}</span>
              </button>

              {watchingVideo.source !== 'youtube' && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !isDisliked;
                    setDislikedMap((m) => ({ ...m, [watchingVideo.id]: next }));
                    if (next && isLiked) setLikedMap((m) => ({ ...m, [watchingVideo.id]: false }));
                  }}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors flex-shrink-0 ${
                    isDisliked
                      ? 'bg-[var(--accent-gold-soft)] border-[var(--accent-gold-border)] text-[var(--accent-gold)]'
                      : 'ml-glass text-[var(--text-primary)]'
                  }`}
                >
                  <ThumbsDown className={`w-4 h-4 ${isDisliked ? 'fill-current' : ''}`} />
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  onOpenComments({
                    postId: watchingVideo.id,
                    youtubeVideoId: watchingVideo.youtubeId,
                    title: watchingVideo.title,
                  })
                }
                className="min-h-[40px] px-4 rounded-xl text-xs font-bold ml-glass text-[var(--text-primary)] flex items-center gap-1.5 flex-shrink-0"
              >
                <MessageCircle className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="tabular-nums">{watchingVideo.stats.comments.toLocaleString()} Comments</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !isSaved;
                  setSavedMap((m) => ({ ...m, [watchingVideo.id]: next }));
                  if (api.getToken()) {
                    api
                      .toggleSaveVideo({
                        videoId: watchingVideo.id,
                        videoType: 'long',
                        source: watchingVideo.source,
                        youtubeId: watchingVideo.youtubeId,
                        title: watchingVideo.title,
                        thumbnailUrl: watchingVideo.thumbnailUrl,
                        channelTitle: watchingVideo.channel.title,
                        channelAvatar: watchingVideo.channel.avatar,
                        duration: watchingVideo.duration,
                        videoUrl: watchingVideo.videoUrl,
                      })
                      .catch(() => {});
                  }
                }}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors flex-shrink-0 ${
                  isSaved
                    ? 'bg-[var(--accent-gold-soft)] border-[var(--accent-gold-border)] text-[var(--accent-gold)]'
                    : 'ml-glass text-[var(--text-primary)]'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleShareVideo(watchingVideo)}
                className="min-h-[40px] px-4 rounded-xl text-xs font-bold ml-glass text-[var(--text-primary)] flex items-center gap-1.5 flex-shrink-0"
              >
                {copiedShare ? <Check className="w-4 h-4 text-[var(--accent-primary)]" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedShare ? 'Copied' : 'Share'}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-2xl ml-glass flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={watchingVideo.channel.avatar}
                  alt={watchingVideo.channel.title}
                  className="w-10 h-10 rounded-full object-cover border border-[var(--border-subtle)]"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-[var(--text-primary)] truncate">
                    <span>{watchingVideo.channel.title}</span>
                    {watchingVideo.channel.isVerified && (
                      <span className="w-3.5 h-3.5 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] flex items-center justify-center text-[8px] font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {watchingVideo.channel.subscriberCount || 'Creator Channel'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSubscribedMap((m) => ({
                    ...m,
                    [watchingVideo.channel.id]: !isSubscribed,
                  }))
                }
                className={`min-h-[40px] px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors flex-shrink-0 ${
                  isSubscribed
                    ? 'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)]'
                }`}
              >
                {isSubscribed && <Bell className="w-3.5 h-3.5 text-[var(--accent-gold)]" />}
                <span>{isSubscribed ? 'Supporting ✓' : 'Support'}</span>
              </button>
            </div>

            {watchingVideo.description && (
              <div className="p-3.5 rounded-2xl ml-glass">
                <p
                  className={`text-xs text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap ${
                    showFullDesc ? '' : 'line-clamp-3'
                  }`}
                >
                  {watchingVideo.description}
                </p>
                {watchingVideo.description.length > 140 && (
                  <button
                    type="button"
                    onClick={() => setShowFullDesc((d) => !d)}
                    className="mt-1.5 text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1"
                  >
                    <span>{showFullDesc ? 'Show less' : 'Read more'}</span>
                    {showFullDesc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Up Next Recommendations */}
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-[var(--text-primary)] tracking-tight">
              Up Next
            </h2>
            <div className="space-y-2.5">
              {recommendedList.map((video) => (
                <div
                  key={video.id}
                  onClick={() => openWatchView(video)}
                  className="flex gap-3 cursor-pointer group p-2 rounded-2xl border border-transparent hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-all"
                >
                  <div className="relative w-40 aspect-video rounded-xl overflow-hidden bg-black flex-shrink-0">
                    <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono tabular-nums">
                      {video.duration}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--accent-primary)]">
                      {video.title}
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 truncate">
                      {video.channel.title}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] tabular-nums">
                      {video.stats.views.toLocaleString()} views · {video.publishedAt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW C: DEDICATED YOUTUBE LIVE BROWSING SECTION
  // =========================================================================
  if (isLiveViewOpen) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 pb-28 space-y-4">
        <div className="ml-glass rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsLiveViewOpen(false)}
              className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-center justify-center"
              aria-label="Back to Videos"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                <span>YouTube Live Broadcasts</span>
              </h2>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Real-time active broadcasts via YouTube Data API
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearchLive(liveSearchQuery, '');
            }}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <input
              type="text"
              value={liveSearchQuery}
              onChange={(e) => setLiveSearchQuery(e.target.value)}
              placeholder="Search live channels or topics..."
              className="flex-1 sm:w-60 px-3 py-2 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
            <button
              type="submit"
              disabled={liveLoading}
              className="px-3.5 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold"
            >
              {liveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
            </button>
          </form>
        </div>

        {liveLoading ? (
          <div className="py-12 flex flex-col items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
            <span>Loading active live broadcasts...</span>
          </div>
        ) : liveStreams.length === 0 ? (
          <div className="ml-glass rounded-2xl p-8 text-center space-y-3">
            <Radio className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-sm font-bold text-[var(--text-primary)]">
              No active live YouTube broadcasts returned
            </p>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              {liveMessage || 'Check your YouTube Data API v3 key configuration or try another search topic.'}
            </p>
            {!youtubeConnected && (
              <button
                type="button"
                onClick={onOpenPlatformHub}
                className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold"
              >
                Configure YouTube API Key
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveStreams.map((live) => (
                <article
                  key={live.id}
                  onClick={() => openWatchView(live)}
                  className="cursor-pointer rounded-2xl overflow-hidden ml-glass hover:border-[var(--accent-primary)] transition-all group"
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    <img src={live.thumbnailUrl} alt={live.title} className="w-full h-full object-cover" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                      LIVE
                    </span>
                    {typeof live.liveViewers === 'number' && live.liveViewers > 0 && (
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono tabular-nums">
                        {live.liveViewers.toLocaleString()} watching
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-2">
                      {live.title}
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 truncate">
                      {live.channel.title}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            {liveNextPageToken && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => handleSearchLive(liveSearchQuery, liveNextPageToken)}
                  disabled={isLoadingMoreLive}
                  className="px-4 py-2 rounded-xl ml-glass text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2"
                >
                  {isLoadingMoreLive ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Load More Live Streams</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Split Recommended Videos cleanly into initial & secondary batches around Category Discovery & Shorts
  const topRecommended = longVideosList.slice(0, 6);
  const moreRecommended = longVideosList.slice(6);

  // =========================================================================
  // VIEW A: 6-SECTION YOUTUBE-STYLE VIDEO HOMEPAGE (ZERO AUTOPLAY ON LOAD)
  // =========================================================================
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 pb-28 space-y-5">
      {/* SECTION 1: Top Search Bar, Upload Button & Swipeable Categories */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="flex items-center gap-2 ml-glass rounded-xl px-3 h-11 focus-within:border-[var(--accent-primary)] transition-colors">
              <Search className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              <input
                type="text"
                placeholder="Search YouTube & MOTHERLAND videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowHistory(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                className="w-full bg-transparent text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    handleSelectCategory(CATEGORIES[0]);
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSearch(searchQuery)}
                disabled={isSearching}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-bold transition-colors"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
              </button>
            </div>

            {showHistory && searchHistory.length > 0 && (
              <div className="absolute top-12 left-0 right-0 z-30 ml-glass-elevated rounded-xl p-2.5">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] mb-1.5 px-1">
                  <span>Recent Searches</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchHistory([]);
                      setShowHistory(false);
                    }}
                    className="text-[var(--accent-primary)] hover:underline font-semibold"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {searchHistory.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setSearchQuery(item);
                        handleSearch(item);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-alt)] text-xs text-[var(--text-primary)]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {onOpenWatchHistory && (
            <button
              type="button"
              onClick={onOpenWatchHistory}
              className="h-11 px-3 rounded-xl ml-glass hover:border-[var(--accent-primary)] text-[var(--text-primary)] text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
              title="Watch History"
              aria-label="Watch History"
            >
              <History className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="hidden md:inline">History</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenUploadVideo}
            className="h-11 px-3.5 rounded-xl bg-[var(--accent-royal)] hover:opacity-90 text-white border border-[var(--accent-gold-border)] text-xs font-bold flex items-center gap-1.5 flex-shrink-0 shadow-sm"
            title="Publish Video"
          >
            <Upload className="w-4 h-4 text-[var(--accent-gold)]" />
            <span className="hidden sm:inline">Upload</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar touch-pan-x pb-0.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              data-testid={`category-chip-${cat.id}`}
              onClick={() => handleSelectCategory(cat)}
              className={`min-h-[36px] px-3.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] border-transparent shadow-sm'
                  : 'ml-glass text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 2: YouTube Live Horizontal Section + Dedicated View Trigger */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsLiveViewOpen(true)}
            className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2 hover:text-[var(--accent-primary)] transition-colors"
          >
            <Radio className="w-4 h-4 text-red-500" />
            <span>YouTube Live</span>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>

          <div className="flex items-center gap-3">
            {!youtubeConnected && (
              <button
                type="button"
                onClick={onOpenPlatformHub}
                className="text-xs font-semibold text-[var(--accent-gold)] hover:underline"
              >
                Connect Key
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsLiveViewOpen(true)}
              className="text-xs font-bold text-[var(--accent-primary)] hover:underline flex items-center gap-0.5"
            >
              <span>See All Live</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {liveLoading ? (
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] py-3">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
            <span>Checking live YouTube broadcasts...</span>
          </div>
        ) : liveStreams.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto no-scrollbar touch-pan-x pb-1">
            {liveStreams.map((live) => (
              <div
                key={live.id}
                onClick={() => openWatchView(live)}
                className="w-64 flex-shrink-0 cursor-pointer rounded-2xl ml-glass overflow-hidden hover:border-[var(--accent-primary)] transition-colors"
              >
                <div className="relative aspect-video bg-black">
                  <img src={live.thumbnailUrl} alt={live.title} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                    LIVE
                  </span>
                  {typeof live.liveViewers === 'number' && live.liveViewers > 0 && (
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-mono tabular-nums">
                      {live.liveViewers.toLocaleString()} watching
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] line-clamp-2">{live.title}</h3>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1 truncate">{live.channel.title}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl ml-glass flex items-center justify-between gap-3 text-xs">
            <span className="text-[var(--text-secondary)]">
              {liveMessage || 'No active live YouTube broadcasts returned. Connect a YouTube Data API v3 key to load live streams.'}
            </span>
            <button
              type="button"
              onClick={onOpenPlatformHub}
              className="px-3 py-1.5 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary-border)] font-bold flex-shrink-0"
            >
              API Settings
            </button>
          </div>
        )}
      </section>

      {/* SECTION 3: Recommended Videos */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
            Recommended Videos
          </h2>
          {youtubeFeedNotice && !youtubeConnected && (
            <button
              type="button"
              onClick={onOpenPlatformHub}
              className="text-[11px] text-[var(--accent-gold)] font-semibold hover:underline"
            >
              Connect YouTube Key
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topRecommended.map(renderVideoCard)}
        </div>
      </section>

      {/* SECTION 4: Video Categories Discovery */}
      <section className="ml-glass rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
            <Compass className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Explore Video Channels</span>
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">Tap to filter</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelectCategory(cat)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] border-transparent shadow-sm'
                  : 'bg-[var(--bg-surface-alt)] border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-primary-border)]'
              }`}
            >
              <span className="text-xs font-bold block">{cat.label}</span>
              <span className="text-[10px] opacity-75">Top {cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 5: Horizontal Shorts Discovery Carousel */}
      {shortsCarousel.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Flame className="w-4 h-4 text-[var(--accent-gold)]" />
              <span>Shorts</span>
            </h2>
            <button
              type="button"
              onClick={() => onOpenShortsPlayer(shortsCarousel, 0)}
              className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
            >
              Watch Full-Screen
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar touch-pan-x pb-1">
            {shortsCarousel.slice(0, 12).map((short, idx) => (
              <div
                key={short.id}
                onClick={() => onOpenShortsPlayer(shortsCarousel, idx)}
                className="w-36 sm:w-40 flex-shrink-0 cursor-pointer group"
              >
                <div className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-[var(--border-subtle)] shadow-sm">
                  <img
                    src={short.thumbnailUrl}
                    alt={short.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 via-black/45 to-transparent">
                    <p className="text-[11px] font-bold text-white line-clamp-2 leading-snug">
                      {short.title}
                    </p>
                    <p className="text-[10px] text-white/75 mt-0.5 tabular-nums">
                      {short.stats.views.toLocaleString()} views
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 6: More Recommended Videos & Infinite Pagination */}
      <section className="space-y-3">
        {moreRecommended.length > 0 && (
          <>
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
              More Videos to Watch
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {moreRecommended.map(renderVideoCard)}
            </div>
          </>
        )}

        <div ref={sentinelRef} className="text-center py-4">
          {isLoadingMore ? (
            <div className="inline-flex items-center gap-2 text-xs text-[var(--accent-primary)] font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading more videos...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={loadMoreVideos}
              className="px-4 py-2 rounded-xl ml-glass text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Load More Videos</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
