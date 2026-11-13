/**
 * MOTHERLAND Native Social Service & Database Persistence
 * - Multi-user authentication & persistent session management
 * - Individual accounts: unique IDs, custom profile pictures, cover photos
 * - Real friend requests & dynamic suggestions based on registered user count
 * - Real notifications system with unread counts & categories
 * - Strict 24-hour stories with automatic expiration
 * - Universal search across YouTube, MOTHERLAND posts, videos, and profiles
 * - Zero fake likes, comments, shares, or followers (strictly database-tracked)
 */

import {
  CurrentUserProfile,
  MarketplaceItem,
  SocialComment,
  SocialCommentReply,
  SocialPost,
  SocialStory,
  PostReactionType,
  MotherlandNotification,
  UserRelationship,
} from '../types/social';

const AUTH_TOKEN_KEY = 'mth_auth_token_v5';
const CURRENT_USER_KEY = 'mth_authenticated_user_v5';
const POSTS_STORAGE_KEY = 'motherland_native_posts_v5';
const WATCH_HISTORY_KEY = 'motherland_watch_history_v5';

// --- Authentication & Session Management ---
export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredCurrentUser(): CurrentUserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: CurrentUserProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

export async function registerMotherlandUser(params: {
  name: string;
  username: string;
  email: string;
  password?: string;
  dob: string;
  phone?: string;
  gender?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatar?: string;
  coverPhoto?: string;
}): Promise<{ user: CurrentUserProfile; token: string }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Registration failed.');
  }

  setStoredAuth(data.token, data.user);
  return { user: data.user, token: data.token };
}

export async function loginMotherlandUser(identifier: string, password: string): Promise<{ user: CurrentUserProfile; token: string }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Login failed.');
  }

  setStoredAuth(data.token, data.user);
  return { user: data.user, token: data.token };
}

export async function logoutMotherlandUser(): Promise<void> {
  const token = getStoredAuthToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
  }
  clearStoredAuth();
}

export async function fetchMe(): Promise<CurrentUserProfile | null> {
  const token = getStoredAuthToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        setStoredAuth(token, data.user);
        return data.user;
      }
    }
  } catch (err) {
    console.warn('[SocialService] fetchMe error:', err);
  }
  return getStoredCurrentUser();
}

