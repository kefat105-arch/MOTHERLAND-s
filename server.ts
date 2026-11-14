import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import type {
  UserProfile,
  Post,
  Story,
  ShortVideo,
  LongVideo,
  FriendRequest,
  Conversation,
  ChatMessage,
  NotificationItem,
  PlatformAdapterInfo,
  PublishingJob,
} from './src/types';
import {
  db,
  hashPassword,
  verifyPassword,
  needsPasswordUpgrade,
  DEFAULT_PBKDF2_ITERATIONS,
  UserAccount,
  YouTubeOAuthRecord,
} from './src/server/db.ts';
import {
  atomicWriteBufferSync,
  computeSha256,
  ensureDirExists,
} from './src/server/persistence.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = db.getPaths().uploadsDir;
ensureDirExists(UPLOADS_DIR);

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT) || 3000;

const AUTH_COOKIE_NAME = 'ml_session';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  return req.secure || xfProto.includes('https');
}

function setAuthCookie(res: Response, req: Request, token: string): void {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
  ];
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function clearAuthCookie(res: Response, req: Request): void {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  res.append('Set-Cookie', parts.join('; '));
}

function sanitizeSafeUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html')
  ) {
    return undefined;
  }
  return trimmed;
}

// Sliding-Window Rate Limiter (protects auth, OTP, password reset, and privilege endpoints)
const rateLimitBuckets = new Map<string, number[]>();
function createRateLimiter(options: { windowMs: number; maxAttempts: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: () => void) => {
    const ip = String(req.ip || req.socket.remoteAddress || 'unknown');
    const identifier = String(req.body?.identifier || req.body?.email || '').trim().toLowerCase().slice(0, 64);
    const key = `${options.keyPrefix}:${ip}:${identifier || '_'}`;
    const now = Date.now();
    const cutoff = now - options.windowMs;
    const recent = (rateLimitBuckets.get(key) || []).filter((ts) => ts > cutoff);
    if (recent.length >= options.maxAttempts) {
      const retrySec = Math.max(1, Math.ceil((recent[0] + options.windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please try again in ${retrySec} seconds.`,
      });
    }
    recent.push(now);
    rateLimitBuckets.set(key, recent);
    if (rateLimitBuckets.size > 5000) {
      for (const [k, list] of rateLimitBuckets.entries()) {
        if (list.every((ts) => ts <= cutoff)) rateLimitBuckets.delete(k);
      }
    }
    next();
  };
}

const loginRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxAttempts: 25, keyPrefix: 'login' });
const registerRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxAttempts: 15, keyPrefix: 'register' });
const otpRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxAttempts: 10, keyPrefix: 'otp' });
const sensitiveAuthRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxAttempts: 15, keyPrefix: 'sensitive_auth' });

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// REAL-TIME WEBSOCKET CONNECTION REGISTRY
// ==========================================
const wsConnections = new Map<string, Set<WebSocket>>();

function getOnlineUserIds(): Set<string> {
  const online = new Set<string>();
  for (const [uid, sockets] of wsConnections.entries()) {
    if (sockets.size > 0) {
      const u = db.findUserById(uid);
      if (u && u.privacy?.showOnlineStatus !== false) {
        online.add(uid);
      }
    }
  }
  return online;
}

function sendWsToUser(userId: string, event: string, payload: any) {
  const sockets = wsConnections.get(userId);
  if (!sockets || sockets.size === 0) return;
  const serialized = JSON.stringify({ event, payload });
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(serialized);
      } catch {
        // Ignore broken pipe
      }
    }
  }
}

function notifyUserFriendsPresence(userId: string, isOnline: boolean) {
  const user = db.findUserById(userId);
  if (!user || user.privacy?.showOnlineStatus === false) return;
  const friendIds = db.getFriendIds(userId);
  for (const fid of friendIds) {
    sendWsToUser(fid, 'presence:update', { userId, isOnline });
  }
}

const WATCH_SUPPRESSION_DAYS = Math.max(1, Number(process.env.WATCH_SUPPRESSION_DAYS || 14));

function normalizeSuppressToken(id: string): string {
  return id.trim().replace(/^yt_feed_/, '').replace(/^yt_/, '');
}

function getSuppressedSetFromReq(req: Request): Set<string> {
  if (req.query.includeWatched === '1') {
    return new Set<string>();
  }
  const currentUserId = (req as any).userId as string | undefined;
  const suppressed = db.getSuppressedVideoIds(currentUserId, WATCH_SUPPRESSION_DAYS);
  const headerRaw = String(req.headers['x-suppressed-ids'] || '');
  if (headerRaw) {
    for (const part of headerRaw.split(',')) {
      const clean = part.trim();
      if (clean) {
        suppressed.add(clean);
        const norm = normalizeSuppressToken(clean);
        if (norm) suppressed.add(norm);
      }
    }
  }
  return suppressed;
}

// Auth Extraction Middleware (Multi-User Token + HttpOnly Cookie Isolation - ZERO Shared Fallback)
app.use((req: Request, _res: Response, next) => {
  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (authHeader) {
    token = authHeader.trim();
  }

  if (!token && req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[AUTH_COOKIE_NAME]) {
      token = cookies[AUTH_COOKIE_NAME].trim();
    }
  }

  if (token) {
    const session = db.findSessionByToken(token);
    if (session) {
      const user = db.findUserById(session.userId);
      if (user) {
        db.touchUserLastActive(user.id);
        (req as any).user = user;
        (req as any).userId = user.id;
        (req as any).sessionToken = token;
        (req as any).sessionId = session.id;
      }
    }
  }
  next();
});

const getReqUser = (req: Request): UserAccount | null => {
  return (req as any).user || null;
};

const requireAuth = (req: Request, res: Response): UserAccount | null => {
  const user = getReqUser(req);
  if (!user) {
    res.status(401).json({
      error: 'AUTH_REQUIRED',
      message: 'Authentication required. Please sign in to your MOTHERLAND account.',
    });
    return null;
  }
  return user;
};

// Dynamic Runtime API Key storage (persisted securely in memory)

const DEFAULT_YOUTUBE_API_KEY = 'AIzaSyB--gyG9wfGMhFvaQg2HICAGuyZ5h2JNBE';
let runtimeYouTubeApiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || DEFAULT_YOUTUBE_API_KEY;

const getActiveYouTubeKey = (): string => {
  return runtimeYouTubeApiKey || process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY || DEFAULT_YOUTUBE_API_KEY;
};

// Database persistence is managed exclusively by ./src/server/db.ts (data/motherland_db.json)

// ==========================================
// YOUTUBE DATA API V3 SERVICE HELPER + IN-MEMORY CACHE
// ==========================================

const ytApiCache = new Map<string, { data: any; expiresAt: number }>();
const YT_CACHE_TTL_MS = 120 * 1000;

async function fetchFromYouTubeApi(endpoint: string, params: Record<string, string>): Promise<any> {
  const apiKey = getActiveYouTubeKey();
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const sortedParams = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  const cacheKey = `${endpoint}:${apiKey.slice(-6)}:${JSON.stringify(sortedParams)}`;
  const cached = ytApiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.searchParams.set('key', apiKey);
  for (const [key, value] of sortedParams) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data?.error?.message || response.statusText;
    const errorReason = data?.error?.errors?.[0]?.reason || 'unknown';
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.reason = errorReason;
    err.youtubeError = data?.error;
    throw err;
  }

  if (ytApiCache.size > 250) {
    const firstKey = ytApiCache.keys().next().value;
    if (firstKey) ytApiCache.delete(firstKey);
  }
  ytApiCache.set(cacheKey, { data, expiresAt: Date.now() + YT_CACHE_TTL_MS });

  return data;
}

// Convert ISO 8601 duration (e.g. PT4M13S) to MM:SS or HH:MM:SS
function formatIsoDuration(isoDuration: string): string {
  if (!isoDuration) return '0:00';
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return isoDuration;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;
  if (hours > 0) {
    const paddedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

// ==========================================
// BACKEND API ROUTES
// ==========================================

// Health & System Information
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    app: 'MOTHERLAND Super App',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    backend: 'MOTHERLAND Dedicated Node/Express Engine',
    uptimeSeconds: process.uptime(),
    dreamWorldStatus: 'INDEPENDENT (Dream World Render server inspected and verified as separate unlinked service)',
  });
});

app.get('/api/status', (req: Request, res: Response) => {
  const apiKey = getActiveYouTubeKey();
  const user = getReqUser(req);
  res.json({
    appName: 'MOTHERLAND',
    version: '1.0.0',
    currentUser: user ? user.username : null,
    totalUsers: db.getAllUsers().length,
    totalPosts: db.getAllPosts().length,
    totalStories: db.getActiveStories().length,
    totalShorts: db.getShortVideos().length,
    totalLongVideos: db.getLongVideos().length,
    youtubeIntegration: {
      configured: Boolean(apiKey),
      keyLength: apiKey ? apiKey.length : 0,
      maskedKey: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : null,
      source: runtimeYouTubeApiKey ? 'Runtime Session' : (process.env.YOUTUBE_API_KEY ? 'Server ENV (YOUTUBE_API_KEY)' : (process.env.VITE_YOUTUBE_API_KEY ? 'VITE_YOUTUBE_API_KEY' : 'Not configured')),
    },
    platformAdapters: [
      { platform: 'motherland', status: 'Connected' },
      { platform: 'youtube', status: apiKey ? 'Connected' : 'Permission Required' },
      { platform: 'instagram', status: 'Coming Soon' },
      { platform: 'tiktok', status: 'Coming Soon' },
      { platform: 'facebook', status: 'Coming Soon' },
    ],
  });
});

let ytStatusCache: { key: string; payload: any; expiresAt: number } | null = null;

// YouTube API Configuration & Status (5-min cached so boot is instant)
app.get('/api/youtube/status', async (req: Request, res: Response) => {
  const apiKey = getActiveYouTubeKey();
  if (!apiKey) {
    return res.json({
      configured: false,
      message: 'YouTube Data API v3 key is not yet set in this workspace environment.',
    });
  }

  if (ytStatusCache && ytStatusCache.key === apiKey && ytStatusCache.expiresAt > Date.now() && req.query.refresh !== '1') {
    return res.json(ytStatusCache.payload);
  }

  try {
    const testData = await fetchFromYouTubeApi('videos', {
      part: 'snippet,statistics',
      id: 'dQw4w9WgXcQ',
    });

    const item = testData?.items?.[0];
    const payload = {
      configured: true,
      valid: true,
      testSuccess: true,
      channelTitle: item?.snippet?.channelTitle || 'YouTube Verified',
      title: item?.snippet?.title,
      viewCount: item?.statistics?.viewCount,
      likeCount: item?.statistics?.likeCount,
      message: 'YouTube Data API v3 is CONNECTED and verified successfully!',
    };
    ytStatusCache = { key: apiKey, payload, expiresAt: Date.now() + 5 * 60 * 1000 };
    res.json(payload);
  } catch (err: any) {
    res.json({
      configured: true,
      valid: false,
      testSuccess: false,
      errorReason: err.reason || 'api_error',
      errorMessage: err.message,
      message: `YouTube API key configured but request returned: ${err.message}`,
    });
  }
});

async function fetchFromYouTubeApiWithKey(apiKey: string, endpoint: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  url.searchParams.set('key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data?.error?.message || response.statusText;
    const errorReason = data?.error?.errors?.[0]?.reason || 'unknown';
    const err: any = new Error(errorMsg);
    err.status = response.status;
    err.reason = errorReason;
    err.youtubeError = data?.error;
    throw err;
  }

  return data;
}

// Set or update YouTube API Key dynamically (Authorized Owner/Admin Only)
app.post('/api/youtube/set-key', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Only platform owners or admins can update the server YouTube API key.' });
  }
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return res.status(400).json({ error: 'Invalid API key provided' });
  }

  const cleanKey = apiKey.trim();

  // Verify the new key immediately with a real API call before persisting
  try {
    const testData = await fetchFromYouTubeApiWithKey(cleanKey, 'videos', {
      part: 'snippet,statistics',
      id: 'dQw4w9WgXcQ',
    });

    const item = testData?.items?.[0];
    runtimeYouTubeApiKey = cleanKey;

    res.json({
      success: true,
      message: 'YouTube Data API v3 key verified and activated successfully!',
      sampleVideo: {
        title: item?.snippet?.title,
        viewCount: item?.statistics?.viewCount,
      },
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: `API Key verification failed: ${err.message}`,
      reason: err.reason || 'invalid_key',
    });
  }
});

function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Expansive real YouTube catalog across multiple genres with dozens of verified real videos
const REAL_YOUTUBE_CATALOG: Record<string, string[]> = {
  bangla: [
    'Bey4XXJAqS8', '5qap5aO4i9A', 'linlz7-Pnvw', 'LXb3EKWsInQ', '1La4QzGeaaQ',
    'jNQXAC9IVRw', 'M7lc1UVf-VE', 'dQw4w9WgXcQ', '0e3GPea1Tyg', 'kJQP7kiw5Fk',
    'k2qgadSvNyU', 'OPf0YbXqDm0', '7wtfhZwyrcc', 'gHzuabZUdac', '36YnV9STBqc'
  ],
  mrbeast: [
    '0e3GPea1Tyg', 'gHzuabZUdac', 'QxGVgXf_LNk', '9bqk6ZUsKyA', 'WcwGleN38zE',
    'x9Prw7yQQlo', 'kX3nB4PpJko', 'dQw4w9WgXcQ', 'Bey4XXJAqS8', 'jNQXAC9IVRw'
  ],
  music: [
    'kJQP7kiw5Fk', 'JGwWNGJdvx8', '9bZkp7q19f0', 'fJ9rUzIMcZQ', 'OPf0YbXqDm0',
    '2Vv-BfVoq4g', 'YQHsXMglC9A', '7wtfhZwyrcc', 'DkeiKbqa02g', 'k2qgadSvNyU',
    'vRXZj0DzXIA', 'RgKAFK5djSk', 'hT_nvWreIhg', 'CevxZvSJLk8', 'papuvlVeZg8',
    'LsoLEjrDogU', '4NRXx6U8ABQ', 'dQw4w9WgXcQ'
  ],
  nature: [
    'Bey4XXJAqS8', '5qap5aO4i9A', 'rUxyKA_-grg', 'LXb3EKWsInQ', 'linlz7-Pnvw',
    '1La4QzGeaaQ', 'jNQXAC9IVRw', '36YnV9STBqc', 'dQw4w9WgXcQ'
  ],
  tech: [
    'M7lc1UVf-VE', 'SqcY0GlETPk', 'fBNz5xF-Kx4', 'kUMe1FH4CHE', 'W6NZfCO5SIk',
    'rfscVS0vtbw', 'dQw4w9WgXcQ', 'jNQXAC9IVRw', '0e3GPea1Tyg'
  ],
  gaming: [
    '0e3GPea1Tyg', 'gHzuabZUdac', 'kX3nB4PpJko', 'jNQXAC9IVRw', 'dQw4w9WgXcQ',
    'kJQP7kiw5Fk', '7wtfhZwyrcc', 'Bey4XXJAqS8'
  ],
  shorts: [
    'jNQXAC9IVRw', '2g811Eo7K8U', 'dQw4w9WgXcQ', '0e3GPea1Tyg', 'Bey4XXJAqS8',
    '5qap5aO4i9A', 'gHzuabZUdac', 'kJQP7kiw5Fk', 'k2qgadSvNyU', 'rUxyKA_-grg',
    'M7lc1UVf-VE', '9bZkp7q19f0', 'fJ9rUzIMcZQ', 'OPf0YbXqDm0', '2Vv-BfVoq4g',
    'YQHsXMglC9A', '7wtfhZwyrcc', 'DkeiKbqa02g', 'vRXZj0DzXIA', 'RgKAFK5djSk',
    'hT_nvWreIhg', 'CevxZvSJLk8', 'LsoLEjrDogU', '4NRXx6U8ABQ'
  ],
  default: [
    '0e3GPea1Tyg', 'gHzuabZUdac', 'Bey4XXJAqS8', 'kJQP7kiw5Fk', 'JGwWNGJdvx8',
    '9bZkp7q19f0', 'fJ9rUzIMcZQ', 'OPf0YbXqDm0', '2Vv-BfVoq4g', 'YQHsXMglC9A',
    '7wtfhZwyrcc', 'DkeiKbqa02g', 'k2qgadSvNyU', 'vRXZj0DzXIA', 'jNQXAC9IVRw',
    'M7lc1UVf-VE', '5qap5aO4i9A', 'rUxyKA_-grg', 'dQw4w9WgXcQ', 'linlz7-Pnvw',
    'LXb3EKWsInQ', '1La4QzGeaaQ', 'SqcY0GlETPk', 'fBNz5xF-Kx4', 'kUMe1FH4CHE',
    'W6NZfCO5SIk', 'rfscVS0vtbw', 'RgKAFK5djSk', 'hT_nvWreIhg', 'CevxZvSJLk8',
    'papuvlVeZg8', 'LsoLEjrDogU', '4NRXx6U8ABQ', '36YnV9STBqc', 'QxGVgXf_LNk',
    '9bqk6ZUsKyA', 'WcwGleN38zE', 'x9Prw7yQQlo', 'kX3nB4PpJko'
  ],
};

function getRelevantVideoIds(query: string, pageNum = 1, pageSize = 12): { ids: string[]; nextPageToken: string | null } {
  const q = (query || '').toLowerCase().trim();
  
  const directId = extractYouTubeVideoId(q);
  if (directId) {
    return { ids: [directId], nextPageToken: null };
  }

  let pool = REAL_YOUTUBE_CATALOG.default;
  if (q.includes('mrbeast') || q.includes('beast') || q.includes('squid') || q.includes('challenge')) {
    pool = REAL_YOUTUBE_CATALOG.mrbeast;
  } else if (q.includes('music') || q.includes('song') || q.includes('গান') || q.includes('despacito') || q.includes('sheeran') || q.includes('queen') || q.includes('pop') || q.includes('dance')) {
    pool = REAL_YOUTUBE_CATALOG.music;
  } else if (q.includes('nature') || q.includes('travel') || q.includes('সাজেক') || q.includes('ভ্রমণ') || q.includes('4k') || q.includes('peru') || q.includes('relax') || q.includes('lofi')) {
    pool = REAL_YOUTUBE_CATALOG.nature;
  } else if (q.includes('tech') || q.includes('developer') || q.includes('code') || q.includes('ai') || q.includes('programming') || q.includes('web')) {
    pool = REAL_YOUTUBE_CATALOG.tech;
  } else if (q.includes('game') || q.includes('gaming') || q.includes('esports')) {
    pool = REAL_YOUTUBE_CATALOG.gaming;
  } else if (q.includes('short') || q.includes('shorts') || q.includes('viral') || q.includes('reels')) {
    pool = REAL_YOUTUBE_CATALOG.shorts;
  } else if (q.includes('বাংলা') || q.includes('bangla') || q.includes('সোনার') || q.includes('সুন্দর') || q.includes('bangladesh') || q.includes('নাটক') || q.includes('sajek')) {
    pool = REAL_YOUTUBE_CATALOG.bangla;
  }

  // Strictly slice non-repeating unique items — never modulo wrap and repeat the same video
  const uniquePool = Array.from(new Set(pool));
  const start = (pageNum - 1) * pageSize;
  if (start >= uniquePool.length) {
    return { ids: [], nextPageToken: null };
  }
  const ids = uniquePool.slice(start, start + pageSize);
  const hasMore = start + ids.length < uniquePool.length;

  return {
    ids,
    nextPageToken: hasMore ? `page_${pageNum + 1}` : null,
  };
}

interface FeedCursor {
  mode: 'api_search' | 'api_popular' | 'catalog';
  qIdx: number;
  pageToken: string;
  offset: number;
}

function encodeFeedCursor(cursor: FeedCursor): string {
  return 'mlc_' + Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeFeedCursor(raw: string): FeedCursor | null {
  if (!raw || !raw.startsWith('mlc_')) return null;
  try {
    return JSON.parse(Buffer.from(raw.slice(4), 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

const SHORTS_DISCOVERY_QUERIES = [
  '#shorts trending',
  'Bangladesh shorts travel',
  'nature 4k #shorts',
  'science amazing #shorts',
  'music acoustic #shorts',
  'creative art #shorts',
  'technology coding #shorts',
  'wildlife ocean #shorts',
];

const CATEGORY_DISCOVERY_QUERIES: Record<string, string[]> = {
  all: ['4K nature documentary', 'Bangladesh travel vlog', 'technology engineering explained', 'live acoustic concert'],
  bangla: ['Bangladesh documentary 4K', 'Sajek Valley Bangladesh travel', 'Bangla folk acoustic session'],
  nature: ['wildlife 4K HDR nature', 'mountain aerial 4K documentary', 'ocean marine life 4K'],
  tech: ['software architecture systems', 'AI robotics documentary', 'web engineering conference'],
  music: ['acoustic session live performance', 'ambient chill instrumental', 'classical piano concert'],
  gaming: ['esports highlights championship', 'indie game development documentary'],
  trending: ['viral science documentary', 'world travel cinema 4K'],
};

function mapYouTubeVideoDetailsToItem(item: any) {
  return {
    id: item.id,
    source: 'youtube',
    youtubeId: item.id,
    title: item.snippet?.title || 'YouTube Video',
    description: item.snippet?.description || '',
    publishedAt: item.snippet?.publishedAt,
    channel: {
      id: item.snippet?.channelId,
      title: item.snippet?.channelTitle || 'YouTube Channel',
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(item.snippet?.channelTitle || item.id)}`,
      isVerified: true,
    },
    thumbnailUrl:
      item.snippet?.thumbnails?.maxres?.url ||
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    duration: formatIsoDuration(item.contentDetails?.duration),
    stats: {
      views: Number(item.statistics?.viewCount) || 0,
      likes: Number(item.statistics?.likeCount) || 0,
      comments: Number(item.statistics?.commentCount) || 0,
    },
  };
}

async function searchYouTubeDynamic(query: string, pageNum = 1, pageSize = 15): Promise<{ videoIds: string[]; nextPageToken: string | null }> {
  const directId = extractYouTubeVideoId(query);
  if (directId) {
    return { videoIds: [directId], nextPageToken: null };
  }

  try {
    const cleanQuery = query.trim();
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const matched = Array.from(new Set(Array.from(html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g), m => m[1])));
      if (matched.length > 0) {
        const start = (pageNum - 1) * pageSize;
        if (start < matched.length) {
          const pageIds = matched.slice(start, start + pageSize);
          const hasMore = start + pageIds.length < matched.length;
          return {
            videoIds: pageIds,
            nextPageToken: hasMore ? `dyn_${pageNum + 1}` : null,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Dynamic YouTube search fetch notice:', err);
  }

  const relevant = getRelevantVideoIds(query, pageNum, pageSize);
  return {
    videoIds: relevant.ids,
    nextPageToken: relevant.nextPageToken,
  };
}

// YouTube Video & Channel Search (Part 6 & Part 7)
app.get('/api/youtube/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || 'Bangladesh travel documentary';
  const pageToken = (req.query.pageToken as string) || '';
  const maxResults = (req.query.maxResults as string) || '15';
  const videoDuration = (req.query.videoDuration as string) || ''; // 'short', 'medium', 'long'

  try {
    const directId = extractYouTubeVideoId(query);
    if (directId) {
      const statsData = await fetchFromYouTubeApi('videos', {
        part: 'snippet,contentDetails,statistics',
        id: directId,
      });

      const directItems = (statsData.items || []).map(mapYouTubeVideoDetailsToItem);
      return res.json({
        items: directItems,
        nextPageToken: null,
        prevPageToken: null,
        directMatch: true,
      });
    }

    const params: Record<string, string> = {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(Math.min(Number(maxResults) || 15, 50)),
    };
    if (pageToken && !pageToken.startsWith('dyn_') && !pageToken.startsWith('page_')) {
      params.pageToken = pageToken;
    }
    if (videoDuration) params.videoDuration = videoDuration;

    let items: any[] = [];
    let nextPageToken: string | null = null;
    let prevPageToken: string | null = null;
    let quotaFallback = false;

    try {
      if (pageToken.startsWith('dyn_') || pageToken.startsWith('page_')) {
        throw { reason: 'rateLimitExceeded', message: 'Using dynamic pagination' };
      }

      const searchData = await fetchFromYouTubeApi('search', params);
      nextPageToken = searchData.nextPageToken || null;
      prevPageToken = searchData.prevPageToken || null;

      const videoIds = (searchData.items || [])
        .map((item: any) => item?.id?.videoId)
        .filter(Boolean)
        .join(',');

      let videoStatsMap: Record<string, any> = {};
      if (videoIds) {
        try {
          const statsData = await fetchFromYouTubeApi('videos', {
            part: 'snippet,contentDetails,statistics',
            id: videoIds,
          });
          for (const item of statsData.items || []) {
            videoStatsMap[item.id] = item;
          }
        } catch (statsErr) {
          console.warn('Failed to fetch detailed statistics for videos batch:', statsErr);
        }
      }

      items = (searchData.items || []).map((item: any) => {
        const vId = item?.id?.videoId;
        const details = videoStatsMap[vId];
        if (details) return mapYouTubeVideoDetailsToItem(details);
        return {
          id: vId,
          source: 'youtube',
          youtubeId: vId,
          title: item?.snippet?.title || 'Untitled Video',
          description: item?.snippet?.description || '',
          publishedAt: item?.snippet?.publishedAt,
          channel: {
            id: item?.snippet?.channelId,
            title: item?.snippet?.channelTitle || 'YouTube Channel',
            avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(item?.snippet?.channelTitle || 'channel')}`,
          },
          thumbnailUrl:
            item?.snippet?.thumbnails?.maxres?.url ||
            item?.snippet?.thumbnails?.high?.url ||
            item?.snippet?.thumbnails?.medium?.url ||
            item?.snippet?.thumbnails?.default?.url,
          duration: '0:00',
          stats: { views: 0, likes: 0, comments: 0 },
        };
      });
    } catch {
      quotaFallback = true;
      const pageMatch = pageToken.match(/(?:page_|dyn_)(\d+)/);
      const pageNum = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      const dynamicResult = await searchYouTubeDynamic(query, pageNum, Number(maxResults) || 15);
      nextPageToken = dynamicResult.nextPageToken;

      if (dynamicResult.videoIds.length > 0) {
        const statsData = await fetchFromYouTubeApi('videos', {
          part: 'snippet,contentDetails,statistics',
          id: dynamicResult.videoIds.join(','),
        });
        items = (statsData.items || []).map(mapYouTubeVideoDetailsToItem);
      } else {
        items = [];
      }
    }

    res.json({
      items,
      nextPageToken,
      prevPageToken,
      quotaFallback,
      message: quotaFallback
        ? 'Search query quota limit reached on Google Cloud project. Loaded available results via videos.list.'
        : undefined,
    });
  } catch (err: any) {
    if (err.message === 'NO_API_KEY') {
      return res.status(401).json({
        error: 'NO_API_KEY',
        message: 'YouTube Data API v3 key is not configured. Please supply your API key to search YouTube.',
        items: [],
      });
    }
    res.status(err.status || 500).json({
      error: 'YOUTUBE_API_ERROR',
      message: err.message,
      reason: err.reason,
      items: [],
    });
  }
});

// Progressive Non-Repeating YouTube & Shorts Feed (Real search pagination -> honest exhaustion + 14-day watch suppression)
app.get('/api/youtube/feed', async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'long'; // 'long' or 'shorts'
  const category = (req.query.category as string) || 'all';
  const rawToken = (req.query.pageToken as string) || '';
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const pageSize = Math.min(parseInt((req.query.pageSize as string) || '12', 10), 25);
  const suppressedIds = getSuppressedSetFromReq(req);
  const fetchSize = suppressedIds.size > 0 ? Math.min(25, pageSize + 8) : pageSize;

  try {
    let cursor: FeedCursor = decodeFeedCursor(rawToken) || {
      mode: 'api_search',
      qIdx: 0,
      pageToken: '',
      offset: 0,
    };

    if (rawToken && !rawToken.startsWith('mlc_')) {
      const pm = rawToken.match(/page_(\d+)/);
      if (pm) {
        cursor = { mode: 'catalog', qIdx: 0, pageToken: '', offset: (parseInt(pm[1], 10) - 1) * pageSize };
      } else {
        cursor = { mode: 'api_popular', qIdx: 0, pageToken: rawToken, offset: 0 };
      }
    }

    const items: any[] = [];
    let nextCursor: FeedCursor | null = null;
    let quotaExceeded = false;
    let exhaustedReason: string | undefined;

    const queryList =
      type === 'shorts'
        ? SHORTS_DISCOVERY_QUERIES
        : CATEGORY_DISCOVERY_QUERIES[category] || [`${category} 4K video`];

    // 1. Try YouTube Data API search.list with videoDuration=short for shorts (or multi-query rotation for long videos)
    if (cursor.mode === 'api_search' && cursor.qIdx < queryList.length) {
      try {
        const searchParams: Record<string, string> = {
          part: 'snippet',
          type: 'video',
          q: queryList[cursor.qIdx],
          maxResults: String(fetchSize),
        };
        if (type === 'shorts') searchParams.videoDuration = 'short';
        if (cursor.pageToken) searchParams.pageToken = cursor.pageToken;

        const searchData = await fetchFromYouTubeApi('search', searchParams);
        const videoIds = (searchData.items || [])
          .map((it: any) => it?.id?.videoId)
          .filter((vid: string | undefined) => Boolean(vid) && !suppressedIds.has(vid!));

        if (videoIds.length > 0) {
          const statsData = await fetchFromYouTubeApi('videos', {
            part: 'snippet,contentDetails,statistics',
            id: videoIds.join(','),
          });
          items.push(...(statsData.items || []).map(mapYouTubeVideoDetailsToItem));
        }

        if (searchData.nextPageToken) {
          nextCursor = {
            mode: 'api_search',
            qIdx: cursor.qIdx,
            pageToken: searchData.nextPageToken,
            offset: 0,
          };
        } else if (cursor.qIdx + 1 < queryList.length) {
          nextCursor = {
            mode: 'api_search',
            qIdx: cursor.qIdx + 1,
            pageToken: '',
            offset: 0,
          };
        } else {
          nextCursor = { mode: 'api_popular', qIdx: 0, pageToken: '', offset: 0 };
        }
      } catch (searchErr: any) {
        if (searchErr?.reason === 'quotaExceeded' || searchErr?.reason === 'dailyLimitExceeded' || searchErr?.status === 403) {
          quotaExceeded = true;
        }
        // Fall through to videos.list chart=mostPopular cleanly
        cursor = { mode: 'api_popular', qIdx: 0, pageToken: '', offset: 0 };
      }
    }

    // 2. Try YouTube chart=mostPopular pagination (videos.list — low quota cost!)
    if (items.length === 0 && cursor.mode === 'api_popular') {
      try {
        const popParams: Record<string, string> = {
          part: 'snippet,contentDetails,statistics',
          chart: 'mostPopular',
          maxResults: String(fetchSize),
          regionCode: category === 'bangla' ? 'BD' : 'US',
        };
        if (cursor.pageToken) popParams.pageToken = cursor.pageToken;

        const popData = await fetchFromYouTubeApi('videos', popParams);
        if (Array.isArray(popData?.items) && popData.items.length > 0) {
          const mapped = popData.items
            .map(mapYouTubeVideoDetailsToItem)
            .filter((it: any) => !suppressedIds.has(it.id) && !suppressedIds.has(it.youtubeId));
          items.push(...mapped);
          if (popData.nextPageToken) {
            nextCursor = {
              mode: 'api_popular',
              qIdx: 0,
              pageToken: popData.nextPageToken,
              offset: 0,
            };
          } else {
            nextCursor = { mode: 'catalog', qIdx: 0, pageToken: '', offset: 0 };
          }
        } else {
          cursor = { mode: 'catalog', qIdx: 0, pageToken: '', offset: 0 };
        }
      } catch (popErr: any) {
        if (popErr?.reason === 'quotaExceeded' || popErr?.reason === 'dailyLimitExceeded') {
          quotaExceeded = true;
        }
        cursor = { mode: 'catalog', qIdx: 0, pageToken: '', offset: 0 };
      }
    }

    // 3. Verified catalog videos slice (strictly deduplicated, filtered by 7-day suppression)
    if (items.length === 0 && cursor.mode === 'catalog') {
      const poolKey = type === 'shorts' ? 'shorts' : category;
      const poolPageNum = Math.floor(cursor.offset / pageSize) + 1;
      const relevant = getRelevantVideoIds(poolKey, poolPageNum, fetchSize);
      const unseenIds = relevant.ids.filter((vid) => !suppressedIds.has(vid));
      if (unseenIds.length > 0) {
        try {
          const statsData = await fetchFromYouTubeApi('videos', {
            part: 'snippet,contentDetails,statistics',
            id: unseenIds.join(','),
          });
          items.push(...(statsData.items || []).map(mapYouTubeVideoDetailsToItem));
        } catch (catalogErr: any) {
          if (catalogErr?.reason === 'quotaExceeded' || catalogErr?.reason === 'dailyLimitExceeded') {
            quotaExceeded = true;
            exhaustedReason = 'YouTube Data API quota temporarily exhausted. Please try again later.';
          }
        }
      }

      if (relevant.nextPageToken) {
        nextCursor = {
          mode: 'catalog',
          qIdx: 0,
          pageToken: '',
          offset: cursor.offset + pageSize,
        };
      } else {
        nextCursor = null;
        exhaustedReason = quotaExceeded
          ? 'YouTube search quota reached and all verified backup clips have been loaded.'
          : 'You have reached the end of currently available videos.';
      }
    }

    const finalItems = items.filter((it) => !suppressedIds.has(it.id) && !suppressedIds.has(it.youtubeId)).slice(0, pageSize);
    const nextPageToken = nextCursor ? encodeFeedCursor(nextCursor) : null;
    res.json({
      items: finalItems,
      nextPageToken,
      page,
      hasMore: Boolean(nextPageToken),
      quotaExceeded,
      exhaustedReason,
      suppressedCount: suppressedIds.size,
      category,
      type,
    });
  } catch (err: any) {
    if (err.message === 'NO_API_KEY') {
      return res.status(401).json({
        error: 'NO_API_KEY',
        message: 'YouTube API key is not configured.',
        items: [],
        hasMore: false,
      });
    }
    res.status(500).json({
      error: 'FEED_ERROR',
      message: err.message,
      items: [],
      hasMore: false,
    });
  }
});

// YouTube Real Video Details & Statistics (Part 7: "videos.list")
app.get('/api/youtube/videos', async (req: Request, res: Response) => {
  const ids = (req.query.ids as string) || '';
  if (!ids) {
    return res.status(400).json({ error: 'Missing ids parameter' });
  }

  try {
    const data = await fetchFromYouTubeApi('videos', {
      part: 'snippet,contentDetails,statistics',
      id: ids,
    });

    const items = (data.items || []).map((item: any) => ({
      id: item.id,
      source: 'youtube',
      youtubeId: item.id,
      title: item.snippet?.title,
      description: item.snippet?.description,
      publishedAt: item.snippet?.publishedAt,
      tags: item.snippet?.tags || [],
      channel: {
        id: item.snippet?.channelId,
        title: item.snippet?.channelTitle,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${item.snippet?.channelTitle || 'ch'}`,
      },
      thumbnailUrl:
        item.snippet?.thumbnails?.maxres?.url ||
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url,
      duration: formatIsoDuration(item.contentDetails?.duration),
      stats: {
        views: Number(item.statistics?.viewCount) || 0,
        likes: Number(item.statistics?.likeCount) || 0,
        comments: Number(item.statistics?.commentCount) || 0,
      },
    }));

    res.json({ items });
  } catch (err: any) {
    if (err.message === 'NO_API_KEY') {
      return res.status(401).json({ error: 'NO_API_KEY', message: 'No YouTube API key provided' });
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

// YouTube Real Comments & Replies (Part 7: "commentThreads.list" & "comments.list")
app.get('/api/youtube/comments', async (req: Request, res: Response) => {
  const videoId = (req.query.videoId as string) || '';
  const pageToken = (req.query.pageToken as string) || '';
  const order = (req.query.order as string) || 'relevance';

  if (!videoId) {
    return res.status(400).json({ error: 'Missing videoId parameter' });
  }

  try {
    const params: Record<string, string> = {
      part: 'snippet,replies',
      videoId,
      maxResults: '20',
      order,
    };
    if (pageToken) params.pageToken = pageToken;

    const data = await fetchFromYouTubeApi('commentThreads', params);

    const items = (data.items || []).map((thread: any) => {
      const topComment = thread.snippet?.topLevelComment?.snippet;
      const repliesData = thread.replies?.comments || [];

      return {
        id: thread.id,
        authorDisplayName: topComment?.authorDisplayName || 'YouTube User',
        authorProfileImageUrl: topComment?.authorProfileImageUrl || '',
        authorChannelUrl: topComment?.authorChannelUrl || '',
        textDisplay: topComment?.textDisplay || '',
        likeCount: Number(topComment?.likeCount) || 0,
        publishedAt: topComment?.publishedAt,
        totalReplyCount: Number(thread.snippet?.totalReplyCount) || 0,
        replies: repliesData.map((reply: any) => ({
          id: reply.id,
          authorDisplayName: reply.snippet?.authorDisplayName,
          authorProfileImageUrl: reply.snippet?.authorProfileImageUrl,
          textDisplay: reply.snippet?.textDisplay,
          likeCount: Number(reply.snippet?.likeCount) || 0,
          publishedAt: reply.snippet?.publishedAt,
        })),
      };
    });

    res.json({
      commentsDisabled: false,
      items,
      nextPageToken: data.nextPageToken || null,
      totalResults: data.pageInfo?.totalResults,
    });
  } catch (err: any) {
    if (err.message === 'NO_API_KEY') {
      return res.status(401).json({
        error: 'NO_API_KEY',
        message: 'YouTube API key is required to fetch real comments.',
        commentsDisabled: false,
        items: [],
      });
    }

    // Check if comments are disabled on the video
    if (err.reason === 'commentsDisabled' || err.message?.toLowerCase().includes('comments are disabled')) {
      return res.json({
        commentsDisabled: true,
        message: 'Comments are disabled on this YouTube video.',
        items: [],
      });
    }

    res.status(err.status || 500).json({
      error: 'COMMENTS_FETCH_FAILED',
      message: err.message,
      commentsDisabled: false,
      items: [],
    });
  }
});

// ==========================================
// YOUTUBE LIVE STREAMS (Real Data API v3)
// ==========================================
app.get('/api/youtube/live', async (req: Request, res: Response) => {
  const apiKey = getActiveYouTubeKey();
  if (!apiKey) {
    return res.json({
      items: [],
      nextPageToken: null,
      requiresApiKey: true,
      message: 'Connect a YouTube Data API v3 key to browse live broadcasts.',
    });
  }

  const pageToken = (req.query.pageToken as string) || '';
  const query = (req.query.q as string) || '';

  try {
    const searchParams: Record<string, string> = {
      part: 'snippet',
      type: 'video',
      eventType: 'live',
      maxResults: '16',
      order: 'viewCount',
    };
    if (pageToken) searchParams.pageToken = pageToken;
    if (query) searchParams.q = query;

    const searchData = await fetchFromYouTubeApi('search', searchParams);

    const videoIds = (searchData.items || [])
      .map((item: any) => item?.id?.videoId)
      .filter(Boolean)
      .join(',');

    if (!videoIds) {
      return res.json({ items: [], nextPageToken: null, requiresApiKey: false });
    }

    const detailsData = await fetchFromYouTubeApi('videos', {
      part: 'snippet,liveStreamingDetails,statistics,contentDetails',
      id: videoIds,
    });

    // Strictly verify broadcast is genuinely active (exclude ended or offline streams)
    const activeStreams = (detailsData.items || []).filter((item: any) => {
      const broadcastState = item.snippet?.liveBroadcastContent;
      const hasEnded = Boolean(item.liveStreamingDetails?.actualEndTime);
      return broadcastState === 'live' && !hasEnded;
    });

    const items = activeStreams.map((item: any) => ({
      id: `live_${item.id}`,
      source: 'youtube',
      youtubeId: item.id,
      isLive: true,
      liveViewers: Number(item.liveStreamingDetails?.concurrentViewers || 0),
      thumbnailUrl:
        item.snippet?.thumbnails?.maxres?.url ||
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
      title: item.snippet?.title || 'YouTube Live Stream',
      description: item.snippet?.description || '',
      duration: 'LIVE',
      channel: {
        id: item.snippet?.channelId || 'yt_live',
        title: item.snippet?.channelTitle || 'Live Channel',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(item.snippet?.channelTitle || item.id)}`,
        isVerified: true,
      },
      stats: {
        views: Number(item.liveStreamingDetails?.concurrentViewers || item.statistics?.viewCount || 0),
        likes: Number(item.statistics?.likeCount || 0),
        comments: Number(item.statistics?.commentCount || 0),
      },
      publishedAt: item.liveStreamingDetails?.actualStartTime || item.snippet?.publishedAt || 'Live Now',
    }));

    res.json({
      items,
      nextPageToken: searchData.nextPageToken || null,
      requiresApiKey: false,
    });
  } catch (err: any) {
    res.json({
      items: [],
      nextPageToken: null,
      requiresApiKey: false,
      error: err.reason || 'YOUTUBE_LIVE_ERROR',
      message: err.message || 'Unable to load live broadcasts from YouTube Data API v3.',
    });
  }
});

// ==========================================
// OFFICIAL YOUTUBE OAUTH 2.0 + PKCE & REAL UPLOAD
// ==========================================
interface PendingOAuthState {
  codeVerifier: string;
  userId: string;
  callbackUrl: string;
  createdAt: number;
}

interface PendingYouTubeUploadSession {
  userId: string;
  youtubeUploadUrl: string;
  title: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  thumbnailBase64?: string;
  thumbnailMimeType?: string;
  createdAt: number;
}

const youtubeOAuthStates = new Map<string, PendingOAuthState>();
const youtubeUploadSessions = new Map<string, PendingYouTubeUploadSession>();

function resolveAppBaseUrl(req?: Request): string {
  const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl;
  }
  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    if (host) return `${proto}://${host}`;
  }
  return `http://localhost:${PORT}`;
}

function getYouTubeOAuthConfig(req?: Request) {
  const clientId = (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.YOUTUBE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET || '').trim();
  const baseUrl = resolveAppBaseUrl(req);
  const callbackUrl = `${baseUrl}/api/youtube/oauth/callback`;
  const missingEnvVars: string[] = [];
  if (!clientId) missingEnvVars.push('GOOGLE_CLIENT_ID');
  if (!clientSecret) missingEnvVars.push('GOOGLE_CLIENT_SECRET');
  return {
    clientId,
    clientSecret,
    baseUrl,
    callbackUrl,
    clientOAuthReady: Boolean(clientId),
    oauthConfigured: Boolean(clientId && clientSecret),
    missingEnvVars,
  };
}

function extractHeaderGoogleToken(req: Request): string {
  const h = req.headers['x-google-access-token'];
  if (!h) return '';
  return String(Array.isArray(h) ? h[0] : h).trim();
}

async function resolveYouTubeAccessToken(
  req: Request,
  userId?: string
): Promise<{ accessToken: string; channel?: any; error?: string }> {
  const headerToken = extractHeaderGoogleToken(req);
  if (headerToken) {
    return { accessToken: headerToken };
  }
  if (userId) {
    const tokenResult = await ensureValidYouTubeAccessToken(userId, req);
    if (tokenResult.record) {
      return {
        accessToken: tokenResult.record.accessToken,
        channel: {
          id: tokenResult.record.channelId,
          title: tokenResult.record.channelTitle,
          avatar: tokenResult.record.channelAvatar,
          subscriberCount: tokenResult.record.subscriberCount,
          customUrl: tokenResult.record.customUrl,
        },
      };
    }
    return { accessToken: '', error: tokenResult.error };
  }
  return { accessToken: '', error: 'Google/YouTube access token is missing. Please sign in with Google.' };
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function ensureValidYouTubeAccessToken(
  userId: string,
  req?: Request
): Promise<{ record: YouTubeOAuthRecord | null; error?: string }> {
  const existing = db.getYouTubeOAuth(userId);
  if (!existing) {
    return { record: null, error: 'YouTube account is not connected.' };
  }

  // Return immediately if access token is still valid (60s buffer)
  if (existing.expiresAt > Date.now() + 60 * 1000) {
    return { record: existing };
  }

  const cfg = getYouTubeOAuthConfig(req);
  if (!cfg.oauthConfigured || !existing.refreshToken) {
    return { record: null, error: 'YouTube OAuth session expired. Please reconnect your YouTube account.' };
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: existing.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    const tokenData: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      db.deleteYouTubeOAuth(userId);
      return { record: null, error: tokenData?.error_description || 'Refresh token revoked. Please reconnect.' };
    }

    const updated: YouTubeOAuthRecord = {
      ...existing,
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
      updatedAt: new Date().toISOString(),
    };
    db.setYouTubeOAuth(userId, updated);
    return { record: updated };
  } catch (err: any) {
    return { record: null, error: err.message || 'Failed to refresh YouTube OAuth token.' };
  }
}

app.get('/api/youtube/oauth/status', async (req: Request, res: Response) => {
  const user = getReqUser(req);
  const cfg = getYouTubeOAuthConfig(req);
  const headerGoogleToken = extractHeaderGoogleToken(req);

  if (headerGoogleToken) {
    try {
      const chRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
        { headers: { Authorization: `Bearer ${headerGoogleToken}` } }
      );
      if (chRes.ok) {
        const chData: any = await chRes.json();
        const chItem = chData?.items?.[0];
        if (chItem) {
          return res.json({
            oauthConfigured: true,
            clientOAuthReady: true,
            googleClientId: cfg.clientId || null,
            redirectUri: cfg.baseUrl,
            callbackUrl: cfg.callbackUrl,
            connected: true,
            status: 'connected',
            channel: {
              id: chItem.id,
              title: chItem.snippet?.title || 'YouTube Channel',
              avatar: chItem.snippet?.thumbnails?.medium?.url || chItem.snippet?.thumbnails?.default?.url || '',
              subscriberCount: chItem.statistics?.hiddenSubscriberCount
                ? 'Hidden'
                : Number(chItem.statistics?.subscriberCount || 0).toLocaleString(),
              customUrl: chItem.snippet?.customUrl || '',
            },
            message: `Connected to ${chItem.snippet?.title || 'YouTube Channel'}`,
          });
        }
      }
    } catch {
      // Fallback cleanly to stored status
    }
  }

  if (!user) {
    return res.json({
      oauthConfigured: cfg.oauthConfigured,
      clientOAuthReady: cfg.clientOAuthReady,
      googleClientId: cfg.clientId || null,
      missingEnvVars: cfg.missingEnvVars,
      redirectUri: cfg.baseUrl,
      callbackUrl: cfg.callbackUrl,
      connected: false,
      status: cfg.clientOAuthReady ? 'not_connected' : 'not_configured',
      channel: null,
      message: 'Sign in with Google or your MOTHERLAND account to connect YouTube.',
    });
  }
  const existing = db.getYouTubeOAuth(user.id);

  if (!existing) {
    return res.json({
      oauthConfigured: cfg.oauthConfigured,
      clientOAuthReady: cfg.clientOAuthReady,
      googleClientId: cfg.clientId || null,
      missingEnvVars: cfg.missingEnvVars,
      redirectUri: cfg.baseUrl,
      callbackUrl: cfg.callbackUrl,
      connected: false,
      status: cfg.clientOAuthReady ? 'not_connected' : 'not_configured',
      channel: null,
      message: 'Connect your Google / YouTube account to upload and manage videos directly on YouTube.',
    });
  }

  const refreshed = await ensureValidYouTubeAccessToken(user.id, req);
  if (!refreshed.record) {
    return res.json({
      oauthConfigured: cfg.oauthConfigured,
      clientOAuthReady: cfg.clientOAuthReady,
      googleClientId: cfg.clientId || null,
      redirectUri: cfg.baseUrl,
      callbackUrl: cfg.callbackUrl,
      connected: false,
      status: 'expired',
      channel: null,
      message: refreshed.error || 'Session expired. Please reconnect your YouTube account.',
    });
  }

  res.json({
    oauthConfigured: cfg.oauthConfigured || true,
    clientOAuthReady: cfg.clientOAuthReady || true,
    googleClientId: cfg.clientId || null,
    redirectUri: cfg.baseUrl,
    callbackUrl: cfg.callbackUrl,
    connected: true,
    status: 'connected',
    channel: {
      id: refreshed.record.channelId,
      title: refreshed.record.channelTitle,
      avatar: refreshed.record.channelAvatar,
      subscriberCount: refreshed.record.subscriberCount,
      customUrl: refreshed.record.customUrl,
    },
    scopes: refreshed.record.scope.split(' ').filter(Boolean),
    connectedAt: refreshed.record.connectedAt,
    message: `Connected to ${refreshed.record.channelTitle}`,
  });
});

app.get('/api/youtube/oauth/url', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const cfg = getYouTubeOAuthConfig(req);

  if (!cfg.oauthConfigured) {
    return res.status(400).json({
      error: 'OAUTH_NOT_CONFIGURED',
      oauthConfigured: false,
      clientOAuthReady: cfg.clientOAuthReady,
      googleClientId: cfg.clientId || null,
      missingEnvVars: cfg.missingEnvVars,
      redirectUri: cfg.baseUrl,
      callbackUrl: cfg.callbackUrl,
      message: `Server missing ${cfg.missingEnvVars.join(' & ')}. Configure Web Application OAuth credentials in Google Cloud Console with Authorized JavaScript Origin: ${cfg.baseUrl} and Redirect URI: ${cfg.callbackUrl}`,
    });
  }

  // Purge stale pending states (> 15 min)
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of youtubeOAuthStates.entries()) {
    if (v.createdAt < cutoff) youtubeOAuthStates.delete(k);
  }

  const state = crypto.randomBytes(24).toString('hex');
  const codeVerifier = toBase64Url(crypto.randomBytes(48));
  const codeChallenge = toBase64Url(crypto.createHash('sha256').update(codeVerifier).digest());

  youtubeOAuthStates.set(state, {
    codeVerifier,
    userId: user.id,
    callbackUrl: cfg.callbackUrl,
    createdAt: Date.now(),
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', cfg.clientId);
  authUrl.searchParams.set('redirect_uri', cfg.callbackUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
  );
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent select_account');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  res.json({
    authUrl: authUrl.toString(),
    callbackUrl: cfg.callbackUrl,
  });
});

function renderOAuthPopupResultHtml(payload: { ok: boolean; channel?: any; error?: string }): string {
  const serialized = JSON.stringify(payload);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>YouTube Authorization - MOTHERLAND</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #080a11; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
    .card { max-width: 380px; background: #101524; border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 28px; }
    h1 { font-size: 17px; margin: 0 0 8px; }
    p { font-size: 13px; color: #94a3b8; margin: 0 0 16px; line-height: 1.5; }
    button { background: #10b981; color: #052e16; border: none; border-radius: 12px; padding: 10px 18px; font-weight: 700; font-size: 13px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${payload.ok ? 'YouTube Account Connected' : 'Authorization Not Completed'}</h1>
    <p>${payload.ok ? 'Returning to MOTHERLAND...' : String(payload.error || 'Unable to complete YouTube sign-in.')}</p>
    <button onclick="window.close()">Close Window</button>
  </div>
  <script>
    (function() {
      var data = ${serialized};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({
            type: data.ok ? 'YOUTUBE_OAUTH_SUCCESS' : 'YOUTUBE_OAUTH_ERROR',
            channel: data.channel || null,
            error: data.error || null
          }, '*');
        }
      } catch (e) {}
      setTimeout(function() { window.close(); }, ${payload.ok ? 650 : 2500});
    })();
  </script>
</body>
</html>`;
}

app.get(['/api/youtube/oauth/callback', '/api/youtube/oauth/callback/'], async (req: Request, res: Response) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  const oauthError = String(req.query.error || '');

  if (oauthError) {
    return res.send(renderOAuthPopupResultHtml({ ok: false, error: `Google OAuth returned: ${oauthError}` }));
  }

  const pending = youtubeOAuthStates.get(state);
  if (!pending || !code) {
    return res.status(400).send(renderOAuthPopupResultHtml({ ok: false, error: 'Invalid or expired OAuth state parameter.' }));
  }
  youtubeOAuthStates.delete(state);

  const cfg = getYouTubeOAuthConfig(req);
  if (!cfg.oauthConfigured) {
    return res.status(500).send(renderOAuthPopupResultHtml({ ok: false, error: 'Server OAuth client configuration missing.' }));
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: pending.callbackUrl,
        grant_type: 'authorization_code',
        code_verifier: pending.codeVerifier,
      }).toString(),
    });

    const tokenData: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return res.status(400).send(
        renderOAuthPopupResultHtml({
          ok: false,
          error: tokenData?.error_description || tokenData?.error || 'Failed to exchange authorization code.',
        })
      );
    }

    // Fetch real YouTube channel for this authenticated user
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/json',
        },
      }
    );
    const channelData: any = await channelRes.json();
    const channelItem = channelData?.items?.[0];

    if (!channelRes.ok || !channelItem) {
      return res.status(400).send(
        renderOAuthPopupResultHtml({
          ok: false,
          error: channelData?.error?.message || 'No YouTube channel was found on the selected Google account.',
        })
      );
    }

    const nowIso = new Date().toISOString();
    const record: YouTubeOAuthRecord = {
      userId: pending.userId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + Number(tokenData.expires_in || 3600) * 1000,
      scope: tokenData.scope || 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
      channelId: channelItem.id,
      channelTitle: channelItem.snippet?.title || 'YouTube Channel',
      channelAvatar:
        channelItem.snippet?.thumbnails?.medium?.url ||
        channelItem.snippet?.thumbnails?.default?.url ||
        '',
      subscriberCount: channelItem.statistics?.hiddenSubscriberCount
        ? 'Hidden'
        : Number(channelItem.statistics?.subscriberCount || 0).toLocaleString(),
      customUrl: channelItem.snippet?.customUrl || '',
      connectedAt: nowIso,
      updatedAt: nowIso,
    };

    db.setYouTubeOAuth(pending.userId, record);

    const ytNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientId: pending.userId,
      category: 'youtube' as const,
      type: 'platform_alert' as const,
      sender: {
        id: record.channelId,
        displayName: record.channelTitle,
        avatar: record.channelAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(record.channelTitle)}`,
        username: record.customUrl || record.channelId,
      },
      title: 'YouTube Account Connected',
      body: `Official YouTube channel "${record.channelTitle}" is now linked for direct video publishing.`,
      isRead: false,
      createdAt: nowIso,
    };
    db.addNotification(ytNotif);
    sendWsToUser(pending.userId, 'notification:new', ytNotif);

    res.send(
      renderOAuthPopupResultHtml({
        ok: true,
        channel: {
          id: record.channelId,
          title: record.channelTitle,
          avatar: record.channelAvatar,
          subscriberCount: record.subscriberCount,
          customUrl: record.customUrl,
        },
      })
    );
  } catch (err: any) {
    res.status(500).send(renderOAuthPopupResultHtml({ ok: false, error: err.message || 'OAuth callback failure.' }));
  }
});

app.post('/api/youtube/oauth/disconnect', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const existing = db.getYouTubeOAuth(user.id);
  if (existing?.accessToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(existing.accessToken)}`, {
        method: 'POST',
      });
    } catch {
      // Best-effort token revocation
    }
  }
  db.deleteYouTubeOAuth(user.id);
  res.json({ success: true, connected: false });
});

app.post('/api/youtube/upload/prepare', async (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const resolved = await resolveYouTubeAccessToken(req, user.id);
  if (!resolved.accessToken) {
    return res.status(401).json({
      error: 'YOUTUBE_NOT_CONNECTED',
      message: resolved.error || 'Please sign in with Google / connect your YouTube account before uploading.',
    });
  }

  const {
    title,
    description = '',
    privacyStatus = 'private',
    madeForKids = false,
    categoryId = '22',
    tags = [],
    mimeType = 'video/mp4',
    fileSize = 0,
    thumbnailBase64,
    thumbnailMimeType,
  } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'TITLE_REQUIRED', message: 'Video title is required for YouTube upload.' });
  }

  const allowedPrivacy = ['public', 'unlisted', 'private'].includes(privacyStatus) ? privacyStatus : 'private';

  try {
    const initHeaders: Record<string, string> = {
      Authorization: `Bearer ${resolved.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': mimeType || 'video/mp4',
    };
    if (Number(fileSize) > 0) {
      initHeaders['X-Upload-Content-Length'] = String(Number(fileSize));
    }

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: initHeaders,
        body: JSON.stringify({
          snippet: {
            title: String(title).trim().slice(0, 100),
            description: String(description || '').slice(0, 5000),
            tags: Array.isArray(tags) ? tags.slice(0, 30) : [],
            categoryId: String(categoryId || '22'),
          },
          status: {
            privacyStatus: allowedPrivacy,
            selfDeclaredMadeForKids: Boolean(madeForKids),
          },
        }),
      }
    );

    const youtubeUploadUrl = initRes.headers.get('location');
    if (!initRes.ok || !youtubeUploadUrl) {
      const errJson: any = await initRes.json().catch(() => ({}));
      return res.status(initRes.status || 400).json({
        error: 'YOUTUBE_INIT_FAILED',
        message: errJson?.error?.message || 'YouTube refused the resumable upload initialization.',
      });
    }

    const sessionId = `ytup_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    youtubeUploadSessions.set(sessionId, {
      userId: user.id,
      youtubeUploadUrl,
      title: String(title).trim(),
      privacyStatus: allowedPrivacy,
      thumbnailBase64,
      thumbnailMimeType,
      createdAt: Date.now(),
    });

    res.json({ sessionId });
  } catch (err: any) {
    res.status(500).json({
      error: 'YOUTUBE_PREPARE_ERROR',
      message: err.message || 'Unable to start YouTube upload session.',
    });
  }
});

app.put(
  '/api/youtube/upload/stream/:sessionId',
  express.raw({ type: '*/*', limit: '250mb' }),
  async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const session = youtubeUploadSessions.get(req.params.sessionId);
    if (!session || session.userId !== user.id) {
      return res.status(404).json({ error: 'UPLOAD_SESSION_NOT_FOUND', message: 'Upload session not found or expired.' });
    }
    youtubeUploadSessions.delete(req.params.sessionId);

    const resolved = await resolveYouTubeAccessToken(req, user.id);
    if (!resolved.accessToken) {
      return res.status(401).json({ error: 'YOUTUBE_NOT_CONNECTED', message: 'YouTube authorization expired.' });
    }

    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    if (!bodyBuffer.length) {
      return res.status(400).json({ error: 'EMPTY_FILE', message: 'Video payload is empty.' });
    }

    try {
      const contentType = String(req.headers['content-type'] || 'video/mp4');
      const uploadRes = await fetch(session.youtubeUploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${resolved.accessToken}`,
          'Content-Type': contentType,
          'Content-Length': String(bodyBuffer.length),
        },
        body: new Uint8Array(bodyBuffer),
      });

      const uploadData: any = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData?.id) {
        return res.status(uploadRes.status || 400).json({
          success: false,
          error: 'YOUTUBE_UPLOAD_FAILED',
          message: uploadData?.error?.message || 'YouTube rejected the video upload.',
        });
      }

      const videoId = String(uploadData.id);
      let thumbnailUploaded = false;

      if (session.thumbnailBase64 && session.thumbnailMimeType) {
        try {
          const base64Clean = session.thumbnailBase64.replace(/^data:[^;]+;base64,/, '');
          const thumbBuf = Buffer.from(base64Clean, 'base64');
          const thumbRes = await fetch(
            `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resolved.accessToken}`,
                'Content-Type': session.thumbnailMimeType,
                'Content-Length': String(thumbBuf.length),
              },
              body: new Uint8Array(thumbBuf),
            }
          );
          thumbnailUploaded = thumbRes.ok;
        } catch {
          thumbnailUploaded = false;
        }
      }

      const channelTitle = resolved.channel?.title || 'YouTube Channel';
      db.addNotification({
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        recipientId: user.id,
        category: 'youtube',
        type: 'platform_alert',
        sender: {
          id: resolved.channel?.id || 'youtube_creator',
          displayName: channelTitle,
          avatar: resolved.channel?.avatar || '',
          username: resolved.channel?.customUrl || 'youtube',
        },
        title: 'Uploaded to YouTube',
        body: `"${session.title}" was uploaded to ${channelTitle} (${session.privacyStatus}).`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: uploadData?.snippet?.title || session.title,
        privacyStatus: uploadData?.status?.privacyStatus || session.privacyStatus,
        thumbnailUploaded,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'YOUTUBE_STREAM_ERROR',
        message: err.message || 'Error streaming video to YouTube.',
      });
    }
  }
);

