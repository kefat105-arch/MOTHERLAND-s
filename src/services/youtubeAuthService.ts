/**
 * Official Google OAuth 2.0 & YouTube Channel Integration Service
 * - Handles Google OAuth sign-in flow for Google Identity and YouTube Data API v3
 * - Supports Google Account Chooser (prompt: 'select_account')
 * - Supports accounts with or without a YouTube channel
 * - Disconnect YouTube permissions without deleting MOTHERLAND profile
 * - Implements genuine video upload via YouTube Data API v3 resumable endpoint
 */

export interface GoogleAuthUser {
  accessToken: string;
  expiresAt: number;
  email: string;
  name: string;
  avatarUrl: string;
  googleId?: string;
  hasYouTubeChannel: boolean;
  channelId?: string;
  channelTitle?: string;
  channelHandle?: string;
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
  description?: string;
}

const GOOGLE_AUTH_STORAGE_KEY = 'motherland_google_youtube_auth_v3';

export const GOOGLE_OAUTH_CLIENT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ||
  '659697151808-google-studio-client.apps.googleusercontent.com';

export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
].join(' ');

export function getStoredGoogleAuth(): GoogleAuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed: GoogleAuthUser = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredGoogleAuth(auth: GoogleAuthUser): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch (e) {
    console.error('Failed to store Google auth:', e);
  }
}

export function removeStoredGoogleAuth(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to remove Google auth:', e);
  }
}

/**
 * Generates official Google OAuth 2.0 URL with prompt=select_account
 * so user can select from existing Google accounts or add another account
 */
export function getOfficialGoogleOAuthUrl(): string {
  const redirectUri = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: GOOGLE_OAUTH_SCOPES,
    include_granted_scopes: 'true',
    prompt: 'select_account', // Forces Google Account Chooser
    state: 'motherland_google_auth',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function triggerGoogleIdentityPrompt(
  onSuccess: (user: GoogleAuthUser) => void,
  onError: (err: string) => void
): void {
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        scope: GOOGLE_OAUTH_SCOPES,
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            onError('Google Sign-In was cancelled or failed: ' + tokenResponse.error);
            return;
          }
          try {
            const accessToken = tokenResponse.access_token;
            const userInfo = await fetchGoogleUserInfo(accessToken);
            const channelData = await fetchAuthenticatedChannel(accessToken);
            const authUser: GoogleAuthUser = {
              accessToken,
              expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
              email: userInfo.email,
              name: userInfo.name,
              avatarUrl: channelData?.avatarUrl || userInfo.picture,
              googleId: userInfo.sub,
              hasYouTubeChannel: !!channelData,
              channelId: channelData?.channelId,
              channelTitle: channelData?.channelTitle,
              channelHandle: channelData?.channelHandle,
              subscriberCount: channelData?.subscriberCount,
              videoCount: channelData?.videoCount,
              viewCount: channelData?.viewCount,
              description: channelData?.description,
            };
            saveStoredGoogleAuth(authUser);
            onSuccess(authUser);
          } catch (err: any) {
            onError(err?.message || 'Failed to fetch Google user details');
          }
        },
      });
      client.requestAccessToken();
    } catch (err: any) {
      onError(err?.message || 'Google Identity initialization failed');
    }
  } else {
    onError('Google Identity Services SDK is still loading or blocked. Try again or use email sign-in.');
  }
}

/**
 * Fetch Google UserInfo (email, name, picture, sub)
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<{
  sub: string;
  email: string;
  name: string;
  picture: string;
}> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google UserInfo fetch failed (${response.status})`);
  }

  const data = await response.json();
  return {
    sub: data.sub || '',
    email: data.email || 'user@gmail.com',
    name: data.name || 'Google User',
    picture:
      data.picture ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
  };
}

/**
 * Fetch authenticated YouTube channel (if user has created one)
 */
export async function fetchAuthenticatedChannel(
  accessToken: string
): Promise<Partial<GoogleAuthUser> | null> {
  try {
    const url =
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true';
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      // Account does not have a YouTube channel created yet
      return null;
    }

    const channel = data.items[0];
    const snippet = channel.snippet || {};
    const stats = channel.statistics || {};

    const subscriberCount = stats.hiddenSubscriberCount
      ? 'Hidden by creator'
      : stats.subscriberCount
      ? formatCount(stats.subscriberCount)
      : '0';

    return {
      channelId: channel.id,
      channelTitle: snippet.title || 'YouTube Channel',
      channelHandle:
        snippet.customUrl || `@${snippet.title?.toLowerCase().replace(/\s+/g, '_') || 'creator'}`,
      avatarUrl:
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        snippet.thumbnails?.default?.url,
      subscriberCount,
      videoCount: stats.videoCount ? Number(stats.videoCount).toLocaleString() : '0',
      viewCount: stats.viewCount ? formatCount(stats.viewCount) : '0',
      description: snippet.description || '',
    };
  } catch (e) {
    console.warn('Channel fetch error:', e);
    return null;
  }
}

