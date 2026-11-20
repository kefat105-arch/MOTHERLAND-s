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
  Users,
  UserPlus,
  UserCheck,
  X,
  AlertCircle,
  WifiOff,
} from 'lucide-react';
import {
  useOfflineConnectivity,
  useOfflineVaultState,
  getOfflinePosts,
  getOfflineShorts,
  getOfflineLongVideos,
  getOfflineStories,
} from './services/offlineVideoEngine';
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
  FriendRequest,
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
import { PullToRefresh } from './components/common/PullToRefresh';
import { SearchModal } from './components/SearchModal';
import { WatchHistoryModal } from './components/WatchHistoryModal';
import { CreatorProfileModal, CreatorProfileTarget } from './components/CreatorProfileModal';
import { MotherlandLiveView } from './components/live/MotherlandLiveView';
import { ServerManagementModal } from './components/ServerManagementModal';
import { GamesHubView } from './components/games/GamesHubView';
import { BmGamesIcon } from './components/games/BmGamesIcon';
import { useWebRTC } from './hooks/useWebRTC';
import {
  useBackHandler,
  subscribeEdgeSwipeProgress,
} from './hooks/useBackNavigation';
import { useRealtime, RealtimeEvent } from './hooks/useRealtime';
import {
  filterUnsuppressed,
  recordShownFeedIds,
  setWatchSuppressionUserId,
  WATCH_SUPPRESSED_EVENT,
} from './services/watchSuppression';
import { parseGoogleOAuthHashRedirect } from './services/youtubeAuthService';
import { setTranslationPrefs } from './services/translationService';
import { TranslatableText } from './components/common/ExpandableTranslatableText';
import { playNotificationChime, playMessageChime } from './utils/motherlandSoundEngine';
import { parseMotherlandDeepLink } from './utils/videoShareLinks';
import { isInlineVideoActive, getActiveInlineVideoIds } from './utils/youtubePlayerBridge';

const LEGACY_FEED_CACHE_KEY = 'motherland_instant_cache_v1';
const LAST_USER_HINT_KEY = 'motherland_last_user_hint';