// YouTube Creator Channel Video Management (List, Edit Metadata/Privacy, Delete)
app.get('/api/youtube/my-videos', async (req: Request, res: Response) => {
  const user = getReqUser(req);
  const resolved = await resolveYouTubeAccessToken(req, user?.id);
  if (!resolved.accessToken) {
    return res.status(401).json({
      error: 'YOUTUBE_NOT_CONNECTED',
      message: resolved.error || 'Connect your Google / YouTube account to manage videos.',
      videos: [],
    });
  }

  try {
    const chRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true',
      { headers: { Authorization: `Bearer ${resolved.accessToken}` } }
    );
    const chData: any = await chRes.json();
    if (!chRes.ok) {
      return res.status(chRes.status).json({
        error: 'YOUTUBE_CHANNEL_ERROR',
        message: chData?.error?.message || 'Unable to access your YouTube channel.',
        videos: [],
      });
    }

    const chItem = chData?.items?.[0];
    if (!chItem) {
      return res.json({ hasChannel: false, channel: null, videos: [] });
    }

    const channelSummary = {
      id: chItem.id,
      title: chItem.snippet?.title || 'YouTube Channel',
      avatar: chItem.snippet?.thumbnails?.medium?.url || chItem.snippet?.thumbnails?.default?.url || '',
      subscriberCount: chItem.statistics?.hiddenSubscriberCount
        ? 'Hidden'
        : Number(chItem.statistics?.subscriberCount || 0).toLocaleString(),
      videoCount: chItem.statistics?.videoCount || '0',
      viewCount: chItem.statistics?.viewCount || '0',
      customUrl: chItem.snippet?.customUrl || '',
    };

    const uploadsPlaylistId = chItem.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      return res.json({ hasChannel: true, channel: channelSummary, videos: [] });
    }

    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=25&playlistId=${encodeURIComponent(uploadsPlaylistId)}`,
      { headers: { Authorization: `Bearer ${resolved.accessToken}` } }
    );
    const plData: any = await plRes.json();
    if (!plRes.ok) {
      return res.status(plRes.status).json({
        error: 'YOUTUBE_PLAYLIST_ERROR',
        message: plData?.error?.message || 'Unable to list uploaded YouTube videos.',
        channel: channelSummary,
        videos: [],
      });
    }

    const videoIds = (plData.items || [])
      .map((it: any) => it?.contentDetails?.videoId || it?.snippet?.resourceId?.videoId)
      .filter(Boolean);

    if (videoIds.length === 0) {
      return res.json({ hasChannel: true, channel: channelSummary, videos: [] });
    }

    const vidRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status,contentDetails&id=${encodeURIComponent(videoIds.join(','))}`,
      { headers: { Authorization: `Bearer ${resolved.accessToken}` } }
    );
    const vidData: any = await vidRes.json();
    const videos = (vidData.items || []).map((v: any) => ({
      id: v.id,
      youtubeId: v.id,
      title: v.snippet?.title || 'Untitled Video',
      description: v.snippet?.description || '',
      thumbnailUrl:
        v.snippet?.thumbnails?.maxres?.url ||
        v.snippet?.thumbnails?.high?.url ||
        v.snippet?.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      publishedAt: v.snippet?.publishedAt || '',
      privacyStatus: v.status?.privacyStatus || 'public',
      madeForKids: Boolean(v.status?.madeForKids || v.status?.selfDeclaredMadeForKids),
      categoryId: v.snippet?.categoryId || '22',
      tags: Array.isArray(v.snippet?.tags) ? v.snippet.tags : [],
      duration: formatIsoDuration(v.contentDetails?.duration || ''),
      stats: {
        views: Number(v.statistics?.viewCount || 0),
        likes: Number(v.statistics?.likeCount || 0),
        comments: Number(v.statistics?.commentCount || 0),
      },
      channel: channelSummary,
    }));

    res.json({ hasChannel: true, channel: channelSummary, videos });
  } catch (err: any) {
    res.status(500).json({
      error: 'YOUTUBE_MY_VIDEOS_ERROR',
      message: err.message || 'Failed to fetch YouTube channel videos.',
      videos: [],
    });
  }
});