export async function updateUserProfile(userId: string, updates: Partial<CurrentUserProfile>): Promise<CurrentUserProfile> {
  const token = getStoredAuthToken();
  const res = await fetch(`/api/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update profile.');

  const currentUser = getStoredCurrentUser();
  if (currentUser && currentUser.id === userId) {
    setStoredAuth(token || '', data.user);
  }
  return data.user;
}

export async function claimMotherlandOwnerRole(adminSecret: string): Promise<CurrentUserProfile> {
  const token = getStoredAuthToken();
  const res = await fetch('/api/auth/claim-owner', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ adminSecret }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to claim Owner role.');

  const currentUser = getStoredCurrentUser();
  if (currentUser) {
    setStoredAuth(token || '', data.user);
  }
  return data.user;
}

// --- Watch History / Recently Watched Filtering (Requirement 3) ---
export function getWatchHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordVideoWatched(videoId: string): void {
  if (typeof window === 'undefined' || !videoId) return;
  try {
    const current = getWatchHistory().filter((id) => id !== videoId);
    // Add to front, keep last 200 items
    const updated = [videoId, ...current].slice(0, 200);
    localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(updated));

    // Also record view on backend
    fetch(`/api/posts/${videoId}/view`, { method: 'POST' }).catch(() => {});
  } catch (e) {
    console.warn('Record video watch history error:', e);
  }
}

// --- Posts Persistence & Synchronization ---
export function getStoredPosts(): SocialPost[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(POSTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredPosts(posts: SocialPost[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(posts));
  } catch (e) {
    console.error('Failed saving posts:', e);
  }
}

export async function syncPostsFromBackend(platform?: string): Promise<SocialPost[]> {
  try {
    const url = platform && platform !== 'all' ? `/api/posts?platform=${platform}` : '/api/posts';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.posts)) {
        const currentUser = getStoredCurrentUser();
        const currentUserId = currentUser?.id || '';

        const mapped: SocialPost[] = data.posts.map((sp: any) => {
          const userLiked = Array.isArray(sp.likes) && sp.likes.includes(currentUserId);
          let userReaction: PostReactionType | null = null;
          if (sp.reactions && currentUserId) {
            for (const [rType, uIds] of Object.entries(sp.reactions)) {
              if (Array.isArray(uIds) && uIds.includes(currentUserId)) {
                userReaction = rType as PostReactionType;
                break;
              }
            }
          }

          const reactionsMap: Record<PostReactionType, number> = {
            like: sp.reactions?.like?.length || 0,
            love: sp.reactions?.love?.length || 0,
            care: sp.reactions?.care?.length || 0,
            haha: sp.reactions?.haha?.length || 0,
            wow: sp.reactions?.wow?.length || 0,
            sad: sp.reactions?.sad?.length || 0,
            angry: sp.reactions?.angry?.length || 0,
            cool: sp.reactions?.cool?.length || 0,
          };

          return {
            id: sp.id,
            author: sp.author,
            content: sp.content,
            media: sp.media || [],
            createdAt: sp.createdAt,
            likesCount: sp.likes?.length || 0,
            commentsCount: sp.commentsCount || 0,
            sharesCount: sp.sharesCount || 0,
            isLiked: userLiked,
            isSaved: false,
            privacy: sp.privacy,
            location: sp.location,
            tags: sp.tags,
            isOwnPost: currentUserId ? sp.authorId === currentUserId || sp.author.id === currentUserId : false,
            platform: sp.platform,
            userReaction,
            reactions: reactionsMap,
            youtubeVideoId: sp.youtubeVideoId,
            originalVideoUrl: sp.originalVideoUrl,
          };
        });

        saveStoredPosts(mapped);
        return mapped;
      }
    }
  } catch (err) {
    console.warn('[SocialService] Backend sync warning, using local posts:', err);
  }
  return getStoredPosts();
}

export async function createNewPost(
  content: string,
  media: SocialPost['media'] = [],
  privacy: SocialPost['privacy'] = 'public',
  location?: string,
  isShort?: boolean
): Promise<SocialPost> {
  const token = getStoredAuthToken();
  const author = getStoredCurrentUser();

  if (!author || !token) {
    throw new Error('Please sign in to publish your post.');
  }

  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      content,
      media,
      privacy,
      location,
      platform: 'motherland',
      isShort,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save post to server.');
  }

  const sp = data.post;
  const newSocialPost: SocialPost = {
    id: sp.id,
    author: sp.author,
    content: sp.content,
    media: sp.media || [],
    createdAt: 'Just now',
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    isLiked: false,
    isSaved: false,
    privacy: sp.privacy,
    location: sp.location,
    tags: sp.tags,
    isOwnPost: true,
    platform: 'motherland',
    userReaction: null,
    reactions: { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0, cool: 0 },
  };

  const current = getStoredPosts();
  saveStoredPosts([newSocialPost, ...current]);
  return newSocialPost;
}

export async function deletePost(postId: string): Promise<boolean> {
  const token = getStoredAuthToken();
  const author = getStoredCurrentUser();
  if (!token || !author) return false;

  try {
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: author.id }),
    });

    if (res.ok) {
      const current = getStoredPosts();
      saveStoredPosts(current.filter((p) => p.id !== postId));
      return true;
    }
  } catch (err) {
    console.error('Delete post error:', err);
  }
  return false;
}

// --- Reactions & Interactions (One reaction per user!) ---
export async function reactToPost(
  postId: string,
  reaction: PostReactionType | null
): Promise<{ success: boolean; post?: any }> {
  const token = getStoredAuthToken();
  const author = getStoredCurrentUser();
  if (!author || !token) {
    throw new Error('Please sign in to react to posts.');
  }

  const res = await fetch(`/api/posts/${postId}/react`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId: author.id, reaction }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to record reaction.');
  }

  const data = await res.json();
  return data;
}

export async function trackPostShare(postId: string): Promise<void> {
  try {
    await fetch(`/api/posts/${postId}/share`, { method: 'POST' });
  } catch {
    // ignore
  }
}

// --- Comments & Replies ---
export async function fetchCommentsFromBackend(postId: string): Promise<SocialComment[]> {
  try {
    const res = await fetch(`/api/posts/${postId}/comments`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.comments)) {
        const currentUser = getStoredCurrentUser();
        const currentUserId = currentUser?.id || '';

        return data.comments.map((c: any) => ({
          id: c.id,
          postId: c.postId,
          author: c.author,
          text: c.text,
          createdAt: c.createdAt,
          likesCount: c.likes?.length || 0,
          isLiked: Array.isArray(c.likes) && c.likes.includes(currentUserId),
          replies: (c.replies || []).map((r: any) => ({
            id: r.id,
            commentId: r.commentId,
            author: r.author,
            text: r.text,
            createdAt: r.createdAt,
            likesCount: r.likes?.length || 0,
            isLiked: Array.isArray(r.likes) && r.likes.includes(currentUserId),
          })),
        }));
      }
    }
  } catch (err) {
    console.warn('[SocialService] Comments fetch warning:', err);
  }
  return [];
}

export async function addPostComment(postId: string, text: string): Promise<SocialComment> {
  const token = getStoredAuthToken();
  const author = getStoredCurrentUser();
  if (!author || !token) {
    throw new Error('Please sign in to comment.');
  }

  const res = await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      author: {
        id: author.id,
        name: author.name,
        handle: author.handle,
        avatar: author.avatar,
        isVerified: author.isVerified,
        role: author.role,
        platform: 'motherland',
      },
      text,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to add comment.');

  const c = data.comment;
  return {
    id: c.id,
    postId: c.postId,
    author: c.author,
    text: c.text,
    createdAt: 'Just now',
    likesCount: 0,
    isLiked: false,
    replies: [],
  };
}

export async function addCommentReply(postId: string, commentId: string, text: string): Promise<SocialCommentReply> {
  const token = getStoredAuthToken();
  const author = getStoredCurrentUser();
  if (!author || !token) throw new Error('Please sign in to reply.');

  const res = await fetch(`/api/posts/${postId}/comments/${commentId}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      author: {
        id: author.id,
        name: author.name,
        handle: author.handle,
        avatar: author.avatar,
        isVerified: author.isVerified,
        role: author.role,
        platform: 'motherland',
      },
      text,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to reply.');

  const r = data.reply;
  return {
    id: r.id,
    commentId: r.commentId,
    author: r.author,
    text: r.text,
    createdAt: 'Just now',
    likesCount: 0,
    isLiked: false,
  };
}

// --- Dynamic Friend Suggestions & Requests (Section 5) ---
export async function fetchFriendSuggestions(): Promise<any[]> {
  const token = getStoredAuthToken();
  try {
    const res = await fetch('/api/users/suggestions', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json();
      return data.suggestions || [];
    }
  } catch (err) {
    console.warn('Suggestions error:', err);
  }
  return [];
}

export async function sendFriendRequest(toUserId: string): Promise<{ success: boolean; status: string }> {
  const token = getStoredAuthToken();
  if (!token) throw new Error('Please sign in to send friend requests.');

  const res = await fetch('/api/friends/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ toUserId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to send friend request.');
  return data;
}

export async function acceptFriendRequest(fromUserId: string): Promise<{ success: boolean; status: string }> {
  const token = getStoredAuthToken();
  if (!token) throw new Error('Please sign in.');

  const res = await fetch('/api/friends/accept', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fromUserId }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to accept friend request.');
  return data;
}

export async function rejectFriendRequest(fromUserId: string): Promise<boolean> {
  const token = getStoredAuthToken();
  if (!token) return false;

  const res = await fetch('/api/friends/reject', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fromUserId }),
  });
  return res.ok;
}

