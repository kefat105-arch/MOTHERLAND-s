import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  CURRENT_SCHEMA_VERSION,
  MigrationRecord,
  BackupMetadata,
  ExpiredStoryArchiveEntry,
  PersistencePaths,
  resolvePersistencePaths,
  ensureDirExists,
  atomicWriteJsonSync,
  getPersistentAuthSecret,
  hashSessionToken,
  createDatabaseBackup,
  listDatabaseBackups,
  verifyBackupFile,
  loadDatabaseSafely,
  computeSha256,
  inferMimeFromFilename,
  parseDeviceName,
} from './persistence';
import type {
  UserProfile,
  UserPrivacySettings,
  NotificationPreferences,
  Post,
  Story,
  ShortVideo,
  LongVideo,
  FriendRequest,
  Conversation,
  ChatMessage,
  ChatAttachment,
  ChatReplySnapshot,
  CallRecord,
  DraftPost,
  SavedVideoItem,
  WatchHistoryRecord,
  UserReport,
  NotificationItem,
  ReactionType,
  PlatformSource,
  RelationshipStatus,
  DeviceSessionInfo,
  MediaAssetRecord,
} from '../types';

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations?: number;
  authProvider?: 'password' | 'google';
  displayName: string;
  avatar: string;
  coverImage: string;
  bio: string;
  website?: string;
  location?: string;
  work?: string;
  education?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  joinedDate: string;
  isVerified?: boolean;
  role: 'owner' | 'admin' | 'user';
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  twoFactorEnabled: boolean;
  isPrivate: boolean;
  privacy: UserPrivacySettings;
  notificationPrefs?: NotificationPreferences;
  dataSaver?: boolean;
  lastActiveAt?: string;
  socialLinks?: {
    youtube?: string;
    instagram?: string;
    tiktok?: string;
    facebook?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id?: string;
  token?: string;
  tokenHash?: string;
  userId: string;
  deviceName?: string;
  ipAddress?: string;
  authMethod?: 'password' | 'google' | 'register' | 'switch' | 'legacy';
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
  userAgent?: string;
}

export interface ReactionRecord {
  postId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
}

export interface SavedPostRecord {
  postId: string;
  userId: string;
  createdAt: string;
}

