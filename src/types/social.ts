/**
 * MOTHERLAND Native Social Media Network Types
 * - Real multi-platform post structures
 * - Facebook-style 7-reaction system (Like, Love, Care, Haha, Wow, Sad, Angry)
 * - Threaded nested comments & replies
 */

export type PostPrivacy = 'public' | 'friends' | 'only_me';

export type PostReactionType = 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry' | 'cool';

export interface AuthorProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  isVerified?: boolean;
  role?: string;
  platform?: 'motherland' | 'youtube' | 'tiktok' | 'facebook' | 'instagram';
}

export interface PostMedia {
  id: string;
  type: 'photo' | 'video';
  url: string;
  thumbnailUrl?: string;
  alt?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
  duration?: string;
}

export interface SocialCommentReply {
  id: string;
  commentId: string;
  author: AuthorProfile;
  text: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
}

export interface SocialComment {
  id: string;
  postId: string;
  author: AuthorProfile;
  text: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
  replies?: SocialCommentReply[];
}

export interface SocialPost {
  id: string;
  author: AuthorProfile;
  content: string;
  media: PostMedia[];
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isLiked: boolean;
  isSaved: boolean;
  privacy: PostPrivacy;
  location?: string;
  tags?: string[];
  isOwnPost?: boolean;
  platform?: 'motherland' | 'youtube' | 'tiktok' | 'facebook' | 'instagram';
  userReaction?: PostReactionType | null;
  reactions?: Record<PostReactionType, number>;
  // For mixed YouTube items in the feed
  youtubeVideoId?: string;
  originalVideoUrl?: string;
}

export interface SocialStory {
  id: string;
  author: AuthorProfile;
  mediaUrl: string;
  mediaType: 'photo' | 'video';
  caption?: string;
  createdAt: string;
  expiresAt: string;
  seen: boolean;
  isOwnStory?: boolean;
}

export interface CurrentUserProfile extends AuthorProfile {
  email?: string;
  phone?: string;
  coverPhoto: string;
  bio: string;
  location: string;
  website?: string;
  gender?: string;
  dob?: string;
  joinDate: string;
  role?: 'user' | 'owner' | 'admin';
  followersCount: number;
  followingCount: number;
  friendsCount?: number;
  isEmailVerified?: boolean;
  isOwner?: boolean;
}

export interface UserRelationship {
  isSelf: boolean;
  isFriend: boolean;
  requestSent: boolean;
  requestReceived: boolean;
  isFollowing: boolean;
}

export interface MotherlandNotification {
  id: string;
  userId: string;
  actorId: string;
  actor: AuthorProfile;
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

export type SocialNavTab = 'home' | 'friends' | 'videos' | 'marketplace' | 'notifications' | 'menu';

export interface MarketplaceItem {
  id: string;
  title: string;
  price: string;
  location: string;
  imageUrl: string;
  seller: AuthorProfile;
  category: string;
  condition: string;
  postedAt: string;
}

