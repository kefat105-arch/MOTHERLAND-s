import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home,
  Users,
  Film,
  ShoppingBag,
  Menu,
  Plus,
  Image as ImageIcon,
  Video as VideoIcon,
  Smile,
  Sparkles,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Filter,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { PulseIcon } from '../fire/MotherlandIcons';
import {
  SocialNavTab,
  SocialPost,
  SocialStory,
  CurrentUserProfile,
} from '../../types/social';
import {
  INITIAL_MARKETPLACE_ITEMS,
  deletePost,
  getStoredCurrentUser,
  getStoredPosts,
  syncPostsFromBackend,
  getStoredStories,
  saveStoredStories,
  fetchActiveStories,
  fetchFriendSuggestions,
  sendFriendRequestApi,
  cancelFriendRequestApi,
  getWatchHistory,
  fetchNotifications,
} from '../../services/socialService';
import { searchYouTube } from '../../services/youtubeService';
import { UnifiedVideo } from '../../types/video';
import { SocialPostCard } from './SocialPostCard';
import { CreatePostModal } from './CreatePostModal';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewerModal } from './StoryViewerModal';
import { ImageLightboxModal } from './ImageLightboxModal';
import { VideoEditorStudio } from '../video/VideoEditorStudio';

interface MotherlandHomeFeedProps {
  currentUser?: CurrentUserProfile | null;
  onOpenUniversalVideos?: () => void;
  onOpenUserProfile?: () => void;
}

type FeedFilter = 'all' | 'motherland' | 'youtube' | 'videos' | 'photos';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80';