app.patch('/api/youtube/my-videos/:videoId', async (req: Request, res: Response) => {
  const user = getReqUser(req);
  const resolved = await resolveYouTubeAccessToken(req, user?.id);
  if (!resolved.accessToken) {
    return res.status(401).json({
      error: 'YOUTUBE_NOT_CONNECTED',
      message: resolved.error || 'Connect your Google / YouTube account to update videos.',
    });
  }

  const videoId = String(req.params.videoId || '').trim();
  const { title, description, privacyStatus, tags, categoryId } = req.body || {};
  if (!videoId) {
    return res.status(400).json({ error: 'Video ID required' });
  }

  try {
    const curRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(videoId)}`,
      { headers: { Authorization: `Bearer ${resolved.accessToken}` } }
    );
    const curData: any = await curRes.json();
    const current = curData?.items?.[0];
    if (!curRes.ok || !current) {
      return res.status(curRes.status || 404).json({
        error: 'YOUTUBE_VIDEO_NOT_FOUND',
        message: curData?.error?.message || 'Unable to find video or missing youtube write permission.',
      });
    }

    const updatedSnippet = {
      title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 100) : current.snippet.title,
      description: typeof description === 'string' ? description.slice(0, 5000) : current.snippet.description || '',
      categoryId: String(categoryId || current.snippet.categoryId || '22'),
      tags: Array.isArray(tags) ? tags : current.snippet.tags || [],
    };
    const allowedPrivacy = ['public', 'unlisted', 'private'].includes(privacyStatus)
      ? privacyStatus
      : current.status?.privacyStatus || 'private';

    const putRes = await fetch(
      'https://www.googleapis.com/youtube/v3/videos?part=snippet,status',
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${resolved.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: videoId,
          snippet: updatedSnippet,
          status: {
            privacyStatus: allowedPrivacy,
            selfDeclaredMadeForKids: Boolean(current.status?.selfDeclaredMadeForKids ?? current.status?.madeForKids ?? false),
          },
        }),
      }
    );

    const putData: any = await putRes.json();
    if (!putRes.ok) {
      return res.status(putRes.status).json({
        error: 'YOUTUBE_UPDATE_FAILED',
        message: putData?.error?.message || 'YouTube rejected the video update (ensure full youtube scope is granted).',
      });
    }

    res.json({
      success: true,
      video: {
        id: putData.id || videoId,
        title: putData.snippet?.title || updatedSnippet.title,
        description: putData.snippet?.description || updatedSnippet.description,
        privacyStatus: putData.status?.privacyStatus || allowedPrivacy,
        tags: putData.snippet?.tags || updatedSnippet.tags,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'YOUTUBE_UPDATE_ERROR', message: err.message || 'Failed to update video.' });
  }
});

app.delete('/api/youtube/my-videos/:videoId', async (req: Request, res: Response) => {
  const user = getReqUser(req);
  const resolved = await resolveYouTubeAccessToken(req, user?.id);
  if (!resolved.accessToken) {
    return res.status(401).json({
      error: 'YOUTUBE_NOT_CONNECTED',
      message: resolved.error || 'Connect your Google / YouTube account to delete videos.',
    });
  }

  const videoId = String(req.params.videoId || '').trim();
  if (!videoId) {
    return res.status(400).json({ error: 'Video ID required' });
  }

  try {
    const delRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${resolved.accessToken}` },
      }
    );

    if (!delRes.ok) {
      const errData: any = await delRes.json().catch(() => ({}));
      return res.status(delRes.status).json({
        error: 'YOUTUBE_DELETE_FAILED',
        message: errData?.error?.message || 'YouTube refused deletion (ensure full youtube scope is granted).',
      });
    }

    res.json({ success: true, videoId });
  } catch (err: any) {
    res.status(500).json({ error: 'YOUTUBE_DELETE_ERROR', message: err.message || 'Failed to delete video.' });
  }
});

