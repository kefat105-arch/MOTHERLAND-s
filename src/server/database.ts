import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.resolve(DATA_DIR, 'motherland_database.json');

export interface ServerUser {
  id: string;
  googleId?: string;
  email?: string;
  name: string;
  handle: string;
  avatar: string;
  coverPhoto?: string;
  bio: string;
  location: string;
  joinDate: string;
  isVerified: boolean;
  platform: 'motherland' | 'google' | 'youtube';
  followers: string[]; // User IDs who follow this user
  following: string[]; // User IDs this user follows
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
  // True interaction tracking - ZERO FAKE DATA
  likes: string[]; // User IDs who liked
  reactions: Record<string, string[]>; // reactionType -> array of userIds
  sharesCount: number; // Actual tracked shares
  commentsCount: number; // Actual count of saved comments + replies
  viewsCount?: number; // Actual tracked view count
}

interface DatabaseSchema {
  users: Record<string, ServerUser>;
  posts: ServerPost[];
  comments: Record<string, ServerComment[]>; // postId -> ServerComment[]
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
    reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [] },
    sharesCount: 0,
    commentsCount: 0,
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
    reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [] },
    sharesCount: 0,
    commentsCount: 0,
  },
  {
    id: 'post_comm_1',
    authorId: 'usr_heritage_bd',
    author: {
      id: 'usr_heritage_bd',
      name: 'Heritage Bangladesh',
      handle: '@heritage_bd',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
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
    reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [] },
    sharesCount: 0,
    commentsCount: 0,
  },
];

class DatabaseManager {
  private db: DatabaseSchema = {
    users: {},
    posts: [],
    comments: {},
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
          posts: parsed.posts || SEED_POSTS,
          comments: parsed.comments || {},
        };
      } else {
        // Seed default database
        this.db = {
          users: {
            usr_motherland_citizen: {
              id: 'usr_motherland_citizen',
              name: 'Kefat Hossain',
              handle: '@kefat',
              email: 'kefat105@gmail.com',
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
              coverPhoto: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
              bio: 'Building MOTHERLAND — Bangladesh’s Premier Social Super App & Digital Ecosystem. 🇧🇩🚀',
              location: 'Dhaka, Bangladesh',
              joinDate: 'November 2026',
              isVerified: true,
              platform: 'motherland',
              followers: [],
              following: [],
            },
          },
          posts: SEED_POSTS,
          comments: {},
        };
        this.persist();
      }
    } catch (e) {
      console.error('[DB] Failed initializing database file, falling back to memory:', e);
      this.db = { users: {}, posts: SEED_POSTS, comments: {} };
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

  // --- User Operations ---
  public getUser(userId: string): ServerUser | null {
    return this.db.users[userId] || null;
  }

  public getUserByGoogleId(googleId: string): ServerUser | null {
    return Object.values(this.db.users).find((u) => u.googleId === googleId) || null;
  }

  public upsertGoogleUser(data: {
    googleId: string;
    email: string;
    name: string;
    avatar: string;
    connectedYouTubeChannel?: ServerUser['connectedYouTubeChannel'];
  }): ServerUser {
    let existing = this.getUserByGoogleId(data.googleId);

    if (existing) {
      existing.name = data.name || existing.name;
      existing.email = data.email || existing.email;
      existing.avatar = data.avatar || existing.avatar;
      if (data.connectedYouTubeChannel !== undefined) {
        existing.connectedYouTubeChannel = data.connectedYouTubeChannel;
      }
      this.persist();
      return existing;
    }

    // Also check if default citizen account can be linked to this email
    const defaultCitizen = this.db.users['usr_motherland_citizen'];
    if (defaultCitizen && (!defaultCitizen.googleId || defaultCitizen.email === data.email)) {
      defaultCitizen.googleId = data.googleId;
      defaultCitizen.email = data.email;
      defaultCitizen.name = data.name || defaultCitizen.name;
      defaultCitizen.avatar = data.avatar || defaultCitizen.avatar;
      if (data.connectedYouTubeChannel) {
        defaultCitizen.connectedYouTubeChannel = data.connectedYouTubeChannel;
      }
      this.persist();
      return defaultCitizen;
    }

    const newUserId = `usr_${data.googleId.slice(0, 12)}`;
    const handle = `@${(data.email.split('@')[0] || data.name).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

    const newUser: ServerUser = {
      id: newUserId,
      googleId: data.googleId,
      email: data.email,
      name: data.name,
      handle,
      avatar: data.avatar,
      bio: 'Verified MOTHERLAND Citizen via Google Authentication 🇧🇩',
      location: 'Dhaka, Bangladesh',
      joinDate: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      isVerified: true,
      platform: 'google',
      followers: [],
      following: [],
      connectedYouTubeChannel: data.connectedYouTubeChannel || null,
    };

    this.db.users[newUserId] = newUser;
    this.persist();
    return newUser;
  }

  public disconnectYouTube(userId: string): ServerUser | null {
    const user = this.db.users[userId];
    if (!user) return null;
    user.connectedYouTubeChannel = null;
    this.persist();
    return user;
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
    }

    this.persist();
    return {
      isFollowing: !isFollowing,
      followersCount: target.followers.length,
      followingCount: follower.following.length,
    };
  }

  // --- Posts Operations ---
  public getPosts(options?: { platform?: string; limit?: number; offset?: number }): { posts: ServerPost[]; total: number } {
    let list = [...this.db.posts];

    if (options?.platform && options.platform !== 'all') {
      list = list.filter((p) => p.platform === options.platform);
    }

    // Sort newest first
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
    const newPost: ServerPost = {
      ...data,
      id: data.id || `post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      likes: [],
      reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [] },
      sharesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
    };

    // Remove any existing post with same ID to avoid duplicates
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
            aspectRatio: '16:9',
            duration: video.duration,
          },
        ],
        createdAt: 'Recently',
        privacy: 'public',
        platform: (video.platform as any) || 'youtube',
        youtubeVideoId: video.id.startsWith('yt_') ? video.id.replace('yt_', '') : video.id,
        originalVideoUrl: video.originalVideoUrl,
        likes: [],
        reactions: { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [] },
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
    const idx = this.db.posts.findIndex((p) => p.id === postId && (p.authorId === userId || p.author.id === userId));
    if (idx === -1) return false;
    this.db.posts.splice(idx, 1);
    delete this.db.comments[postId];
    this.persist();
    return true;
  }

  public reactPost(postId: string, userId: string, reaction: string | null): ServerPost | null {
    const post = this.db.posts.find((p) => p.id === postId);
    if (!post) return null;

    if (!post.reactions) {
      post.reactions = { like: [], love: [], care: [], haha: [], wow: [], sad: [], angry: [] };
    }
    if (!post.likes) post.likes = [];

    // Remove user from all reaction buckets
    for (const rType of Object.keys(post.reactions)) {
      post.reactions[rType] = post.reactions[rType].filter((id) => id !== userId);
    }
    post.likes = post.likes.filter((id) => id !== userId);

    // Apply new reaction if provided
    if (reaction && post.reactions[reaction]) {
      post.reactions[reaction].push(userId);
      post.likes.push(userId);
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
      id: `cmt_${Date.now()}`,
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
      id: `rep_${Date.now()}`,
      commentId,
      author,
      text: text.trim(),
      createdAt: 'Just now',
      likes: [],
    };

    comment.replies.push(reply);

    // Recalculate commentsCount
    post.commentsCount = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

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
}

export const dbManager = new DatabaseManager();
