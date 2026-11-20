/**
 * MOTHERLAND YouTube — Complete Integration, Full-Width Interface,
 * Mobile Optimization, Shorts Natural Swipe & Gesture Navigation Upgrade
 *
 * Requirements Met:
 * 1. Strict Preservation: Preserves all other MOTHERLAND sections, auth, APIs & platform routing.
 * 2. Section Branding: Displays "MOTHERLAND YouTube" with YouTube red logo and BD tag.
 * 3. Complete Navigation: Home, Shorts, Subscriptions, History, Playlists, Your Videos,
 *    Saved Videos, Explore, Trending, Music, Gaming, Sports via responsive Drawer & Bottom Nav.
 * 4. Create (+) Button: Center of mobile bottom nav & desktop header, opens upload & Shorts creator.
 * 5. Real Google OAuth & Channel Profile: Signs in with Google, fetches actual channel profile & metrics.
 * 6. Real Upload Confirmation: videos.insert resumable upload, progress, returns videoId, watch URL.
 * 7. Authorized Music: Royalty-free YouTube Audio Library catalog with preview and licensing info.
 * 8. Responsive Feed & Playback: 16:9 horizontal videos, 9:16 vertical Shorts, live fallback search.
 * 9. Mobile Full-Screen Optimization: 100dvh, edge-to-edge layout, zero horizontal overflow or black side margins.
 * 10. Natural Finger Swipe Shorts: Swipe UP for next Short, Swipe DOWN for previous Short, arrow keys, wheel.
 * 11. Android Back Button & Edge Swipe: Accessible 44px top Back button, left/right edge swipe, popstate integration.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Youtube,
  Play,
  Share2,
  Sparkles,
  Loader2,
  TrendingUp,
  Flame,
  Compass,
  Film,
  Clock,
  ListVideo,
  User,
  Upload,
  Video as VideoIcon,
  Bell,
  Settings as SettingsIcon,
  ThumbsUp,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Trash2,
  X,
  Plus,
  Send,
  Radio,
  FileVideo,
  Lock,
  Globe,
  ArrowLeft,
  Maximize,
  Minimize,
  RefreshCw,
  Gamepad2,
  Trophy,
  Music,
  Menu,
  ChevronRight,
  ShieldCheck,
  Disc3,
  Bookmark,
  History,
  Pencil,
  AlertCircle,
  EyeOff,
} from 'lucide-react';
import { UnifiedVideo } from '../../types/video';
import { FireLikeIcon, TalkIcon, BoostIcon, PulseIcon } from '../fire/MotherlandIcons';
import { FireEmojiPicker } from '../fire/FireEmojiPicker';
import { FireRichText } from '../fire/FireRichText';
import { FireDraftPreview, FirePickerTrigger } from '../fire/FireComposerBar';
import {
  CollapsibleDescription,
  TranslatableText,
} from '../common/ExpandableTranslatableText';
import { VideoBrandOverlay } from '../common/VideoBrandOverlay';
import {
  buildYouTubeEmbedUrl,
  sendYTCommand,
  registerYTListeningHandshake,
  parseYTInfoMessage,
  recordVideoSwitchMetric,
} from '../../utils/youtubePlayerBridge';
import { buildMotherlandVideoShareUrl, warmVideoThumbnail } from '../../utils/videoShareLinks';
import {
  searchYouTubeChannels,
  searchYouTubePlaylists,
  getYouTubeVideoComments,
  getYouTubeSearchHistory,
  addYouTubeSearchHistory,
  clearYouTubeSearchHistory,
  getStudioUploadedVideos,
  deleteStudioUploadedVideo,
  fetchMyYouTubeChannelVideos,
  updateMyYouTubeVideo,
  deleteMyYouTubeVideo,
  YouTubeChannelItem,
  YouTubePlaylistItem,
  YouTubeCommentItem,
  StudioUploadedVideo,
  YouTubeManagedVideo,
} from '../../services/youtubeService';
import {
  GoogleAuthUser,
  getStoredGoogleAuth,
} from '../../services/youtubeAuthService';
import {
  filterUnsuppressed,
  recordWatchedSuppression,
  WATCH_SUPPRESSED_EVENT,
} from '../../services/watchSuppression';
import { api } from '../../api';
import type { SavedVideoItem } from '../../types';
import { YouTubeShortsFeed } from './YouTubeShortsFeed';
import { YouTubeCreateModal } from './YouTubeCreateModal';
import { YouTubeAccountModal } from './YouTubeAccountModal';


export type YouTubeNavSection =
  | 'home'
  | 'shorts'
  | 'subscriptions'
  | 'history'
  | 'playlists'
  | 'my_channel'
  | 'my_uploads'
  | 'saved_videos'
  | 'explore'
  | 'trending'
  | 'music'
  | 'gaming'
  | 'sports'
  | 'studio'
  | 'notifications'
  | 'settings';

interface YouTubeFullExperienceProps {
  onOpenVideoDetails?: (video: UnifiedVideo) => void;
  onOpenAddVideo?: () => void;
  onOpenVerticalShorts?: () => void;
  onBackToMotherland?: () => void;
  refreshSignal?: number;
}

function mapApiItemToUnifiedVideo(item: any): UnifiedVideo {
  const videoId = String(item?.youtubeId || item?.videoId || item?.id || '').replace(/^yt_/, '');
  return {
    id: `yt_${videoId}`,
    platform: 'youtube',
    videoId,
    title: String(item?.title || 'YouTube Video'),
    creatorName: String(item?.channel?.title || item?.creatorName || 'YouTube Creator'),
    creatorAvatar: item?.channel?.avatar || item?.creatorAvatar || '',
    originalVideoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    thumbnailUrl:
      item?.thumbnailUrl ||
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: item?.duration || undefined,
    publishedAt: item?.publishedAt
      ? new Date(item.publishedAt).toLocaleDateString()
      : 'YouTube',
    playbackAvailability: 'playable_embed',
    aspectRatio: '16:9',
    category: 'bangladesh',
    description: String(item?.description || ''),
    sourceMetadata: {
      isOfficialEmbed: true,
      channelId: String(item?.channel?.id || ''),
    },
  };
}

export const YouTubeFullExperience: React.FC<YouTubeFullExperienceProps> = ({
  onOpenVideoDetails,
  onBackToMotherland,
  refreshSignal = 0,
}) => {
  // Navigation State
  const [activeNav, setActiveNav] = useState<YouTubeNavSection>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ytSubRefreshSignal, setYtSubRefreshSignal] = useState(0);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType] = useState<'video' | 'channel' | 'playlist'>('video');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [, setChannelResults] = useState<YouTubeChannelItem[]>([]);
  const [playlistResults, setPlaylistResults] = useState<YouTubePlaylistItem[]>([]);

  // Feed Videos & Playback State (ALWAYS starts on clean Browse Grid: activeVideo = null)
  const [videos, setVideos] = useState<UnifiedVideo[]>([]);
  const [activeVideo, setActiveVideo] = useState<UnifiedVideo | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [feedPage, setFeedPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [exhaustedReason, setExhaustedReason] = useState<string | null>(null);
  const [feedMode, setFeedMode] = useState<'category' | 'search'>('category');
  const [activeCategory, setActiveCategory] = useState<string>('home');
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChip, setSelectedChip] = useState('🔥 ট্রেন্ডিং বাংলাদেশ');
  const [activeQuery, setActiveQuery] = useState('');
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Authenticated YouTube Channel State
  const [authUser, setAuthUser] = useState<GoogleAuthUser | null>(getStoredGoogleAuth());
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  // Create (+) Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Studio Uploaded Videos & Live Channel Video Management State
  const [studioVideos, setStudioVideos] = useState<StudioUploadedVideo[]>([]);
  const [channelVideos, setChannelVideos] = useState<YouTubeManagedVideo[]>([]);
  const [isLoadingChannelVideos, setIsLoadingChannelVideos] = useState(false);
  const [channelVideosError, setChannelVideosError] = useState<string | null>(null);
  const [editingVideo, setEditingVideo] = useState<YouTubeManagedVideo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingVideo, setDeletingVideo] = useState<YouTubeManagedVideo | null>(null);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);
  const [savedVideosList, setSavedVideosList] = useState<SavedVideoItem[]>([]);
  const [studioNotice, setStudioNotice] = useState<string | null>(null);

  // Active Video Comments & Likes State
  const [comments, setComments] = useState<YouTubeCommentItem[]>([]);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [firePickerOpen, setFirePickerOpen] = useState(false);
  const [likedVideos, setLikedVideos] = useState<Record<string, boolean>>({});
  const [subscribedChannels, setSubscribedChannels] = useState<Record<string, boolean>>({});

  // Real Notifications State (hydrated from MOTHERLAND backend when signed in)
  const [notifications, setNotifications] = useState<
    Array<{ id: string; title: string; channel: string; time: string; read: boolean }>
  >([]);

  // Fullscreen & Persistent Watch Player Reuse State
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const ytWatchIframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytWatchBoundIdRef = useRef<string>('');
  const ytSwitchStartRef = useRef<number>(performance.now());
  const ytMetricLoggedIdRef = useRef<string>('');
  const [ytBaseWatchSrc, setYtBaseWatchSrc] = useState<string>('');
  const [ytFrameReady, setYtFrameReady] = useState(false);
  const [ytIsPlaying, setYtIsPlaying] = useState(true);
  const [ytIsBuffering, setYtIsBuffering] = useState(true);

  // Infinite Scroll, Request Cancellation & Deduplication Refs
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const feedAbortRef = useRef<AbortController | null>(null);
  const isFetchingMoreRef = useRef<boolean>(false);
  const lastRefreshAtRef = useRef<number>(Date.now());
  const activeVideoRef = useRef<UnifiedVideo | null>(activeVideo);
  activeVideoRef.current = activeVideo;

  // 9 Discovery Chips
  const discoveryChips = [
    { label: '🔥 ট্রেন্ডিং বাংলাদেশ', q: 'Bangladesh trending music news' },
    { label: '⚡ জনপ্রিয় ভিডিও', q: 'Most viewed viral videos 2026' },
    { label: '🎵 কোক স্টুডিও বাংলা', q: 'Coke Studio Bangla' },
    { label: '🎭 বাংলা নাটক', q: 'Bangla Natok' },
    { label: '🏏 বাংলাদেশ ক্রিকেট', q: 'Bangladesh Cricket Tigers match highlights' },
    { label: '🎓 শিক্ষা ও প্রযুক্তি', q: 'Bangla educational documentary science' },
    { label: '📰 সংবাদ ও খবর', q: 'Bangladesh breaking news updates' },
    { label: '🏛️ সুন্দরবন ও ভ্রমণ', q: 'Sundarbans Bangladesh travel documentary' },
    { label: '🎮 গেমিং ও লাইভ', q: 'Top gaming highlights stream' },
  ];

  // Refresh studio videos, search history & real notifications
  useEffect(() => {
    setStudioVideos(getStudioUploadedVideos());
    setSearchHistory(getYouTubeSearchHistory());
    if (api.getToken()) {
      api
        .getNotifications()
        .then((res) => {
          const mapped = (res.notifications || []).slice(0, 20).map((n) => ({
            id: n.id,
            title: n.body || n.title || 'MOTHERLAND update',
            channel: n.sender?.displayName || 'MOTHERLAND',
            time: n.createdAt ? new Date(n.createdAt).toLocaleDateString() : 'Recent',
            read: Boolean(n.isRead),
          }));
          setNotifications(mapped);
        })
        .catch(() => {});
    }
  }, []);

  // Load real YouTube channel videos for Studio / Your Videos / Your Channel
  const loadChannelVideos = useCallback(async () => {
    setIsLoadingChannelVideos(true);
    setChannelVideosError(null);
    try {
      const res = await fetchMyYouTubeChannelVideos(authUser?.accessToken);
      setChannelVideos(res.videos || []);
    } catch (err: any) {
      setChannelVideosError(
        err?.message || 'Sign in with your Google account to manage your YouTube channel videos.'
      );
    } finally {
      setIsLoadingChannelVideos(false);
    }
  }, [authUser?.accessToken]);

  useEffect(() => {
    if (authUser?.accessToken || api.getToken()) {
      loadChannelVideos();
    }
  }, [authUser?.accessToken, loadChannelVideos]);

  // Reuse persistent Watch iframe across video switches via loadVideoById & fetch comments/sub status
  useEffect(() => {
    if (!activeVideo?.videoId) {
      setComments([]);
      ytWatchBoundIdRef.current = '';
      setYtBaseWatchSrc('');
      setYtFrameReady(false);
      setYtIsBuffering(false);
      return;
    }

    ytSwitchStartRef.current = performance.now();
    ytMetricLoggedIdRef.current = '';
    setYtFrameReady(false);
    setYtIsPlaying(true);
    setYtIsBuffering(true);
    if (activeVideo.thumbnailUrl) warmVideoThumbnail(activeVideo.thumbnailUrl);
    videos.filter((v) => v.videoId !== activeVideo.videoId).slice(0, 4).forEach((v) => warmVideoThumbnail(v.thumbnailUrl));

    if (!ytBaseWatchSrc) {
      ytWatchBoundIdRef.current = activeVideo.videoId;
      setYtBaseWatchSrc(
        buildYouTubeEmbedUrl(activeVideo.videoId, {
          autoplay: true,
          controls: true,
          loop: false,
          mute: false,
          nocookie: true,
        })
      );
    } else if (ytWatchBoundIdRef.current !== activeVideo.videoId) {
      ytWatchBoundIdRef.current = activeVideo.videoId;
      sendYTCommand(ytWatchIframeRef.current, 'loadVideoById', [
        { videoId: activeVideo.videoId, startSeconds: 0 },
      ]);
    }

    const revealTimer = window.setTimeout(() => {
      setYtFrameReady(true);
      setYtIsBuffering(false);
    }, 2400);

    setActionNotice(null);
    getYouTubeVideoComments(activeVideo.videoId, 15).then((cmts) => {
      setComments(cmts);
    });
    const channelId = String(activeVideo.sourceMetadata?.channelId || '');
    if (channelId && api.getToken()) {
      api
        .getYouTubeSubscriptionStatus(channelId)
        .then((res) => {
          setSubscribedChannels((prev) => ({
            ...prev,
            [activeVideo.creatorName]: Boolean(res.subscribed),
          }));
        })
        .catch(() => {});
    }

    return () => window.clearTimeout(revealTimer);
  }, [activeVideo?.videoId, activeVideo?.creatorName, activeVideo?.sourceMetadata?.channelId]);

  // Listen to YouTube Watch iframe playerState for pause/buffering overlay & ready detection
  useEffect(() => {
    if (!activeVideo?.videoId) return;
    const expectedId = activeVideo.videoId;
    const onMessage = (event: MessageEvent) => {
      const parsed = parseYTInfoMessage(event, ytWatchIframeRef.current);
      if (!parsed) return;
      if (parsed.videoId && parsed.videoId !== expectedId) return;
      if (typeof parsed.playerState === 'number') {
        if (parsed.playerState === 1) {
          setYtIsPlaying(true);
          setYtIsBuffering(false);
          setYtFrameReady(true);
          if (ytMetricLoggedIdRef.current !== expectedId) {
            ytMetricLoggedIdRef.current = expectedId;
            recordVideoSwitchMetric({
              player: 'yt_watch',
              videoId: expectedId,
              reusedPlayer: Boolean(ytBaseWatchSrc),
              startupMs: Math.round(performance.now() - ytSwitchStartRef.current),
            });
          }
        } else if (parsed.playerState === 2) {
          setYtIsPlaying(false);
          setYtIsBuffering(false);
          setYtFrameReady(true);
        } else if (parsed.playerState === 3) {
          setYtIsBuffering(true);
        } else if (parsed.playerState === 5) {
          setYtFrameReady(true);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [activeVideo?.videoId, ytBaseWatchSrc]);

  // Suppress active YouTube video after 6 seconds of playback so it stays hidden for 14 days
  useEffect(() => {
    if (!activeVideo?.videoId) return;
    if (
      activeNav !== 'home' &&
      activeNav !== 'explore' &&
      activeNav !== 'trending' &&
      activeNav !== 'music' &&
      activeNav !== 'gaming' &&
      activeNav !== 'sports'
    ) {
      return;
    }

    const watchedTarget = activeVideo;
    const timer = window.setTimeout(() => {
      recordWatchedSuppression(watchedTarget.id, watchedTarget.videoId);
      if (api.getToken()) {
        api
          .recordWatchProgress({
            videoId: watchedTarget.id,
            youtubeId: watchedTarget.videoId,
            videoType: 'long',
            source: 'youtube',
            title: watchedTarget.title,
            thumbnailUrl: watchedTarget.thumbnailUrl,
            channelTitle: watchedTarget.creatorName,
            duration: watchedTarget.duration || '0:00',
            watchSeconds: 10,
            durationSeconds: 60,
            completed: false,
          })
          .catch(() => {});
      }
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [activeVideo?.videoId, activeNav]);

  // Prune suppressed videos live when watch suppression fires (keep currently playing activeVideo until switched)
  useEffect(() => {
    const onSuppressed = () => {
      const currentId = activeVideoRef.current?.videoId;
      setVideos((prev) =>
        prev.filter((v) => {
          if (currentId && v.videoId === currentId) return true;
          return filterUnsuppressed([{ id: v.id, youtubeId: v.videoId }]).length > 0;
        })
      );
    };
    window.addEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
    return () => window.removeEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
  }, []);

  // Core Feed Loader via MOTHERLAND Backend (supports >200 videos cursor chaining, AbortController & zero auto-select)
  const loadCategoryOrSearchFeed = useCallback(
    async (opts: {
      mode: 'category' | 'search';
      category?: string;
      query?: string;
      refresh?: boolean;
      silent?: boolean;
    }) => {
      const isRefreshCall = opts.refresh !== false;
      feedAbortRef.current?.abort();
      const controller = new AbortController();
      feedAbortRef.current = controller;

      if (isRefreshCall) {
        if (!opts.silent) setIsLoadingInitial(true);
        setFeedError(null);
        setExhaustedReason(null);
        seenIdsRef.current.clear();
        setFeedPage(1);
        setHasMore(true);
      }

      try {
        let mapped: UnifiedVideo[] = [];
        let nextToken: string | undefined;
        let nextHasMore = true;
        let quotaMsg: string | null = null;

        if (opts.mode === 'category') {
          const cat = opts.category || 'home';
          const res = await api.getYouTubeFeed({
            type: 'long',
            category: cat,
            page: 1,
            pageSize: 20,
            signal: controller.signal,
          });
          mapped = (res.items || []).map(mapApiItemToUnifiedVideo);
          nextToken = res.nextPageToken || undefined;
          nextHasMore = res.hasMore !== false;
          if (res.quotaExceeded) {
            quotaMsg = res.exhaustedReason || 'YouTube API quota limit reached.';
          } else if (!nextHasMore && res.exhaustedReason) {
            quotaMsg = res.exhaustedReason;
          }
        } else {
          const q = (opts.query || 'Bangladesh trending').trim();
          const res = await api.searchYouTube(q, '', 20, '', {
            continuous: true,
            signal: controller.signal,
          });
          mapped = (res.items || []).map(mapApiItemToUnifiedVideo);
          nextToken = res.nextPageToken || undefined;
          nextHasMore = Boolean(nextToken);
          if (res.quotaFallback || res.message) {
            quotaMsg = res.message || null;
          }
        }

        if (controller.signal.aborted) return;

        const filteredRaw = filterUnsuppressed(
          mapped.map((v) => ({ ...v, youtubeId: v.videoId }))
        );

        const uniqueVideos: UnifiedVideo[] = [];
        for (const v of filteredRaw) {
          if (v.videoId && !seenIdsRef.current.has(v.id) && !seenIdsRef.current.has(v.videoId)) {
            seenIdsRef.current.add(v.id);
            seenIdsRef.current.add(v.videoId);
            uniqueVideos.push(v);
          }
        }

        if (uniqueVideos.length > 0 || !opts.silent) {
          setVideos((prev) => {
            const currentActive = activeVideoRef.current;
            if (!currentActive) return uniqueVideos;
            const hasActive = uniqueVideos.some((v) => v.videoId === currentActive.videoId);
            if (hasActive) return uniqueVideos;
            const existingActive = prev.find((v) => v.videoId === currentActive.videoId) || currentActive;
            return [existingActive, ...uniqueVideos];
          });
        }
        setNextPageToken(nextToken);
        setFeedPage(1);
        setHasMore(nextHasMore || Boolean(nextToken));
        setExhaustedReason(quotaMsg);
        lastRefreshAtRef.current = Date.now();
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Feed loading error:', err);
        setFeedError(err?.message || 'Unable to load YouTube videos.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingInitial(false);
        }
      }
    },
    []
  );

  // Initial feed load on clean Browse Grid (activeVideo remains null!)
  useEffect(() => {
    setFeedMode('category');
    setActiveCategory('home');
    void loadCategoryOrSearchFeed({ mode: 'category', category: 'home', refresh: true });
    return () => {
      feedAbortRef.current?.abort();
    };
  }, [loadCategoryOrSearchFeed]);

  // Infinite Scroll Pagination (pushes cleanly past 200 items with zero repeats)
  const loadNextPage = useCallback(async () => {
    if (isFetchingMoreRef.current || isFetchingMore || !hasMore) return;
    isFetchingMoreRef.current = true;
    setIsFetchingMore(true);
    setFeedError(null);

    try {
      const nextPageNum = feedPage + 1;
      let rawItems: any[] = [];
      let nextToken: string | undefined;
      let nextHasMore = true;
      let quotaMsg: string | null = null;

      if (feedMode === 'category') {
        const res = await api.getYouTubeFeed({
          type: 'long',
          category: activeCategory,
          page: nextPageNum,
          pageToken: nextPageToken || '',
          pageSize: 20,
        });
        rawItems = res.items || [];
        nextToken = res.nextPageToken || undefined;
        nextHasMore = res.hasMore !== false;
        if (res.quotaExceeded || !nextHasMore) {
          quotaMsg = res.exhaustedReason || null;
        }
      } else {
        if (!nextPageToken) {
          setHasMore(false);
          return;
        }
        const res = await api.searchYouTube(activeQuery, nextPageToken, 20, '', {
          continuous: true,
        });
        rawItems = res.items || [];
        nextToken = res.nextPageToken || undefined;
        nextHasMore = Boolean(nextToken);
        if (res.quotaFallback || res.message) {
          quotaMsg = res.message || null;
        }
      }

      const mapped = rawItems.map(mapApiItemToUnifiedVideo);
      const filtered = filterUnsuppressed(mapped.map((v) => ({ ...v, youtubeId: v.videoId })));
      const newItems: UnifiedVideo[] = [];
      for (const v of filtered) {
        if (v.videoId && !seenIdsRef.current.has(v.id) && !seenIdsRef.current.has(v.videoId)) {
          seenIdsRef.current.add(v.id);
          seenIdsRef.current.add(v.videoId);
          newItems.push(v);
        }
      }

      if (newItems.length > 0) {
        setVideos((prev) => [...prev, ...newItems]);
      }
      setFeedPage(nextPageNum);
      setNextPageToken(nextToken);
      setHasMore(nextHasMore || Boolean(nextToken));
      if (quotaMsg) setExhaustedReason(quotaMsg);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.warn('Pagination load error:', err);
        setFeedError(err?.message || 'Could not load more videos.');
      }
    } finally {
      isFetchingMoreRef.current = false;
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, hasMore, feedPage, feedMode, activeCategory, nextPageToken, activeQuery]);

  // Edge Swipe Refs
  const edgeStartXRef = useRef<number>(0);
  const edgeStartYRef = useRef<number>(0);
  const isEdgeSwipeRef = useRef<boolean>(false);

  // IntersectionObserver for continuous discovery past 200 items
  useEffect(() => {
    if (
      activeNav !== 'home' &&
      activeNav !== 'explore' &&
      activeNav !== 'trending' &&
      activeNav !== 'music' &&
      activeNav !== 'gaming' &&
      activeNav !== 'sports'
    ) {
      return;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingMoreRef.current && hasMore) {
          void loadNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '500px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage, hasMore, activeNav]);

  // Search Action (uses continuous search mode & opens Browse Grid for query results)
  const handleSearch = async (e?: React.FormEvent, directTerm?: string) => {
    if (e) e.preventDefault();
    const term = (directTerm !== undefined ? directTerm : searchQuery).trim();
    if (!term) return;

    addYouTubeSearchHistory(term);
    setSearchHistory(getYouTubeSearchHistory());
    setActiveQuery(term);
    setActiveVideo(null);

    if (searchType === 'video') {
      setActiveNav('home');
      setFeedMode('search');
      void loadCategoryOrSearchFeed({ mode: 'search', query: term, refresh: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (searchType === 'channel') {
      setActiveNav('explore');
      setIsLoadingInitial(true);
      const chs = await searchYouTubeChannels(term, 15);
      setChannelResults(chs);
      setIsLoadingInitial(false);
    } else if (searchType === 'playlist') {
      setActiveNav('playlists');
      setIsLoadingInitial(true);
      const pls = await searchYouTubePlaylists(term, 15);
      setPlaylistResults(pls);
      setIsLoadingInitial(false);
    }
  };

  // Home Button & YouTube Logo Feed Refresh (refreshes recommendations WITHOUT interrupting active playback)
  const handleRefreshFeed = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    if (!activeVideoRef.current) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const cat =
      activeNav === 'trending' ||
      activeNav === 'music' ||
      activeNav === 'gaming' ||
      activeNav === 'sports' ||
      activeNav === 'explore'
        ? activeNav
        : 'home';
    setFeedMode('category');
    setActiveCategory(cat);

    try {
      await loadCategoryOrSearchFeed({
        mode: 'category',
        category: cat,
        refresh: true,
        silent: Boolean(activeVideoRef.current),
      });
      setStudioNotice('YouTube feed refreshed with fresh videos!');
      setTimeout(() => setStudioNotice(null), 2600);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, activeNav, loadCategoryOrSearchFeed]);

  // Respond to parent refreshSignal (quietly refresh unseen feed without stopping active playing video)
  useEffect(() => {
    if (refreshSignal > 0) {
      if (activeNav === 'shorts') {
        if (!activeVideoRef.current) {
          setYtSubRefreshSignal((s) => s + 1);
        }
      } else if (!activeVideoRef.current) {
        void handleRefreshFeed();
      } else {
        void loadCategoryOrSearchFeed({
          mode: feedMode,
          category: activeCategory,
          query: activeQuery,
          refresh: true,
          silent: true,
        });
      }
    }
  }, [refreshSignal]);

  // Auto-refresh on tab return (>60s stale, only when user is on Browse Grid so playback is never interrupted)
  useEffect(() => {
    const onVis = () => {
      if (
        document.visibilityState === 'visible' &&
        !activeVideoRef.current &&
        Date.now() - lastRefreshAtRef.current > 60000
      ) {
        if (feedMode === 'search' && activeQuery) {
          void loadCategoryOrSearchFeed({ mode: 'search', query: activeQuery, refresh: true, silent: true });
        } else {
          void loadCategoryOrSearchFeed({ mode: 'category', category: activeCategory, refresh: true, silent: true });
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [feedMode, activeQuery, activeCategory, loadCategoryOrSearchFeed]);

  // Navigate to ANY YouTube section & refresh it cleanly
  const handleSelectYouTubeNav = useCallback(
    (section: YouTubeNavSection) => {
      setDrawerOpen(false);
      setActiveNav(section);
      setActiveVideo(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (section === 'home') {
        setFeedMode('category');
        setActiveCategory('home');
        void loadCategoryOrSearchFeed({ mode: 'category', category: 'home', refresh: true });
      } else if (section === 'shorts') {
        setYtSubRefreshSignal((s) => s + 1);
      } else if (section === 'studio' || section === 'my_uploads' || section === 'my_channel') {
        setStudioVideos(getStudioUploadedVideos());
        void loadChannelVideos();
      } else if (section === 'saved_videos') {
        if (api.getToken()) {
          api
            .getSavedCollection()
            .then((res) => setSavedVideosList(res.videos || []))
            .catch(() => {});
        }
      } else if (
        section === 'trending' ||
        section === 'music' ||
        section === 'gaming' ||
        section === 'sports' ||
        section === 'explore'
      ) {
        setFeedMode('category');
        setActiveCategory(section);
        void loadCategoryOrSearchFeed({ mode: 'category', category: section, refresh: true });
      } else if (section === 'playlists') {
        searchYouTubePlaylists('Coke Studio Bangla', 12).then(setPlaylistResults).catch(() => {});
      }
    },
    [loadChannelVideos, loadCategoryOrSearchFeed]
  );

  // Studio Edit / Delete handlers
  const handleSaveEditVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo || !editTitle.trim()) return;
    setIsSavingEdit(true);
    try {
      await updateMyYouTubeVideo(
        editingVideo.youtubeId,
        {
          title: editTitle.trim(),
          description: editDescription.trim(),
          privacyStatus: editPrivacy,
        },
        authUser?.accessToken
      );
      setChannelVideos((prev) =>
        prev.map((v) =>
          v.youtubeId === editingVideo.youtubeId
            ? {
                ...v,
                title: editTitle.trim(),
                description: editDescription.trim(),
                privacyStatus: editPrivacy,
              }
            : v
        )
      );
      setEditingVideo(null);
      setStudioNotice(`Updated "${editTitle.trim()}" on YouTube.`);
      setTimeout(() => setStudioNotice(null), 3000);
    } catch (err: any) {
      setChannelVideosError(err?.message || 'Could not update video.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDeleteVideo = async () => {
    if (!deletingVideo) return;
    setIsDeletingVideo(true);
    try {
      await deleteMyYouTubeVideo(deletingVideo.youtubeId, authUser?.accessToken);
      deleteStudioUploadedVideo(deletingVideo.youtubeId);
      setChannelVideos((prev) => prev.filter((v) => v.youtubeId !== deletingVideo.youtubeId));
      setStudioVideos(getStudioUploadedVideos());
      setStudioNotice(`Deleted "${deletingVideo.title}" from your YouTube channel.`);
      setDeletingVideo(null);
      setTimeout(() => setStudioNotice(null), 3000);
    } catch (err: any) {
      setChannelVideosError(err?.message || 'Could not delete video from YouTube.');
    } finally {
      setIsDeletingVideo(false);
    }
  };

  // Edge Swipe Gesture Listener (Requirement 11)
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    edgeStartXRef.current = touch.clientX;
    edgeStartYRef.current = touch.clientY;
    const isNearLeft = touch.clientX <= 45;
    const isNearRight = touch.clientX >= window.innerWidth - 45;
    isEdgeSwipeRef.current = isNearLeft || isNearRight;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isEdgeSwipeRef.current) return;
    isEdgeSwipeRef.current = false;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - edgeStartXRef.current;
    const deltaY = touch.clientY - edgeStartYRef.current;

    // Edge swipe inward (> 60px horizontal, dominating vertical)
    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (edgeStartXRef.current <= 45 && deltaX > 60) {
        // Swiped from left edge inward -> Back
        handleBackAction();
      } else if (edgeStartXRef.current >= window.innerWidth - 45 && deltaX < -60) {
        // Swiped from right edge inward -> Back
        handleBackAction();
      }
    }
  };

  // Universal Back Action (returns Watch Screen -> Browse Grid before exiting YouTube)
  const handleBackAction = () => {
    if (createModalOpen) {
      setCreateModalOpen(false);
    } else if (accountModalOpen) {
      setAccountModalOpen(false);
    } else if (drawerOpen) {
      setDrawerOpen(false);
    } else if (activeVideo) {
      setActiveVideo(null);
    } else if (activeNav !== 'home') {
      setActiveNav('home');
    } else if (onBackToMotherland) {
      onBackToMotherland();
    }
  };

  // Android System Back / Browser Back Integration
  useEffect(() => {
    window.history.pushState({ view: 'motherland_youtube' }, '');
    const handlePopState = () => {
      handleBackAction();
      window.history.pushState({ view: 'motherland_youtube' }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [createModalOpen, accountModalOpen, drawerOpen, activeVideo, activeNav, onBackToMotherland]);

  // Fullscreen Toggle
  const togglePlayerFullscreen = async () => {
    const container = playerContainerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } catch (err) {
        console.warn('Fullscreen entry error:', err);
      }
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      } catch (err) {
        console.warn('Fullscreen exit error:', err);
      }
    }
  };

  // Navigation Items
  const DRAWER_ITEMS: Array<{ id: YouTubeNavSection; label: string; icon: any }> = [
    { id: 'home', label: 'Home', icon: Youtube },
    { id: 'shorts', label: 'Shorts', icon: Flame },
    { id: 'subscriptions', label: 'Subscriptions', icon: Bell },
    { id: 'history', label: 'History', icon: History },
    { id: 'playlists', label: 'Playlists', icon: ListVideo },
    { id: 'my_channel', label: 'Your Channel', icon: User },
    { id: 'my_uploads', label: 'Your Videos', icon: VideoIcon },
    { id: 'saved_videos', label: 'Saved Videos', icon: Bookmark },
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'trending', label: 'Trending', icon: TrendingUp },
    { id: 'music', label: 'Music', icon: Music },
    { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
    { id: 'sports', label: 'Sports', icon: Trophy },
    { id: 'studio', label: 'Creator Studio', icon: Upload },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="w-full max-w-7xl mx-auto px-0 sm:px-4 md:px-6 py-0 sm:py-3 pb-24 text-slate-100 min-h-[100dvh] flex flex-col selection:bg-red-600/30 selection:text-white"
    >
      {/* SECTION 2 & 9: TOP APP BAR (MOTHERLAND YouTube Brand, Large 44px Back Button, Search, Create, Account) */}
      <header className="sticky top-0 z-40 bg-[#090d16]/95 backdrop-blur-md border-b border-white/10 px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 shadow-xl">
        {/* Left: Back Button + Menu Drawer + MOTHERLAND YouTube Logo */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          {/* Enhanced 44px Accessible Back Button */}
          {onBackToMotherland && (
            <button
              onClick={handleBackAction}
              className="min-w-[42px] min-h-[42px] p-2 rounded-xl bg-white/5 hover:bg-emerald-600/20 text-slate-300 hover:text-emerald-400 border border-white/10 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
              title="Return to MOTHERLAND Feed"
              aria-label="Back to MOTHERLAND"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Drawer Hamburger Toggle */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            title="Open YouTube Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* SECTION 2 BRANDING: "MOTHERLAND YouTube" (Clicking refreshes feed) */}
          <button
            onClick={handleRefreshFeed}
            className="flex items-center gap-2 group select-none text-left p-1 rounded-xl hover:bg-white/5 transition-all"
            title="MOTHERLAND YouTube — Tap to Refresh Feed"
          >
            <div className="w-7 h-5 sm:w-8 sm:h-5.5 rounded-md bg-red-600 flex items-center justify-center shadow-md shadow-red-950/60 group-hover:scale-105 transition-transform">
              <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline leading-none">
              <span className="text-[10px] sm:text-xs font-black tracking-widest text-emerald-400 uppercase sm:mr-1">
                MOTHERLAND
              </span>
              <div className="flex items-baseline">
                <span className="font-black text-sm sm:text-base tracking-tighter text-white">YouTube</span>
                <span className="ml-1 text-[9px] font-mono font-bold text-red-400">BD</span>
              </div>
            </div>
            {isRefreshing && <RefreshCw className="w-3.5 h-3.5 text-red-500 animate-spin ml-1" />}
          </button>
        </div>

        {/* Center: Search Quick Bar */}
        <div className="flex flex-1 max-w-md mx-1 sm:mx-2">
          <form onSubmit={(e) => handleSearch(e)} className="w-full relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 sm:left-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="সার্চ করুন (গান, নাটক, ওয়াজ, কমেডি)..."
              className="w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 rounded-xl bg-[#12192a] border border-white/10 text-white placeholder-slate-400 text-xs focus:outline-none focus:border-red-500 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-xs text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </form>
        </div>

        {/* Right: Desktop Create Action, Install, Notifications, Account */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">


          {/* Desktop Create Action */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-950/50 transition-all active:scale-95"
            title="Create (+) Video or Short"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>

          {/* Notifications */}
          <button
            onClick={() => setActiveNav('notifications')}
            className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            title="YouTube Notifications"
          >
            <Bell className="w-4 h-4" />
            {notifications.some((n) => !n.read) && (
              <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1.5 right-1.5 animate-pulse" />
            )}
          </button>

          {/* Account Profile / Connect */}
          {authUser ? (
            <button
              onClick={() => setAccountModalOpen(true)}
              className="flex items-center gap-1.5 p-1 pr-2 rounded-xl bg-red-600/15 border border-red-500/30 hover:bg-red-600/25 transition-all"
              title="Your Connected Channel Profile"
            >
              <img
                src={authUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                alt={authUser.channelTitle}
                className="w-6 h-6 rounded-lg object-cover"
              />
              <span className="hidden lg:inline text-xs font-bold text-white max-w-[80px] truncate">
                {authUser.channelTitle}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setAccountModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-950/50 transition-all flex items-center gap-1"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Global Notification Toast */}
      {studioNotice && (
        <div className="mx-2 sm:mx-0 my-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{studioNotice}</span>
          </div>
          <button onClick={() => setStudioNotice(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* VIEWPORT CONTENT CONTAINER */}
      <div className="flex-1 w-full flex flex-col">
        {/* VIEW 1: HOME, EXPLORE, TRENDING, MUSIC, GAMING, SPORTS */}
        {(activeNav === 'home' ||
          activeNav === 'explore' ||
          activeNav === 'trending' ||
          activeNav === 'music' ||
          activeNav === 'gaming' ||
          activeNav === 'sports') && (
          <div className="space-y-4 sm:space-y-6">
            {/* 9 Category Discovery Chips (triggers Browse Grid refresh, never auto-plays) */}
            <div className="px-2 sm:px-0 pt-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {discoveryChips.map((chip, idx) => {
                const isSelected = selectedChip === chip.label;
                return (
                  <button
                    key={chip.label}
                    onClick={() => {
                      setSelectedChip(chip.label);
                      setActiveVideo(null);
                      if (idx === 0) {
                        setFeedMode('category');
                        setActiveCategory('home');
                        void loadCategoryOrSearchFeed({ mode: 'category', category: 'home', refresh: true });
                      } else {
                        setFeedMode('search');
                        setActiveQuery(chip.q);
                        void loadCategoryOrSearchFeed({ mode: 'search', query: chip.q, refresh: true });
                      }
                    }}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/60'
                        : 'bg-[#111728] text-slate-300 hover:bg-[#1a233c] border-white/5'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Dedicated Watch Screen (ONLY mounted when user selects a video from Browse Grid) */}
            {activeVideo && (
              <div
                ref={playerContainerRef}
                data-testid="yt-watch-screen"
                className={`bg-[#0f1422] border-0 sm:border border-white/10 overflow-hidden shadow-2xl transition-all ${
                  isFullscreen
                    ? 'fixed inset-0 z-50 rounded-none w-screen h-screen flex flex-col bg-black'
                    : 'rounded-none sm:rounded-3xl'
                }`}
              >
                {/* Prominent Back to Browse Bar */}
                <div className="px-3 sm:px-4 py-2 bg-[#0b101d] border-b border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    data-testid="yt-back-to-browse-btn"
                    onClick={() => {
                      setActiveVideo(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold text-white flex items-center gap-1.5 transition-all"
                  >
                    <ArrowLeft className="w-4 h-4 text-red-400" />
                    <span>Back to Browse</span>
                  </button>
                  <span className="text-[11px] text-slate-400 truncate max-w-[55%]">
                    {activeVideo.creatorName}
                  </span>
                </div>

                {/* 16:9 Persistent Reused Video Player with Thumbnail Backdrop (Zero Black Screen) */}
                <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
                  {activeVideo.thumbnailUrl && (
                    <img
                      src={activeVideo.thumbnailUrl}
                      alt=""
                      aria-hidden="true"
                      className={`absolute inset-0 z-[5] w-full h-full object-cover pointer-events-none transition-opacity duration-200 ${
                        ytFrameReady ? 'opacity-0' : 'opacity-95'
                      }`}
                    />
                  )}
                  {ytBaseWatchSrc && (
                    <iframe
                      ref={ytWatchIframeRef}
                      key="yt-experience-persistent-watch-iframe"
                      src={ytBaseWatchSrc}
                      onLoad={() => {
                        registerYTListeningHandshake(ytWatchIframeRef.current, 200);
                        if (
                          activeVideo.videoId &&
                          ytWatchBoundIdRef.current &&
                          ytWatchBoundIdRef.current !== activeVideo.videoId
                        ) {
                          ytWatchBoundIdRef.current = activeVideo.videoId;
                          sendYTCommand(ytWatchIframeRef.current, 'loadVideoById', [
                            { videoId: activeVideo.videoId, startSeconds: 0 },
                          ]);
                        }
                      }}
                      title={activeVideo.title}
                      className="relative z-[2] w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  )}
                  <VideoBrandOverlay
                    mode={ytIsPlaying && ytIsBuffering ? 'buffering' : 'paused'}
                    visible={(!ytIsPlaying && ytFrameReady) || (ytIsPlaying && ytIsBuffering && !ytFrameReady)}
                    interactive={!ytIsPlaying}
                    onResume={() => sendYTCommand(ytWatchIframeRef.current, 'playVideo')}
                  />

                  {/* Interactive Fullscreen Overlay Button */}
                  <button
                    onClick={togglePlayerFullscreen}
                    className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-semibold backdrop-blur-md border border-white/20 shadow-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize className="w-3.5 h-3.5 text-amber-400" />
                        <span>Exit Fullscreen</span>
                      </>
                    ) : (
                      <>
                        <Maximize className="w-3.5 h-3.5 text-red-400" />
                        <span className="hidden sm:inline">Fullscreen</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Video Info, 1-line Collapsible Description & Controls Strip */}
                <div className="p-3 sm:p-5 space-y-3.5">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="space-y-1.5 max-w-3xl min-w-0">
                      <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-white leading-snug">
                        <TranslatableText text={activeVideo.title} />
                      </h2>
                      <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400">
                        <span>{activeVideo.publishedAt || 'YouTube'}</span>
                        <span>•</span>
                        <span className="text-red-400 font-semibold">{activeVideo.category || 'Trending'}</span>
                      </div>
                      <CollapsibleDescription
                        text={activeVideo.description || activeVideo.title}
                        minLengthToCollapse={60}
                        className="text-xs text-slate-300 leading-relaxed pt-0.5"
                        renderText={(content) => <FireRichText text={content} emojiSize="xs" />}
                      />
                    </div>

                    {/* Actions: Support, Fire Like, Boost, External */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          const channelId = String(activeVideo.sourceMetadata?.channelId || '');
                          if (!channelId) {
                            setActionNotice('Channel ID unavailable for this video.');
                            return;
                          }
                          if (!api.getToken()) {
                            setActionNotice('Sign in to MOTHERLAND & connect Google account to subscribe.');
                            return;
                          }
                          const prev = Boolean(subscribedChannels[activeVideo.creatorName]);
                          setActionNotice(null);
                          try {
                            const res = await api.subscribeYouTubeChannel(
                              channelId,
                              prev ? 'unsubscribe' : 'subscribe'
                            );
                            setSubscribedChannels((m) => ({
                              ...m,
                              [activeVideo.creatorName]: res.subscribed,
                            }));
                          } catch (err: any) {
                            setActionNotice(err?.message || 'Google YouTube OAuth required to subscribe.');
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${
                          subscribedChannels[activeVideo.creatorName]
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/50'
                        }`}
                      >
                        {subscribedChannels[activeVideo.creatorName] ? 'Supporting ✓' : 'Support'}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          if (!api.getToken()) {
                            setActionNotice('Sign in & connect Google account to like YouTube videos.');
                            return;
                          }
                          const next = !likedVideos[activeVideo.videoId];
                          setActionNotice(null);
                          try {
                            await api.rateYouTubeVideo(activeVideo.videoId, next ? 'like' : 'none');
                            setLikedVideos((prev) => ({ ...prev, [activeVideo.videoId]: next }));
                          } catch (err: any) {
                            setActionNotice(err?.message || 'Google YouTube OAuth required to like videos.');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                          likedVideos[activeVideo.videoId]
                            ? 'bg-orange-500/20 text-amber-300 border-orange-500/50'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                        }`}
                      >
                        <FireLikeIcon className="w-4 h-4" active={Boolean(likedVideos[activeVideo.videoId])} />
                        <span>{likedVideos[activeVideo.videoId] ? 'Fire Liked' : 'Fire Like'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          const shareUrl = buildMotherlandVideoShareUrl({
                            id: activeVideo.id,
                            youtubeId: activeVideo.videoId,
                            source: 'youtube',
                            isShort: false,
                          });
                          if (navigator.share) {
                            try {
                              await navigator.share({ title: activeVideo.title, url: shareUrl });
                              return;
                            } catch {
                              // fallback to clipboard
                            }
                          }
                          navigator.clipboard.writeText(shareUrl);
                          setCopiedNotice('MOTHERLAND link copied!');
                          setTimeout(() => setCopiedNotice(null), 2000);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-white/10"
                      >
                        <BoostIcon className="w-4 h-4" />
                        <span>{copiedNotice || 'Boost'}</span>
                      </button>

                      <a
                        href={activeVideo.originalVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10"
                        title="Watch on official YouTube"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {actionNotice && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
                      <span>{actionNotice}</span>
                      <button
                        type="button"
                        onClick={() => setActionNotice(null)}
                        className="text-amber-200 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Creator Channel Tag */}
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#131b2e] border border-white/5">
                    {activeVideo.creatorAvatar ? (
                      <img
                        src={activeVideo.creatorAvatar}
                        alt={activeVideo.creatorName}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center font-bold text-white text-xs">
                        {activeVideo.creatorName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-xs text-white flex items-center gap-1">
                        <span>{activeVideo.creatorName}</span>
                        <CheckCircle2 className="w-3 h-3 text-red-500" />
                      </h4>
                      <p className="text-[10px] text-slate-400">YouTube Channel</p>
                    </div>
                  </div>

                  {/* Public Talk / Comments Section */}
                  <div className="pt-2 border-t border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white flex items-center gap-1.5">
                        <TalkIcon className="w-4 h-4" active />
                        <span>Talk ({comments.length})</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">YouTube API</span>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const text = newCommentText.trim();
                        if (!text || isPostingComment) return;
                        if (!api.getToken()) {
                          setActionNotice('Sign in & connect Google account to post comments on YouTube.');
                          return;
                        }
                        setIsPostingComment(true);
                        setActionNotice(null);
                        try {
                          const res = await api.postYouTubeComment(activeVideo.videoId, text);
                          if (res?.comment) {
                            setComments((prev) => [res.comment, ...prev]);
                            setNewCommentText('');
                          }
                        } catch (err: any) {
                          setActionNotice(err?.message || 'Google YouTube OAuth required to post comments.');
                        } finally {
                          setIsPostingComment(false);
                        }
                      }}
                      className="space-y-1.5"
                    >
                      <FireDraftPreview value={newCommentText} />
                      <div className="flex items-center gap-2">
                        <FirePickerTrigger
                          size="sm"
                          onClick={() => setFirePickerOpen(true)}
                          active={firePickerOpen}
                          title="Insert Fire Emoji"
                        />
                        <input
                          type="text"
                          value={newCommentText}
                          onChange={(e) => setNewCommentText(e.target.value)}
                          placeholder="Add a talk publicly..."
                          className="flex-1 px-3 py-1.5 rounded-xl bg-[#141b2c] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-red-500"
                        />
                        <button
                          type="submit"
                          disabled={!newCommentText.trim() || isPostingComment}
                          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs"
                        >
                          {isPostingComment ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </form>

                    {/* Comments list */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {comments.map((cmt) => (
                        <div key={cmt.id} className="p-2 rounded-xl bg-[#111728] border border-white/5 flex items-start gap-2.5 text-xs">
                          {cmt.authorProfileImageUrl ? (
                            <img
                              src={cmt.authorProfileImageUrl}
                              alt={cmt.authorDisplayName}
                              className="w-6 h-6 rounded-full object-cover mt-0.5"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-white/10 mt-0.5 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {(cmt.authorDisplayName || 'Y').slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-[11px] text-white block">{cmt.authorDisplayName}</span>
                            <p className="text-slate-300 text-[11px] mt-0.5">
                              <FireRichText text={cmt.textDisplay} emojiSize="xs" />
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Continuous Video Discovery Browse Grid */}
            <div className="space-y-3 px-2 sm:px-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-500" />
                  <span>
                    {activeVideo ? 'Up Next & Related Discovery' : 'Browse YouTube Discovery'} ({videos.length} Loaded)
                  </span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshFeed}
                    disabled={isRefreshing}
                    className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-200 flex items-center gap-1.5 transition-all disabled:opacity-50"
                    title="Refresh Feed"
                  >
                    <RefreshCw className={`w-3 h-3 text-red-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                  <span className="hidden sm:inline text-[11px] font-mono text-slate-400">
                    {activeVideo ? 'Tap any video to switch' : 'Tap any video to watch'}
                  </span>
                </div>
              </div>

              {isLoadingInitial && videos.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="rounded-2xl bg-[#0f1422] border border-white/5 overflow-hidden animate-pulse">
                      <div className="aspect-video bg-white/5" />
                      <div className="p-3 space-y-2">
                        <div className="h-3 w-4/5 bg-white/10 rounded" />
                        <div className="h-2.5 w-1/2 bg-white/5 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                  {videos.map((vid) => {
                    const isCurrent = activeVideo?.videoId === vid.videoId;
                    return (
                      <div
                        key={vid.id}
                        data-testid={`yt-browse-card-${vid.videoId}`}
                        onClick={() => {
                          setActiveVideo(vid);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className={`rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between group ${
                          isCurrent
                            ? 'bg-red-500/10 border-red-500/50 shadow-lg shadow-red-950/40 ring-1 ring-red-500/30'
                            : 'bg-[#0f1422] border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="relative aspect-video bg-black overflow-hidden">
                          {vid.thumbnailUrl ? (
                            <img
                              src={vid.thumbnailUrl}
                              alt={vid.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : null}
                          {vid.duration && (
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                              {vid.duration}
                            </span>
                          )}
                          {isCurrent && (
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-600 text-[10px] font-mono font-bold text-white shadow-md">
                              PLAYING NOW
                            </div>
                          )}
                        </div>

                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <h4
                              className={`text-xs font-bold line-clamp-2 leading-snug ${
                                isCurrent ? 'text-red-400' : 'text-white group-hover:text-red-400'
                              }`}
                            >
                              <TranslatableText text={vid.title} showToggle={false} />
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-1 truncate">{vid.creatorName}</p>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                            <span>{vid.publishedAt || 'YouTube'}</span>
                            <span className="text-red-400 font-semibold group-hover:underline flex items-center gap-1">
                              <Play className="w-3 h-3 fill-current" />
                              <span>Watch</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Infinite Sentinel, Error Retry & Load Button */}
              <div ref={sentinelRef} className="pt-6 pb-12 flex flex-col items-center justify-center gap-2">
                {feedError && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                    <span>{feedError}</span>
                    <button
                      type="button"
                      onClick={() => (videos.length === 0 ? handleRefreshFeed() : loadNextPage())}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {isFetchingMore ? (
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#141b2c] border border-red-500/30 text-white text-xs font-semibold shadow-lg">
                    <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                    <span>Loading additional YouTube videos...</span>
                  </div>
                ) : hasMore ? (
                  <button
                    type="button"
                    onClick={loadNextPage}
                    className="px-6 py-2.5 rounded-full bg-[#141b2c] hover:bg-[#1a233c] border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-red-400" />
                    <span>Fetch Next Page ({videos.length} loaded)</span>
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 font-mono text-center">
                    {exhaustedReason || `All available discovery videos loaded (${videos.length} total)`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4 & 10: SHORTS VIEW (9:16 Vertical Swipe Natural Gesture Feed) */}
        {activeNav === 'shorts' && (
          <div className="flex-1 w-full flex items-center justify-center py-1 sm:py-3">
            <YouTubeShortsFeed
              onBackToHome={() => handleSelectYouTubeNav('home')}
              onOpenDetails={onOpenVideoDetails}
              refreshSignal={ytSubRefreshSignal}
            />
          </div>
        )}

        {/* VIEW 3: SUBSCRIPTIONS & CHANNELS */}
        {activeNav === 'subscriptions' && (
          <div className="p-3 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <PulseIcon className="w-4 h-4 text-red-500" active />
                <span>Supported Channels</span>
              </h3>
            </div>

            {Object.keys(subscribedChannels).filter((k) => subscribedChannels[k]).length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#0f1422] border border-white/10 text-center space-y-2">
                <p className="text-xs text-slate-300 font-semibold">
                  No subscribed channels loaded in this session yet.
                </p>
                <p className="text-[11px] text-slate-400">
                  Open any video and tap Support (with your Google account connected) to manage subscriptions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.keys(subscribedChannels)
                  .filter((ch) => subscribedChannels[ch])
                  .map((ch) => (
                    <div key={ch} className="p-3.5 rounded-2xl bg-[#0f1422] border border-white/10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-sm">
                          {ch.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-white">{ch}</h4>
                          <p className="text-[10px] text-slate-400">YouTube Subscription</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-[10px] font-semibold text-emerald-300">
                        Supporting
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: HISTORY */}
        {activeNav === 'history' && (
          <div className="p-3 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-500" />
                <span>Search & Watch History</span>
              </h3>
              <button
                onClick={() => {
                  clearYouTubeSearchHistory();
                  setSearchHistory([]);
                }}
                className="text-xs text-red-400 hover:underline"
              >
                Clear History
              </button>
            </div>

            <div className="space-y-2">
              {searchHistory.map((item) => (
                <div
                  key={item}
                  onClick={() => {
                    setSearchQuery(item);
                    handleSearch(undefined, item);
                  }}
                  className="p-3 rounded-xl bg-[#0f1422] border border-white/5 hover:border-red-500/30 flex items-center justify-between cursor-pointer group"
                >
                  <span className="text-xs text-slate-300 group-hover:text-white">{item}</span>
                  <Search className="w-3.5 h-3.5 text-slate-500 group-hover:text-red-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 5: CREATOR STUDIO, YOUR VIDEOS & YOUR CHANNEL (Full Upload / Edit / Delete Management) */}
        {(activeNav === 'studio' || activeNav === 'my_uploads' || activeNav === 'my_channel') && (
          <div className="p-3 sm:p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-red-500" />
                  <span>
                    {activeNav === 'my_channel'
                      ? 'Your YouTube Channel & Management'
                      : activeNav === 'my_uploads'
                      ? 'Your Uploaded YouTube Videos'
                      : 'MOTHERLAND YouTube Studio'}
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Manage your YouTube channel videos — edit title, description, visibility, or delete videos
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadChannelVideos}
                  disabled={isLoadingChannelVideos}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingChannelVideos ? 'animate-spin text-red-400' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload Video</span>
                </button>
              </div>
            </div>

            {/* Channel Identity Banner */}
            <div className="p-4 rounded-2xl bg-[#0f1422] border border-white/10 flex flex-wrap items-center justify-between gap-3">
              {authUser ? (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    {authUser.avatarUrl ? (
                      <img
                        src={authUser.avatarUrl}
                        alt={authUser.channelTitle || authUser.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-red-500/60"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-red-600/20 border-2 border-red-500/60 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {(authUser.channelTitle || authUser.name || 'Y').slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white truncate">
                        {authUser.channelTitle || authUser.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {authUser.email} {authUser.subscriberCount ? `• ${authUser.subscriberCount} subscribers` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountModalOpen(true)}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white"
                  >
                    Switch / Account Settings
                  </button>
                </>
              ) : (
                <>
                  <div className="text-xs text-slate-300 space-y-0.5">
                    <div className="font-bold text-sm text-white">Connect Google Account for YouTube Management</div>
                    <div>Sign in with Google to view, edit, and delete videos on your YouTube channel.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                  >
                    Sign In with Google
                  </button>
                </>
              )}
            </div>

            {channelVideosError && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{channelVideosError}</span>
                </div>
                {!authUser && (
                  <button
                    type="button"
                    onClick={() => setAccountModalOpen(true)}
                    className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] flex-shrink-0"
                  >
                    Connect
                  </button>
                )}
              </div>
            )}

            {/* Live Channel Videos from YouTube Data API v3 */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-white uppercase tracking-wider">
                YouTube Channel Videos ({channelVideos.length})
              </h4>

              {isLoadingChannelVideos ? (
                <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin text-red-500" />
                  <span>Loading your channel videos from YouTube...</span>
                </div>
              ) : channelVideos.length === 0 ? (
                studioVideos.length === 0 && (
                  <div className="p-8 rounded-3xl bg-[#0f1422] border border-white/10 text-center space-y-2">
                    <FileVideo className="w-8 h-8 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300 font-semibold">
                      {authUser
                        ? 'No uploaded videos found on this YouTube channel yet.'
                        : 'Sign in with Google to load and manage your YouTube channel videos.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => (authUser ? setCreateModalOpen(true) : setAccountModalOpen(true))}
                      className="mt-2 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
                    >
                      {authUser ? 'Upload Your First Video' : 'Connect Google Account'}
                    </button>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {channelVideos.map((vid) => (
                    <div key={vid.youtubeId} className="p-3 rounded-2xl bg-[#0f1422] border border-white/10 space-y-2.5">
                      <div className="relative aspect-video rounded-xl bg-black overflow-hidden">
                        {vid.thumbnailUrl ? (
                          <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
                        ) : null}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/75 text-[10px] text-white uppercase font-bold flex items-center gap-1">
                          {vid.privacyStatus === 'private' ? (
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                          ) : vid.privacyStatus === 'unlisted' ? (
                            <EyeOff className="w-2.5 h-2.5 text-slate-300" />
                          ) : (
                            <Globe className="w-2.5 h-2.5 text-emerald-400" />
                          )}
                          <span>{vid.privacyStatus}</span>
                        </span>
                      </div>

                      <div>
                        <h5 className="font-bold text-xs text-white line-clamp-2">{vid.title}</h5>
                        <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                          {vid.stats.views.toLocaleString()} views · {vid.stats.likes.toLocaleString()} likes ·{' '}
                          {vid.publishedAt ? new Date(vid.publishedAt).toLocaleDateString() : 'YouTube'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVideo(vid);
                            setEditTitle(vid.title);
                            setEditDescription(vid.description || '');
                            setEditPrivacy(vid.privacyStatus || 'public');
                          }}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1"
                        >
                          <Pencil className="w-3 h-3 text-emerald-400" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingVideo(vid)}
                          className="flex-1 py-1.5 px-2 rounded-lg bg-red-600/15 hover:bg-red-600/25 text-red-400 text-[11px] font-semibold flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Delete</span>
                        </button>

                        <a
                          href={`https://www.youtube.com/watch?v=${vid.youtubeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-semibold flex items-center gap-1"
                          title="Open on YouTube"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Session Studio Uploads Fallback */}
            {studioVideos.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider">
                  Recent Device Uploads ({studioVideos.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {studioVideos.map((vid) => (
                    <div key={vid.id} className="p-3 rounded-2xl bg-[#0f1422] border border-white/10 space-y-2">
                      <div className="relative aspect-video rounded-xl bg-black overflow-hidden">
                        {vid.thumbnailUrl ? (
                          <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
                        ) : null}
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 text-[10px] text-white uppercase font-bold">
                          {vid.privacyStatus}
                        </span>
                      </div>
                      <h5 className="font-bold text-xs text-white line-clamp-1">{vid.title}</h5>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{vid.uploadedAt}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              deleteStudioUploadedVideo(vid.id);
                              setStudioVideos(getStudioUploadedVideos());
                            }}
                            className="text-red-400 hover:underline flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                          <a
                            href={`https://www.youtube.com/watch?v=${vid.videoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-300 hover:text-white flex items-center gap-0.5"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 6: PLAYLISTS */}
        {activeNav === 'playlists' && (
          <div className="p-3 sm:p-5 space-y-4">
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <ListVideo className="w-4 h-4 text-red-500" />
              <span>YouTube Playlists</span>
            </h3>
            {playlistResults.length === 0 ? (
              <p className="text-xs text-slate-400">Search playlists or tap refresh to explore curated collections.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {playlistResults.map((pl) => (
                  <a
                    key={pl.id}
                    href={`https://www.youtube.com/playlist?list=${pl.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-2xl bg-[#0f1422] border border-white/10 overflow-hidden hover:border-red-500/40 transition-colors"
                  >
                    <div className="aspect-video bg-black">
                      {pl.thumbnailUrl ? (
                        <img src={pl.thumbnailUrl} alt={pl.title} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-xs text-white line-clamp-2">{pl.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-1">{pl.channelTitle}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 7: SAVED VIDEOS */}
        {activeNav === 'saved_videos' && (
          <div className="p-3 sm:p-5 space-y-4">
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-red-500" />
              <span>Saved Videos ({savedVideosList.length})</span>
            </h3>
            {savedVideosList.length === 0 ? (
              <p className="text-xs text-slate-400">No saved videos yet. Save videos from MOTHERLAND Video Theater to view them here.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {savedVideosList.map((sv) => (
                  <div key={sv.videoId} className="rounded-2xl bg-[#0f1422] border border-white/10 overflow-hidden p-3 space-y-2">
                    <div className="aspect-video rounded-xl bg-black overflow-hidden">
                      {sv.thumbnailUrl ? (
                        <img src={sv.thumbnailUrl} alt={sv.title} className="w-full h-full object-cover" />
                      ) : null}
                    </div>
                    <h4 className="font-bold text-xs text-white line-clamp-2">{sv.title}</h4>
                    <p className="text-[11px] text-slate-400">{sv.channelTitle}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 8: SETTINGS */}
        {activeNav === 'settings' && (
          <div className="p-3 sm:p-5 space-y-4 max-w-2xl">
            <h3 className="font-extrabold text-base text-white flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-red-500" />
              <span>YouTube Account &amp; Playback Settings</span>
            </h3>
            <div className="p-4 rounded-2xl bg-[#0f1422] border border-white/10 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-white">Google / YouTube Account</div>
                  <div className="text-slate-400">
                    {authUser ? `${authUser.name} (${authUser.email})` : 'Not connected'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                >
                  {authUser ? 'Manage Account' : 'Connect Google'}
                </button>
              </div>
              <div className="pt-3 border-t border-white/10 text-slate-300">
                <div className="font-bold text-white">14-Day Watched Filter</div>
                <div className="text-slate-400 mt-0.5">
                  Videos and Shorts you watch are automatically hidden from your feeds for 14 days so you always discover fresh content.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 9: NOTIFICATIONS */}
        {activeNav === 'notifications' && (
          <div className="p-3 sm:p-5 space-y-3">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <PulseIcon className="w-4 h-4 text-amber-400" active />
              <span>Pulse Notifications</span>
            </h3>

            {notifications.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#0f1422] border border-white/10 text-center text-xs text-slate-400">
                No notifications yet.
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3.5 rounded-2xl bg-[#0f1422] border border-white/5 flex items-start justify-between gap-3">
                    <div>
                      <h5 className="font-bold text-xs text-white">{n.title}</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">{n.channel} • {n.time}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-red-500 mt-1" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 4: MOBILE BOTTOM NAVIGATION BAR (Home, Shorts, CREATE (+), Subscriptions, Studio) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/98 backdrop-blur-lg border-t border-white/10 px-3 py-2 flex items-center justify-around sm:hidden">
        {/* Home */}
        <button
          onClick={() => handleSelectYouTubeNav('home')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
            activeNav === 'home' ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          <Youtube className="w-5 h-5" />
          <span>Home</span>
        </button>

        {/* Shorts */}
        <button
          onClick={() => handleSelectYouTubeNav('shorts')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
            activeNav === 'shorts' ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          <Flame className="w-5 h-5" />
          <span>Shorts</span>
        </button>

        {/* SECTION 4 REQUIREMENT: PROMINENT CENTER CREATE (+) BUTTON */}
        <button
          onClick={() => setCreateModalOpen(true)}
          className="relative -top-2 w-12 h-12 rounded-full bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-950/70 border-2 border-[#090d16] active:scale-95 transition-transform"
          title="Create Video or Short"
          aria-label="Create Video or Short"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Subscriptions */}
        <button
          onClick={() => handleSelectYouTubeNav('subscriptions')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
            activeNav === 'subscriptions' ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          <Bell className="w-5 h-5" />
          <span>Subs</span>
        </button>

        {/* Studio / You */}
        <button
          onClick={() => handleSelectYouTubeNav('studio')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold transition-all ${
            activeNav === 'studio' ? 'text-red-400' : 'text-slate-400'
          }`}
        >
          <Upload className="w-5 h-5" />
          <span>Studio</span>
        </button>
      </nav>

      {/* NAVIGATION DRAWER (All 12+ Sections) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex animate-in fade-in duration-150">
          <div className="w-72 max-w-[80vw] h-full bg-[#0c1220] border-r border-white/10 p-4 overflow-y-auto space-y-4 shadow-2xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-5 rounded-md bg-red-600 flex items-center justify-center text-white">
                    <Play className="w-3 h-3 fill-white ml-0.5" />
                  </div>
                  <span className="font-extrabold text-sm text-white">MOTHERLAND YouTube</span>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="space-y-1">
                {DRAWER_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isCur = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectYouTubeNav(item.id)}
                      className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-3 text-xs font-semibold transition-all ${
                        isCur
                          ? 'bg-red-600 text-white shadow-md shadow-red-950/60 font-bold'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-white/10">
              <button
                onClick={() => {
                  setDrawerOpen(false);
                  if (onBackToMotherland) onBackToMotherland();
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to MOTHERLAND Feed</span>
              </button>
            </div>
          </div>

          <div className="flex-1" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* CREATE (+) MODAL (Section 4 & 6) */}
      <YouTubeCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        authUser={authUser}
        onOpenSignIn={() => {
          setCreateModalOpen(false);
          setAccountModalOpen(true);
        }}
        onUploadSuccess={(res) => {
          setStudioVideos(getStudioUploadedVideos());
          setStudioNotice(`Successfully uploaded "${res.title}" to your YouTube channel!`);
        }}
      />

      {/* GOOGLE ACCOUNT AUTH MODAL (Section 5) */}
      <YouTubeAccountModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        currentAuth={authUser}
        onAuthUpdated={(auth) => {
          setAuthUser(auth);
          if (auth) loadChannelVideos();
          else setChannelVideos([]);
        }}
      />

      {/* IN-APP VIDEO EDIT MODAL */}
      {editingVideo && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditVideo}
            className="w-full max-w-md bg-[#0c1220] border border-white/15 rounded-3xl p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">Edit YouTube Video</h4>
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Title</label>
              <input
                type="text"
                required
                maxLength={100}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#111728] border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Description</label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#111728] border border-white/10 text-xs text-white focus:outline-none focus:border-red-500 resize-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Visibility</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['public', 'unlisted', 'private'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditPrivacy(p)}
                    className={`py-2 rounded-xl text-xs font-bold capitalize border ${
                      editPrivacy === p
                        ? 'bg-red-600 text-white border-red-500'
                        : 'bg-white/5 text-slate-300 border-white/10'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingVideo(null)}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit || !editTitle.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1.5"
              >
                {isSavingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* IN-APP DELETE CONFIRMATION MODAL */}
      {deletingVideo && (
        <div className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0c1220] border border-red-500/30 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">Delete YouTube Video?</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to permanently delete &ldquo;{deletingVideo.title}&rdquo; from your YouTube channel?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingVideo(null)}
                disabled={isDeletingVideo}
                className="px-4 py-2 rounded-xl bg-white/5 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteVideo}
                disabled={isDeletingVideo}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-xs font-bold text-white flex items-center gap-1.5"
              >
                {isDeletingVideo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Video</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <FireEmojiPicker
        isOpen={firePickerOpen}
        onClose={() => setFirePickerOpen(false)}
        onSelect={(emoji) => {
          setNewCommentText((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${emoji.token} `);
        }}
      />
    </div>
  );
};