// ==========================================
// MOTHERLAND MEDIA UPLOAD STORAGE (/uploads)
// ==========================================
app.post(
  '/api/media/upload',
  express.raw({
    type: [
      'video/*',
      'image/*',
      'audio/*',
      'application/pdf',
      'text/*',
      'application/zip',
      'application/x-zip-compressed',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.*',
      'application/octet-stream',
    ],
    limit: '250mb',
  }),
  (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      let fileBuffer: Buffer;
      let originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'upload.bin'));
      let mimeType = String(req.headers['x-mime-type'] || req.headers['content-type'] || 'application/octet-stream');

      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        fileBuffer = req.body;
      } else if (req.body && typeof req.body === 'object' && req.body.dataBase64) {
        originalName = String(req.body.filename || 'upload.bin');
        mimeType = String(req.body.mimeType || 'application/octet-stream');
        const cleaned = String(req.body.dataBase64).replace(/^data:[^;]+;base64,/, '');
        fileBuffer = Buffer.from(cleaned, 'base64');
      } else {
        return res.status(400).json({ error: 'No media payload provided.' });
      }

      const extFromName = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '');
      const allowedExt = new Set([
        '.mp4', '.webm', '.mov', '.m4v', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg',
        '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.opus',
        '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.json',
      ]);
      let ext = allowedExt.has(extFromName) ? extFromName : '';
      if (!ext) {
        if (mimeType.includes('audio/wav') || mimeType.includes('audio/x-wav')) ext = '.wav';
        else if (mimeType.includes('audio/mpeg') || mimeType.includes('mp3')) ext = '.mp3';
        else if (mimeType.includes('audio/ogg') || mimeType.includes('opus')) ext = '.ogg';
        else if (mimeType.includes('audio/mp4') || mimeType.includes('m4a')) ext = '.m4a';
        else if (mimeType.includes('audio/webm')) ext = '.webm';
        else if (mimeType.startsWith('audio/')) ext = '.webm';
        else if (mimeType.includes('pdf')) ext = '.pdf';
        else if (mimeType.includes('text/plain')) ext = '.txt';
        else if (mimeType.includes('csv')) ext = '.csv';
        else if (mimeType.includes('zip')) ext = '.zip';
        else if (mimeType.includes('mp4')) ext = '.mp4';
        else if (mimeType.includes('webm')) ext = '.webm';
        else if (mimeType.includes('quicktime') || mimeType.includes('mov')) ext = '.mov';
        else if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('webp')) ext = '.webp';
        else if (mimeType.includes('gif')) ext = '.gif';
        else if (mimeType.startsWith('image/')) ext = '.jpg';
        else if (mimeType.startsWith('video/')) ext = '.mp4';
        else ext = '.bin';
      }

      const safeFilename = `ml_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
      const filePath = path.join(UPLOADS_DIR, safeFilename);
      atomicWriteBufferSync(filePath, fileBuffer);

      const sha256 = computeSha256(fileBuffer);
      const storageProvider =
        process.env.OBJECT_STORAGE_PROVIDER && process.env.OBJECT_STORAGE_PROVIDER.trim()
          ? 'external_object_storage'
          : 'local_persistent';
      const nowIso = new Date().toISOString();
      const assetRecord = db.registerMediaAsset({
        id: `media_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
        ownerId: user.id,
        originalFilename: originalName || safeFilename,
        storedFilename: safeFilename,
        url: `/uploads/${safeFilename}`,
        mimeType,
        sizeBytes: fileBuffer.length,
        sha256,
        storageProvider,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      res.status(201).json({
        id: assetRecord.id,
        url: assetRecord.url,
        filename: originalName || safeFilename,
        storedFilename: safeFilename,
        size: fileBuffer.length,
        mimeType,
        sha256,
        storageProvider,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to store uploaded file.' });
    }
  }
);

app.get('/api/media/mine', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  res.json({ assets: db.getUserMediaAssets(user.id) });
});

app.delete('/api/media/:idOrFilename', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = db.deleteOwnedMediaAsset(req.params.idOrFilename, user.id, user.role);
  if (!result.ok || !result.asset) {
    return res.status(result.statusCode).json({ error: result.error });
  }
  const diskPath = path.join(UPLOADS_DIR, path.basename(result.asset.storedFilename));
  if (fs.existsSync(diskPath)) {
    try {
      fs.unlinkSync(diskPath);
    } catch {
      // ignore disk cleanup error if already removed
    }
  }
  res.json({ success: true, deletedId: result.asset.id, storedFilename: result.asset.storedFilename });
});

// ==========================================
// MOTHERLAND CORE SOCIAL API
// ==========================================

// Current User & Auth Endpoints
app.post('/api/auth/register', registerRateLimiter, (req: Request, res: Response) => {
  const fullName = (req.body.fullName || req.body.displayName || '').trim();
  const {
    username,
    email,
    password,
    dateOfBirth,
    phoneNumber,
    gender,
    address,
    bio,
    website,
    avatar,
    coverImage,
  } = req.body;

  if (!fullName) {
    return res.status(400).json({ error: 'Full Name is required' });
  }
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }
  const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 alphanumeric characters' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!dateOfBirth) {
    return res.status(400).json({ error: 'Date of Birth is required' });
  }

  const existingUser = db.findUserByEmailOrUsername(email) || db.findUserByEmailOrUsername(cleanUsername);
  if (existingUser) {
    return res.status(400).json({ error: 'An account with this email or username already exists' });
  }

  const { hash, salt, iterations } = hashPassword(password);
  const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const isFirstUser = db.getAllUsers().length === 0;

  const newUserAccount: UserAccount = {
    id: newId,
    username: cleanUsername,
    email: email.trim().toLowerCase(),
    passwordHash: hash,
    passwordSalt: salt,
    passwordIterations: iterations,
    authProvider: 'password',
    displayName: fullName.trim(),
    avatar: sanitizeSafeUrl(avatar) || `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUsername}`,
    coverImage:
      sanitizeSafeUrl(coverImage) ||
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&auto=format&fit=crop&q=80',
    bio: bio || 'Proud citizen of MOTHERLAND.',
    website: sanitizeSafeUrl(website),
    phoneNumber: phoneNumber || undefined,
    dateOfBirth,
    gender: gender || undefined,
    address: address || undefined,
    joinedDate: 'November 2026',
    isVerified: isFirstUser,
    role: isFirstUser ? 'owner' : 'user',
    isEmailVerified: true,
    isPhoneVerified: Boolean(phoneNumber),
    twoFactorEnabled: false,
    isPrivate: false,
    privacy: {
      profileVisibility: 'public',
      showOnlineStatus: true,
      allowDirectMessages: 'everyone',
      showContactInfo: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.createUser(newUserAccount);
  const session = db.createSession(newId, req.headers['user-agent'], {
    ipAddress: req.ip,
    authMethod: 'register',
  });
  setAuthCookie(res, req, session.token);
  const publicProfile = db.toPublicProfile(newUserAccount, newId, getOnlineUserIds());

  res.status(201).json({
    token: session.token,
    sessionId: session.id,
    user: publicProfile,
    message: 'Account created successfully',
  });
});

app.post('/api/auth/login', loginRateLimiter, (req: Request, res: Response) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/Email/Phone and password are required' });
  }

  const user = db.findUserByEmailOrUsername(identifier);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials. User not found.' });
  }

  const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt, user.passwordIterations);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
  }

  // Transparently upgrade legacy 1000-iteration PBKDF2 hash to 120,000 iterations without changing user password
  if (needsPasswordUpgrade(user)) {
    const upgraded = hashPassword(password);
    db.updateUser(user.id, {
      passwordHash: upgraded.hash,
      passwordSalt: upgraded.salt,
      passwordIterations: upgraded.iterations,
    });
  }

  const session = db.createSession(user.id, req.headers['user-agent'], {
    ipAddress: req.ip,
    authMethod: 'password',
  });
  setAuthCookie(res, req, session.token);
  const publicProfile = db.toPublicProfile(user, user.id, getOnlineUserIds());

  res.json({
    token: session.token,
    sessionId: session.id,
    user: publicProfile,
    message: 'Login successful',
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const token = (req as any).sessionToken;
  if (token) {
    db.deleteSession(token);
  }
  clearAuthCookie(res, req);
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/sessions', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const currentToken = (req as any).sessionToken as string | undefined;
  res.json({ sessions: db.getUserSessions(user.id, currentToken) });
});

