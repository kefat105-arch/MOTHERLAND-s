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
  ServerRegistryEntry,
  ServerSwitchHistoryEntry,
  AdminConfigChatMessage,
  TranslationPreferences,
  GameCatalogEntry,
  LiveSpyCapacity,
  LiveSpyPublicState,
  LiveSpySecretAssignment,
} from './types';
import {
  getSuppressedIdsHeaderValue,
  getRecentlyShownIds,
  getSessionSeed,
} from './services/watchSuppression';
import {
  isAppOnline,
  markConnectivityOffline,
  markConnectivityOnline,
  markMotherlandServerOffline,
  markMotherlandServerOnline,
  getOfflinePosts,
  getOfflineStories,
  getOfflineShorts,
  getOfflineLongVideos,
  mirrorOnlinePosts,
  mirrorOnlineStories,
  mirrorOnlineShorts,
  mirrorOnlineLongVideos,
} from './services/offlineVideoEngine';
import { directYouTubeService } from './services/directYouTubeService';

function isNetworkFailure(err: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!err) return false;
  if (err instanceof TypeError) return true;
  const msg = String(err?.message || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed')
  );
}

const API_BASE = '/api';
const TOKEN_KEY = 'motherland_auth_token';
const REFRESH_TOKEN_KEY = 'motherland_refresh_token';
const CACHED_USER_KEY = 'motherland_cached_user_profile';
const SAVED_ACCOUNTS_KEY = 'motherland_saved_accounts';
const GOOGLE_AUTH_STORAGE_KEY = 'motherland_google_youtube_auth_v3';