/**
 * Synchronize Google OAuth user identity with backend database
 */
export async function syncGoogleUserWithBackend(
  accessToken: string,
  clientData?: Partial<GoogleAuthUser>
): Promise<any> {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken,
        clientUserData: clientData,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return json.user;
    }
  } catch (err) {
    console.warn('Failed syncing Google user with backend:', err);
  }
  return null;
}

/**
 * Disconnect YouTube channel permissions without deleting MOTHERLAND profile
 */
export async function disconnectYouTubeChannel(userId: string): Promise<boolean> {
  const current = getStoredGoogleAuth();
  if (current) {
    current.hasYouTubeChannel = false;
    current.channelId = undefined;
    current.channelTitle = undefined;
    current.channelHandle = undefined;
    current.subscriberCount = undefined;
    current.videoCount = undefined;
    current.viewCount = undefined;
    current.description = undefined;
    saveStoredGoogleAuth(current);
  }

  try {
    const res = await fetch('/api/auth/disconnect-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return res.ok;
  } catch {
    return true;
  }
}

function formatCount(numStr?: string): string {
  if (!numStr) return '0';
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return numStr;
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

/**
 * Upload options for YouTube Data API v3
 */
export interface YouTubeUploadPayload {
  title: string;
  description: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  tags: string[];
  categoryId?: string;
  madeForKids: boolean;
  videoFile?: File | null;
  onProgress?: (percent: number) => void;
}

export interface YouTubeUploadResult {
  success: boolean;
  videoId?: string;
  watchUrl?: string;
  embedUrl?: string;
  title: string;
  status: 'published' | 'processing' | 'private' | 'unlisted' | 'failed';
  error?: string;
  channelTitle?: string;
  publishedAt: string;
}

/**
 * Execute real video upload to YouTube Data API v3
 */
export async function uploadVideoToYouTube(
  accessToken: string,
  payload: YouTubeUploadPayload
): Promise<YouTubeUploadResult> {
  const metadata = {
    snippet: {
      title: payload.title.trim(),
      description: payload.description.trim(),
      tags: payload.tags.length > 0 ? payload.tags : ['Motherland', 'Bangladesh', 'Video'],
      categoryId: payload.categoryId || '22', // 22 = People & Blogs
    },
    status: {
      privacyStatus: payload.privacyStatus,
      selfDeclaredMadeForKids: payload.madeForKids,
      embeddable: true,
    },
  };

  if (!payload.videoFile) {
    return {
      success: false,
      title: payload.title,
      status: 'failed',
      error: 'Please select a valid video file to upload to YouTube.',
      publishedAt: new Date().toISOString(),
    };
  }

  try {
    payload.onProgress?.(10);

    // 1. Initiate Resumable Upload Session
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': payload.videoFile.type || 'video/mp4',
          'X-Upload-Content-Length': payload.videoFile.size.toString(),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initResponse.ok) {
      const errJson = await initResponse.json().catch(() => ({}));
      const errMsg = errJson.error?.message || `YouTube upload initiation failed (HTTP ${initResponse.status})`;
      throw new Error(errMsg);
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('YouTube did not return a valid resumable upload location header.');
    }

    payload.onProgress?.(30);

    // 2. Perform file upload with progress tracking via XMLHttpRequest
    return new Promise<YouTubeUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', payload.videoFile!.type || 'video/mp4');

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round(30 + (e.loaded / e.total) * 65);
          payload.onProgress?.(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const data = JSON.parse(xhr.responseText);
            const videoId = data.id;
            payload.onProgress?.(100);

            resolve({
              success: true,
              videoId,
              watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
              embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1`,
              title: data.snippet?.title || payload.title,
              status: payload.privacyStatus === 'public' ? 'published' : payload.privacyStatus,
              publishedAt: new Date().toISOString(),
            });
          } catch (e) {
            reject(new Error('Failed to parse YouTube upload response'));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error?.message || `YouTube upload failed with HTTP status ${xhr.status}`));
          } catch {
            reject(new Error(`YouTube upload failed with HTTP status ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during YouTube video upload. Please check your connection.'));
      };

      xhr.send(payload.videoFile);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      title: payload.title,
      status: 'failed',
      error: message,
      publishedAt: new Date().toISOString(),
    };
  }
}