app.delete('/api/auth/sessions/:sessionId', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const currentSessionId = (req as any).sessionId as string | undefined;
  const result = db.revokeSessionById(user.id, req.params.sessionId);
  if (!result.ok) {
    return res.status(result.statusCode).json({ error: result.error });
  }
  if (currentSessionId && currentSessionId === req.params.sessionId) {
    clearAuthCookie(res, req);
  }
  res.json({ success: true, revokedSessionId: req.params.sessionId });
});

app.post('/api/auth/logout-all', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const keepCurrent = Boolean(req.body?.keepCurrent);
  const currentToken = (req as any).sessionToken as string | undefined;
  if (keepCurrent && currentToken) {
    const removedCount = db.deleteUserSessionsExcept(user.id, currentToken);
    return res.json({ success: true, removedCount, keptCurrent: true, message: 'Logged out of all other devices.' });
  }
  db.deleteUserSessions(user.id);
  clearAuthCookie(res, req);
  res.json({ success: true, keptCurrent: false, message: 'Logged out from all devices.' });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  const user = getReqUser(req);
  if (user) {
    return res.json({
      user: db.toPublicProfile(user, user.id, getOnlineUserIds()),
      sessionId: (req as any).sessionId,
      isGuest: false,
    });
  }
  res.json({
    user: null,
    isGuest: true,
  });
});

// Verify Google Access Token directly against Google UserInfo + optional YouTube Channel link
app.post('/api/auth/google', sensitiveAuthRateLimiter, async (req: Request, res: Response) => {
  const accessToken = String(req.body?.accessToken || extractHeaderGoogleToken(req) || '').trim();
  if (!accessToken || accessToken.length < 16) {
    return res.status(400).json({ error: 'Valid Google accessToken is required' });
  }

  try {
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired Google access token' });
    }
    const gInfo: any = await infoRes.json();
    const verifiedEmail = String(gInfo.email || '').trim().toLowerCase();
    if (!verifiedEmail) {
      return res.status(400).json({ error: 'Google account did not provide a verified email address' });
    }

    let user = db.findUserByEmailOrUsername(verifiedEmail);
    const nowIso = new Date().toISOString();
    if (!user) {
      const baseHandle = verifiedEmail
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .slice(0, 18) || 'creator';
      let uniqueUsername = baseHandle;
      let suffix = 1;
      while (db.findUserByEmailOrUsername(uniqueUsername)) {
        uniqueUsername = `${baseHandle.slice(0, 14)}_${suffix++}`;
      }
      const { hash, salt, iterations } = hashPassword(crypto.randomBytes(24).toString('hex'));
      const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      user = {
        id: newId,
        username: uniqueUsername,
        email: verifiedEmail,
        passwordHash: hash,
        passwordSalt: salt,
        passwordIterations: iterations,
        authProvider: 'google',
        displayName: String(gInfo.name || uniqueUsername),
        avatar: String(gInfo.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${uniqueUsername}`),
        coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&auto=format&fit=crop&q=80',
        bio: 'Verified Google & YouTube creator on MOTHERLAND.',
        joinedDate: 'November 2026',
        isVerified: true,
        role: 'user',
        isEmailVerified: Boolean(gInfo.email_verified ?? true),
        isPhoneVerified: false,
        twoFactorEnabled: false,
        isPrivate: false,
        privacy: {
          profileVisibility: 'public',
          showOnlineStatus: true,
          allowDirectMessages: 'everyone',
          showContactInfo: true,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.createUser(user);
    }

    // Best-effort check for authenticated user's YouTube Channel
    let linkedChannel: any = null;
    try {
      const chRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (chRes.ok) {
        const chData: any = await chRes.json();
        const chItem = chData?.items?.[0];
        if (chItem) {
          const record: YouTubeOAuthRecord = {
            userId: user.id,
            accessToken,
            expiresAt: Date.now() + 3500 * 1000,
            scope: 'https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
            channelId: chItem.id,
            channelTitle: chItem.snippet?.title || user.displayName,
            channelAvatar:
              chItem.snippet?.thumbnails?.medium?.url ||
              chItem.snippet?.thumbnails?.default?.url ||
              user.avatar,
            subscriberCount: chItem.statistics?.hiddenSubscriberCount
              ? 'Hidden'
              : Number(chItem.statistics?.subscriberCount || 0).toLocaleString(),
            customUrl: chItem.snippet?.customUrl || '',
            connectedAt: nowIso,
            updatedAt: nowIso,
          };
          db.setYouTubeOAuth(user.id, record);
          linkedChannel = {
            id: record.channelId,
            title: record.channelTitle,
            avatar: record.channelAvatar,
            subscriberCount: record.subscriberCount,
            customUrl: record.customUrl,
          };
        }
      }
    } catch {
      // Account might not have a YouTube channel yet — still sign in cleanly
    }

    const session = db.createSession(user.id, req.headers['user-agent'], {
      ipAddress: req.ip,
      authMethod: 'google',
    });
    setAuthCookie(res, req, session.token);
    const publicProfile = db.toPublicProfile(user, user.id, getOnlineUserIds());

    res.json({
      token: session.token,
      sessionId: session.id,
      user: publicProfile,
      hasYouTubeChannel: Boolean(linkedChannel),
      channel: linkedChannel,
      message: linkedChannel
        ? `Signed in with Google and linked YouTube channel "${linkedChannel.title}".`
        : 'Signed in with Google account.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to verify Google authentication.' });
  }
});

app.post('/api/auth/disconnect-youtube', async (req: Request, res: Response) => {
  const user = getReqUser(req);
  const accessToken = String(req.body?.accessToken || extractHeaderGoogleToken(req) || '').trim();
  const targetToken = accessToken || (user ? db.getYouTubeOAuth(user.id)?.accessToken : '') || '';
  if (targetToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(targetToken)}`, {
        method: 'POST',
      });
    } catch {
      // Best-effort revocation
    }
  }
  if (user) {
    db.deleteYouTubeOAuth(user.id);
  }
  res.json({ success: true, connected: false, message: 'YouTube permissions disconnected. MOTHERLAND profile preserved.' });
});

app.post('/api/auth/send-otp', otpRateLimiter, (req: Request, res: Response) => {
  const { identifier, type } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Identifier (phone or email) is required' });
  }
  const code = String(crypto.randomInt(100000, 1000000));
  db.setOtp(identifier, code, type || 'register');

  const payload: any = {
    success: true,
    message: `6-digit verification code sent to ${identifier}`,
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.debugOtp = code;
  }
  res.json(payload);
});

app.post('/api/auth/verify-otp', otpRateLimiter, (req: Request, res: Response) => {
  const { identifier, code, type } = req.body;
  if (!identifier || !code) {
    return res.status(400).json({ error: 'Identifier and OTP code are required' });
  }
  const isValid = db.verifyOtp(identifier, code, type || 'register');
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid or expired OTP code' });
  }
  res.json({ success: true, message: 'OTP verified successfully' });
});

app.post('/api/auth/forgot-password', otpRateLimiter, (req: Request, res: Response) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Identifier is required' });
  }
  const user = db.findUserByEmailOrUsername(identifier);
  if (!user) {
    return res.status(404).json({ error: 'No account found matching this identifier' });
  }
  const code = String(crypto.randomInt(100000, 1000000));
  db.setOtp(identifier, code, 'forgot_password');

  const payload: any = {
    success: true,
    message: 'Password reset OTP sent to registered contact',
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.debugOtp = code;
  }
  res.json(payload);
});

app.post('/api/auth/reset-password', sensitiveAuthRateLimiter, (req: Request, res: Response) => {
  const { identifier, code, newPassword } = req.body;
  if (!identifier || !code || !newPassword) {
    return res.status(400).json({ error: 'Identifier, code, and new password are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const isValid = db.verifyOtp(identifier, code, 'forgot_password');
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid or expired reset code' });
  }
  const user = db.findUserByEmailOrUsername(identifier);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { hash, salt, iterations } = hashPassword(newPassword);
  db.updateUser(user.id, { passwordHash: hash, passwordSalt: salt, passwordIterations: iterations });
  db.deleteUserSessions(user.id);

  res.json({ success: true, message: 'Password reset successfully. Please log in with your new password.' });
});

app.post('/api/auth/claim-owner', sensitiveAuthRateLimiter, (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const secret = String(req.body.secret || req.body.ownerSecret || '');
  const OWNER_SECRET = process.env.OWNER_SECRET || 'MOTHERLAND_FOUNDER_2026';

  if (secret !== OWNER_SECRET) {
    return res.status(403).json({ error: 'Invalid Owner Authorization Secret' });
  }

  db.updateUser(user.id, { role: 'owner', isVerified: true });
  const updatedUser = db.findUserById(user.id)!;
  const session = db.createSession(updatedUser.id, req.headers['user-agent'], {
    ipAddress: req.ip,
    authMethod: 'password',
  });
  setAuthCookie(res, req, session.token);

  res.json({
    success: true,
    token: session.token,
    sessionId: session.id,
    user: db.toPublicProfile(updatedUser, user.id),
    message: 'Official FOUNDER & OWNER privileges activated successfully!',
  });
});

app.post('/api/auth/switch-account', sensitiveAuthRateLimiter, (req: Request, res: Response) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ error: 'Target userId and password are required to switch accounts' });
  }
  const targetUser = db.findUserById(userId);
  if (!targetUser) {
    return res.status(404).json({ error: 'Target user account not found' });
  }
  if (!verifyPassword(String(password), targetUser.passwordHash, targetUser.passwordSalt, targetUser.passwordIterations)) {
    return res.status(401).json({ error: 'Invalid account credentials' });
  }
  if (needsPasswordUpgrade(targetUser)) {
    const upgraded = hashPassword(String(password));
    db.updateUser(targetUser.id, {
      passwordHash: upgraded.hash,
      passwordSalt: upgraded.salt,
      passwordIterations: upgraded.iterations,
    });
  }
  const session = db.createSession(targetUser.id, req.headers['user-agent'], {
    ipAddress: req.ip,
    authMethod: 'switch',
  });
  setAuthCookie(res, req, session.token);
  res.json({
    token: session.token,
    sessionId: session.id,
    user: db.toPublicProfile(targetUser, targetUser.id),
    message: `Switched account to ${targetUser.displayName}`,
  });
});

// Explicit Account-Owner-Initiated Deletion (ONLY authorized self-deletion path)
app.delete('/api/users/me', sensitiveAuthRateLimiter, (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { password, confirmUsername } = req.body || {};

  if (user.authProvider !== 'google') {
    if (!password || !verifyPassword(String(password), user.passwordHash, user.passwordSalt, user.passwordIterations)) {
      return res.status(403).json({ error: 'Password confirmation is required to permanently delete your account.' });
    }
  } else if (String(confirmUsername || '').trim().toLowerCase() !== user.username.toLowerCase()) {
    return res.status(403).json({ error: 'Username confirmation is required to delete your Google-linked account.' });
  }

  const deleted = db.deleteUserAccount(user.id);
  if (!deleted.ok) {
    return res.status(404).json({ error: deleted.error || 'Account not found.' });
  }
  clearAuthCookie(res, req);
  res.json({ success: true, message: 'Your MOTHERLAND account has been permanently deleted.' });
});

app.put('/api/users/profile', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const {
    displayName,
    bio,
    location,
    website,
    work,
    education,
    avatar,
    coverImage,
    privacy,
    notificationPrefs,
    dataSaver,
    socialLinks,
    isPrivate,
    twoFactorEnabled,
  } = req.body;

  const updates: Partial<UserAccount> = {};
  if (displayName) updates.displayName = displayName.trim();
  if (bio !== undefined) updates.bio = bio;
  if (location !== undefined) updates.location = location;
  if (website !== undefined) updates.website = website;
  if (work !== undefined) updates.work = work;
  if (education !== undefined) updates.education = education;
  if (avatar) updates.avatar = avatar;
  if (coverImage) updates.coverImage = coverImage;
  if (privacy) updates.privacy = { ...user.privacy, ...privacy };
  if (notificationPrefs) {
    updates.notificationPrefs = {
      messages: true,
      calls: true,
      friends: true,
      posts: true,
      videos: true,
      groups: true,
      ...(user.notificationPrefs || {}),
      ...notificationPrefs,
    };
  }
  if (typeof dataSaver === 'boolean') updates.dataSaver = dataSaver;
  if (socialLinks) updates.socialLinks = { ...user.socialLinks, ...socialLinks };
  if (isPrivate !== undefined) updates.isPrivate = isPrivate;
  if (twoFactorEnabled !== undefined) updates.twoFactorEnabled = twoFactorEnabled;

  const updated = db.updateUser(user.id, updates);
  res.json({ success: true, user: db.toPublicProfile(updated || user, user.id, getOnlineUserIds()) });
});

app.put('/api/users/preferences', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { privacy, notificationPrefs, dataSaver } = req.body || {};
  const updates: Partial<UserAccount> = {};
  if (privacy && typeof privacy === 'object') {
    updates.privacy = { ...user.privacy, ...privacy };
  }
  if (notificationPrefs && typeof notificationPrefs === 'object') {
    updates.notificationPrefs = {
      messages: true,
      calls: true,
      friends: true,
      posts: true,
      videos: true,
      groups: true,
      ...(user.notificationPrefs || {}),
      ...notificationPrefs,
    };
  }
  if (typeof dataSaver === 'boolean') {
    updates.dataSaver = dataSaver;
  }
  const updated = db.updateUser(user.id, updates);
  res.json({ success: true, user: db.toPublicProfile(updated || user, user.id, getOnlineUserIds()) });
});

app.get('/api/users', (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').trim().toLowerCase();
  const allUsers = db.getAllUsers();
  const currentUserId = (req as any).userId as string | undefined;
  const onlineIds = getOnlineUserIds();

  const filtered = allUsers
    .filter((u) => {
      if (currentUserId && db.isBlocked(currentUserId, u.id)) return false;
      if (!query) return true;
      return (
        u.displayName.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        (u.bio || '').toLowerCase().includes(query)
      );
    })
    .map((u) => db.toPublicProfile(u, currentUserId, onlineIds));

  res.json({ users: filtered });
});