export interface FollowRecord {
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface FriendshipRecord {
  user1Id: string;
  user2Id: string;
  createdAt: string;
}

export interface BlockRecord {
  userId: string;
  blockedUserId: string;
  createdAt: string;
}

export interface OtpRecord {
  identifier: string; // email or phone
  code: string;
  type: 'register' | 'phone_verify' | 'forgot_password';
  expiresAt: number;
}

export interface YouTubeOAuthRecord {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
  channelId: string;
  channelTitle: string;
  channelAvatar: string;
  subscriberCount?: string;
  customUrl?: string;
  connectedAt: string;
  updatedAt: string;
}

export interface DatabaseSchema {
  schemaVersion?: number;
  migrationsApplied?: MigrationRecord[];
  lastBackupAt?: string;
  users: UserAccount[];
  sessions: Session[];
  posts: Post[];
  reactions: ReactionRecord[];
  savedPosts: SavedPostRecord[];
  postComments: Record<string, any[]>;
  stories: Story[];
  expiredStoriesArchive?: ExpiredStoryArchiveEntry[];
  mediaAssets?: MediaAssetRecord[];
  shortVideos: ShortVideo[];
  longVideos: LongVideo[];
  friendships: FriendshipRecord[];
  friendRequests: FriendRequest[];
  follows: FollowRecord[];
  blocks: BlockRecord[];
  notifications: (NotificationItem & { recipientId: string; category?: string })[];
  conversations: Conversation[];
  conversationMessages: Record<string, ChatMessage[]>;
  calls?: CallRecord[];
  drafts?: DraftPost[];
  savedVideos?: SavedVideoItem[];
  watchHistory?: WatchHistoryRecord[];
  reports?: UserReport[];
  otpCodes: OtpRecord[];
  youtubeOAuth?: Record<string, YouTubeOAuthRecord>;
}

export const DEFAULT_PBKDF2_ITERATIONS = 120000;
export const LEGACY_PBKDF2_ITERATIONS = 1000;

// Password Hashing Helper (Upgraded PBKDF2-SHA512 with backward compatibility for legacy accounts)
export function hashPassword(
  password: string,
  salt = crypto.randomBytes(16).toString('hex'),
  iterations = DEFAULT_PBKDF2_ITERATIONS
): { hash: string; salt: string; iterations: number } {
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return { hash, salt, iterations };
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
  iterations?: number
): boolean {
  if (!password || !hash || !salt) return false;
  const primaryIters = iterations && iterations > 0 ? iterations : LEGACY_PBKDF2_ITERATIONS;
  const checkPrimary = crypto.pbkdf2Sync(password, salt, primaryIters, 64, 'sha512').toString('hex');
  if (timingSafeHexEqual(checkPrimary, hash)) {
    return true;
  }
  if (!iterations) {
    const checkStrong = crypto.pbkdf2Sync(password, salt, DEFAULT_PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
    if (timingSafeHexEqual(checkStrong, hash)) {
      return true;
    }
  }
  return false;
}

export function needsPasswordUpgrade(user: UserAccount): boolean {
  return !user.passwordIterations || user.passwordIterations < DEFAULT_PBKDF2_ITERATIONS;
}

// Initial Database Seeding
const DEFAULT_PASSWORD = 'Motherland2026!';

function getInitialDbData(): DatabaseSchema {
  const { hash: ownerHash, salt: ownerSalt } = hashPassword(DEFAULT_PASSWORD);
  const { hash: nadiaHash, salt: nadiaSalt } = hashPassword(DEFAULT_PASSWORD);
  const { hash: tariqHash, salt: tariqSalt } = hashPassword(DEFAULT_PASSWORD);
  const { hash: ayeshaHash, salt: ayeshaSalt } = hashPassword(DEFAULT_PASSWORD);

  const ownerUser: UserAccount = {
    id: 'usr_kefat_01',
    username: 'kefatahmed',
    email: 'kefat@motherland.social',
    passwordHash: ownerHash,
    passwordSalt: ownerSalt,
    displayName: 'Kefat Ahmed',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&auto=format&fit=crop&q=80',
    bio: 'Founder & Systems Architect @ MOTHERLAND. Architecting next-generation sovereign social infrastructure.',
    website: 'https://motherland.social',
    location: 'Dhaka, Bangladesh',
    work: 'Founder & Lead Systems Architect @ MOTHERLAND',
    education: 'Computer Science & Distributed Systems',
    phoneNumber: '+8801700000001',
    dateOfBirth: '1998-05-12',
    gender: 'Male',
    address: 'Gulshan-2, Dhaka, Bangladesh',
    joinedDate: 'November 2026',
    isVerified: true,
    role: 'owner',
    isEmailVerified: true,
    isPhoneVerified: true,
    twoFactorEnabled: false,
    isPrivate: false,
    privacy: {
      profileVisibility: 'public',
      showOnlineStatus: true,
      allowDirectMessages: 'everyone',
      showContactInfo: true,
    },
    socialLinks: {
      youtube: 'https://youtube.com/@motherland-social',
      facebook: 'https://facebook.com/motherland',
      instagram: 'https://instagram.com/motherland',
    },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const seedUser2: UserAccount = {
    id: 'usr_nadia_02',
    username: 'nadia_creative',
    email: 'nadia@motherland.social',
    passwordHash: nadiaHash,
    passwordSalt: nadiaSalt,
    displayName: 'Nadia Hossain',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1600&auto=format&fit=crop&q=80',
    bio: 'Visual story director & cinema colorist. Capturing the untold beauty of South Asia 🎨📽️',
    website: 'https://nadiahossain.studio',
    location: 'Chittagong, Bangladesh',
    work: 'Independent Film Director',
    education: 'Dhaka University Fine Arts',
    phoneNumber: '+8801700000002',
    dateOfBirth: '2000-08-20',
    gender: 'Female',
    joinedDate: 'October 2026',
    isVerified: true,
    role: 'user',
    isEmailVerified: true,
    isPhoneVerified: true,
    twoFactorEnabled: false,
    isPrivate: false,
    privacy: { profileVisibility: 'public', showOnlineStatus: true, allowDirectMessages: 'everyone', showContactInfo: false },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const seedUser3: UserAccount = {
    id: 'usr_tariq_03',
    username: 'tariq_nature',
    email: 'tariq@motherland.social',
    passwordHash: tariqHash,
    passwordSalt: tariqSalt,
    displayName: 'Tariqul Islam',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80',
    bio: 'Wildlife & drone cinematographer. Highlighting Sundarbans & Cox’s Bazar marine life 🌿🐅',
    location: 'Khulna, Bangladesh',
    work: 'National Geo Explorer Contributor',
    phoneNumber: '+8801700000003',
    dateOfBirth: '1996-03-15',
    gender: 'Male',
    joinedDate: 'September 2026',
    isVerified: true,
    role: 'user',
    isEmailVerified: true,
    isPhoneVerified: true,
    twoFactorEnabled: false,
    isPrivate: false,
    privacy: { profileVisibility: 'public', showOnlineStatus: true, allowDirectMessages: 'everyone', showContactInfo: true },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const seedUser4: UserAccount = {
    id: 'usr_ayesha_04',
    username: 'ayesha_tech',
    email: 'ayesha@motherland.social',
    passwordHash: ayeshaHash,
    passwordSalt: ayeshaSalt,
    displayName: 'Ayesha Rahman',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1600&auto=format&fit=crop&q=80',
    bio: 'AI Engineer & Web3 builder. Writing tutorials on real-time streaming and decentralized social graphs 💻⚡',
    location: 'Sylhet, Bangladesh',
    work: 'Senior Distributed Engineer',
    phoneNumber: '+8801700000004',
    dateOfBirth: '1999-11-04',
    gender: 'Female',
    joinedDate: 'August 2026',
    isVerified: true,
    role: 'user',
    isEmailVerified: true,
    isPhoneVerified: true,
    twoFactorEnabled: false,
    isPrivate: false,
    privacy: { profileVisibility: 'public', showOnlineStatus: true, allowDirectMessages: 'everyone', showContactInfo: true },
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const seedPosts: Post[] = [
    {
      id: 'post_01',
      source: 'motherland',
      author: {
        id: ownerUser.id,
        username: ownerUser.username,
        displayName: ownerUser.displayName,
        avatar: ownerUser.avatar,
        isVerified: true,
      },
      content: 'Welcome to MOTHERLAND! 🇧🇩✨ We are officially initializing the next-generation social ecosystem: unified feed, vertical 9:16 Shorts, 16:9 Cinema Long Video, real-time messaging, and seamless YouTube Data API v3 integration. Built for creators, communities, and uncompromised digital sovereignty.',
      mediaType: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
      mediaAspectRatio: '16:9',
      hashtags: ['Motherland', 'NextGenSocial', 'Bangladesh', 'Innovation'],
      audience: 'public',
      createdAt: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      stats: {
        likes: 3,
        comments: 1,
        shares: 26,
        views: 1890,
      },
    },
    {
      id: 'post_02',
      source: 'motherland',
      author: {
        id: seedUser2.id,
        username: seedUser2.username,
        displayName: seedUser2.displayName,
        avatar: seedUser2.avatar,
        isVerified: true,
      },
      content: 'Early morning cinematic frames captured around Jaflong stone beds and tea gardens. Golden hour light hitting the river rocks creates this breathtaking natural emerald grading. What should be our next location? 🌿🎥',
      mediaType: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
      mediaAspectRatio: '16:9',
      hashtags: ['Jaflong', 'Sylhet', 'Cinematography', 'Nature'],
      audience: 'public',
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      stats: {
        likes: 2,
        comments: 0,
        shares: 12,
        views: 940,
      },
    },
    {
      id: 'post_03',
      source: 'motherland',
      author: {
        id: seedUser3.id,
        username: seedUser3.username,
        displayName: seedUser3.displayName,
        avatar: seedUser3.avatar,
        isVerified: true,
      },
      content: 'Sundarbans mangrove waterways at dawn. Spotted a herd of spotted deer by the canal bank. Respecting wildlife habitats with ultra-quiet long-lens optics. 🦌🌊',
      mediaType: 'image',
      mediaUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&auto=format&fit=crop&q=80',
      mediaAspectRatio: '16:9',
      hashtags: ['Sundarbans', 'Wildlife', 'Ecology', 'Biodiversity'],
      audience: 'public',
      createdAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
      stats: {
        likes: 1,
        comments: 0,
        shares: 8,
        views: 710,
      },
    },
  ];

  // Seed reactions - 1 per user per post!
  const seedReactions: ReactionRecord[] = [
    { postId: 'post_01', userId: ownerUser.id, type: 'fire', createdAt: new Date().toISOString() },
    { postId: 'post_01', userId: seedUser2.id, type: 'love', createdAt: new Date().toISOString() },
    { postId: 'post_01', userId: seedUser3.id, type: 'like', createdAt: new Date().toISOString() },
    { postId: 'post_02', userId: ownerUser.id, type: 'love', createdAt: new Date().toISOString() },
    { postId: 'post_02', userId: seedUser4.id, type: 'fire', createdAt: new Date().toISOString() },
    { postId: 'post_03', userId: seedUser2.id, type: 'like', createdAt: new Date().toISOString() },
  ];

  const seedStories: Story[] = [
    {
      id: 'story_01',
      userId: ownerUser.id,
      userDisplayName: ownerUser.displayName,
      userUsername: ownerUser.username,
      userAvatar: ownerUser.avatar,
      isUserVerified: true,
      source: 'motherland',
      mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      mediaType: 'image',
      caption: 'Testing 24h ephemeral story nodes 🇧🇩⚡',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString(),
      viewersCount: 420,
    },
    {
      id: 'story_02',
      userId: seedUser2.id,
      userDisplayName: seedUser2.displayName,
      userUsername: seedUser2.username,
      userAvatar: seedUser2.avatar,
      isUserVerified: true,
      source: 'motherland',
      mediaUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
      mediaType: 'image',
      caption: 'Grading fresh 4K footage for documentary 🎬✨',
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 21).toISOString(),
      viewersCount: 310,
    },
    {
      id: 'story_03',
      userId: seedUser3.id,
      userDisplayName: seedUser3.displayName,
      userUsername: seedUser3.username,
      userAvatar: seedUser3.avatar,
      isUserVerified: true,
      source: 'motherland',
      mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
      mediaType: 'image',
      caption: 'Sunset over Kaptai Lake waterways 🚤🌅',
      createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 19).toISOString(),
      viewersCount: 680,
    },
  ];

  const seedShorts: ShortVideo[] = [];

  const seedLongVideos: LongVideo[] = [
    {
      id: 'long_01',
      source: 'motherland',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=1280&auto=format&fit=crop&q=80',
      title: 'MOTHERLAND Systems Architecture — The Sovereign Digital Super App',
      description: 'An in-depth presentation detailing MOTHERLAND’s multi-tenant architecture, persistent distributed ledger, seamless YouTube Data API integration, and high-performance video engine.',
      duration: '09:56',
      channel: {
        id: ownerUser.id,
        title: ownerUser.displayName,
        avatar: ownerUser.avatar,
        subscriberCount: '18.4K',
        isVerified: true,
      },
      stats: {
        views: 45200,
        likes: 3820,
        comments: 290,
      },
      publishedAt: '2 days ago',
      tags: ['Motherland', 'Architecture', 'WebEngineering', 'Keynote'],
    },
  ];

  const seedFriendships: FriendshipRecord[] = [
    { user1Id: ownerUser.id, user2Id: seedUser2.id, createdAt: new Date().toISOString() },
    { user1Id: ownerUser.id, user2Id: seedUser3.id, createdAt: new Date().toISOString() },
  ];

  const seedFollows: FollowRecord[] = [
    { followerId: ownerUser.id, followingId: seedUser2.id, createdAt: new Date().toISOString() },
    { followerId: ownerUser.id, followingId: seedUser3.id, createdAt: new Date().toISOString() },
    { followerId: seedUser2.id, followingId: ownerUser.id, createdAt: new Date().toISOString() },
    { followerId: seedUser3.id, followingId: ownerUser.id, createdAt: new Date().toISOString() },
    { followerId: seedUser4.id, followingId: ownerUser.id, createdAt: new Date().toISOString() },
  ];

  const seedNotifications: (NotificationItem & { recipientId: string; category?: string })[] = [
    {
      id: 'notif_01',
      recipientId: ownerUser.id,
      category: 'motherland',
      type: 'like',
      sender: {
        id: seedUser2.id,
        displayName: seedUser2.displayName,
        avatar: seedUser2.avatar,
        username: seedUser2.username,
      },
      title: 'New Reaction',
      body: 'Nadia Hossain loved your post about MOTHERLAND ecosystem.',
      targetId: 'post_01',
      targetType: 'post',
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: 'notif_02',
      recipientId: ownerUser.id,
      category: 'youtube',
      type: 'platform_alert',
      sender: {
        id: 'sys_yt',
        displayName: 'YouTube Partner Engine',
        avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=youtube',
        username: 'youtube_live',
      },
      title: 'YouTube Sync Online',
      body: 'YouTube Data API v3 integration active with infinite video stream search enabled.',
      isRead: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
  ];

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    migrationsApplied: [],
    lastBackupAt: new Date().toISOString(),
    users: [ownerUser, seedUser2, seedUser3, seedUser4],
    sessions: [],
    posts: seedPosts,
    reactions: seedReactions,
    savedPosts: [],
    postComments: {
      post_01: [
        {
          id: 'cmt_seed_1',
          postId: 'post_01',
          userId: seedUser2.id,
          userDisplayName: seedUser2.displayName,
          userUsername: seedUser2.username,
          userAvatar: seedUser2.avatar,
          text: 'Proud to see MOTHERLAND leading sovereign digital media in South Asia! 🇧🇩❤️',
          createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
          likesCount: 2,
          isLiked: false,
        },
      ],
    },
    stories: seedStories,
    expiredStoriesArchive: [],
    mediaAssets: [],
    shortVideos: seedShorts,
    longVideos: seedLongVideos,
    friendships: seedFriendships,
    friendRequests: [],
    follows: seedFollows,
    blocks: [],
    notifications: seedNotifications,
    conversations: [],
    conversationMessages: {},
    calls: [],
    drafts: [],
    savedVideos: [],
    watchHistory: [],
    reports: [],
    otpCodes: [],
    youtubeOAuth: {},
  };
}

export class MotherlandDatabase {
  private data: DatabaseSchema;
  private isLoaded = false;
  private paths: PersistencePaths;
  private loadedFrom: 'primary' | 'backup_recovery' | 'fresh_seed' = 'primary';
  private recoveredBackupName?: string;
  private lastSaveSha256?: string;
  private saveCount = 0;

  constructor(customPaths?: PersistencePaths) {
    this.paths = customPaths || resolvePersistencePaths();
    ensureDirExists(this.paths.dataDir);
    ensureDirExists(this.paths.uploadsDir);
    ensureDirExists(this.paths.backupsDir);
    getPersistentAuthSecret(this.paths);
    this.data = getInitialDbData();
    this.load();
  }

  public getPaths(): PersistencePaths {
    return this.paths;
  }

  private normalizeCollections(): void {
    if (!Array.isArray(this.data.users)) this.data.users = [];
    if (!Array.isArray(this.data.sessions)) this.data.sessions = [];
    if (!Array.isArray(this.data.posts)) this.data.posts = [];
    if (!Array.isArray(this.data.stories)) this.data.stories = [];
    if (!Array.isArray(this.data.shortVideos)) this.data.shortVideos = [];
    if (!Array.isArray(this.data.longVideos)) this.data.longVideos = [];
    if (!Array.isArray(this.data.conversations)) this.data.conversations = [];
    if (!this.data.conversationMessages || typeof this.data.conversationMessages !== 'object') {
      this.data.conversationMessages = {};
    }
    if (!Array.isArray(this.data.blocks)) this.data.blocks = [];
    if (!Array.isArray(this.data.friendRequests)) this.data.friendRequests = [];
    if (!Array.isArray(this.data.friendships)) this.data.friendships = [];
    if (!Array.isArray(this.data.follows)) this.data.follows = [];
    if (!Array.isArray(this.data.savedPosts)) this.data.savedPosts = [];
    if (!Array.isArray(this.data.reactions)) this.data.reactions = [];
    if (!Array.isArray(this.data.notifications)) this.data.notifications = [];
    if (!Array.isArray(this.data.calls)) this.data.calls = [];
    if (!Array.isArray(this.data.drafts)) this.data.drafts = [];
    if (!Array.isArray(this.data.savedVideos)) this.data.savedVideos = [];
    if (!Array.isArray(this.data.watchHistory)) this.data.watchHistory = [];
    if (!Array.isArray(this.data.reports)) this.data.reports = [];
    if (!Array.isArray(this.data.otpCodes)) this.data.otpCodes = [];
    if (!Array.isArray(this.data.mediaAssets)) this.data.mediaAssets = [];
    if (!Array.isArray(this.data.expiredStoriesArchive)) this.data.expiredStoriesArchive = [];
    if (!Array.isArray(this.data.migrationsApplied)) this.data.migrationsApplied = [];
    if (!this.data.postComments || typeof this.data.postComments !== 'object') {
      this.data.postComments = {};
    }
    if (!this.data.youtubeOAuth || typeof this.data.youtubeOAuth !== 'object') {
      this.data.youtubeOAuth = {};
    }
  }

  /**
   * Non-destructive forward-only schema migrations.
   * Always creates a pre-migration backup before modifying existing production schemas.
   */
  public runNonDestructiveMigrations(): {
    previousVersion: number;
    currentVersion: number;
    applied: MigrationRecord[];
  } {
    const startVersion = Number(this.data.schemaVersion || 0);
    if (startVersion >= CURRENT_SCHEMA_VERSION) {
      return { previousVersion: startVersion, currentVersion: startVersion, applied: [] };
    }

    let preMigrationBackupFile: string | undefined;
    if (this.loadedFrom !== 'fresh_seed' && this.data.users.length > 0) {
      const backup = createDatabaseBackup(
        this.data,
        `pre_migration_v${startVersion}_to_v${CURRENT_SCHEMA_VERSION}`,
        this.paths
      );
      preMigrationBackupFile = backup.filename;
    }

    const newlyApplied: MigrationRecord[] = [];
    const nowIso = new Date().toISOString();

    // v0 -> v1: Structural collections + safe user defaults without overwriting existing user data
    if (Number(this.data.schemaVersion || 0) < 1) {
      this.normalizeCollections();
      for (const u of this.data.users) {
        if (!u.privacy) {
          u.privacy = {
            profileVisibility: 'public',
            showOnlineStatus: true,
            allowDirectMessages: 'everyone',
            showContactInfo: true,
          };
        }
        if (!u.authProvider) u.authProvider = 'password';
        if (!u.passwordIterations) u.passwordIterations = LEGACY_PBKDF2_ITERATIONS;
      }
      this.data.schemaVersion = 1;
      const rec: MigrationRecord = {
        version: 1,
        name: 'v1_collections_and_user_defaults',
        appliedAt: nowIso,
        backupFile: preMigrationBackupFile,
      };
      this.data.migrationsApplied!.push(rec);
      newlyApplied.push(rec);
    }

    // v1 -> v2: Session IDs, device metadata, and HMAC tokenHash backfill (preserves existing tokens)
    if (Number(this.data.schemaVersion || 0) < 2) {
      for (const s of this.data.sessions) {
        if (!s.id) {
          s.id = `sess_${crypto.randomBytes(8).toString('hex')}`;
        }
        if (!s.tokenHash && s.token) {
          s.tokenHash = hashSessionToken(s.token);
          delete s.token;
        }
        if (!s.expiresAt) {
          s.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
        }
        if (!s.deviceName) {
          s.deviceName = parseDeviceName(s.userAgent);
        }
        if (!s.lastUsedAt) {
          s.lastUsedAt = s.createdAt || nowIso;
        }
        if (!s.authMethod) {
          s.authMethod = 'legacy';
        }
      }
      this.data.schemaVersion = 2;
      const rec: MigrationRecord = {
        version: 2,
        name: 'v2_persistent_multi_device_sessions',
        appliedAt: nowIso,
        backupFile: preMigrationBackupFile,
      };
      this.data.migrationsApplied!.push(rec);
      newlyApplied.push(rec);
    }

    // v2 -> v3: Media asset metadata & ownership backfill preserving all existing /uploads URLs
    if (Number(this.data.schemaVersion || 0) < 3) {
      this.backfillExistingMediaAssets();
      this.data.schemaVersion = 3;
      const rec: MigrationRecord = {
        version: 3,
        name: 'v3_media_asset_metadata_registry',
        appliedAt: nowIso,
        backupFile: preMigrationBackupFile,
      };
      this.data.migrationsApplied!.push(rec);
      newlyApplied.push(rec);
    }

    this.save();
    return {
      previousVersion: startVersion,
      currentVersion: Number(this.data.schemaVersion || CURRENT_SCHEMA_VERSION),
      applied: newlyApplied,
    };
  }

  private backfillExistingMediaAssets(): void {
    if (!Array.isArray(this.data.mediaAssets)) this.data.mediaAssets = [];
    const existingByUrl = new Set(this.data.mediaAssets.map((m) => m.url));
    const urlOwnerMap = new Map<string, { ownerId: string; createdAt: string }>();

    for (const p of this.data.posts) {
      const ownerId = p.author?.id || 'system';
      if (p.mediaUrl && p.mediaUrl.startsWith('/uploads/')) {
        urlOwnerMap.set(p.mediaUrl, { ownerId, createdAt: p.createdAt });
      }
      for (const img of p.images || []) {
        if (img && img.startsWith('/uploads/')) {
          urlOwnerMap.set(img, { ownerId, createdAt: p.createdAt });
        }
      }
    }
    for (const s of this.data.stories) {
      if (s.mediaUrl && s.mediaUrl.startsWith('/uploads/')) {
        urlOwnerMap.set(s.mediaUrl, { ownerId: s.userId, createdAt: s.createdAt });
      }
    }
    for (const u of this.data.users) {
      if (u.avatar && u.avatar.startsWith('/uploads/')) {
        urlOwnerMap.set(u.avatar, { ownerId: u.id, createdAt: u.createdAt });
      }
      if (u.coverImage && u.coverImage.startsWith('/uploads/')) {
        urlOwnerMap.set(u.coverImage, { ownerId: u.id, createdAt: u.createdAt });
      }
    }

    if (fs.existsSync(this.paths.uploadsDir)) {
      const files = fs.readdirSync(this.paths.uploadsDir).filter((f) => !f.endsWith('.tmp'));
      for (const filename of files) {
        const url = `/uploads/${filename}`;
        if (existingByUrl.has(url)) continue;
        const fullPath = path.join(this.paths.uploadsDir, filename);
        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isFile()) continue;
          const buf = fs.readFileSync(fullPath);
          const ownerInfo = urlOwnerMap.get(url);
          const nowIso = ownerInfo?.createdAt || stat.birthtime.toISOString() || new Date().toISOString();
          this.data.mediaAssets.push({
            id: `media_${crypto.randomBytes(6).toString('hex')}`,
            ownerId: ownerInfo?.ownerId || (this.data.users[0]?.id || 'system'),
            originalFilename: filename,
            storedFilename: filename,
            url,
            mimeType: inferMimeFromFilename(filename),
            sizeBytes: stat.size,
            sha256: computeSha256(buf),
            storageProvider: 'local_persistent',
            createdAt: nowIso,
            updatedAt: nowIso,
          });
          existingByUrl.add(url);
        } catch {
          // Ignore unreadable transient file
        }
      }
    }
  }

  private load() {
    const result = loadDatabaseSafely<DatabaseSchema>(this.paths, getInitialDbData);
    this.data = result.data;
    this.loadedFrom = result.loadedFrom;
    this.recoveredBackupName = result.recoveredBackup;
    this.normalizeCollections();
    this.runNonDestructiveMigrations();

    // Ensure at least one verified backup exists on startup without overwriting data
    const existingBackups = listDatabaseBackups(this.paths);
    const newestBackupAgeMs =
      existingBackups.length > 0 ? Date.now() - new Date(existingBackups[0].createdAt).getTime() : Infinity;
    if (existingBackups.length === 0 || newestBackupAgeMs > 60 * 60 * 1000) {
      this.createBackup('startup');
    }

    this.isLoaded = true;
  }

  public reloadFromDisk(): void {
    this.load();
  }

  public save() {
    try {
      this.lastSaveSha256 = atomicWriteJsonSync(this.paths.dbPath, this.data, true);
      this.saveCount += 1;
    } catch (err) {
      console.error('CRITICAL: Failed atomic save of motherland_db.json:', err);
    }
  }

  public createBackup(reason = 'manual'): BackupMetadata {
    this.data.lastBackupAt = new Date().toISOString();
    this.save();
    return createDatabaseBackup(this.data, reason, this.paths);
  }

  public listBackups(): BackupMetadata[] {
    return listDatabaseBackups(this.paths);
  }

  public verifyBackup(filename: string) {
    const safeName = path.basename(filename);
    const full = path.join(this.paths.backupsDir, safeName);
    return verifyBackupFile(full);
  }

  public getPersistenceHealth() {
    const backups = this.listBackups();
    return {
      environment: this.paths.env,
      schemaVersion: Number(this.data.schemaVersion || 0),
      targetSchemaVersion: CURRENT_SCHEMA_VERSION,
      loadedFrom: this.loadedFrom,
      recoveredBackup: this.recoveredBackupName,
      migrationsApplied: this.data.migrationsApplied || [],
      lastSaveSha256: this.lastSaveSha256,
      lastBackupAt: this.data.lastBackupAt || backups[0]?.createdAt || null,
      backupCount: backups.length,
      verifiedBackupCount: backups.filter((b) => b.verified).length,
      counts: {
        users: this.data.users.length,
        activeSessions: this.data.sessions.filter((s) => new Date(s.expiresAt).getTime() > Date.now()).length,
        posts: this.data.posts.length,
        activeStories: this.getActiveStories().length,
        archivedExpiredStories: (this.data.expiredStoriesArchive || []).length,
        mediaAssets: (this.data.mediaAssets || []).length,
        shortVideos: this.data.shortVideos.length,
        longVideos: this.data.longVideos.length,
        conversations: this.data.conversations.length,
        friendships: this.data.friendships.length,
        notifications: this.data.notifications.length,
      },
    };
  }

  // User Management
  public findUserById(id: string): UserAccount | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByEmailOrUsername(identifier: string): UserAccount | undefined {
    const term = identifier.trim().toLowerCase();
    return this.data.users.find(
      (u) =>
        u.email.toLowerCase() === term ||
        u.username.toLowerCase() === term ||
        (u.phoneNumber && u.phoneNumber.trim() === identifier.trim())
    );
  }

  public getAllUsers(): UserAccount[] {
    return this.data.users;
  }

  public createUser(account: UserAccount): UserAccount {
    this.data.users.push(account);
    this.save();
    return account;
  }

  public updateUser(id: string, updates: Partial<UserAccount>): UserAccount | undefined {
    const user = this.findUserById(id);
    if (!user) return undefined;
    Object.assign(user, updates, { updatedAt: new Date().toISOString() });
    this.save();
    return user;
  }

  // Convert UserAccount to public UserProfile (strictly strips private PII for other users)
  public toPublicProfile(
    user: UserAccount,
    requestingUserId?: string,
    onlineUserIds?: Set<string>
  ): UserProfile {
    const friendsCount = this.getFriendIds(user.id).length;
    const followersCount = this.data.follows.filter((f) => f.followingId === user.id).length;
    const followingCount = this.data.follows.filter((f) => f.followerId === user.id).length;
    const isSelf = requestingUserId === user.id;
    const rel = requestingUserId
      ? this.getRelationshipStatus(requestingUserId, user.id)
      : { status: 'none' as RelationshipStatus, requestId: undefined };

    const showOnline =
      onlineUserIds !== undefined &&
      (isSelf || (user.privacy?.showOnlineStatus !== false && !this.isBlocked(requestingUserId || '', user.id)));

    const showLastSeen =
      isSelf ||
      (user.privacy?.showOnlineStatus !== false &&
        user.privacy?.showLastSeen !== false &&
        !this.isBlocked(requestingUserId || '', user.id));

    const defaultNotifPrefs: NotificationPreferences = {
      messages: true,
      calls: true,
      friends: true,
      posts: true,
      videos: true,
      groups: true,
    };

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      coverImage: user.coverImage,
      bio: user.bio,
      website: user.website,
      location: user.location,
      work: user.work,
      education: user.education,
      joinedDate: user.joinedDate,
      isVerified: user.isVerified || user.role === 'owner',
      friendsCount,
      followersCount,
      followingCount,
      privacy: {
        showLastSeen: true,
        showReadReceipts: true,
        allowCalls: 'everyone',
        ...user.privacy,
      },
      notificationPrefs: isSelf ? { ...defaultNotifPrefs, ...(user.notificationPrefs || {}) } : undefined,
      dataSaver: isSelf ? Boolean(user.dataSaver) : undefined,
      lastActiveAt: showLastSeen ? user.lastActiveAt || user.updatedAt : undefined,
      socialLinks: user.socialLinks,
      role: user.role,
      isPrivate: user.isPrivate,
      gender: isSelf || user.privacy?.showContactInfo ? user.gender : undefined,
      address: isSelf ? user.address : undefined,
      phoneNumber: isSelf ? user.phoneNumber : undefined,
      email: isSelf ? user.email : undefined,
      dateOfBirth: isSelf ? user.dateOfBirth : undefined,
      twoFactorEnabled: isSelf ? user.twoFactorEnabled : undefined,
      relationshipStatus: rel.status,
      pendingRequestId: rel.requestId,
      mutualFriendsCount: requestingUserId && !isSelf ? this.getMutualFriendCount(requestingUserId, user.id) : undefined,
      isOnline: showOnline ? onlineUserIds!.has(user.id) : false,
    };
  }

  public touchUserLastActive(userId: string): void {
    const user = this.findUserById(userId);
    if (!user) return;
    const nowMs = Date.now();
    const prevMs = user.lastActiveAt ? Date.parse(user.lastActiveAt) : 0;
    user.lastActiveAt = new Date(nowMs).toISOString();
    // Persist active timestamps at most once every 2 minutes per user to prevent disk thrashing
    if (!prevMs || nowMs - prevMs > 2 * 60 * 1000) {
      this.save();
    }
  }

  public deleteUserAccount(userId: string): { ok: boolean; error?: string } {
    const userIdx = this.data.users.findIndex((u) => u.id === userId);
    if (userIdx === -1) {
      return { ok: false, error: 'Account not found.' };
    }

    // Create a safety backup prior to explicit owner-initiated deletion
    this.createBackup('pre_account_delete');

    this.data.users.splice(userIdx, 1);
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.data.stories = this.data.stories.filter((s) => s.userId !== userId);
    this.data.posts = this.data.posts.filter((p) => p.author?.id !== userId);
    this.data.reactions = this.data.reactions.filter((r) => r.userId !== userId);
    this.data.savedPosts = this.data.savedPosts.filter((s) => s.userId !== userId);
    this.data.savedVideos = (this.data.savedVideos || []).filter((v) => v.userId !== userId);
    this.data.watchHistory = (this.data.watchHistory || []).filter((h) => h.userId !== userId);
    this.data.drafts = (this.data.drafts || []).filter((d) => d.userId !== userId);
    this.data.friendships = this.data.friendships.filter((f) => f.user1Id !== userId && f.user2Id !== userId);
    this.data.friendRequests = this.data.friendRequests.filter(
      (r) => r.sender.id !== userId && r.receiverId !== userId
    );
    this.data.follows = this.data.follows.filter((f) => f.followerId !== userId && f.followingId !== userId);
    this.data.blocks = this.data.blocks.filter((b) => b.userId !== userId && b.blockedUserId !== userId);
    this.data.notifications = this.data.notifications.filter((n) => n.recipientId !== userId);
    if (this.data.youtubeOAuth && this.data.youtubeOAuth[userId]) {
      delete this.data.youtubeOAuth[userId];
    }
    this.save();
    return { ok: true };
  }

  // Persistent Multi-Device Sessions (HMAC-SHA256 Token Hashes + Sliding 30-day Persistence)
  public createSession(
    userId: string,
    userAgent?: string,
    meta?: { ipAddress?: string; authMethod?: Session['authMethod'] }
  ): Session & { token: string } {
    const rawToken = `ml_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = hashSessionToken(rawToken);
    const nowIso = new Date().toISOString();
    const session: Session = {
      id: `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      tokenHash,
      userId,
      deviceName: parseDeviceName(userAgent),
      ipAddress: meta?.ipAddress,
      authMethod: meta?.authMethod || 'password',
      createdAt: nowIso,
      lastUsedAt: nowIso,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days sliding
      userAgent,
    };

    // Prune only genuinely expired sessions; keep up to 20 active device sessions per user
    const nowMs = Date.now();
    this.data.sessions = this.data.sessions.filter((s) => Date.parse(s.expiresAt) > nowMs);
    const userSessions = this.data.sessions.filter((s) => s.userId === userId);
    if (userSessions.length >= 20) {
      const oldest = userSessions.sort((a, b) => Date.parse(a.lastUsedAt || a.createdAt) - Date.parse(b.lastUsedAt || b.createdAt))[0];
      if (oldest) {
        this.data.sessions = this.data.sessions.filter((s) => s !== oldest);
      }
    }

    this.data.sessions.push(session);
    this.save();
    return { ...session, token: rawToken };
  }

