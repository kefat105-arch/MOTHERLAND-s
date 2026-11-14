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
  Eye,
  EyeOff,
} from 'lucide-react';
import { UnifiedVideo } from '../../types/video';
import { FireLikeIcon, TalkIcon, BoostIcon, PulseIcon } from '../fire/MotherlandIcons';
import { FireEmojiPicker } from '../fire/FireEmojiPicker';
import { FireRichText } from '../fire/FireRichText';
import { FireDraftPreview, FirePickerTrigger } from '../fire/FireComposerBar';
import {
  searchYouTube,
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

const YOUTUBE_FEED_CACHE_KEY = 'motherland_yt_feed_cache_v3';

function readCachedYouTubeFeed(): UnifiedVideo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(YOUTUBE_FEED_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.videos)) {
      return filterUnsuppressed(parsed.videos.map((v: UnifiedVideo) => ({ ...v, youtubeId: v.videoId })));
    }
    return [];
  } catch {
    return [];
  }
}

function writeCachedYouTubeFeed(videos: UnifiedVideo[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      YOUTUBE_FEED_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), videos: videos.slice(0, 48) })
    );
  } catch {
    // ignore storage quota
  }
}

export const YouTubeFullExperience: React.FC<YouTubeFullExperienceProps> = ({
  onOpenVideoDetails,
  onOpenAddVideo,
  onOpenVerticalShorts,
  onBackToMotherland,
  refreshSignal = 0,
}) => {
  const cachedInitialVideos = useRef<UnifiedVideo[]>(readCachedYouTubeFeed());

  // Navigation State
  const [activeNav, setActiveNav] = useState<YouTubeNavSection>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [ytSubRefreshSignal, setYtSubRefreshSignal] = useState(0);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType] = useState<'video' | 'channel' | 'playlist'>('video');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [channelResults, setChannelResults] = useState<YouTubeChannelItem[]>([]);
  const [playlistResults, setPlaylistResults] = useState<YouTubePlaylistItem[]>([]);

  // Feed Videos & Playback State
  const [videos, setVideos] = useState<UnifiedVideo[]>(cachedInitialVideos.current);
  const [activeVideo, setActiveVideo] = useState<UnifiedVideo | null>(
    cachedInitialVideos.current[0] || null
  );
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoadingInitial, setIsLoadingInitial] = useState(cachedInitialVideos.current.length === 0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChip, setSelectedChip] = useState('🔥 ট্রেন্ডিং বাংলাদেশ');
  const [activeQuery, setActiveQuery] = useState('Bangladesh trending music news');
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

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
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [firePickerOpen, setFirePickerOpen] = useState(false);
  const [likedVideos, setLikedVideos] = useState<Record<string, boolean>>({});
  const [subscribedChannels, setSubscribedChannels] = useState<Record<string, boolean>>({
    'Coke Studio Bangla': true,
    'BCB Tigers': true,
  });

  // Notifications State
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; channel: string; time: string; read: boolean }>>([
    { id: 'notif_1', title: 'New release: Coke Studio Bangla Season 4 Official Premiere', channel: 'Coke Studio Bangla', time: '2 hours ago', read: false },
    { id: 'notif_2', title: 'Bangladesh vs Sri Lanka match highlights live on Tigers TV', channel: 'BCB Tigers', time: '5 hours ago', read: false },
    { id: 'notif_3', title: 'Dhaka Metro Rail Line 6 Phase 2 operations update', channel: 'DMTCL Official', time: '1 day ago', read: true },
  ]);

  // Fullscreen Player State
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Infinite Scroll & Deduplication Refs
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
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

  // Refresh studio videos & search history
  useEffect(() => {
    setStudioVideos(getStudioUploadedVideos());
    setSearchHistory(getYouTubeSearchHistory());
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

  // Fetch comments whenever active video changes
  useEffect(() => {
    if (activeVideo?.videoId) {
      getYouTubeVideoComments(activeVideo.videoId, 10).then((cmts) => {
        setComments(cmts);
      });
    }
  }, [activeVideo]);

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
          return (
            filterUnsuppressed([{ id: v.id, youtubeId: v.videoId }]).length > 0
          );
        })
      );
    };
    window.addEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
    return () => window.removeEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
  }, []);

  // Core Feed Loader by Search Query
  const loadFeed = useCallback(async (searchTerm: string, refresh: boolean = true, silent = false) => {
    if (refresh) {
      if (!silent) setIsLoadingInitial((prev) => prev && videos.length === 0);
      seenIdsRef.current.clear();
    }

    try {
      const res = await searchYouTube({
        query: searchTerm,
        pageSize: 24,
        regionCode: 'BD',
        safeSearch: 'none',
      });

      const filteredRaw = filterUnsuppressed(
        res.videos.map((v) => ({ ...v, youtubeId: v.videoId }))
      );

      const uniqueVideos: UnifiedVideo[] = [];
      for (const v of filteredRaw) {
        if (!seenIdsRef.current.has(v.id) && !seenIdsRef.current.has(v.videoId)) {
          seenIdsRef.current.add(v.id);
          seenIdsRef.current.add(v.videoId);
          uniqueVideos.push(v);
        }
      }

      if (refresh && uniqueVideos.length > 0) {
        writeCachedYouTubeFeed(uniqueVideos);
      }

      setVideos((prev) => (refresh ? (uniqueVideos.length > 0 ? uniqueVideos : prev) : [...prev, ...uniqueVideos]));
      setNextPageToken(res.nextPageToken);
      lastRefreshAtRef.current = Date.now();

      if (refresh && uniqueVideos.length > 0) {
        setActiveVideo((cur) => (silent && cur ? cur : uniqueVideos[0]));
      }
    } catch (err) {
      console.error('Feed loading error:', err);
    } finally {
      setIsLoadingInitial(false);
    }
  }, [videos.length]);

  // Initial feed load (silent background refresh if cache already hydrated)
  useEffect(() => {
    loadFeed(discoveryChips[0].q, true, cachedInitialVideos.current.length > 0);
  }, []);

  // Infinite Scroll Pagination
  const loadNextPage = useCallback(async () => {
    if (isFetchingMore || !nextPageToken) return;
    setIsFetchingMore(true);

    try {
      const res = await searchYouTube({
        query: activeQuery,
        pageToken: nextPageToken,
        pageSize: 24,
        regionCode: 'BD',
        safeSearch: 'none',
      });

      const filtered = filterUnsuppressed(
        res.videos.map((v) => ({ ...v, youtubeId: v.videoId }))
      );
      const newItems: UnifiedVideo[] = [];
      for (const v of filtered) {
        if (!seenIdsRef.current.has(v.id) && !seenIdsRef.current.has(v.videoId)) {
          seenIdsRef.current.add(v.id);
          seenIdsRef.current.add(v.videoId);
          newItems.push(v);
        }
      }

      setVideos((prev) => [...prev, ...newItems]);
      setNextPageToken(res.nextPageToken);
    } catch (err) {
      console.warn('Pagination load error:', err);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, nextPageToken, activeQuery]);

  // Edge Swipe Refs
  const edgeStartXRef = useRef<number>(0);
  const edgeStartYRef = useRef<number>(0);
  const isEdgeSwipeRef = useRef<boolean>(false);

  // IntersectionObserver for continuous discovery
  useEffect(() => {
    if (activeNav !== 'home' && activeNav !== 'explore') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingMore && nextPageToken) {
          loadNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '500px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage, isFetchingMore, nextPageToken, activeNav]);

  // Search Action
  const handleSearch = async (e?: React.FormEvent, directTerm?: string) => {
    if (e) e.preventDefault();
    const term = (directTerm !== undefined ? directTerm : searchQuery).trim();
    if (!term) return;

    addYouTubeSearchHistory(term);
    setSearchHistory(getYouTubeSearchHistory());
    setActiveQuery(term);

    if (searchType === 'video') {
      setActiveNav('home');
      loadFeed(term, true);
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

  // Home Button & YouTube Logo Feed Refresh
  const handleRefreshFeed = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const refreshPool = [
      'Bangladesh trending viral music 2026',
      'Coke Studio Bangla top hit',
      'Bangla Natok comedy episode 2026',
      'Bangladesh Tigers cricket match highlights',
      'Sundarbans travel documentary Bangladesh',
    ];
    const chosen = refreshPool[Math.floor(Math.random() * refreshPool.length)];
    setActiveQuery(chosen);

    try {
      await loadFeed(chosen, true, false);
      setStudioNotice('YouTube feed refreshed with fresh recommendations!');
      setTimeout(() => setStudioNotice(null), 2600);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, loadFeed]);

  // Respond to parent refreshSignal (when user clicks YouTube icon in MOTHERLAND)
  useEffect(() => {
    if (refreshSignal > 0) {
      if (activeNav === 'shorts') {
        setYtSubRefreshSignal((s) => s + 1);
      } else {
        handleRefreshFeed();
      }
    }
  }, [refreshSignal]);

  // Auto-refresh on tab return (>60s stale)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRefreshAtRef.current > 60000) {
        loadFeed(activeQuery, true, true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [activeQuery, loadFeed]);

  // Navigate to ANY YouTube section & refresh it automatically when clicked
  const handleSelectYouTubeNav = useCallback(
    (section: YouTubeNavSection) => {
      setDrawerOpen(false);
      setActiveNav(section);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      if (section === 'home') {
        handleRefreshFeed();
      } else if (section === 'shorts') {
        setYtSubRefreshSignal((s) => s + 1);
      } else if (section === 'studio' || section === 'my_uploads' || section === 'my_channel') {
        setStudioVideos(getStudioUploadedVideos());
        loadChannelVideos();
      } else if (section === 'saved_videos') {
        if (api.getToken()) {
          api
            .getSavedCollection()
            .then((res) => setSavedVideosList(res.videos || []))
            .catch(() => {});
        }
      } else if (section === 'trending') {
        setActiveQuery('Bangladesh trending viral music videos');
        loadFeed('Bangladesh trending viral music videos', true, true);
      } else if (section === 'music') {
        setActiveQuery('Coke Studio Bangla popular music');
        loadFeed('Coke Studio Bangla popular music', true, true);
      } else if (section === 'gaming') {
        setActiveQuery('Gaming highlights livestream 2026');
        loadFeed('Gaming highlights livestream 2026', true, true);
      } else if (section === 'sports') {
        setActiveQuery('Bangladesh cricket football highlights');
        loadFeed('Bangladesh cricket football highlights', true, true);
      } else if (section === 'explore') {
        searchYouTubeChannels('Bangladesh', 12).then(setChannelResults).catch(() => {});
        loadFeed('Bangladesh viral documentary culture', true, true);
      } else if (section === 'playlists') {
        searchYouTubePlaylists('Coke Studio Bangla', 12).then(setPlaylistResults).catch(() => {});
      }
    },
    [handleRefreshFeed, loadChannelVideos, loadFeed]
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

  // Universal Back Action
  const handleBackAction = () => {
    if (createModalOpen) {
      setCreateModalOpen(false);
    } else if (accountModalOpen) {
      setAccountModalOpen(false);
    } else if (drawerOpen) {
      setDrawerOpen(false);
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
  }, [createModalOpen, accountModalOpen, drawerOpen, activeNav, onBackToMotherland]);

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
            {/* 9 Category Discovery Chips */}
            <div className="px-2 sm:px-0 pt-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
              {discoveryChips.map((chip) => {
                const isSelected = selectedChip === chip.label;
                return (
                  <button
                    key={chip.label}
                    onClick={() => {
                      setSelectedChip(chip.label);
                      setActiveQuery(chip.q);
                      loadFeed(chip.q, true);
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

            {/* SECTION 2 & 10: 16:9 Long-Form Video Player (Full Width on Mobile) */}
            {activeVideo && (
              <div
                ref={playerContainerRef}
                className={`bg-[#0f1422] border-0 sm:border border-white/10 overflow-hidden shadow-2xl transition-all ${
                  isFullscreen
                    ? 'fixed inset-0 z-50 rounded-none w-screen h-screen flex flex-col bg-black'
                    : 'rounded-none sm:rounded-3xl'
                }`}
              >
                {/* 16:9 Responsive Video Player with Aspect Ratio Preserved */}
                <div className="relative w-full aspect-video bg-black overflow-hidden flex items-center justify-center">
                  <iframe
                    key={activeVideo.videoId}
                    src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(
                      typeof window !== 'undefined' ? window.location.origin : ''
                    )}`}
                    title={activeVideo.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
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

                {/* Video Info & Controls Strip (Under player) */}
                <div className="p-3 sm:p-5 space-y-3.5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/5">
                    <div className="space-y-1 max-w-3xl">
                      <h2 className="text-sm sm:text-base md:text-lg font-extrabold text-white leading-snug">
                        {activeVideo.title}
                      </h2>
                      <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400">
                        <span>{activeVideo.publishedAt || 'YouTube'}</span>
                        <span>•</span>
                        <span className="text-red-400 font-semibold">{activeVideo.category || 'Trending'}</span>
                      </div>
                    </div>

                    {/* Actions: Support, Fire Like, Boost, External */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setSubscribedChannels((prev) => ({
                            ...prev,
                            [activeVideo.creatorName]: !prev[activeVideo.creatorName],
                          }));
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
                        onClick={() => {
                          setLikedVideos((prev) => ({ ...prev, [activeVideo.videoId]: !prev[activeVideo.videoId] }));
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
                        onClick={() => {
                          navigator.clipboard.writeText(activeVideo.originalVideoUrl);
                          setCopiedNotice('Boost link copied!');
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

                  {/* Creator Channel Tag */}
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#131b2e] border border-white/5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center font-bold text-white text-xs">
                      {activeVideo.creatorName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white flex items-center gap-1">
                        <span>{activeVideo.creatorName}</span>
                        <CheckCircle2 className="w-3 h-3 text-red-500" />
                      </h4>
                      <p className="text-[10px] text-slate-400">Official Partner Channel • YouTube Verified</p>
                    </div>
                  </div>

                  {/* Public Talk / Comments Section */}
                  <div className="pt-2 border-t border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white flex items-center gap-1.5">
                        <TalkIcon className="w-4 h-4" active />
                        <span>Talk ({comments.length})</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Live API</span>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newCommentText.trim()) return;
                        setComments([
                          {
                            id: 'c_' + Date.now(),
                            authorDisplayName: authUser?.channelTitle || 'You (Motherland)',
                            authorProfileImageUrl: authUser?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
                            textDisplay: newCommentText.trim(),
                            publishedAt: 'Just now',
                            likeCount: 0,
                          },
                          ...comments,
                        ]);
                        setNewCommentText('');
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
                          disabled={!newCommentText.trim()}
                          className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </form>

                    {/* Comments list */}
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {comments.map((cmt) => (
                        <div key={cmt.id} className="p-2 rounded-xl bg-[#111728] border border-white/5 flex items-start gap-2.5 text-xs">
                          <img
                            src={cmt.authorProfileImageUrl}
                            alt={cmt.authorDisplayName}
                            className="w-6 h-6 rounded-full object-cover mt-0.5"
                          />
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

            {/* Continuous Video Discovery Grid (Infinite Non-Stop Feed) */}
            <div className="space-y-3 px-2 sm:px-0">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-red-500" />
                  <span>Continuous Video Discovery ({videos.length} Loaded)</span>
                </h3>
                <span className="text-[11px] font-mono text-slate-400">Up to 50 results per batch</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {videos.map((vid) => {
                  const isCurrent = activeVideo?.videoId === vid.videoId;
                  return (
                    <div
                      key={vid.id}
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
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
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
                            {vid.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1 truncate">{vid.creatorName}</p>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{vid.publishedAt || 'YouTube'}</span>
                          <span className="text-red-400 font-semibold group-hover:underline flex items-center gap-1">
                            <Play className="w-3 h-3 fill-current" />
                            <span>Play</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Infinite Sentinel & Load Button */}
              <div ref={sentinelRef} className="pt-6 pb-12 flex flex-col items-center justify-center">
                {isFetchingMore ? (
                  <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#141b2c] border border-red-500/30 text-white text-xs font-semibold shadow-lg">
                    <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                    <span>Loading additional YouTube videos...</span>
                  </div>
                ) : nextPageToken ? (
                  <button
                    onClick={loadNextPage}
                    className="px-6 py-2.5 rounded-full bg-[#141b2c] hover:bg-[#1a233c] border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-red-400" />
                    <span>Fetch Next Page ({videos.length} loaded)</span>
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 font-mono">
                    ✓ All available continuous discovery videos loaded ({videos.length} total)
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
                <span>Supported Channels &amp; Premieres</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {['Coke Studio Bangla', 'BCB Tigers', 'Dhaka Post Media', 'Bangla Vision Drama'].map((ch) => (
                <div key={ch} className="p-3.5 rounded-2xl bg-[#0f1422] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-400 flex items-center justify-center font-bold text-sm">
                      {ch.slice(0, 1)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-white">{ch}</h4>
                      <p className="text-[10px] text-slate-400">Verified Partner Channel</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-[10px] font-semibold text-emerald-300">
                    Supporting
                  </span>
                </div>
              ))}
            </div>
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
                    <img
                      src={authUser.avatarUrl}
                      alt={authUser.channelTitle || authUser.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-red-500/60"
                    />
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
                        <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
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
                        <img src={vid.thumbnailUrl} alt={vid.title} className="w-full h-full object-cover" />
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
                      <img src={pl.thumbnailUrl} alt={pl.title} className="w-full h-full object-cover" />
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
                      <img src={sv.thumbnailUrl} alt={sv.title} className="w-full h-full object-cover" />
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
