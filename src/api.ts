/**
 * MOTHERLAND Super App - API Client Service
 */

import type {
  UserProfile,
  Post,
  Story,
  ShortVideo,
  LongVideo,
  YouTubeCommentThread,
  YouTubeOAuthStatus,
  YouTubeUploadResult,
  Conversation,
  ChatMessage,
  FriendRequest,
  NotificationItem,
  PlatformAdapterInfo,
  PublishingJob,
  RegisterPayload,
  LoginPayload,
  AuthResult,
  CallRecord,
  DraftPost,
  SavedVideoItem,
  WatchHistoryRecord,
  ChatAttachment,
  ChatReplySnapshot,
  UserPrivacySettings,
  NotificationPreferences,
  DeviceSessionInfo,
} from './types';
import { getSuppressedIdsHeaderValue } from './services/watchSuppression';

const API_BASE = '/api';
const TOKEN_KEY = 'motherland_auth_token';
const SAVED_ACCOUNTS_KEY = 'motherland_saved_accounts';
const GOOGLE_AUTH_STORAGE_KEY = 'motherland_google_youtube_auth_v3';

export interface SavedAccountItem {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  role?: string;
  token: string;
}

export function getStoredAuthToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredAuthToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Storage error:', err);
  }
}

export function getSavedAccounts(): SavedAccountItem[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAccount(user: UserProfile, token: string): void {
  try {
    const accounts = getSavedAccounts().filter((a) => a.id !== user.id);
    accounts.unshift({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      role: user.role,
      token,
    });
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, 5)));
  } catch (err) {
    console.error('Storage error:', err);
  }
}

export function removeSavedAccount(userId: string): void {
  try {
    const accounts = getSavedAccounts().filter((a) => a.id !== userId);
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error('Storage error:', err);
  }
}

function getStoredGoogleAccessToken(): string {
  try {
    const raw = localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (parsed?.accessToken && (!parsed.expiresAt || Number(parsed.expiresAt) > Date.now())) {
      return String(parsed.accessToken);
    }
    return '';
  } catch {
    return '';
  }
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const googleToken = getStoredGoogleAccessToken();
  if (googleToken && !headers.has('x-google-access-token')) {
    headers.set('x-google-access-token', googleToken);
  }
  if (
    url.includes('/posts') ||
    url.includes('/videos/') ||
    url.includes('/youtube/feed')
  ) {
    const suppressedHeader = getSuppressedIdsHeaderValue();
    if (suppressedHeader) {
      headers.set('x-suppressed-ids', suppressedHeader);
    }
  }
  return fetch(url, {
    credentials: options.credentials || 'same-origin',
    ...options,
    headers,
  });
}