function isEligibleShortVideo(short: ShortVideo): boolean {
  if (typeof short.durationSeconds === 'number') {
    return short.durationSeconds > 0 && short.durationSeconds <= 180;
  }
  return short.source !== 'youtube';
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

  // Core Data (user session restored optimistically from durable local profile, feeds fetched fresh)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => api.getCachedUser());
  const [authToken, setAuthToken] = useState<string>(() => api.getToken() || '');
  const { isOnline, isOfflineModeActive } = useOfflineConnectivity();
  const offlineVault = useOfflineVaultState();
  const wasOfflineRef = useRef<boolean>(!isOnline);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [shortsPage, setShortsPage] = useState(1);
  const [shortsNextPageToken, setShortsNextPageToken] = useState<string | null>(null);
  const [shortsHasMore, setShortsHasMore] = useState(true);
  const [shortsExhaustedNotice, setShortsExhaustedNotice] = useState('');
  const [isLoadingMoreShorts, setIsLoadingMoreShorts] = useState(false);

  const [longVideos, setLongVideos] = useState<LongVideo[]>([]);
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
  const spyEventListenersRef = useRef<Set<(evt: RealtimeEvent) => void>>(new Set());
  const subscribeSpyEvents = useCallback((listener: (evt: RealtimeEvent) => void) => {
    spyEventListenersRef.current.add(listener);
    return () => {
      spyEventListenersRef.current.delete(listener);
    };
  }, []);

  // Loading States (Never block initial render with a slow splash wall)
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isFetchingInitialPosts, setIsFetchingInitialPosts] = useState(true);
  const [isLoadingHomePosts, setIsLoadingHomePosts] = useState(false);
  const [isLoadingHomeShorts, setIsLoadingHomeShorts] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [homeFeedPage, setHomeFeedPage] = useState(1);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [homeFeedError, setHomeFeedError] = useState('');
  const [homeShortsError, setHomeShortsError] = useState('');
  const [peopleDiscovery, setPeopleDiscovery] = useState<{
    suggested: UserProfile[];
    pendingRequests: FriendRequest[];
    loaded: boolean;
  }>({ suggested: [], pendingRequests: [], loaded: false });
  const [sentRequestIds, setSentRequestIds] = useState<Record<string, boolean>>({});
  const [expiredSessionHint, setExpiredSessionHint] = useState<{
    displayName?: string;
    username?: string;
    avatar?: string;
  } | null>(null);
  const lastAutoRefreshRef = useRef<number>(Date.now());
  const homeSentinelRef = useRef<HTMLDivElement | null>(null);
  const homeYtCursorRef = useRef<string>('');
  const homePostsAbortRef = useRef<AbortController | null>(null);
  const homeMorePostsAbortRef = useRef<AbortController | null>(null);
  const homePostsReqSeqRef = useRef<number>(0);
  const shortsAbortRef = useRef<AbortController | null>(null);
  const shortsMoreAbortRef = useRef<AbortController | null>(null);
  const shortsReqSeqRef = useRef<number>(0);
  const longVideosAbortRef = useRef<AbortController | null>(null);
  const longVideosReqSeqRef = useRef<number>(0);
  const isLoadingMorePostsRef = useRef<boolean>(false);
  const isLoadingMoreShortsRef = useRef<boolean>(false);
  const sessionExpiredPromptedRef = useRef(false);
  const savedScrollRef = useRef<number>(0);
  const savedHomeScrollRef = useRef<number>(0);
  const activeNavRef = useRef<NavTab>(activeNav);
  activeNavRef.current = activeNav;
  const feedFilterRef = useRef<'all' | 'for_you' | 'motherland' | 'saved'>(feedFilter);
  feedFilterRef.current = feedFilter;
  const postsRef = useRef<Post[]>(posts);
  postsRef.current = posts;
  const shortsRef = useRef<ShortVideo[]>(shorts);
  shortsRef.current = shorts;
  const longVideosRef = useRef<LongVideo[]>(longVideos);
  longVideosRef.current = longVideos;
  const homeFeedPageRef = useRef<number>(homeFeedPage);
  homeFeedPageRef.current = homeFeedPage;
  const hasMorePostsRef = useRef<boolean>(hasMorePosts);
  hasMorePostsRef.current = hasMorePosts;
  const homeFeedCacheRef = useRef<
    Record<
      'all' | 'for_you' | 'motherland' | 'saved',
      { posts: Post[]; page: number; hasMore: boolean; ytCursor: string; loadedOnce: boolean }
    >
  >({
    all: { posts: [], page: 1, hasMore: true, ytCursor: '', loadedOnce: false },
    for_you: { posts: [], page: 1, hasMore: true, ytCursor: '', loadedOnce: false },
    motherland: { posts: [], page: 1, hasMore: true, ytCursor: '', loadedOnce: false },
    saved: { posts: [], page: 1, hasMore: false, ytCursor: '', loadedOnce: false },
  });

  // Persistent Long-Form Watch Player State
  const [activeWatchVideo, setActiveWatchVideo] = useState<LongVideo | null>(null);
  const [upNextWatchVideo, setUpNextWatchVideo] = useState<LongVideo | null>(null);
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isWatchHistoryOpen, setIsWatchHistoryOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [creatorTarget, setCreatorTarget] = useState<CreatorProfileTarget | null>(null);
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

  // Track Home scroll position continuously while Home is visible & not in full-screen player
  useEffect(() => {
    if (activeNav !== 'home' || shortsPlayerState.isOpen) return;
    const onScroll = () => {
      savedHomeScrollRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeNav, shortsPlayerState.isOpen]);

  const navigateToHomeRef = useRef<
    (options?: { scrollMode?: 'restore' | 'top'; forceRefresh?: boolean }) => void
  >(() => {});

  // Sub-tab back navigation (Friends / Video / Menu / Profile / YouTube -> Home)
  useBackHandler(
    'app-youtube-tab',
    activeNav === 'youtube',
    () => navigateToHomeRef.current({ scrollMode: 'restore' }),
    12
  );
  useBackHandler(
    'app-sub-tab',
    activeNav !== 'home' && activeNav !== 'youtube',
    () => navigateToHomeRef.current({ scrollMode: 'restore' }),
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
      } else if (typeof evt.type === 'string' && (evt.type.startsWith('spy:') || evt.type.startsWith('world:'))) {
        spyEventListenersRef.current.forEach((cb) => cb(evt));
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

  // Deep-link resolver for MOTHERLAND-native shared URLs (/video/:id, /shorts/:id, /post/:id)
  const resolveAndOpenDeepLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const parsed = parseMotherlandDeepLink(window.location.pathname, window.location.search);
    if (!parsed) return;
    try {
      const resolved = await api.resolveSharedLink(parsed.id, parsed.kind);
      if (!resolved.found) return;
      if (resolved.kind === 'short' && resolved.short) {
        const targetShort = resolved.short;
        setShortsPlayerState((prev) => {
          const others = prev.list.filter(
            (s) => s.id !== targetShort.id && (!targetShort.youtubeId || s.youtubeId !== targetShort.youtubeId)
          );
          return {
            isOpen: true,
            list: [targetShort, ...others],
            initialIndex: 0,
          };
        });
      } else if (resolved.kind === 'long' && resolved.video) {
        setActiveWatchVideo(resolved.video);
        setIsWatchMinimized(false);
        setActiveNav('video');
      } else if (resolved.kind === 'post' && resolved.post) {
        const sharedPost = resolved.post;
        setPosts((prev) => {
          const rest = prev.filter((p) => p.id !== sharedPost.id);
          return [sharedPost, ...rest];
        });
        setActiveNav('home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      // Ignore invalid deep link silently
    }
  }, []);

  // Initial Data Bootstrap (runs in parallel with OAuth hash completion, zero startup splash block)
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_FEED_CACHE_KEY);
    } catch {
      // ignore
    }
    parseGoogleOAuthHashRedirect()
      .then((gAuth) => {
        if (gAuth) {
          bootstrapApp();
        }
      })
      .catch(() => {});
    bootstrapApp();
    void resolveAndOpenDeepLink();

    const onPopState = () => {
      void resolveAndOpenDeepLink();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [resolveAndOpenDeepLink]);

  useEffect(() => {
    setWatchSuppressionUserId(currentUser?.id || null);
  }, [currentUser?.id]);

  // Live permanent watched suppression pruning across feeds while protecting any currently playing video
  useEffect(() => {
    const onSuppressed = () => {
      setPosts((prev) => {
        const next = prev.filter(
          (p) => isInlineVideoActive(p.id, p.externalId) || filterUnsuppressed([p], true).length > 0
        );
        homeFeedCacheRef.current[feedFilterRef.current] = {
          ...homeFeedCacheRef.current[feedFilterRef.current],
          posts: next,
        };
        return next;
      });
      setShorts((prev) =>
        shortsPlayerState.isOpen ? prev : filterUnsuppressed(prev).filter(isEligibleShortVideo)
      );
      setLongVideos((prev) =>
        prev.filter(
          (v) =>
            (activeWatchVideo &&
              (v.id === activeWatchVideo.id ||
                (v.youtubeId && v.youtubeId === activeWatchVideo.youtubeId))) ||
            filterUnsuppressed([v]).length > 0
        )
      );
    };
    window.addEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
    return () => window.removeEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
  }, [shortsPlayerState.isOpen, activeWatchVideo]);

  const refreshPeopleDiscovery = useCallback(async (userOverride?: UserProfile | null) => {
    const activeUser = userOverride !== undefined ? userOverride : currentUserRef.current;
    try {
      if (activeUser || api.getToken()) {
        const fr = await api.getFriendsData().catch(() => null);
        if (fr) {
          setPeopleDiscovery({
            suggested: fr.suggested || [],
            pendingRequests: fr.pendingRequests || [],
            loaded: true,
          });
          return;
        }
      }
      const res = await api.searchUsers('').catch(() => ({ users: [] }));
      setPeopleDiscovery({
        suggested: (res.users || []).filter((u) => u.id !== activeUser?.id),
        pendingRequests: [],
        loaded: true,
      });
    } catch {
      setPeopleDiscovery((prev) => ({ ...prev, loaded: true }));
    }
  }, []);

  const refreshCurrentUserCounts = useCallback(async () => {
    try {
      const res = await api.getCurrentUser();
      if (res.user) setCurrentUser(res.user);
    } catch {
      // ignore
    }
  }, []);

  const dedupeHomePosts = (rawList: Post[]): Post[] => {
    const filtered = filterUnsuppressed(rawList || [], true);
    const seen = new Set<string>();
    const deduped: Post[] = [];
    for (const p of filtered) {
      const extKey = p.externalId || p.id;
      if (!seen.has(p.id) && !seen.has(extKey)) {
        seen.add(p.id);
        seen.add(extKey);
        deduped.push(p);
      }
    }
    return deduped;
  };

  const commitHomeFeedResult = (
    targetFilter: 'all' | 'for_you' | 'motherland' | 'saved',
    nextPosts: Post[],
    nextHasMore: boolean,
    nextYtCursor: string,
    options?: { allowEmpty?: boolean; preserveExisting?: boolean; errorMsg?: string }
  ) => {
    const cached = homeFeedCacheRef.current[targetFilter];
    const currentVisible = feedFilterRef.current === targetFilter ? postsRef.current : cached.posts;
    const preserveExisting = options?.preserveExisting !== false;

    if (nextPosts.length > 0) {
      // Protect any inline video post currently playing/paused by the user so refresh never kills playback
      const activeIds = getActiveInlineVideoIds();
      let finalPosts = nextPosts;
      if (activeIds.size > 0 && currentVisible.length > 0) {
        const activeVisible = currentVisible.filter((p) =>
          isInlineVideoActive(p.id, p.externalId)
        );
        if (activeVisible.length > 0) {
          const nextKeySet = new Set<string>();
          nextPosts.forEach((p) => {
            nextKeySet.add(p.id);
            if (p.externalId) nextKeySet.add(p.externalId);
          });
          const missingActive = activeVisible.filter(
            (p) => !nextKeySet.has(p.id) && (!p.externalId || !nextKeySet.has(p.externalId))
          );
          if (missingActive.length > 0) {
            finalPosts = [...missingActive, ...nextPosts];
          }
        }
      }

      homeFeedCacheRef.current[targetFilter] = {
        posts: finalPosts,
        page: 1,
        hasMore: nextHasMore,
        ytCursor: nextYtCursor,
        loadedOnce: true,
      };
      recordShownFeedIds('home', finalPosts.map((p) => p.externalId || p.id));
      if (feedFilterRef.current === targetFilter) {
        homeYtCursorRef.current = nextYtCursor;
        setPosts(finalPosts);
        setHomeFeedPage(1);
        setHasMorePosts(nextHasMore);
        setHomeFeedError('');
      }
      return;
    }

    // Empty result returned — determine whether this is a genuine empty collection or a failure/starvation
    const canCommitEmpty =
      Boolean(options?.allowEmpty) &&
      !options?.errorMsg &&
      (targetFilter === 'saved' || targetFilter === 'motherland');

    if (canCommitEmpty) {
      homeFeedCacheRef.current[targetFilter] = {
        posts: [],
        page: 1,
        hasMore: false,
        ytCursor: '',
        loadedOnce: true,
      };
      if (feedFilterRef.current === targetFilter) {
        homeYtCursorRef.current = '';
        setPosts([]);
        setHomeFeedPage(1);
        setHasMorePosts(false);
        setHomeFeedError('');
      }
      return;
    }

    if (preserveExisting && currentVisible.length > 0) {
      // Never wipe valid existing posts when refresh fails or temporarily returns 0 items
      homeFeedCacheRef.current[targetFilter] = {
        ...cached,
        posts: currentVisible,
        loadedOnce: true,
      };
      if (feedFilterRef.current === targetFilter && !cached.loadedOnce) {
        setPosts(currentVisible);
      }
      return;
    }

    homeFeedCacheRef.current[targetFilter] = {
      ...cached,
      posts: [],
      page: 1,
      hasMore: false,
      ytCursor: '',
      loadedOnce: true,
    };
    if (feedFilterRef.current === targetFilter) {
      setPosts([]);
      setHomeFeedPage(1);
      setHasMorePosts(false);
      if (options?.errorMsg) {
        setHomeFeedError(options.errorMsg);
      }
    }
  };

  const commitShortsResult = (
    rawShorts: ShortVideo[] | null,
    nextPageToken: string | null,
    hasMoreVal: boolean,
    options?: { preserveExisting?: boolean; errorMsg?: string }
  ) => {
    const preserveExisting = options?.preserveExisting !== false;
    if (Array.isArray(rawShorts)) {
      const fresh = filterUnsuppressed(rawShorts).filter(isEligibleShortVideo);
      if (fresh.length > 0) {
        setShorts(fresh);
        setShortsPage(1);
        setShortsNextPageToken(nextPageToken || null);
        setShortsHasMore(hasMoreVal);
        setShortsExhaustedNotice('');
        setHomeShortsError('');
        recordShownFeedIds('shorts', fresh.map((s) => s.youtubeId || s.id));
        return;
      }
    }
    // Never overwrite valid existing Small Videos with an empty array on failure/starvation
    if (preserveExisting && shortsRef.current.length > 0) {
      return;
    }
    if (options?.errorMsg && shortsRef.current.length === 0) {
      setHomeShortsError(options.errorMsg);
    }
  };

  const refreshHomeShorts = async (options?: { forceLoading?: boolean; preserveExisting?: boolean }) => {
    const reqSeq = ++shortsReqSeqRef.current;
    shortsAbortRef.current?.abort();
    shortsMoreAbortRef.current?.abort();
    isLoadingMoreShortsRef.current = false;
    const controller = new AbortController();
    shortsAbortRef.current = controller;

    if (options?.forceLoading || shortsRef.current.length === 0) {
      setIsLoadingHomeShorts(true);
    }
    setHomeShortsError('');

    try {
      const res = await api.getShorts(false, 1, 12, '', controller.signal);
      if (reqSeq !== shortsReqSeqRef.current || controller.signal.aborted) return;
      commitShortsResult(
        res.shorts || [],
        res.nextPageToken || null,
        res.hasMore !== false,
        {
          preserveExisting: options?.preserveExisting !== false,
          errorMsg: res.exhaustedReason || '',
        }
      );
    } catch (err: any) {
      if (err?.name === 'AbortError' || reqSeq !== shortsReqSeqRef.current) return;
      if (shortsRef.current.length === 0) {
        setHomeShortsError(err?.message || 'Unable to load Small Videos');
      }
    } finally {
      if (reqSeq === shortsReqSeqRef.current) {
        setIsLoadingHomeShorts(false);
      }
    }
  };

  const bootstrapApp = async (options?: { preserveExisting?: boolean }) => {
    const preserveExisting = options?.preserveExisting !== false;
    const activeFilterAtStart = feedFilterRef.current;
    const postsSeq = ++homePostsReqSeqRef.current;
    const shortsSeq = ++shortsReqSeqRef.current;
    const longSeq = ++longVideosReqSeqRef.current;

    homePostsAbortRef.current?.abort();
    homeMorePostsAbortRef.current?.abort();
    shortsAbortRef.current?.abort();
    shortsMoreAbortRef.current?.abort();
    longVideosAbortRef.current?.abort();
    isLoadingMorePostsRef.current = false;
    isLoadingMoreShortsRef.current = false;
    setIsLoadingMorePosts(false);
    setIsLoadingMoreShorts(false);

    const postsController = new AbortController();
    const shortsController = new AbortController();
    const longController = new AbortController();
    homePostsAbortRef.current = postsController;
    shortsAbortRef.current = shortsController;
    longVideosAbortRef.current = longController;

    if (postsRef.current.length === 0) {
      setIsLoadingHomePosts(true);
    }
    if (shortsRef.current.length === 0) {
      setIsLoadingHomeShorts(true);
    }

    try {
      setAuthToken(api.getToken() || '');
      if (postsRef.current.length === 0) {
        setHomeFeedError('');
      }
      const userData = await api.getCurrentUser().catch(() => ({
        user: api.getCachedUser(),
        sessionExpired: false,
        transientError: true,
      }));
      let resolvedUser = userData.user || null;

      if (!resolvedUser && userData.transientError) {
        // Never log out on temporary network/server error: keep cached user logged in
        resolvedUser = api.getCachedUser() || currentUserRef.current || null;
      }

      setWatchSuppressionUserId(resolvedUser?.id || null);
      setAuthToken(api.getToken() || '');

      if (resolvedUser) {
        if (resolvedUser.translationPrefs) {
          setTranslationPrefs(resolvedUser.translationPrefs);
        }
        sessionExpiredPromptedRef.current = false;
        setExpiredSessionHint(null);
        try {
          localStorage.setItem(
            LAST_USER_HINT_KEY,
            JSON.stringify({
              displayName: resolvedUser.displayName,
              username: resolvedUser.username,
              avatar: resolvedUser.avatar,
            })
          );
        } catch {
          // ignore
        }
      } else if (userData.sessionExpired && !userData.transientError) {
        api.setToken('');
        api.setRefreshToken('');
        setAuthToken('');
        let hint: { displayName?: string; username?: string; avatar?: string } | null = null;
        try {
          const raw = localStorage.getItem(LAST_USER_HINT_KEY);
          if (raw) hint = JSON.parse(raw);
        } catch {
          hint = null;
        }
        setExpiredSessionHint(hint);
        if (!sessionExpiredPromptedRef.current) {
          sessionExpiredPromptedRef.current = true;
          setIsAuthOpen(true);
        }
      }

      const [
        ytRes,
        adaptRes,
        notifRes,
        storiesRes,
        shortsRes,
        longRes,
        convRes,
        postsRes,
      ] = await Promise.allSettled([
        api.getYouTubeStatus(),
        api.getPlatformAdapters(),
        resolvedUser || api.getToken() ? api.getNotifications() : Promise.resolve({ notifications: [] }),
        api.getStories(postsController.signal),
        api.getShorts(false, 1, 12, '', shortsController.signal),
        api.getLongVideos(false, longController.signal),
        resolvedUser || api.getToken() ? api.getConversations() : Promise.resolve({ totalUnread: 0 }),
        api.getPosts(activeFilterAtStart, 'all', 1, 10, '', postsController.signal),
      ]);

      const ytData = ytRes.status === 'fulfilled' ? ytRes.value : { configured: false };
      const adaptData = adaptRes.status === 'fulfilled' ? adaptRes.value : { adapters: [] };
      const notifData = notifRes.status === 'fulfilled' ? notifRes.value : { notifications: [] };
      const convData = convRes.status === 'fulfilled' ? convRes.value : { totalUnread: 0 };

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
      setUnreadMessagesCount(resolvedUnread);

      if (storiesRes.status === 'fulfilled' && Array.isArray(storiesRes.value?.stories)) {
        if (storiesRes.value.stories.length > 0 || !preserveExisting) {
          setStories(storiesRes.value.stories);
        }
      }

      if (shortsSeq === shortsReqSeqRef.current && !shortsController.signal.aborted) {
        if (shortsRes.status === 'fulfilled') {
          commitShortsResult(
            shortsRes.value.shorts || [],
            shortsRes.value.nextPageToken || null,
            shortsRes.value.hasMore !== false,
            { preserveExisting, errorMsg: shortsRes.value.exhaustedReason || '' }
          );
        } else {
          const reason = (shortsRes.reason as any);
          if (reason?.name !== 'AbortError' && shortsRef.current.length === 0) {
            setHomeShortsError(reason?.message || 'Unable to load Small Videos');
          }
        }
      }

      if (longSeq === longVideosReqSeqRef.current && !longController.signal.aborted) {
        if (longRes.status === 'fulfilled') {
          const nextLongVideos = filterUnsuppressed(longRes.value.videos || []);
          if (nextLongVideos.length > 0 || !preserveExisting || longVideosRef.current.length === 0) {
            setLongVideos(nextLongVideos);
          }
        }
      }

      if (postsSeq === homePostsReqSeqRef.current && !postsController.signal.aborted) {
        if (postsRes.status === 'fulfilled') {
          const pData = postsRes.value;
          const nextPosts = dedupeHomePosts(pData.posts || []);
          const apiErr = (pData as any).errorMessage ? String((pData as any).errorMessage) : '';
          commitHomeFeedResult(
            activeFilterAtStart,
            nextPosts,
            pData.hasMore !== false,
            (pData as any).nextYtCursor || '',
            {
              allowEmpty: !apiErr && !(pData as any).quotaExceeded,
              preserveExisting,
              errorMsg: apiErr,
            }
          );
        } else {
          const reason = postsRes.reason as any;
          if (reason?.name !== 'AbortError') {
            commitHomeFeedResult(activeFilterAtStart, [], true, '', {
              allowEmpty: false,
              preserveExisting,
              errorMsg: reason?.message || 'Unable to load feed',
            });
          }
        }
      }

      lastAutoRefreshRef.current = Date.now();
      void refreshPeopleDiscovery(resolvedUser);
    } catch (err) {
      console.error('Bootstrap error:', err);
    } finally {
      setIsLoadingFeed(false);
      setIsFetchingInitialPosts(false);
      if (postsSeq === homePostsReqSeqRef.current) {
        setIsLoadingHomePosts(false);
      }
      if (shortsSeq === shortsReqSeqRef.current) {
        setIsLoadingHomeShorts(false);
      }
    }
  };

  const loadPosts = async (
    type: 'all' | 'for_you' | 'motherland' | 'saved' = feedFilterRef.current,
    reset = true,
    options?: { preserveExisting?: boolean; silent?: boolean }
  ) => {
    const reqSeq = ++homePostsReqSeqRef.current;
    homePostsAbortRef.current?.abort();
    homeMorePostsAbortRef.current?.abort();
    isLoadingMorePostsRef.current = false;
    setIsLoadingMorePosts(false);

    const controller = new AbortController();
    homePostsAbortRef.current = controller;

    // Immediately sync cached posts when switching filters so valid content appears with zero flicker
    if (reset && feedFilterRef.current === type) {
      const cached = homeFeedCacheRef.current[type];
      if (cached.posts.length > 0 && postsRef.current.length === 0) {
        setPosts(cached.posts);
        setHomeFeedPage(cached.page);
        setHasMorePosts(cached.hasMore);
        homeYtCursorRef.current = cached.ytCursor;
      }
    }

    const hasVisibleForTarget =
      (feedFilterRef.current === type && postsRef.current.length > 0) ||
      homeFeedCacheRef.current[type].posts.length > 0;

    if (!options?.silent || !hasVisibleForTarget) {
      setIsLoadingHomePosts(true);
    }

    try {
      if (reset) {
        if (!hasVisibleForTarget) {
          setHomeFeedError('');
        }
        const data = await api.getPosts(type, 'all', 1, 10, '', controller.signal);
        if (controller.signal.aborted || reqSeq !== homePostsReqSeqRef.current) return;

        const deduped = dedupeHomePosts(data.posts || []);
        const apiErr = (data as any).errorMessage ? String((data as any).errorMessage) : '';
        commitHomeFeedResult(
          type,
          deduped,
          data.hasMore !== false,
          data.nextYtCursor || '',
          {
            allowEmpty: !apiErr && !(data as any).quotaExceeded,
            preserveExisting: options?.preserveExisting !== false,
            errorMsg: apiErr,
          }
        );
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || reqSeq !== homePostsReqSeqRef.current) return;
      console.error('Failed to load posts:', err);
      commitHomeFeedResult(type, [], true, '', {
        allowEmpty: false,
        preserveExisting: options?.preserveExisting !== false,
        errorMsg: err?.message || 'Unable to load posts',
      });
    } finally {
      if (reqSeq === homePostsReqSeqRef.current) {
        setIsLoadingHomePosts(false);
      }
    }
  };

  const handleSelectFeedFilter = (nextFilter: 'all' | 'for_you' | 'motherland' | 'saved') => {
    const prevFilter = feedFilterRef.current;
    if (prevFilter !== nextFilter) {
      // Save current filter's state before switching
      homeFeedCacheRef.current[prevFilter] = {
        ...homeFeedCacheRef.current[prevFilter],
        posts: postsRef.current,
        page: homeFeedPageRef.current,
        hasMore: hasMorePostsRef.current,
        ytCursor: homeYtCursorRef.current,
      };
      setFeedFilter(nextFilter);
      feedFilterRef.current = nextFilter;

      const targetCached = homeFeedCacheRef.current[nextFilter];
      if (targetCached.posts.length > 0) {
        setPosts(targetCached.posts);
        setHomeFeedPage(targetCached.page);
        setHasMorePosts(targetCached.hasMore);
        homeYtCursorRef.current = targetCached.ytCursor;
        setHomeFeedError('');
      } else {
        setPosts([]);
        setHomeFeedPage(1);
        setHasMorePosts(nextFilter !== 'saved');
        homeYtCursorRef.current = '';
        setHomeFeedError('');
      }
    }
    void loadPosts(nextFilter, true, { preserveExisting: true });
  };

  const loadMorePosts = async () => {
    if (isLoadingMorePostsRef.current || isLoadingMorePosts || !hasMorePosts) return;
    const activeType = feedFilterRef.current;
    const capturedResetSeq = homePostsReqSeqRef.current;
    homeMorePostsAbortRef.current?.abort();
    const controller = new AbortController();
    homeMorePostsAbortRef.current = controller;

    isLoadingMorePostsRef.current = true;
    setIsLoadingMorePosts(true);
    setHomeFeedError('');
    try {
      const nextPage = homeFeedPageRef.current + 1;
      const data = await api.getPosts(activeType, 'all', nextPage, 10, homeYtCursorRef.current, controller.signal);
      if (
        controller.signal.aborted ||
        capturedResetSeq !== homePostsReqSeqRef.current ||
        feedFilterRef.current !== activeType
      ) {
        return;
      }

      const nextYtCursor = data.nextYtCursor || '';
      homeYtCursorRef.current = nextYtCursor;
      const nextHasMore = data.hasMore !== false;

      if (data.posts && data.posts.length > 0) {
        const filtered = filterUnsuppressed(data.posts, true);
        recordShownFeedIds('home', filtered.map((p) => p.externalId || p.id));
        setPosts((prev) => {
          const seen = new Set<string>();
          prev.forEach((p) => {
            seen.add(p.id);
            if (p.externalId) seen.add(p.externalId);
          });
          const nextItems: Post[] = [];
          for (const p of filtered) {
            const extKey = p.externalId || p.id;
            if (!seen.has(p.id) && !seen.has(extKey)) {
              seen.add(p.id);
              seen.add(extKey);
              nextItems.push(p);
            }
          }
          const merged = [...prev, ...nextItems];
          homeFeedCacheRef.current[activeType] = {
            posts: merged,
            page: nextPage,
            hasMore: nextHasMore,
            ytCursor: nextYtCursor,
            loadedOnce: true,
          };
          return merged;
        });
        setHomeFeedPage(nextPage);
      }
      setHasMorePosts(nextHasMore);
    } catch (err: any) {
      if (err?.name !== 'AbortError' && capturedResetSeq === homePostsReqSeqRef.current) {
        console.error('Load more posts error:', err);
        setHomeFeedError(err?.message || 'Failed to load more posts');
      }
    } finally {
      isLoadingMorePostsRef.current = false;
      setIsLoadingMorePosts(false);
    }
  };

  // Continuous Cursor-Based Infinite Shorts Loader (Strict <=180s)
  const handleLoadMoreShorts = async () => {
    if (isLoadingMoreShortsRef.current || isLoadingMoreShorts || !shortsHasMore) return;
    const capturedSeq = shortsReqSeqRef.current;
    shortsMoreAbortRef.current?.abort();
    const controller = new AbortController();
    shortsMoreAbortRef.current = controller;

    isLoadingMoreShortsRef.current = true;
    setIsLoadingMoreShorts(true);
    try {
      const nextPage = shortsPage + 1;
      const res = await api.getShorts(false, nextPage, 12, shortsNextPageToken || '', controller.signal);
      if (controller.signal.aborted || capturedSeq !== shortsReqSeqRef.current) return;

      const fetched = filterUnsuppressed(res.shorts || []).filter(isEligibleShortVideo);

      if (fetched.length > 0) {
        recordShownFeedIds('shorts', fetched.map((s) => s.youtubeId || s.id));
        setShorts((prev) => {
          const existingIds = new Set(prev.map((s) => s.youtubeId || s.id));
          const unique = fetched.filter((s) => !existingIds.has(s.youtubeId || s.id));
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
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Load more shorts error:', err);
      }
    } finally {
      isLoadingMoreShortsRef.current = false;
      setIsLoadingMoreShorts(false);
    }
  };

  // Non-destructive Home recovery + navigation helper
  const navigateToHome = useCallback((options?: { scrollMode?: 'restore' | 'top'; forceRefresh?: boolean }) => {
    const wasOnHome = activeNavRef.current === 'home';
    setActiveNav('home');

    if (options?.scrollMode === 'top' || wasOnHome) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedHomeScrollRef.current, behavior: 'auto' });
      });
    }

    const needsPostsRecovery = postsRef.current.length === 0;
    const needsShortsRecovery = shortsRef.current.length === 0;
    const isStale = Date.now() - lastAutoRefreshRef.current > 25000;

    if (options?.forceRefresh || wasOnHome || needsPostsRecovery || isStale) {
      lastAutoRefreshRef.current = Date.now();
      void loadPosts(feedFilterRef.current, true, { preserveExisting: true, silent: !needsPostsRecovery });
    }
    if (options?.forceRefresh || wasOnHome || needsShortsRecovery || isStale) {
      void refreshHomeShorts({ forceLoading: needsShortsRecovery, preserveExisting: true });
    }
    if (options?.forceRefresh || wasOnHome || isStale) {
      api
        .getStories()
        .then((s) => {
          if (Array.isArray(s.stories) && s.stories.length > 0) setStories(s.stories);
        })
        .catch(() => {});
    }
  }, []);
  navigateToHomeRef.current = navigateToHome;

  // Automatic Background Auto-Refresh (on app re-entry / focus + every 90s when not actively watching)
  useEffect(() => {
    const runSilentAutoRefresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (shortsPlayerState.isOpen || (activeWatchVideo && !isWatchMinimized)) return;
      lastAutoRefreshRef.current = Date.now();
      // Skip disturbing Home feed when an inline video is actively playing in Home
      if (getActiveInlineVideoIds().size === 0) {
        void loadPosts(feedFilterRef.current, true, { preserveExisting: true, silent: true });
      }
      api
        .getStories()
        .then((s) => {
          if (Array.isArray(s.stories) && s.stories.length > 0) setStories(s.stories);
        })
        .catch(() => {});
      void refreshHomeShorts({ forceLoading: false, preserveExisting: true });
      if (activeNav === 'video') {
        setVideoRefreshSignal((s) => s + 1);
      } else if (activeNav === 'youtube') {
        setYtRefreshSignal((s) => s + 1);
      } else if (activeNav === 'friends') {
        setFriendsRefreshSignal((s) => s + 1);
      }
    };

    const onFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!currentUserRef.current && (api.getToken() || api.getRefreshToken() || api.getCachedUser())) {
          api
            .getCurrentUser()
            .then((res) => {
              if (res.user) {
                setCurrentUser(res.user);
                setAuthToken(api.getToken() || '');
                if (res.user.translationPrefs) setTranslationPrefs(res.user.translationPrefs);
              }
            })
            .catch(() => {});
        }
        if (Date.now() - lastAutoRefreshRef.current > 15000) {
          runSilentAutoRefresh();
        }
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
  }, [activeNav, shortsPlayerState.isOpen, activeWatchVideo, isWatchMinimized]);

  // Automatically switch feeds to offline playable MP4s when data turns off, and restore online feeds on reconnect
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      void Promise.all([
        getOfflinePosts(),
        getOfflineShorts(),
        getOfflineLongVideos(),
        getOfflineStories(),
      ]).then(([offPosts, offShorts, offLong, offStories]) => {
        if (offPosts.length > 0) setPosts(offPosts);
        if (offShorts.length > 0) setShorts(offShorts);
        if (offLong.length > 0) setLongVideos(offLong);
        if (offStories.length > 0) setStories(offStories);
      });
      return;
    }
    if (wasOfflineRef.current) {
      wasOfflineRef.current = false;
      if (!shortsPlayerState.isOpen && !(activeWatchVideo && !isWatchMinimized) && getActiveInlineVideoIds().size === 0) {
        void bootstrapApp({ preserveExisting: true });
      }
    }
  }, [isOnline, shortsPlayerState.isOpen, activeWatchVideo, isWatchMinimized]);

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
    await bootstrapApp({ preserveExisting: true });
    setIsRefreshing(false);
  };

  // Full-Screen Small Video open/close preserving exact scroll position
  const openShortsPlayer = (list: ShortVideo[], startIndex = 0) => {
    if (!shortsPlayerState.isOpen) {
      savedScrollRef.current = window.scrollY;
    }
    setShortsPlayerState({
      isOpen: true,
      list: list.length > 0 ? list : shorts,
      initialIndex: startIndex,
    });
  };

  const closeShortsPlayer = () => {
    setShortsPlayerState((prev) => ({ ...prev, isOpen: false }));
    if (typeof window !== 'undefined' && /^\/shorts\//.test(window.location.pathname)) {
      window.history.replaceState(null, '', '/');
    }
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
      void refreshCurrentUserCounts();
    } catch (err) {
      console.error('Delete post error:', err);
    }
  };

  const handleEditPost = async (postId: string, content: string, audience?: Post['audience']) => {
    if (!requireSignedIn()) return;
    const res = await api.updatePost(postId, { content, ...(audience ? { audience } : {}) });
    if (res.post) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? res.post : p)));
    }
  };

  const handleReportPost = async (postId: string, reason: string) => {
    if (!requireSignedIn()) return;
    await api.reportPost(postId, { reason });
  };

  const handleBlockUser = async (userId: string) => {
    if (!requireSignedIn()) return;
    await api.toggleBlock(userId);
    setPosts((prev) => prev.filter((p) => p.author.id !== userId));
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
    if (user.translationPrefs) {
      setTranslationPrefs(user.translationPrefs);
    }
    setAuthToken(api.getToken() || '');
    bootstrapApp();
  };

  const clearUserFeedCaches = () => {
    homeFeedCacheRef.current.saved = { posts: [], page: 1, hasMore: false, ytCursor: '', loadedOnce: false };
    homeFeedCacheRef.current.for_you = { ...homeFeedCacheRef.current.for_you, loadedOnce: false };
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      setCurrentUser(null);
      setAuthToken('');
      setNotifications([]);
      setUnreadMessagesCount(0);
      setExpiredSessionHint(null);
      clearUserFeedCaches();
      if (feedFilterRef.current === 'saved') {
        setFeedFilter('all');
        feedFilterRef.current = 'all';
      }
      try {
        localStorage.removeItem(LAST_USER_HINT_KEY);
      } catch {
        // ignore
      }
      await bootstrapApp({ preserveExisting: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleAccountDeleted = async () => {
    setCurrentUser(null);
    setAuthToken('');
    setNotifications([]);
    setUnreadMessagesCount(0);
    setExpiredSessionHint(null);
    clearUserFeedCaches();
    if (feedFilterRef.current === 'saved') {
      setFeedFilter('all');
      feedFilterRef.current = 'all';
    }
    try {
      localStorage.removeItem(LAST_USER_HINT_KEY);
    } catch {
      // ignore
    }
    setActiveNav('home');
    await bootstrapApp({ preserveExisting: true });
  };

  const handleSwitchAccount = async (account: UserProfile) => {
    setCurrentUser(account);
    setAuthToken(api.getToken() || '');
    clearUserFeedCaches();
    await bootstrapApp({ preserveExisting: true });
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

  // Render inline horizontal Small Video carousel inside Home feed
  const renderHomeShortsStrip = (offset = 0) => {
    const rotated =
      shorts.length > 0 && offset > 0 && shorts.length > 3
        ? [...shorts.slice(offset % shorts.length), ...shorts.slice(0, offset % shorts.length)]
        : shorts;

    return (
      <section
        data-testid="home-small-video-strip"
        data-horizontal-strip="true"
        data-no-pull-refresh="true"
        className="ml-glass rounded-2xl p-3.5 w-full min-w-0"
      >
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-gold-soft)] border border-[var(--accent-gold-border)] flex items-center justify-center text-[var(--accent-gold)] shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">Small Video</h3>
          </div>
          <button
            type="button"
            onClick={() => openShortsPlayer(shorts, 0)}
            className="text-xs font-bold text-[var(--accent-primary)] hover:underline flex items-center gap-0.5 min-h-[36px] px-1 shrink-0"
          >
            <span>Watch all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {rotated.length === 0 ? (
          isFetchingInitialPosts || isLoadingHomeShorts || isLoadingMoreShorts || isRefreshing ? (
            <div className="flex items-stretch gap-2.5 overflow-hidden pb-1">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 w-[132px] sm:w-[148px] aspect-[9/16] rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] px-3.5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {homeShortsError || 'No Small Videos available right now'}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  Tap Retry to fetch the latest vertical videos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshHomeShorts({ forceLoading: true, preserveExisting: false })}
                className="ml-flame-box px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-primary)] shrink-0 inline-flex items-center gap-1.5"
              >
                {isLoadingHomeShorts || isLoadingMoreShorts ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Retry</span>
              </button>
            </div>
          )
        ) : (
          <div
            data-horizontal-strip="true"
            className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 touch-pan-x"
          >
            {rotated.slice(0, 10).map((short) => {
              const actualIndex = shorts.findIndex((s) => s.id === short.id);
              return (
                <button
                  key={`${short.id}-${offset}`}
                  type="button"
                  onClick={() => openShortsPlayer(shorts, actualIndex >= 0 ? actualIndex : 0)}
                  className="flex-shrink-0 w-[132px] sm:w-[148px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-[var(--border-subtle)] snap-start relative group text-left shadow-sm"
                >
                  {short.thumbnailUrl ? (
                    <img
                      src={short.thumbnailUrl}
                      alt={short.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#13161C]/90 via-[#13161C]/15 to-transparent" />
                  <div className="absolute bottom-2.5 left-2.5 right-2.5">
                    <p className="text-[11px] font-bold text-white line-clamp-2 leading-snug drop-shadow">
                      <TranslatableText text={short.title} showToggle={false} />
                    </p>
                    <p className="text-[10px] text-white/75 mt-1 tabular-nums">
                      {short.stats.views.toLocaleString()} views
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  // Render inline horizontal People Discovery & Friend Requests strip inside Home feed
  const renderHomePeopleStrip = () => {
    const hasRequests = peopleDiscovery.pendingRequests.length > 0;
    const hasSuggested = peopleDiscovery.suggested.length > 0;

    return (
      <section
        data-testid="home-people-strip"
        data-horizontal-strip="true"
        data-no-pull-refresh="true"
        className="ml-glass rounded-2xl p-3.5 w-full min-w-0"
      >
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-[var(--text-primary)] truncate">
              {hasRequests ? 'Friend Requests & People' : 'People You May Know'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setActiveNav('friends')}
            className="text-xs font-bold text-[var(--accent-primary)] hover:underline flex items-center gap-0.5 min-h-[36px] px-1 shrink-0"
          >
            <span>See all</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div
          data-horizontal-strip="true"
          className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1 touch-pan-x"
        >
          {peopleDiscovery.pendingRequests.map((req) => (
            <div
              key={`req-${req.id}`}
              className="flex-shrink-0 w-[166px] rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] overflow-hidden snap-start flex flex-col"
            >
              <button
                type="button"
                onClick={() =>
                  setCreatorTarget({
                    userId: req.sender.id,
                    displayName: req.sender.displayName,
                    username: req.sender.username,
                    avatar: req.sender.avatar,
                    source: 'motherland',
                  })
                }
                className="w-full h-28 bg-black/20 overflow-hidden block"
              >
                {req.sender.avatar ? (
                  <img
                    src={req.sender.avatar}
                    alt={req.sender.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--accent-primary-soft)] flex items-center justify-center text-2xl font-bold text-[var(--accent-primary)]">
                    {req.sender.displayName?.[0] || 'U'}
                  </div>
                )}
              </button>
              <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                    {req.sender.displayName}
                  </p>
                  <p className="text-[10px] text-[var(--accent-gold)] font-semibold truncate">
                    Sent friend request
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!requireSignedIn()) return;
                      await api.respondFriendRequest(req.id, 'accept').catch(() => {});
                      void refreshPeopleDiscovery();
                      void refreshCurrentUserCounts();
                    }}
                    className="flex-1 min-h-[34px] rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-[11px] font-bold"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!requireSignedIn()) return;
                      await api.respondFriendRequest(req.id, 'reject').catch(() => {});
                      void refreshPeopleDiscovery();
                    }}
                    className="w-8 min-h-[34px] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center"
                    aria-label="Decline request"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {peopleDiscovery.suggested.map((person) => {
            const isSent = Boolean(sentRequestIds[person.id]);
            return (
              <div
                key={`sug-${person.id}`}
                className="flex-shrink-0 w-[166px] rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] overflow-hidden snap-start flex flex-col"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCreatorTarget({
                      userId: person.id,
                      displayName: person.displayName,
                      username: person.username,
                      avatar: person.avatar,
                      source: 'motherland',
                    })
                  }
                  className="w-full h-28 bg-black/20 overflow-hidden block"
                >
                  {person.avatar ? (
                    <img
                      src={person.avatar}
                      alt={person.displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[var(--accent-primary-soft)] flex items-center justify-center text-2xl font-bold text-[var(--accent-primary)]">
                      {person.displayName?.[0] || 'U'}
                    </div>
                  )}
                </button>
                <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {person.displayName}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)] truncate">
                      @{person.username}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSent}
                    onClick={async () => {
                      if (!requireSignedIn()) return;
                      try {
                        await api.sendFriendRequest(person.id);
                        setSentRequestIds((prev) => ({ ...prev, [person.id]: true }));
                      } catch {
                        // ignore
                      }
                    }}
                    className={`w-full min-h-[34px] rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 ${
                      isSent
                        ? 'ml-flame-box-active text-[var(--text-primary)]'
                        : 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]'
                    }`}
                  >
                    {isSent ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Requested</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Friend</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {!hasRequests && !hasSuggested && (
            <button
              type="button"
              onClick={() => {
                if (currentUser) {
                  setActiveNav('friends');
                } else {
                  setIsAuthOpen(true);
                }
              }}
              className="flex-shrink-0 w-full min-w-[240px] rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-alt)] px-4 py-5 flex items-center gap-3 text-left hover:border-[var(--accent-primary-border)] transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {currentUser ? 'Find friends on MOTHERLAND' : 'Sign in to discover people'}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {currentUser
                    ? 'Search real accounts or manage requests in Friends.'
                    : 'Create an account or sign in to add friends.'}
                </p>
              </div>
            </button>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-clip ml-canvas-bg text-[var(--text-primary)] font-['Plus_Jakarta_Sans'] flex flex-col selection:bg-[var(--accent-primary)] selection:text-[var(--accent-primary-contrast)] transition-colors">
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
          isMotherlandLiveActive={activeNav === 'motherland_live'}
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
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenProfile={() => {
            setActiveNav('profile');
            if (postsRef.current.length === 0) {
              void loadPosts(feedFilterRef.current, true, { preserveExisting: true });
            }
            api.getCurrentUser().then((r) => r.user && setCurrentUser(r.user)).catch(() => {});
          }}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenYouTube={() => {
            setActiveNav('youtube');
            setYtRefreshSignal((s) => s + 1);
          }}
          onOpenMotherlandLive={() => {
            setActiveNav('motherland_live');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onLogoClick={() => {
            setActiveNav('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            refreshAll();
          }}
        />
      )}

      {/* Automatic Offline Mode Banner (Hidden when Online, activates ONLY when Internet is Off) */}
      {isOfflineModeActive && activeNav !== 'youtube' && (
        <div
          data-testid="auto-offline-banner"
          className="w-full bg-amber-500/15 border-b border-amber-500/35 px-3 py-1.5 text-center text-[11px] font-bold text-amber-300 flex items-center justify-center gap-2"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            অফলাইন মোড অটো চালু · {offlineVault.totalVideosCount}টি ভিডিও অফলাইনে রেডি
          </span>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 ${activeNav === 'youtube' ? 'pb-0' : hasMiniPlayer ? 'pb-40' : 'pb-24'}`}>
        {/* ========================================================= */}
        {/* TAB 1: HOME FEED (Persists across tab navigation!)        */}
        {/* ========================================================= */}
        <div className={activeNav === 'home' ? '' : 'hidden'}>
          <PullToRefresh onRefresh={refreshAll} disabled={isRefreshing || activeNav !== 'home'}>
            <div className="max-w-6xl mx-auto px-2.5 sm:px-4 py-3.5 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0">
              {/* Center Feed Column */}
              <div className="lg:col-span-8 space-y-4 min-w-0">
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
                          {currentUser.avatar ? (
                            <img
                              src={currentUser.avatar}
                              alt={currentUser.displayName}
                              className="w-10 h-10 rounded-full object-cover border border-[var(--border-subtle)]"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] flex items-center justify-center text-xs font-bold text-[var(--accent-primary)]">
                              {currentUser.displayName?.[0] || 'U'}
                            </div>
                          )}
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
                          handleSelectFeedFilter(tab.key);
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
                    data-testid="bm-games-hub-btn"
                    onClick={() => {
                      setActiveNav('games');
                      window.scrollTo({ top: 0, behavior: 'auto' });
                    }}
                    className="w-10 h-10 rounded-xl ml-glass hover:bg-[var(--bg-surface-alt)] border border-[var(--accent-primary-border)]/45 text-[var(--text-primary)] flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
                    title="BM Games"
                    aria-label="BM Games"
                  >
                    <BmGamesIcon className="w-6 h-6" />
                  </button>
                </div>

              {/* Feed Stream with Interspersed Shorts Discovery Carousels */}
              {(isFetchingInitialPosts || isLoadingHomePosts || isRefreshing) && posts.length === 0 ? (
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
                  {homeFeedError ? (
                    <div className="py-12 text-center ml-glass rounded-2xl p-6 text-[var(--text-secondary)] space-y-3">
                      <p className="text-sm font-semibold text-[var(--accent-danger)] inline-flex items-center gap-1.5 justify-center">
                        <AlertCircle className="w-4 h-4" />
                        <span>{homeFeedError}</span>
                      </p>
                      <div>
                        <button
                          type="button"
                          onClick={() => void loadPosts(feedFilter, true, { preserveExisting: false })}
                          className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry Feed</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-14 text-center ml-glass rounded-2xl p-6 text-[var(--text-secondary)]">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {feedFilter === 'saved' ? 'No saved posts yet.' : 'No posts in this feed yet.'}
                      </p>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => void loadPosts(feedFilter, true, { preserveExisting: false })}
                          className="px-4 py-2 rounded-xl ml-glass hover:bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Refresh</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (requireSignedIn()) {
                              setCreateModalState({ isOpen: true, initialMode: 'post' });
                            }
                          }}
                          className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold"
                        >
                          Create Post
                        </button>
                      </div>
                    </div>
                  )}
                  {renderHomeShortsStrip(0)}
                  {renderHomePeopleStrip()}
                </>
              ) : (
                <>
                  {posts.map((post, idx) => {
                    const showShortsAfter =
                      (idx === 1 && posts.length >= 2) ||
                      (idx > 2 && (idx - 1) % 4 === 0) ||
                      (posts.length === 1 && idx === 0);
                    const showPeopleAfter =
                      (idx === 3 && posts.length >= 4) ||
                      (posts.length > 0 && posts.length < 4 && idx === posts.length - 1);

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
                          onEditPost={handleEditPost}
                          onReportPost={handleReportPost}
                          onBlockUser={handleBlockUser}
                          onOpenCreator={(c) =>
                            setCreatorTarget({
                              userId: c.id,
                              displayName: c.name,
                              username: c.username,
                              avatar: c.avatar,
                              source: c.source || 'motherland',
                              channelId: c.id,
                            })
                          }
                        />
                        {showShortsAfter && renderHomeShortsStrip(idx)}
                        {showPeopleAfter && renderHomePeopleStrip()}
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
                    ) : homeFeedError ? (
                      <div className="inline-flex flex-col items-center gap-2 px-4 py-3 rounded-2xl ml-glass">
                        <p className="text-xs text-[var(--accent-danger)] font-semibold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{homeFeedError}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => (posts.length === 0 ? loadPosts(feedFilter, true, { preserveExisting: false }) : loadMorePosts())}
                          className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold inline-flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
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
                    handleSelectFeedFilter('saved');
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
          </PullToRefresh>
        </div>

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
            onUpNextChange={setUpNextWatchVideo}
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
            onOpenWatchHistory={() => {
              if (requireSignedIn()) setIsWatchHistoryOpen(true);
            }}
            onOpenCreator={(target) => setCreatorTarget(target)}
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
              setActiveNav('home');
              handleSelectFeedFilter('saved');
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
            onOpenWatchHistory={() => {
              if (requireSignedIn()) setIsWatchHistoryOpen(true);
            }}
            onOpenMotherlandLive={() => {
              setActiveNav('motherland_live');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenServerManagement={() => setIsServerModalOpen(true)}
            onUserUpdated={(updated) => setCurrentUser(updated)}
            onPlayOfflineVideo={(video) => {
              setActiveWatchVideo(video);
              setIsWatchMinimized(false);
              setActiveNav('video');
            }}
            onPlayOfflineShort={(short, list) => {
              const idx = list.findIndex((s) => s.id === short.id);
              openShortsPlayer(list.length > 0 ? list : [short], idx >= 0 ? idx : 0);
            }}
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
            onEditPost={handleEditPost}
            onReportPost={handleReportPost}
            onBlockUser={handleBlockUser}
            onOpenCreator={(c) =>
              setCreatorTarget({
                userId: c.id,
                displayName: c.name,
                username: c.username,
                avatar: c.avatar,
                source: c.source || 'motherland',
                channelId: c.id,
              })
            }
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
            onBackToMotherland={() => navigateToHome({ scrollMode: 'restore' })}
            refreshSignal={ytRefreshSignal}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 7: MOTHERLAND LIVE (LIVE TV, MOVIES & DRAMA)          */}
        {/* ========================================================= */}
        {activeNav === 'motherland_live' && (
          <MotherlandLiveView
            currentUser={currentUser}
            onBack={() => navigateToHome({ scrollMode: 'restore' })}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 8: MOTHERLAND GAMES HUB (BM GAMES)                    */}
        {/* ========================================================= */}
        {activeNav === 'games' && (
          <GamesHubView
            currentUser={currentUser}
            sendWsEvent={sendWsEvent}
            subscribeSpyEvents={subscribeSpyEvents}
            onBack={() => navigateToHome({ scrollMode: 'restore' })}
            onRequireAuth={() => setIsAuthOpen(true)}
          />
        )}
      </main>

      {/* Persistent Zero-Restart Watch Player + Floating Docked Mini-Player */}
      <PersistentWatchPlayer
        video={activeWatchVideo}
        upNextVideo={
          upNextWatchVideo ||
          longVideos.find((v) => v.id !== activeWatchVideo?.id) ||
          null
        }
        isMinimized={isWatchMinimized}
        isFullWatchVisible={activeNav === 'video' && !isWatchMinimized}
        isPausedByOverlay={shortsPlayerState.isOpen || activeNav === 'youtube' || activeNav === 'games' || activeNav === 'motherland_live'}
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
          if (typeof window !== 'undefined' && /^\/video\//.test(window.location.pathname)) {
            window.history.replaceState(null, '', '/');
          }
        }}
      />

      {/* 2. Bottom Navigation */}
      {activeNav !== 'youtube' && (
        <BottomNav
          activeTab={shortsPlayerState.isOpen ? 'shorts' : activeNav}
          onTabChange={(tab) => {
            if (tab === 'shorts') {
              const latestUnsuppressed = filterUnsuppressed(shortsRef.current).filter(isEligibleShortVideo);
              openShortsPlayer(latestUnsuppressed, 0);
              const reqSeq = ++shortsReqSeqRef.current;
              shortsAbortRef.current?.abort();
              const controller = new AbortController();
              shortsAbortRef.current = controller;
              setIsLoadingHomeShorts(true);
              api
                .getShorts(false, 1, 12, '', controller.signal)
                .then((res) => {
                  if (controller.signal.aborted || reqSeq !== shortsReqSeqRef.current) return;
                  const fresh = filterUnsuppressed(res.shorts || []).filter(isEligibleShortVideo);
                  if (fresh.length > 0) {
                    setShorts(fresh);
                    setShortsPage(1);
                    setShortsNextPageToken(res.nextPageToken || null);
                    setShortsHasMore(res.hasMore !== false);
                    recordShownFeedIds('shorts', fresh.map((s) => s.youtubeId || s.id));
                    setShortsPlayerState((prev) =>
                      prev.isOpen && prev.list.length > 0
                        ? prev
                        : { isOpen: true, list: fresh, initialIndex: 0 }
                    );
                  }
                })
                .catch(() => {})
                .finally(() => {
                  if (reqSeq === shortsReqSeqRef.current) {
                    setIsLoadingHomeShorts(false);
                  }
                });
              return;
            }
            if (tab === 'video' && activeNav === 'video' && activeWatchVideo && !isWatchMinimized) {
              setIsWatchMinimized(true);
              return;
            }
            if (tab === 'home') {
              navigateToHome({ scrollMode: activeNavRef.current === 'home' ? 'top' : 'restore' });
              return;
            }
            setActiveNav(tab);
            if (tab === 'friends') {
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
          onPostCreated={() => {
            void loadPosts(feedFilterRef.current, true, { preserveExisting: true });
            void refreshCurrentUserCounts();
          }}
          onStoryCreated={() =>
            api
              .getStories()
              .then((res) => {
                if (Array.isArray(res.stories) && res.stories.length > 0) setStories(res.stories);
              })
              .catch(() => {})
          }
          onShortCreated={() => {
            void refreshHomeShorts({ forceLoading: false, preserveExisting: true });
            void refreshCurrentUserCounts();
          }}
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
            api
              .getLongVideos()
              .then((res) => {
                if (Array.isArray(res.videos) && res.videos.length > 0) setLongVideos(res.videos);
              })
              .catch(() => {});
            void loadPosts(feedFilterRef.current, true, { preserveExisting: true });
            void refreshCurrentUserCounts();
          }}
          onMotherlandPostCreated={() => {
            void loadPosts(feedFilterRef.current, true, { preserveExisting: true });
            void refreshCurrentUserCounts();
          }}
          onYouTubeConnectionChanged={() => bootstrapApp({ preserveExisting: true })}
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
        onOpenCreator={(target) => setCreatorTarget(target)}
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
        onOpenCreator={(c) =>
          setCreatorTarget({
            userId: c.id,
            displayName: c.name,
            username: c.username,
            avatar: c.avatar,
            source: c.source || 'motherland',
            channelId: c.id,
          })
        }
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
        expiredSessionHint={expiredSessionHint}
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

      {/* 13. Universal Always-Accessible Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onWatchVideo={(video) => {
          setIsSearchOpen(false);
          setActiveWatchVideo(video);
          setIsWatchMinimized(false);
          setActiveNav('video');
        }}
        onOpenShortsPlayer={(list, idx) => {
          setIsSearchOpen(false);
          openShortsPlayer(list, idx);
        }}
        onOpenCreator={(user) => {
          setIsSearchOpen(false);
          setCreatorTarget({
            userId: user.id,
            displayName: user.displayName,
            username: user.username,
            avatar: user.avatar,
            source: 'motherland',
          });
        }}
      />

      {/* 14. Watch History Modal (Revisit 7-Day Suppressed Videos) */}
      <WatchHistoryModal
        isOpen={isWatchHistoryOpen}
        onClose={() => setIsWatchHistoryOpen(false)}
        onPlayHistoryItem={(item) => {
          setIsWatchHistoryOpen(false);
          if (item.videoType === 'short') {
            openShortsPlayer(
              [
                {
                  id: item.videoId,
                  source: item.source === 'youtube' ? 'youtube' : 'motherland',
                  youtubeId: item.youtubeId,
                  videoUrl: '',
                  thumbnailUrl: item.thumbnailUrl || '',
                  title: item.title,
                  caption: item.title,
                  hashtags: [],
                  creator: {
                    id: 'history',
                    name: item.channelTitle || 'Creator',
                    username: 'creator',
                    avatar: '',
                  },
                  stats: { likes: 0, comments: 0, shares: 0, views: 0 },
                  createdAt: item.lastViewedAt,
                },
              ],
              0
            );
          } else {
            setActiveWatchVideo({
              id: item.videoId,
              source: item.source === 'youtube' ? 'youtube' : 'motherland',
              youtubeId: item.youtubeId,
              thumbnailUrl: item.thumbnailUrl || '',
              title: item.title,
              description: '',
              duration: item.duration || '0:00',
              channel: {
                id: 'history',
                title: item.channelTitle || 'Creator',
                avatar: '',
              },
              stats: { views: 0, likes: 0, comments: 0 },
              publishedAt: new Date(item.lastViewedAt).toLocaleDateString(),
            });
            setIsWatchMinimized(false);
            setActiveNav('video');
          }
        }}
      />

      {/* 15. Clickable Creator Profile Modal */}
      <CreatorProfileModal
        target={creatorTarget}
        currentUser={currentUser}
        onClose={() => setCreatorTarget(null)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenChatWithUser={(userId) => {
          setCreatorTarget(null);
          if (!requireSignedIn()) return;
          setChatTargetUserId(userId);
          setIsMessagesOpen(true);
        }}
        onPlayVideo={(video) => {
          setCreatorTarget(null);
          setActiveWatchVideo(video);
          setIsWatchMinimized(false);
          setActiveNav('video');
        }}
        onPlayShort={(shortList, index) => {
          setCreatorTarget(null);
          openShortsPlayer(shortList, index);
        }}
        onSupportChanged={() => {
          void refreshCurrentUserCounts();
        }}
      />

      {/* 16. Multi-Server Registry & Owner Config Chat Modal */}
      <ServerManagementModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