  public findSessionByToken(rawToken: string): Session | undefined {
    if (!rawToken) return undefined;
    const nowMs = Date.now();
    const targetHash = hashSessionToken(rawToken);

    const found = this.data.sessions.find((s) => {
      if (Date.parse(s.expiresAt) <= nowMs) return false;
      if (s.tokenHash && s.tokenHash === targetHash) return true;
      if (s.token && s.token === rawToken) return true;
      return false;
    });

    if (!found) return undefined;

    let dirty = false;
    // Upgrade legacy plaintext session record cleanly to HMAC hash
    if (!found.tokenHash && found.token) {
      found.tokenHash = targetHash;
      delete found.token;
      dirty = true;
    }
    if (!found.id) {
      found.id = `sess_${crypto.randomBytes(8).toString('hex')}`;
      dirty = true;
    }

    const lastUsedMs = found.lastUsedAt ? Date.parse(found.lastUsedAt) : 0;
    if (!lastUsedMs || nowMs - lastUsedMs > 5 * 60 * 1000) {
      found.lastUsedAt = new Date(nowMs).toISOString();
      dirty = true;
    }

    // Sliding window renewal: if less than 20 days remain, automatically extend to 30 days
    const expMs = Date.parse(found.expiresAt);
    if (expMs - nowMs < 1000 * 60 * 60 * 24 * 20) {
      found.expiresAt = new Date(nowMs + 1000 * 60 * 60 * 24 * 30).toISOString();
      dirty = true;
    }

    if (dirty) {
      this.save();
    }
    return found;
  }

