/**
 * MOTHERLAND Super App - Core Data Types & Platform Definitions
 */

export type PlatformSource = 'motherland' | 'youtube' | 'instagram' | 'tiktok' | 'facebook';

export interface UserPrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  showOnlineStatus: boolean;
  showLastSeen?: boolean;
  showReadReceipts?: boolean;
  allowDirectMessages: 'everyone' | 'friends' | 'none';
  allowCalls?: 'everyone' | 'friends' | 'none';
  showContactInfo: boolean;
}

export interface NotificationPreferences {
  messages: boolean;
  calls: boolean;
  friends: boolean;
  posts: boolean;
  videos: boolean;
  groups: boolean;
}

export type RelationshipStatus =
  | 'self'
  | 'friend'
  | 'pending_sent'
  | 'pending_received'
  | 'blocked'
  | 'none';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  coverImage: string;
  bio: string;
  website?: string;
  location?: string;
  work?: string;
  education?: string;
  joinedDate: string;
  isVerified?: boolean;
  role?: 'owner' | 'admin' | 'user';
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  isPrivate?: boolean;
  twoFactorEnabled?: boolean;
  friendsCount: number;
  followersCount: number;
  followingCount: number;
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
  relationshipStatus?: RelationshipStatus;
  pendingRequestId?: string;
  mutualFriendsCount?: number;
  isOnline?: boolean;
}


export type ReactionType = 'like' | 'love' | 'care' | 'haha' | 'wow' | 'sad' | 'angry' | 'cool' | 'fire';

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  userDisplayName: string;
  userUsername: string;
  userAvatar: string;
  text: string;
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
  replies?: PostComment[];
}

export interface SharedPostSnapshot {
  id: string;
  source: PlatformSource;
  externalId?: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    isVerified?: boolean;
  };
  content: string;
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;
  images?: string[];
  thumbnailUrl?: string;
  createdAt: string;
}

export interface Post {
  id: string;
  source: PlatformSource;
  externalId?: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    isVerified?: boolean;
    channelTitle?: string;
  };
  content: string;
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;
  images?: string[];
  mediaAspectRatio?: '1:1' | '4:5' | '16:9' | '9:16' | 'original';
  videoDuration?: string;
  thumbnailUrl?: string;
  sharedPost?: SharedPostSnapshot;
  hashtags: string[];
  audience: 'public' | 'friends' | 'only_me';
  createdAt: string;
  stats: {
    likes: number;
    comments: number;
    shares: number;
    views?: number;
  };
  userInteractions?: {
    isLiked?: boolean;
    reaction?: ReactionType;
    isSaved?: boolean;
    isShared?: boolean;
  };
  originalUrl?: string;
}

export interface Story {
  id: string;
  userId: string;
  userDisplayName: string;
  userUsername: string;
  userAvatar: string;
  isUserVerified?: boolean;
  source: PlatformSource;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  createdAt: string;
  expiresAt: string;
  viewersCount: number;
  isViewed?: boolean;
  isOwn?: boolean;
}

export interface ShortVideo {
  id: string;
  source: PlatformSource;
  videoUrl: string;
  youtubeId?: string;
  thumbnailUrl: string;
  title: string;
  caption: string;
  hashtags: string[];
  creator: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    isVerified?: boolean;
    isFollowing?: boolean;
  };
  stats: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  userInteractions?: {
    isLiked?: boolean;
    isSaved?: boolean;
  };
  createdAt: string;
}

export interface LongVideo {
  id: string;
  source: PlatformSource;
  youtubeId?: string;
  videoUrl?: string;
  thumbnailUrl: string;
  title: string;
  description: string;
  duration: string;
  isLive?: boolean;
  liveViewers?: number;
  channel: {
    id: string;
    title: string;
    avatar: string;
    subscriberCount?: string;
    isVerified?: boolean;
  };
  stats: {
    views: number;
    likes: number;
    comments: number;
  };
  publishedAt: string;
  tags?: string[];
  commentsDisabled?: boolean;
  userInteractions?: {
    isLiked?: boolean;
    isSubscribed?: boolean;
  };
}

export interface YouTubeOAuthChannel {
  id: string;
  title: string;
  avatar: string;
  subscriberCount?: string;
  customUrl?: string;
}

export interface YouTubeOAuthStatus {
  oauthConfigured: boolean;
  missingEnvVars?: string[];
  callbackUrl: string;
  connected: boolean;
  status: 'connected' | 'not_connected' | 'not_configured' | 'expired';
  channel?: YouTubeOAuthChannel | null;
  scopes?: string[];
  connectedAt?: string;
  message?: string;
}

export interface YouTubeUploadResult {
  success: boolean;
  videoId?: string;
  url?: string;
  title?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  thumbnailUploaded?: boolean;
  error?: string;
  message?: string;
}

export interface YouTubeCommentThread {
  id: string;
  authorDisplayName: string;
  authorProfileImageUrl: string;
  authorChannelUrl?: string;
  textDisplay: string;
  likeCount: number;
  publishedAt: string;
  updatedAt?: string;
  totalReplyCount: number;
  replies?: YouTubeCommentThread[];
}

