import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield,
  Sparkles,
  Image as ImageIcon,
  Film,
  Flame,
  RefreshCw,
  Loader2,
  TrendingUp,
  Compass,
  PlaySquare,
  Youtube,
  ChevronRight,
  Bookmark,
  ArrowLeft,
  LogIn,
} from 'lucide-react';
import { api } from './api';
import type {
  UserProfile,
  Post,
  Story,
  ShortVideo,
  LongVideo,
  NotificationItem,
  PlatformAdapterInfo,
  ReactionType,
  ChatMessage,
} from './types';

import { Header } from './components/Header';
import { BottomNav, NavTab } from './components/BottomNav';
import { StoriesBar } from './components/StoriesBar';
import { PostCard } from './components/PostCard';
import { VideoSection } from './components/VideoSection';
import { PersistentWatchPlayer } from './components/PersistentWatchPlayer';
import { FriendsView } from './components/FriendsView';
import { ProfileView } from './components/ProfileView';
import { MenuView } from './components/MenuView';
import { CommentsDrawer } from './components/CommentsDrawer';
import { CreateModal, CreateEntryMode } from './components/CreateModal';
import { VideoPublishFlow } from './components/VideoPublishFlow';
import { ShortsPlayerModal } from './components/ShortsPlayerModal';
import { MessagesDrawer } from './components/MessagesDrawer';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { PlatformHubModal } from './components/PlatformHubModal';
import { AuthModal } from './components/AuthModal';
import { SocialAppsHub } from './components/social-apps/SocialAppsHub';
import { MotherlandLogo } from './components/layout/MotherlandLogo';
import { YouTubeFullExperience } from './components/video/YouTubeFullExperience';
import { CallOverlay } from './components/wave/CallOverlay';
import { useWebRTC } from './hooks/useWebRTC';
import {
  useBackHandler,
  subscribeEdgeSwipeProgress,
} from './hooks/useBackNavigation';
import { useRealtime, RealtimeEvent } from './hooks/useRealtime';
import { filterUnsuppressed, WATCH_SUPPRESSED_EVENT } from './services/watchSuppression';
import { parseGoogleOAuthHashRedirect } from './services/youtubeAuthService';
import { playNotificationChime, playMessageChime } from './utils/motherlandSoundEngine';

const INSTANT_FEED_CACHE_KEY = 'motherland_instant_cache_v1';

interface InstantFeedCache {
  posts: Post[];
  stories: Story[];
  shorts: ShortVideo[];
  longVideos: LongVideo[];
}

function readInstantFeedCache(): InstantFeedCache {
  if (typeof window === 'undefined') {
    return { posts: [], stories: [], shorts: [], longVideos: [] };
  }
  try {
    const raw = localStorage.getItem(INSTANT_FEED_CACHE_KEY);
    if (!raw) return { posts: [], stories: [], shorts: [], longVideos: [] };
    const parsed = JSON.parse(raw);
    return {
      posts: Array.isArray(parsed?.posts) ? filterUnsuppressed(parsed.posts, true) : [],
      stories: Array.isArray(parsed?.stories) ? parsed.stories : [],
      shorts: Array.isArray(parsed?.shorts) ? filterUnsuppressed(parsed.shorts) : [],
      longVideos: Array.isArray(parsed?.longVideos) ? filterUnsuppressed(parsed.longVideos) : [],
    };
  } catch {
    return { posts: [], stories: [], shorts: [], longVideos: [] };
  }
}

function writeInstantFeedCache(cache: InstantFeedCache): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      INSTANT_FEED_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        posts: cache.posts.slice(0, 15),
        stories: cache.stories.slice(0, 20),
        shorts: cache.shorts.slice(0, 20),
        longVideos: cache.longVideos.slice(0, 20),
      })
    );
  } catch {
    // ignore storage quota
  }
}