async function parseJsonOrThrow<T = any>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Request failed (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  // Token & Saved Accounts Helpers
  getToken: getStoredAuthToken,
  setToken: setStoredAuthToken,
  getSavedAccounts,
  saveAccount,
  removeSavedAccount,

  // Health & Status
  async getHealth() {
    const res = await authFetch(`${API_BASE}/health`);
    return res.json();
  },

  async getStatus() {
    const res = await authFetch(`${API_BASE}/status`);
    return res.json();
  },

  // YouTube API Integration
  async getYouTubeStatus() {
    const res = await authFetch(`${API_BASE}/youtube/status`);
    return res.json();
  },

  async setYouTubeKey(apiKey: string) {
    const res = await authFetch(`${API_BASE}/youtube/set-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    return parseJsonOrThrow(res);
  },

  async searchYouTube(query: string, pageToken = '', maxResults = 15, videoDuration = '') {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(maxResults),
    });
    if (pageToken) params.set('pageToken', pageToken);
    if (videoDuration) params.set('videoDuration', videoDuration);

    const res = await authFetch(`${API_BASE}/youtube/search?${params.toString()}`);
    return res.json();
  },

  async getYouTubeVideos(ids: string) {
    const res = await authFetch(`${API_BASE}/youtube/videos?ids=${encodeURIComponent(ids)}`);
    return res.json();
  },

  async getYouTubeFeed(options: {
    type?: 'long' | 'shorts';
    category?: string;
    pageToken?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{
    items: any[];
    nextPageToken: string | null;
    page: number;
    hasMore: boolean;
    category: string;
    type: string;
    quotaExceeded?: boolean;
    exhaustedReason?: string;
  }> {
    const params = new URLSearchParams();
    if (options.type) params.set('type', options.type);
    if (options.category) params.set('category', options.category);
    if (options.pageToken) params.set('pageToken', options.pageToken);
    if (options.page) params.set('page', String(options.page));
    if (options.pageSize) params.set('pageSize', String(options.pageSize));

    const res = await authFetch(`${API_BASE}/youtube/feed?${params.toString()}`);
    return res.json();
  },

  async getYouTubeComments(videoId: string, pageToken = '', order = 'relevance'): Promise<{
    commentsDisabled: boolean;
    message?: string;
    items: YouTubeCommentThread[];
    nextPageToken?: string | null;
  }> {
    const params = new URLSearchParams({ videoId, order });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await authFetch(`${API_BASE}/youtube/comments?${params.toString()}`);
    return res.json();
  },

  async getYouTubeLive(pageToken = '', q = ''): Promise<{
    items: LongVideo[];
    nextPageToken?: string | null;
    requiresApiKey?: boolean;
    error?: string;
    message?: string;
  }> {
    const params = new URLSearchParams();
    if (pageToken) params.set('pageToken', pageToken);
    if (q) params.set('q', q);
    const qs = params.toString();
    const res = await authFetch(`${API_BASE}/youtube/live${qs ? `?${qs}` : ''}`);
    return res.json();
  },

  // Official YouTube OAuth 2.0 + Direct Upload
  async getYouTubeOAuthStatus(): Promise<YouTubeOAuthStatus> {
    const res = await authFetch(`${API_BASE}/youtube/oauth/status`);
    return res.json();
  },

  async getYouTubeOAuthUrl(): Promise<{
    authUrl?: string;
    callbackUrl?: string;
    error?: string;
    message?: string;
    missingEnvVars?: string[];
  }> {
    const res = await authFetch(`${API_BASE}/youtube/oauth/url`);
    return res.json();
  },

  async disconnectYouTubeOAuth(): Promise<{ success: boolean; connected: boolean }> {
    const res = await authFetch(`${API_BASE}/youtube/oauth/disconnect`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  },

  async getMyYouTubeVideos(): Promise<{
    hasChannel?: boolean;
    channel?: any;
    videos: any[];
    error?: string;
    message?: string;
  }> {
    const res = await authFetch(`${API_BASE}/youtube/my-videos`);
    return parseJsonOrThrow(res);
  },

  async updateMyYouTubeVideo(
    videoId: string,
    payload: { title?: string; description?: string; privacyStatus?: 'public' | 'unlisted' | 'private'; tags?: string[] }
  ): Promise<{ success: boolean; video: any }> {
    const res = await authFetch(`${API_BASE}/youtube/my-videos/${encodeURIComponent(videoId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
  },

  async deleteMyYouTubeVideo(videoId: string): Promise<{ success: boolean; videoId: string }> {
    const res = await authFetch(`${API_BASE}/youtube/my-videos/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
    });
    return parseJsonOrThrow(res);
  },

  async uploadVideoToYouTube(params: {
    file: File;
    thumbnailFile?: File | null;
    title: string;
    description: string;
    privacyStatus: 'public' | 'unlisted' | 'private';
    madeForKids: boolean;
    categoryId?: string;
    tags?: string[];
    onProgress?: (percent: number) => void;
  }): Promise<YouTubeUploadResult> {
    let thumbnailBase64: string | undefined;
    let thumbnailMimeType: string | undefined;

    if (params.thumbnailFile) {
      thumbnailMimeType = params.thumbnailFile.type || 'image/jpeg';
      thumbnailBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read thumbnail image'));
        reader.readAsDataURL(params.thumbnailFile as File);
      });
    }

    const prepRes = await authFetch(`${API_BASE}/youtube/upload/prepare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: params.title,
        description: params.description,
        privacyStatus: params.privacyStatus,
        madeForKids: params.madeForKids,
        categoryId: params.categoryId || '22',
        tags: params.tags || [],
        mimeType: params.file.type || 'video/mp4',
        fileSize: params.file.size,
        thumbnailBase64,
        thumbnailMimeType,
      }),
    });

    const prepData = await prepRes.json();
    if (!prepRes.ok || !prepData.sessionId) {
      return {
        success: false,
        error: prepData.error || 'YOUTUBE_PREPARE_FAILED',
        message: prepData.message || 'Unable to start YouTube upload.',
      };
    }

    return new Promise<YouTubeUploadResult>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${API_BASE}/youtube/upload/stream/${encodeURIComponent(prepData.sessionId)}`);
      xhr.withCredentials = true;
      const token = getStoredAuthToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const googleToken = getStoredGoogleAccessToken();
      if (googleToken) xhr.setRequestHeader('x-google-access-token', googleToken);
      xhr.setRequestHeader('Content-Type', params.file.type || 'video/mp4');

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && params.onProgress) {
          params.onProgress(Math.min(96, Math.round((evt.loaded / evt.total) * 96)));
        }
      };

      xhr.onload = () => {
        if (params.onProgress) params.onProgress(100);
        try {
          const json = JSON.parse(xhr.responseText || '{}');
          resolve(json);
        } catch {
          resolve({ success: false, error: 'PARSE_ERROR', message: 'Invalid response from upload server.' });
        }
      };

      xhr.onerror = () => {
        resolve({ success: false, error: 'NETWORK_ERROR', message: 'Network error during video upload.' });
      };

      xhr.send(params.file);
    });
  },

  // MOTHERLAND Device Media Upload with Real Progress
  async uploadMediaFile(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{ url: string; filename: string; size: number; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/media/upload`);
      xhr.withCredentials = true;
      const token = getStoredAuthToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.setRequestHeader('x-file-name', encodeURIComponent(file.name));
      xhr.setRequestHeader('x-mime-type', file.type || 'application/octet-stream');

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable && onProgress) {
          onProgress(Math.min(99, Math.round((evt.loaded / evt.total) * 100)));
        }
      };

      xhr.onload = () => {
        if (onProgress) onProgress(100);
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && data.url) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'Media upload failed'));
          }
        } catch {
          reject(new Error('Invalid upload response'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error while uploading file'));
      xhr.send(file);
    });
  },

  // Authentication & Users (Multi-User Sovereign Accounts)
  async register(data: RegisterPayload): Promise<AuthResult> {
    const res = await authFetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await parseJsonOrThrow<AuthResult>(res);
    if (result.token) {
      setStoredAuthToken(result.token);
      if (result.user) {
        saveAccount(result.user, result.token);
      }
    }
    return result;
  },

  async login(data: LoginPayload): Promise<AuthResult> {
    const res = await authFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await parseJsonOrThrow<AuthResult>(res);
    if (result.token) {
      setStoredAuthToken(result.token);
      if (result.user) {
        saveAccount(result.user, result.token);
      }
    }
    return result;
  },

  async logout(): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
    });
    setStoredAuthToken('');
    return res.json().catch(() => ({ success: true }));
  },

  async getCurrentUser(): Promise<{ user: UserProfile | null; isGuest?: boolean; error?: string }> {
    const res = await authFetch(`${API_BASE}/auth/me`);
    if (!res.ok) {
      return { user: null, isGuest: true, error: 'Unauthorized' };
    }
    return res.json();
  },

  async getActiveSessions(): Promise<{ sessions: DeviceSessionInfo[] }> {
    const res = await authFetch(`${API_BASE}/auth/sessions`);
    return parseJsonOrThrow(res);
  },

  async revokeSession(sessionId: string): Promise<{ success: boolean; revokedCurrent?: boolean }> {
    const res = await authFetch(`${API_BASE}/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    const data = await parseJsonOrThrow<{ success: boolean; revokedCurrent?: boolean }>(res);
    if (data.revokedCurrent) {
      setStoredAuthToken('');
    }
    return data;
  },

  async logoutAllDevices(keepCurrent = true): Promise<{ success: boolean; removedCount: number; keptCurrent: boolean }> {
    const res = await authFetch(`${API_BASE}/auth/logout-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keepCurrent }),
    });
    const data = await parseJsonOrThrow<{ success: boolean; removedCount: number; keptCurrent: boolean }>(res);
    if (!keepCurrent) {
      setStoredAuthToken('');
    }
    return data;
  },

  async deleteMyAccount(payload: { password?: string; confirmUsername?: string }): Promise<{ success: boolean; deletedUserId: string }> {
    const res = await authFetch(`${API_BASE}/users/me`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonOrThrow<{ success: boolean; deletedUserId: string }>(res);
    if (data.deletedUserId) {
      removeSavedAccount(data.deletedUserId);
    }
    setStoredAuthToken('');
    return data;
  },

  async sendOtp(identifier: string, type: 'register' | 'phone_verify' | 'forgot_password'): Promise<{ success: boolean; message: string; debugOtp?: string }> {
    const res = await authFetch(`${API_BASE}/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, type }),
    });
    return parseJsonOrThrow(res);
  },

  async verifyOtp(identifier: string, code: string, type: 'register' | 'phone_verify' | 'forgot_password'): Promise<{ success: boolean; message: string }> {
    const res = await authFetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, code, type }),
    });
    return parseJsonOrThrow(res);
  },

  async forgotPassword(identifier: string): Promise<{ success: boolean; message: string; debugOtp?: string }> {
    const res = await authFetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier }),
    });
    return parseJsonOrThrow(res);
  },

  async resetPassword(data: { identifier: string; code: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    const res = await authFetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(res);
  },

  async claimOwner(secret?: string): Promise<{ success: boolean; user?: UserProfile; message?: string }> {
    const res = await authFetch(`${API_BASE}/auth/claim-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret }),
    });
    return parseJsonOrThrow(res);
  },

  async updateProfile(profileData: Partial<UserProfile>): Promise<{ success: boolean; user: UserProfile }> {
    const res = await authFetch(`${API_BASE}/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    return parseJsonOrThrow(res);
  },

  async updatePreferences(data: {
    privacy?: Partial<UserPrivacySettings>;
    notificationPrefs?: Partial<NotificationPreferences>;
    dataSaver?: boolean;
  }): Promise<{ success: boolean; user: UserProfile }> {
    const res = await authFetch(`${API_BASE}/users/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(res);
  },

  async reportUser(
    userId: string,
    payload: { reason: string; details?: string; conversationId?: string; messageId?: string }
  ): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
  },

  async getUserById(id: string): Promise<{
    user: UserProfile;
    posts: Post[];
    isFriend: boolean;
    isFollowing: boolean;
    isCurrentUser: boolean;
  }> {
    const res = await authFetch(`${API_BASE}/users/${id}`);
    return parseJsonOrThrow(res);
  },

  async getUserPosts(
    userId: string,
    page = 1,
    pageSize = 12
  ): Promise<{ posts: Post[]; total: number; page: number; hasMore: boolean }> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    const res = await authFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/posts?${params.toString()}`);
    return parseJsonOrThrow(res);
  },

  async searchUsers(query = ''): Promise<{ users: UserProfile[] }> {
    const res = await authFetch(`${API_BASE}/users?q=${encodeURIComponent(query)}`);
    return parseJsonOrThrow(res);
  },

  // Posts & Feed (Unified Feed: Motherland + For You + YouTube)
  async getPosts(
    feedType: string = 'all',
    source = 'all',
    page = 1,
    pageSize = 10
  ): Promise<{ posts: Post[]; total: number; page?: number; hasMore?: boolean }> {
    const params = new URLSearchParams({
      feedType,
      source,
      page: String(page),
      pageSize: String(pageSize),
    });
    const res = await authFetch(`${API_BASE}/posts?${params.toString()}`);
    return res.json();
  },

  async createPost(data: {
    content: string;
    mediaType?: 'image' | 'video' | 'none';
    mediaUrl?: string;
    images?: string[];
    thumbnailUrl?: string;
    mediaAspectRatio?: '1:1' | '4:5' | '16:9' | '9:16';
    hashtags?: string[];
    audience?: 'public' | 'friends' | 'only_me';
    platforms?: string[];
  }): Promise<{ post: Post; publishResults: any[] }> {
    const res = await authFetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(res);
  },

  async sharePost(postId: string, caption?: string): Promise<{ success: boolean; shares: number; post?: Post }> {
    const res = await authFetch(`${API_BASE}/posts/${postId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    });
    return parseJsonOrThrow(res);
  },

  async reactToPost(postId: string, reaction: string): Promise<{ likes: number; userInteractions: any }> {
    const res = await authFetch(`${API_BASE}/posts/${postId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction }),
    });
    return parseJsonOrThrow(res);
  },

  async getPostComments(postId: string) {
    const res = await authFetch(`${API_BASE}/posts/${postId}/comments`);
    return parseJsonOrThrow(res);
  },

  async addPostComment(postId: string, text: string) {
    const res = await authFetch(`${API_BASE}/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return parseJsonOrThrow(res);
  },

  async toggleSavePost(postId: string): Promise<{ isSaved: boolean }> {
    const res = await authFetch(`${API_BASE}/posts/${postId}/save`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  },

  async deletePost(postId: string) {
    const res = await authFetch(`${API_BASE}/posts/${postId}`, {
      method: 'DELETE',
    });
    return parseJsonOrThrow(res);
  },

  // Stories
  async getStories(): Promise<{ stories: Story[] }> {
    const res = await authFetch(`${API_BASE}/stories`);
    return res.json();
  },

  async createStory(data: { mediaUrl: string; mediaType?: 'image' | 'video'; caption?: string }) {
    const res = await authFetch(`${API_BASE}/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(res);
  },

  async markStoryViewed(storyId: string) {
    const res = await authFetch(`${API_BASE}/stories/${storyId}/view`, {
      method: 'POST',
    });
    return res.json();
  },

  async deleteStory(storyId: string) {
    const res = await authFetch(`${API_BASE}/stories/${storyId}`, {
      method: 'DELETE',
    });
    return parseJsonOrThrow(res);
  },

  // Videos & Watch History / Suppression / Saved Collection / Drafts
  async getShorts(includeWatched = false): Promise<{ shorts: ShortVideo[] }> {
    const qs = includeWatched ? '?includeWatched=1' : '';
    const res = await authFetch(`${API_BASE}/videos/shorts${qs}`);
    return res.json();
  },

  async createShort(data: { videoUrl: string; thumbnailUrl?: string; title: string; caption?: string; hashtags?: string[] }) {
    const res = await authFetch(`${API_BASE}/videos/shorts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(res);
  },

  async getLongVideos(includeWatched = false): Promise<{ videos: LongVideo[] }> {
    const qs = includeWatched ? '?includeWatched=1' : '';
    const res = await authFetch(`${API_BASE}/videos/long${qs}`);
    return res.json();
  },

  async createLongVideo(data: { videoUrl: string; thumbnailUrl?: string; title: string; description?: string; duration?: string; tags?: string[] }) {
    const res = await authFetch(`${API_BASE}/videos/long`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(res);
  },

  async recordWatchProgress(payload: {
    videoId: string;
    youtubeId?: string;
    videoType: 'long' | 'short';
    source?: string;
    title: string;
    thumbnailUrl?: string;
    channelTitle?: string;
    duration?: string;
    watchSeconds: number;
    durationSeconds?: number;
    completed?: boolean;
  }): Promise<{ success: boolean; record?: WatchHistoryRecord; suppressionDays?: number }> {
    const res = await authFetch(`${API_BASE}/videos/watch-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
  },

  async getWatchHistory(): Promise<{ history: WatchHistoryRecord[]; suppressionDays: number }> {
    const res = await authFetch(`${API_BASE}/videos/history`);
    return parseJsonOrThrow(res);
  },

  async deleteWatchHistoryItem(videoId: string): Promise<{ success: boolean; removed: boolean }> {
    const res = await authFetch(`${API_BASE}/videos/history/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
    });
    return parseJsonOrThrow(res);
  },

  async toggleSaveVideo(payload: {
    videoId: string;
    videoType: 'long' | 'short';
    source?: string;
    youtubeId?: string;
    title: string;
    thumbnailUrl?: string;
    channelTitle?: string;
    channelAvatar?: string;
    duration?: string;
    videoUrl?: string;
  }): Promise<{ isSaved: boolean; savedVideos?: SavedVideoItem[] }> {
    const res = await authFetch(`${API_BASE}/videos/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
  },

  async getSavedCollection(): Promise<{ posts: Post[]; videos: SavedVideoItem[] }> {
    const res = await authFetch(`${API_BASE}/saved`);
    return parseJsonOrThrow(res);
  },

  async getDrafts(): Promise<{ drafts: DraftPost[] }> {
    const res = await authFetch(`${API_BASE}/drafts`);
    return parseJsonOrThrow(res);
  },

  async saveDraft(draft: {
    id?: string;
    mode: 'post' | 'story' | 'short';
    content: string;
    shortTitle?: string;
    mediaType?: 'image' | 'video' | 'none';
    mediaUrl?: string;
    images?: string[];
    hashtags?: string[];
    audience?: 'public' | 'friends' | 'only_me';
  }): Promise<{ draft: DraftPost }> {
    const res = await authFetch(`${API_BASE}/drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    return parseJsonOrThrow(res);
  },

  async deleteDraft(id: string): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE}/drafts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return parseJsonOrThrow(res);
  },

  // Friends & Social Graph
  async getFriendsData(): Promise<{
    friends: UserProfile[];
    suggested: UserProfile[];
    pendingRequests: FriendRequest[];
    sentRequests: FriendRequest[];
    blockedUsers: UserProfile[];
  }> {
    const res = await authFetch(`${API_BASE}/friends`);
    return parseJsonOrThrow(res);
  },

  async sendFriendRequest(targetUserId: string): Promise<{ success: boolean; request?: any; status?: string }> {
    const res = await authFetch(`${API_BASE}/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    });
    return parseJsonOrThrow(res);
  },

  async respondFriendRequest(requestId: string, action: 'accept' | 'reject' | 'cancel') {
    const res = await authFetch(`${API_BASE}/friends/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, action }),
    });
    return parseJsonOrThrow(res);
  },

  async removeFriend(userId: string) {
    const res = await authFetch(`${API_BASE}/friends/remove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return parseJsonOrThrow(res);
  },

  async toggleFollow(userId: string) {
    const res = await authFetch(`${API_BASE}/users/${userId}/follow`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  },

  async toggleBlock(userId: string) {
    const res = await authFetch(`${API_BASE}/users/${userId}/block`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  },

  // Notifications
  async getNotifications(category?: string): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
    const params = new URLSearchParams();
    if (category && category !== 'all') params.set('category', category);
    const res = await authFetch(`${API_BASE}/notifications?${params.toString()}`);
    if (!res.ok) return { notifications: [], unreadCount: 0 };
    return res.json();
  },

  async markNotificationsRead(id?: string) {
    const res = await authFetch(`${API_BASE}/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return parseJsonOrThrow(res);
  },

  async deleteNotification(id: string) {
    const res = await authFetch(`${API_BASE}/notifications/${id}`, {
      method: 'DELETE',
    });
    return parseJsonOrThrow(res);
  },

  // MOTHERLAND WAVE Messaging, Groups, Disappearing Messages, Calls & WebRTC
  async getWebRtcConfig(): Promise<{
    iceServers: { urls: string | string[]; username?: string; credential?: string }[];
    hasTurn: boolean;
  }> {
    const res = await authFetch(`${API_BASE}/webrtc/config`);
    return parseJsonOrThrow(res);
  },

  async getCallHistory(): Promise<{ calls: CallRecord[] }> {
    const res = await authFetch(`${API_BASE}/calls`);
    return parseJsonOrThrow(res);
  },

  async logCall(payload: {
    callId?: string;
    conversationId?: string;
    callType?: 'audio' | 'video';
    status?: CallRecord['status'];
    durationSeconds?: number;
    calleeIds?: string[];
  }): Promise<{ call: CallRecord }> {
    const res = await authFetch(`${API_BASE}/calls/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
  },

  async getConversations(): Promise<{ conversations: Conversation[]; totalUnread?: number }> {
    const res = await authFetch(`${API_BASE}/messages/conversations`);
    return parseJsonOrThrow(res);
  },

  async createDirectConversation(targetUserId: string): Promise<{ conversation: Conversation }> {
    const res = await authFetch(`${API_BASE}/messages/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    });
    return parseJsonOrThrow(res);
  },

  async createGroupConversation(payload: {
    name: string;
    memberIds: string[];
    photo?: string;
  }): Promise<{ conversation: Conversation }> {
    const res = await authFetch(`${API_BASE}/messages/group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
  },

  async respondMessageRequest(
    conversationId: string,
    action: 'accept' | 'decline'
  ): Promise<{ conversation: Conversation }> {
    const res = await authFetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}/respond-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    return parseJsonOrThrow(res);
  },

  async addGroupMembers(
    conversationId: string,
    memberIds: string[]
  ): Promise<{ conversation: Conversation; systemMessage?: ChatMessage }> {
    const res = await authFetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds }),
    });
    return parseJsonOrThrow(res);
  },

  async removeGroupMember(
    conversationId: string,
    userId: string
  ): Promise<{ conversation: Conversation; systemMessage?: ChatMessage }> {
    const res = await authFetch(
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    return parseJsonOrThrow(res);
  },

  async setGroupAdmin(
    conversationId: string,
    targetUserId: string,
    makeAdmin: boolean
  ): Promise<{ conversation: Conversation }> {
    const res = await authFetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}/admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId, makeAdmin }),
    });
    return parseJsonOrThrow(res);
  },

  async leaveGroup(conversationId: string): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}/leave`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  },

  async updateConversationSettings(
    conversationId: string,
    updates: {
      name?: string;
      photo?: string;
      disappearingSeconds?: number;
      isMuted?: boolean;
      isArchived?: boolean;
      isPinned?: boolean;
    }
  ): Promise<{ conversation: Conversation }> {
    const res = await authFetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return parseJsonOrThrow(res);
  },

  async searchChatMessages(conversationId: string, query: string): Promise<{ messages: ChatMessage[] }> {
    const res = await authFetch(
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}/search?q=${encodeURIComponent(query)}`
    );
    return parseJsonOrThrow(res);
  },

  async getConversationMedia(conversationId: string): Promise<{
    items: (ChatAttachment & { messageId: string; senderName: string; createdAt: string })[];
    links: { url: string; messageId: string; senderName: string; createdAt: string }[];
  }> {
    const res = await authFetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}/media`);
    return parseJsonOrThrow(res);
  },

  async getMessages(
    conversationId: string,
    beforeId?: string,
    limit = 40,
    markRead = true
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const params = new URLSearchParams({
      limit: String(limit),
      markRead: markRead ? '1' : '0',
    });
    if (beforeId) params.set('beforeId', beforeId);
    const res = await authFetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}?${params.toString()}`);
    return parseJsonOrThrow(res);
  },

  async markConversationRead(conversationId: string): Promise<{ success: boolean; unreadCount?: number }> {
    const res = await authFetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}/read`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  },

  async sendMessage(
    conversationId: string,
    text: string,
    mediaUrl?: string,
    extra?: {
      mediaType?: 'image' | 'video' | 'audio' | 'file';
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      attachments?: ChatAttachment[];
      audioDuration?: number;
      audioWaveform?: number[];
      replyTo?: ChatReplySnapshot;
      forwardedFrom?: { messageId: string; senderName: string };
      messageType?: 'text' | 'system' | 'call';
    }
  ): Promise<{ message: ChatMessage; conversation?: Conversation }> {
    const res = await authFetch(`${API_BASE}/messages/${encodeURIComponent(conversationId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mediaUrl, ...extra }),
    });
    return parseJsonOrThrow(res);
  },

  async editMessage(conversationId: string, msgId: string, text: string): Promise<{ message: ChatMessage }> {
    const res = await authFetch(
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}/${encodeURIComponent(msgId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }
    );
    return parseJsonOrThrow(res);
  },

  async deleteMessage(
    conversationId: string,
    msgId: string,
    mode: 'me' | 'everyone' = 'everyone'
  ): Promise<{ success: boolean; message: ChatMessage }> {
    const res = await authFetch(
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}/${encodeURIComponent(msgId)}?mode=${mode}`,
      { method: 'DELETE' }
    );
    return parseJsonOrThrow(res);
  },

  async reactToMessage(
    conversationId: string,
    msgId: string,
    emoji: string
  ): Promise<{ message: ChatMessage }> {
    const res = await authFetch(
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}/${encodeURIComponent(msgId)}/react`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji }),
      }
    );
    return parseJsonOrThrow(res);
  },

  async pinMessage(
    conversationId: string,
    msgId: string
  ): Promise<{ message: ChatMessage; pinnedMessageIds: string[] }> {
    const res = await authFetch(
      `${API_BASE}/messages/${encodeURIComponent(conversationId)}/${encodeURIComponent(msgId)}/pin`,
      { method: 'POST' }
    );
    return parseJsonOrThrow(res);
  },

  // Platform Adapters
  async getPlatformAdapters(): Promise<{ adapters: PlatformAdapterInfo[] }> {
    const res = await authFetch(`${API_BASE}/platforms/status`);
    return res.json();
  },

  async multiPublish(data: { content: string; mediaUrl?: string; mediaType?: string; platforms: string[] }): Promise<PublishingJob> {
    const res = await authFetch(`${API_BASE}/platforms/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(res);
  },
};