export interface FriendRequest {
  id: string;
  sender: UserProfile;
  receiverId: string;
  recipient?: UserProfile;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  createdAt: string;
}

export interface ChatReplySnapshot {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
}

export interface ChatAttachment {
  url: string;
  mediaType: 'image' | 'video' | 'audio' | 'file';
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  audioDuration?: number;
  audioWaveform?: number[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'file';
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  attachments?: ChatAttachment[];
  audioDuration?: number;
  audioWaveform?: number[];
  replyTo?: ChatReplySnapshot;
  forwardedFrom?: {
    messageId: string;
    senderName: string;
  };
  reactions?: Record<string, string[]>;
  isEdited?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  deletedForIds?: string[];
  isPinned?: boolean;
  messageType?: 'text' | 'system' | 'call';
  deliveredTo?: string[];
  expiresAt?: string;
  createdAt: string;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  isGroup: boolean;
  name?: string;
  photo?: string;
  creatorId?: string;
  adminIds?: string[];
  pinnedMessageIds?: string[];
  disappearingSeconds?: number;
  isRequest?: boolean;
  requestStatus?: 'pending' | 'accepted' | 'declined';
  requestedBy?: string;
  archivedBy?: string[];
  mutedBy?: string[];
  pinnedBy?: string[];
  isArchived?: boolean;
  isMuted?: boolean;
  isPinned?: boolean;
  participantIds?: string[];
  participants: UserProfile[];
  lastMessage?: ChatMessage;
  lastReadAtByUser?: Record<string, string>;
  unreadCount: number;
  updatedAt: string;
}

export interface CallRecord {
  id: string;
  conversationId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  calleeIds: string[];
  calleeName?: string;
  calleeAvatar?: string;
  callType: 'audio' | 'video';
  isGroupCall: boolean;
  status: 'ringing' | 'connected' | 'ended' | 'declined' | 'missed' | 'busy' | 'failed';
  durationSeconds: number;
  createdAt: string;
  endedAt?: string;
}

export interface DraftPost {
  id: string;
  userId: string;
  mode: 'post' | 'story' | 'short';
  content: string;
  shortTitle?: string;
  mediaType?: 'image' | 'video' | 'none';
  mediaUrl?: string;
  images?: string[];
  hashtags?: string[];
  audience?: 'public' | 'friends' | 'only_me';
  updatedAt: string;
  createdAt: string;
}

export interface SavedVideoItem {
  id: string;
  userId: string;
  videoId: string;
  videoType: 'long' | 'short';
  source: PlatformSource;
  youtubeId?: string;
  title: string;
  thumbnailUrl: string;
  channelTitle: string;
  channelAvatar?: string;
  duration?: string;
  videoUrl?: string;
  savedAt: string;
}

export interface WatchHistoryRecord {
  userId: string;
  videoId: string;
  youtubeId?: string;
  videoType: 'long' | 'short';
  source: PlatformSource;
  title: string;
  thumbnailUrl: string;
  channelTitle: string;
  duration?: string;
  watchSeconds: number;
  durationSeconds: number;
  completed: boolean;
  meaningfulView: boolean;
  firstViewedAt: string;
  lastViewedAt: string;
}

export interface UserReport {
  id: string;
  reporterId: string;
  targetUserId?: string;
  targetConversationId?: string;
  targetMessageId?: string;
  reason: string;
  details?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type:
    | 'friend_request'
    | 'friend_accept'
    | 'follow'
    | 'like'
    | 'comment'
    | 'mention'
    | 'platform_alert'
    | 'system'
    | 'call_missed'
    | 'message_request'
    | 'group_invite'
    | 'wave_message';
  category?: 'motherland' | 'youtube' | 'google' | 'facebook' | 'instagram' | 'wave';
  sender: {
    id: string;
    displayName: string;
    avatar: string;
    username: string;
  };
  title: string;
  body: string;
  targetId?: string; // postId, conversationId, userId, callId
  targetType?: 'post' | 'profile' | 'chat' | 'call' | 'group';
  isRead: boolean;
  createdAt: string;
}

export interface RegisterPayload {
  fullName: string;
  username: string;
  email: string;
  password: string;
  dateOfBirth: string;
  phoneNumber?: string;
  gender?: string;
  address?: string;
  bio?: string;
  website?: string;
  avatar?: string;
  coverImage?: string;
}

export interface LoginPayload {
  identifier: string; // email, username, or phone
  password: string;
}

export interface AuthResult {
  token: string;
  user: UserProfile;
  message?: string;
}


export type PlatformConnectionStatus =
  | 'Connected'
  | 'Not Connected'
  | 'Permission Required'
  | 'Processing'
  | 'Failed'
  | 'Coming Soon';

export interface PlatformAdapterInfo {
  platform: PlatformSource;
  name: string;
  icon: string;
  color: string;
  status: PlatformConnectionStatus;
  statusMessage: string;
  canPublish: boolean;
  canReadFeed: boolean;
  featuresSupported: string[];
}

export interface PublishingJob {
  id: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  platforms: {
    platform: PlatformSource;
    status: 'Published' | 'Processing' | 'Failed' | 'Not Connected' | 'Permission Required';
    error?: string;
  }[];
  createdAt: string;
}
