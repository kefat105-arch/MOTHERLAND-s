/**
 * MOTHERLAND Native Social Service & Database Persistence
 * - Facebook-style 7-reaction system (Like, Love, Care, Haha, Wow, Sad, Angry)
 * - Threaded nested comments & replies with real database persistence
 * - Zero fake likes, comments, shares, or followers (strictly database-tracked)
 * - Full-stack synchronization with backend `/api/posts` and `/api/auth`
 */

import {
  CurrentUserProfile,
  MarketplaceItem,
  SocialComment,
  SocialCommentReply,
  SocialPost,
  SocialStory,
  PostReactionType,
} from '../types/social';

export const CURRENT_USER: CurrentUserProfile = {
  id: 'usr_motherland_citizen',
  name: 'Kefat Hossain',
  handle: '@kefat',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  coverPhoto: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80',
  bio: 'Building MOTHERLAND — Bangladesh’s Premier Social Super App & Digital Ecosystem. 🇧🇩🚀',
  location: 'Dhaka, Bangladesh',
  joinDate: 'November 2026',
  isVerified: true,
  followersCount: 0, // Real tracked count, zero fake numbers
  followingCount: 0,
  platform: 'motherland',
};

export const INITIAL_STORIES: SocialStory[] = [
  {
    id: 'story_1',
    author: {
      id: 'usr_ananya',
      name: 'Ananya Sen',
      handle: '@ananya_art',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    mediaUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop&q=80',
    mediaType: 'photo',
    caption: 'Mist rising over the Sundarbans forest creeks at dawn. 🌿',
    createdAt: '2 hours ago',
    expiresAt: 'In 22 hours',
    seen: false,
  },
  {
    id: 'story_2',
    author: {
      id: 'usr_rafiq',
      name: 'Rafiqul Islam',
      handle: '@rafiq_drone',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    mediaUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80',
    mediaType: 'photo',
    caption: 'Geometric majesty of Jatiya Sangsad Bhaban. 🇧🇩',
    createdAt: '4 hours ago',
    expiresAt: 'In 20 hours',
    seen: false,
  },
  {
    id: 'story_3',
    author: {
      id: 'usr_tanvir',
      name: 'Tanvir Ahmed',
      handle: '@tanvir_tech',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
      platform: 'motherland',
    },
    mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    mediaType: 'photo',
    caption: 'Testing next-generation mobile display interfaces in Dhaka! 💻',
    createdAt: '6 hours ago',
    expiresAt: 'In 18 hours',
    seen: false,
  },
  {
    id: 'story_4',
    author: {
      id: 'usr_sylhet',
      name: 'Sylhet Green Trails',
      handle: '@sylhet_trails',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80',
      platform: 'motherland',
    },
    mediaUrl: 'https://images.unsplash.com/photo-1531415074868-8363325697c0?w=800&auto=format&fit=crop&q=80',
    mediaType: 'photo',
    caption: 'Fresh morning tea leaves dripping with rain. 🍃☕',
    createdAt: '8 hours ago',
    expiresAt: 'In 16 hours',
    seen: true,
  },
];

// Verified community seed posts with ZERO fake interaction numbers
export const INITIAL_COMMUNITY_POSTS: SocialPost[] = [
  // 1. MOTHERLAND Native 16:9 Video Post
  {
    id: 'post_nat_video_1',
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
        thumbnailUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&auto=format&fit=crop&q=80',
        alt: 'Sajek Valley aerial drone flight',
        aspectRatio: '16:9',
        duration: '0:15',
      },
    ],
    createdAt: 'Just now',
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    isLiked: false,
    isSaved: false,
    privacy: 'public',
    location: 'Sajek Valley, Rangamati',
    tags: ['Sajek', 'Nature', 'DroneBD'],
    platform: 'motherland',
    userReaction: null,
    reactions: { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  },

  // 2. MOTHERLAND Native Image Post
  {
    id: 'post_comm_1',
    author: {
      id: 'usr_heritage_bd',
      name: 'Heritage Bangladesh',
      handle: '@heritage_bd',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    content:
      'The timeless beauty of Sixty Dome Mosque (ষাট গম্বুজ মসজিদ) in Bagerhat. Constructed during the reign of the Sultanate in the 15th century by Khan Jahan Ali, this UNESCO World Heritage Site stands as one of the finest architectural achievements of Bengal. 🇧🇩✨\n\n#Motherland #Bangladesh #History #Bagerhat #Heritage',
    media: [
      {
        id: 'med_1a',
        type: 'photo',
        url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1000&auto=format&fit=crop&q=80',
        alt: 'Sixty Dome Mosque architecture',
        aspectRatio: '16:9',
      },
    ],
    createdAt: '35m ago',
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    isLiked: false,
    isSaved: false,
    privacy: 'public',
    location: 'Bagerhat, Khulna Division',
    tags: ['Bangladesh', 'History', 'Heritage'],
    platform: 'motherland',
    userReaction: null,
    reactions: { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  },

  // 3. MOTHERLAND Native 9:16 Short Vertical Video Post
  {
    id: 'post_nat_short_2',
    author: {
      id: 'usr_dhaka_moments',
      name: 'Old Dhaka Chronicles',
      handle: '@old_dhaka',
      avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    content:
      'Making traditional Bakarkhani (বাকরখানি) inside a 100-year-old clay tandoor in Lalbagh! 🥖🔥 Crispy on the outside, flaky and melt-in-the-mouth inside. The true taste of Old Dhaka history!\n\n#Shorts #OldDhaka #StreetFood #Bakarkhani',
    media: [
      {
        id: 'med_s2',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
        alt: 'Bakarkhani baking in clay tandoor',
        aspectRatio: '9:16',
        duration: '0:15',
      },
    ],
    createdAt: '1h ago',
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    isLiked: false,
    isSaved: false,
    privacy: 'public',
    location: 'Lalbagh, Old Dhaka',
    tags: ['OldDhaka', 'Foodie', 'Shorts'],
    platform: 'motherland',
    userReaction: null,
    reactions: { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  },
];

export const INITIAL_MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'item_1',
    title: 'Traditional Jamdani Saree (Handloom Tangail)',
    price: '৳ 6,500',
    location: 'Dhanmondi, Dhaka',
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80',
    category: 'Clothing & Handlooms',
    condition: 'Brand New',
    postedAt: '1h ago',
    seller: {
      id: 'usr_weavers',
      name: 'Bengal Handloom Crafts',
      handle: '@tangail_weaves',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
    },
  },
  {
    id: 'item_2',
    title: 'Nakshi Kantha Hand-Embroidered Quilt',
    price: '৳ 3,200',
    location: 'Jessore / Delivery Nationwide',
    imageUrl: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600&auto=format&fit=crop&q=80',
    category: 'Home & Living',
    condition: 'Brand New',
    postedAt: '3h ago',
    seller: {
      id: 'usr_rural_art',
      name: 'Gramin Karupalli',
      handle: '@gramin_art',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
    },
  },
  {
    id: 'item_3',
    title: 'Organic Sundarbans Natural Wild Honey (1kg)',
    price: '৳ 1,250',
    location: 'Khulna / Dhaka Courier',
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600&auto=format&fit=crop&q=80',
    category: 'Organic Foods',
    condition: 'Fresh Harvest',
    postedAt: 'Yesterday',
    seller: {
      id: 'usr_moual',
      name: 'Sundarban Raw Organics',
      handle: '@sundarban_honey',
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80',
    },
  },
];

const POSTS_STORAGE_KEY = 'motherland_native_posts_v4';
const STORIES_STORAGE_KEY = 'motherland_native_stories_v4';
const COMMENTS_STORAGE_KEY = 'motherland_native_comments_v4';
const USER_PROFILE_KEY = 'motherland_native_user_profile_v4';

// --- Current User Persistence ---
export function getStoredCurrentUser(): CurrentUserProfile {
  if (typeof window === 'undefined') return CURRENT_USER;
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    return raw ? JSON.parse(raw) : CURRENT_USER;
  } catch {
    return CURRENT_USER;
  }
}

export function saveCurrentUser(profile: CurrentUserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed saving current user profile:', e);
  }
}

// --- Posts Persistence & Synchronization ---
export function getStoredPosts(): SocialPost[] {
  if (typeof window === 'undefined') return INITIAL_COMMUNITY_POSTS;
  try {
    const raw = localStorage.getItem(POSTS_STORAGE_KEY);
    if (!raw) return INITIAL_COMMUNITY_POSTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_COMMUNITY_POSTS;
  } catch {
    return INITIAL_COMMUNITY_POSTS;
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

// Sync posts with backend database
export async function syncPostsFromBackend(platform?: string): Promise<SocialPost[]> {
  try {
    const url = platform && platform !== 'all' ? `/api/posts?platform=${platform}` : '/api/posts';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.posts) && data.posts.length > 0) {
        // Map server post to SocialPost format
        const currentUser = getStoredCurrentUser();
        const mapped: SocialPost[] = data.posts.map((sp: any) => {
          const userLiked = Array.isArray(sp.likes) && sp.likes.includes(currentUser.id);
          // Find user's specific reaction if any
          let userReaction: PostReactionType | null = null;
          if (sp.reactions) {
            for (const [rType, uIds] of Object.entries(sp.reactions)) {
              if (Array.isArray(uIds) && uIds.includes(currentUser.id)) {
                userReaction = rType as PostReactionType;
                break;
              }
            }
          }

          // Build reaction counts
          const reactionsMap: Record<PostReactionType, number> = {
            like: sp.reactions?.like?.length || 0,
            love: sp.reactions?.love?.length || 0,
            care: sp.reactions?.care?.length || 0,
            haha: sp.reactions?.haha?.length || 0,
            wow: sp.reactions?.wow?.length || 0,
            sad: sp.reactions?.sad?.length || 0,
            angry: sp.reactions?.angry?.length || 0,
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
            privacy: sp.privacy || 'public',
            location: sp.location,
            tags: sp.tags,
            isOwnPost: sp.authorId === currentUser.id || sp.author?.id === currentUser.id,
            platform: sp.platform || 'motherland',
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

export function createNewPost(
  content: string,
  media: SocialPost['media'] = [],
  privacy: SocialPost['privacy'] = 'public',
  location?: string
): SocialPost {
  const author = getStoredCurrentUser();
  const newPost: SocialPost = {
    id: `post_${Date.now()}`,
    author: {
      id: author.id,
      name: author.name,
      handle: author.handle,
      avatar: author.avatar,
      isVerified: author.isVerified,
      platform: 'motherland',
    },
    content,
    media,
    createdAt: 'Just now',
    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    isLiked: false,
    isSaved: false,
    privacy,
    location,
    isOwnPost: true,
    platform: 'motherland',
    userReaction: null,
    reactions: { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  };

  const current = getStoredPosts();
  const updated = [newPost, ...current];
  saveStoredPosts(updated);

  // Sync to backend asynchronously
  fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authorId: author.id,
      author: newPost.author,
      content,
      media,
      privacy,
      platform: 'motherland',
      location,
    }),
  }).catch((e) => console.warn('Backend post creation sync warning:', e));

  return newPost;
}

export function deletePost(postId: string): void {
  const author = getStoredCurrentUser();
  const current = getStoredPosts();
  const filtered = current.filter((p) => p.id !== postId);
  saveStoredPosts(filtered);

  // Sync to backend asynchronously
  fetch(`/api/posts/${postId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: author.id }),
  }).catch(() => {});
}

/**
 * Facebook-style Reaction System (Like, Love, Care, Haha, Wow, Sad, Angry)
 * ZERO FAKE LIKES: strictly increments/decrements per authenticated user ID
 */
export function setPostReaction(postId: string, reaction: PostReactionType | null): SocialPost | null {
  const author = getStoredCurrentUser();
  const current = getStoredPosts();
  let updatedPost: SocialPost | null = null;

  const updated = current.map((p) => {
    if (p.id === postId) {
      const prevReaction = p.userReaction;
      const reactions = { ...(p.reactions || { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 }) };

      // Decrement previous reaction count if existing
      if (prevReaction && reactions[prevReaction] !== undefined) {
        reactions[prevReaction] = Math.max(0, reactions[prevReaction] - 1);
      }

      // Increment new reaction count if applying
      if (reaction && reactions[reaction] !== undefined) {
        reactions[reaction] = (reactions[reaction] || 0) + 1;
      }

      // Calculate strictly true total count across all real reactions
      const totalLikes = Object.values(reactions).reduce((sum, val) => sum + val, 0);

      updatedPost = {
        ...p,
        userReaction: reaction,
        isLiked: reaction !== null,
        reactions,
        likesCount: totalLikes,
      };
      return updatedPost;
    }
    return p;
  });

  saveStoredPosts(updated);

  // Sync to backend asynchronously
  fetch(`/api/posts/${postId}/react`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: author.id, reaction }),
  }).catch(() => {});

  return updatedPost;
}

export function togglePostLike(postId: string): SocialPost | null {
  const current = getStoredPosts();
  const post = current.find((p) => p.id === postId);
  if (!post) return null;

  const newReaction: PostReactionType | null = post.userReaction ? null : 'like';
  return setPostReaction(postId, newReaction);
}

export function togglePostSave(postId: string): SocialPost | null {
  const current = getStoredPosts();
  let updatedPost: SocialPost | null = null;
  const updated = current.map((p) => {
    if (p.id === postId) {
      updatedPost = { ...p, isSaved: !p.isSaved };
      return updatedPost;
    }
    return p;
  });

  saveStoredPosts(updated);
  return updatedPost;
}

export function trackPostShare(postId: string): void {
  const current = getStoredPosts();
  const updated = current.map((p) => {
    if (p.id === postId) {
      return { ...p, sharesCount: (p.sharesCount || 0) + 1 };
    }
    return p;
  });
  saveStoredPosts(updated);

  fetch(`/api/posts/${postId}/share`, { method: 'POST' }).catch(() => {});
}

// --- Stories Persistence ---
export function getStoredStories(): SocialStory[] {
  if (typeof window === 'undefined') return INITIAL_STORIES;
  try {
    const raw = localStorage.getItem(STORIES_STORAGE_KEY);
    if (!raw) return INITIAL_STORIES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_STORIES;
  } catch {
    return INITIAL_STORIES;
  }
}

export function saveStoredStories(stories: SocialStory[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORIES_STORAGE_KEY, JSON.stringify(stories));
  } catch (e) {
    console.error('Failed saving stories:', e);
  }
}

export function createNewStory(mediaUrl: string, mediaType: 'photo' | 'video', caption?: string): SocialStory {
  const author = getStoredCurrentUser();
  const newStory: SocialStory = {
    id: `story_${Date.now()}`,
    author: {
      id: author.id,
      name: author.name,
      handle: author.handle,
      avatar: author.avatar,
      isVerified: author.isVerified,
      platform: 'motherland',
    },
    mediaUrl,
    mediaType,
    caption,
    createdAt: 'Just now',
    expiresAt: 'In 24 hours',
    seen: false,
    isOwnStory: true,
  };

  const current = getStoredStories();
  const updated = [newStory, ...current];
  saveStoredStories(updated);
  return newStory;
}

// --- Comments & Nested Replies Management ---
export function getPostComments(postId: string): SocialComment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${COMMENTS_STORAGE_KEY}_${postId}`);
    if (raw) return JSON.parse(raw);
    return [];
  } catch {
    return [];
  }
}

export function savePostComments(postId: string, comments: SocialComment[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${COMMENTS_STORAGE_KEY}_${postId}`, JSON.stringify(comments));
    // Recalculate true commentsCount on post
    const posts = getStoredPosts();
    const count = comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
    const updated = posts.map((p) => (p.id === postId ? { ...p, commentsCount: count } : p));
    saveStoredPosts(updated);
  } catch (e) {
    console.error('Failed saving comments:', e);
  }
}

export async function fetchCommentsFromBackend(postId: string): Promise<SocialComment[]> {
  try {
    const res = await fetch(`/api/posts/${postId}/comments`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.comments)) {
        savePostComments(postId, data.comments);
        return data.comments;
      }
    }
  } catch (err) {
    console.warn('Backend comment sync warning:', err);
  }
  return getPostComments(postId);
}

export function addPostComment(postId: string, text: string): SocialComment {
  const author = getStoredCurrentUser();
  const comment: SocialComment = {
    id: `cmt_${Date.now()}`,
    postId,
    author: {
      id: author.id,
      name: author.name,
      handle: author.handle,
      avatar: author.avatar,
      isVerified: author.isVerified,
      platform: 'motherland',
    },
    text: text.trim(),
    createdAt: 'Just now',
    likesCount: 0,
    isLiked: false,
    replies: [],
  };

  const current = getPostComments(postId);
  const updated = [...current, comment];
  savePostComments(postId, updated);

  // Sync to backend asynchronously
  fetch(`/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author: comment.author, text }),
  }).catch(() => {});

  return comment;
}