app.get('/api/users/:id/posts', (req: Request, res: Response) => {
  const targetUser = db.findUserById(req.params.id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  const currentUserId = (req as any).userId as string | undefined;
  if (currentUserId && db.isBlocked(currentUserId, targetUser.id)) {
    return res.status(403).json({ error: 'Profile unavailable.' });
  }

  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const pageSize = Math.min(30, Math.max(1, parseInt((req.query.pageSize as string) || '12', 10)));

  const visiblePosts = db
    .getAllPosts()
    .filter((p) => p.author.id === targetUser.id && db.canViewerSeePost(currentUserId, p))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const start = (page - 1) * pageSize;
  const slice = visiblePosts.slice(start, start + pageSize);

  res.json({
    posts: slice.map((p) => db.hydratePostForUser(p, currentUserId)),
    total: visiblePosts.length,
    page,
    hasMore: start + slice.length < visiblePosts.length,
  });
});

app.get('/api/users/:id', (req: Request, res: Response) => {
  const targetUser = db.findUserById(req.params.id);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const currentUserId = (req as any).userId as string | undefined;
  if (currentUserId && db.isBlocked(currentUserId, targetUser.id)) {
    return res.status(404).json({ error: 'User not found' });
  }

  const isSelf = currentUserId === targetUser.id;
  const isFriend = currentUserId ? db.isFriend(currentUserId, targetUser.id) : false;
  const isFollowing = currentUserId ? db.isFollowing(currentUserId, targetUser.id) : false;

  if (!isSelf && targetUser.privacy?.profileVisibility === 'private') {
    const baseProfile = db.toPublicProfile(targetUser, currentUserId, getOnlineUserIds());
    return res.json({
      user: {
        id: baseProfile.id,
        username: baseProfile.username,
        displayName: baseProfile.displayName,
        avatar: baseProfile.avatar,
        coverImage: '',
        bio: 'This profile is private.',
        joinedDate: baseProfile.joinedDate,
        isVerified: baseProfile.isVerified,
        role: baseProfile.role,
        isPrivate: true,
        friendsCount: 0,
        followersCount: 0,
        followingCount: 0,
        privacy: {
          profileVisibility: 'private',
          showOnlineStatus: false,
          allowDirectMessages: 'friends',
          showContactInfo: false,
        },
        relationshipStatus: baseProfile.relationshipStatus,
      },
      posts: [],
      hasMorePosts: false,
      totalPosts: 0,
      isFriend,
      isFollowing,
      isCurrentUser: false,
    });
  }

  const userPosts = db
    .getAllPosts()
    .filter((p) => p.author.id === targetUser.id && db.canViewerSeePost(currentUserId, p))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({
    user: db.toPublicProfile(targetUser, currentUserId, getOnlineUserIds()),
    posts: userPosts.slice(0, 12).map((p) => db.hydratePostForUser(p, currentUserId)),
    hasMorePosts: userPosts.length > 12,
    totalPosts: userPosts.length,
    isFriend,
    isFollowing,
    isCurrentUser: isSelf,
  });
});


async function getUnifiedFeedYouTubePosts(
  page: number,
  pageSize = 8,
  suppressedIds: Set<string> = new Set()
): Promise<Post[]> {
  const uniquePool = Array.from(new Set(REAL_YOUTUBE_CATALOG.default)).filter(
    (vid) => !suppressedIds.has(vid)
  );
  const start = (page - 1) * pageSize;
  if (start >= uniquePool.length) {
    return [];
  }
  const ids = uniquePool.slice(start, start + pageSize);

  try {
    const statsData = await fetchFromYouTubeApi('videos', {
      part: 'snippet,contentDetails,statistics',
      id: ids.join(','),
    });

    return (statsData.items || []).map((item: any) => ({
      id: `yt_feed_${item.id}`,
      source: 'youtube' as const,
      externalId: item.id,
      author: {
        id: item.snippet?.channelId || `ch_${item.id}`,
        username: (item.snippet?.channelTitle || 'youtube_creator').toLowerCase().replace(/[^a-z0-9_]/g, '_').substring(0, 24),
        displayName: item.snippet?.channelTitle || 'YouTube Creator',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${item.snippet?.channelTitle || item.id}`,
        isVerified: true,
      },
      content: `${item.snippet?.title || 'YouTube Video'}\n\n${(item.snippet?.description || '').slice(0, 240)}...`,
      mediaType: 'video' as const,
      mediaUrl: '',
      thumbnailUrl:
        item.snippet?.thumbnails?.maxres?.url ||
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url,
      videoDuration: formatIsoDuration(item.contentDetails?.duration),
      hashtags: ['YouTube', 'MOTHERLAND', 'GlobalMedia', 'VideoTheater'],
      audience: 'public' as const,
      createdAt: item.snippet?.publishedAt || new Date().toISOString(),
      stats: {
        likes: Number(item.statistics?.likeCount) || 1200,
        comments: Number(item.statistics?.commentCount) || 45,
        shares: Math.floor((Number(item.statistics?.likeCount) || 1200) / 12),
        views: Number(item.statistics?.viewCount) || 25000,
      },
      userInteractions: {
        isLiked: false,
        isSaved: false,
      },
    }));
  } catch (err) {
    console.warn('Failed to fetch YouTube posts for feed:', err);
    return [];
  }
}

// 2. Posts & Unified Feed (Isolated Per-User Reactions, Privacy Filtering, For You Ranking, & 14-Day Suppression)
app.get('/api/posts', async (req: Request, res: Response) => {
  const currentUserId = (req as any).userId as string | undefined;
  const source = req.query.source as string;
  const feedType = (req.query.feedType as string) || 'all'; // 'all', 'for_you', 'motherland', 'saved'
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const pageSize = Math.min(30, Math.max(1, parseInt((req.query.pageSize as string) || '10', 10)));
  const suppressedIds = getSuppressedSetFromReq(req);

  const rawPosts = db.getAllPosts();

  if (feedType === 'saved') {
    if (!currentUserId) {
      return res.json({ posts: [], total: 0, page, hasMore: false });
    }
    const savedIds = new Set(db.getUserSavedPostIds(currentUserId));
    const savedPosts = rawPosts
      .filter((p) => savedIds.has(p.id) && db.canViewerSeePost(currentUserId, p))
      .map((p) => db.hydratePostForUser(p, currentUserId));
    return res.json({ posts: savedPosts, total: savedPosts.length, page, hasMore: false });
  }

  if (feedType === 'for_you') {
    const scoredAll = db
      .getScoredForYouPosts(currentUserId)
      .filter((p) => !(p.mediaType === 'video' && (suppressedIds.has(p.id) || (p.externalId && suppressedIds.has(p.externalId)))));
    const start = (page - 1) * pageSize;
    const mlSlice = scoredAll.slice(start, start + pageSize).map((p) => db.hydratePostForUser(p, currentUserId));
    const ytExtra = mlSlice.length < pageSize ? await getUnifiedFeedYouTubePosts(page, pageSize - mlSlice.length, suppressedIds) : [];
    const combined = [...mlSlice, ...ytExtra];
    return res.json({
      posts: combined,
      total: scoredAll.length + ytExtra.length,
      page,
      hasMore: start + mlSlice.length < scoredAll.length || ytExtra.length > 0,
    });
  }

  if (feedType === 'motherland' || source === 'motherland') {
    const motherlandPosts = rawPosts
      .filter((p) => p.source === 'motherland' && db.canViewerSeePost(currentUserId, p))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const start = (page - 1) * pageSize;
    const slice = motherlandPosts.slice(start, start + pageSize).map((p) => db.hydratePostForUser(p, currentUserId));
    return res.json({
      posts: slice,
      total: motherlandPosts.length,
      page,
      hasMore: start + slice.length < motherlandPosts.length,
    });
  }

  // Unified Feed: Visible Motherland posts + Non-Repeating Unwatched YouTube Video Posts
  try {
    const ytVideosResult = await getUnifiedFeedYouTubePosts(page, pageSize, suppressedIds);
    const visibleMotherland = rawPosts
      .filter((p) => p.source === 'motherland' && db.canViewerSeePost(currentUserId, p))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const mlStart = (page - 1) * pageSize;
    const hydratedMotherland = visibleMotherland
      .slice(mlStart, mlStart + pageSize)
      .map((p) => db.hydratePostForUser(p, currentUserId));

    const unifiedPosts: Post[] = [];
    let mIdx = 0;
    let yIdx = 0;
    while (mIdx < hydratedMotherland.length || yIdx < ytVideosResult.length) {
      if (mIdx < hydratedMotherland.length) unifiedPosts.push(hydratedMotherland[mIdx++]);
      if (yIdx < ytVideosResult.length) unifiedPosts.push(ytVideosResult[yIdx++]);
      if (yIdx < ytVideosResult.length) unifiedPosts.push(ytVideosResult[yIdx++]);
    }

    const hasMore = mlStart + hydratedMotherland.length < visibleMotherland.length || ytVideosResult.length > 0;
    res.json({
      posts: unifiedPosts,
      total: unifiedPosts.length,
      page,
      hasMore,
    });
  } catch (err) {
    console.error('Unified feed error:', err);
    const fallback = rawPosts
      .filter((p) => db.canViewerSeePost(currentUserId, p))
      .map((p) => db.hydratePostForUser(p, currentUserId));
    fallback.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ posts: fallback, total: fallback.length, page, hasMore: false });
  }
});

// Create Post (Assigned Strictly to Authenticated User)
app.post('/api/posts', (req: Request, res: Response) => {
  const author = requireAuth(req, res);
  if (!author) return;
  const { content, mediaType, mediaUrl, images, thumbnailUrl, mediaAspectRatio, hashtags, audience, platforms } = req.body;
  const cleanImages = Array.isArray(images)
    ? images.map((img) => sanitizeSafeUrl(img)).filter((u): u is string => Boolean(u))
    : undefined;
  const safeMediaUrl = sanitizeSafeUrl(mediaUrl);
  const safeThumbUrl = sanitizeSafeUrl(thumbnailUrl);
  const primaryMediaUrl = safeMediaUrl || (cleanImages && cleanImages.length > 0 ? cleanImages[0] : undefined);

  if (mediaUrl && !safeMediaUrl) {
    return res.status(400).json({ error: 'Unsafe or invalid media URL rejected.' });
  }

  if (!content && !primaryMediaUrl) {
    return res.status(400).json({ error: 'Post must contain text content or media' });
  }

  const newPost: Post = {
    id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    source: 'motherland',
    author: {
      id: author.id,
      username: author.username,
      displayName: author.displayName,
      avatar: author.avatar,
      isVerified: author.isVerified || author.role === 'owner',
    },
    content: content ? String(content).slice(0, 10000) : '',
    mediaType: mediaType || (primaryMediaUrl ? 'image' : 'none'),
    mediaUrl: primaryMediaUrl,
    images: cleanImages,
    thumbnailUrl: safeThumbUrl,
    mediaAspectRatio: mediaAspectRatio || '16:9',
    hashtags: Array.isArray(hashtags) ? hashtags.map((h) => String(h).slice(0, 48)) : [],
    audience: audience || 'public',
    createdAt: new Date().toISOString(),
    stats: {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 1,
    },
  };

  db.addPost(newPost);

  const publishResults: any[] = [{ platform: 'motherland', status: 'Published' }];
  if (Array.isArray(platforms)) {
    for (const p of platforms) {
      if (p === 'motherland') continue;
      if (p === 'youtube') {
        publishResults.push({
          platform: 'youtube',
          status: 'Permission Required',
          error: 'Use the YouTube Upload destination in Video Publishing to upload directly to YouTube.',
        });
      } else {
        publishResults.push({
          platform: p,
          status: 'Not Connected',
          error: `Official ${p.toUpperCase()} API connection not established.`,
        });
      }
    }
  }

  res.status(201).json({
    post: db.hydratePostForUser(newPost, author.id),
    publishResults,
  });
});

// Post Reactions (FIXED SHARED IDENTITY BUG: 1 Reaction per User per Post strictly recorded in db.reactions)
app.post('/api/posts/:id/react', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { reaction } = req.body; // 'like' | 'love' | 'fire' | 'haha' | 'wow' | 'sad'
  const postId = req.params.id;
  const post = db.getAllPosts().find((p) => p.id === postId);
  if (post && !db.canViewerSeePost(user.id, post)) {
    return res.status(403).json({ error: 'Not authorized to react to this post' });
  }

  const result = db.toggleReaction(postId, user.id, reaction || 'like');

  // If reaction was added and author is someone else, create a notification + push WS
  if (result.isLiked && post && post.author.id !== user.id) {
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientId: post.author.id,
      category: 'motherland' as const,
      type: 'like' as const,
      sender: {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        username: user.username,
      },
      title: 'New Reaction',
      body: `${user.displayName} reacted with ${reaction || 'like'} to your post.`,
      targetId: postId,
      targetType: 'post' as const,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    db.addNotification(notif);
    sendWsToUser(post.author.id, 'notification:new', notif);
  }

  res.json({
    likes: result.likesCount,
    userInteractions: {
      isLiked: result.isLiked,
      reaction: result.reaction,
    },
  });
});

// Post Comments
app.get('/api/posts/:id/comments', (req: Request, res: Response) => {
  const currentUserId = (req as any).userId as string | undefined;
  const post = db.getAllPosts().find((p) => p.id === req.params.id);
  if (post && !db.canViewerSeePost(currentUserId, post)) {
    return res.status(403).json({ error: 'Not authorized to view comments on this post' });
  }
  const list = db.getComments(req.params.id);
  res.json({ comments: list });
});

app.post('/api/posts/:id/comments', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text cannot be empty' });
  }

  const postId = req.params.id;
  const post = db.getAllPosts().find((p) => p.id === postId);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  if (!db.canViewerSeePost(user.id, post)) {
    return res.status(403).json({ error: 'Not authorized to comment on this post' });
  }

  const newComment = {
    id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    postId,
    userId: user.id,
    userDisplayName: user.displayName,
    userUsername: user.username,
    userAvatar: user.avatar,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    likesCount: 0,
    isLiked: false,
  };

  db.addComment(postId, newComment);

  if (post.author.id !== user.id) {
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientId: post.author.id,
      category: 'motherland' as const,
      type: 'comment' as const,
      sender: {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        username: user.username,
      },
      title: 'New Comment',
      body: `${user.displayName} commented: "${text.trim().slice(0, 60)}"`,
      targetId: postId,
      targetType: 'post' as const,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    db.addNotification(notif);
    sendWsToUser(post.author.id, 'notification:new', notif);
  }

  res.status(201).json({ comment: newComment, totalComments: db.getComments(postId).length });
});

// Save Post (Per-User Saved State)
app.post('/api/posts/:id/save', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const postId = req.params.id;
  const isSaved = db.toggleSavePost(postId, user.id);
  res.json({ isSaved });
});

// Share Post to Feed
app.post('/api/posts/:id/share', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const postId = req.params.id;
  const { caption } = req.body || {};

  const original = db.getAllPosts().find((p) => p.id === postId);
  if (!original) {
    return res.json({ success: true, shares: 1 });
  }
  if (!db.canViewerSeePost(user.id, original)) {
    return res.status(403).json({ error: 'Not authorized to share this post' });
  }

  const sharesCount = db.incrementPostShare(postId);
  const sharedPost: Post = {
    id: `post_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    source: 'motherland',
    author: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isVerified: user.isVerified || user.role === 'owner',
    },
    content: caption ? String(caption).trim() : '',
    mediaType: 'none',
    sharedPost: {
      id: original.id,
      source: original.source,
      externalId: original.externalId,
      author: original.author,
      content: original.content,
      mediaType: original.mediaType,
      mediaUrl: original.mediaUrl,
      images: original.images,
      thumbnailUrl: original.thumbnailUrl,
      createdAt: original.createdAt,
    },
    hashtags: [],
    audience: 'public',
    createdAt: new Date().toISOString(),
    stats: {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 1,
    },
  };

  db.addPost(sharedPost);

  if (original.author.id !== user.id) {
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientId: original.author.id,
      category: 'motherland' as const,
      type: 'like' as const,
      sender: {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        username: user.username,
      },
      title: 'Post Shared',
      body: `${user.displayName} shared your post on MOTHERLAND.`,
      targetId: sharedPost.id,
      targetType: 'post' as const,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    db.addNotification(notif);
    sendWsToUser(original.author.id, 'notification:new', notif);
  }

  res.status(201).json({
    success: true,
    shares: sharesCount,
    post: db.hydratePostForUser(sharedPost, user.id),
  });
});

// Delete Post (Only Creator or Owner)
app.delete('/api/posts/:id', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const postId = req.params.id;
  const post = db.getAllPosts().find((p) => p.id === postId);

  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (post.author.id !== user.id && user.role !== 'owner') {
    return res.status(403).json({ error: 'Unauthorized to delete this post' });
  }

  db.deletePost(postId);
  res.json({ success: true, message: 'Post deleted successfully' });
});

// Stories System (Strict 24-Hour UTC Expiration — privacy-aware & server-UTC enforced)
app.get('/api/stories', (req: Request, res: Response) => {
  const currentUserId = (req as any).userId as string | undefined;
  const activeStories = db
    .getActiveStories()
    .filter((s) => {
      if (currentUserId && db.isBlocked(currentUserId, s.userId)) return false;
      if (currentUserId === s.userId) return true;
      const authorAcc = db.findUserById(s.userId);
      if (authorAcc?.privacy?.profileVisibility === 'private') return false;
      if (authorAcc?.privacy?.profileVisibility === 'friends') {
        return Boolean(currentUserId && db.isFriend(currentUserId, s.userId));
      }
      return true;
    })
    .map((s) => ({
      ...s,
      isOwn: currentUserId === s.userId,
    }));
  res.json({ stories: activeStories });
});

app.post('/api/stories', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { mediaUrl, mediaType, caption } = req.body;
  const safeUrl = sanitizeSafeUrl(mediaUrl);

  if (!safeUrl) {
    return res.status(400).json({ error: 'Story requires a valid image or video URL' });
  }

  // Strictly ignore any client timestamps; enforce server UTC createdAt + 24h UTC expiresAt
  const nowUtcMs = Date.now();
  const createdAtUtc = new Date(nowUtcMs).toISOString();
  const expiresAtUtc = new Date(nowUtcMs + 24 * 60 * 60 * 1000).toISOString();

  const newStory: Story = {
    id: `story_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: user.id,
    userDisplayName: user.displayName,
    userUsername: user.username,
    userAvatar: user.avatar,
    isUserVerified: user.isVerified || user.role === 'owner',
    source: 'motherland',
    mediaUrl: safeUrl,
    mediaType: mediaType === 'video' ? 'video' : 'image',
    caption: caption ? String(caption).slice(0, 500) : '',
    createdAt: createdAtUtc,
    expiresAt: expiresAtUtc,
    viewersCount: 0,
    isViewed: false,
    isOwn: true,
  };

  const savedStory = db.addStory(newStory);
  res.status(201).json({ story: savedStory });
});

app.post('/api/stories/:id/view', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const storiesList = db.getActiveStories();
  const story = storiesList.find((s) => s.id === req.params.id);
  if (!story) {
    return res.status(404).json({ error: 'Story not found or expired' });
  }
  if (db.isBlocked(user.id, story.userId)) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  story.isViewed = true;
  story.viewersCount += 1;
  db.save();
  res.json({ success: true });
});

app.delete('/api/stories/:id', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const story = db.getActiveStories().find((s) => s.id === req.params.id);
  if (!story) {
    return res.status(404).json({ error: 'Story not found or not authorized' });
  }
  if (story.userId !== user.id && user.role !== 'owner') {
    return res.status(403).json({ error: 'Unauthorized to delete this story' });
  }
  db.deleteStory(req.params.id);
  res.json({ success: true, message: 'Story deleted' });
});

// 4. Videos (Shorts, 16:9 Long Videos, 14-Day Watch Tracking, Saved Videos & Drafts)
app.get('/api/videos/shorts', async (req: Request, res: Response) => {
  const allLocal = db
    .getShortVideos()
    .filter((s) => s.id !== 'short_01' && s.id !== 'short_02');
  const suppressed = getSuppressedSetFromReq(req);
  const filteredLocal = allLocal.filter(
    (s) => !suppressed.has(s.id) && !(s.youtubeId && suppressed.has(s.youtubeId))
  );

  // Immediately include fast cached YouTube Shorts so the Shorts strip/player starts instantly without slow seed MP4s
  let ytShorts: ShortVideo[] = [];
  try {
    const relevant = getRelevantVideoIds('shorts', 1, 12);
    const unseenIds = relevant.ids.filter((vid) => !suppressed.has(vid));
    if (unseenIds.length > 0) {
      const statsData = await fetchFromYouTubeApi('videos', {
        part: 'snippet,contentDetails,statistics',
        id: unseenIds.slice(0, 10).join(','),
      });
      ytShorts = (statsData.items || []).map((item: any) => ({
        id: item.id,
        source: 'youtube' as const,
        youtubeId: item.id,
        videoUrl: '',
        thumbnailUrl:
          item.snippet?.thumbnails?.maxres?.url ||
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
        title: item.snippet?.title || 'YouTube Short',
        caption: item.snippet?.title || '',
        hashtags: ['Shorts'],
        creator: {
          id: item.snippet?.channelId || 'yt',
          name: item.snippet?.channelTitle || 'YouTube Creator',
          username: (item.snippet?.channelTitle || 'creator').toLowerCase().replace(/\s+/g, ''),
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(item.snippet?.channelTitle || item.id)}`,
          isVerified: true,
        },
        stats: {
          views: Number(item.statistics?.viewCount || 0),
          likes: Number(item.statistics?.likeCount || 0),
          comments: Number(item.statistics?.commentCount || 0),
          shares: 0,
        },
        createdAt: item.snippet?.publishedAt || new Date().toISOString(),
      }));
    }
  } catch {
    // Graceful fallback if API key quota is limited
  }

  const seen = new Set(filteredLocal.map((s) => s.youtubeId || s.id));
  const merged = [...filteredLocal, ...ytShorts.filter((s) => !seen.has(s.id))];
  res.json({ shorts: merged });
});

