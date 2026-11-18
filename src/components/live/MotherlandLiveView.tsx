import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeft,
  Bookmark,
  Check,
  LayoutGrid,
  Loader2,
  Maximize2,
  MessageCircle,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Search,
  Send,
  Share2,
  ThumbsUp,
  Tv,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { api } from '../../api';
import type { UserProfile } from '../../types';
import { buildYouTubeEmbedUrl } from '../../utils/youtubePlayerBridge';
import { MotherlandLiveIcon } from './MotherlandLiveIcon';

export type LiveRegion = 'all' | 'BD' | 'BANGLA' | 'CARTOON' | 'PK' | 'IN';
export type LiveCategory =
  | 'all'
  | 'news'
  | 'general'
  | 'entertainment'
  | 'sports'
  | 'music'
  | 'cartoon'
  | 'religious'
  | 'saved';

export interface LiveTvStreamSource {
  url: string;
  referrer?: string;
  userAgent?: string;
}

export interface LiveTvChannelItem {
  id: string;
  name: string;
  country: 'BD' | 'IN' | 'PK' | 'INTL';
  categories: string[];
  logo: string;
  streamType?: 'hls' | 'youtube_live';
  streams: LiveTvStreamSource[];
  youtubeLiveQuery?: string;
  isBangla?: boolean;
  isCartoon?: boolean;
}

interface LiveChannelComment {
  id: string;
  channelId: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
}

interface MotherlandLiveViewProps {
  currentUser: UserProfile | null;
  onBack: () => void;
  onOpenAuth: () => void;
}

const REGION_TABS: { id: LiveRegion; label: string }[] = [
  { id: 'all', label: 'All Channels' },
  { id: 'BD', label: 'Bangladesh' },
  { id: 'BANGLA', label: 'Bangla TV' },
  { id: 'CARTOON', label: 'Cartoon & Kids' },
  { id: 'PK', label: 'Pakistan' },
  { id: 'IN', label: 'India' },
];

const CATEGORY_TABS: { id: LiveCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'news', label: 'News' },
  { id: 'general', label: 'General TV' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'cartoon', label: 'Cartoon & Kids' },
  { id: 'sports', label: 'Sports' },
  { id: 'music', label: 'Music' },
  { id: 'religious', label: 'Religious' },
  { id: 'saved', label: 'Saved' },
];

const COUNTRY_NAMES: Record<string, string> = {
  BD: 'Bangladesh',
  PK: 'Pakistan',
  IN: 'India',
  INTL: 'Global',
};

const GUEST_FAVS_KEY = 'motherland_live_tv_favs_v1';
const GUEST_RECENT_KEY = 'motherland_live_tv_recent_v1';

function buildHlsProxySrc(stream: LiveTvStreamSource): string {
  const qs = new URLSearchParams({ url: stream.url });
  if (stream.referrer) qs.set('ref', stream.referrer);
  if (stream.userAgent) qs.set('ua', stream.userAgent);
  return `/api/motherland-live/hls-proxy?${qs.toString()}`;
}

