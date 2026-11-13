import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.resolve(DATA_DIR, 'motherland_database.json');

export interface ServerUser {
  id: string;
  email: string;
  phone?: string;
  passwordHash?: string;
  passwordSalt?: string;
  name: string;
  handle: string;
  avatar: string;
  coverPhoto?: string;
  bio: string;
  location: string;
  website?: string;
  gender?: string;
  dob?: string;
  joinDate: string;
  role: 'user' | 'owner' | 'admin';
  isVerified: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  platform: 'motherland' | 'google' | 'youtube';
  friends: string[]; // User IDs who are mutual friends
  friendRequestsSent: string[]; // User IDs this user has requested
  friendRequestsReceived: string[]; // User IDs requesting this user
  followers: string[]; // User IDs who follow this user
  following: string[]; // User IDs this user follows
  blockedUsers: string[];
  settings?: {
    isPrivate?: boolean;
    notificationPreferences?: Record<string, boolean>;
  };
  connectedYouTubeChannel?: {
    channelId: string;
    channelTitle: string;
    channelHandle?: string;
    avatarUrl: string;
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
    description?: string;
  } | null;
  googleId?: string;
}

export interface ServerSession {
  token: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export interface ServerPostMedia {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
  duration?: string;
}

export interface ServerCommentReply {
  id: string;
  commentId: string;
  author: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
    role?: string;
    platform?: string;
  };
  text: string;
  createdAt: string;
  likes: string[]; // user IDs who liked this reply
}

export interface ServerComment {
  id: string;
  postId: string;
  author: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
    role?: string;
    platform?: string;
  };
  text: string;
  createdAt: string;
  likes: string[]; // user IDs who liked this comment
  replies: ServerCommentReply[];
}

export interface ServerPost {
  id: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
    role?: string;
    platform?: string;
  };
  content: string;
  media: ServerPostMedia[];
  createdAt: string;
  privacy: 'public' | 'friends' | 'only_me';
  location?: string;
  tags?: string[];
  platform: 'motherland' | 'youtube' | 'tiktok' | 'facebook' | 'instagram';
  youtubeVideoId?: string;
  originalVideoUrl?: string;
  isShort?: boolean;
  // True interaction tracking - ZERO FAKE DATA
  likes: string[]; // User IDs who liked
  reactions: Record<string, string[]>; // reactionType -> array of userIds
  sharesCount: number; // Actual tracked shares
  commentsCount: number; // Actual count of saved comments + replies
  viewsCount?: number; // Actual tracked view count
}

export interface ServerStory {
  id: string;
  authorId: string;
  author: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
    isVerified?: boolean;
    role?: string;
  };
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  caption?: string;
  createdAt: number;
  expiresAt: number; // Exactly 24 hours from creation
  views: string[]; // user IDs who viewed
  reactions: Record<string, string[]>;
}

export interface ServerNotification {
  id: string;
  userId: string; // Target recipient
  actorId: string; // Who triggered it
  actor: {
    id: string;
    name: string;
    handle: string;
    avatar: string;
  };
  type:
    | 'friend_request'
    | 'friend_accept'
    | 'follow'
    | 'like'
    | 'reaction'
    | 'comment'
    | 'reply'
    | 'mention'
    | 'share'
    | 'post'
    | 'video'
    | 'story'
    | 'system'
    | 'youtube'
    | 'google';
  category: 'motherland' | 'youtube' | 'google' | 'facebook' | 'instagram';
  title: string;
  message: string;
  targetId?: string;
  read: boolean;
  createdAt: number;
}