  public getUserSessions(userId: string, currentRawToken?: string): DeviceSessionInfo[] {
    const nowMs = Date.now();
    const currentHash = currentRawToken ? hashSessionToken(currentRawToken) : '';
    return this.data.sessions
      .filter((s) => s.userId === userId && Date.parse(s.expiresAt) > nowMs)
      .sort((a, b) => Date.parse(b.lastUsedAt || b.createdAt) - Date.parse(a.lastUsedAt || a.createdAt))
      .map((s) => {
        const isCurrent = Boolean(
          currentRawToken &&
            ((s.tokenHash && s.tokenHash === currentHash) || (s.token && s.token === currentRawToken))
        );
        return {
          id: s.id || `sess_${(s.tokenHash || s.token || '').slice(0, 8)}`,
          deviceName: s.deviceName || parseDeviceName(s.userAgent),
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          authMethod: s.authMethod || 'legacy',
          createdAt: s.createdAt,
          lastUsedAt: s.lastUsedAt || s.createdAt,
          expiresAt: s.expiresAt,
          isCurrent,
        };
      });
  }

  public revokeSessionById(
    userId: string,
    sessionId: string
  ): { ok: boolean; statusCode: number; error?: string } {
    const idx = this.data.sessions.findIndex((s) => s.id === sessionId);
    if (idx === -1) {
      return { ok: false, statusCode: 404, error: 'Session not found.' };
    }
    if (this.data.sessions[idx].userId !== userId) {
      return { ok: false, statusCode: 403, error: 'Forbidden: you cannot revoke another user session.' };
    }
    this.data.sessions.splice(idx, 1);
    this.save();
    return { ok: true, statusCode: 200 };
  }