export default function App() {
  // Navigation & Theme
  const [activeNav, setActiveNav] = useState<NavTab>('home');
  const [feedFilter, setFeedFilter] = useState<'all' | 'for_you' | 'motherland' | 'saved'>('all');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('motherland_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#13161C' : '#F2F4F8');
    }
    try {
      localStorage.setItem('motherland_theme', theme);
    } catch {
      // Ignore storage error
    }
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  // Core Data (hydrated instantaneously from cache for zero startup lag)
  const initialCachedRef = useRef<InstantFeedCache>(readInstantFeedCache());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string>(() => api.getToken() || '');
  const [posts, setPosts] = useState<Post[]>(initialCachedRef.current.posts);
  const [stories, setStories] = useState<Story[]>(initialCachedRef.current.stories);
  const [shorts, setShorts] = useState<ShortVideo[]>(initialCachedRef.current.shorts);
  const [shortsPage, setShortsPage] = useState(1);
  const [shortsNextPageToken, setShortsNextPageToken] = useState<string | null>(null);
  const [shortsHasMore, setShortsHasMore] = useState(true);
  const [shortsExhaustedNotice, setShortsExhaustedNotice] = useState('');
  const [isLoadingMoreShorts, setIsLoadingMoreShorts] = useState(false);

  const [longVideos, setLongVideos] = useState<LongVideo[]>(initialCachedRef.current.longVideos);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [adapters, setAdapters] = useState<PlatformAdapterInfo[]>([]);
  const [youtubeStatus, setYoutubeStatus] = useState<any>({ configured: false });

  // Realtime & Section Refresh Signals
  const [friendsRefreshSignal, setFriendsRefreshSignal] = useState(0);
  const [videoRefreshSignal, setVideoRefreshSignal] = useState(0);
  const [ytRefreshSignal, setYtRefreshSignal] = useState(0);
  const [messagesRealtimeSignal, setMessagesRealtimeSignal] = useState(0);
  const [incomingRealtimeMessage, setIncomingRealtimeMessage] = useState<{
    conversationId: string;
    message: ChatMessage;
  } | null>(null);
  const [onlineUsersMap, setOnlineUsersMap] = useState<Record<string, boolean>>({});
  const [typingMap, setTypingMap] = useState<
    Record<string, { userId: string; userName: string; expiresAt: number }>
  >({});
  const [chatTargetUserId, setChatTargetUserId] = useState<string | null>(null);
  const handleCallSignalRef = useRef<(payload: Record<string, any>) => void>(() => {});
  const currentUserRef = useRef<UserProfile | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const activeCallPhaseRef = useRef<string>('idle');
  currentUserRef.current = currentUser;

  // Loading States (Never block initial render with a slow splash wall)
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isFetchingInitialPosts, setIsFetchingInitialPosts] = useState(
    initialCachedRef.current.posts.length === 0
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [homeFeedPage, setHomeFeedPage] = useState(1);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const lastAutoRefreshRef = useRef<number>(Date.now());
  const homeSentinelRef = useRef<HTMLDivElement | null>(null);
  const savedScrollRef = useRef<number>(0);

  // Persistent Long-Form Watch Player State
  const [activeWatchVideo, setActiveWatchVideo] = useState<LongVideo | null>(null);
  const [isWatchMinimized, setIsWatchMinimized] = useState(false);
  const [watchAnchorElement, setWatchAnchorElement] = useState<HTMLDivElement | null>(null);

  // Modals & Drawers
  const [createModalState, setCreateModalState] = useState<{
    isOpen: boolean;
    initialMode: CreateEntryMode;
  }>({ isOpen: false, initialMode: 'menu' });

  const [videoPublishState, setVideoPublishState] = useState<{
    isOpen: boolean;
    initialDestination: 'select' | 'motherland' | 'youtube';
  }>({ isOpen: false, initialDestination: 'select' });

  const [shortsPlayerState, setShortsPlayerState] = useState<{
    isOpen: boolean;
    list: ShortVideo[];
    initialIndex: number;
  }>({ isOpen: false, list: [], initialIndex: 0 });

  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isPlatformHubOpen, setIsPlatformHubOpen] = useState(false);
  const [isSocialAppsOpen, setIsSocialAppsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [commentsDrawerState, setCommentsDrawerState] = useState<{
    isOpen: boolean;
    postId?: string;
    youtubeVideoId?: string;
    title?: string;
  }>({ isOpen: false });

  // Edge swipe back indicator
  const [edgeSwipePx, setEdgeSwipePx] = useState(0);
  useEffect(() => {
    return subscribeEdgeSwipeProgress(setEdgeSwipePx);
  }, []);

  // Sub-tab back navigation (Friends / Video / Menu / Profile / YouTube -> Home)
  useBackHandler(
    'app-youtube-tab',
    activeNav === 'youtube',
    () => setActiveNav('home'),
    12
  );
  useBackHandler(
    'app-sub-tab',
    activeNav !== 'home' && activeNav !== 'youtube',
    () => setActiveNav('home'),
    10
  );

  // Helper to prompt auth for guests when attempting authenticated actions
  const requireSignedIn = useCallback((): boolean => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return false;
    }
    return true;
  }, [currentUser]);

  const refreshUnreadMessages = useCallback(async () => {
    if (!api.getToken() && !currentUserRef.current) {
      setUnreadMessagesCount(0);
      return;
    }
    try {
      const data = await api.getConversations();
      setUnreadMessagesCount(data.totalUnread || 0);
    } catch {
      // ignore if unauthenticated
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!api.getToken() && !currentUserRef.current) {
      setNotifications([]);
      return;
    }
    try {
      const notifData = await api.getNotifications();
      const items = notifData.notifications || [];
      items.forEach((n) => seenNotifIdsRef.current.add(n.id));
      setNotifications(items);
    } catch (err) {
      console.error('Refresh notifications error:', err);
    }
  }, []);

  // Live WebSocket subscription
  const handleRealtimeEvent = useCallback(
    (evt: RealtimeEvent) => {
      if (evt.type === 'chat:message' && evt.message && evt.conversationId) {
        setIncomingRealtimeMessage({
          conversationId: evt.conversationId,
          message: evt.message,
        });
        setMessagesRealtimeSignal((s) => s + 1);
        refreshUnreadMessages();
        const me = currentUserRef.current;
        if (
          me &&
          evt.message.senderId !== me.id &&
          me.notificationPrefs?.messages !== false &&
          activeCallPhaseRef.current === 'idle'
        ) {
          playMessageChime();
        }
      } else if (
        evt.type === 'chat:read' ||
        evt.type === 'chat:message_update' ||
        evt.type === 'chat:message_delete' ||
        evt.type === 'conv:update'
      ) {
        setMessagesRealtimeSignal((s) => s + 1);
        refreshUnreadMessages();
      } else if (evt.type === 'chat:typing' && evt.conversationId && evt.userId) {
        const convId = String(evt.conversationId);
        if (evt.isTyping) {
          setTypingMap((prev) => ({
            ...prev,
            [convId]: {
              userId: String(evt.userId),
              userName: String(evt.userName || 'Someone'),
              expiresAt: Date.now() + 3500,
            },
          }));
        } else {
          setTypingMap((prev) => {
            if (!prev[convId]) return prev;
            const next = { ...prev };
            delete next[convId];
            return next;
          });
        }
      } else if (evt.type === 'call:signal') {
        handleCallSignalRef.current(evt);
      } else if (evt.type === 'friend:update') {
        setFriendsRefreshSignal((s) => s + 1);
        refreshNotifications();
        api.getCurrentUser().then((r) => {
          if (r.user) setCurrentUser(r.user);
        }).catch(() => {});
      } else if (evt.type === 'notification:new' && evt.notification) {
        const incomingId = String(evt.notification.id || '');
        const alreadySeen = incomingId ? seenNotifIdsRef.current.has(incomingId) : false;
        if (incomingId) seenNotifIdsRef.current.add(incomingId);
        setNotifications((prev) => {
          if (prev.some((n) => n.id === evt.notification.id)) return prev;
          return [evt.notification, ...prev];
        });
        if (!alreadySeen && activeCallPhaseRef.current !== 'connected') {
          void playNotificationChime();
        }
      } else if (evt.type === 'presence:update' && evt.userId) {
        setOnlineUsersMap((prev) => ({
          ...prev,
          [evt.userId]: Boolean(evt.isOnline),
        }));
      }
    },
    [refreshUnreadMessages, refreshNotifications]
  );

  const { sendEvent: sendWsEvent } = useRealtime(
    currentUser ? (authToken || '__cookie__') : '',
    handleRealtimeEvent
  );

  const {
    call: activeCall,
    localStream,
    remoteStream,
    startCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    switchToAudioOnly,
    handleCallSignal,
  } = useWebRTC({
    currentUser,
    sendWsEvent,
    onCallEnded: () => setMessagesRealtimeSignal((s) => s + 1),
  });
  handleCallSignalRef.current = handleCallSignal;
  activeCallPhaseRef.current = activeCall?.phase || 'idle';

  // Initial Data Bootstrap (runs in parallel with OAuth hash completion, zero startup splash block)
  useEffect(() => {
    parseGoogleOAuthHashRedirect()
      .then((gAuth) => {
        if (gAuth) {
          bootstrapApp();
        }
      })
      .catch(() => {});
    bootstrapApp();
  }, []);

  // Live 14-day watched suppression pruning across all feeds & shorts list
  useEffect(() => {
    const onSuppressed = () => {
      setPosts((prev) => filterUnsuppressed(prev, true));
      setShorts((prev) => filterUnsuppressed(prev));
      setLongVideos((prev) => filterUnsuppressed(prev));
    };
    window.addEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
    return () => window.removeEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
  }, []);

  const bootstrapApp = async () => {
    try {
      setAuthToken(api.getToken() || '');
      const [
        userData,
        ytData,
        adaptData,
        notifData,
        storiesData,
        shortsData,
        longData,
        convData,
        postsData,
      ] = await Promise.all([
        api.getCurrentUser().catch(() => ({ user: null })),
        api.getYouTubeStatus().catch(() => ({ configured: false })),
        api.getPlatformAdapters().catch(() => ({ adapters: [] })),
        api.getToken() ? api.getNotifications().catch(() => ({ notifications: [] })) : Promise.resolve({ notifications: [] }),
        api.getStories().catch(() => ({ stories: [] })),
        api.getShorts().catch(() => ({ shorts: [] })),
        api.getLongVideos().catch(() => ({ videos: [] })),
        api.getToken() ? api.getConversations().catch(() => ({ totalUnread: 0 })) : Promise.resolve({ totalUnread: 0 }),
        api.getPosts(feedFilter, 'all', 1, 10).catch(() => ({ posts: [], hasMore: false })),
      ]);

      const nextStories = storiesData.stories || [];
      const nextShorts = filterUnsuppressed(shortsData.shorts || []);
      const nextLongVideos = filterUnsuppressed(longData.videos || []);
      const nextPosts = filterUnsuppressed(postsData.posts || [], true);

      const resolvedUser = userData.user || null;
      let resolvedNotifs = notifData.notifications || [];
      let resolvedUnread = (convData as any).totalUnread || 0;

      // If authenticated via HttpOnly session cookie (e.g., localStorage cleared), load user notifications & chats too
      if (resolvedUser && !api.getToken()) {
        const [cookieNotifs, cookieConvs] = await Promise.all([
          api.getNotifications().catch(() => ({ notifications: [] })),
          api.getConversations().catch(() => ({ totalUnread: 0 })),
        ]);
        resolvedNotifs = cookieNotifs.notifications || [];
        resolvedUnread = (cookieConvs as any).totalUnread || 0;
      }

      setCurrentUser(resolvedUser);
      setYoutubeStatus(ytData);
      setAdapters(adaptData.adapters || []);
      setNotifications(resolvedNotifs);
      setStories(nextStories);
      setShorts(nextShorts);
      setShortsPage(1);
      setShortsNextPageToken(null);
      setShortsHasMore(true);
      setShortsExhaustedNotice('');
      setLongVideos(nextLongVideos);
      setUnreadMessagesCount(resolvedUnread);
      setHomeFeedPage(1);
      setPosts(nextPosts);
      setHasMorePosts((postsData as any).hasMore !== false);
      lastAutoRefreshRef.current = Date.now();

      writeInstantFeedCache({
        posts: nextPosts,
        stories: nextStories,
        shorts: nextShorts,
        longVideos: nextLongVideos,
      });
    } catch (err) {
      console.error('Bootstrap error:', err);
    } finally {
      setIsLoadingFeed(false);
      setIsFetchingInitialPosts(false);
    }
  };

  const loadPosts = async (type: 'all' | 'for_you' | 'motherland' | 'saved' = feedFilter, reset = true) => {
    try {
      if (reset) {
        setHomeFeedPage(1);
        const data = await api.getPosts(type, 'all', 1, 10);
        const filtered = filterUnsuppressed(data.posts || [], true);
        setPosts(filtered);
        setHasMorePosts(data.hasMore !== false);
      }
    } catch (err) {
      console.error('Failed to load posts:', err);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMorePosts || !hasMorePosts) return;
    setIsLoadingMorePosts(true);
    try {
      const nextPage = homeFeedPage + 1;
      const data = await api.getPosts(feedFilter, 'all', nextPage, 10);
      if (data.posts && data.posts.length > 0) {
        const filtered = filterUnsuppressed(data.posts, true);
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...filtered.filter((p) => !seen.has(p.id))];
        });
        setHomeFeedPage(nextPage);
      }
      setHasMorePosts(data.hasMore !== false);
    } catch (err) {
      console.error('Load more posts error:', err);
    } finally {
      setIsLoadingMorePosts(false);
    }
  };

  // Continuous Cursor-Based Infinite Shorts Loader
  const handleLoadMoreShorts = async () => {
    if (isLoadingMoreShorts || !shortsHasMore) return;
    setIsLoadingMoreShorts(true);
    try {
      const nextPage = shortsPage + 1;
      const res = await api.getYouTubeFeed({
        type: 'shorts',
        pageToken: shortsNextPageToken || undefined,
        page: nextPage,
        pageSize: 12,
      });

      if (res.quotaExceeded) {
        setShortsHasMore(false);
        setShortsExhaustedNotice(
          res.exhaustedReason || 'YouTube API quota limit reached for now. Please try again later.'
        );
        return;
      }

      const fetched: ShortVideo[] = filterUnsuppressed(
        (res.items || []).map((item: any) => ({
          id: item.id,
          source: 'youtube' as const,
          youtubeId: item.youtubeId || item.id,
          videoUrl: '',
          thumbnailUrl: item.thumbnailUrl,
          title: item.title,
          caption: item.title || '',
          createdAt: item.publishedAt || new Date().toISOString(),
          creator: {
            id: item.channel?.id || 'yt',
            name: item.channel?.title || 'YouTube Creator',
            username: (item.channel?.title || 'creator').toLowerCase().replace(/\s+/g, ''),
            avatar: item.channel?.avatar || '',
          },
          stats: {
            views: item.stats?.views || 0,
            likes: item.stats?.likes || 0,
            comments: item.stats?.comments || 0,
            shares: 0,
          },
          hashtags: [],
        }))
      );

      if (fetched.length > 0) {
        setShorts((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const unique = fetched.filter((s) => !existingIds.has(s.id));
          const merged = [...prev, ...unique];
          setShortsPlayerState((st) => (st.isOpen ? { ...st, list: merged } : st));
          return merged;
        });
        setShortsPage(nextPage);
      }

      const nextToken = res.nextPageToken || null;
      setShortsNextPageToken(nextToken);
      if (res.hasMore === false && !nextToken) {
        setShortsHasMore(false);
        if (res.exhaustedReason) setShortsExhaustedNotice(res.exhaustedReason);
      }
    } catch (err) {
      console.error('Load more shorts error:', err);
    } finally {
      setIsLoadingMoreShorts(false);
    }
  };

  // Automatic Background Auto-Refresh (on focus/visibility + every 90s when not actively watching)
  useEffect(() => {
    const runSilentAutoRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (shortsPlayerState.isOpen || (activeWatchVideo && !isWatchMinimized)) return;
      lastAutoRefreshRef.current = Date.now();
      loadPosts(feedFilter, true);
      api
        .getStories()
        .then((s) => setStories(s.stories || []))
        .catch(() => {});
      api
        .getShorts()
        .then((s) => setShorts(filterUnsuppressed(s.shorts || [])))
        .catch(() => {});
      if (activeNav === 'video') {
        setVideoRefreshSignal((s) => s + 1);
      } else if (activeNav === 'youtube') {
        setYtRefreshSignal((s) => s + 1);
      } else if (activeNav === 'friends') {
        setFriendsRefreshSignal((s) => s + 1);
      }
    };

    const onFocusOrVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAutoRefreshRef.current > 45000) {
        runSilentAutoRefresh();
      }
    };

    const intervalId = window.setInterval(() => {
      if (Date.now() - lastAutoRefreshRef.current >= 90000) {
        runSilentAutoRefresh();
      }
    }, 30000);

    document.addEventListener('visibilitychange', onFocusOrVisibility);
    window.addEventListener('focus', onFocusOrVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onFocusOrVisibility);
      window.removeEventListener('focus', onFocusOrVisibility);
    };
  }, [activeNav, feedFilter, shortsPlayerState.isOpen, activeWatchVideo, isWatchMinimized]);

  // IntersectionObserver for Home Feed infinite scroll
  useEffect(() => {
    if (activeNav !== 'home') return;
    const sentinel = homeSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMorePosts && hasMorePosts) {
          loadMorePosts();
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeNav, isLoadingMorePosts, hasMorePosts, homeFeedPage, feedFilter]);

  const refreshAll = async () => {
    setIsRefreshing(true);
    await bootstrapApp();
    setIsRefreshing(false);
  };

  // Full-Screen Shorts open/close preserving exact scroll position
  const openShortsPlayer = (list: ShortVideo[], startIndex = 0) => {
    savedScrollRef.current = window.scrollY;
    setShortsPlayerState({
      isOpen: true,
      list: list.length > 0 ? list : shorts,
      initialIndex: startIndex,
    });
  };

  const closeShortsPlayer = () => {
    setShortsPlayerState((prev) => ({ ...prev, isOpen: false }));
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedScrollRef.current, behavior: 'auto' });
    });
  };

  // Reactions & Post Actions
  const handleReact = async (postId: string, reaction: ReactionType) => {
    if (!requireSignedIn()) return;
    try {
      const res = await api.reactToPost(postId, reaction);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, stats: { ...p.stats, likes: res.likes }, userInteractions: res.userInteractions }
            : p
        )
      );
    } catch (err) {
      console.error('React error:', err);
    }
  };

  const handleToggleSave = async (postId: string) => {
    if (!requireSignedIn()) return;
    try {
      const res = await api.toggleSavePost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, userInteractions: { ...p.userInteractions, isSaved: res.isSaved } }
            : p
        )
      );
    } catch (err) {
      console.error('Toggle save error:', err);
    }
  };

  const handleSharePost = async (postId: string) => {
    if (!requireSignedIn()) return;
    try {
      const res = await api.sharePost(postId);
      if (res.success && res.post) {
        const sharedItem = res.post;
        setPosts((prev) => [
          sharedItem,
          ...prev.map((p) =>
            p.id === postId
              ? { ...p, stats: { ...p.stats, shares: res.shares ?? p.stats.shares + 1 } }
              : p
          ),
        ]);
      }
    } catch (err) {
      console.error('Share post error:', err);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!requireSignedIn()) return;
    try {
      await api.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error('Delete post error:', err);
    }
  };

  const handleStoryViewed = async (storyId: string) => {
    try {
      await api.markStoryViewed(storyId);
      setStories((prev) =>
        prev.map((s) => (s.id === storyId ? { ...s, isViewed: true } : s))
      );
    } catch (err) {
      console.error('Story viewed error:', err);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!requireSignedIn()) return;
    try {
      await api.deleteStory(storyId);
      setStories((prev) => prev.filter((s) => s.id !== storyId));
    } catch (err) {
      console.error('Delete story error:', err);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!requireSignedIn()) return;
    try {
      await api.markNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Mark read error:', err);
    }
  };

  const handleAuthSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setAuthToken(api.getToken() || '');
    bootstrapApp();
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setCurrentUser(null);
      setAuthToken('');
      setNotifications([]);
      setUnreadMessagesCount(0);
      await bootstrapApp();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleAccountDeleted = async () => {
    setCurrentUser(null);
    setAuthToken('');
    setNotifications([]);
    setUnreadMessagesCount(0);
    setActiveNav('home');
    await bootstrapApp();
  };

  const handleSwitchAccount = async (account: UserProfile) => {
    setCurrentUser(account);
    setAuthToken(api.getToken() || '');
    await bootstrapApp();
  };

  // Show loading screen ONLY during initial bootstrap fetch — guests proceed seamlessly after bootstrap completes
  if (isLoadingFeed) {
    return (
      <div className="min-h-screen ml-canvas-bg text-[var(--text-primary)] flex flex-col items-center justify-center p-4">
        <MotherlandLogo size={64} showText={false} className="mb-4 animate-pulse" />
        <h2 className="text-lg font-extrabold tracking-widest text-[var(--accent-primary)]">
          MOTHERLAND
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-2">Loading feed...</p>
      </div>
    );
  }

  const unreadNotificationsCount = currentUser ? notifications.filter((n) => !n.isRead).length : 0;
  const firstName = currentUser ? currentUser.displayName.split(' ')[0] || currentUser.username : 'Guest';
  const hasMiniPlayer = Boolean(
    activeWatchVideo && (isWatchMinimized || activeNav !== 'video')
  );

  // Render inline horizontal Shorts carousel inside Home feed
  const renderHomeShortsStrip = (offset = 0) => {
    if (shorts.length === 0) return null;
    const rotated =
      offset > 0 && shorts.length > 3
        ? [...shorts.slice(offset % shorts.length), ...shorts.slice(0, offset % shorts.length)]
        : shorts;

    return (
      <section className="ml-glass rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-gold-soft)] border border-[var(--accent-gold-border)] flex items-center justify-center text-[var(--accent-gold)]">
              <Flame className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-[var(--text-primary)]">Shorts</h3>
          </div>
          <button
            type="button"
            onClick={() => openShortsPlayer(shorts, 0)}
            className="text-xs font-bold text-[var(--accent-primary)] hover:underline flex items-center gap-0.5 min-h-[36px] px-1"
          >
            <span>Watch all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
          {rotated.slice(0, 10).map((short) => {
            const actualIndex = shorts.findIndex((s) => s.id === short.id);
            return (
              <button
                key={`${short.id}-${offset}`}
                type="button"
                onClick={() => openShortsPlayer(shorts, actualIndex >= 0 ? actualIndex : 0)}
                className="flex-shrink-0 w-[132px] sm:w-[148px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-[var(--border-subtle)] snap-start relative group text-left shadow-sm"
              >
                <img
                  src={short.thumbnailUrl}
                  alt={short.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#13161C]/90 via-[#13161C]/15 to-transparent" />
                <div className="absolute bottom-2.5 left-2.5 right-2.5">
                  <p className="text-[11px] font-bold text-white line-clamp-2 leading-snug drop-shadow">
                    {short.title}
                  </p>
                  <p className="text-[10px] text-white/75 mt-1 tabular-nums">
                    {short.stats.views.toLocaleString()} views
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen ml-canvas-bg text-[var(--text-primary)] font-['Plus_Jakarta_Sans'] flex flex-col selection:bg-[var(--accent-primary)] selection:text-[var(--accent-primary-contrast)] transition-colors">
      {/* Subtle Edge-Swipe Back Indicator */}
      {edgeSwipePx > 14 && (
        <div
          className="fixed left-2 top-1/2 -translate-y-1/2 z-[70] w-10 h-10 rounded-full bg-[var(--accent-royal)] border border-[var(--accent-gold-border)] text-[var(--accent-gold)] flex items-center justify-center shadow-2xl pointer-events-none"
          style={{
            transform: `translate(${Math.min(44, edgeSwipePx * 0.45)}px, -50%) scale(${Math.min(1.08, 0.75 + edgeSwipePx / 160)})`,
            opacity: Math.min(1, edgeSwipePx / 50),
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </div>
      )}

      {/* 1. Header (hidden inside full-screen YouTube experience) */}
      {activeNav !== 'youtube' && (
        <Header
          currentUser={currentUser}
          unreadNotifications={unreadNotificationsCount}
          unreadMessages={unreadMessagesCount}
          isYouTubeActive={false}
          onOpenNotifications={() => {
            if (requireSignedIn()) {
              refreshNotifications();
              setIsNotificationsOpen(true);
            }
          }}
          onOpenMessages={() => {
            if (requireSignedIn()) {
              refreshUnreadMessages();
              setIsMessagesOpen(true);
            }
          }}
          onOpenSearch={() => {
            setActiveNav('video');
            setVideoRefreshSignal((s) => s + 1);
          }}
          onOpenProfile={() => {
            setActiveNav('profile');
            loadPosts(feedFilter, true);
            api.getCurrentUser().then((r) => r.user && setCurrentUser(r.user)).catch(() => {});
          }}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenYouTube={() => {
            setActiveNav('youtube');
            setYtRefreshSignal((s) => s + 1);
          }}
          onLogoClick={() => {
            setActiveNav('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            refreshAll();
          }}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 ${activeNav === 'youtube' ? 'pb-0' : hasMiniPlayer ? 'pb-40' : 'pb-24'}`}>
        {/* ========================================================= */}
        {/* TAB 1: HOME FEED                                          */}
        {/* ========================================================= */}
        {activeNav === 'home' && (
          <div className="max-w-6xl mx-auto px-2.5 sm:px-4 py-3.5 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Center Feed Column */}
            <div className="lg:col-span-8 space-y-4">
              {/* Stories Carousel */}
              <div className="ml-glass rounded-2xl p-2.5">
                <StoriesBar
                  currentUser={currentUser}
                  stories={stories}
                  onCreateStory={() => {
                    if (requireSignedIn()) setCreateModalState({ isOpen: true, initialMode: 'story' });
                  }}
                  onStoryViewed={handleStoryViewed}
                  onDeleteStory={handleDeleteStory}
                />
              </div>

              {/* Quick Create Box (or Sign-In Prompt for Guests) */}
              <div className="ml-glass rounded-2xl p-3.5 space-y-3">
                {currentUser ? (
                  <>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveNav('profile')}
                        className="flex-shrink-0"
                      >
                        <img
                          src={currentUser.avatar}
                          alt={currentUser.displayName}
                          className="w-10 h-10 rounded-full object-cover border border-[var(--border-subtle)]"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreateModalState({ isOpen: true, initialMode: 'post' })}
                        className="flex-1 min-h-[42px] bg-[var(--bg-surface-alt)] hover:opacity-90 border border-[var(--border-subtle)] rounded-full px-4 py-2 text-left text-xs sm:text-sm text-[var(--text-secondary)] transition-all"
                      >
                        What's on your mind, {firstName}?
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <button
                        type="button"
                        onClick={() => setCreateModalState({ isOpen: true, initialMode: 'post' })}
                        className="min-h-[42px] rounded-xl hover:bg-[var(--bg-surface-alt)] flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--text-primary)] transition-colors"
                      >
                        <ImageIcon className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span>Photo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setVideoPublishState({ isOpen: true, initialDestination: 'select' })
                        }
                        className="min-h-[42px] rounded-xl hover:bg-[var(--bg-surface-alt)] flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--text-primary)] transition-colors"
                      >
                        <Film className="w-4 h-4 text-[var(--accent-gold)]" />
                        <span>Video</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCreateModalState({ isOpen: true, initialMode: 'story' })}
                        className="min-h-[42px] rounded-xl hover:bg-[var(--bg-surface-alt)] flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--text-primary)] transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span>Story</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        Welcome to MOTHERLAND
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Sign in to publish posts, add friends, and chat in real time.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAuthOpen(true)}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Feed Filter Tabs (All, For You, MOTHERLAND, Saved) */}
              <div className="flex items-center justify-between gap-2 px-0.5">
                <div className="flex items-center gap-1 bg-[var(--bg-glass)] backdrop-blur-md p-1 rounded-xl border border-[var(--border-subtle)] overflow-x-auto no-scrollbar">
                  {(
                    [
                      { key: 'all', label: 'All' },
                      { key: 'for_you', label: 'For You' },
                      { key: 'motherland', label: 'MOTHERLAND' },
                      { key: 'saved', label: 'Saved' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      data-testid={`feed-tab-${tab.key}`}
                      onClick={() => {
                        if (tab.key === 'saved' && !requireSignedIn()) return;
                        setFeedFilter(tab.key);
                        loadPosts(tab.key, true);
                      }}
                      className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                        feedFilter === tab.key
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] shadow-sm'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={refreshAll}
                  disabled={isRefreshing}
                  className="w-10 h-10 rounded-xl ml-glass hover:bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors flex-shrink-0"
                  title="Refresh Feed"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
                  />
                </button>
              </div>

              {/* Feed Stream with Interspersed Shorts Discovery Carousels */}
              {isFetchingInitialPosts && posts.length === 0 ? (
                <div className="space-y-4">
                  {[0, 1].map((idx) => (
                    <div key={idx} className="ml-glass rounded-2xl p-4 space-y-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-alt)]" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 w-32 rounded bg-[var(--bg-surface-alt)]" />
                          <div className="h-2.5 w-20 rounded bg-[var(--bg-surface-alt)]" />
                        </div>
                      </div>
                      <div className="h-40 w-full rounded-xl bg-[var(--bg-surface-alt)]" />
                    </div>
                  ))}
                  {renderHomeShortsStrip(0)}
                </div>
              ) : posts.length === 0 ? (
                <>
                  <div className="py-14 text-center ml-glass rounded-2xl p-6 text-[var(--text-secondary)]">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {feedFilter === 'saved' ? 'No saved posts yet.' : 'No posts in this feed yet.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (requireSignedIn()) {
                          setCreateModalState({ isOpen: true, initialMode: 'post' });
                        }
                      }}
                      className="mt-3 px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold"
                    >
                      Create Post
                    </button>
                  </div>
                  {renderHomeShortsStrip(0)}
                </>
              ) : (
                <>
                  {posts.map((post, idx) => {
                    const showShortsAfter =
                      (idx === 1 && posts.length >= 2) ||
                      (idx > 2 && (idx - 1) % 4 === 0) ||
                      (posts.length === 1 && idx === 0);

                    return (
                      <React.Fragment key={post.id}>
                        <PostCard
                          post={post}
                          currentUser={currentUser}
                          onReact={handleReact}
                          onOpenComments={(id, ytId) =>
                            setCommentsDrawerState({
                              isOpen: true,
                              postId: id,
                              youtubeVideoId: ytId,
                              title: post.content.substring(0, 40),
                            })
                          }
                          onToggleSave={handleToggleSave}
                          onSharePost={handleSharePost}
                          onDeletePost={handleDeletePost}
                        />
                        {showShortsAfter && renderHomeShortsStrip(idx)}
                      </React.Fragment>
                    );
                  })}

                  {/* Infinite Scroll Sentinel */}
                  <div ref={homeSentinelRef} className="text-center py-6">
                    {isLoadingMorePosts ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl ml-glass text-xs text-[var(--accent-primary)] font-semibold">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading more posts...</span>
                      </div>
                    ) : hasMorePosts ? (
                      <button
                        type="button"
                        onClick={loadMorePosts}
                        className="min-h-[42px] px-5 py-2 rounded-xl ml-glass hover:bg-[var(--bg-surface-alt)] text-xs text-[var(--text-primary)] font-semibold transition-colors inline-flex items-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Load more posts</span>
                      </button>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">You're all caught up</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Clean Right Desktop Sidebar */}
            <div className="hidden lg:block lg:col-span-4 space-y-4">
              <div className="ml-glass rounded-2xl p-4 space-y-2.5">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                  Shortcuts
                </h3>

                <button
                  type="button"
                  onClick={() => {
                    if (requireSignedIn()) {
                      setVideoPublishState({ isOpen: true, initialDestination: 'select' });
                    }
                  }}
                  className="w-full p-2.5 rounded-xl bg-[var(--accent-gold-soft)] hover:opacity-90 border border-[var(--accent-gold-border)] text-left flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Film className="w-4 h-4 text-[var(--accent-gold)]" />
                    <div>
                      <span className="font-bold text-xs text-[var(--text-primary)] block">
                        Publish Video
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        MOTHERLAND or YouTube
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveNav('video')}
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-surface-alt)] hover:opacity-90 border border-[var(--border-subtle)] text-left flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <PlaySquare className="w-4 h-4 text-[var(--accent-primary)]" />
                    <div>
                      <span className="font-bold text-xs text-[var(--text-primary)] block">
                        Video Theater
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        Live streams &amp; long-form watch
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsSocialAppsOpen(true)}
                  data-testid="sidebar-marketplace-btn"
                  className="w-full p-2.5 rounded-xl bg-[var(--bg-surface-alt)] hover:opacity-90 border border-[var(--border-subtle)] text-left flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Compass className="w-4 h-4 text-[var(--accent-primary)]" />
                    <div>
                      <span className="font-bold text-xs text-[var(--text-primary)] block">
                        Marketplace · Social Apps
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        YouTube, Facebook, TikTok, Instagram
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveNav('youtube')}
                  className="w-full p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-left flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Youtube className="w-4 h-4 text-[#FF0000]" />
                    <div>
                      <span className="font-bold text-xs text-[var(--text-primary)] block">
                        MOTHERLAND YouTube
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        Full YouTube, Shorts &amp; Studio
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>

              {/* Explore Topics */}
              <div className="ml-glass rounded-2xl p-4 space-y-2.5">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Explore Topics</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveNav('video')}
                  className="w-full p-2.5 rounded-xl hover:bg-[var(--bg-surface-alt)] text-left transition-colors"
                >
                  <span className="text-[10px] text-[var(--accent-primary)] font-bold block">
                    #Creators
                  </span>
                  <span className="text-xs text-[var(--text-primary)] font-semibold block">
                    Community Films &amp; Shorts
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNav('video')}
                  className="w-full p-2.5 rounded-xl hover:bg-[var(--bg-surface-alt)] text-left transition-colors"
                >
                  <span className="text-[10px] text-[var(--accent-gold)] font-bold block">
                    #Travel4K
                  </span>
                  <span className="text-xs text-[var(--text-primary)] font-semibold block">
                    Nature &amp; Travel Documentaries
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!requireSignedIn()) return;
                    setFeedFilter('saved');
                    loadPosts('saved', true);
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-[var(--bg-surface-alt)] text-left transition-colors flex items-center gap-2"
                >
                  <Bookmark className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                  <span className="text-xs text-[var(--text-primary)] font-semibold">
                    View Saved Posts
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: FRIENDS & SOCIAL GRAPH                             */}
        {/* ========================================================= */}
        {activeNav === 'friends' && (
          <FriendsView
            currentUser={currentUser}
            onRefreshUser={bootstrapApp}
            onOpenChatWithUser={(userId) => {
              if (!requireSignedIn()) return;
              setChatTargetUserId(userId);
              setIsMessagesOpen(true);
            }}
            onCallUser={async (userId, callType) => {
              if (!requireSignedIn()) return;
              try {
                const res = await api.createDirectConversation(userId);
                if (res.conversation) {
                  startCall(res.conversation, callType);
                }
              } catch (err) {
                console.error('Direct call error:', err);
              }
            }}
            onOpenAuth={() => setIsAuthOpen(true)}
            refreshSignal={friendsRefreshSignal}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 3: VIDEO (Persists exact state when hidden/Shorts!)   */}
        {/* ========================================================= */}
        <div className={activeNav === 'video' ? '' : 'hidden'}>
          <VideoSection
            currentUser={currentUser}
            isVisible={activeNav === 'video'}
            initialShorts={shorts}
            initialLongVideos={longVideos}
            youtubeConnected={Boolean(youtubeStatus.configured && youtubeStatus.valid)}
            watchingVideo={activeWatchVideo}
            isWatchMinimized={isWatchMinimized}
            onWatchVideo={(video) => {
              setActiveWatchVideo(video);
              setIsWatchMinimized(false);
            }}
            onMinimizeWatch={() => setIsWatchMinimized(true)}
            onStageAnchorChange={setWatchAnchorElement}
            onOpenComments={({ postId, youtubeVideoId, title }) =>
              setCommentsDrawerState({ isOpen: true, postId, youtubeVideoId, title })
            }
            onOpenPlatformHub={() => setIsPlatformHubOpen(true)}
            onOpenShortsPlayer={(list, idx) => openShortsPlayer(list, idx)}
            onOpenUploadVideo={() => {
              if (requireSignedIn()) {
                setVideoPublishState({ isOpen: true, initialDestination: 'select' });
              }
            }}
            refreshSignal={videoRefreshSignal}
          />
        </div>

        {/* ========================================================= */}
        {/* TAB 4: MENU HUB                                           */}
        {/* ========================================================= */}
        {activeNav === 'menu' && (
          <MenuView
            currentUser={currentUser}
            theme={theme}
            onToggleTheme={toggleTheme}
            unreadNotifications={unreadNotificationsCount}
            unreadMessages={unreadMessagesCount}
            youtubeKeyConnected={Boolean(youtubeStatus.configured && youtubeStatus.valid)}
            onOpenProfile={() => setActiveNav('profile')}
            onOpenFriends={() => setActiveNav('friends')}
            onOpenSavedPosts={() => {
              if (!requireSignedIn()) return;
              setFeedFilter('saved');
              loadPosts('saved', true);
              setActiveNav('home');
            }}
            onOpenNotifications={() => {
              if (requireSignedIn()) setIsNotificationsOpen(true);
            }}
            onOpenMessages={() => {
              if (requireSignedIn()) setIsMessagesOpen(true);
            }}
            onOpenYouTubePublish={() => {
              if (requireSignedIn()) {
                setVideoPublishState({ isOpen: true, initialDestination: 'youtube' });
              }
            }}
            onOpenSocialApps={() => setIsSocialAppsOpen(true)}
            onOpenPlatformHub={() => setIsPlatformHubOpen(true)}
            onOpenAuth={() => setIsAuthOpen(true)}
            onLogout={handleLogout}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 5: PROFILE                                            */}
        {/* ========================================================= */}
        {activeNav === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            userPosts={posts}
            userShorts={shorts}
            userLongVideos={longVideos}
            onProfileUpdated={(updated) => setCurrentUser(updated)}
            onOpenPlatformHub={() => setIsPlatformHubOpen(true)}
            onOpenComments={(id, ytId) =>
              setCommentsDrawerState({ isOpen: true, postId: id, youtubeVideoId: ytId })
            }
            onReact={handleReact}
            onToggleSave={handleToggleSave}
            onSharePost={handleSharePost}
            onDeletePost={handleDeletePost}
            onOpenAuthModal={() => setIsAuthOpen(true)}
            onLogout={handleLogout}
            onAccountDeleted={handleAccountDeleted}
            onSwitchAccount={handleSwitchAccount}
          />
        )}
        {/* ========================================================= */}
        {/* TAB 6: MOTHERLAND YOUTUBE FULL EXPERIENCE                 */}
        {/* ========================================================= */}
        {activeNav === 'youtube' && (
          <YouTubeFullExperience
            onBackToMotherland={() => setActiveNav('home')}
            refreshSignal={ytRefreshSignal}
          />
        )}
      </main>

      {/* Persistent Zero-Restart Watch Player + Floating Docked Mini-Player */}
      <PersistentWatchPlayer
        video={activeWatchVideo}
        isMinimized={isWatchMinimized}
        isFullWatchVisible={activeNav === 'video' && !isWatchMinimized}
        isPausedByOverlay={shortsPlayerState.isOpen || activeNav === 'youtube'}
        anchorElement={watchAnchorElement}
        onMinimize={() => setIsWatchMinimized(true)}
        onExpand={() => {
          setActiveNav('video');
          setIsWatchMinimized(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onClose={() => {
          setActiveWatchVideo(null);
          setIsWatchMinimized(false);
        }}
      />

      {/* 2. Bottom Navigation */}
      {activeNav !== 'youtube' && (
        <BottomNav
          activeTab={shortsPlayerState.isOpen ? 'shorts' : activeNav}
          onTabChange={(tab) => {
            if (tab === 'shorts') {
              const latestUnsuppressed = filterUnsuppressed(shorts);
              if (latestUnsuppressed.length > 0) {
                openShortsPlayer(latestUnsuppressed, 0);
              }
              api
                .getShorts()
                .then((res) => {
                  const fresh = filterUnsuppressed(res.shorts || []);
                  if (fresh.length > 0) {
                    setShorts(fresh);
                    setShortsPlayerState((prev) =>
                      prev.isOpen && prev.list.length > 0
                        ? prev
                        : { isOpen: true, list: fresh, initialIndex: 0 }
                    );
                  }
                })
                .catch(() => {});
              return;
            }
            if (tab === 'video' && activeNav === 'video' && activeWatchVideo && !isWatchMinimized) {
              setIsWatchMinimized(true);
              return;
            }
            setActiveNav(tab);
            if (tab === 'home') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              loadPosts(feedFilter, true);
              api.getStories().then((s) => setStories(s.stories || [])).catch(() => {});
              api.getShorts().then((s) => setShorts(filterUnsuppressed(s.shorts || []))).catch(() => {});
            } else if (tab === 'friends') {
              setFriendsRefreshSignal((s) => s + 1);
            } else if (tab === 'video') {
              setVideoRefreshSignal((s) => s + 1);
            } else if (tab === 'menu') {
              refreshNotifications();
              refreshUnreadMessages();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          onOpenCreate={() => {
            if (requireSignedIn()) {
              setCreateModalState({ isOpen: true, initialMode: 'menu' });
            }
          }}
          unreadFriendsCount={
            currentUser ? notifications.filter((n) => n.type === 'friend_request' && !n.isRead).length : 0
          }
        />
      )}

      {/* 3. Create Hub Modal */}
      {currentUser && (
        <CreateModal
          isOpen={createModalState.isOpen}
          onClose={() => setCreateModalState((prev) => ({ ...prev, isOpen: false }))}
          currentUser={currentUser}
          initialMode={createModalState.initialMode}
          onOpenVideoPublish={() => {
            setCreateModalState({ isOpen: false, initialMode: 'menu' });
            setVideoPublishState({ isOpen: true, initialDestination: 'select' });
          }}
          onPostCreated={() => loadPosts(feedFilter, true)}
          onStoryCreated={() =>
            api.getStories().then((res) => setStories(res.stories || []))
          }
          onShortCreated={() =>
            api.getShorts().then((res) => setShorts(res.shorts || []))
          }
        />
      )}

      {/* 4. Dual Video Publishing Modal */}
      {currentUser && (
        <VideoPublishFlow
          isOpen={videoPublishState.isOpen}
          onClose={() => setVideoPublishState((prev) => ({ ...prev, isOpen: false }))}
          currentUser={currentUser}
          initialDestination={videoPublishState.initialDestination}
          onMotherlandVideoCreated={() => {
            api.getLongVideos().then((res) => setLongVideos(res.videos || []));
            loadPosts(feedFilter, true);
          }}
          onMotherlandPostCreated={() => loadPosts(feedFilter, true)}
          onYouTubeConnectionChanged={bootstrapApp}
        />
      )}

      {/* 5. Shared Full-Screen Shorts Player Modal */}
      <ShortsPlayerModal
        isOpen={shortsPlayerState.isOpen}
        shorts={shortsPlayerState.list}
        initialIndex={shortsPlayerState.initialIndex}
        onClose={closeShortsPlayer}
        onLoadMore={handleLoadMoreShorts}
        isLoadingMore={isLoadingMoreShorts}
        hasMoreShorts={shortsHasMore}
        exhaustedNotice={shortsExhaustedNotice}
        onOpenComments={({ postId, youtubeVideoId, title }) =>
          setCommentsDrawerState({ isOpen: true, postId, youtubeVideoId, title })
        }
      />

      {/* 6. Comments Drawer */}
      <CommentsDrawer
        isOpen={commentsDrawerState.isOpen}
        onClose={() => setCommentsDrawerState({ isOpen: false })}
        postId={commentsDrawerState.postId}
        youtubeVideoId={commentsDrawerState.youtubeVideoId}
        title={commentsDrawerState.title}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* 7. Messenger Drawer */}
      <MessagesDrawer
        isOpen={isMessagesOpen}
        onClose={() => setIsMessagesOpen(false)}
        currentUser={currentUser}
        targetUserId={chatTargetUserId}
        onClearTargetUser={() => setChatTargetUserId(null)}
        onUnreadCountChange={(totalUnread) => setUnreadMessagesCount(totalUnread)}
        realtimeSignal={messagesRealtimeSignal}
        incomingRealtimeMessage={incomingRealtimeMessage}
        onlineUsersMap={onlineUsersMap}
        typingMap={typingMap}
        onOpenAuth={() => setIsAuthOpen(true)}
        sendWsEvent={sendWsEvent}
        onStartCall={startCall}
      />

      {/* 8. Notifications Drawer */}
      <NotificationsDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onRefreshNotifications={refreshNotifications}
      />

      {/* 9. Platform Integrations & API Hub Modal */}
      <PlatformHubModal
        isOpen={isPlatformHubOpen}
        onClose={() => setIsPlatformHubOpen(false)}
        adapters={adapters}
        youtubeStatus={youtubeStatus}
        onKeyUpdated={bootstrapApp}
      />

      {/* 10. Authentication & Account Switcher Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* 11. Marketplace · Social Apps */}
      <SocialAppsHub
        isOpen={isSocialAppsOpen}
        onClose={() => setIsSocialAppsOpen(false)}
      />

      {/* 12. Real-Time WebRTC Audio / Video Call Overlay */}
      <CallOverlay
        call={activeCall}
        localStream={localStream}
        remoteStream={remoteStream}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
        onEnd={endCall}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onSwitchCamera={switchCamera}
        onSwitchToAudioOnly={switchToAudioOnly}
      />
    </div>
  );
}