export const MotherlandHomeFeed: React.FC<MotherlandHomeFeedProps> = ({
  currentUser: propCurrentUser,
  onOpenUniversalVideos,
  onOpenUserProfile,
}) => {
  const [socialTab, setSocialTab] = useState<SocialNavTab>('home');
  const [localCurrentUser, setLocalCurrentUser] = useState<CurrentUserProfile | null>(
    () => propCurrentUser ?? getStoredCurrentUser()
  );
  const currentUser = propCurrentUser !== undefined ? propCurrentUser : localCurrentUser;
  const [nativePosts, setNativePosts] = useState<SocialPost[]>(getStoredPosts());
  const [mixedPosts, setMixedPosts] = useState<SocialPost[]>([]);
  const [stories, setStories] = useState<SocialStory[]>(getStoredStories());
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');

  // Pagination for infinite video discovery
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Pull-to-refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartRef = useRef<number>(0);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Modals
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createPostType, setCreatePostType] = useState<'text' | 'photo' | 'video'>('text');
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [storyViewerOpen, setStoryViewerOpen] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [lightboxAlt, setLightboxAlt] = useState<string | undefined>(undefined);
  const [editorStudioOpen, setEditorStudioOpen] = useState(false);

  // Dynamic Friend Suggestions & Requests (Strict requirement 5)
  const [friendSuggestions, setFriendSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<string>>(new Set());
  const [tabNotifications, setTabNotifications] = useState<any[]>([]);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    setLocalCurrentUser(getStoredCurrentUser());
  }, [propCurrentUser]);

  // Convert UnifiedVideo to SocialPost format
  const convertYouTubeToSocialPost = useCallback((video: UnifiedVideo): SocialPost => {
    const authorName = video.creatorName || 'YouTube Creator';
    const handle = video.creatorHandle || `@${authorName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const isCommunityPost = (video as any).isCommunityPost || !video.videoId;

    return {
      id: `yt_feed_${video.videoId || video.id}`,
      author: {
        id: video.creatorHandle || `yt_${authorName.replace(/\s+/g, '_')}`,
        name: authorName,
        handle,
        avatar:
          video.thumbnailUrl ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        isVerified: true,
        platform: 'youtube',
      },
      content: video.title + (video.description ? `\n\n${video.description.slice(0, 160)}...` : ''),
      media: [
        {
          id: `media_${video.videoId || video.id}`,
          type: isCommunityPost ? 'photo' : 'video',
          url: isCommunityPost
            ? (video as any).communityImageUrl || video.thumbnailUrl
            : video.originalVideoUrl || `https://www.youtube.com/watch?v=${video.videoId}`,
          thumbnailUrl: video.thumbnailUrl,
          aspectRatio: video.aspectRatio || '16:9',
          duration: video.duration,
        },
      ],
      createdAt: video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : 'Recent',
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      isLiked: false,
      isSaved: false,
      privacy: 'public',
      platform: 'youtube',
      youtubeVideoId: video.videoId || undefined,
      originalVideoUrl: video.originalVideoUrl,
      reactions: { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0, cool: 0 },
      userReaction: null,
    };
  }, []);

  // Fetch real YouTube videos and interleave with native posts
  const loadMixedFeed = useCallback(
    async (isRefresh: boolean = false) => {
      if (isRefreshingRef.current) return;
      isRefreshingRef.current = true;
      if (isRefresh) setIsRefreshing(true);

      try {
        // Sync active unexpired stories from backend (Strict 24h expiration)
        fetchActiveStories().then((activeStories) => {
          if (activeStories && Array.isArray(activeStories)) {
            setStories(activeStories);
          }
        }).catch(() => {});

        // Sync real posts from backend database
        const stored = await syncPostsFromBackend();
        setNativePosts(stored);

        // Fetch fresh YouTube videos
        const res = await searchYouTube({
          query: 'Bangladesh trending music news culture',
          pageSize: 12,
          regionCode: 'BD',
          type: 'video',
        });

        const ytPosts = res.videos.map(convertYouTubeToSocialPost);
        setNextPageToken(res.nextPageToken);

        // Interleave posts: 1 native post, 2 YouTube videos, etc.
        const interleaved: SocialPost[] = [];
        let nIdx = 0;
        let yIdx = 0;

        while (nIdx < stored.length || yIdx < ytPosts.length) {
          if (nIdx < stored.length) {
            interleaved.push(stored[nIdx++]);
          }
          if (yIdx < ytPosts.length) {
            interleaved.push(ytPosts[yIdx++]);
          }
          if (yIdx < ytPosts.length) {
            interleaved.push(ytPosts[yIdx++]);
          }
        }

        // Prioritize fresh/unwatched videos (Requirement 15)
        const watchedHistory = getWatchHistory();
        const watchedSet = new Set(watchedHistory);
        const prioritized = [...interleaved].sort((a, b) => {
          const aId = a.youtubeVideoId || a.id;
          const bId = b.youtubeVideoId || b.id;
          const aWatched = watchedSet.has(aId);
          const bWatched = watchedSet.has(bId);
          if (aWatched && !bWatched) return 1;
          if (!aWatched && bWatched) return -1;
          return 0;
        });

        setMixedPosts(prioritized);
      } catch (err) {
        console.warn('Could not fetch YouTube videos for home feed:', err);
        // Fallback to native posts
        setMixedPosts(getStoredPosts());
      } finally {
        isRefreshingRef.current = false;
        if (isRefresh) {
          setTimeout(() => setIsRefreshing(false), 300);
        }
      }
    },
    [convertYouTubeToSocialPost]
  );

  // Initial load
  useEffect(() => {
    loadMixedFeed(false);
  }, [loadMixedFeed]);

  // Load more videos when reaching the bottom
  const loadMoreVideos = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      const res = await searchYouTube({
        query: 'Bangladesh travel scenery entertainment',
        pageToken: nextPageToken,
        pageSize: 10,
        regionCode: 'BD',
        type: 'video',
      });

      if (res.videos.length === 0) {
        setHasMore(false);
      } else {
        const newPosts = res.videos.map(convertYouTubeToSocialPost);
        setNextPageToken(res.nextPageToken);
        setMixedPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const unique = newPosts.filter((p) => !existingIds.has(p.id));
          return [...prev, ...unique];
        });
      }
    } catch (err) {
      console.warn('Failed to load more feed items:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, nextPageToken, convertYouTubeToSocialPost]);

  // IntersectionObserver for infinite scrolling
  useEffect(() => {
    if (socialTab !== 'home') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          loadMoreVideos();
        }
      },
      { rootMargin: '400px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [socialTab, isLoadingMore, hasMore, loadMoreVideos]);

  // Load real dynamic friend suggestions or notifications when switching tabs
  useEffect(() => {
    if (socialTab === 'friends') {
      setLoadingSuggestions(true);
      fetchFriendSuggestions()
        .then((data) => {
          setFriendSuggestions(data || []);
        })
        .catch((err) => {
          console.warn('Failed to fetch friend suggestions:', err);
          setFriendSuggestions([]);
        })
        .finally(() => {
          setLoadingSuggestions(false);
        });
    } else if (socialTab === 'notifications') {
      fetchNotifications()
        .then((res) => {
          setTabNotifications(res.notifications || []);
        })
        .catch(() => setTabNotifications([]));
    }
  }, [socialTab]);

  const handleToggleFriendRequest = async (userId: string) => {
    if (sentRequestUserIds.has(userId)) {
      await cancelFriendRequestApi(userId);
      setSentRequestUserIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    } else {
      await sendFriendRequestApi(userId);
      setSentRequestUserIds((prev) => new Set(prev).add(userId));
    }
  };

  // Touch Pull-to-Refresh Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartRef.current = e.touches[0].clientY;
    } else {
      touchStartRef.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartRef.current;
    if (diff > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(diff * 0.45, 90));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      loadMixedFeed(true);
    }
    setPullDistance(0);
    touchStartRef.current = 0;
  };

  // Modals & Handlers
  const handleOpenCreatePost = (type: 'text' | 'photo' | 'video' = 'text') => {
    setCreatePostType(type);
    setCreatePostOpen(true);
  };

  const handlePostCreated = (newPost: SocialPost) => {
    setNativePosts([newPost, ...nativePosts]);
    setMixedPosts([newPost, ...mixedPosts]);
  };

  const handleDeletePost = (postId: string) => {
    deletePost(postId);
    setNativePosts((prev) => prev.filter((p) => p.id !== postId));
    setMixedPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleStoryCreated = (newStory: SocialStory) => {
    setStories([newStory, ...stories]);
  };

  const handleDeleteStory = (storyId: string) => {
    const updated = stories.filter((s) => s.id !== storyId);
    setStories(updated);
    saveStoredStories(updated);
  };

  const handleOpenStory = (index: number) => {
    setSelectedStoryIndex(index);
    setStoryViewerOpen(true);
  };

  const handleOpenLightbox = (url: string, alt?: string) => {
    setLightboxImage(url);
    setLightboxAlt(alt);
  };

  // Filter posts according to active feedFilter
  const filteredPosts = mixedPosts.filter((post) => {
    if (feedFilter === 'all') return true;
    if (feedFilter === 'motherland') return post.platform !== 'youtube';
    if (feedFilter === 'youtube') return post.platform === 'youtube';
    if (feedFilter === 'videos') {
      return (
        post.platform === 'youtube' ||
        post.media.some((m) => m.type === 'video')
      );
    }
    if (feedFilter === 'photos') {
      return post.media.some((m) => m.type === 'photo');
    }
    return true;
  });

  return (
    <div
      ref={feedContainerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="w-full max-w-full sm:max-w-2xl sm:mx-auto px-1 sm:px-4 py-2 sm:py-4 pb-24 space-y-3 sm:space-y-4"
    >
      {/* Pull-to-refresh visual indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="w-full flex items-center justify-center py-2 transition-all duration-200"
          style={{ height: `${Math.max(pullDistance, isRefreshing ? 48 : 0)}px` }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111728] border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-lg">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing MOTHERLAND Feed...' : 'Release to refresh feed'}</span>
          </div>
        </div>
      )}

      {/* Internal Social Navigation Shortcut Row (Home, Friends, Videos, Marketplace, Notifications, Menu) */}
      <div className="w-full bg-[#0d1320] border border-white/10 rounded-2xl p-1.5 flex items-center justify-between text-slate-300 shadow-md">
        <button
          onClick={() => {
            setSocialTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            socialTab === 'home'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
              : 'hover:bg-white/5 text-slate-400 hover:text-white'
          }`}
          title="Motherland Home Feed"
        >
          <Home className="w-4 h-4" />
          <span className="hidden xs:inline">Home</span>
        </button>

        <button
          onClick={() => setSocialTab('friends')}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            socialTab === 'friends'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
              : 'hover:bg-white/5 text-slate-400 hover:text-white'
          }`}
          title="Friends & Connections"
        >
          <Users className="w-4 h-4" />
          <span className="hidden xs:inline">Friends</span>
        </button>

        <button
          onClick={() => {
            if (onOpenUniversalVideos) {
              onOpenUniversalVideos();
            } else {
              setSocialTab('videos');
            }
          }}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            socialTab === 'videos'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
              : 'hover:bg-white/5 text-slate-400 hover:text-white'
          }`}
          title="Universal Video Stream"
        >
          <Film className="w-4 h-4" />
          <span className="hidden xs:inline">Videos</span>
        </button>

        <button
          onClick={() => setSocialTab('marketplace')}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            socialTab === 'marketplace'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
              : 'hover:bg-white/5 text-slate-400 hover:text-white'
          }`}
          title="Motherland Marketplace"
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="hidden xs:inline">Market</span>
        </button>

        <button
          onClick={() => setSocialTab('notifications')}
          className={`relative flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            socialTab === 'notifications'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
              : 'hover:bg-white/5 text-slate-400 hover:text-white'
          }`}
          title="Pulse Notifications"
        >
          <PulseIcon className="w-4 h-4" />
          <span className="hidden xs:inline">Pulse</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1.5 right-3" />
        </button>

        <button
          onClick={() => {
            if (onOpenUserProfile) {
              onOpenUserProfile();
            } else {
              setSocialTab('menu');
            }
          }}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
            socialTab === 'menu'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
              : 'hover:bg-white/5 text-slate-400 hover:text-white'
          }`}
          title="User Profile & Settings"
        >
          <Menu className="w-4 h-4" />
          <span className="hidden xs:inline">Menu</span>
        </button>
      </div>

      {/* Main Home Content */}
      {socialTab === 'home' && (
        <>
          {/* STORIES CAROUSEL */}
          <div className="w-full overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center gap-3">
              {/* Current User Create Story Card */}
              <div
                onClick={() => setCreateStoryOpen(true)}
                className="relative flex-shrink-0 w-28 h-44 rounded-2xl overflow-hidden bg-[#111728] border border-emerald-500/30 hover:border-emerald-400 cursor-pointer group shadow-lg flex flex-col justify-between p-2 select-none"
              >
                <img
                  src={currentUser?.avatar || DEFAULT_AVATAR}
                  alt={currentUser?.name || 'Guest'}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                <div className="relative z-10 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg mx-auto mt-auto mb-1 group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="relative z-10 text-[11px] font-bold text-white text-center block leading-tight">
                  Create Story
                </span>
              </div>

              {/* Followed Users Stories */}
              {stories.map((story, idx) => (
                <div
                  key={story.id}
                  onClick={() => handleOpenStory(idx)}
                  className="relative flex-shrink-0 w-28 h-44 rounded-2xl overflow-hidden bg-[#111728] border border-white/10 hover:border-white/20 cursor-pointer group shadow-lg flex flex-col justify-between p-2.5 select-none"
                >
                  <img
                    src={story.mediaUrl}
                    alt={story.caption || 'Story'}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  <div className="relative z-10">
                    <img
                      src={story.author.avatar}
                      alt={story.author.name}
                      className="w-9 h-9 rounded-full object-cover border-2 border-emerald-400 shadow-md"
                    />
                  </div>

                  <span className="relative z-10 text-[11px] font-bold text-white leading-tight drop-shadow-md truncate">
                    {story.author.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* POST COMPOSER */}
          <div className="rounded-3xl bg-[#0f1422] border border-white/10 p-4 shadow-xl">
            <div className="flex items-center gap-3">
              <img
                src={currentUser?.avatar || DEFAULT_AVATAR}
                alt={currentUser?.name || 'Guest'}
                className="w-10 h-10 rounded-full object-cover border border-emerald-500/40"
              />
              <button
                onClick={() => handleOpenCreatePost('text')}
                className="flex-1 text-left px-4 py-2.5 rounded-2xl bg-[#141b2e] hover:bg-[#1a233b] border border-white/5 text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                What&apos;s on your mind, {(currentUser?.name || 'Friend').split(' ')[0]}?
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-around text-xs font-semibold text-slate-300">
              <button
                onClick={() => handleOpenCreatePost('photo')}
                className="flex items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 text-emerald-400 transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Photo</span>
              </button>

              <button
                onClick={() => handleOpenCreatePost('video')}
                className="flex items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 text-red-400 transition-colors"
              >
                <VideoIcon className="w-4 h-4" />
                <span>Video</span>
              </button>

              <button
                onClick={() => setEditorStudioOpen(true)}
                className="flex items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 text-teal-400 transition-colors"
                title="Open Video Studio"
              >
                <Sliders className="w-4 h-4" />
                <span>Studio</span>
              </button>

              <button
                onClick={() => handleOpenCreatePost('text')}
                className="flex items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 text-amber-400 transition-colors"
              >
                <Smile className="w-4 h-4" />
                <span>Post</span>
              </button>
            </div>
          </div>

          {/* STREAM FILTER PILLS & REFRESH BAR */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: 'all', label: 'All Feed' },
                { id: 'motherland', label: '🇧🇩 MOTHERLAND' },
                { id: 'youtube', label: '▶ YouTube' },
                { id: 'videos', label: '🎬 Videos' },
                { id: 'photos', label: '📷 Photos' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFeedFilter(tab.id as FeedFilter)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    feedFilter === tab.id
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                      : 'bg-[#111726] text-slate-400 hover:text-slate-200 border border-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => loadMixedFeed(true)}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-emerald-400 transition-colors flex-shrink-0"
              title="Refresh feed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>

          {/* MULTI-PLATFORM UNIFIED POST FEED */}
          <div className="space-y-4 pt-1">
            {filteredPosts.map((post) => (
              <SocialPostCard
                key={post.id}
                post={post}
                onOpenImageLightbox={handleOpenLightbox}
                onDeletePost={handleDeletePost}
              />
            ))}

            {/* Bottom Sentinel for Infinite Scroll */}
            <div ref={sentinelRef} className="py-6 flex items-center justify-center">
              {isLoadingMore && (
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <span>Loading continuous discovery...</span>
                </div>
              )}
              {!hasMore && (
                <p className="text-xs text-slate-500 font-mono">
                  ✓ You are caught up with the latest posts.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Friends Tab — Dynamic Friend Requests & Suggestions (Strict Requirement 5) */}
      {socialTab === 'friends' && (
        <div className="p-5 rounded-3xl bg-[#0f1422] border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-white">Friend Suggestions</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                People you may know on MOTHERLAND based on genuine active members
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-mono font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              {currentUser?.friendsCount || 0} Friends
            </span>
          </div>

          {loadingSuggestions ? (
            <div className="py-8 flex flex-col items-center justify-center text-xs text-slate-400 space-y-2">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <span>Checking community network...</span>
            </div>
          ) : friendSuggestions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <Users className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-300">No suggestions yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                As more genuine citizens create accounts on MOTHERLAND, dynamic friend suggestions will appear here according to privacy rules.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {friendSuggestions.map((sugUser) => {
                const isRequested = sentRequestUserIds.has(sugUser.id);
                return (
                  <div key={sugUser.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={sugUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80'}
                        alt={sugUser.name}
                        className="w-10 h-10 rounded-full object-cover border border-emerald-500/30"
                      />
                      <div>
                        <div className="flex items-center gap-1 font-bold text-white text-xs sm:text-sm">
                          <span>{sugUser.name}</span>
                          {sugUser.isOwner && (
                            <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-mono border border-amber-500/30">
                              Founder
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          {sugUser.bio || `@${sugUser.username}`}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleFriendRequest(sugUser.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                        isRequested
                          ? 'bg-white/10 hover:bg-white/15 text-slate-300 border border-white/10'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      }`}
                    >
                      {isRequested ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Marketplace Tab */}
      {socialTab === 'marketplace' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-[#0f1422] border border-white/10 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-white">MOTHERLAND Marketplace</h3>
              <p className="text-xs text-slate-400">Authentic local handlooms, artisanal crafts, and electronics</p>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              🇧🇩 Bangladesh Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {INITIAL_MARKETPLACE_ITEMS.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl bg-[#0d1322] border border-white/10 overflow-hidden shadow-lg flex flex-col justify-between"
              >
                <div className="aspect-[4/3] bg-black overflow-hidden relative">
                  <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-xs text-xs font-bold text-emerald-400 font-mono">
                    {item.price}
                  </span>
                </div>
                <div className="p-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">{item.title}</h4>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      <span>{item.location}</span>
                    </span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                    <span>Seller: {item.seller.name}</span>
                    <button className="px-3 py-1 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold text-xs">
                      Contact
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {socialTab === 'notifications' && (
        <div className="p-5 rounded-3xl bg-[#0f1422] border border-white/10 space-y-3">
          <h3 className="font-bold text-base text-white mb-2">Notifications &amp; Activity</h3>
          {tabNotifications.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              {currentUser
                ? 'No new notifications right now. Real activity from your connections will appear here.'
                : 'Sign in to view your personalized notifications.'}
            </p>
          ) : (
            <div className="space-y-2">
              {tabNotifications.map((n) => (
                <div
                  key={n.id}
                  className="p-3 rounded-2xl bg-[#141b2c] border border-white/5 text-xs flex items-center justify-between"
                >
                  <span className="text-slate-200">{n.message || n.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono ml-2">
                    {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menu / Settings Tab */}
      {socialTab === 'menu' && (
        <div className="p-5 rounded-3xl bg-[#0f1422] border border-white/10 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-white/5">
            <img
              src={currentUser?.avatar || DEFAULT_AVATAR}
              alt={currentUser?.name || 'Guest'}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <h4 className="font-bold text-white text-base">{currentUser?.name || 'Guest Visitor'}</h4>
              <span className="text-xs text-slate-400 font-mono">{currentUser?.handle || '@guest'}</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <button
              onClick={() => onOpenUserProfile && onOpenUserProfile()}
              className="w-full p-3 rounded-xl bg-[#141b2c] hover:bg-[#1a233b] text-left text-white font-semibold transition-colors flex items-center justify-between"
            >
              <span>View & Edit Full Profile</span>
              <span>→</span>
            </button>
            <div className="p-3 rounded-xl bg-[#141b2c] text-slate-400 leading-relaxed text-[11px]">
              MOTHERLAND Social Network operates with real multi-platform feed integration and client-side privacy.
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreatePostModal
        isOpen={createPostOpen}
        onClose={() => setCreatePostOpen(false)}
        onPostCreated={handlePostCreated}
        initialType={createPostType}
      />

      <CreateStoryModal
        isOpen={createStoryOpen}
        onClose={() => setCreateStoryOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      <StoryViewerModal
        isOpen={storyViewerOpen}
        stories={stories}
        initialIndex={selectedStoryIndex}
        onClose={() => setStoryViewerOpen(false)}
        onDeleteStory={handleDeleteStory}
      />

      <ImageLightboxModal
        imageUrl={lightboxImage}
        altText={lightboxAlt}
        onClose={() => setLightboxImage(null)}
      />

      <VideoEditorStudio
        isOpen={editorStudioOpen}
        onClose={() => setEditorStudioOpen(false)}
        onSaveExport={(data) => {
          // Create a new post with the edited video
          const newPost: SocialPost = {
            id: `post_studio_${Date.now()}`,
            author: {
              id: currentUser?.id || 'guest',
              name: currentUser?.name || 'MOTHERLAND Creator',
              handle: currentUser?.handle || '@creator',
              avatar: currentUser?.avatar || DEFAULT_AVATAR,
              isVerified: currentUser?.isVerified,
              platform: 'motherland',
            },
            content: data.textOverlay || 'Created with MOTHERLAND Video Studio 🇧🇩',
            media: [
              {
                id: `media_${Date.now()}`,
                type: 'video',
                url: data.videoUrl,
                aspectRatio: data.aspectRatio as any,
              },
            ],
            createdAt: 'Just now',
            likesCount: 0,
            commentsCount: 0,
            sharesCount: 0,
            isLiked: false,
            isSaved: false,
            privacy: 'public',
            platform: 'motherland',
            reactions: { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0, cool: 0 },
            userReaction: null,
          };
          handlePostCreated(newPost);
        }}
      />
    </div>
  );
};