function formatCommentTime(iso: string): string {
  try {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

const ChannelLogoBadge: React.FC<{
  logo: string;
  name: string;
  sizeClass?: string;
}> = ({ logo, name, sizeClass = 'w-14 h-14' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [logo]);

  const initials = useMemo(() => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase() || 'TV';
  }, [name]);

  if (!logo || imgFailed) {
    return (
      <div
        className={`${sizeClass} rounded-xl bg-gradient-to-br from-rose-600/30 to-slate-800 border border-white/15 flex items-center justify-center text-sm font-bold text-white shrink-0 select-none`}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl bg-white/95 p-1.5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm`}
    >
      <img
        src={logo}
        alt={name}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export const MotherlandLiveView: React.FC<MotherlandLiveViewProps> = ({
  currentUser,
  onBack,
  onOpenAuth,
}) => {
  const [channels, setChannels] = useState<LiveTvChannelItem[]>([]);
  const [counts, setCounts] = useState<{
    all: number;
    BD: number;
    BANGLA: number;
    CARTOON: number;
    PK: number;
    IN: number;
  }>({
    all: 0,
    BD: 0,
    BANGLA: 0,
    CARTOON: 0,
    PK: 0,
    IN: 0,
  });

  const [region, setRegion] = useState<LiveRegion>('all');
  const [category, setCategory] = useState<LiveCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Default null => YouTube-homepage-style grid of all channels with logos.
  // When user clicks any channel => jumps to top 16:9 Live TV player!
  const [activeChannel, setActiveChannel] = useState<LiveTvChannelItem | null>(null);
  const [streamIndex, setStreamIndex] = useState(0);

  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // HLS Player state
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [qualityLevels, setQualityLevels] = useState<{ index: number; label: string }[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);

  // YouTube-Live 24/7 broadcast resolution state (for BD YouTube Live TV stations)
  const [ytLiveVideoId, setYtLiveVideoId] = useState<string | null>(null);
  const [ytLiveLoading, setYtLiveLoading] = useState(false);
  const [ytLiveError, setYtLiveError] = useState<string | null>(null);

  // Social state (Like, Comment, Share, Save) directly below the active running video
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [comments, setComments] = useState<LiveChannelComment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentPending, setCommentPending] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const loadChannels = useCallback(async (forceRefresh = false) => {
    setIsLoadingCatalog(true);
    setCatalogError(null);
    try {
      const res = await api.getMotherlandLiveChannels(
        forceRefresh ? { refresh: '1' } : undefined
      );
      const list = Array.isArray(res.channels) ? (res.channels as LiveTvChannelItem[]) : [];
      setChannels(list);
      if (res.counts) {
        setCounts(res.counts);
      } else {
        setCounts({
          all: list.length,
          BD: list.filter((c) => c.country === 'BD').length,
          BANGLA: list.filter((c) => c.isBangla || c.country === 'BD').length,
          CARTOON: list.filter(
            (c) =>
              c.isCartoon ||
              c.categories.includes('kids') ||
              c.categories.includes('animation')
          ).length,
          PK: list.filter((c) => c.country === 'PK').length,
          IN: list.filter((c) => c.country === 'IN').length,
        });
      }
      // Keep activeChannel synced if user refreshes while watching, otherwise stay in Browse homepage grid
      setActiveChannel((prev) => {
        if (!prev) return null;
        return list.find((c) => c.id === prev.id) || prev;
      });
    } catch (err: any) {
      setCatalogError(err?.message || 'Could not load Live TV channel directory.');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels(false);
  }, [loadChannels]);

  useEffect(() => {
    let cancelled = false;
    if (currentUser) {
      api
        .getMotherlandLivePrefs()
        .then((prefs) => {
          if (!cancelled) {
            setFavoriteIds(prefs.favorites || []);
            setRecentIds(prefs.recent || []);
          }
        })
        .catch(() => {});
    } else {
      try {
        const rawFav = localStorage.getItem(GUEST_FAVS_KEY);
        const rawRec = localStorage.getItem(GUEST_RECENT_KEY);
        if (rawFav) setFavoriteIds(JSON.parse(rawFav));
        if (rawRec) setRecentIds(JSON.parse(rawRec));
      } catch {
        // ignore storage errors
      }
    }
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  // Load social stats (likes + comments) whenever active channel changes
  useEffect(() => {
    if (!activeChannel) return;
    let cancelled = false;
    setLikesCount(0);
    setIsLiked(false);
    setComments([]);
    setShowComments(false);
    setCommentText('');

    api
      .getMotherlandLiveChannelSocial(activeChannel.id)
      .then((social) => {
        if (cancelled) return;
        setLikesCount(Number(social.likesCount || 0));
        setIsLiked(Boolean(social.isLiked));
        setComments(Array.isArray(social.comments) ? social.comments : []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [activeChannel?.id]);

  // Resolve 24/7 YouTube-Live broadcast for channels with streamType === 'youtube_live'
  const resolveYoutubeLiveChannel = useCallback(async (ch: LiveTvChannelItem) => {
    setYtLiveLoading(true);
    setYtLiveError(null);
    setYtLiveVideoId(null);
    try {
      const data = await api.resolveMotherlandYoutubeLive(ch.id);
      if (data?.videoId) {
        setYtLiveVideoId(data.videoId);
      } else {
        setYtLiveError(`${ch.name} live broadcast is currently unavailable.`);
      }
    } catch (err: any) {
      setYtLiveError(err?.message || `${ch.name} live stream is currently offline.`);
    } finally {
      setYtLiveLoading(false);
    }
  }, []);

  // Attach HLS or YouTube Live stream to the top TV player
  useEffect(() => {
    if (!activeChannel) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setYtLiveVideoId(null);
      setYtLiveError(null);
      setStreamError(null);
      return;
    }

    if (activeChannel.streamType === 'youtube_live') {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      setStreamError(null);
      setIsBuffering(false);
      setQualityLevels([]);
      void resolveYoutubeLiveChannel(activeChannel);
      return;
    }

    // HLS stream channel
    setYtLiveVideoId(null);
    setYtLiveError(null);
    setYtLiveLoading(false);

    const video = videoRef.current;
    if (!video) return;

    const currentStream = activeChannel.streams[streamIndex] || activeChannel.streams[0];
    if (!currentStream) {
      setStreamError('No active broadcast stream available for this channel.');
      return;
    }

    const proxiedSrc = buildHlsProxySrc(currentStream);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setStreamError(null);
    setIsBuffering(true);
    setQualityLevels([]);
    setSelectedQuality(-1);

    const handleStreamFailure = () => {
      if (streamIndex + 1 < activeChannel.streams.length) {
        setStreamIndex((idx) => idx + 1);
      } else {
        setIsBuffering(false);
        setIsPlaying(false);
        setStreamError(
          `${activeChannel.name} stream is currently offline or unreachable. Choose another channel logo below.`
        );
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        manifestLoadingTimeOut: 9000,
        manifestLoadingMaxRetry: 1,
        levelLoadingTimeOut: 9000,
        levelLoadingMaxRetry: 1,
        fragLoadingTimeOut: 12000,
      });
      hlsRef.current = hls;

      hls.loadSource(proxiedSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const levels = (data.levels || []).map((lvl, idx) => ({
          index: idx,
          label: lvl.height ? `${lvl.height}p` : `Stream ${idx + 1}`,
        }));
        setQualityLevels(levels);
        setIsBuffering(false);
        video.muted = isMuted;
        video.volume = volume;
        video.play().catch(() => {
          video.muted = true;
          setIsMuted(true);
          video.play().catch(() => {});
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          hls.destroy();
          hlsRef.current = null;
          handleStreamFailure();
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxiedSrc;
      video.addEventListener(
        'loadedmetadata',
        () => {
          setIsBuffering(false);
          video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
        },
        { once: true }
      );
      video.addEventListener('error', handleStreamFailure, { once: true });
    } else {
      setIsBuffering(false);
      setStreamError('Live HLS playback is not supported on this browser.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // ignore video reset errors
      }
    };
  }, [activeChannel?.id, activeChannel?.streamType, streamIndex, resolveYoutubeLiveChannel]);

  const handleSelectChannel = useCallback(
    (ch: LiveTvChannelItem) => {
      setActiveChannel(ch);
      setStreamIndex(0);
      setStreamError(null);
      setYtLiveError(null);

      if (currentUser) {
        api
          .recordMotherlandLiveRecent(ch.id)
          .then((res) => {
            if (Array.isArray(res.recent)) setRecentIds(res.recent);
          })
          .catch(() => {});
      } else {
        setRecentIds((prev) => {
          const next = [ch.id, ...prev.filter((id) => id !== ch.id)].slice(0, 20);
          try {
            localStorage.setItem(GUEST_RECENT_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }

      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentUser]
  );

  const handleToggleLike = async () => {
    if (!activeChannel) return;
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    if (likePending) return;
    setLikePending(true);
    try {
      const res = await api.toggleMotherlandLiveLike(activeChannel.id);
      setLikesCount(res.likesCount);
      setIsLiked(res.isLiked);
    } catch {
      // ignore
    } finally {
      setLikePending(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannel) return;
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    const trimmed = commentText.trim();
    if (!trimmed || commentPending) return;
    setCommentPending(true);
    try {
      const res = await api.addMotherlandLiveComment(activeChannel.id, trimmed);
      if (Array.isArray(res.comments)) {
        setComments(res.comments);
      }
      setCommentText('');
      setShowComments(true);
    } catch {
      // ignore
    } finally {
      setCommentPending(false);
    }
  };

  const handleShareChannel = async () => {
    if (!activeChannel) return;
    const shareUrl = `${window.location.origin}/?live=${encodeURIComponent(activeChannel.id)}`;
    const shareTitle = `${activeChannel.name} — Motherland live`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Watch ${activeChannel.name} Live on Motherland live`,
          url: shareUrl,
        });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleToggleFavorite = async (channelId: string) => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    try {
      const res = await api.toggleMotherlandLiveFavorite(channelId);
      setFavoriteIds(res.favorites || []);
    } catch {
      // ignore
    }
  };

  const handleTogglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  };

  const handleToggleMute = () => {
    const video = videoRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (video) video.muted = nextMuted;
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val > 0 && isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  const handleQualityChange = (lvlIndex: number) => {
    setSelectedQuality(lvlIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvlIndex;
    }
  };

  const handleFullscreen = () => {
    const el = playerContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if (videoRef.current && (videoRef.current as any).webkitEnterFullscreen) {
      (videoRef.current as any).webkitEnterFullscreen();
    }
  };

  const filteredChannels = useMemo(() => {
    let list = channels;

    if (region === 'BANGLA') {
      list = list.filter((ch) => ch.isBangla || ch.country === 'BD');
    } else if (region === 'CARTOON') {
      list = list.filter(
        (ch) =>
          ch.isCartoon ||
          ch.categories.includes('kids') ||
          ch.categories.includes('animation')
      );
    } else if (region !== 'all') {
      list = list.filter((ch) => ch.country === region);
    }

    if (category === 'saved') {
      const favSet = new Set(favoriteIds);
      list = list.filter((ch) => favSet.has(ch.id));
    } else if (category === 'cartoon') {
      list = list.filter(
        (ch) =>
          ch.isCartoon ||
          ch.categories.includes('kids') ||
          ch.categories.includes('animation')
      );
    } else if (category !== 'all') {
      list = list.filter((ch) => ch.categories.some((c) => c.toLowerCase() === category));
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (ch) =>
          ch.name.toLowerCase().includes(q) ||
          ch.country.toLowerCase().includes(q) ||
          (COUNTRY_NAMES[ch.country] || '').toLowerCase().includes(q) ||
          ch.categories.some((c) => c.toLowerCase().includes(q))
      );
    }

    return list;
  }, [channels, region, category, searchQuery, favoriteIds]);

  const isCurrentFav = activeChannel ? favoriteIds.includes(activeChannel.id) : false;

  const getRegionCount = (id: LiveRegion): number => {
    if (id === 'all') return counts.all;
    if (id === 'BD') return counts.BD;
    if (id === 'BANGLA') return counts.BANGLA;
    if (id === 'CARTOON') return counts.CARTOON;
    if (id === 'PK') return counts.PK;
    return counts.IN;
  };

  return (
    <div
      data-testid="motherland-live-view"
      className="min-h-[calc(100vh-56px)] bg-[#0A0C10] text-[#F8FAFC] pb-14"
    >
      {/* 1. YouTube-Style Sticky Header with Integrated Live TV Search */}
      <div className="sticky top-0 z-30 bg-[#0A0C10]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 h-14 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (activeChannel) {
                  setActiveChannel(null);
                } else {
                  onBack();
                }
              }}
              data-testid="motherland-live-back-btn"
              aria-label={activeChannel ? 'Back to all channels' : 'Back to MOTHERLAND'}
              className="min-w-[44px] min-h-[44px] -ml-1.5 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveChannel(null)}
              className="flex items-center gap-2.5 min-w-0 text-left group"
            >
              <div className="w-9 h-9 rounded-xl bg-rose-600/15 border border-rose-500/30 flex items-center justify-center shrink-0">
                <MotherlandLiveIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white group-hover:text-rose-400 transition-colors truncate leading-tight">
                  Motherland live
                </h1>
                <p className="text-[11px] text-slate-400 truncate leading-tight tabular-nums">
                  {counts.all > 0 ? `${counts.all} Live TV Channels` : 'Live Television'}
                </p>
              </div>
            </button>
          </div>

          {/* Desktop Integrated YouTube-Style Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${counts.all || 420} Live TV channels (Somoy, Cartoon Network...)`}
              className="w-full h-10 pl-10 pr-9 rounded-full bg-[#131720] border border-white/15 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear channel search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeChannel && (
              <button
                type="button"
                onClick={() => setActiveChannel(null)}
                className="min-h-[40px] px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">All Channels</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => loadChannels(true)}
              disabled={isLoadingCatalog}
              aria-label="Refresh channels"
              className="min-w-[44px] min-h-[44px] rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingCatalog ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 pt-4 space-y-5">
        {/* ============================================================
            WATCH MODE: Only shown when user selects a channel!
            Selected channel moves to the Top 16:9 Player with
            Like, Comment, Share & Save bar right underneath.
           ============================================================ */}
        {activeChannel && (
          <section
            ref={playerContainerRef}
            data-testid="motherland-live-player-section"
            className="rounded-2xl overflow-hidden bg-[#131720] border border-white/10 shadow-2xl"
          >
            {/* 16:9 Live TV Viewport */}
            <div className="relative w-full aspect-video max-h-[68vh] bg-black overflow-hidden">
              {activeChannel.streamType === 'youtube_live' ? (
                <>
                  {ytLiveVideoId ? (
                    <iframe
                      key={ytLiveVideoId}
                      src={buildYouTubeEmbedUrl(ytLiveVideoId, {
                        autoplay: true,
                        controls: true,
                        mute: false,
                      })}
                      title={`${activeChannel.name} Live TV`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  ) : null}

                  {ytLiveLoading && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2.5">
                      <Loader2 className="w-9 h-9 text-rose-500 animate-spin" />
                      <p className="text-xs font-semibold text-white">
                        Connecting {activeChannel.name} 24/7 Live Broadcast...
                      </p>
                    </div>
                  )}

                  {ytLiveError && !ytLiveLoading && (
                    <div className="absolute inset-0 bg-[#0A0C10]/95 flex flex-col items-center justify-center gap-3 p-5 text-center">
                      <ChannelLogoBadge
                        logo={activeChannel.logo}
                        name={activeChannel.name}
                        sizeClass="w-16 h-16"
                      />
                      <div className="space-y-1 max-w-md">
                        <p className="text-sm font-semibold text-white">{activeChannel.name}</p>
                        <p className="text-xs text-slate-400">{ytLiveError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => resolveYoutubeLiveChannel(activeChannel)}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                      >
                        Retry Live Broadcast
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    onPlaying={() => {
                      setIsPlaying(true);
                      setIsBuffering(false);
                      setStreamError(null);
                    }}
                    onPause={() => setIsPlaying(false)}
                    onWaiting={() => setIsBuffering(true)}
                    onClick={handleTogglePlayPause}
                    className="w-full h-full object-contain bg-black cursor-pointer"
                  />

                  {isBuffering && !streamError && (
                    <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2.5 pointer-events-none">
                      <Loader2 className="w-9 h-9 text-rose-500 animate-spin" />
                      <p className="text-xs font-semibold text-white">
                        Tuning {activeChannel.name}...
                      </p>
                    </div>
                  )}

                  {streamError && (
                    <div className="absolute inset-0 bg-[#0A0C10]/90 flex flex-col items-center justify-center gap-3 p-5 text-center">
                      <ChannelLogoBadge
                        logo={activeChannel.logo}
                        name={activeChannel.name}
                        sizeClass="w-16 h-16"
                      />
                      <div className="space-y-1 max-w-md">
                        <p className="text-sm font-semibold text-white">{activeChannel.name}</p>
                        <p className="text-xs text-slate-400">{streamError}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStreamError(null);
                          setStreamIndex((i) => (i + 1) % Math.max(1, activeChannel.streams.length));
                        }}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors"
                      >
                        Retry Live Stream
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Top-Left LIVE Overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-400">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  LIVE
                </span>
                <span className="text-xs font-semibold text-white truncate max-w-[180px] sm:max-w-xs">
                  {activeChannel.name}
                </span>
              </div>
            </div>

            {/* Channel Header + Playback Controls */}
            <div className="px-3.5 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <ChannelLogoBadge
                  logo={activeChannel.logo}
                  name={activeChannel.name}
                  sizeClass="w-12 h-12"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-white truncate">
                      {activeChannel.name}
                    </h2>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 shrink-0">
                      <Radio className="w-3 h-3" /> LIVE TV
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">
                    {COUNTRY_NAMES[activeChannel.country] || activeChannel.country}
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="capitalize">{activeChannel.categories.join(', ')}</span>
                  </p>
                </div>
              </div>

              {activeChannel.streamType !== 'youtube_live' && (
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handleTogglePlayPause}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMute}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                    aria-label="Volume"
                    className="w-20 accent-rose-500 hidden sm:block cursor-pointer"
                  />

                  {qualityLevels.length > 1 && (
                    <select
                      value={selectedQuality}
                      onChange={(e) => handleQualityChange(Number(e.target.value))}
                      aria-label="Stream quality"
                      className="h-[42px] px-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value={-1} className="bg-[#131720]">
                        Auto
                      </option>
                      {qualityLevels.map((lvl) => (
                        <option key={lvl.index} value={lvl.index} className="bg-[#131720]">
                          {lvl.label}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={handleFullscreen}
                    aria-label="Fullscreen"
                    className="min-w-[42px] min-h-[42px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-colors"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* ============================================================
                LIKE · COMMENT · SHARE · SAVE ACTION BAR DIRECTLY BELOW VIDEO
               ============================================================ */}
            <div className="px-3.5 sm:px-5 py-2.5 border-t border-white/10 bg-[#0E121A] flex items-center gap-2 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={likePending}
                data-testid="live-like-btn"
                className={`min-h-[44px] px-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  isLiked
                    ? 'bg-rose-600/20 border-rose-500/50 text-rose-400'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                }`}
              >
                <ThumbsUp className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                <span>Like</span>
                <span className="tabular-nums opacity-85">{likesCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowComments((v) => !v)}
                data-testid="live-comment-btn"
                className={`min-h-[44px] px-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  showComments
                    ? 'bg-white text-[#0A0C10] border-white'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                <span>Comment</span>
                <span className="tabular-nums opacity-85">{comments.length}</span>
              </button>

              <button
                type="button"
                onClick={handleShareChannel}
                data-testid="live-share-btn"
                className="min-h-[44px] px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                {shareCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Link Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleToggleFavorite(activeChannel.id)}
                data-testid="live-save-btn"
                className={`min-h-[44px] px-4 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  isCurrentFav
                    ? 'bg-rose-600/20 border-rose-500/50 text-rose-400'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isCurrentFav ? 'fill-current' : ''}`} />
                <span>{isCurrentFav ? 'Saved' : 'Save'}</span>
              </button>
            </div>

            {/* Expandable Inline Comments Panel */}
            {showComments && (
              <div
                data-testid="live-comments-panel"
                className="px-3.5 sm:px-5 py-4 border-t border-white/10 bg-[#0B0E14] space-y-4"
              >
                <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={
                      currentUser
                        ? `Comment on ${activeChannel.name}...`
                        : 'Sign in to write a live comment...'
                    }
                    className="flex-1 h-11 px-3.5 rounded-xl bg-[#131720] border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="submit"
                    disabled={commentPending || (!commentText.trim() && Boolean(currentUser))}
                    className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{currentUser ? 'Post' : 'Sign in'}</span>
                  </button>
                </form>

                {comments.length === 0 ? (
                  <p className="text-xs text-slate-400 py-1">
                    No comments yet on {activeChannel.name}. Be the first to share your thoughts.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {comments.map((c) => (
                      <div key={c.id} className="flex items-start gap-2.5">
                        {c.authorAvatar ? (
                          <img
                            src={c.authorAvatar}
                            alt={c.authorName}
                            referrerPolicy="no-referrer"
                            className="w-8 h-8 rounded-full object-cover shrink-0 bg-slate-800"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-rose-600/25 border border-rose-500/30 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {c.authorName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-white truncate">
                              {c.authorName}
                            </span>
                            <span className="text-[11px] text-slate-500 shrink-0">
                              {formatCommentTime(c.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-300 mt-0.5 break-words">
                            {c.text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ============================================================
            FILTER BAR (Mobile Search + Region Chips + Category Chips)
           ============================================================ */}
        <section className="space-y-2.5">
          {/* Mobile Search Input */}
          <div className="relative w-full md:hidden">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${counts.all || 420} Live TV channels...`}
              className="w-full h-11 pl-10 pr-9 rounded-xl bg-[#131720] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear channel search"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Region & Special Filter Tabs (Bangladesh, Bangla TV, Cartoon & Kids, PK, IN) */}
          <div
            role="tablist"
            aria-label="Channel region and collection"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          >
            {REGION_TABS.map((tab) => {
              const active = region === tab.id;
              const tabCount = getRegionCount(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRegion(tab.id)}
                  className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                    active
                      ? 'bg-rose-600 text-white border-rose-500'
                      : 'bg-[#131720] text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tabCount > 0 && (
                    <span className="ml-1.5 tabular-nums opacity-80">({tabCount})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Category Tabs */}
          <div
            role="tablist"
            aria-label="Channel category"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
          >
            {CATEGORY_TABS.map((tab) => {
              const active = category === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(tab.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                    active
                      ? 'bg-white text-[#0A0C10] border-white'
                      : 'bg-[#131720] text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.id === 'saved' && favoriteIds.length > 0 && (
                    <span className="ml-1.5 tabular-nums opacity-75">({favoriteIds.length})</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Catalog Error */}
        {catalogError && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-rose-200">{catalogError}</p>
            <button
              type="button"
              onClick={() => loadChannels(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* ============================================================
            CHANNEL DIRECTORY:
            - When NO channel is active: YouTube Homepage-style rich 16:9 cards with Logos
            - When a channel IS active: Clean logo grid below the running video for instant switching
           ============================================================ */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-bold text-white">
              {activeChannel
                ? 'Switch Channel While Watching'
                : 'Live TV Channels'}
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {filteredChannels.length} channels
            </span>
          </div>

          {isLoadingCatalog ? (
            <div
              className={
                activeChannel
                  ? 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3'
                  : 'grid grid-cols-3 gap-2 sm:gap-3.5 md:gap-4'
              }
            >
              {Array.from({ length: activeChannel ? 18 : 12 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl sm:rounded-2xl bg-[#131720] border border-white/10 p-2 sm:p-3 flex flex-col gap-2 sm:gap-3 animate-pulse"
                >
                  <div className={activeChannel ? 'h-12 w-12 sm:h-14 sm:w-14 mx-auto rounded-xl bg-white/10' : 'aspect-video w-full rounded-lg sm:rounded-xl bg-white/10'} />
                  <div className="h-3 sm:h-3.5 w-3/4 rounded bg-white/10" />
                  <div className="h-2.5 sm:h-3 w-1/2 rounded bg-white/5" />
                </div>
              ))}
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#131720] border border-white/10 text-center space-y-3">
              <Tv className="w-9 h-9 text-slate-500 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">No matching channels found</p>
                <p className="text-xs text-slate-400">
                  {category === 'saved'
                    ? 'Save any channel while watching to find it quickly here.'
                    : 'Try clearing your search or switching to All Channels.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setRegion('all');
                  setCategory('all');
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              >
                Show All Channels
              </button>
            </div>
          ) : activeChannel ? (
            /* WATCH MODE: Logo tiles below running video (3 per row on mobile, 4-6 on wider screens) */
            <div
              data-testid="live-channel-switcher-grid"
              className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3"
            >
              {filteredChannels.map((ch) => {
                const isSelected = activeChannel.id === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSelectChannel(ch)}
                    data-testid={`live-channel-card-${ch.id}`}
                    className={`group relative rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center text-center gap-1.5 sm:gap-2 border transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-rose-600/15 border-rose-500 ring-1 ring-rose-500/40'
                        : 'bg-[#131720] border-white/10 hover:border-white/25 hover:bg-white/[0.04]'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    )}

                    <ChannelLogoBadge
                      logo={ch.logo}
                      name={ch.name}
                      sizeClass="w-12 h-12 sm:w-16 sm:h-16"
                    />

                    <div className="w-full min-w-0 space-y-0.5">
                      <p
                        className={`text-[11px] sm:text-xs font-semibold truncate ${
                          isSelected ? 'text-rose-300' : 'text-white group-hover:text-rose-300'
                        }`}
                      >
                        {ch.name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {COUNTRY_NAMES[ch.country] || ch.country} · {ch.categories[0] || 'TV'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* BROWSE MODE: Strictly 3 columns across (3 lines side-by-side) YouTube-style Live TV cards */
            <div
              data-testid="live-homepage-grid"
              className="grid grid-cols-3 gap-2 sm:gap-3.5 md:gap-4"
            >
              {filteredChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleSelectChannel(ch)}
                  data-testid={`live-channel-card-${ch.id}`}
                  className="group text-left rounded-xl sm:rounded-2xl overflow-hidden bg-[#131720] border border-white/10 hover:border-rose-500/40 transition-all active:scale-[0.99] flex flex-col min-w-0"
                >
                  {/* 16:9 YouTube-style Broadcast Preview Card displaying the official Channel Logo */}
                  <div className="relative aspect-video w-full bg-gradient-to-br from-[#171C28] via-[#10141D] to-[#0B0E14] flex items-center justify-center p-2 sm:p-5 overflow-hidden">
                    <ChannelLogoBadge
                      logo={ch.logo}
                      name={ch.name}
                      sizeClass="w-11 h-11 min-[420px]:w-14 min-[420px]:h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 group-hover:scale-105 transition-transform duration-200"
                    />

                    <div className="absolute bottom-1.5 right-1.5 sm:bottom-2.5 sm:right-2.5 px-1.5 sm:px-2 py-0.5 rounded bg-rose-600 text-white text-[9px] sm:text-[10px] font-bold tracking-wide flex items-center gap-1 shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>
                  </div>

                  {/* Card Footer: Channel Avatar (sm+) + Channel Title + Metadata */}
                  <div className="p-2 sm:p-3 flex items-start gap-2 sm:gap-3 min-w-0">
                    <div className="hidden sm:block shrink-0">
                      <ChannelLogoBadge
                        logo={ch.logo}
                        name={ch.name}
                        sizeClass="w-9 h-9 md:w-10 md:h-10"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[11px] sm:text-sm font-bold text-white group-hover:text-rose-400 transition-colors truncate">
                        {ch.name}
                      </h3>
                      <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5 truncate">
                        {COUNTRY_NAMES[ch.country] || ch.country}
                        <span className="hidden sm:inline mx-1.5 text-slate-600">·</span>
                        <span className="hidden sm:inline capitalize">
                          {ch.isCartoon ? 'Cartoon & Kids' : ch.categories[0] || 'Live TV'}
                        </span>
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recently Tuned Channels */}
        {recentIds.length > 0 && channels.length > 0 && category !== 'saved' && (
          <section className="pt-3 border-t border-white/10 space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-400">Recently Watched Channels</h3>
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {recentIds
                .map((id) => channels.find((c) => c.id === id))
                .filter((ch): ch is LiveTvChannelItem => Boolean(ch))
                .slice(0, 12)
                .map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSelectChannel(ch)}
                    className="shrink-0 px-3 py-2 rounded-xl bg-[#131720] border border-white/10 hover:border-white/25 flex items-center gap-2.5 text-left transition-colors"
                  >
                    <ChannelLogoBadge logo={ch.logo} name={ch.name} sizeClass="w-8 h-8" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate max-w-[120px]">
                        {ch.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {COUNTRY_NAMES[ch.country] || ch.country}
                      </p>
                    </div>
                  </button>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