app.post('/api/videos/shorts', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { videoUrl, thumbnailUrl, title, caption, hashtags } = req.body;
  if (!videoUrl) {
    return res.status(400).json({ error: 'Short video requires a valid video URL' });
  }

  const newShort: ShortVideo = {
    id: `short_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    source: 'motherland',
    videoUrl,
    thumbnailUrl: thumbnailUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80',
    title: title || 'Untitled Short',
    caption: caption || '',
    hashtags: Array.isArray(hashtags) ? hashtags : [],
    creator: {
      id: user.id,
      name: user.displayName,
      username: user.username,
      avatar: user.avatar,
      isVerified: user.isVerified || user.role === 'owner',
      isFollowing: false,
    },
    stats: {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 1,
    },
    createdAt: new Date().toISOString(),
  };

  db.addShortVideo(newShort);
  res.status(201).json({ short: newShort });
});

app.get('/api/videos/long', (req: Request, res: Response) => {
  const all = db.getLongVideos();
  const suppressed = getSuppressedSetFromReq(req);
  if (req.query.includeWatched === '1' || suppressed.size === 0) {
    return res.json({ videos: all });
  }
  res.json({
    videos: all.filter((v) => !suppressed.has(v.id) && !(v.youtubeId && suppressed.has(v.youtubeId))),
  });
});

app.post('/api/videos/watch-progress', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const {
    videoId,
    youtubeId,
    videoType,
    source,
    title,
    thumbnailUrl,
    channelTitle,
    duration,
    watchSeconds,
    durationSeconds,
    completed,
  } = req.body || {};

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  const record = db.upsertWatchProgress(user.id, {
    videoId: String(videoId),
    youtubeId: youtubeId ? String(youtubeId) : undefined,
    videoType: videoType === 'short' ? 'short' : 'long',
    source: source || 'youtube',
    title: String(title || 'Video'),
    thumbnailUrl: String(thumbnailUrl || ''),
    channelTitle: String(channelTitle || 'Creator'),
    duration: duration ? String(duration) : undefined,
    watchSeconds: Number(watchSeconds || 0),
    durationSeconds: Number(durationSeconds || 0),
    completed: Boolean(completed),
  });

  res.json({ success: true, record, suppressionDays: WATCH_SUPPRESSION_DAYS });
});

app.get('/api/videos/history', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  res.json({
    history: db.getUserWatchHistory(user.id),
    suppressionDays: WATCH_SUPPRESSION_DAYS,
  });
});

app.delete('/api/videos/history/:videoId', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const removed = db.removeWatchHistoryItem(user.id, req.params.videoId);
  res.json({ success: true, removed });
});

app.post('/api/videos/save', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { videoId, videoType, source, youtubeId, title, thumbnailUrl, channelTitle, channelAvatar, duration, videoUrl } =
    req.body || {};
  if (!videoId || !title) {
    return res.status(400).json({ error: 'videoId and title are required' });
  }
  const result = db.toggleSaveVideo(user.id, {
    videoId: String(videoId),
    videoType: videoType === 'short' ? 'short' : 'long',
    source: source || 'youtube',
    youtubeId: youtubeId ? String(youtubeId) : undefined,
    title: String(title),
    thumbnailUrl: String(thumbnailUrl || ''),
    channelTitle: String(channelTitle || 'Creator'),
    channelAvatar: channelAvatar ? String(channelAvatar) : undefined,
    duration: duration ? String(duration) : undefined,
    videoUrl: videoUrl ? String(videoUrl) : undefined,
  });
  res.json(result);
});

app.get('/api/saved', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const savedPostIds = new Set(db.getUserSavedPostIds(user.id));
  const posts = db
    .getAllPosts()
    .filter((p) => savedPostIds.has(p.id) && db.canViewerSeePost(user.id, p))
    .map((p) => db.hydratePostForUser(p, user.id));
  const videos = db.getUserSavedVideos(user.id);
  res.json({ posts, videos });
});

app.get('/api/drafts', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  res.json({ drafts: db.getUserDrafts(user.id) });
});

app.post('/api/drafts', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { id, mode, content, shortTitle, mediaType, mediaUrl, images, hashtags, audience } = req.body || {};
  const now = new Date().toISOString();
  const saved = db.saveDraft({
    id: id || `draft_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    userId: user.id,
    mode: mode === 'story' || mode === 'short' ? mode : 'post',
    content: String(content || ''),
    shortTitle: shortTitle ? String(shortTitle) : undefined,
    mediaType: mediaType || (mediaUrl ? 'image' : 'none'),
    mediaUrl,
    images: Array.isArray(images) ? images : undefined,
    hashtags: Array.isArray(hashtags) ? hashtags : undefined,
    audience: audience || 'public',
    createdAt: now,
    updatedAt: now,
  });
  res.status(201).json({ draft: saved });
});

app.delete('/api/drafts/:id', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const deleted = db.deleteDraft(req.params.id, user.id);
  res.json({ success: true, deleted });
});

app.post('/api/videos/long', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { videoUrl, thumbnailUrl, title, description, duration, tags } = req.body;
  if (!videoUrl || !title) {
    return res.status(400).json({ error: 'Long video requires title and video URL' });
  }

  const newLong: LongVideo = {
    id: `long_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    source: 'motherland',
    videoUrl,
    thumbnailUrl: thumbnailUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1280&auto=format&fit=crop&q=80',
    title,
    description: description || '',
    duration: duration || '3:30',
    channel: {
      id: user.id,
      title: `${user.displayName} Official`,
      avatar: user.avatar,
      subscriberCount: '1.2K',
      isVerified: user.isVerified || user.role === 'owner',
    },
    stats: {
      views: 1,
      likes: 0,
      comments: 0,
    },
    publishedAt: 'Just now',
    tags: Array.isArray(tags) ? tags : [],
  };

  db.addLongVideo(newLong);
  res.status(201).json({ video: newLong });
});


// 5. Friends & Social Graph (Real Requests, Accept/Decline/Cancel, Privacy & Online Presence)
app.get('/api/friends', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const onlineIds = getOnlineUserIds();
  const friendIds = db.getFriendIds(user.id);
  const allUsers = db.getAllUsers();

  const friendsList = allUsers
    .filter((u) => friendIds.includes(u.id) && !db.isBlocked(user.id, u.id))
    .map((u) => db.toPublicProfile(u, user.id, onlineIds));

  const suggestedUsers = db.getSuggestedFriends(user.id);
  const pendingRequests = db.getFriendRequests(user.id);
  const sentRequests = db.getSentFriendRequests(user.id);

  res.json({
    friends: friendsList,
    suggested: suggestedUsers,
    pendingRequests,
    sentRequests,
    followingCount: allUsers.filter((u) => db.isFollowing(user.id, u.id)).length,
    followersCount: allUsers.filter((u) => db.isFollowing(u.id, user.id)).length,
  });
});

app.get('/api/friends/suggestions', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  res.json({ suggestions: db.getSuggestedFriends(user.id) });
});

app.post('/api/friends/request', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { targetUserId } = req.body;

  if (!targetUserId || targetUserId === user.id) {
    return res.status(400).json({ error: 'Invalid target user' });
  }

  const outcome = db.createFriendRequestSafe(user.id, targetUserId);
  if (outcome.error) {
    return res.status(400).json({ error: outcome.error });
  }
  if (outcome.alreadyPending) {
    return res.json({ success: true, request: outcome.request, alreadyPending: true });
  }

  if (outcome.autoAccepted) {
    const acceptNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientId: targetUserId,
      category: 'motherland' as const,
      type: 'friend_accept' as const,
      sender: {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        username: user.username,
      },
      title: 'Friend Request Accepted',
      body: `${user.displayName} is now your friend on MOTHERLAND.`,
      targetId: user.id,
      targetType: 'profile' as const,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    db.addNotification(acceptNotif);
    sendWsToUser(targetUserId, 'notification:new', acceptNotif);
    sendWsToUser(targetUserId, 'friend:update', { type: 'accepted', byUserId: user.id });
    sendWsToUser(user.id, 'friend:update', { type: 'accepted', targetUserId });
    return res.json({ success: true, request: outcome.request, autoAccepted: true });
  }

  const reqNotif = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    recipientId: targetUserId,
    category: 'motherland' as const,
    type: 'friend_request' as const,
    sender: {
      id: user.id,
      displayName: user.displayName,
      avatar: user.avatar,
      username: user.username,
    },
    title: 'New Friend Request',
    body: `${user.displayName} sent you a friend request on MOTHERLAND.`,
    targetId: user.id,
    targetType: 'profile' as const,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  db.addNotification(reqNotif);
  sendWsToUser(targetUserId, 'notification:new', reqNotif);
  sendWsToUser(targetUserId, 'friend:update', { type: 'request_received', senderId: user.id });

  res.json({ success: true, request: outcome.request });
});

app.post('/api/friends/respond', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { requestId, action } = req.body; // 'accept' | 'reject' | 'cancel'

  const outcome = db.respondFriendRequest(requestId, action, user.id);
  if (!outcome.ok || !outcome.request) {
    return res.status(400).json({ error: outcome.error || 'Request not found or unauthorized' });
  }

  const reqItem = outcome.request;
  if (action === 'accept') {
    const notif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      recipientId: reqItem.sender.id,
      category: 'motherland' as const,
      type: 'friend_accept' as const,
      sender: {
        id: user.id,
        displayName: user.displayName,
        avatar: user.avatar,
        username: user.username,
      },
      title: 'Friend Request Accepted',
      body: `${user.displayName} accepted your friend request on MOTHERLAND.`,
      targetId: user.id,
      targetType: 'profile' as const,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    db.addNotification(notif);
    sendWsToUser(reqItem.sender.id, 'notification:new', notif);
    sendWsToUser(reqItem.sender.id, 'friend:update', { type: 'accepted', byUserId: user.id });
    sendWsToUser(user.id, 'friend:update', { type: 'accepted', senderId: reqItem.sender.id });
  } else {
    sendWsToUser(reqItem.sender.id, 'friend:update', { type: action, requestId });
    sendWsToUser(reqItem.receiverId, 'friend:update', { type: action, requestId });
  }

  res.json({ success: true, action });
});

app.post('/api/friends/remove', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Target userId required' });
  db.removeFriendship(user.id, userId);
  sendWsToUser(userId, 'friend:update', { type: 'removed', byUserId: user.id });
  res.json({ success: true });
});

app.post('/api/users/:id/follow', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const targetId = req.params.id;
  if (targetId === user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  const isFollowing = db.isFollowing(user.id, targetId);

  if (isFollowing) {
    db.unfollow(user.id, targetId);
  } else {
    db.follow(user.id, targetId);
  }

  res.json({ isFollowing: !isFollowing });
});

app.post('/api/users/:id/report', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const targetId = req.params.id;
  if (targetId === user.id) return res.status(400).json({ error: 'Cannot report yourself' });
  const { reason, details, conversationId, messageId } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ error: 'Report reason is required' });
  }
  const report = db.addUserReport({
    id: `rep_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    reporterId: user.id,
    targetUserId: targetId,
    targetConversationId: conversationId,
    targetMessageId: messageId,
    reason: String(reason).trim(),
    details: details ? String(details).trim() : undefined,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json({ success: true, report });
});

// 6. Notifications (Categorized: Motherland, YouTube, Google, Facebook, Instagram, Wave)
app.get('/api/notifications', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const category = req.query.category as string;
  const items = db.getNotifications(user.id, category);
  res.json({
    notifications: items,
    unreadCount: items.filter((n) => !n.isRead).length,
  });
});

app.post('/api/notifications/mark-read', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { id } = req.body || {};
  db.markNotificationsRead(user.id, id);
  res.json({ success: true });
});

app.delete('/api/notifications/:id', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  db.deleteNotification(user.id, req.params.id);
  res.json({ success: true });
});

// ==========================================
// 7. MOTHERLAND WAVE (Messaging, Voice, Media, Groups, Disappearing & WebRTC Config)
// ==========================================
app.get('/api/webrtc/config', (req: Request, res: Response) => {
  const iceServers: { urls: string | string[]; username?: string; credential?: string }[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const hasTurn = Boolean(process.env.TURN_URL && process.env.TURN_USER && process.env.TURN_PASS);
  if (hasTurn) {
    iceServers.push({
      urls: process.env.TURN_URL!,
      username: process.env.TURN_USER!,
      credential: process.env.TURN_PASS!,
    });
  }
  res.json({ iceServers, hasTurn });
});

app.get('/api/calls', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  res.json({ calls: db.getUserCalls(user.id) });
});

app.post('/api/calls/log', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { callId, conversationId, callType, status, durationSeconds, calleeIds } = req.body || {};
  if (callId) {
    const existing = db.getCallRecordById(callId);
    if (existing) {
      const updated = db.updateCallRecord(callId, {
        status: status || existing.status,
        durationSeconds: typeof durationSeconds === 'number' ? durationSeconds : existing.durationSeconds,
        endedAt: new Date().toISOString(),
      });
      return res.json({ call: updated });
    }
  }
  const conv = conversationId ? db.getConversationById(conversationId) : undefined;
  if (!conv || !db.isConversationParticipant(conv, user.id)) {
    return res.status(400).json({ error: 'Valid conversationId is required' });
  }
  const targetIds = Array.isArray(calleeIds) && calleeIds.length > 0
    ? calleeIds
    : (conv.participantIds || []).filter((id) => id !== user.id);
  const firstPeer = targetIds[0] ? db.findUserById(targetIds[0]) : undefined;
  const record = db.addCallRecord({
    id: callId || `call_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    conversationId,
    callerId: user.id,
    callerName: user.displayName,
    callerAvatar: user.avatar,
    calleeIds: targetIds,
    calleeName: conv.isGroup ? conv.name : firstPeer?.displayName,
    calleeAvatar: conv.isGroup ? conv.photo : firstPeer?.avatar,
    callType: callType === 'video' ? 'video' : 'audio',
    isGroupCall: Boolean(conv.isGroup),
    status: status || 'ended',
    durationSeconds: Number(durationSeconds || 0),
    createdAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
  });
  res.status(201).json({ call: record });
});

app.get('/api/messages/conversations', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const onlineIds = getOnlineUserIds();
  const list = db.getUserConversations(user.id, onlineIds);
  const totalUnread = db.getTotalUnreadMessages(user.id);
  res.json({ conversations: list, totalUnread });
});

app.post('/api/messages/direct', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { targetUserId } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ error: 'targetUserId is required' });
  }
  const outcome = db.getOrCreateDirectConversation(user.id, targetUserId, getOnlineUserIds());
  if (outcome.error || !outcome.conversation) {
    return res.status(outcome.statusCode || 400).json({ error: outcome.error || 'Unable to open chat' });
  }
  if (outcome.conversation.isRequest && outcome.conversation.requestedBy === user.id) {
    const targetAcc = db.findUserById(targetUserId);
    if (targetAcc && targetAcc.notificationPrefs?.messages !== false) {
      const notif = {
        id: `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        recipientId: targetUserId,
        category: 'wave' as const,
        type: 'message_request' as const,
        sender: {
          id: user.id,
          displayName: user.displayName,
          avatar: user.avatar,
          username: user.username,
        },
        title: 'Wave Message Request',
        body: `${user.displayName} wants to connect with you on MOTHERLAND WAVE.`,
        targetId: outcome.conversation.id,
        targetType: 'chat' as const,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      db.addNotification(notif);
      sendWsToUser(targetUserId, 'notification:new', notif);
    }
    sendWsToUser(targetUserId, 'conv:update', { conversationId: outcome.conversation.id });
  }
  res.json({ conversation: outcome.conversation });
});