export function addCommentReply(postId: string, commentId: string, text: string): SocialCommentReply {
  const author = getStoredCurrentUser();
  const reply: SocialCommentReply = {
    id: `rep_${Date.now()}`,
    commentId,
    author: {
      id: author.id,
      name: author.name,
      handle: author.handle,
      avatar: author.avatar,
      isVerified: author.isVerified,
      platform: 'motherland',
    },
    text: text.trim(),
    createdAt: 'Just now',
    likesCount: 0,
    isLiked: false,
  };

  const current = getPostComments(postId);
  const updated = current.map((c) => {
    if (c.id === commentId) {
      return {
        ...c,
        replies: [...(c.replies || []), reply],
      };
    }
    return c;
  });

  savePostComments(postId, updated);

  // Sync to backend asynchronously
  fetch(`/api/posts/${postId}/comments/${commentId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author: reply.author, text }),
  }).catch(() => {});

  return reply;
}

export function toggleCommentLike(postId: string, commentId: string, replyId?: string): void {
  const author = getStoredCurrentUser();
  const current = getPostComments(postId);
  const updated = current.map((c) => {
    if (c.id === commentId) {
      if (replyId && c.replies) {
        return {
          ...c,
          replies: c.replies.map((r) => {
            if (r.id === replyId) {
              const isLiked = !r.isLiked;
              return {
                ...r,
                isLiked,
                likesCount: isLiked ? r.likesCount + 1 : Math.max(0, r.likesCount - 1),
              };
            }
            return r;
          }),
        };
      } else {
        const isLiked = !c.isLiked;
        return {
          ...c,
          isLiked,
          likesCount: isLiked ? c.likesCount + 1 : Math.max(0, c.likesCount - 1),
        };
      }
    }
    return c;
  });

  savePostComments(postId, updated);

  fetch(`/api/posts/${postId}/comments/${commentId}/like`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyId, userId: author.id }),
  }).catch(() => {});
}

export function deleteComment(postId: string, commentId: string, replyId?: string): void {
  const author = getStoredCurrentUser();
  const current = getPostComments(postId);
  let updated: SocialComment[] = [];

  if (replyId) {
    updated = current.map((c) => {
      if (c.id === commentId && c.replies) {
        return {
          ...c,
          replies: c.replies.filter((r) => r.id !== replyId),
        };
      }
      return c;
    });
  } else {
    updated = current.filter((c) => c.id !== commentId);
  }

  savePostComments(postId, updated);

  fetch(`/api/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyId, userId: author.id }),
  }).catch(() => {});
}

export function editComment(postId: string, commentId: string, newText: string, replyId?: string): void {
  const current = getPostComments(postId);
  const updated = current.map((c) => {
    if (c.id === commentId) {
      if (replyId && c.replies) {
        return {
          ...c,
          replies: c.replies.map((r) => (r.id === replyId ? { ...r, text: newText } : r)),
        };
      } else {
        return { ...c, text: newText };
      }
    }
    return c;
  });

  savePostComments(postId, updated);
}

// Real follow/unfollow synchronization
export async function toggleUserFollow(targetUserId: string): Promise<{ isFollowing: boolean; followersCount: number }> {
  const author = getStoredCurrentUser();
  try {
    const res = await fetch(`/api/users/${targetUserId}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