export async function toggleUserFollow(targetUserId: string): Promise<{ isFollowing: boolean; followersCount: number }> {
  const token = getStoredAuthToken();
  const author = getStoredCurrentUser();
  if (!author || !token) throw new Error('Please sign in to follow.');

  try {
    const res = await fetch(`/api/users/${targetUserId}/follow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ followerId: author.id }),
    });
    if (res.ok) {
      const data = await res.json();
      return { isFollowing: data.isFollowing, followersCount: data.followersCount };
    }
  } catch (e) {
    console.warn('Follow sync error:', e);
  }
  return { isFollowing: false, followersCount: 0 };
}

// --- Notifications (Section 8 & 10) ---
export async function fetchNotifications(category?: string): Promise<{ notifications: MotherlandNotification[]; unreadCount: number }> {
  const token = getStoredAuthToken();
  if (!token) return { notifications: [], unreadCount: 0 };

  try {
    const url = category && category !== 'all' ? `/api/notifications?category=${category}` : '/api/notifications';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Notifications fetch error:', err);
  }
  return { notifications: [], unreadCount: 0 };
}

export async function markNotificationRead(notifId: string): Promise<boolean> {
  const token = getStoredAuthToken();
  if (!token) return false;
  const res = await fetch(`/api/notifications/${notifId}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function markAllNotificationsRead(): Promise<boolean> {
  const token = getStoredAuthToken();
  if (!token) return false;
  const res = await fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

export async function deleteNotification(notifId: string): Promise<boolean> {
  const token = getStoredAuthToken();
  if (!token) return false;
  const res = await fetch(`/api/notifications/${notifId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

// --- Stories (Section 14 — Strict 24-Hour Expiration) ---
export async function fetchActiveStories(): Promise<SocialStory[]> {
  try {
    const res = await fetch('/api/stories');
    if (res.ok) {
      const data = await res.json();
      const currentUser = getStoredCurrentUser();
      const currentUserId = currentUser?.id || '';

      if (Array.isArray(data.stories)) {
        return data.stories.map((s: any) => ({
          id: s.id,
          author: s.author,
          mediaUrl: s.mediaUrl,
          mediaType: s.mediaType,
          caption: s.caption,
          createdAt: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          expiresAt: 'In 24h',
          seen: Array.isArray(s.views) && s.views.includes(currentUserId),
          isOwnStory: currentUserId ? s.authorId === currentUserId || s.author.id === currentUserId : false,
        }));
      }
    }
  } catch (err) {
    console.warn('Stories fetch warning:', err);
  }
  return [];
}

export async function publishStory(mediaUrl: string, mediaType: 'photo' | 'video', caption?: string): Promise<SocialStory> {
  const token = getStoredAuthToken();
  const author = getStoredCurrentUser();
  if (!author || !token) throw new Error('Please sign in to publish a story.');

  const res = await fetch('/api/stories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ mediaUrl, mediaType, caption }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to post story.');

  const s = data.story;
  return {
    id: s.id,
    author: s.author,
    mediaUrl: s.mediaUrl,
    mediaType: s.mediaType,
    caption: s.caption,
    createdAt: 'Just now',
    expiresAt: 'In 24h',
    seen: false,
    isOwnStory: true,
  };
}

export async function markStorySeen(storyId: string): Promise<void> {
  const token = getStoredAuthToken();
  if (!token) return;
  fetch(`/api/stories/${storyId}/view`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// --- Universal Search Aggregator & Suggestions (Section 11) ---
export async function universalSearch(query: string): Promise<{
  users: any[];
  posts: any[];
  shorts: any[];
  motherlandVideos: any[];
  youtubeVideos: any[];
}> {
  if (!query || !query.trim()) {
    return { users: [], posts: [], shorts: [], motherlandVideos: [], youtubeVideos: [] };
  }

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Universal search error:', err);
  }
  return { users: [], posts: [], shorts: [], motherlandVideos: [], youtubeVideos: [] };
}

export async function fetchSearchSuggestions(query: string): Promise<string[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query.trim())}`);
    if (res.ok) {
      const data = await res.json();
      return data.suggestions || [];
    }
  } catch {
    // ignore
  }
  return [];
}

// --- Marketplace Catalog ---
export const INITIAL_MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'mkt_1',
    title: 'Handloom Jamdani Saree (Dhakai Traditional)',
    price: '৳8,500',
    location: 'Narayanganj, Dhaka',
    category: 'clothing',
    condition: 'New • Handcrafted',
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
    seller: {
      id: 'seller_1',
      name: 'Narayanganj Weavers Guild',
      handle: '@dhakai_jamdani',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    postedAt: 'Yesterday',
  },
  {
    id: 'mkt_2',
    title: 'Pure Sundarban Wild Honey (1kg Sealed)',
    price: '৳1,200',
    location: 'Khulna',
    category: 'organic',
    condition: 'Fresh Harvest',
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
    seller: {
      id: 'seller_2',
      name: 'Sundarbans Natural Cooperative',
      handle: '@sundarban_honey',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    postedAt: '2 days ago',
  },
];

// --- Stored Stories Helpers ---
export function getStoredStories(): SocialStory[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('motherland_stored_stories_v5');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveStoredStories(stories: SocialStory[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('motherland_stored_stories_v5', JSON.stringify(stories));
}

export async function createNewStory(params: { mediaUrl: string; caption?: string; type?: 'photo' | 'video' }): Promise<SocialStory> {
  return await publishStory(params.mediaUrl, params.type || 'photo', params.caption);
}

// --- Friend Request Aliases ---
export const sendFriendRequestApi = sendFriendRequest;

export async function cancelFriendRequestApi(userId: string): Promise<boolean> {
  const token = getStoredAuthToken();
  if (!token) return false;
  const res = await fetch('/api/friends/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ toUserId: userId }),
  });
  return res.ok;
}

// --- User Profile & Owner Claiming ---
export async function updateUserProfileApi(userId: string, updates: Partial<CurrentUserProfile>): Promise<CurrentUserProfile> {
  const token = getStoredAuthToken();
  const res = await fetch(`/api/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to update profile');
  setStoredAuth(token || '', data.user);
  return data.user;
}

export async function claimOwnerApi(passkey: string): Promise<{ success: boolean; message: string; user?: CurrentUserProfile }> {
  const token = getStoredAuthToken();
  const res = await fetch('/api/auth/claim-owner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ adminSecret: passkey }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Claim failed');
  if (data.user && token) {
    setStoredAuth(token, data.user);
  }
  return data;
}

export async function logoutUser(): Promise<void> {
  const token = getStoredAuthToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  }
  clearStoredAuth();
}

export async function uploadMediaFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64, filename: file.name }),
        });
        if (res.ok) {
          const data = await res.json();
          resolve(data.url);
        } else {
          resolve(base64);
        }
      } catch (err) {
        resolve(reader.result as string);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const saveStoredCurrentUser = (user: CurrentUserProfile) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
};

export const saveCurrentUser = saveStoredCurrentUser;

// --- Post & Comment Handlers (SocialPostCard) ---
export function getPostComments(postId: string): SocialComment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`comments_${postId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePostComments(postId: string, comments: SocialComment[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`comments_${postId}`, JSON.stringify(comments));
}

export function editComment(postId: string, commentId: string, text: string, replyId?: string): void {
  const comments = getPostComments(postId);
  const updated = comments.map((c) => {
    if (replyId && c.id === commentId && c.replies) {
      return {
        ...c,
        replies: c.replies.map((r) => (r.id === replyId ? { ...r, text } : r)),
      };
    }
    if (c.id === commentId) {
      return { ...c, text };
    }
    return c;
  });
  savePostComments(postId, updated);
}

export function deleteComment(postId: string, commentId: string, replyId?: string): void {
  const comments = getPostComments(postId);
  let updated: SocialComment[];
  if (replyId) {
    updated = comments.map((c) =>
      c.id === commentId
        ? { ...c, replies: (c.replies || []).filter((r) => r.id !== replyId) }
        : c
    );
  } else {
    updated = comments.filter((c) => c.id !== commentId);
  }
  savePostComments(postId, updated);
}

export function toggleCommentLike(postId: string, commentId: string, replyId?: string): void {
  const comments = getPostComments(postId);
  const updated = comments.map((c) => {
    if (replyId && c.id === commentId && c.replies) {
      return {
        ...c,
        replies: c.replies.map((r) =>
          r.id === replyId
            ? { ...r, isLiked: !r.isLiked, likesCount: r.isLiked ? Math.max(0, r.likesCount - 1) : r.likesCount + 1 }
            : r
        ),
      };
    }
    if (c.id === commentId) {
      return {
        ...c,
        isLiked: !c.isLiked,
        likesCount: c.isLiked ? Math.max(0, c.likesCount - 1) : c.likesCount + 1,
      };
    }
    return c;
  });
  savePostComments(postId, updated);
}

export function setPostReaction(postId: string, reaction: PostReactionType): SocialPost | null {
  const token = getStoredAuthToken();
  const currentUser = getStoredCurrentUser();
  if (token && currentUser?.id) {
    fetch(`/api/posts/${postId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: currentUser.id, reaction }),
    }).catch(() => {});
  }
  const posts = getStoredPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return null;
  const currentReaction = post.userReaction;
  const rx: Record<PostReactionType, number> = {
    like: 0,
    love: 0,
    care: 0,
    haha: 0,
    wow: 0,
    sad: 0,
    angry: 0,
    cool: 0,
    ...(post.reactions || {}),
  };
  if (currentReaction) {
    rx[currentReaction] = Math.max(0, (rx[currentReaction] || 1) - 1);
  }
  rx[reaction] = (rx[reaction] || 0) + 1;
  const total = Object.values(rx).reduce((a, b) => a + b, 0);
  const updated: SocialPost = {
    ...post,
    userReaction: reaction,
    reactions: rx,
    likesCount: total,
    isLiked: true,
  };
  saveStoredPosts(posts.map((p) => (p.id === postId ? updated : p)));
  return updated;
}

export function togglePostLike(postId: string): SocialPost | null {
  const posts = getStoredPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return null;
  if (post.userReaction) {
    const token = getStoredAuthToken();
    const currentUser = getStoredCurrentUser();
    if (token && currentUser?.id) {
      fetch(`/api/posts/${postId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: currentUser.id, reaction: null }),
      }).catch(() => {});
    }
    const rx: Record<PostReactionType, number> = {
      like: 0,
      love: 0,
      care: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      cool: 0,
      ...(post.reactions || {}),
    };
    rx[post.userReaction] = Math.max(0, (rx[post.userReaction] || 1) - 1);
    const total = Object.values(rx).reduce((a, b) => a + b, 0);
    const updated: SocialPost = { ...post, userReaction: null, reactions: rx, likesCount: total, isLiked: false };
    saveStoredPosts(posts.map((p) => (p.id === postId ? updated : p)));
    return updated;
  }
  return setPostReaction(postId, 'like');
}

export function togglePostSave(postId: string): SocialPost | null {
  const posts = getStoredPosts();
  const post = posts.find((p) => p.id === postId);
  if (!post) return null;
  const updated: SocialPost = { ...post, isSaved: !post.isSaved };
  saveStoredPosts(posts.map((p) => (p.id === postId ? updated : p)));
  return updated;
}