interface DatabaseSchema {
  users: Record<string, ServerUser>;
  sessions: Record<string, ServerSession>;
  posts: ServerPost[];
  comments: Record<string, ServerComment[]>;
  stories: ServerStory[];
  notifications: ServerNotification[];
  passwordResetTokens: Record<string, { email: string; token: string; expiresAt: number }>;
  otpCodes: Record<string, { phone: string; code: string; expiresAt: number }>;
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const calculated = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// Initial verified sample posts representing genuine Bangladeshi community media (with 0 fake counts)
const SEED_POSTS: ServerPost[] = [
  {
    id: 'post_nat_video_1',
    authorId: 'usr_drone_bd',
    author: {
      id: 'usr_drone_bd',
      name: 'Skyline Drone Cinematography',
      handle: '@skyline_bd',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    content:
      'Mesmerizing 4K aerial flight soaring through Sajek Valley (সাজেক ভ্যালি) above sea of clouds! 🚁⛅ The clouds drift over the wooden cottages along the mountain ridge as morning light breaks across the horizon. Watch in full HD! 🇧🇩\n\n#MotherlandVideo #Sajek #Rangamati #Drone #Bangladesh',
    media: [
      {
        id: 'med_v1',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80',
        aspectRatio: '16:9',
        duration: '0:15',
      },
    ],
    createdAt: '2h ago',
    privacy: 'public',
    location: 'Sajek Valley, Rangamati',
    tags: ['Sajek', 'Travel', 'Bangladesh', 'Drone'],
    platform: 'motherland',
    likes: [],
    reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [], cool: [] },
    sharesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    isShort: false,
  },
  {
    id: 'post_nat_short_1',
    authorId: 'usr_cox_surfer',
    author: {
      id: 'usr_cox_surfer',
      name: 'Bay of Bengal Surfing Club',
      handle: '@cox_surfers',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    content:
      'Chasing monster monsoon tide swells along Inani Beach, Cox’s Bazar! 🌊🏄‍♂️ Longest uninterrupted natural sea beach on planet Earth. Vertical mobile reel captured at 60fps!\n\n#CoxsBazar #Shorts #Surfing #BeachLife #Bangladesh',
    media: [
      {
        id: 'med_v2',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
        aspectRatio: '9:16',
        duration: '0:15',
      },
    ],
    createdAt: '4h ago',
    privacy: 'public',
    location: 'Inani Beach, Cox’s Bazar',
    tags: ['Shorts', 'CoxsBazar', 'Reels', 'SeaBeach'],
    platform: 'motherland',
    likes: [],
    reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [], cool: [] },
    sharesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    isShort: true,
  },
  {
    id: 'post_nat_photo_1',
    authorId: 'usr_heritage_dhaka',
    author: {
      id: 'usr_heritage_dhaka',
      name: 'Heritage of Old Dhaka',
      handle: '@heritage_dhaka',
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    content:
      'Lalbagh Fort (লালবাগ কেল্লা) illuminated during winter twilight in Old Dhaka. Built in 1678 by Mughal Subahdar Muhammad Azam Shah. Preserving the historical heritage and classical architecture of Bangladesh. 🏛️🇧🇩\n\n#Dhaka #History #Heritage #Architecture',
    media: [
      {
        id: 'med_1a',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1588416936097-41850ab3d86d?w=1000&auto=format&fit=crop&q=80',
        alt: 'Lalbagh Fort Dhaka',
        aspectRatio: '16:9',
      },
    ],
    createdAt: '3h ago',
    privacy: 'public',
    location: 'Lalbagh, Dhaka',
    tags: ['Dhaka', 'Heritage', 'History'],
    platform: 'motherland',
    likes: [],
    reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [], cool: [] },
    sharesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    isShort: false,
  },
];

class DatabaseManager {
  private db: DatabaseSchema = {
    users: {},
    sessions: {},
    posts: [],
    comments: {},
    stories: [],
    notifications: [],
    passwordResetTokens: {},
    otpCodes: {},
  };

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.db = {
          users: parsed.users || {},
          sessions: parsed.sessions || {},
          posts: parsed.posts || SEED_POSTS,
          comments: parsed.comments || {},
          stories: parsed.stories || [],
          notifications: parsed.notifications || [],
          passwordResetTokens: parsed.passwordResetTokens || {},
          otpCodes: parsed.otpCodes || {},
        };
      } else {
        // Seed initial verified community posts
        this.db = {
          users: {},
          sessions: {},
          posts: SEED_POSTS,
          comments: {},
          stories: [],
          notifications: [],
          passwordResetTokens: {},
          otpCodes: {},
        };
        this.persist();
      }

