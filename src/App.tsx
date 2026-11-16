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
import { BangladeshServicesView } from './components/BangladeshServicesView';
import { ServerManagementModal } from './components/ServerManagementModal';
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

  // Core Data (always fetched fresh on app launch — never restored from stale feed cache)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authToken, setAuthToken] = useState<string>(() => api.getToken() || '');
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

  // Loading States (Never block initial render with a slow splash wall)
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [isFetchingInitialPosts, setIsFetchingInitialPosts] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [homeFeedPage, setHomeFeedPage] = useState(1);
  const [isLoadingMorePosts, setIsLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [homeFeedError, setHomeFeedError] = useState('');
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
  const isLoadingMorePostsRef = useRef<boolean>(false);
  const sessionExpiredPromptedRef = useRef(false);
  const savedScrollRef = useRef<number>(0);

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

  // Live 7-day watched suppression pruning across all feeds & shorts list
  useEffect(() => {
    const onSuppressed = () => {
      setPosts((prev) => filterUnsuppressed(prev, true));
      setShorts((prev) => filterUnsuppressed(prev).filter(isEligibleShortVideo));
      setLongVideos((prev) => filterUnsuppressed(prev));
    };
    window.addEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
    return () => window.removeEventListener(WATCH_SUPPRESSED_EVENT, onSuppressed);
  }, []);

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

  const bootstrapApp = async () => {
    try {
      setAuthToken(api.getToken() || '');
      setHomeFeedError('');
      homeYtCursorRef.current = '';
      const userData = await api.getCurrentUser().catch(() => ({
        user: null,
        sessionExpired: false,
        transientError: true,
      }));
      const resolvedUser = userData.user || null;
      setWatchSuppressionUserId(resolvedUser?.id || null);

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
      } else if (userData.sessionExpired && !(userData as any).transientError) {
        api.setToken('');
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
        ytData,
        adaptData,
        notifData,
        storiesData,
        shortsData,
        longData,
        convData,
        postsData,
      ] = await Promise.all([
        api.getYouTubeStatus().catch(() => ({ configured: false })),
        api.getPlatformAdapters().catch(() => ({ adapters: [] })),
        api.getToken() ? api.getNotifications().catch(() => ({ notifications: [] })) : Promise.resolve({ notifications: [] }),
        api.getStories().catch(() => ({ stories: [] })),
        api.getShorts(false, 1, 12).catch(() => ({ shorts: [], nextPageToken: null, hasMore: true })),
        api.getLongVideos().catch(() => ({ videos: [] })),
        api.getToken() ? api.getConversations().catch(() => ({ totalUnread: 0 })) : Promise.resolve({ totalUnread: 0 }),
        api.getPosts(feedFilter, 'all', 1, 10, '').catch((err) => ({
          posts: [],
          hasMore: true,
          nextYtCursor: null,
          errorMessage: err?.message || 'Unable to load feed',
        })),
      ]);

      const nextStories = storiesData.stories || [];
      const nextShorts = filterUnsuppressed(shortsData.shorts || []).filter(isEligibleShortVideo);
      const nextLongVideos = filterUnsuppressed(longData.videos || []);
      const filteredPosts = filterUnsuppressed(postsData.posts || [], true);
      const seenPostKeys = new Set<string>();
      const nextPosts: Post[] = [];
      for (const p of filteredPosts) {
        const key = p.externalId || p.id;
        if (!seenPostKeys.has(p.id) && !seenPostKeys.has(key)) {
          seenPostKeys.add(p.id);
          seenPostKeys.add(key);
          nextPosts.push(p);
        }
      }

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

      homeYtCursorRef.current = (postsData as any).nextYtCursor || '';
      if ((postsData as any).errorMessage) {
        setHomeFeedError(String((postsData as any).errorMessage));
      }

      setCurrentUser(resolvedUser);
      setYoutubeStatus(ytData);
      setAdapters(adaptData.adapters || []);
      setNotifications(resolvedNotifs);
      setUnreadMessagesCount(resolvedUnread);
      setStories(nextStories);
      setShorts(nextShorts);
      setShortsPage(1);
      setShortsNextPageToken((shortsData as any).nextPageToken || null);
      setShortsHasMore((shortsData as any).hasMore !== false);
      setShortsExhaustedNotice('');
      setLongVideos(nextLongVideos);
      setHomeFeedPage(1);
      setPosts(nextPosts);
      setHasMorePosts((postsData as any).hasMore !== false);
      lastAutoRefreshRef.current = Date.now();

      recordShownFeedIds('home', nextPosts.map((p) => p.externalId || p.id));
      recordShownFeedIds('shorts', nextShorts.map((s) => s.youtubeId || s.id));
      void refreshPeopleDiscovery(resolvedUser);
    } catch (err) {
      console.error('Bootstrap error:', err);
    } finally {
      setIsLoadingFeed(false);
      setIsFetchingInitialPosts(false);
    }
  };

  const loadPosts = async (type: 'all' | 'for_you' | 'motherland' | 'saved' = feedFilter, reset = true) => {
    homePostsAbortRef.current?.abort();
    const controller = new AbortController();
    homePostsAbortRef.current = controller;

    try {
      if (reset) {
        setHomeFeedError('');
        setHomeFeedPage(1);
        homeYtCursorRef.current = '';
        const data = await api.getPosts(type, 'all', 1, 10, '', controller.signal);
        if (controller.signal.aborted) return;
        homeYtCursorRef.current = data.nextYtCursor || '';
        const filtered = filterUnsuppressed(data.posts || [], true);
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
        setPosts(deduped);
        setHasMorePosts(data.hasMore !== false);
        recordShownFeedIds('home', deduped.map((p) => p.externalId || p.id));
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Failed to load posts:', err);
      setHomeFeedError(err?.message || 'Unable to load posts');
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMorePostsRef.current || isLoadingMorePosts || !hasMorePosts) return;
    isLoadingMorePostsRef.current = true;
    setIsLoadingMorePosts(true);
    setHomeFeedError('');
    try {
      const nextPage = homeFeedPage + 1;
      const data = await api.getPosts(feedFilter, 'all', nextPage, 10, homeYtCursorRef.current);
      homeYtCursorRef.current = data.nextYtCursor || '';
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
          return [...prev, ...nextItems];
        });
        setHomeFeedPage(nextPage);
      }
      setHasMorePosts(data.hasMore !== false);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
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
    if (isLoadingMoreShorts || !shortsHasMore) return;
    setIsLoadingMoreShorts(true);
    try {
      const nextPage = shortsPage + 1;
      const res = await api.getShorts(false, nextPage, 12, shortsNextPageToken || '');

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
    } catch (err) {
      console.error('Load more shorts error:', err);
    } finally {
      setIsLoadingMoreShorts(false);
    }
  };

  // Automatic Background Auto-Refresh (on app re-entry / focus + every 90s when not actively watching)
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
        .getShorts(false, 1, 12)
        .then((s) => {
          const clean = filterUnsuppressed(s.shorts || []).filter(isEligibleShortVideo);
          setShorts(clean);
          setShortsPage(1);
          setShortsNextPageToken(s.nextPageToken || null);
          setShortsHasMore(s.hasMore !== false);
        })
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
      if (document.visibilityState === 'visible') {
        if (!currentUserRef.current && api.getToken()) {
          api
            .getCurrentUser()
            .then((res) => {
              if (res.user) {
                setCurrentUser(res.user);
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

  const handleLogout = async () => {
    try {
      await api.logout();
      setCurrentUser(null);
      setAuthToken('');
      setNotifications([]);
      setUnreadMessagesCount(0);
      setExpiredSessionHint(null);
      try {
        localStorage.removeItem(LAST_USER_HINT_KEY);
      } catch {
        // ignore
      }
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
    setExpiredSessionHint(null);
    try {
      localStorage.removeItem(LAST_USER_HINT_KEY);
    } catch {
      // ignore
    }
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
          <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] px-3.5 py-4">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {isFetchingInitialPosts || isLoadingMoreShorts
                  ? 'Loading Small Videos...'
                  : 'No Small Videos available right now'}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                Tap Retry to fetch the latest vertical videos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsLoadingMoreShorts(true);
                api
                  .getShorts(false, 1, 12)
                  .then((res) => {
                    const fresh = filterUnsuppressed(res.shorts || []).filter(isEligibleShortVideo);
                    setShorts(fresh);
                    setShortsPage(1);
                    setShortsNextPageToken(res.nextPageToken || null);
                    setShortsHasMore(res.hasMore !== false);
                  })
                  .catch(() => {})
                  .finally(() => setIsLoadingMoreShorts(false));
              }}
              className="ml-flame-box px-3 py-2 rounded-xl text-xs font-bold text-[var(--text-primary)] shrink-0"
            >
              {isLoadingMoreShorts ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Retry</span>
            </button>
          </div>
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
                  <img
                    src={short.thumbnailUrl}
                    alt={short.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
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
                <img
                  src={req.sender.avatar}
                  alt={req.sender.displayName}
                  className="w-full h-full object-cover"
                />
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
                  <img
                    src={person.avatar}
                    alt={person.displayName}
                    className="w-full h-full object-cover"
                  />
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
          isBdServicesActive={activeNav === 'bd_services'}
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
            loadPosts(feedFilter, true);
            api.getCurrentUser().then((r) => r.user && setCurrentUser(r.user)).catch(() => {});
          }}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenYouTube={() => {
            setActiveNav('youtube');
            setYtRefreshSignal((s) => s + 1);
          }}
          onOpenBdServices={() => {
            setActiveNav('bd_services');
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
        {/* TAB 1: HOME FEED (with Facebook-Style Pull-to-Refresh)    */}
        {/* ========================================================= */}
        {activeNav === 'home' && (
          <PullToRefresh onRefresh={refreshAll} disabled={isRefreshing}>
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
                          onClick={() => (posts.length === 0 ? loadPosts(feedFilter, true) : loadMorePosts())}
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
          </PullToRefresh>
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
            onOpenWatchHistory={() => {
              if (requireSignedIn()) setIsWatchHistoryOpen(true);
            }}
            onOpenBdServices={() => {
              setActiveNav('bd_services');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenServerManagement={() => setIsServerModalOpen(true)}
            onUserUpdated={(updated) => setCurrentUser(updated)}
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
            onBackToMotherland={() => setActiveNav('home')}
            refreshSignal={ytRefreshSignal}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 7: BANGLADESH SERVICES (বাংলাদেশ)                     */}
        {/* ========================================================= */}
        {activeNav === 'bd_services' && (
          <BangladeshServicesView
            currentUser={currentUser}
            onBack={() => setActiveNav('home')}
            onOpenAuth={() => setIsAuthOpen(true)}
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
              const latestUnsuppressed = filterUnsuppressed(shorts).filter(isEligibleShortVideo);
              openShortsPlayer(latestUnsuppressed, 0);
              setIsLoadingMoreShorts(true);
              api
                .getShorts(false, 1, 12)
                .then((res) => {
                  const fresh = filterUnsuppressed(res.shorts || []).filter(isEligibleShortVideo);
                  setShorts(fresh);
                  setShortsPage(1);
                  setShortsNextPageToken(res.nextPageToken || null);
                  setShortsHasMore(res.hasMore !== false);
                  setShortsPlayerState((prev) =>
                    prev.isOpen && prev.list.length > 0
                      ? prev
                      : { isOpen: true, list: fresh, initialIndex: 0 }
                  );
                })
                .catch(() => {})
                .finally(() => setIsLoadingMoreShorts(false));
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
              api
                .getShorts(false, 1, 12)
                .then((s) => {
                  const fresh = filterUnsuppressed(s.shorts || []).filter(isEligibleShortVideo);
                  setShorts(fresh);
                  setShortsPage(1);
                  setShortsNextPageToken(s.nextPageToken || null);
                  setShortsHasMore(s.hasMore !== false);
                })
                .catch(() => {});
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
          onPostCreated={() => {
            void loadPosts(feedFilter, true);
            void refreshCurrentUserCounts();
          }}
          onStoryCreated={() =>
            api.getStories().then((res) => setStories(res.stories || []))
          }
          onShortCreated={() => {
            api.getShorts().then((res) => setShorts(res.shorts || []));
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
            api.getLongVideos().then((res) => setLongVideos(res.videos || []));
            void loadPosts(feedFilter, true);
            void refreshCurrentUserCounts();
          }}
          onMotherlandPostCreated={() => {
            void loadPosts(feedFilter, true);
            void refreshCurrentUserCounts();
          }}
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