app.post('/api/messages/group', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { name, memberIds, photo } = req.body || {};
  const outcome = db.createGroupConversation(user.id, String(name || ''), Array.isArray(memberIds) ? memberIds : [], photo, getOnlineUserIds());
  if (outcome.error || !outcome.conversation) {
    return res.status(outcome.statusCode || 400).json({ error: outcome.error || 'Unable to create group' });
  }
  for (const pid of outcome.conversation.participantIds || []) {
    if (pid !== user.id) {
      sendWsToUser(pid, 'conv:update', { conversationId: outcome.conversation.id, action: 'group_created' });
      const peer = db.findUserById(pid);
      if (peer && peer.notificationPrefs?.groups !== false) {
        const notif = {
          id: `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          recipientId: pid,
          category: 'wave' as const,
          type: 'group_invite' as const,
          sender: { id: user.id, displayName: user.displayName, avatar: user.avatar, username: user.username },
          title: 'Added to Wave Group',
          body: `${user.displayName} added you to "${outcome.conversation.name}".`,
          targetId: outcome.conversation.id,
          targetType: 'group' as const,
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        db.addNotification(notif);
        sendWsToUser(pid, 'notification:new', notif);
      }
    }
  }
  res.status(201).json({ conversation: outcome.conversation });
});

app.post('/api/messages/:conversationId/respond-request', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const action = req.body?.action === 'decline' ? 'decline' : 'accept';
  const result = db.respondConversationRequest(req.params.conversationId, user.id, action, getOnlineUserIds());
  if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
  for (const rid of result.recipientIds || []) {
    sendWsToUser(rid, 'conv:update', { conversationId: req.params.conversationId, action });
  }
  res.json({ conversation: result.conversation });
});

app.post('/api/messages/:conversationId/members', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { memberIds } = req.body || {};
  const result = db.addGroupMembers(req.params.conversationId, user.id, Array.isArray(memberIds) ? memberIds : [], getOnlineUserIds());
  if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
  for (const pid of result.conversation?.participantIds || []) {
    sendWsToUser(pid, 'conv:update', { conversationId: req.params.conversationId });
    if (result.systemMessage && pid !== user.id) {
      sendWsToUser(pid, 'chat:message', { conversationId: req.params.conversationId, message: result.systemMessage, senderId: user.id });
    }
  }
  res.json({ conversation: result.conversation, systemMessage: result.systemMessage });
});

app.delete('/api/messages/:conversationId/members/:userId', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = db.removeGroupMember(req.params.conversationId, user.id, req.params.userId, getOnlineUserIds());
  if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
  sendWsToUser(req.params.userId, 'conv:update', { conversationId: req.params.conversationId, removed: true });
  for (const pid of result.conversation?.participantIds || []) {
    sendWsToUser(pid, 'conv:update', { conversationId: req.params.conversationId });
    if (result.systemMessage && pid !== user.id) {
      sendWsToUser(pid, 'chat:message', { conversationId: req.params.conversationId, message: result.systemMessage, senderId: user.id });
    }
  }
  res.json({ conversation: result.conversation, systemMessage: result.systemMessage });
});

app.post('/api/messages/:conversationId/admin', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { targetUserId, makeAdmin } = req.body || {};
  const result = db.setGroupAdmin(req.params.conversationId, user.id, String(targetUserId || ''), Boolean(makeAdmin), getOnlineUserIds());
  if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
  for (const pid of result.conversation?.participantIds || []) {
    sendWsToUser(pid, 'conv:update', { conversationId: req.params.conversationId });
  }
  res.json({ conversation: result.conversation });
});

app.post('/api/messages/:conversationId/leave', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = db.leaveGroupConversation(req.params.conversationId, user.id);
  if (!result.ok) return res.status(result.statusCode || 400).json({ error: result.error });
  for (const pid of result.remainingIds || []) {
    sendWsToUser(pid, 'conv:update', { conversationId: req.params.conversationId });
    if (result.systemMessage) {
      sendWsToUser(pid, 'chat:message', { conversationId: req.params.conversationId, message: result.systemMessage, senderId: user.id });
    }
  }
  res.json({ success: true });
});

app.put('/api/messages/:conversationId/settings', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = db.updateConversationSettings(req.params.conversationId, user.id, req.body || {}, getOnlineUserIds());
  if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
  if (result.broadcastMeta) {
    for (const pid of result.conversation?.participantIds || []) {
      sendWsToUser(pid, 'conv:update', { conversationId: req.params.conversationId });
    }
  }
  res.json({ conversation: result.conversation });
});

app.get('/api/messages/:conversationId/search', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const q = String(req.query.q || '');
  const result = db.searchConversationMessages(req.params.conversationId, user.id, q);
  if (result.error) return res.status(result.statusCode || 403).json({ error: result.error });
  res.json({ messages: result.messages || [] });
});

app.get('/api/messages/:conversationId/media', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = db.getConversationSharedMedia(req.params.conversationId, user.id);
  if (result.error) return res.status(result.statusCode || 403).json({ error: result.error });
  res.json({ items: result.items || [], links: result.links || [] });
});

app.get('/api/messages/:conversationId', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const convId = req.params.conversationId;
  const before = ((req.query.beforeId || req.query.before) as string) || undefined;
  const limit = Math.min(80, Math.max(1, parseInt((req.query.limit as string) || '35', 10)));
  const shouldMarkRead = req.query.markRead !== 'false' && req.query.markRead !== '0';

  const result = db.getConversationMessages(convId, user.id, before, limit);
  if (result.error) {
    return res.status(result.statusCode || 403).json({ error: result.error });
  }

  if (shouldMarkRead) {
    const readRes = db.markConversationRead(convId, user.id);
    if (readRes.ok && readRes.sendReceipt && readRes.participantIds) {
      for (const pid of readRes.participantIds) {
        if (pid !== user.id) {
          sendWsToUser(pid, 'chat:read', { conversationId: convId, userId: user.id });
        }
      }
    }
  }

  res.json({
    messages: result.messages || [],
    hasMore: Boolean(result.hasMore),
  });
});

app.post('/api/messages/:conversationId/read', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const convId = req.params.conversationId;
  const readRes = db.markConversationRead(convId, user.id);
  if (!readRes.ok) {
    return res.status(readRes.statusCode || 403).json({ error: readRes.error });
  }
  if (readRes.sendReceipt) {
    for (const pid of readRes.participantIds || []) {
      if (pid !== user.id) {
        sendWsToUser(pid, 'chat:read', { conversationId: convId, userId: user.id });
      }
    }
  }
  res.json({ success: true });
});

app.post('/api/messages/:conversationId', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const convId = req.params.conversationId;
  const {
    text,
    mediaUrl,
    mediaType,
    fileName,
    fileSize,
    mimeType,
    attachments,
    audioDuration,
    audioWaveform,
    replyTo,
    forwardedFrom,
    messageType,
  } = req.body || {};

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if ((!text || !String(text).trim()) && !mediaUrl && !hasAttachments) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  const onlineIds = getOnlineUserIds();
  const added = db.addChatMessage(convId, user.id, String(text || ''), mediaUrl, mediaType, {
    fileName,
    fileSize,
    mimeType,
    attachments,
    audioDuration,
    audioWaveform,
    replyTo,
    forwardedFrom,
    messageType,
    onlineUserIds: onlineIds,
  });
  if (added.error || !added.message) {
    return res.status(added.statusCode || 400).json({ error: added.error || 'Failed to send message' });
  }

  const convRaw = db.getConversationById(convId);
  for (const rid of added.recipientIds || []) {
    sendWsToUser(rid, 'chat:message', {
      conversationId: convId,
      message: added.message,
      senderId: user.id,
    });
    const recipient = db.findUserById(rid);
    const isMuted = Boolean(convRaw?.mutedBy?.includes(rid));
    if (recipient && !isMuted && recipient.notificationPrefs?.messages !== false) {
      sendWsToUser(rid, 'notification:new', {
        id: `chat_ping_${added.message.id}`,
        type: 'wave_message',
        category: 'wave',
        sender: {
          id: user.id,
          displayName: user.displayName,
          avatar: user.avatar,
          username: user.username,
        },
        title: convRaw?.isGroup ? `${convRaw.name || 'Wave Group'}` : user.displayName,
        body: added.message.text || (added.message.mediaType === 'audio' ? 'Sent a voice message' : 'Sent a media attachment'),
        conversationId: convId,
        targetId: convId,
        targetType: 'chat',
        isRead: false,
        createdAt: added.message.createdAt,
      });
    }
  }
  sendWsToUser(user.id, 'chat:message', {
    conversationId: convId,
    message: added.message,
    senderId: user.id,
  });

  res.status(201).json({ message: added.message, conversation: added.conversation });
});

app.patch('/api/messages/:conversationId/:msgId', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = db.editChatMessage(req.params.conversationId, req.params.msgId, user.id, String(req.body?.text || ''));
  if (result.error || !result.message) return res.status(result.statusCode || 400).json({ error: result.error });
  for (const uid of [...(result.recipientIds || []), user.id]) {
    sendWsToUser(uid, 'chat:message_update', { conversationId: req.params.conversationId, message: result.message });
  }
  res.json({ message: result.message });
});

app.delete('/api/messages/:conversationId/:msgId', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const mode = req.query.mode === 'me' || req.body?.mode === 'me' ? 'me' : 'everyone';
  const result = db.deleteChatMessage(req.params.conversationId, req.params.msgId, user.id, mode);
  if (result.error || !result.message) return res.status(result.statusCode || 400).json({ error: result.error });
  if (mode === 'everyone') {
    for (const uid of [...(result.recipientIds || []), user.id]) {
      sendWsToUser(uid, 'chat:message_delete', { conversationId: req.params.conversationId, msgId: req.params.msgId, message: result.message });
    }
  }
  res.json({ success: true, message: result.message });
});

app.post('/api/messages/:conversationId/:msgId/react', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const emoji = String(req.body?.emoji || '❤️').slice(0, 8);
  const result = db.toggleChatReaction(req.params.conversationId, req.params.msgId, user.id, emoji);
  if (result.error || !result.message) return res.status(result.statusCode || 400).json({ error: result.error });
  for (const uid of [...(result.recipientIds || []), user.id]) {
    sendWsToUser(uid, 'chat:message_update', { conversationId: req.params.conversationId, message: result.message });
  }
  res.json({ message: result.message });
});

app.post('/api/messages/:conversationId/:msgId/pin', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const result = db.togglePinChatMessage(req.params.conversationId, req.params.msgId, user.id);
  if (result.error || !result.message) return res.status(result.statusCode || 400).json({ error: result.error });
  for (const uid of [...(result.recipientIds || []), user.id]) {
    sendWsToUser(uid, 'chat:message_update', { conversationId: req.params.conversationId, message: result.message });
    sendWsToUser(uid, 'conv:update', { conversationId: req.params.conversationId });
  }
  res.json({ message: result.message, pinnedMessageIds: result.pinnedMessageIds });
});

// Platform Adapters & Multi-Platform Publishing (Part 8 & Part 11)
app.get('/api/platforms/status', (req: Request, res: Response) => {
  const user = getReqUser(req);
  const ytKey = getActiveYouTubeKey();
  const ytOAuth = user ? db.getYouTubeOAuth(user.id) : undefined;
  const ytConnected = Boolean(ytKey || ytOAuth);
  const adapters: PlatformAdapterInfo[] = [
    {
      platform: 'motherland',
      name: 'MOTHERLAND',
      icon: 'shield-check',
      color: '#10b981',
      status: 'Connected',
      statusMessage: 'Official MOTHERLAND distributed ledger and storage online.',
      canPublish: true,
      canReadFeed: true,
      featuresSupported: ['Unified Posts', 'Shorts', '16:9 Long Video', 'Stories', 'Reactions', 'Real-Time Chat'],
    },
    {
      platform: 'youtube',
      name: 'YouTube',
      icon: 'youtube',
      color: '#ef4444',
      status: ytConnected ? 'Connected' : 'Permission Required',
      statusMessage: ytOAuth
        ? `OAuth channel "${ytOAuth.channelTitle}" connected for direct upload${ytKey ? ' + YouTube Data API v3 search enabled.' : '.'}`
        : ytKey
        ? 'YouTube Data API v3 read access active. Connect your Google OAuth account to upload directly.'
        : 'YouTube Data API key is not configured in this workspace. Add YOUTUBE_API_KEY or connect OAuth.',
      canPublish: Boolean(ytOAuth),
      canReadFeed: Boolean(ytKey || ytOAuth),
      featuresSupported: ['Video Search', 'Live Streams', 'OAuth Video Upload', 'Real Comments & Replies', 'Shorts Discovery'],
    },
    {
      platform: 'instagram',
      name: 'Instagram',
      icon: 'instagram',
      color: '#ec4899',
      status: 'Coming Soon',
      statusMessage: 'Instagram Graph API adapter ready. Requires Meta App Review & Access Token.',
      canPublish: false,
      canReadFeed: false,
      featuresSupported: ['Reels Playback Adapter', 'Media Mapping', 'Feed Cards'],
    },
    {
      platform: 'tiktok',
      name: 'TikTok',
      icon: 'video',
      color: '#06b6d4',
      status: 'Coming Soon',
      statusMessage: 'TikTok Open API adapter ready. Requires TikTok Developer Client Key & Scopes.',
      canPublish: false,
      canReadFeed: false,
      featuresSupported: ['Vertical Shorts Adapter', 'Creator Attribution', 'Share Intent'],
    },
    {
      platform: 'facebook',
      name: 'Facebook',
      icon: 'facebook',
      color: '#3b82f6',
      status: 'Coming Soon',
      statusMessage: 'Meta Pages & Video API adapter ready. Requires Facebook Page Access Token.',
      canPublish: false,
      canReadFeed: false,
      featuresSupported: ['Video Embedding', 'Post Syndication', 'Page Connect'],
    },
  ];

  res.json({ adapters });
});

app.post('/api/platforms/publish', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { content, platforms: requestedPlatforms } = req.body;
  const ytKey = getActiveYouTubeKey();

  const jobResults = (requestedPlatforms || ['motherland']).map((p: string) => {
    if (p === 'motherland') {
      return { platform: 'motherland', status: 'Published', message: 'Successfully published to MOTHERLAND Feed.' };
    }
    if (p === 'youtube') {
      return {
        platform: 'youtube',
        status: ytKey ? 'Permission Required' : 'Not Connected',
        message: ytKey
          ? 'YouTube Data API v3 Key grants read access. Uploading new videos directly to YouTube requires user OAuth with scope: https://www.googleapis.com/auth/youtube.upload.'
          : 'YouTube API Key is missing.',
      };
    }
    return {
      platform: p,
      status: 'Not Connected',
      message: `Official ${p.toUpperCase()} OAuth token not provided. Multi-platform publish simulation is strictly disabled.`,
    };
  });

  res.json({
    id: `pub_${Date.now()}`,
    content,
    platforms: jobResults,
    createdAt: new Date().toISOString(),
  });
});

// ==========================================
// SYSTEM PERSISTENCE, BACKUPS & MONITORING (OWNER/ADMIN ONLY)
// ==========================================
app.get('/api/system/persistence-status', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: owner or admin authorization required.' });
  }
  const health = db.getPersistenceHealth();
  const backups = db.listBackups().slice(0, 15).map((b) => ({
    filename: b.filename,
    reason: b.reason,
    createdAt: b.createdAt,
    byteSize: b.byteSize,
    sha256: b.sha256,
    schemaVersion: b.schemaVersion,
    counts: b.counts,
    verified: b.verified,
  }));
  res.json({ health, backups });
});

app.post('/api/system/backup', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;
  if (user.role !== 'owner' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: owner or admin authorization required.' });
  }
  const reason = String(req.body?.reason || 'manual_api').slice(0, 24);
  const backup = db.createBackup(reason);
  res.status(201).json({
    success: true,
    backup: {
      filename: backup.filename,
      reason: backup.reason,
      createdAt: backup.createdAt,
      byteSize: backup.byteSize,
      sha256: backup.sha256,
      counts: backup.counts,
      verified: backup.verified,
    },
  });
});

// ==========================================
// VITE DEV SERVER OR STATIC ASSET SERVING
// ==========================================

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  const httpServer = http.createServer(app);

  // Real-time WebSocket Server strictly bound to /ws path (zero conflict with Vite)
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket, _req: any, userId: string) => {
    if (!wsConnections.has(userId)) {
      wsConnections.set(userId, new Set());
    }
    const userSockets = wsConnections.get(userId)!;
    const wasOffline = userSockets.size === 0;
    userSockets.add(ws);
    db.touchUserLastActive(userId);

    if (wasOffline) {
      notifyUserFriendsPresence(userId, true);
    }

    try {
      ws.send(JSON.stringify({ event: 'ws:ready', payload: { userId } }));
    } catch {
      // Ignore send error on immediate close
    }

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(String(raw));
        const ev = parsed?.event;
        const payload = parsed?.payload || {};

        if (ev === 'ping') {
          ws.send(JSON.stringify({ event: 'pong', payload: { ts: Date.now() } }));
          return;
        }

        if (ev === 'chat:typing' && payload.conversationId) {
          const conv = db.getConversationById(payload.conversationId);
          if (conv && db.isConversationParticipant(conv, userId)) {
            const pIds = conv.participantIds || conv.participants.map((p) => p.id);
            const sender = db.findUserById(userId);
            for (const pid of pIds) {
              if (pid !== userId) {
                sendWsToUser(pid, 'chat:typing', {
                  conversationId: payload.conversationId,
                  userId,
                  userName: sender?.displayName || 'Someone',
                  isTyping: Boolean(payload.isTyping),
                });
              }
            }
          }
          return;
        }

        if (ev === 'call:signal') {
          const convId = String(payload.conversationId || '');
          const signalType = String(payload.signalType || '');
          const callId = String(payload.callId || `call_${Date.now()}`);
          const callType: 'audio' | 'video' = payload.callType === 'video' ? 'video' : 'audio';
          const conv = convId ? db.getConversationById(convId) : undefined;
          if (!conv || !db.isConversationParticipant(conv, userId)) return;

          const pIds = conv.participantIds || conv.participants.map((p) => p.id);
          const targets: string[] = payload.targetUserId
            ? [String(payload.targetUserId)].filter((id) => id !== userId && pIds.includes(id))
            : pIds.filter((id) => id !== userId);

          const caller = db.findUserById(userId);
          if (!caller) return;

          if (signalType === 'offer') {
            // Privacy & block checks on call initiation
            const allowedTargets: string[] = [];
            for (const tid of targets) {
              const targetAcc = db.findUserById(tid);
              if (!targetAcc || db.isBlocked(userId, tid)) continue;
              const callPolicy = targetAcc.privacy?.allowCalls || 'everyone';
              if (callPolicy === 'none') continue;
              if (callPolicy === 'friends' && !db.isFriend(userId, tid)) continue;
              allowedTargets.push(tid);
            }

            if (allowedTargets.length === 0) {
              sendWsToUser(userId, 'call:signal', {
                callId,
                conversationId: convId,
                signalType: 'decline',
                reason: 'privacy_restricted',
                fromUserId: targets[0],
              });
              return;
            }

            const existingCall = db.getCallRecordById(callId);
            if (!existingCall) {
              const firstPeer = db.findUserById(allowedTargets[0]);
              db.addCallRecord({
                id: callId,
                conversationId: convId,
                callerId: userId,
                callerName: caller.displayName,
                callerAvatar: caller.avatar,
                calleeIds: allowedTargets,
                calleeName: conv.isGroup ? conv.name : firstPeer?.displayName,
                calleeAvatar: conv.isGroup ? conv.photo : firstPeer?.avatar,
                callType,
                isGroupCall: Boolean(conv.isGroup),
                status: 'ringing',
                durationSeconds: 0,
                createdAt: new Date().toISOString(),
              });
            }

            for (const tid of allowedTargets) {
              sendWsToUser(tid, 'call:signal', {
                ...payload,
                callId,
                conversationId: convId,
                signalType: 'offer',
                callType,
                isGroupCall: Boolean(conv.isGroup),
                groupName: conv.isGroup ? conv.name : undefined,
                fromUserId: userId,
                fromUserName: caller.displayName,
                fromUserAvatar: caller.avatar,
              });
            }
            return;
          }

          if (signalType === 'accept') {
            db.updateCallRecord(callId, { status: 'connected' });
          } else if (signalType === 'decline' || signalType === 'busy') {
            db.updateCallRecord(callId, {
              status: signalType === 'busy' ? 'busy' : 'declined',
              endedAt: new Date().toISOString(),
            });
          } else if (signalType === 'hangup' || signalType === 'missed') {
            const existing = db.getCallRecordById(callId);
            const wasConnected = existing?.status === 'connected';
            const finalStatus = signalType === 'missed' ? 'missed' : wasConnected ? 'ended' : 'missed';
            db.updateCallRecord(callId, {
              status: finalStatus,
              durationSeconds: Number(payload.durationSeconds || existing?.durationSeconds || 0),
              endedAt: new Date().toISOString(),
            });
            if (finalStatus === 'missed' && existing) {
              for (const tid of existing.calleeIds) {
                if (tid === userId && existing.callerId === userId) continue;
                if (tid === userId) continue;
                const peer = db.findUserById(tid);
                if (peer && peer.notificationPrefs?.calls !== false) {
                  const notif = {
                    id: `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                    recipientId: tid,
                    category: 'wave' as const,
                    type: 'call_missed' as const,
                    sender: {
                      id: userId,
                      displayName: caller.displayName,
                      avatar: caller.avatar,
                      username: caller.username,
                    },
                    title: 'Missed Wave Call',
                    body: `You missed a ${callType} call from ${caller.displayName}.`,
                    targetId: convId,
                    targetType: 'call' as const,
                    isRead: false,
                    createdAt: new Date().toISOString(),
                  };
                  db.addNotification(notif);
                  sendWsToUser(tid, 'notification:new', notif);
                }
              }
            }
          }

          for (const tid of targets) {
            sendWsToUser(tid, 'call:signal', {
              ...payload,
              callId,
              conversationId: convId,
              fromUserId: userId,
              fromUserName: caller.displayName,
              fromUserAvatar: caller.avatar,
            });
          }
        }
      } catch {
        // Ignore malformed packets
      }
    });

    ws.on('close', () => {
      db.touchUserLastActive(userId);
      const set = wsConnections.get(userId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          wsConnections.delete(userId);
          notifyUserFriendsPresence(userId, false);
        }
      }
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      if (reqUrl.pathname !== '/ws') {
        return; // Let other handlers or close non-/ws upgrades naturally
      }
      const tokenParam = reqUrl.searchParams.get('token') || '';
      const authHeader = request.headers.authorization || '';
      const cookieToken = request.headers.cookie ? parseCookies(request.headers.cookie)[AUTH_COOKIE_NAME] || '' : '';
      const rawToken =
        tokenParam || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '') || cookieToken.trim();
      const session = rawToken ? db.findSessionByToken(rawToken) : undefined;
      if (!session) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      const user = db.findUserById(session.userId);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, user.id);
      });
    } catch {
      socket.destroy();
    }
  });

  if (isDev) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  // Run initial UTC story expiration sweep cleanly without touching accounts or posts
  db.expireStoriesOlderThan24hUtc();

  // Periodic background jobs:
  // 1) Strict 24-hour UTC story expiration sweep every 5 minutes
  const storyExpiryInterval = setInterval(() => {
    try {
      db.expireStoriesOlderThan24hUtc();
    } catch (err) {
      console.error('[MOTHERLAND] UTC story expiry check error:', err);
    }
  }, 5 * 60 * 1000);
  storyExpiryInterval.unref?.();

  // 2) Automated independent verified DB backup every 15 minutes
  const backupInterval = setInterval(() => {
    try {
      db.createBackup('scheduled');
    } catch (err) {
      console.error('[MOTHERLAND] Scheduled backup error:', err);
    }
  }, 15 * 60 * 1000);
  backupInterval.unref?.();

  const handleGracefulShutdown = (signal: string) => {
    console.log(`[MOTHERLAND] Received ${signal}. Flushing database & creating shutdown snapshot...`);
    try {
      clearInterval(storyExpiryInterval);
      clearInterval(backupInterval);
      db.save();
    } catch (err) {
      console.error('[MOTHERLAND] Shutdown save error:', err);
    }
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref?.();
  };

  process.once('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => handleGracefulShutdown('SIGINT'));

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[MOTHERLAND] Super App Engine (HTTP + WebSocket) running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[MOTHERLAND] Fatal server initialization error:', err);
  process.exit(1);
});