export interface SavedAccountItem {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  role?: string;
  token: string;
  refreshToken?: string;
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

export function getStoredRefreshToken(): string {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredRefreshToken(refreshToken: string): void {
  try {
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch (err) {
    console.error('Storage error:', err);
  }
}

export function getCachedUserProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.id ? (parsed as UserProfile) : null;
  } catch {
    return null;
  }
}

export function setCachedUserProfile(user: UserProfile | null): void {
  try {
    if (user && user.id) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearAllAuthStorage(): void {
  setStoredAuthToken('');
  setStoredRefreshToken('');
  setCachedUserProfile(null);
}

export function getSavedAccounts(): SavedAccountItem[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAccount(user: UserProfile, token: string, refreshToken?: string): void {
  try {
    const existing = getSavedAccounts().find((a) => a.id === user.id);
    const accounts = getSavedAccounts().filter((a) => a.id !== user.id);
    accounts.unshift({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      role: user.role,
      token,
      refreshToken: refreshToken || existing?.refreshToken || getStoredRefreshToken() || undefined,
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

interface RefreshAttemptResult {
  ok: boolean;
  user?: UserProfile | null;
  token?: string;
  transientError?: boolean;
  sessionExpired?: boolean;
}

let refreshInFlightPromise: Promise<RefreshAttemptResult> | null = null;

export async function refreshAccessSession(explicitRefreshToken?: string): Promise<RefreshAttemptResult> {
  if (refreshInFlightPromise && !explicitRefreshToken) {
    return refreshInFlightPromise;
  }

  const run = async (): Promise<RefreshAttemptResult> => {
    const refreshToken = (explicitRefreshToken || getStoredRefreshToken() || '').trim();
    try {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      if (refreshToken) {
        headers.set('x-refresh-token', refreshToken);
      }
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      });

      if (res.status >= 500) {
        return { ok: false, transientError: true, sessionExpired: false };
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const explicitlyRevoked =
          res.status === 401 &&
          (errData?.sessionExpired === true ||
            errData?.error === 'SESSION_REVOKED' ||
            errData?.error === 'REFRESH_TOKEN_MISSING' ||
            errData?.error === 'ACCOUNT_UNAVAILABLE');
        return {
          ok: false,
          transientError: !explicitlyRevoked,
          sessionExpired: explicitlyRevoked,
        };
      }

      const data = await res.json().catch(() => ({}));
      if (data?.token) {
        setStoredAuthToken(data.token);
        if (data.refreshToken) {
          setStoredRefreshToken(data.refreshToken);
        }
        if (data.user) {
          setCachedUserProfile(data.user);
          saveAccount(data.user, data.token, data.refreshToken);
        }
        return {
          ok: true,
          user: data.user || getCachedUserProfile(),
          token: data.token,
          transientError: false,
          sessionExpired: false,
        };
      }

      return { ok: false, transientError: true, sessionExpired: false };
    } catch {
      return { ok: false, transientError: true, sessionExpired: false };
    }
  };

  if (explicitRefreshToken) {
    return run();
  }

  refreshInFlightPromise = run().finally(() => {
    refreshInFlightPromise = null;
  });
  return refreshInFlightPromise;
}

function buildAuthHeaders(url: string, options: RequestInit, tokenOverride?: string): Headers {
  const token = tokenOverride !== undefined ? tokenOverride : getStoredAuthToken();
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
    const scope = url.includes('/shorts') || url.includes('type=shorts')
      ? 'shorts'
      : url.includes('/videos/') || url.includes('/youtube/feed')
        ? 'video'
        : 'home';
    const recentExcluded = getRecentlyShownIds(scope);
    if (recentExcluded.length > 0 && !headers.has('x-exclude-ids')) {
      headers.set('x-exclude-ids', recentExcluded.slice(0, 120).join(','));
    }
    if (!headers.has('x-feed-seed')) {
      headers.set('x-feed-seed', getSessionSeed());
    }
  }
  return headers;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = buildAuthHeaders(url, options);
  const res = await fetch(url, {
    credentials: options.credentials || 'same-origin',
    ...options,
    headers,
  });

  const isAuthEndpoint =
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout');

  if (res.status === 401 && !isAuthEndpoint) {
    const refreshed = await refreshAccessSession();
    if (refreshed.ok && refreshed.token) {
      const retryHeaders = buildAuthHeaders(url, options, refreshed.token);
      return fetch(url, {
        credentials: options.credentials || 'same-origin',
        ...options,
        headers: retryHeaders,
      });
    }
  }

  return res;
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
  getRefreshToken: getStoredRefreshToken,
  setRefreshToken: setStoredRefreshToken,
  getCachedUser: getCachedUserProfile,
  refreshSession: refreshAccessSession,
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

  // Direct Client <-> YouTube Data API v3 Integration (100% Independent from MOTHERLAND Backend)
  async getYouTubeStatus() {
    return directYouTubeService.getStatus();
  },

  async setYouTubeKey(apiKey: string) {
    const result = await directYouTubeService.setApiKey(apiKey);
    // Optional non-blocking sync with MOTHERLAND backend if online & signed in
    void authFetch(`${API_BASE}/youtube/set-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    }).catch(() => {});
    return result;
  },

  async searchYouTube(
    query: string,
    pageToken = '',
    maxResults = 15,
    videoDuration = '',
    options?: { continuous?: boolean; signal?: AbortSignal }
  ) {
    return directYouTubeService.searchVideos(query, pageToken, maxResults, videoDuration, options);
  },

  async getYouTubeVideos(ids: string) {
    return directYouTubeService.getVideosByIds(ids);
  },

  async getYouTubeFeed(options: {
    type?: 'long' | 'shorts';
    category?: string;
    pageToken?: string;
    page?: number;
    pageSize?: number;
    signal?: AbortSignal;
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
    if (!isAppOnline()) {
      const items =
        options.type === 'shorts' ? await getOfflineShorts() : await getOfflineLongVideos();
      return {
        items,
        nextPageToken: null,
        page: 1,
        hasMore: false,
        category: options.category || 'all',
        type: options.type || 'long',
      };
    }

    try {
      const excludeIds = new Set<string>(
        getRecentlyShownIds(options.type === 'shorts' ? 'shorts' : 'video')
      );
      const data = await directYouTubeService.getFeed({
        ...options,
        excludeIds,
      });
      if (options.type === 'shorts' && Array.isArray(data?.items)) {
        void mirrorOnlineShorts(data.items);
      } else if (Array.isArray(data?.items)) {
        void mirrorOnlineLongVideos(data.items);
      }
      return data;
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        throw err;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        markConnectivityOffline();
      }
      const items =
        options.type === 'shorts' ? await getOfflineShorts() : await getOfflineLongVideos();
      return {
        items,
        nextPageToken: null,
        page: 1,
        hasMore: false,
        category: options.category || 'all',
        type: options.type || 'long',
      };
    }
  },

  async getYouTubeComments(videoId: string, pageToken = '', order = 'relevance'): Promise<{
    commentsDisabled: boolean;
    message?: string;
    items: YouTubeCommentThread[];
    nextPageToken?: string | null;
  }> {
    return directYouTubeService.getComments(videoId, pageToken, order);
  },

  async getYouTubeLive(pageToken = '', q = ''): Promise<{
    items: LongVideo[];
    nextPageToken?: string | null;
    requiresApiKey?: boolean;
    error?: string;
    message?: string;
  }> {
    return directYouTubeService.getLiveStreams(pageToken, q);
  },

  async getYouTubeChannel(channelId: string, pageToken = ''): Promise<{
    channel: {
      id: string;
      source: 'youtube';
      title: string;
      description: string;
      customUrl?: string;
      avatar: string;
      bannerUrl?: string;
      subscriberCount: string;
      rawSubscriberCount: number | null;
      videoCount: number;
      viewCount: number;
      country?: string;
      publishedAt?: string;
      url: string;
    };
    videos: (LongVideo & { isShort?: boolean })[];
    smallVideos: (LongVideo & { isShort?: boolean })[];
    nextPageToken?: string | null;
  }> {
    return directYouTubeService.getChannelProfile(channelId, pageToken);
  },

  async getYouTubeSubscriptionStatus(channelId: string): Promise<{
    connected: boolean;
    hasScope: boolean;
    subscribed: boolean;
    subscriptionId: string | null;
    requiresScope?: string;
    message?: string;
  }> {
    return directYouTubeService.getSubscriptionStatus(channelId);
  },

  async subscribeYouTubeChannel(channelId: string, action: 'subscribe' | 'unsubscribe' = 'subscribe'): Promise<{
    success: boolean;
    subscribed: boolean;
    subscriptionId: string | null;
    requiresScope?: string;
    error?: string;
    message?: string;
  }> {
    return directYouTubeService.subscribeChannel(channelId, action);
  },

  async rateYouTubeVideo(videoId: string, rating: 'like' | 'dislike' | 'none' = 'like'): Promise<{
    success: boolean;
    videoId: string;
    rating: string;
  }> {
    return directYouTubeService.rateVideo(videoId, rating);
  },

  async postYouTubeComment(videoId: string, text: string): Promise<{
    success: boolean;
    comment: YouTubeCommentThread;
  }> {
    return directYouTubeService.postComment(videoId, text);
  },

  // Official YouTube OAuth 2.0 + Direct Upload
  async getYouTubeOAuthStatus(): Promise<YouTubeOAuthStatus> {
    const token = getStoredGoogleAccessToken();
    if (token) {
      return {
        oauthConfigured: true,
        clientOAuthReady: true,
        callbackUrl: '',
        connected: true,
        status: 'connected',
      };
    }
    try {
      const res = await authFetch(`${API_BASE}/youtube/oauth/status`);
      return res.json();
    } catch {
      return {
        oauthConfigured: false,
        callbackUrl: '',
        connected: false,
        status: 'not_configured',
      };
    }
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
    localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
    try {
      const res = await authFetch(`${API_BASE}/youtube/oauth/disconnect`, {
        method: 'POST',
      });
      return parseJsonOrThrow(res);
    } catch {
      return { success: true, connected: false };
    }
  },

  async getMyYouTubeVideos(): Promise<{
    hasChannel?: boolean;
    channel?: any;
    videos: any[];
    error?: string;
    message?: string;
  }> {
    return directYouTubeService.getMyChannelVideos();
  },

  async updateMyYouTubeVideo(
    videoId: string,
    payload: { title?: string; description?: string; privacyStatus?: 'public' | 'unlisted' | 'private'; tags?: string[] }
  ): Promise<{ success: boolean; video: any }> {
    return directYouTubeService.updateMyVideo(videoId, payload);
  },

  async deleteMyYouTubeVideo(videoId: string): Promise<{ success: boolean; videoId: string }> {
    return directYouTubeService.deleteMyVideo(videoId);
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
    onProgress?: (percent: number) => void,
    options?: { visibility?: 'public' | 'private'; conversationId?: string }
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
      if (options?.visibility) {
        xhr.setRequestHeader('x-visibility', options.visibility);
      }
      if (options?.conversationId) {
        xhr.setRequestHeader('x-conversation-id', options.conversationId);
      }

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
      if (result.refreshToken) {
        setStoredRefreshToken(result.refreshToken);
      }
      if (result.user) {
        setCachedUserProfile(result.user);
        saveAccount(result.user, result.token, result.refreshToken);
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
      if (result.refreshToken) {
        setStoredRefreshToken(result.refreshToken);
      }
      if (result.user) {
        setCachedUserProfile(result.user);
        saveAccount(result.user, result.token, result.refreshToken);
      }
    }
    return result;
  },

  async logout(): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
    }).catch(() => null);
    clearAllAuthStorage();
    return res ? res.json().catch(() => ({ success: true })) : { success: true };
  },

  async getCurrentUser(): Promise<{
    user: UserProfile | null;
    isGuest?: boolean;
    sessionExpired?: boolean;
    transientError?: boolean;
    error?: string;
  }> {
    const cachedUser = getCachedUserProfile();
    try {
      const res = await authFetch(`${API_BASE}/auth/me`);
      if (res.status >= 500) {
        return {
          user: cachedUser,
          isGuest: !cachedUser,
          sessionExpired: false,
          transientError: true,
          error: `Server error (${res.status})`,
        };
      }
      if (!res.ok) {
        // authFetch already attempted refresh on 401; verify if refresh token is genuinely revoked
        const refreshAttempt = await refreshAccessSession();
        if (refreshAttempt.ok && refreshAttempt.user) {
          return {
            user: refreshAttempt.user,
            isGuest: false,
            sessionExpired: false,
            transientError: false,
          };
        }
        if (refreshAttempt.transientError) {
          return {
            user: cachedUser,
            isGuest: !cachedUser,
            sessionExpired: false,
            transientError: true,
            error: 'Temporary connection issue',
          };
        }
        const hadToken = Boolean(getStoredAuthToken() || getStoredRefreshToken() || cachedUser);
        return {
          user: null,
          isGuest: true,
          sessionExpired: hadToken && (res.status === 401 || res.status === 403),
          transientError: false,
          error: 'Unauthorized',
        };
      }
      const data = await res.json();
      if (data?.user) {
        setCachedUserProfile(data.user);
        if (getStoredAuthToken()) {
          saveAccount(data.user, getStoredAuthToken(), getStoredRefreshToken());
        }
      } else if (data?.isGuest) {
        // Check if we can silently restore via refresh token / cookie
        if (getStoredRefreshToken() || data?.canRefresh || getStoredAuthToken() || cachedUser) {
          const refreshAttempt = await refreshAccessSession();
          if (refreshAttempt.ok && refreshAttempt.user) {
            return {
              user: refreshAttempt.user,
              isGuest: false,
              sessionExpired: false,
              transientError: false,
            };
          }
          if (refreshAttempt.transientError) {
            return {
              user: cachedUser,
              isGuest: !cachedUser,
              sessionExpired: false,
              transientError: true,
              error: 'Temporary connection issue',
            };
          }
          return {
            user: null,
            isGuest: true,
            sessionExpired: Boolean(data?.sessionExpired || refreshAttempt.sessionExpired),
            transientError: false,
          };
        }
      }
      return { ...data, transientError: false };
    } catch (err: any) {
      return {
        user: cachedUser,
        isGuest: !cachedUser,
        sessionExpired: false,
        transientError: true,
        error: err?.message || 'Network unavailable',
      };
    }
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
      clearAllAuthStorage();
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
      clearAllAuthStorage();
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
    clearAllAuthStorage();
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
    translationPrefs?: Partial<TranslationPreferences>;
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

  // Posts & Feed (MOTHERLAND Backend Native + Direct Browser YouTube Decoupled Parallel Merge)
  async getPosts(
    feedType: string = 'all',
    source = 'all',
    page = 1,
    pageSize = 10,
    ytCursor = '',
    signal?: AbortSignal
  ): Promise<{
    posts: Post[];
    total: number;
    page?: number;
    hasMore?: boolean;
    nextYtCursor?: string | null;
    quotaExceeded?: boolean;
    errorMessage?: string;
  }> {
    if (!isAppOnline()) {
      const cached = await getOfflinePosts();
      const filtered =
        feedType === 'motherland'
          ? cached.filter((p) => p.source === 'motherland')
          : cached;
      return {
        posts: filtered,
        total: filtered.length,
        page: 1,
        hasMore: false,
        nextYtCursor: null,
      };
    }

    const fetchMotherlandOnly = async () => {
      const params = new URLSearchParams({
        feedType: feedType === 'saved' ? 'saved' : 'motherland',
        source: 'motherland',
        page: String(page),
        pageSize: String(
          feedType === 'motherland' || feedType === 'saved' || source === 'motherland'
            ? pageSize
            : Math.max(2, Math.floor(pageSize / 2))
        ),
      });
      const res = await authFetch(`${API_BASE}/posts?${params.toString()}`, { signal });
      if (!res.ok) {
        throw new Error(`MOTHERLAND server returned ${res.status}`);
      }
      const data = await res.json();
      markMotherlandServerOnline();
      return data as { posts: Post[]; total: number; hasMore?: boolean };
    };

    // Pure MOTHERLAND / Saved feeds only hit MOTHERLAND server (with offline fallback)
    if (feedType === 'motherland' || feedType === 'saved' || source === 'motherland') {
      try {
        const data = await fetchMotherlandOnly();
        if (Array.isArray(data?.posts) && data.posts.length > 0) {
          void mirrorOnlinePosts(data.posts);
        }
        return { ...data, page, nextYtCursor: null };
      } catch (err) {
        if ((err as any)?.name === 'AbortError') throw err;
        markMotherlandServerOffline();
        if (isNetworkFailure(err)) markConnectivityOffline();
        const cached = (await getOfflinePosts()).filter((p) => p.source === 'motherland');
        return {
          posts: cached,
          total: cached.length,
          page: 1,
          hasMore: false,
          nextYtCursor: null,
        };
      }
    }

    // Mixed feeds ('all' | 'for_you'): Run MOTHERLAND backend & Direct YouTube API independently in parallel!
    // If MOTHERLAND server is down or returns 5xx, YouTube posts STILL load & play smoothly.
    const ytTarget = Math.max(4, Math.ceil(pageSize * 0.65));
    const excludeSet = new Set<string>(getRecentlyShownIds('home'));
    const [mlSettled, ytSettled] = await Promise.allSettled([
      fetchMotherlandOnly(),
      directYouTubeService.getDirectHomePosts({
        page,
        pageSize: ytTarget,
        ytCursor,
        signal,
        excludeIds: excludeSet,
      }),
    ]);

    if (
      (mlSettled.status === 'rejected' && mlSettled.reason?.name === 'AbortError') ||
      (ytSettled.status === 'rejected' && ytSettled.reason?.name === 'AbortError')
    ) {
      throw new DOMException('Aborted', 'AbortError');
    }

    let mlPosts: Post[] = [];
    let mlTotal = 0;
    let mlHasMore = false;
    if (mlSettled.status === 'fulfilled') {
      mlPosts = Array.isArray(mlSettled.value?.posts) ? mlSettled.value.posts : [];
      mlTotal = Number(mlSettled.value?.total || mlPosts.length);
      mlHasMore = Boolean(mlSettled.value?.hasMore);
    } else {
      markMotherlandServerOffline();
      // Gracefully pull cached offline native MOTHERLAND posts only when server is down
      const offlineNative = (await getOfflinePosts()).filter((p) => p.source === 'motherland');
      if (page === 1) mlPosts = offlineNative.slice(0, 3);
    }

    let ytPosts: Post[] = [];
    let nextYtCursor: string | null = null;
    let quotaExceeded = false;
    if (ytSettled.status === 'fulfilled') {
      ytPosts = ytSettled.value.posts || [];
      nextYtCursor = ytSettled.value.nextYtCursor;
      quotaExceeded = Boolean(ytSettled.value.quotaExceeded);
    }

    // Balanced interleave: 1 Motherland post + 2 YouTube posts
    const merged: Post[] = [];
    const seen = new Set<string>();
    let mi = 0;
    let yi = 0;
    while (merged.length < pageSize && (mi < mlPosts.length || yi < ytPosts.length)) {
      if (mi < mlPosts.length) {
        const p = mlPosts[mi++];
        if (p && !seen.has(p.id)) {
          seen.add(p.id);
          merged.push(p);
        }
      }
      for (let k = 0; k < 2 && yi < ytPosts.length && merged.length < pageSize; k++) {
        const y = ytPosts[yi++];
        if (y && !seen.has(y.id)) {
          seen.add(y.id);
          merged.push(y);
        }
      }
    }

    if (merged.length > 0) {
      void mirrorOnlinePosts(merged);
    }

    return {
      posts: merged,
      total: mlTotal + ytPosts.length,
      page,
      hasMore: mlHasMore || Boolean(nextYtCursor),
      nextYtCursor,
      quotaExceeded,
    };
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

  async addPostComment(postId: string, text: string, parentId?: string) {
    const res = await authFetch(`${API_BASE}/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...(parentId ? { parentId } : {}) }),
    });
    return parseJsonOrThrow(res);
  },

  async editPostComment(postId: string, commentId: string, text: string) {
    const res = await authFetch(
      `${API_BASE}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      }
    );
    return parseJsonOrThrow(res);
  },

  async deletePostComment(postId: string, commentId: string) {
    const res = await authFetch(
      `${API_BASE}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
      { method: 'DELETE' }
    );
    return parseJsonOrThrow(res);
  },

  async togglePostCommentLike(postId: string, commentId: string) {
    const res = await authFetch(
      `${API_BASE}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/like`,
      { method: 'POST' }
    );
    return parseJsonOrThrow(res);
  },

  async toggleSavePost(postId: string): Promise<{ isSaved: boolean }> {
    const res = await authFetch(`${API_BASE}/posts/${postId}/save`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  },

  async updatePost(
    postId: string,
    payload: { content?: string; audience?: 'public' | 'friends' | 'only_me'; hashtags?: string[] }
  ): Promise<{ post: Post }> {
    const res = await authFetch(`${API_BASE}/posts/${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
  },

  async reportPost(postId: string, payload: { reason: string; details?: string }): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE}/posts/${encodeURIComponent(postId)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
  async getStories(signal?: AbortSignal): Promise<{ stories: Story[] }> {
    if (!isAppOnline()) {
      return { stories: await getOfflineStories() };
    }
    try {
      const res = await authFetch(`${API_BASE}/stories`, { signal });
      const data = await parseJsonOrThrow<{ stories: Story[] }>(res);
      markMotherlandServerOnline();
      if (Array.isArray(data?.stories) && data.stories.length > 0) {
        void mirrorOnlineStories(data.stories);
      }
      return data;
    } catch (err) {
      if ((err as any)?.name === 'AbortError') throw err;
      markMotherlandServerOffline();
      if (isNetworkFailure(err)) markConnectivityOffline();
      return { stories: await getOfflineStories() };
    }
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
  async getShorts(
    includeWatched = false,
    page = 1,
    pageSize = 12,
    pageToken = '',
    signal?: AbortSignal
  ): Promise<{
    shorts: ShortVideo[];
    page?: number;
    nextPageToken?: string | null;
    hasMore?: boolean;
    quotaExceeded?: boolean;
    exhaustedReason?: string;
  }> {
    if (!isAppOnline()) {
      return { shorts: await getOfflineShorts(), page: 1, nextPageToken: null, hasMore: false };
    }

    const fetchNativeShorts = async () => {
      const params = new URLSearchParams({
        nativeOnly: '1',
        page: String(page),
        pageSize: String(Math.max(4, Math.floor(pageSize / 2))),
      });
      if (includeWatched) params.set('includeWatched', '1');
      const res = await authFetch(`${API_BASE}/videos/shorts?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Shorts backend ${res.status}`);
      markMotherlandServerOnline();
      return (await res.json()) as { shorts: ShortVideo[]; hasMore?: boolean };
    };

    const excludeIds = includeWatched ? new Set<string>() : new Set<string>(getRecentlyShownIds('shorts'));
    const [mlSettled, ytSettled] = await Promise.allSettled([
      fetchNativeShorts(),
      directYouTubeService.getDirectShortsFeed({
        page,
        pageSize: Math.max(6, Math.ceil(pageSize * 0.7)),
        pageToken,
        signal,
        excludeIds,
      }),
    ]);

    if (
      (mlSettled.status === 'rejected' && mlSettled.reason?.name === 'AbortError') ||
      (ytSettled.status === 'rejected' && ytSettled.reason?.name === 'AbortError')
    ) {
      throw new DOMException('Aborted', 'AbortError');
    }

    let nativeShorts: ShortVideo[] = [];
    if (mlSettled.status === 'fulfilled') {
      nativeShorts = Array.isArray(mlSettled.value?.shorts) ? mlSettled.value.shorts : [];
    } else {
      markMotherlandServerOffline();
      if (page === 1) {
        nativeShorts = (await getOfflineShorts()).filter((s) => s.source !== 'youtube').slice(0, 4);
      }
    }

    let ytShorts: ShortVideo[] = [];
    let nextPageToken: string | null = null;
    let ytHasMore = false;
    let quotaExceeded = false;
    if (ytSettled.status === 'fulfilled') {
      ytShorts = ytSettled.value.shorts || [];
      nextPageToken = ytSettled.value.nextPageToken;
      ytHasMore = Boolean(ytSettled.value.hasMore);
      quotaExceeded = Boolean(ytSettled.value.quotaExceeded);
    }

    const combined: ShortVideo[] = [];
    const seen = new Set<string>();
    let ni = 0;
    let yi = 0;
    while (ni < nativeShorts.length || yi < ytShorts.length) {
      if (ni < nativeShorts.length) {
        const s = nativeShorts[ni++];
        if (s && !seen.has(s.id)) {
          seen.add(s.id);
          combined.push(s);
        }
      }
      for (let k = 0; k < 2 && yi < ytShorts.length; k++) {
        const y = ytShorts[yi++];
        if (y && !seen.has(y.id)) {
          seen.add(y.id);
          combined.push(y);
        }
      }
    }

    if (combined.length > 0) {
      void mirrorOnlineShorts(combined);
    }
    return {
      shorts: combined,
      page,
      nextPageToken,
      hasMore: ytHasMore || Boolean(nextPageToken),
      quotaExceeded,
    };
  },

  async createShort(data: {
    videoUrl: string;
    thumbnailUrl?: string;
    title: string;
    caption?: string;
    hashtags?: string[];
    durationSeconds: number;
    aspectRatio?: string;
  }) {
    const res = await authFetch(`${API_BASE}/videos/shorts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseJsonOrThrow(res);
  },

  async getLongVideos(includeWatched = false, signal?: AbortSignal): Promise<{ videos: LongVideo[] }> {
    if (!isAppOnline()) {
      return { videos: await getOfflineLongVideos() };
    }
    const qs = includeWatched ? '?includeWatched=1' : '';
    try {
      const res = await authFetch(`${API_BASE}/videos/long${qs}`, { signal });
      const data = await parseJsonOrThrow<{ videos: LongVideo[] }>(res);
      markMotherlandServerOnline();
      if (Array.isArray(data?.videos) && data.videos.length > 0) {
        void mirrorOnlineLongVideos(data.videos);
      }
      return data;
    } catch (err) {
      if ((err as any)?.name === 'AbortError') throw err;
      markMotherlandServerOffline();
      if (isNetworkFailure(err)) markConnectivityOffline();
      return { videos: await getOfflineLongVideos() };
    }
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

  async toggleFollow(userId: string): Promise<{
    isFollowing: boolean;
    followersCount: number;
    followingCount: number;
    targetFollowersCount: number;
    targetFollowingCount: number;
  }> {
    const res = await authFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/follow`, {
      method: 'POST',
    });
    return parseJsonOrThrow(res);
  },

  async getUserNetwork(userId: string): Promise<{
    friends: UserProfile[];
    supporters: UserProfile[];
    supporting: UserProfile[];
  }> {
    const res = await authFetch(`${API_BASE}/users/${encodeURIComponent(userId)}/network`);
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

  // Multi-Server Registry & Owner Config Chat
  async getServers(): Promise<{
    servers: ServerRegistryEntry[];
    primaryServerId: string;
    dreamWorldServer?: ServerRegistryEntry;
  }> {
    const res = await authFetch(`${API_BASE}/servers`);
    return parseJsonOrThrow(res);
  },

  async createServer(payload: Partial<ServerRegistryEntry> & { name: string; baseUrl: string }): Promise<{ server: ServerRegistryEntry }> {
    const res = await authFetch(`${API_BASE}/servers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
  },

  async updateServer(id: string, payload: Partial<ServerRegistryEntry>): Promise<{ server: ServerRegistryEntry }> {
    const res = await authFetch(`${API_BASE}/servers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJsonOrThrow(res);
  },

  async deleteServer(id: string): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE}/servers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return parseJsonOrThrow(res);
  },

  async testServerHealth(id: string): Promise<{
    server?: ServerRegistryEntry;
    probeUrl: string;
    httpStatus: number;
    latencyMs: number;
    healthStatus: 'healthy' | 'degraded' | 'offline';
    error?: string;
  }> {
    const res = await authFetch(`${API_BASE}/servers/${encodeURIComponent(id)}/test`, { method: 'POST' });
    return parseJsonOrThrow(res);
  },

  async setPrimaryServer(id: string): Promise<{ server: ServerRegistryEntry; previousPrimaryId?: string }> {
    const res = await authFetch(`${API_BASE}/servers/${encodeURIComponent(id)}/set-primary`, { method: 'POST' });
    return parseJsonOrThrow(res);
  },

  async rollbackPrimaryServer(): Promise<{ server: ServerRegistryEntry }> {
    const res = await authFetch(`${API_BASE}/servers/rollback`, { method: 'POST' });
    return parseJsonOrThrow(res);
  },

  async getServerHistory(): Promise<{ history: ServerSwitchHistoryEntry[] }> {
    const res = await authFetch(`${API_BASE}/servers/history`);
    return parseJsonOrThrow(res);
  },

  async getAdminServerChat(): Promise<{ messages: AdminConfigChatMessage[] }> {
    const res = await authFetch(`${API_BASE}/admin/servers/chat`);
    return parseJsonOrThrow(res);
  },

  async sendAdminServerChat(text: string, confirm = false): Promise<{
    ownerMessage: AdminConfigChatMessage;
    systemMessage: AdminConfigChatMessage;
    servers: ServerRegistryEntry[];
  }> {
    const res = await authFetch(`${API_BASE}/admin/servers/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, confirm }),
    });
    return parseJsonOrThrow(res);
  },

  // Motherland live (Live TV Channels across BD, Cartoon, PK, IN)
  async getMotherlandLiveChannels(params?: {
    region?: string;
    category?: string;
    q?: string;
    refresh?: string;
  }): Promise<{
    channels: any[];
    total: number;
    counts?: { all: number; BD: number; BANGLA: number; CARTOON: number; PK: number; IN: number };
  }> {
    const qs = new URLSearchParams();
    if (params?.region) qs.set('region', params.region);
    if (params?.category) qs.set('category', params.category);
    if (params?.q) qs.set('q', params.q);
    if (params?.refresh) qs.set('refresh', params.refresh);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const res = await authFetch(`${API_BASE}/motherland-live/channels${suffix}`);
    return parseJsonOrThrow(res);
  },

  async resolveMotherlandYoutubeLive(channelId: string): Promise<{
    videoId: string;
    title: string;
    channelAvatar?: string;
  }> {
    try {
      const res = await authFetch(`${API_BASE}/motherland-live/youtube-live/${encodeURIComponent(channelId)}`);
      if (res.ok) return res.json();
    } catch {
      // Fallback to direct YouTube API if MOTHERLAND backend is unavailable
    }
    const profile = await directYouTubeService.getChannelProfile(channelId);
    const first = profile.videos?.[0];
    if (!first) throw new Error('No YouTube video available for channel');
    return {
      videoId: first.youtubeId || first.id,
      title: first.title,
      channelAvatar: profile.channel.avatar,
    };
  },

  async getMotherlandLiveChannelSocial(channelId: string): Promise<{
    likesCount: number;
    isLiked: boolean;
    comments: Array<{
      id: string;
      channelId: string;
      userId: string;
      authorName: string;
      authorAvatar?: string;
      text: string;
      createdAt: string;
    }>;
  }> {
    const res = await authFetch(`${API_BASE}/motherland-live/channel-social/${encodeURIComponent(channelId)}`);
    if (!res.ok) return { likesCount: 0, isLiked: false, comments: [] };
    return res.json();
  },

  async toggleMotherlandLiveLike(channelId: string): Promise<{ likesCount: number; isLiked: boolean }> {
    const res = await authFetch(`${API_BASE}/motherland-live/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });
    return parseJsonOrThrow(res);
  },

  async addMotherlandLiveComment(channelId: string, text: string): Promise<{
    comment: any;
    comments: any[];
  }> {
    const res = await authFetch(`${API_BASE}/motherland-live/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, text }),
    });
    return parseJsonOrThrow(res);
  },

  async getMotherlandLivePrefs(): Promise<{ favorites: string[]; recent: string[] }> {
    const res = await authFetch(`${API_BASE}/motherland-live/prefs`);
    if (!res.ok) return { favorites: [], recent: [] };
    return res.json();
  },

  async toggleMotherlandLiveFavorite(channelId: string): Promise<{ favorites: string[]; isFavorite: boolean }> {
    const res = await authFetch(`${API_BASE}/motherland-live/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });
    return parseJsonOrThrow(res);
  },

  async recordMotherlandLiveRecent(channelId: string): Promise<{ recent: string[] }> {
    const res = await authFetch(`${API_BASE}/motherland-live/recent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId }),
    });
    if (!res.ok) return { recent: [] };
    return res.json();
  },

  async resolveSharedLink(
    videoId: string,
    preferredType?: 'video' | 'short' | 'post'
  ): Promise<{
    found: boolean;
    kind: 'short' | 'long' | 'post';
    short?: ShortVideo;
    video?: LongVideo;
    post?: Post;
  }> {
    try {
      const typeQ = preferredType ? `?type=${encodeURIComponent(preferredType)}` : '';
      const res = await authFetch(
        `${API_BASE}/videos/resolve/${encodeURIComponent(videoId)}${typeQ}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.found) return data;
      }
    } catch {
      // Fall back to direct YouTube lookup when MOTHERLAND backend is unavailable
    }
    const ytResolved = await directYouTubeService.resolveDeepLinkYouTube(videoId, preferredType);
    if (ytResolved) return ytResolved;
    return { found: false, kind: preferredType === 'short' ? 'short' : 'long' };
  },

  // Games Hub, Custom User-Built 3D Games & LIVE SPY Multiplayer
  async getGamesCatalog(): Promise<{ games: GameCatalogEntry[] }> {
    try {
      const res = await authFetch(`${API_BASE}/games/catalog`);
      if (!res.ok) return { games: [] };
      return res.json();
    } catch {
      return { games: [] };
    }
  },

  async getCustomGames(): Promise<{ customGames: any[] }> {
    try {
      const res = await authFetch(`${API_BASE}/games/custom`);
      if (!res.ok) return { customGames: [] };
      return res.json();
    } catch {
      return { customGames: [] };
    }
  },

  async saveCustomGame(definition: any): Promise<{ game: any }> {
    const res = await authFetch(`${API_BASE}/games/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(definition),
    });
    return parseJsonOrThrow(res);
  },

  async deleteCustomGame(id: string): Promise<{ ok: boolean }> {
    const res = await authFetch(`${API_BASE}/games/custom/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) return { ok: false };
    return res.json();
  },

  async getWorldServersSummary(): Promise<{
    servers: Record<
      string,
      {
        activeServers: number;
        totalPlayers: number;
        maxPerRoom: number;
        rooms: Array<{ serverNumber: number; players: number }>;
      }
    >;
  }> {
    try {
      const res = await authFetch(`${API_BASE}/games/worlds/servers`);
      if (!res.ok) return { servers: {} };
      return res.json();
    } catch {
      return { servers: {} };
    }
  },

  async getLiveSpyState(): Promise<{ state: LiveSpyPublicState | null }> {
    const res = await authFetch(`${API_BASE}/games/live-spy/state`);
    if (!res.ok) return { state: null };
    return res.json();
  },

  async getLiveSpySecret(): Promise<{ secret: LiveSpySecretAssignment | null }> {
    const res = await authFetch(`${API_BASE}/games/live-spy/secret`);
    if (!res.ok) return { secret: null };
    return res.json();
  },

  async joinLiveSpyQueue(capacity: LiveSpyCapacity): Promise<{ state: LiveSpyPublicState }> {
    const res = await authFetch(`${API_BASE}/games/live-spy/play-now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capacity }),
    });
    return parseJsonOrThrow(res);
  },

  async leaveLiveSpyRoom(): Promise<{ ok: boolean }> {
    const res = await authFetch(`${API_BASE}/games/live-spy/leave`, {
      method: 'POST',
    });
    if (!res.ok) return { ok: false };
    return res.json();
  },
};