      // Cleanup expired stories on start
      this.cleanupExpiredStories();
    } catch (e) {
      console.error('[DB] Failed initializing database file, falling back to memory:', e);
      this.db = {
        users: {},
        sessions: {},
        posts: SEED_POSTS,
        comments: {},
        stories: [],
        notifications: [],
        passwordResetTokens: {},
        otpCodes: {},
      };
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (e) {
      console.error('[DB] Failed persisting database:', e);
    }
  }

  // --- Session & Auth Operations ---
  public createSession(userId: string): ServerSession {
    const token = `mth_sess_${crypto.randomBytes(32).toString('hex')}`;
    const session: ServerSession = {
      token,
      userId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days persistent session
    };
    if (!this.db.sessions) this.db.sessions = {};
    this.db.sessions[token] = session;
    this.persist();
    return session;
  }

  public getSession(token: string): ServerSession | null {
    if (!this.db.sessions || !token) return null;
    const sess = this.db.sessions[token];
    if (!sess) return null;
    if (Date.now() > sess.expiresAt) {
      delete this.db.sessions[token];
      this.persist();
      return null;
    }
    return sess;
  }

  public deleteSession(token: string): boolean {
    if (this.db.sessions && this.db.sessions[token]) {
      delete this.db.sessions[token];
      this.persist();
      return true;
    }
    return false;
  }

  // --- User Operations ---
  public getUser(userId: string): ServerUser | null {
    return this.db.users[userId] || null;
  }

  public getUserByEmail(email: string): ServerUser | null {
    const cleanEmail = email.toLowerCase().trim();
    return Object.values(this.db.users).find((u) => u.email.toLowerCase() === cleanEmail) || null;
  }

  public getUserByHandle(handle: string): ServerUser | null {
    const cleanHandle = handle.toLowerCase().trim().replace(/^@/, '');
    return (
      Object.values(this.db.users).find(
        (u) => u.handle.toLowerCase().replace(/^@/, '') === cleanHandle
      ) || null
    );
  }

  public getUserByPhone(phone: string): ServerUser | null {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    return Object.values(this.db.users).find((u) => u.phone && u.phone.replace(/[^0-9+]/g, '') === cleanPhone) || null;
  }

  public getUserByGoogleId(googleId: string): ServerUser | null {
    return Object.values(this.db.users).find((u) => u.googleId === googleId) || null;
  }

  public registerUser(data: {
    name: string;
    username: string;
    email: string;
    password?: string;
    phone?: string;
    dob?: string;
    gender?: string;
    bio?: string;
    location?: string;
    website?: string;
    avatar?: string;
    coverPhoto?: string;
    role?: 'user' | 'owner' | 'admin';
    platform?: 'motherland' | 'google';
    googleId?: string;
  }): { user: ServerUser; session: ServerSession } {
    const cleanEmail = data.email.toLowerCase().trim();
    const cleanHandle = `@${data.username.toLowerCase().trim().replace(/^@/, '').replace(/[^a-z0-9_.]/g, '_')}`;

    if (this.getUserByEmail(cleanEmail)) {
      throw new Error('An account with this email address already exists.');
    }
    if (this.getUserByHandle(cleanHandle)) {
      throw new Error('This username is already taken. Please choose another username.');
    }

    const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    let passwordHash: string | undefined;
    let passwordSalt: string | undefined;

    if (data.password) {
      const hashed = hashPassword(data.password);
      passwordHash = hashed.hash;
      passwordSalt = hashed.salt;
    }

    const newUser: ServerUser = {
      id: userId,
      email: cleanEmail,
      phone: data.phone || undefined,
      passwordHash,
      passwordSalt,
      name: data.name.trim(),
      handle: cleanHandle,
      avatar: data.avatar || '',
      coverPhoto: data.coverPhoto || '',
      bio: data.bio || '',
      location: data.location || 'Bangladesh',
      website: data.website || '',
      gender: data.gender || '',
      dob: data.dob || '',
      joinDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      role: data.role || 'user',
      isVerified: data.role === 'owner',
      isEmailVerified: !!data.googleId,
      isPhoneVerified: false,
      platform: data.platform || 'motherland',
      friends: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      followers: [],
      following: [],
      blockedUsers: [],
      settings: {
        isPrivate: false,
        notificationPreferences: {
          likes: true,
          comments: true,
          friendRequests: true,
          mentions: true,
          system: true,
        },
      },
      connectedYouTubeChannel: null,
      googleId: data.googleId || undefined,
    };

    this.db.users[userId] = newUser;
    const session = this.createSession(userId);
    this.persist();

    return { user: newUser, session };
  }

  public authenticate(identifier: string, password: string): { user: ServerUser; session: ServerSession } {
    const cleanId = identifier.trim().toLowerCase();
    const user =
      this.getUserByEmail(cleanId) ||
      this.getUserByHandle(cleanId) ||
      this.getUserByPhone(cleanId);

    if (!user) {
      throw new Error('No MOTHERLAND account found with these credentials.');
    }

    if (!user.passwordHash || !user.passwordSalt) {
      throw new Error('This account was created via Google Sign-In. Please sign in with Google or reset your password.');
    }

    const isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!isValid) {
      throw new Error('Incorrect password. Please try again.');
    }

    const session = this.createSession(user.id);
    return { user, session };
  }

  public updateUser(userId: string, updates: Partial<ServerUser>): ServerUser {
    const user = this.db.users[userId];
    if (!user) throw new Error('User not found');

    if (updates.name !== undefined) user.name = updates.name.trim();
    if (updates.bio !== undefined) user.bio = updates.bio;
    if (updates.location !== undefined) user.location = updates.location;
    if (updates.website !== undefined) user.website = updates.website;
    if (updates.gender !== undefined) user.gender = updates.gender;
    if (updates.dob !== undefined) user.dob = updates.dob;
    if (updates.avatar !== undefined) user.avatar = updates.avatar;
    if (updates.coverPhoto !== undefined) user.coverPhoto = updates.coverPhoto;
    if (updates.settings !== undefined) {
      user.settings = { ...user.settings, ...updates.settings };
    }

    // Also update author info across the user's existing posts so profile picture updates everywhere!
    if (updates.avatar !== undefined || updates.name !== undefined) {
      this.db.posts.forEach((p) => {
        if (p.authorId === userId || p.author.id === userId) {
          if (updates.avatar !== undefined) p.author.avatar = updates.avatar;
          if (updates.name !== undefined) p.author.name = updates.name;
        }
      });
    }

    this.persist();
    return user;
  }

  public setOwnerRole(userId: string): ServerUser {
    const user = this.db.users[userId];
    if (!user) throw new Error('User not found');
    user.role = 'owner';
    user.isVerified = true;
    this.persist();
    return user;
  }

  public upsertGoogleUser(data: {
    googleId: string;
    email: string;
    name: string;
    avatar: string;
    connectedYouTubeChannel?: ServerUser['connectedYouTubeChannel'];
  }): { user: ServerUser; session: ServerSession } {
    let existing = this.getUserByGoogleId(data.googleId) || this.getUserByEmail(data.email);

    if (existing) {
      existing.googleId = data.googleId;
      existing.name = data.name || existing.name;
      existing.avatar = data.avatar || existing.avatar;
      existing.isEmailVerified = true;
      if (data.connectedYouTubeChannel !== undefined) {
        existing.connectedYouTubeChannel = data.connectedYouTubeChannel;
      }
      const session = this.createSession(existing.id);
      this.persist();
      return { user: existing, session };
    }

    const reg = this.registerUser({
      name: data.name,
      username: data.email.split('@')[0],
      email: data.email,
      avatar: data.avatar,
      platform: 'google',
      googleId: data.googleId,
    });

    if (data.connectedYouTubeChannel) {
      reg.user.connectedYouTubeChannel = data.connectedYouTubeChannel;
      this.persist();
    }

    return reg;
  }

  public disconnectYouTube(userId: string): ServerUser | null {
    const user = this.db.users[userId];
    if (!user) return null;
    user.connectedYouTubeChannel = null;
    this.persist();
    return user;
  }

  // --- Dynamic Friend Suggestions (Section 5) ---
  public getFriendSuggestions(userId: string): ServerUser[] {
    const currentUser = this.db.users[userId];
    const totalUsers = Object.keys(this.db.users).length;

    // Strict dynamic rules:
    // < 3 users: 0
    // 3 users: up to 2
    // 10 users: 3-5
    // 100 users: 10-12
    if (totalUsers < 3) return [];

    let maxSuggestions = 2;
    if (totalUsers >= 50) maxSuggestions = 12;
    else if (totalUsers >= 10) maxSuggestions = 5;
    else if (totalUsers >= 3) maxSuggestions = 2;

    const candidates = Object.values(this.db.users).filter((u) => {
      if (u.id === userId) return false;
      if (currentUser?.friends?.includes(u.id)) return false;
      if (currentUser?.friendRequestsSent?.includes(u.id)) return false;
      if (currentUser?.friendRequestsReceived?.includes(u.id)) return false;
      if (currentUser?.blockedUsers?.includes(u.id)) return false;
      return true;
    });

    return candidates.slice(0, maxSuggestions);
  }

  // --- Friend Requests & Relationships ---
  public sendFriendRequest(fromUserId: string, toUserId: string): { success: boolean; status: string } {
    const sender = this.db.users[fromUserId];
    const receiver = this.db.users[toUserId];
    if (!sender || !receiver) throw new Error('User not found');
    if (fromUserId === toUserId) throw new Error('Cannot send friend request to yourself');

    if (!sender.friendRequestsSent) sender.friendRequestsSent = [];
    if (!receiver.friendRequestsReceived) receiver.friendRequestsReceived = [];
    if (!sender.friends) sender.friends = [];

    if (sender.friends.includes(toUserId)) {
      return { success: true, status: 'already_friends' };
    }
    if (sender.friendRequestsSent.includes(toUserId)) {
      return { success: true, status: 'request_already_sent' };
    }

    // Mutual request auto-accept
    if (sender.friendRequestsReceived?.includes(toUserId)) {
      return this.acceptFriendRequest(fromUserId, toUserId);
    }

    sender.friendRequestsSent.push(toUserId);
    receiver.friendRequestsReceived.push(fromUserId);

    this.createNotification({
      userId: toUserId,
      actorId: fromUserId,
      actor: { id: sender.id, name: sender.name, handle: sender.handle, avatar: sender.avatar },
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${sender.name} sent you a friend request.`,
      targetId: sender.id,
    });

    this.persist();
    return { success: true, status: 'request_sent' };
  }

  public acceptFriendRequest(userId: string, requestFromUserId: string): { success: boolean; status: string } {
    const user = this.db.users[userId];
    const requester = this.db.users[requestFromUserId];
    if (!user || !requester) throw new Error('User not found');

    if (!user.friends) user.friends = [];
    if (!requester.friends) requester.friends = [];

    user.friendRequestsReceived = (user.friendRequestsReceived || []).filter((id) => id !== requestFromUserId);
    requester.friendRequestsSent = (requester.friendRequestsSent || []).filter((id) => id !== userId);

    if (!user.friends.includes(requestFromUserId)) user.friends.push(requestFromUserId);
    if (!requester.friends.includes(userId)) requester.friends.push(userId);

    this.createNotification({
      userId: requestFromUserId,
      actorId: userId,
      actor: { id: user.id, name: user.name, handle: user.handle, avatar: user.avatar },
      type: 'friend_accept',
      title: 'Friend Request Accepted',
      message: `${user.name} accepted your friend request. You are now friends!`,
      targetId: user.id,
    });

    this.persist();
    return { success: true, status: 'accepted' };
  }

  public rejectFriendRequest(userId: string, requestFromUserId: string): { success: boolean } {
    const user = this.db.users[userId];
    const requester = this.db.users[requestFromUserId];
    if (user) {
      user.friendRequestsReceived = (user.friendRequestsReceived || []).filter((id) => id !== requestFromUserId);
    }
    if (requester) {
      requester.friendRequestsSent = (requester.friendRequestsSent || []).filter((id) => id !== userId);
    }
    this.persist();
    return { success: true };
  }

  public cancelFriendRequest(userId: string, toUserId: string): { success: boolean } {
    const sender = this.db.users[userId];
    const receiver = this.db.users[toUserId];
    if (sender) {
      sender.friendRequestsSent = (sender.friendRequestsSent || []).filter((id) => id !== toUserId);
    }
    if (receiver) {
      receiver.friendRequestsReceived = (receiver.friendRequestsReceived || []).filter((id) => id !== userId);
    }
    this.persist();
    return { success: true };
  }

  public removeFriend(userId: string, friendId: string): { success: boolean } {
    const user = this.db.users[userId];
    const friend = this.db.users[friendId];
    if (user && user.friends) {
      user.friends = user.friends.filter((id) => id !== friendId);
    }
    if (friend && friend.friends) {
      friend.friends = friend.friends.filter((id) => id !== userId);
    }
    this.persist();
    return { success: true };
  }

  public toggleFollow(followerId: string, targetUserId: string): { isFollowing: boolean; followersCount: number; followingCount: number } {
    const follower = this.db.users[followerId];
    const target = this.db.users[targetUserId];

    if (!follower || !target) {
      return { isFollowing: false, followersCount: 0, followingCount: 0 };
    }

    if (!target.followers) target.followers = [];
    if (!follower.following) follower.following = [];

    const isFollowing = target.followers.includes(followerId);

    if (isFollowing) {
      target.followers = target.followers.filter((id) => id !== followerId);
      follower.following = follower.following.filter((id) => id !== targetUserId);
    } else {
      target.followers.push(followerId);
      follower.following.push(targetUserId);

      this.createNotification({
        userId: targetUserId,
        actorId: followerId,
        actor: { id: follower.id, name: follower.name, handle: follower.handle, avatar: follower.avatar },
        type: 'follow',
        title: 'New Supporter',
        message: `${follower.name} started supporting you.`,
        targetId: follower.id,
      });
    }

    this.persist();
    return {
      isFollowing: !isFollowing,
      followersCount: target.followers.length,
      followingCount: follower.following.length,
    };
  }

  // --- Posts Operations ---
  public getPosts(options?: { platform?: string; limit?: number; offset?: number; isShort?: boolean; authorId?: string }): { posts: ServerPost[]; total: number } {
    let list = [...this.db.posts];

    if (options?.platform && options.platform !== 'all') {
      list = list.filter((p) => p.platform === options.platform);
    }
    if (options?.isShort !== undefined) {
      list = list.filter((p) => !!p.isShort === options.isShort);
    }
    if (options?.authorId) {
      list = list.filter((p) => p.authorId === options.authorId || p.author.id === options.authorId);
    }

    const total = list.length;
    const offset = options?.offset || 0;
    const limit = options?.limit || 30;
    const paginated = list.slice(offset, offset + limit);

    return { posts: paginated, total };
  }

  public getPostById(postId: string): ServerPost | null {
    return this.db.posts.find((p) => p.id === postId) || null;
  }

  public createPost(data: Omit<ServerPost, 'id' | 'likes' | 'reactions' | 'sharesCount' | 'commentsCount'> & { id?: string }): ServerPost {
    const isShort =
      data.isShort !== undefined
        ? data.isShort
        : data.media.some((m) => m.aspectRatio === '9:16') ||
          (data.media.some((m) => m.type === 'video') && (data.content?.toLowerCase().includes('#shorts') || data.content?.toLowerCase().includes('shorts')));

    const newPost: ServerPost = {
      ...data,
      id: data.id || `post_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      likes: [],
      reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [], cool: [] },
      sharesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      isShort,
    };

    this.db.posts = this.db.posts.filter((p) => p.id !== newPost.id);
    this.db.posts.unshift(newPost);
    this.persist();
    return newPost;
  }

  public recordView(postId: string): { viewsCount: number } {
    const post = this.db.posts.find((p) => p.id === postId);
    if (post) {
      post.viewsCount = (post.viewsCount || 0) + 1;
      this.persist();
      return { viewsCount: post.viewsCount };
    }
    return { viewsCount: 1 };
  }

  public ensurePostForVideo(video: {
    id: string;
    title: string;
    creatorName?: string;
    thumbnailUrl?: string;
    originalVideoUrl?: string;
    platform?: string;
    duration?: string;
    isShort?: boolean;
  }): ServerPost {
    let post = this.db.posts.find((p) => p.id === video.id || (video.originalVideoUrl && p.originalVideoUrl === video.originalVideoUrl));
    if (!post) {
      post = {
        id: video.id,
        authorId: 'usr_creator_' + (video.creatorName || 'creator').replace(/\s+/g, '_').toLowerCase(),
        author: {
          id: 'usr_creator_' + (video.creatorName || 'creator').replace(/\s+/g, '_').toLowerCase(),
          name: video.creatorName || 'Creator',
          handle: '@' + (video.creatorName || 'creator').replace(/\s+/g, '').toLowerCase(),
          avatar: video.thumbnailUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
          isVerified: true,
          platform: (video.platform as any) || 'youtube',
        },
        content: video.title,
        media: [
          {
            id: 'med_' + video.id,
            type: 'video',
            url: video.originalVideoUrl || '',
            thumbnailUrl: video.thumbnailUrl,
            aspectRatio: video.isShort ? '9:16' : '16:9',
            duration: video.duration,
          },
        ],
        createdAt: 'Recently',
        privacy: 'public',
        platform: (video.platform as any) || 'youtube',
        youtubeVideoId: video.id.startsWith('yt_') ? video.id.replace('yt_', '') : video.id,
        originalVideoUrl: video.originalVideoUrl,
        isShort: !!video.isShort,
        likes: [],
        reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [], cool: [] },
        sharesCount: 0,
        commentsCount: 0,
        viewsCount: 1,
      };
      this.db.posts.push(post);
      this.persist();
    }
    return post;
  }

  public deletePost(postId: string, userId: string): boolean {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) return false;

    // Check ownership or admin
    const user = this.db.users[userId];
    const isOwner = post.authorId === userId || post.author.id === userId || user?.role === 'owner' || user?.role === 'admin';
    if (!isOwner) return false;

    const idx = this.db.posts.findIndex((p) => p.id === postId);
    if (idx !== -1) {
      this.db.posts.splice(idx, 1);
      delete this.db.comments[postId];
      this.persist();
      return true;
    }
    return false;
  }

  public reactPost(postId: string, userId: string, reaction: string | null): ServerPost | null {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) return null;

    if (!post.reactions) {
      post.reactions = { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [], cool: [] };
    }
    if (!post.likes) post.likes = [];

    // Remove user from all reaction buckets (Enforce 1 reaction per user!)
    for (const rType of Object.keys(post.reactions)) {
      post.reactions[rType] = post.reactions[rType].filter((id) => id !== userId);
    }
    post.likes = post.likes.filter((id) => id !== userId);

    // Apply new reaction if provided (backward-compatible with existing 7-reaction posts)
    if (reaction) {
      if (!post.reactions[reaction]) {
        post.reactions[reaction] = [];
      }
      post.reactions[reaction].push(userId);
      post.likes.push(userId);

      // Notify post author
      const reactor = this.db.users[userId];
      if (reactor && post.authorId !== userId) {
        this.createNotification({
          userId: post.authorId,
          actorId: userId,
          actor: { id: reactor.id, name: reactor.name, handle: reactor.handle, avatar: reactor.avatar },
          type: 'reaction',
          title: 'New Reaction',
          message: `${reactor.name} reacted to your post.`,
          targetId: post.id,
        });
      }
    }

    this.persist();
    return post;
  }

  public trackShare(postId: string): ServerPost | null {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) return null;
    post.sharesCount = (post.sharesCount || 0) + 1;
    this.persist();
    return post;
  }

  // --- Comments & Replies Operations ---
  public getComments(postId: string): ServerComment[] {
    return this.db.comments[postId] || [];
  }

  public addComment(postId: string, author: ServerComment['author'], text: string): ServerComment | null {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) return null;

    if (!this.db.comments[postId]) {
      this.db.comments[postId] = [];
    }

    const comment: ServerComment = {
      id: `cmt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      postId,
      author,
      text: text.trim(),
      createdAt: 'Just now',
      likes: [],
      replies: [],
    };

    this.db.comments[postId].push(comment);

    // Recalculate commentsCount
    const allComments = this.db.comments[postId];
    post.commentsCount = allComments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

    // Notify post author
    if (post.authorId !== author.id) {
      this.createNotification({
        userId: post.authorId,
        actorId: author.id,
        actor: { id: author.id, name: author.name, handle: author.handle, avatar: author.avatar },
        type: 'comment',
        title: 'New Comment',
        message: `${author.name} commented on your post: "${text.slice(0, 40)}..."`,
        targetId: post.id,
      });
    }

    this.persist();
    return comment;
  }

  public addReply(postId: string, commentId: string, author: ServerCommentReply['author'], text: string): ServerCommentReply | null {
    const post = this.db.posts.find((p) => p.id === postId);
    const comments = this.db.comments[postId];
    if (!post || !comments) return null;

    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return null;

    if (!comment.replies) comment.replies = [];

    const reply: ServerCommentReply = {
      id: `rep_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      commentId,
      author,
      text: text.trim(),
      createdAt: 'Just now',
      likes: [],
    };

    comment.replies.push(reply);

    // Recalculate commentsCount
    post.commentsCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

    // Notify comment author
    if (comment.author.id !== author.id) {
      this.createNotification({
        userId: comment.author.id,
        actorId: author.id,
        actor: { id: author.id, name: author.name, handle: author.handle, avatar: author.avatar },
        type: 'reply',
        title: 'New Reply',
        message: `${author.name} replied to your comment: "${text.slice(0, 40)}..."`,
        targetId: post.id,
      });
    }

    this.persist();
    return reply;
  }

  public toggleCommentLike(postId: string, commentId: string, replyId: string | undefined, userId: string): boolean {
    const comments = this.db.comments[postId];
    if (!comments) return false;

    const comment = comments.find((c) => c.id === commentId);
    if (!comment) return false;

    if (replyId && comment.replies) {
      const reply = comment.replies.find((r) => r.id === replyId);
      if (!reply) return false;
      if (!reply.likes) reply.likes = [];
      const hasLiked = reply.likes.includes(userId);
      if (hasLiked) {
        reply.likes = reply.likes.filter((id) => id !== userId);
      } else {
        reply.likes.push(userId);
      }
    } else {
      if (!comment.likes) comment.likes = [];
      const hasLiked = comment.likes.includes(userId);
      if (hasLiked) {
        comment.likes = comment.likes.filter((id) => id !== userId);
      } else {
        comment.likes.push(userId);
      }
    }

    this.persist();
    return true;
  }

  public deleteComment(postId: string, commentId: string, replyId: string | undefined, userId: string): boolean {
    const post = this.db.posts.find((p) => p.id === postId);
    const comments = this.db.comments[postId];
    if (!post || !comments) return false;

    if (replyId) {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment || !comment.replies) return false;
      const idx = comment.replies.findIndex((r) => r.id === replyId && r.author.id === userId);
      if (idx === -1) return false;
      comment.replies.splice(idx, 1);
    } else {
      const idx = comments.findIndex((c) => c.id === commentId && c.author.id === userId);
      if (idx === -1) return false;
      comments.splice(idx, 1);
    }

    post.commentsCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
    this.persist();
    return true;
  }

  // --- Strict 24-Hour Stories (Section 13) ---
  public getActiveStories(): ServerStory[] {
    this.cleanupExpiredStories();
    return this.db.stories || [];
  }

  public addStory(data: {
    authorId: string;
    author: ServerStory['author'];
    mediaUrl: string;
    mediaType: 'photo' | 'video';
    caption?: string;
  }): ServerStory {
    const now = Date.now();
    const story: ServerStory = {
      id: `story_${now}_${crypto.randomBytes(3).toString('hex')}`,
      authorId: data.authorId,
      author: data.author,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      caption: data.caption,
      createdAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000, // Strictly 24 hours
      views: [],
      reactions: {},
    };

    if (!this.db.stories) this.db.stories = [];
    this.db.stories.unshift(story);
    this.persist();
    return story;
  }

  public viewStory(storyId: string, userId: string): boolean {
    const story = (this.db.stories || []).find((s) => s.id === storyId);
    if (!story) return false;
    if (!story.views.includes(userId)) {
      story.views.push(userId);
      this.persist();
    }
    return true;
  }

  private cleanupExpiredStories() {
    const now = Date.now();
    if (this.db.stories) {
      const active = this.db.stories.filter((s) => s.expiresAt > now);
      if (active.length !== this.db.stories.length) {
        this.db.stories = active;
        this.persist();
      }
    }
  }

  // --- Notifications System (Section 8) ---
  public createNotification(data: {
    userId: string;
    actorId: string;
    actor: { id: string; name: string; handle: string; avatar: string };
    type: ServerNotification['type'];
    category?: ServerNotification['category'];
    title: string;
    message: string;
    targetId?: string;
  }): ServerNotification | null {
    if (data.userId === data.actorId) return null; // Never notify self

    if (!this.db.notifications) this.db.notifications = [];
    const now = Date.now();

    // Prevent duplicate notification within 60 seconds
    const existing = this.db.notifications.find(
      (n) =>
        n.userId === data.userId &&
        n.actorId === data.actorId &&
        n.type === data.type &&
        n.targetId === data.targetId &&
        now - n.createdAt < 60000
    );
    if (existing) return existing;

    const notif: ServerNotification = {
      id: `notif_${now}_${crypto.randomBytes(3).toString('hex')}`,
      userId: data.userId,
      actorId: data.actorId,
      actor: data.actor,
      type: data.type,
      category: data.category || 'motherland',
      title: data.title,
      message: data.message,
      targetId: data.targetId,
      read: false,
      createdAt: now,
    };

    this.db.notifications.unshift(notif);
    if (this.db.notifications.length > 500) {
      this.db.notifications = this.db.notifications.slice(0, 500);
    }
    this.persist();
    return notif;
  }

  public getNotifications(userId: string, category?: string): { notifications: ServerNotification[]; unreadCount: number } {
    if (!this.db.notifications) this.db.notifications = [];
    let list = this.db.notifications.filter((n) => n.userId === userId);

    if (category && category !== 'all') {
      list = list.filter((n) => n.category === category);
    }

    const unreadCount = list.filter((n) => !n.read).length;
    return { notifications: list.slice(0, 50), unreadCount };
  }

  public markNotificationRead(notifId: string, userId: string): boolean {
    const notif = (this.db.notifications || []).find((n) => n.id === notifId && n.userId === userId);
    if (notif) {
      notif.read = true;
      this.persist();
      return true;
    }
    return false;
  }

  public markAllNotificationsRead(userId: string): boolean {
    let changed = false;
    (this.db.notifications || []).forEach((n) => {
      if (n.userId === userId && !n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) this.persist();
    return true;
  }

  public deleteNotification(notifId: string, userId: string): boolean {
    if (!this.db.notifications) return false;
    const idx = this.db.notifications.findIndex((n) => n.id === notifId && n.userId === userId);
    if (idx !== -1) {
      this.db.notifications.splice(idx, 1);
      this.persist();
      return true;
    }
    return false;
  }

  // --- Universal Search Aggregator (Section 11) ---
  public searchMotherland(query: string): {
    users: ServerUser[];
    posts: ServerPost[];
    shorts: ServerPost[];
    videos: ServerPost[];
  } {
    const q = query.toLowerCase().trim();
    if (!q) return { users: [], posts: [], shorts: [], videos: [] };

    const matchingUsers = Object.values(this.db.users)
      .filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q) ||
          u.bio.toLowerCase().includes(q) ||
          u.location.toLowerCase().includes(q)
      )
      .slice(0, 10);

    const matchingPosts = this.db.posts
      .filter(
        (p) =>
          p.content.toLowerCase().includes(q) ||
          p.author.name.toLowerCase().includes(q) ||
          p.author.handle.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 20);

    const shorts = matchingPosts.filter((p) => p.isShort);
    const videos = matchingPosts.filter((p) => !p.isShort && p.media.some((m) => m.type === 'video'));

    return {
      users: matchingUsers,
      posts: matchingPosts,
      shorts,
      videos,
    };
  }

  // Autocomplete Suggestions
  public getSearchSuggestions(query: string): string[] {
    const q = query.toLowerCase().trim();
    if (!q || q.length < 2) return [];

    const suggestions = new Set<string>();

    // Suggest matching user names/handles
    Object.values(this.db.users).forEach((u) => {
      if (u.name.toLowerCase().startsWith(q)) suggestions.add(u.name);
      if (u.handle.toLowerCase().includes(q)) suggestions.add(u.handle);
    });

    // Suggest matching tags or topics
    this.db.posts.forEach((p) => {
      p.tags?.forEach((t) => {
        if (t.toLowerCase().startsWith(q)) suggestions.add(`#${t}`);
      });
      // Match keywords in post titles
      if (p.content.toLowerCase().includes(q)) {
        const words = p.content.split(/\s+/);
        const match = words.find((w) => w.toLowerCase().startsWith(q));
        if (match && match.length > 2) suggestions.add(match.replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, ''));
      }
    });

    // Common curated Bangladeshi search terms
    const popularTopics = [
      'Bangladesh beautiful places',
      'Bangladesh cricket tigers match highlights',
      'Coke Studio Bangla top songs',
      'Sajek Valley cloud scenery',
      'Sundarbans documentary',
      'Coxs Bazar sea beach',
      'Dhaka street food review',
      'Bangla new natok 2026',
      'Bangla tech AI gadget review',
    ];

    popularTopics.forEach((t) => {
      if (t.toLowerCase().includes(q)) suggestions.add(t);
    });

    return Array.from(suggestions).slice(0, 8);
  }
}

export const dbManager = new DatabaseManager();