  public deleteSession(rawToken: string): boolean {
    if (!rawToken) return false;
    const targetHash = hashSessionToken(rawToken);
    const idx = this.data.sessions.findIndex(
      (s) => (s.tokenHash && s.tokenHash === targetHash) || (s.token && s.token === rawToken)
    );
    if (idx !== -1) {
      this.data.sessions.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  public deleteUserSessionsExcept(userId: string, currentRawToken?: string): number {
    const currentHash = currentRawToken ? hashSessionToken(currentRawToken) : '';
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((s) => {
      if (s.userId !== userId) return true;
      if (!currentRawToken) return false;
      return (s.tokenHash && s.tokenHash === currentHash) || (s.token && s.token === currentRawToken);
    });
    const removed = before - this.data.sessions.length;
    if (removed > 0) this.save();
    return removed;
  }

  public deleteUserSessions(userId: string): void {
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.save();
  }

  // Reactions — 1 reaction per user per post strictly
  public getPostReactions(postId: string): ReactionRecord[] {
    return this.data.reactions.filter((r) => r.postId === postId);
  }

  public getUserReaction(postId: string, userId: string): ReactionRecord | undefined {
    return this.data.reactions.find((r) => r.postId === postId && r.userId === userId);
  }

  public toggleReaction(postId: string, userId: string, reactionType: ReactionType): { isLiked: boolean; reaction?: ReactionType; likesCount: number } {
    const existingIdx = this.data.reactions.findIndex((r) => r.postId === postId && r.userId === userId);

    if (existingIdx !== -1) {
      const existing = this.data.reactions[existingIdx];
      if (existing.type === reactionType) {
        // Toggle OFF (un-react)
        this.data.reactions.splice(existingIdx, 1);
        this.save();
        return {
          isLiked: false,
          likesCount: this.getPostReactions(postId).length,
        };
      } else {
        // Change reaction type (e.g. from haha to love)
        this.data.reactions[existingIdx].type = reactionType;
        this.data.reactions[existingIdx].createdAt = new Date().toISOString();
        this.save();
        return {
          isLiked: true,
          reaction: reactionType,
          likesCount: this.getPostReactions(postId).length,
        };
      }
    } else {
      // New reaction
      this.data.reactions.push({
        postId,
        userId,
        type: reactionType,
        createdAt: new Date().toISOString(),
      });
      this.save();
      return {
        isLiked: true,
        reaction: reactionType,
        likesCount: this.getPostReactions(postId).length,
      };
    }
  }

  // Saved Posts
  public isPostSaved(postId: string, userId: string): boolean {
    return this.data.savedPosts.some((s) => s.postId === postId && s.userId === userId);
  }

  public toggleSavePost(postId: string, userId: string): boolean {
    const idx = this.data.savedPosts.findIndex((s) => s.postId === postId && s.userId === userId);
    if (idx !== -1) {
      this.data.savedPosts.splice(idx, 1);
      this.save();
      return false;
    } else {
      this.data.savedPosts.push({
        postId,
        userId,
        createdAt: new Date().toISOString(),
      });
      this.save();
      return true;
    }
  }

  public getUserSavedPostIds(userId: string): string[] {
    return this.data.savedPosts.filter((s) => s.userId === userId).map((s) => s.postId);
  }

  // Hydrate Post with User Interactions
  public hydratePostForUser(post: Post, userId?: string): Post {
    const reactions = this.getPostReactions(post.id);
    const userReaction = userId ? this.getUserReaction(post.id, userId) : undefined;
    const isSaved = userId ? this.isPostSaved(post.id, userId) : false;

    return {
      ...post,
      stats: {
        ...post.stats,
        likes: reactions.length > 0 ? reactions.length : post.stats?.likes || 0,
      },
      userInteractions: {
        isLiked: Boolean(userReaction),
        reaction: userReaction?.type,
        isSaved,
      },
    };
  }

  // Visibility & Access Control
  public canViewerSeePost(viewerId: string | undefined, post: Post): boolean {
    const authorId = post.author?.id;
    if (!authorId) return post.audience === 'public';
    if (viewerId && viewerId === authorId) return true;
    if (viewerId && this.isBlocked(viewerId, authorId)) return false;

    const authorAcc = this.findUserById(authorId);
    if (post.audience === 'only_me') return false;
    if (post.audience === 'friends') {
      return Boolean(viewerId && this.isFriend(viewerId, authorId));
    }
    if (authorAcc) {
      if (authorAcc.privacy?.profileVisibility === 'private') return false;
      if (authorAcc.privacy?.profileVisibility === 'friends' || authorAcc.isPrivate) {
        return Boolean(viewerId && this.isFriend(viewerId, authorId));
      }
    }
    return true;
  }

  public getScoredForYouPosts(viewerId?: string): Post[] {
    const eligible = this.data.posts.filter((p) => {
      if (!this.canViewerSeePost(viewerId, p)) return false;
      return true;
    });

    const viewerFriendIds = viewerId ? new Set(this.getFriendIds(viewerId)) : new Set<string>();
    const viewerFollowIds = viewerId
      ? new Set(this.data.follows.filter((f) => f.followerId === viewerId).map((f) => f.followingId))
      : new Set<string>();

    // Collect viewer interest hashtags from reactions and saved posts
    const interestTags = new Map<string, number>();
    if (viewerId) {
      const interactedIds = new Set([
        ...this.data.reactions.filter((r) => r.userId === viewerId).map((r) => r.postId),
        ...this.data.savedPosts.filter((s) => s.userId === viewerId).map((s) => s.postId),
      ]);
      for (const p of this.data.posts) {
        if (interactedIds.has(p.id) && Array.isArray(p.hashtags)) {
          for (const tag of p.hashtags) {
            const norm = tag.toLowerCase();
            interestTags.set(norm, (interestTags.get(norm) || 0) + 1);
          }
        }
      }
    }

    const now = Date.now();
    const scored = eligible.map((post) => {
      let score = 0;
      const authorId = post.author?.id || '';
      if (viewerFriendIds.has(authorId)) score += 18;
      if (viewerFollowIds.has(authorId)) score += 12;
      if (viewerId && authorId === viewerId) score += 6;

      // Topic / hashtag affinity
      for (const tag of post.hashtags || []) {
        const w = interestTags.get(tag.toLowerCase()) || 0;
        if (w > 0) score += Math.min(15, w * 4);
      }

      // Rich media diversity bonus (videos & photos get engaging discovery weight without hiding text posts)
      if (post.mediaType === 'video') score += 5;
      else if (post.mediaType === 'image') score += 4;
      else score += 2;

      // Real engagement signals (log scale so smaller accounts still get discovered!)
      const reactionCount = this.getPostReactions(post.id).length || post.stats?.likes || 0;
      const commentCount = (this.data.postComments[post.id]?.length ?? post.stats?.comments) || 0;
      const shareCount = post.stats?.shares || 0;
      const engagement = reactionCount * 1.5 + commentCount * 2.5 + shareCount * 2;
      score += Math.log10(engagement + 1) * 9;

      // Recency decay (fresh content gets strong exposure)
      const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / (1000 * 60 * 60));
      score += 24 / (1 + ageHours / 18);

      return { post, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Creator diversity pass: interleave so one prolific creator doesn't monopolize consecutive slots
    const remaining = [...scored];
    const diversified: Post[] = [];
    const seenRecentAuthors: string[] = [];

    while (remaining.length > 0) {
      let pickIdx = remaining.findIndex((item) => !seenRecentAuthors.includes(item.post.author?.id || ''));
      if (pickIdx === -1) pickIdx = 0;
      const [picked] = remaining.splice(pickIdx, 1);
      diversified.push(picked.post);
      const aId = picked.post.author?.id || '';
      seenRecentAuthors.push(aId);
      if (seenRecentAuthors.length > 2) seenRecentAuthors.shift();
    }

    return diversified;
  }

  // Posts
  public getAllPosts(): Post[] {
    return this.data.posts;
  }

  public addPost(post: Post): Post {
    this.data.posts.unshift(post);
    this.save();
    return post;
  }

  public deletePost(postId: string): boolean {
    const idx = this.data.posts.findIndex((p) => p.id === postId);
    if (idx !== -1) {
      this.data.posts.splice(idx, 1);
      // Clean up reactions, saved posts, and comments
      this.data.reactions = this.data.reactions.filter((r) => r.postId !== postId);
      this.data.savedPosts = this.data.savedPosts.filter((s) => s.postId !== postId);
      delete this.data.postComments[postId];
      this.save();
      return true;
    }
    return false;
  }

  // Comments
  public getComments(postId: string): any[] {
    return this.data.postComments[postId] || [];
  }

  public addComment(postId: string, comment: any): any {
    if (!this.data.postComments[postId]) {
      this.data.postComments[postId] = [];
    }
    this.data.postComments[postId].push(comment);
    const post = this.data.posts.find((p) => p.id === postId);
    if (post) {
      post.stats.comments = this.data.postComments[postId].length;
    }
    this.save();
    return comment;
  }

  // Stories (Strict 24-Hour UTC Expiration — never triggered by midnight or affecting posts/accounts)
  public getActiveStories(nowMs = Date.now()): Story[] {
    return this.data.stories.filter((s) => {
      const expMs = Date.parse(s.expiresAt);
      return Number.isFinite(expMs) && expMs > nowMs;
    });
  }

  public addStory(story: Story): Story {
    // Enforce server UTC timestamps strictly: expiresAt = createdAt + 24h UTC
    const createdMs = Number.isFinite(Date.parse(story.createdAt)) ? Date.parse(story.createdAt) : Date.now();
    const canonicalCreatedIso = new Date(createdMs).toISOString();
    const canonicalExpiresIso = new Date(createdMs + 24 * 60 * 60 * 1000).toISOString();
    const normalized: Story = {
      ...story,
      createdAt: canonicalCreatedIso,
      expiresAt: canonicalExpiresIso,
    };
    this.data.stories.unshift(normalized);
    this.save();
    return normalized;
  }

  public deleteStory(storyId: string): boolean {
    const idx = this.data.stories.findIndex((s) => s.id === storyId);
    if (idx !== -1) {
      this.data.stories.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Idempotent UTC story expiration processor.
   * ONLY removes/archives stories where UTC expiresAt <= nowMs.
   * NEVER deletes user accounts, posts, videos, comments, or profiles.
   */
  public expireStoriesOlderThan24hUtc(nowMs = Date.now()): {
    expiredCount: number;
    activeCount: number;
    checkedAtUtc: string;
  } {
    const checkedAtUtc = new Date(nowMs).toISOString();
    if (!Array.isArray(this.data.expiredStoriesArchive)) {
      this.data.expiredStoriesArchive = [];
    }

    const active: Story[] = [];
    let expiredCount = 0;

    for (const story of this.data.stories) {
      const expMs = Date.parse(story.expiresAt);
      if (Number.isFinite(expMs) && expMs <= nowMs) {
        expiredCount += 1;
        this.data.expiredStoriesArchive.unshift({
          id: story.id,
          userId: story.userId,
          mediaUrl: story.mediaUrl,
          createdAt: story.createdAt,
          expiresAt: story.expiresAt,
          expiredAtUtc: checkedAtUtc,
        });
      } else {
        active.push(story);
      }
    }

    if (expiredCount > 0) {
      this.data.stories = active;
      this.data.expiredStoriesArchive = this.data.expiredStoriesArchive.slice(0, 500);
      this.save();
    }

    return {
      expiredCount,
      activeCount: active.length,
      checkedAtUtc,
    };
  }

  // Persistent Media Asset Registry & Ownership Control
  public registerMediaAsset(asset: MediaAssetRecord): MediaAssetRecord {
    if (!Array.isArray(this.data.mediaAssets)) this.data.mediaAssets = [];
    const existingIdx = this.data.mediaAssets.findIndex(
      (m) => m.storedFilename === asset.storedFilename || m.id === asset.id
    );
    if (existingIdx !== -1) {
      this.data.mediaAssets[existingIdx] = { ...this.data.mediaAssets[existingIdx], ...asset };
    } else {
      this.data.mediaAssets.unshift(asset);
    }
    this.save();
    return asset;
  }

  public getMediaAsset(idOrFilename: string): MediaAssetRecord | undefined {
    const clean = path.basename(idOrFilename);
    return (this.data.mediaAssets || []).find(
      (m) => m.id === idOrFilename || m.storedFilename === clean || m.url === idOrFilename
    );
  }

  public getUserMediaAssets(userId: string): MediaAssetRecord[] {
    return (this.data.mediaAssets || []).filter((m) => m.ownerId === userId);
  }

  public deleteOwnedMediaAsset(
    idOrFilename: string,
    actorUserId: string,
    actorRole?: UserAccount['role']
  ): { ok: boolean; statusCode: number; error?: string; asset?: MediaAssetRecord } {
    if (!Array.isArray(this.data.mediaAssets)) this.data.mediaAssets = [];
    const clean = path.basename(idOrFilename);
    const idx = this.data.mediaAssets.findIndex((m) => m.id === idOrFilename || m.storedFilename === clean);
    if (idx === -1) {
      return { ok: false, statusCode: 404, error: 'Media asset not found.' };
    }
    const asset = this.data.mediaAssets[idx];
    if (asset.ownerId !== actorUserId && actorRole !== 'owner') {
      return { ok: false, statusCode: 403, error: 'Forbidden: you can only delete your own media.' };
    }
    this.data.mediaAssets.splice(idx, 1);
    this.save();
    return { ok: true, statusCode: 200, asset };
  }

  // Shorts & Long Videos
  public getShortVideos(): ShortVideo[] {
    return this.data.shortVideos;
  }

  public addShortVideo(short: ShortVideo): ShortVideo {
    this.data.shortVideos.unshift(short);
    this.save();
    return short;
  }

  public getLongVideos(): LongVideo[] {
    return this.data.longVideos;
  }

  public addLongVideo(video: LongVideo): LongVideo {
    this.data.longVideos.unshift(video);
    this.save();
    return video;
  }

  // Friendships & Social Graph
  public getFriendIds(userId: string): string[] {
    const friends = new Set<string>();
    for (const f of this.data.friendships) {
      if (f.user1Id === userId) friends.add(f.user2Id);
      if (f.user2Id === userId) friends.add(f.user1Id);
    }
    return Array.from(friends);
  }

  public isFriend(userA: string, userB: string): boolean {
    return this.data.friendships.some(
      (f) => (f.user1Id === userA && f.user2Id === userB) || (f.user1Id === userB && f.user2Id === userA)
    );
  }

  public addFriendship(userA: string, userB: string): void {
    if (!this.isFriend(userA, userB)) {
      this.data.friendships.push({
        user1Id: userA,
        user2Id: userB,
        createdAt: new Date().toISOString(),
      });
      // Mutual follow
      this.follow(userA, userB);
      this.follow(userB, userA);
      this.save();
    }
  }

  public removeFriendship(userA: string, userB: string): void {
    this.data.friendships = this.data.friendships.filter(
      (f) => !( (f.user1Id === userA && f.user2Id === userB) || (f.user1Id === userB && f.user2Id === userA) )
    );
    this.save();
  }

  public getMutualFriendCount(userA: string, userB: string): number {
    if (!userA || !userB || userA === userB) return 0;
    const setA = new Set(this.getFriendIds(userA));
    const listB = this.getFriendIds(userB);
    let count = 0;
    for (const id of listB) {
      if (setA.has(id)) count++;
    }
    return count;
  }

  public getRelationshipStatus(
    viewerId: string,
    targetId: string
  ): { status: RelationshipStatus; requestId?: string } {
    if (!viewerId || !targetId) return { status: 'none' };
    if (viewerId === targetId) return { status: 'self' };
    if (this.isBlocked(viewerId, targetId)) return { status: 'blocked' };
    if (this.isFriend(viewerId, targetId)) return { status: 'friend' };

    const sent = this.data.friendRequests.find(
      (r) => r.sender.id === viewerId && r.receiverId === targetId && r.status === 'pending'
    );
    if (sent) return { status: 'pending_sent', requestId: sent.id };

    const received = this.data.friendRequests.find(
      (r) => r.sender.id === targetId && r.receiverId === viewerId && r.status === 'pending'
    );
    if (received) return { status: 'pending_received', requestId: received.id };

    return { status: 'none' };
  }

  public getFriendRequests(userId: string): FriendRequest[] {
    return this.data.friendRequests
      .filter((r) => r.receiverId === userId && r.status === 'pending' && !this.isBlocked(userId, r.sender.id))
      .map((r) => {
        const senderAcc = this.findUserById(r.sender.id);
        return {
          ...r,
          sender: senderAcc ? this.toPublicProfile(senderAcc, userId) : r.sender,
        };
      });
  }

  public getSentFriendRequests(userId: string): FriendRequest[] {
    return this.data.friendRequests
      .filter((r) => r.sender.id === userId && r.status === 'pending' && !this.isBlocked(userId, r.receiverId))
      .map((r) => {
        const recipientAcc = this.findUserById(r.receiverId);
        return {
          ...r,
          recipient: recipientAcc ? this.toPublicProfile(recipientAcc, userId) : undefined,
        };
      });
  }

  public createFriendRequestSafe(
    senderId: string,
    receiverId: string
  ): { request?: FriendRequest; error?: string; autoAccepted?: boolean; alreadyPending?: boolean } {
    if (!senderId || !receiverId || senderId === receiverId) {
      return { error: 'Cannot send a friend request to yourself.' };
    }
    const senderAcc = this.findUserById(senderId);
    const receiverAcc = this.findUserById(receiverId);
    if (!senderAcc || !receiverAcc) {
      return { error: 'User account not found.' };
    }
    if (this.isBlocked(senderId, receiverId)) {
      return { error: 'Unable to send friend request due to block settings.' };
    }
    if (this.isFriend(senderId, receiverId)) {
      return { error: 'You are already friends with this user.' };
    }

    const existingSent = this.data.friendRequests.find(
      (r) => r.sender.id === senderId && r.receiverId === receiverId && r.status === 'pending'
    );
    if (existingSent) {
      return { request: existingSent, alreadyPending: true };
    }

    // Prevent contradictory reverse pending request: if receiver already sent sender a request, accept it cleanly
    const reversePending = this.data.friendRequests.find(
      (r) => r.sender.id === receiverId && r.receiverId === senderId && r.status === 'pending'
    );
    if (reversePending) {
      reversePending.status = 'accepted';
      this.addFriendship(senderId, receiverId);
      this.save();
      return { request: reversePending, autoAccepted: true };
    }

    const reqItem: FriendRequest = {
      id: `fr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: this.toPublicProfile(senderAcc),
      receiverId,
      recipient: this.toPublicProfile(receiverAcc),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.data.friendRequests.push(reqItem);
    this.save();
    return { request: reqItem };
  }

  public addFriendRequest(senderId: string, receiverId: string): FriendRequest | null {
    const res = this.createFriendRequestSafe(senderId, receiverId);
    return res.request || null;
  }

  public respondFriendRequest(
    requestId: string,
    action: 'accept' | 'reject' | 'cancel',
    actingUserId?: string
  ): { ok: boolean; error?: string; request?: FriendRequest } {
    const reqItem = this.data.friendRequests.find((r) => r.id === requestId);
    if (!reqItem) return { ok: false, error: 'Friend request not found.' };
    if (reqItem.status !== 'pending') {
      return { ok: false, error: 'This friend request has already been processed.' };
    }

    if (actingUserId) {
      if ((action === 'accept' || action === 'reject') && reqItem.receiverId !== actingUserId) {
        return { ok: false, error: 'Only the recipient can accept or decline this request.' };
      }
      if (action === 'cancel' && reqItem.sender.id !== actingUserId) {
        return { ok: false, error: 'Only the sender can cancel this request.' };
      }
    }

    if (action === 'accept') {
      reqItem.status = 'accepted';
      this.addFriendship(reqItem.sender.id, reqItem.receiverId);
      // Clean up any reverse pending request between these two accounts
      for (const r of this.data.friendRequests) {
        if (
          r.id !== reqItem.id &&
          r.status === 'pending' &&
          r.sender.id === reqItem.receiverId &&
          r.receiverId === reqItem.sender.id
        ) {
          r.status = 'accepted';
        }
      }
    } else if (action === 'reject') {
      reqItem.status = 'rejected';
    } else if (action === 'cancel') {
      reqItem.status = 'canceled';
    } else {
      return { ok: false, error: 'Invalid friend request action.' };
    }
    this.save();
    return { ok: true, request: reqItem };
  }

  // Follows
  public isFollowing(followerId: string, followingId: string): boolean {
    return this.data.follows.some((f) => f.followerId === followerId && f.followingId === followingId);
  }

  public follow(followerId: string, followingId: string): void {
    if (!this.isFollowing(followerId, followingId)) {
      this.data.follows.push({ followerId, followingId, createdAt: new Date().toISOString() });
      this.save();
    }
  }

  public unfollow(followerId: string, followingId: string): void {
    this.data.follows = this.data.follows.filter(
      (f) => !(f.followerId === followerId && f.followingId === followingId)
    );
    this.save();
  }

  // Blocks
  public isBlocked(userId: string, targetUserId: string): boolean {
    return this.data.blocks.some(
      (b) => (b.userId === userId && b.blockedUserId === targetUserId) ||
             (b.userId === targetUserId && b.blockedUserId === userId)
    );
  }

  public toggleBlock(userId: string, targetUserId: string): boolean {
    const idx = this.data.blocks.findIndex((b) => b.userId === userId && b.blockedUserId === targetUserId);
    if (idx !== -1) {
      this.data.blocks.splice(idx, 1);
      this.save();
      return false;
    } else {
      this.data.blocks.push({ userId, blockedUserId: targetUserId, createdAt: new Date().toISOString() });
      this.removeFriendship(userId, targetUserId);
      this.unfollow(userId, targetUserId);
      this.unfollow(targetUserId, userId);
      this.save();
      return true;
    }
  }

  public getBlockedUserIds(userId: string): string[] {
    return this.data.blocks.filter((b) => b.userId === userId).map((b) => b.blockedUserId);
  }

  // Dynamic Friend Suggestions Formula (Requirement 5)
  public getSuggestedFriends(userId: string): UserProfile[] {
    const friendIds = new Set(this.getFriendIds(userId));
    const blockedIds = new Set(this.getBlockedUserIds(userId));
    const pendingSent = new Set(
      this.data.friendRequests.filter((r) => r.sender.id === userId && r.status === 'pending').map((r) => r.receiverId)
    );

    // Filter candidate registered users
    const candidates = this.data.users.filter(
      (u) => u.id !== userId && !friendIds.has(u.id) && !blockedIds.has(u.id) && !pendingSent.has(u.id)
    );

    const totalEligible = candidates.length;

    // Strict Rule:
    // Fewer than 3 registered users: no suggestions (0)
    // 3 users: up to 2 suggestions
    // 10 users: 3-5 suggestions
    // 100 users: 10-12 suggestions
    let maxCount = 0;
    if (totalEligible < 3) {
      maxCount = 0;
    } else if (totalEligible === 3) {
      maxCount = 2;
    } else if (totalEligible < 10) {
      maxCount = Math.min(3, totalEligible - 1);
    } else if (totalEligible < 50) {
      maxCount = Math.min(5, Math.floor(totalEligible * 0.4));
    } else {
      maxCount = Math.min(12, Math.floor(totalEligible * 0.15));
    }

    return candidates.slice(0, maxCount).map((u) => this.toPublicProfile(u, userId));
  }

  // Notifications
  public getNotifications(userId: string, category?: string): NotificationItem[] {
    return this.data.notifications
      .filter((n) => n.recipientId === userId && (!category || category === 'all' || n.category === category))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addNotification(notif: NotificationItem & { recipientId: string; category?: string }): void {
    this.data.notifications.unshift(notif);
    this.save();
  }

  public markNotificationsRead(userId: string, notificationId?: string): void {
    for (const n of this.data.notifications) {
      if (n.recipientId === userId) {
        if (!notificationId || n.id === notificationId) {
          n.isRead = true;
        }
      }
    }
    this.save();
  }

  public deleteNotification(userId: string, notificationId: string): void {
    this.data.notifications = this.data.notifications.filter(
      (n) => !(n.recipientId === userId && n.id === notificationId)
    );
    this.save();
  }

  // OTP Verification Codes
  public setOtp(identifier: string, code: string, type: 'register' | 'phone_verify' | 'forgot_password'): void {
    // 10 minutes expiry
    this.data.otpCodes = this.data.otpCodes.filter((o) => o.identifier !== identifier);
    this.data.otpCodes.push({
      identifier,
      code,
      type,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    this.save();
  }

  public verifyOtp(identifier: string, code: string, type: 'register' | 'phone_verify' | 'forgot_password'): boolean {
    const found = this.data.otpCodes.find(
      (o) => o.identifier === identifier && o.code === code && o.type === type && o.expiresAt > Date.now()
    );
    if (found) {
      this.data.otpCodes = this.data.otpCodes.filter((o) => o !== found);
      this.save();
      return true;
    }
    return false;
  }

  // Post Share Counter
  public incrementPostShare(postId: string): number {
    const post = this.data.posts.find((p) => p.id === postId);
    if (!post) return 0;
    post.stats.shares = (post.stats.shares || 0) + 1;
    this.save();
    return post.stats.shares;
  }

  // Per-User YouTube OAuth Connection Storage (Strict Multi-User Isolation)
  public getYouTubeOAuth(userId: string): YouTubeOAuthRecord | undefined {
    if (!this.data.youtubeOAuth) this.data.youtubeOAuth = {};
    return this.data.youtubeOAuth[userId];
  }

  public setYouTubeOAuth(userId: string, record: YouTubeOAuthRecord): YouTubeOAuthRecord {
    if (!this.data.youtubeOAuth) this.data.youtubeOAuth = {};
    this.data.youtubeOAuth[userId] = record;
    this.save();
    return record;
  }

  public deleteYouTubeOAuth(userId: string): boolean {
    if (!this.data.youtubeOAuth) return false;
    if (this.data.youtubeOAuth[userId]) {
      delete this.data.youtubeOAuth[userId];
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // MOTHERLAND WAVE — PERSISTENT REAL-TIME MESSAGING & CALLS
  // ==========================================
  private getConversationParticipantIds(conv: Conversation): string[] {
    if (Array.isArray(conv.participantIds) && conv.participantIds.length > 0) {
      return conv.participantIds;
    }
    return (conv.participants || []).map((p) => p.id);
  }

  public isConversationParticipant(conv: Conversation, userId: string): boolean {
    return this.getConversationParticipantIds(conv).includes(userId);
  }

  public isConversationAdmin(conv: Conversation, userId: string): boolean {
    if (!conv.isGroup) return true;
    if (conv.creatorId === userId) return true;
    return Array.isArray(conv.adminIds) && conv.adminIds.includes(userId);
  }

  public getConversationById(conversationId: string): Conversation | undefined {
    return this.data.conversations.find((c) => c.id === conversationId);
  }

  private purgeExpiredMessagesForConversation(conversationId: string): boolean {
    const msgs = this.data.conversationMessages[conversationId];
    if (!Array.isArray(msgs) || msgs.length === 0) return false;
    const nowMs = Date.now();
    const filtered = msgs.filter((m) => !m.expiresAt || new Date(m.expiresAt).getTime() > nowMs);
    if (filtered.length !== msgs.length) {
      this.data.conversationMessages[conversationId] = filtered;
      const conv = this.getConversationById(conversationId);
      if (conv) {
        conv.lastMessage = filtered.length > 0 ? filtered[filtered.length - 1] : undefined;
      }
      return true;
    }
    return false;
  }

  private hydrateConversationForUser(
    conv: Conversation,
    userId: string,
    onlineUserIds?: Set<string>
  ): Conversation {
    this.purgeExpiredMessagesForConversation(conv.id);
    const pIds = this.getConversationParticipantIds(conv);
    const hydratedParticipants: UserProfile[] = pIds
      .map((id) => this.findUserById(id))
      .filter((u): u is UserAccount => Boolean(u))
      .map((u) => this.toPublicProfile(u, userId, onlineUserIds));

    const msgs = (this.data.conversationMessages[conv.id] || []).filter(
      (m) => !(Array.isArray(m.deletedForIds) && m.deletedForIds.includes(userId))
    );
    const lastReadIso = conv.lastReadAtByUser?.[userId] || '';
    const lastReadMs = lastReadIso ? new Date(lastReadIso).getTime() : 0;

    let unreadCount = 0;
    for (const m of msgs) {
      if (m.senderId !== userId && new Date(m.createdAt).getTime() > lastReadMs) {
        unreadCount++;
      }
    }

    const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;

    return {
      id: conv.id,
      isGroup: conv.isGroup,
      name: conv.name,
      photo: conv.photo,
      creatorId: conv.creatorId,
      adminIds: conv.adminIds || (conv.creatorId ? [conv.creatorId] : []),
      pinnedMessageIds: conv.pinnedMessageIds || [],
      disappearingSeconds: conv.disappearingSeconds || 0,
      isRequest: Boolean(conv.isRequest),
      requestStatus: conv.requestStatus,
      requestedBy: conv.requestedBy,
      isArchived: Boolean(conv.archivedBy?.includes(userId)),
      isMuted: Boolean(conv.mutedBy?.includes(userId)),
      isPinned: Boolean(conv.pinnedBy?.includes(userId)),
      participantIds: pIds,
      participants: hydratedParticipants,
      lastMessage,
      unreadCount,
      updatedAt: lastMessage?.createdAt || conv.updatedAt,
    };
  }

  public getUserConversations(userId: string, onlineUserIds?: Set<string>): Conversation[] {
    let dirty = false;
    const userConvs = this.data.conversations.filter((conv) => {
      if (!this.isConversationParticipant(conv, userId)) return false;
      const pIds = this.getConversationParticipantIds(conv);
      if (!conv.isGroup && pIds.length === 2) {
        const otherId = pIds.find((id) => id !== userId);
        if (otherId && this.isBlocked(userId, otherId)) return false;
      }
      if (conv.isRequest && conv.requestStatus === 'declined' && conv.requestedBy !== userId) {
        return false;
      }
      if (this.purgeExpiredMessagesForConversation(conv.id)) dirty = true;
      return true;
    });
    if (dirty) this.save();

    return userConvs
      .map((c) => this.hydrateConversationForUser(c, userId, onlineUserIds))
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }

  public getTotalUnreadMessages(userId: string): number {
    return this.getUserConversations(userId)
      .filter((c) => !c.isArchived && (!c.isRequest || c.requestStatus === 'accepted'))
      .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }

  public getOrCreateDirectConversation(
    userId: string,
    targetUserId: string,
    onlineUserIds?: Set<string>
  ): { conversation?: Conversation; error?: string; statusCode?: number } {
    if (!userId || !targetUserId || userId === targetUserId) {
      return { error: 'Cannot start a direct conversation with yourself.', statusCode: 400 };
    }
    const targetUser = this.findUserById(targetUserId);
    if (!targetUser) {
      return { error: 'Target user not found.', statusCode: 404 };
    }
    if (this.isBlocked(userId, targetUserId)) {
      return { error: 'Communication is unavailable due to block settings.', statusCode: 403 };
    }

    const existing = this.data.conversations.find((c) => {
      if (c.isGroup) return false;
      const pIds = this.getConversationParticipantIds(c);
      return pIds.length === 2 && pIds.includes(userId) && pIds.includes(targetUserId);
    });

    if (existing) {
      if (existing.isRequest && existing.requestStatus === 'declined') {
        return { error: 'This user declined your message request.', statusCode: 403 };
      }
      return { conversation: this.hydrateConversationForUser(existing, userId, onlineUserIds) };
    }

    const areFriends = this.isFriend(userId, targetUserId);
    const dmPolicy = targetUser.privacy?.allowDirectMessages || 'everyone';

    if (!areFriends) {
      if (dmPolicy === 'none') {
        return { error: `${targetUser.displayName} does not accept new direct messages.`, statusCode: 403 };
      }
      if (dmPolicy === 'friends') {
        return {
          error: `${targetUser.displayName} only accepts direct messages from accepted friends. Send a friend request first.`,
          statusCode: 403,
        };
      }
    }

    const now = new Date().toISOString();
    const sortedPair = [userId, targetUserId].sort();
    const isRequest = !areFriends;
    const newConv: Conversation = {
      id: `conv_${sortedPair[0]}_${sortedPair[1]}`,
      isGroup: false,
      participantIds: [userId, targetUserId],
      participants: [],
      isRequest,
      requestStatus: isRequest ? 'pending' : 'accepted',
      requestedBy: isRequest ? userId : undefined,
      lastReadAtByUser: {
        [userId]: now,
        [targetUserId]: now,
      },
      unreadCount: 0,
      updatedAt: now,
    };

    this.data.conversations.unshift(newConv);
    if (!this.data.conversationMessages[newConv.id]) {
      this.data.conversationMessages[newConv.id] = [];
    }
    this.save();

    return { conversation: this.hydrateConversationForUser(newConv, userId, onlineUserIds) };
  }

  public respondConversationRequest(
    conversationId: string,
    userId: string,
    action: 'accept' | 'decline',
    onlineUserIds?: Set<string>
  ): { conversation?: Conversation; recipientIds?: string[]; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation request not found.', statusCode: 404 };
    }
    if (!conv.isRequest) {
      return { conversation: this.hydrateConversationForUser(conv, userId, onlineUserIds) };
    }
    if (conv.requestedBy === userId) {
      return { error: 'Only the recipient can accept or decline a message request.', statusCode: 403 };
    }
    if (action === 'accept') {
      conv.isRequest = false;
      conv.requestStatus = 'accepted';
    } else {
      conv.requestStatus = 'declined';
    }
    conv.updatedAt = new Date().toISOString();
    this.save();
    return {
      conversation: this.hydrateConversationForUser(conv, userId, onlineUserIds),
      recipientIds: this.getConversationParticipantIds(conv).filter((id) => id !== userId),
    };
  }

  public createGroupConversation(
    creatorId: string,
    name: string,
    memberIds: string[],
    photo?: string,
    onlineUserIds?: Set<string>
  ): { conversation?: Conversation; error?: string; statusCode?: number } {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      return { error: 'Group name is required.', statusCode: 400 };
    }
    const creator = this.findUserById(creatorId);
    if (!creator) {
      return { error: 'Creator user not found.', statusCode: 401 };
    }

    const validMembers = Array.from(
      new Set([creatorId, ...(memberIds || []).filter((id) => Boolean(id) && Boolean(this.findUserById(id)) && !this.isBlocked(creatorId, id))])
    );
    if (validMembers.length < 2) {
      return { error: 'Select at least 1 other member to create a group.', statusCode: 400 };
    }

    const now = new Date().toISOString();
    const convId = `grp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const lastReadAtByUser: Record<string, string> = { [creatorId]: now };

    const newGroup: Conversation = {
      id: convId,
      isGroup: true,
      name: cleanName,
      photo: photo || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(cleanName)}`,
      creatorId,
      adminIds: [creatorId],
      pinnedMessageIds: [],
      disappearingSeconds: 0,
      participantIds: validMembers,
      participants: [],
      lastReadAtByUser,
      unreadCount: 0,
      updatedAt: now,
    };

    const sysMsg: ChatMessage = {
      id: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      conversationId: convId,
      senderId: creatorId,
      senderName: creator.displayName,
      senderAvatar: creator.avatar,
      text: `${creator.displayName} created the group "${cleanName}"`,
      messageType: 'system',
      createdAt: now,
      isRead: false,
    };

    this.data.conversations.unshift(newGroup);
    this.data.conversationMessages[convId] = [sysMsg];
    newGroup.lastMessage = sysMsg;
    this.save();

    return { conversation: this.hydrateConversationForUser(newGroup, creatorId, onlineUserIds) };
  }

  public addGroupMembers(
    conversationId: string,
    actorId: string,
    memberIds: string[],
    onlineUserIds?: Set<string>
  ): { conversation?: Conversation; addedIds?: string[]; systemMessage?: ChatMessage; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !conv.isGroup) return { error: 'Group not found.', statusCode: 404 };
    if (!this.isConversationAdmin(conv, actorId)) {
      return { error: 'Only group admins can add members.', statusCode: 403 };
    }
    const existing = new Set(this.getConversationParticipantIds(conv));
    const toAdd = (memberIds || []).filter((id) => !existing.has(id) && Boolean(this.findUserById(id)) && !this.isBlocked(actorId, id));
    if (toAdd.length === 0) {
      return { error: 'No eligible new members provided.', statusCode: 400 };
    }
    conv.participantIds = [...Array.from(existing), ...toAdd];
    const actor = this.findUserById(actorId);
    const names = toAdd.map((id) => this.findUserById(id)?.displayName || 'Member').join(', ');
    const now = new Date().toISOString();
    const sysMsg: ChatMessage = {
      id: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      conversationId,
      senderId: actorId,
      senderName: actor?.displayName || 'Admin',
      senderAvatar: actor?.avatar || '',
      text: `${actor?.displayName || 'Admin'} added ${names}`,
      messageType: 'system',
      createdAt: now,
      isRead: false,
    };
    if (!this.data.conversationMessages[conversationId]) this.data.conversationMessages[conversationId] = [];
    this.data.conversationMessages[conversationId].push(sysMsg);
    conv.lastMessage = sysMsg;
    conv.updatedAt = now;
    this.save();
    return { conversation: this.hydrateConversationForUser(conv, actorId, onlineUserIds), addedIds: toAdd, systemMessage: sysMsg };
  }

  public removeGroupMember(
    conversationId: string,
    actorId: string,
    targetUserId: string,
    onlineUserIds?: Set<string>
  ): { conversation?: Conversation; systemMessage?: ChatMessage; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !conv.isGroup) return { error: 'Group not found.', statusCode: 404 };
    if (!this.isConversationAdmin(conv, actorId)) {
      return { error: 'Only group admins can remove members.', statusCode: 403 };
    }
    if (targetUserId === conv.creatorId) {
      return { error: 'The group creator cannot be removed.', statusCode: 403 };
    }
    const currentIds = this.getConversationParticipantIds(conv);
    if (!currentIds.includes(targetUserId)) {
      return { error: 'User is not a member of this group.', statusCode: 404 };
    }
    conv.participantIds = currentIds.filter((id) => id !== targetUserId);
    conv.adminIds = (conv.adminIds || []).filter((id) => id !== targetUserId);
    const actor = this.findUserById(actorId);
    const target = this.findUserById(targetUserId);
    const now = new Date().toISOString();
    const sysMsg: ChatMessage = {
      id: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      conversationId,
      senderId: actorId,
      senderName: actor?.displayName || 'Admin',
      senderAvatar: actor?.avatar || '',
      text: `${actor?.displayName || 'Admin'} removed ${target?.displayName || 'a member'}`,
      messageType: 'system',
      createdAt: now,
      isRead: false,
    };
    if (!this.data.conversationMessages[conversationId]) this.data.conversationMessages[conversationId] = [];
    this.data.conversationMessages[conversationId].push(sysMsg);
    conv.lastMessage = sysMsg;
    conv.updatedAt = now;
    this.save();
    return { conversation: this.hydrateConversationForUser(conv, actorId, onlineUserIds), systemMessage: sysMsg };
  }

  public setGroupAdmin(
    conversationId: string,
    actorId: string,
    targetUserId: string,
    makeAdmin: boolean,
    onlineUserIds?: Set<string>
  ): { conversation?: Conversation; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !conv.isGroup) return { error: 'Group not found.', statusCode: 404 };
    if (conv.creatorId !== actorId && !(conv.adminIds || []).includes(actorId)) {
      return { error: 'Only group admins can manage admin roles.', statusCode: 403 };
    }
    if (!this.isConversationParticipant(conv, targetUserId)) {
      return { error: 'User is not in this group.', statusCode: 404 };
    }
    if (targetUserId === conv.creatorId && !makeAdmin) {
      return { error: 'Cannot demote the group creator.', statusCode: 403 };
    }
    const set = new Set(conv.adminIds || (conv.creatorId ? [conv.creatorId] : []));
    if (makeAdmin) set.add(targetUserId);
    else set.delete(targetUserId);
    conv.adminIds = Array.from(set);
    this.save();
    return { conversation: this.hydrateConversationForUser(conv, actorId, onlineUserIds) };
  }

  public leaveGroupConversation(
    conversationId: string,
    userId: string
  ): { ok: boolean; remainingIds?: string[]; systemMessage?: ChatMessage; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !conv.isGroup) return { ok: false, error: 'Group not found.', statusCode: 404 };
    const currentIds = this.getConversationParticipantIds(conv);
    if (!currentIds.includes(userId)) {
      return { ok: false, error: 'You are not a member of this group.', statusCode: 403 };
    }
    const nextIds = currentIds.filter((id) => id !== userId);
    conv.participantIds = nextIds;
    conv.adminIds = (conv.adminIds || []).filter((id) => id !== userId);
    if (conv.creatorId === userId && nextIds.length > 0) {
      conv.creatorId = nextIds[0];
      if (!conv.adminIds.includes(nextIds[0])) conv.adminIds.push(nextIds[0]);
    }
    const actor = this.findUserById(userId);
    const now = new Date().toISOString();
    const sysMsg: ChatMessage = {
      id: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      conversationId,
      senderId: userId,
      senderName: actor?.displayName || 'Member',
      senderAvatar: actor?.avatar || '',
      text: `${actor?.displayName || 'A member'} left the group`,
      messageType: 'system',
      createdAt: now,
      isRead: false,
    };
    if (!this.data.conversationMessages[conversationId]) this.data.conversationMessages[conversationId] = [];
    this.data.conversationMessages[conversationId].push(sysMsg);
    conv.lastMessage = sysMsg;
    conv.updatedAt = now;
    if (nextIds.length === 0) {
      this.data.conversations = this.data.conversations.filter((c) => c.id !== conversationId);
      delete this.data.conversationMessages[conversationId];
    }
    this.save();
    return { ok: true, remainingIds: nextIds, systemMessage: sysMsg };
  }

  public updateConversationSettings(
    conversationId: string,
    userId: string,
    updates: {
      name?: string;
      photo?: string;
      disappearingSeconds?: number;
      isPinned?: boolean;
      isArchived?: boolean;
      isMuted?: boolean;
    },
    onlineUserIds?: Set<string>
  ): { conversation?: Conversation; broadcastMeta?: boolean; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    let broadcastMeta = false;
    if (updates.name !== undefined || updates.photo !== undefined) {
      if (conv.isGroup && !this.isConversationAdmin(conv, userId)) {
        return { error: 'Only group admins can update group name or photo.', statusCode: 403 };
      }
      if (updates.name?.trim()) conv.name = updates.name.trim();
      if (updates.photo !== undefined) conv.photo = updates.photo;
      broadcastMeta = true;
    }
    if (updates.disappearingSeconds !== undefined) {
      if (conv.isGroup && !this.isConversationAdmin(conv, userId)) {
        return { error: 'Only group admins can change disappearing timer in groups.', statusCode: 403 };
      }
      const allowed = [0, 86400, 604800];
      conv.disappearingSeconds = allowed.includes(updates.disappearingSeconds) ? updates.disappearingSeconds : 0;
      broadcastMeta = true;
    }
    const toggleList = (key: 'pinnedBy' | 'archivedBy' | 'mutedBy', val: boolean) => {
      const set = new Set(conv[key] || []);
      if (val) set.add(userId);
      else set.delete(userId);
      conv[key] = Array.from(set);
    };
    if (typeof updates.isPinned === 'boolean') toggleList('pinnedBy', updates.isPinned);
    if (typeof updates.isArchived === 'boolean') toggleList('archivedBy', updates.isArchived);
    if (typeof updates.isMuted === 'boolean') toggleList('mutedBy', updates.isMuted);
    this.save();
    return {
      conversation: this.hydrateConversationForUser(conv, userId, onlineUserIds),
      broadcastMeta,
    };
  }

  public getConversationMessages(
    conversationId: string,
    userId: string,
    beforeId?: string,
    limit = 35
  ): { messages?: ChatMessage[]; hasMore?: boolean; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    if (!this.isConversationParticipant(conv, userId)) {
      return { error: 'Forbidden: you are not a participant of this conversation.', statusCode: 403 };
    }

    if (this.purgeExpiredMessagesForConversation(conversationId)) {
      this.save();
    }

    const viewer = this.findUserById(userId);
    const viewerReceiptsEnabled = viewer?.privacy?.showReadReceipts !== false;

    const allMsgs = (this.data.conversationMessages[conversationId] || []).filter(
      (m) => !(Array.isArray(m.deletedForIds) && m.deletedForIds.includes(userId))
    );
    let endIdx = allMsgs.length;
    if (beforeId) {
      const foundIdx = allMsgs.findIndex((m) => m.id === beforeId);
      if (foundIdx !== -1) {
        endIdx = foundIdx;
      }
    }

    const startIdx = Math.max(0, endIdx - limit);
    const convLastReadEntries = Object.entries(conv.lastReadAtByUser || {});
    const slice = allMsgs.slice(startIdx, endIdx).map((m) => {
      const msgTime = new Date(m.createdAt).getTime();
      const readByOther =
        viewerReceiptsEnabled &&
        convLastReadEntries.some(([uid, ts]) => {
          if (uid === m.senderId) return false;
          const peer = this.findUserById(uid);
          if (peer?.privacy?.showReadReceipts === false) return false;
          return new Date(ts).getTime() >= msgTime;
        });
      return {
        ...m,
        isRead: readByOther,
      };
    });

    return {
      messages: slice,
      hasMore: startIdx > 0,
    };
  }

  public markConversationRead(
    conversationId: string,
    userId: string
  ): { ok: boolean; error?: string; statusCode?: number; participantIds?: string[]; sendReceipt?: boolean } {
    const conv = this.getConversationById(conversationId);
    if (!conv) return { ok: false, error: 'Conversation not found.', statusCode: 404 };
    if (!this.isConversationParticipant(conv, userId)) {
      return { ok: false, error: 'Forbidden.', statusCode: 403 };
    }
    if (!conv.lastReadAtByUser) conv.lastReadAtByUser = {};
    conv.lastReadAtByUser[userId] = new Date().toISOString();
    const user = this.findUserById(userId);
    const sendReceipt = user?.privacy?.showReadReceipts !== false;
    this.save();
    return { ok: true, participantIds: this.getConversationParticipantIds(conv), sendReceipt };
  }

  public addChatMessage(
    conversationId: string,
    senderId: string,
    text: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'video' | 'audio' | 'file',
    extra?: {
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      attachments?: ChatAttachment[];
      audioDuration?: number;
      audioWaveform?: number[];
      replyTo?: ChatReplySnapshot;
      forwardedFrom?: { messageId: string; senderName: string };
      messageType?: 'text' | 'system' | 'call';
      onlineUserIds?: Set<string>;
    }
  ): { message?: ChatMessage; conversation?: Conversation; recipientIds?: string[]; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    if (!this.isConversationParticipant(conv, senderId)) {
      return { error: 'Forbidden: you are not a participant of this conversation.', statusCode: 403 };
    }

    const pIds = this.getConversationParticipantIds(conv);
    if (!conv.isGroup && pIds.length === 2) {
      const otherId = pIds.find((id) => id !== senderId);
      if (otherId) {
        if (this.isBlocked(senderId, otherId)) {
          return { error: 'Messaging is disabled due to block settings.', statusCode: 403 };
        }
        if (conv.isRequest && conv.requestStatus === 'declined') {
          return { error: 'Message request was declined.', statusCode: 403 };
        }
        // If not a formal accepted conversation request yet, check friend/DM policy
        if (!conv.isRequest && !this.isFriend(senderId, otherId)) {
          const other = this.findUserById(otherId);
          if (other?.privacy?.allowDirectMessages !== 'everyone') {
            return { error: 'You can only send messages to accepted friends.', statusCode: 403 };
          }
        }
      }
    }

    const sender = this.findUserById(senderId);
    if (!sender) {
      return { error: 'Sender user not found.', statusCode: 401 };
    }

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const recipientIds = pIds.filter((id) => id !== senderId);
    const deliveredTo = extra?.onlineUserIds
      ? recipientIds.filter((id) => extra.onlineUserIds!.has(id))
      : [];

    const expiresAt =
      conv.disappearingSeconds && conv.disappearingSeconds > 0
        ? new Date(nowMs + conv.disappearingSeconds * 1000).toISOString()
        : undefined;

    const newMsg: ChatMessage = {
      id: `msg_${nowMs}_${crypto.randomBytes(3).toString('hex')}`,
      conversationId,
      senderId: sender.id,
      senderName: sender.displayName,
      senderAvatar: sender.avatar,
      text: (text || '').trim(),
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaType || undefined,
      fileName: extra?.fileName,
      fileSize: extra?.fileSize,
      mimeType: extra?.mimeType,
      attachments: extra?.attachments,
      audioDuration: extra?.audioDuration,
      audioWaveform: extra?.audioWaveform,
      replyTo: extra?.replyTo,
      forwardedFrom: extra?.forwardedFrom,
      messageType: extra?.messageType || 'text',
      reactions: {},
      deliveredTo,
      expiresAt,
      createdAt: now,
      isRead: false,
    };

    if (!this.data.conversationMessages[conversationId]) {
      this.data.conversationMessages[conversationId] = [];
    }
    this.data.conversationMessages[conversationId].push(newMsg);
    conv.lastMessage = newMsg;
    conv.updatedAt = now;
    if (!conv.lastReadAtByUser) conv.lastReadAtByUser = {};
    conv.lastReadAtByUser[senderId] = now;
    this.save();

    return {
      message: newMsg,
      conversation: this.hydrateConversationForUser(conv, senderId, extra?.onlineUserIds),
      recipientIds,
    };
  }

  public editChatMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    newText: string
  ): { message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    const msgs = this.data.conversationMessages[conversationId] || [];
    const msg = msgs.find((m) => m.id === msgId);
    if (!msg) return { error: 'Message not found.', statusCode: 404 };
    if (msg.senderId !== userId) return { error: 'You can only edit your own messages.', statusCode: 403 };
    if (msg.isDeleted) return { error: 'Cannot edit a deleted message.', statusCode: 400 };
    const clean = (newText || '').trim();
    if (!clean) return { error: 'Edited message text cannot be empty.', statusCode: 400 };
    msg.text = clean;
    msg.isEdited = true;
    msg.editedAt = new Date().toISOString();
    if (conv.lastMessage?.id === msg.id) conv.lastMessage = msg;
    this.save();
    return {
      message: msg,
      recipientIds: this.getConversationParticipantIds(conv).filter((id) => id !== userId),
    };
  }

  public deleteChatMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    mode: 'me' | 'everyone' = 'everyone'
  ): { message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    const msgs = this.data.conversationMessages[conversationId] || [];
    const msg = msgs.find((m) => m.id === msgId);
    if (!msg) return { error: 'Message not found.', statusCode: 404 };

    if (mode === 'me') {
      if (!Array.isArray(msg.deletedForIds)) msg.deletedForIds = [];
      if (!msg.deletedForIds.includes(userId)) msg.deletedForIds.push(userId);
      this.save();
      return { message: msg, recipientIds: [] };
    }

    const canDeleteForEveryone = msg.senderId === userId || (conv.isGroup && this.isConversationAdmin(conv, userId));
    if (!canDeleteForEveryone) {
      return { error: 'Not authorized to delete this message for everyone.', statusCode: 403 };
    }
    msg.isDeleted = true;
    msg.text = 'This message was deleted';
    msg.mediaUrl = undefined;
    msg.mediaType = undefined;
    msg.attachments = undefined;
    msg.audioWaveform = undefined;
    msg.fileName = undefined;
    if (conv.lastMessage?.id === msg.id) conv.lastMessage = msg;
    conv.pinnedMessageIds = (conv.pinnedMessageIds || []).filter((id) => id !== msg.id);
    msg.isPinned = false;
    this.save();
    return {
      message: msg,
      recipientIds: this.getConversationParticipantIds(conv).filter((id) => id !== userId),
    };
  }

  public toggleChatReaction(
    conversationId: string,
    msgId: string,
    userId: string,
    emoji: string
  ): { message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    const msgs = this.data.conversationMessages[conversationId] || [];
    const msg = msgs.find((m) => m.id === msgId);
    if (!msg || msg.isDeleted) return { error: 'Message not found.', statusCode: 404 };

    if (!msg.reactions) msg.reactions = {};
    const list = Array.isArray(msg.reactions[emoji]) ? [...msg.reactions[emoji]] : [];
    const already = list.includes(userId);
    if (already) {
      const next = list.filter((id) => id !== userId);
      if (next.length === 0) delete msg.reactions[emoji];
      else msg.reactions[emoji] = next;
    } else {
      msg.reactions[emoji] = [...list, userId];
    }
    this.save();
    return {
      message: msg,
      recipientIds: this.getConversationParticipantIds(conv).filter((id) => id !== userId),
    };
  }

  public togglePinChatMessage(
    conversationId: string,
    msgId: string,
    userId: string
  ): { message?: ChatMessage; pinnedMessageIds?: string[]; recipientIds?: string[]; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    const msgs = this.data.conversationMessages[conversationId] || [];
    const msg = msgs.find((m) => m.id === msgId);
    if (!msg || msg.isDeleted) return { error: 'Message not found.', statusCode: 404 };
    const pinnedSet = new Set(conv.pinnedMessageIds || []);
    if (pinnedSet.has(msgId)) {
      pinnedSet.delete(msgId);
      msg.isPinned = false;
    } else {
      pinnedSet.add(msgId);
      msg.isPinned = true;
    }
    conv.pinnedMessageIds = Array.from(pinnedSet);
    this.save();
    return {
      message: msg,
      pinnedMessageIds: conv.pinnedMessageIds,
      recipientIds: this.getConversationParticipantIds(conv).filter((id) => id !== userId),
    };
  }

  public searchConversationMessages(
    conversationId: string,
    userId: string,
    query: string
  ): { messages?: ChatMessage[]; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    this.purgeExpiredMessagesForConversation(conversationId);
    const term = (query || '').trim().toLowerCase();
    const msgs = (this.data.conversationMessages[conversationId] || []).filter(
      (m) =>
        !m.isDeleted &&
        !(Array.isArray(m.deletedForIds) && m.deletedForIds.includes(userId)) &&
        (!term || m.text.toLowerCase().includes(term) || (m.fileName || '').toLowerCase().includes(term))
    );
    return { messages: msgs.slice(-50) };
  }

  public getConversationSharedMedia(
    conversationId: string,
    userId: string
  ): { items?: ChatMessage[]; links?: { messageId: string; url: string; senderName: string; createdAt: string }[]; error?: string; statusCode?: number } {
    const conv = this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    this.purgeExpiredMessagesForConversation(conversationId);
    const msgs = (this.data.conversationMessages[conversationId] || []).filter(
      (m) => !m.isDeleted && !(Array.isArray(m.deletedForIds) && m.deletedForIds.includes(userId))
    );
    const items = msgs.filter((m) => Boolean(m.mediaUrl) || (Array.isArray(m.attachments) && m.attachments.length > 0)).reverse();
    const urlRegex = /https?:\/\/[^\s<>()]+/gi;
    const links: { messageId: string; url: string; senderName: string; createdAt: string }[] = [];
    for (const m of [...msgs].reverse()) {
      const matches = m.text.match(urlRegex);
      if (matches) {
        for (const u of matches) {
          links.push({ messageId: m.id, url: u, senderName: m.senderName, createdAt: m.createdAt });
        }
      }
    }
    return { items, links };
  }

  // ==========================================
  // CALL HISTORY (WebRTC Logs & Missed Calls)
  // ==========================================
  public addCallRecord(record: CallRecord): CallRecord {
    if (!Array.isArray(this.data.calls)) this.data.calls = [];
    this.data.calls.unshift(record);
    this.data.calls = this.data.calls.slice(0, 300);
    this.save();
    return record;
  }

  public updateCallRecord(callId: string, updates: Partial<CallRecord>): CallRecord | undefined {
    if (!Array.isArray(this.data.calls)) return undefined;
    const item = this.data.calls.find((c) => c.id === callId);
    if (!item) return undefined;
    Object.assign(item, updates);
    this.save();
    return item;
  }

  public getCallRecordById(callId: string): CallRecord | undefined {
    return (this.data.calls || []).find((c) => c.id === callId);
  }

  public getUserCalls(userId: string): CallRecord[] {
    return (this.data.calls || []).filter((c) => c.callerId === userId || c.calleeIds.includes(userId));
  }

  // ==========================================
  // POST DRAFTS
  // ==========================================
  public getUserDrafts(userId: string): DraftPost[] {
    return (this.data.drafts || [])
      .filter((d) => d.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public saveDraft(draft: DraftPost): DraftPost {
    if (!Array.isArray(this.data.drafts)) this.data.drafts = [];
    const idx = this.data.drafts.findIndex((d) => d.id === draft.id && d.userId === draft.userId);
    if (idx !== -1) {
      this.data.drafts[idx] = { ...this.data.drafts[idx], ...draft, updatedAt: new Date().toISOString() };
      this.save();
      return this.data.drafts[idx];
    }
    this.data.drafts.unshift(draft);
    this.save();
    return draft;
  }

  public deleteDraft(draftId: string, userId: string): boolean {
    if (!Array.isArray(this.data.drafts)) return false;
    const before = this.data.drafts.length;
    this.data.drafts = this.data.drafts.filter((d) => !(d.id === draftId && d.userId === userId));
    if (this.data.drafts.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // PRIVATE SAVED VIDEOS COLLECTION
  // ==========================================
  public getUserSavedVideos(userId: string): SavedVideoItem[] {
    return (this.data.savedVideos || [])
      .filter((v) => v.userId === userId)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }

  public isVideoSaved(userId: string, videoId: string): boolean {
    return (this.data.savedVideos || []).some(
      (v) => v.userId === userId && (v.videoId === videoId || (v.youtubeId && v.youtubeId === videoId))
    );
  }

  public toggleSaveVideo(
    userId: string,
    item: Omit<SavedVideoItem, 'id' | 'userId' | 'savedAt'>
  ): { isSaved: boolean; savedVideos: SavedVideoItem[] } {
    if (!Array.isArray(this.data.savedVideos)) this.data.savedVideos = [];
    const idx = this.data.savedVideos.findIndex(
      (v) =>
        v.userId === userId &&
        (v.videoId === item.videoId || (item.youtubeId && v.youtubeId === item.youtubeId))
    );
    if (idx !== -1) {
      this.data.savedVideos.splice(idx, 1);
      this.save();
      return { isSaved: false, savedVideos: this.getUserSavedVideos(userId) };
    }
    const created: SavedVideoItem = {
      id: `sv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      userId,
      savedAt: new Date().toISOString(),
      ...item,
    };
    this.data.savedVideos.unshift(created);
    this.save();
    return { isSaved: true, savedVideos: this.getUserSavedVideos(userId) };
  }

  // ==========================================
  // WATCH TRACKING & 7-DAY FEED SUPPRESSION
  // ==========================================
  public upsertWatchProgress(
    userId: string,
    payload: {
      videoId: string;
      youtubeId?: string;
      videoType: 'long' | 'short';
      source: PlatformSource;
      title: string;
      thumbnailUrl: string;
      channelTitle: string;
      duration?: string;
      watchSeconds: number;
      durationSeconds?: number;
      completed?: boolean;
    }
  ): WatchHistoryRecord {
    if (!Array.isArray(this.data.watchHistory)) this.data.watchHistory = [];
    const now = new Date().toISOString();
    const durSec = Math.max(0, Number(payload.durationSeconds || 0));
    const watchSec = Math.max(0, Number(payload.watchSeconds || 0));

    const existing = this.data.watchHistory.find(
      (h) =>
        h.userId === userId &&
        (h.videoId === payload.videoId || (payload.youtubeId && h.youtubeId === payload.youtubeId))
    );

    const maxWatch = Math.max(existing?.watchSeconds || 0, watchSec);
    const maxDur = Math.max(existing?.durationSeconds || 0, durSec);
    const completed = Boolean(existing?.completed || payload.completed || (maxDur > 0 && maxWatch / maxDur >= 0.85));
    // Meaningful view threshold: >= 8 seconds watched, OR >= 25% of video, OR completed (prevents accidental 1-2s taps/preloads)
    const minSecondsThreshold = payload.videoType === 'short' ? 5 : 8;
    const meaningfulView = Boolean(
      existing?.meaningfulView ||
        completed ||
        maxWatch >= minSecondsThreshold ||
        (maxDur > 0 && maxWatch / maxDur >= 0.25)
    );

    if (existing) {
      existing.watchSeconds = maxWatch;
      existing.durationSeconds = maxDur;
      existing.completed = completed;
      existing.meaningfulView = meaningfulView;
      existing.lastViewedAt = now;
      if (payload.title) existing.title = payload.title;
      if (payload.thumbnailUrl) existing.thumbnailUrl = payload.thumbnailUrl;
      this.save();
      return existing;
    }

    const record: WatchHistoryRecord = {
      userId,
      videoId: payload.videoId,
      youtubeId: payload.youtubeId,
      videoType: payload.videoType,
      source: payload.source,
      title: payload.title || 'Watched Video',
      thumbnailUrl: payload.thumbnailUrl || '',
      channelTitle: payload.channelTitle || 'Creator',
      duration: payload.duration,
      watchSeconds: maxWatch,
      durationSeconds: maxDur,
      completed,
      meaningfulView,
      firstViewedAt: now,
      lastViewedAt: now,
    };
    this.data.watchHistory.unshift(record);
    this.save();
    return record;
  }

  public getSuppressedVideoIds(userId: string | undefined, suppressionDays = 7): Set<string> {
    const suppressed = new Set<string>();
    if (!userId || suppressionDays <= 0) return suppressed;
    const cutoffMs = Date.now() - suppressionDays * 24 * 60 * 60 * 1000;
    for (const h of this.data.watchHistory || []) {
      if (h.userId !== userId || !h.meaningfulView) continue;
      const viewedMs = new Date(h.lastViewedAt || h.firstViewedAt).getTime();
      if (viewedMs >= cutoffMs) {
        if (h.videoId) suppressed.add(h.videoId);
        if (h.youtubeId) suppressed.add(h.youtubeId);
      }
    }
    return suppressed;
  }

  public getUserWatchHistory(userId: string): WatchHistoryRecord[] {
    return (this.data.watchHistory || [])
      .filter((h) => h.userId === userId)
      .sort((a, b) => new Date(b.lastViewedAt).getTime() - new Date(a.lastViewedAt).getTime());
  }

  public removeWatchHistoryItem(userId: string, videoId: string): boolean {
    if (!Array.isArray(this.data.watchHistory)) return false;
    const before = this.data.watchHistory.length;
    this.data.watchHistory = this.data.watchHistory.filter(
      (h) => !(h.userId === userId && (h.videoId === videoId || h.youtubeId === videoId))
    );
    if (this.data.watchHistory.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  // ==========================================
  // USER MODERATION & REPORTS
  // ==========================================
  public addUserReport(report: UserReport): UserReport {
    if (!Array.isArray(this.data.reports)) this.data.reports = [];
    this.data.reports.unshift(report);
    this.save();
    return report;
  }
}

export const db = new MotherlandDatabase();
