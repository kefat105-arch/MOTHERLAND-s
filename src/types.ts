/**
 * MOTHERLAND Super App - Core Data Types & Platform Definitions
 */

export type PlatformSource = 'motherland' | 'youtube' | 'instagram' | 'tiktok' | 'facebook';

export type FieldPrivacyVisibility = 'public' | 'friends' | 'only_me';

export interface UserPrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  showOnlineStatus: boolean;
  showLastSeen?: boolean;
  showReadReceipts?: boolean;
  allowDirectMessages: 'everyone' | 'friends' | 'none';
  allowCalls?: 'everyone' | 'friends' | 'none';
  showContactInfo: boolean;
  dobVisibility?: FieldPrivacyVisibility;
  genderVisibility?: FieldPrivacyVisibility;
  contactVisibility?: FieldPrivacyVisibility;
}

export interface NotificationPreferences {
  messages: boolean;
  calls: boolean;
  friends: boolean;
  posts: boolean;
  videos: boolean;
  groups: boolean;
}

export interface TranslationPreferences {
  enabled: boolean;
  targetLang: string;
}

export type RelationshipStatus =
  | 'self'
  | 'friend'
  | 'pending_sent'
  | 'pending_received'
  | 'blocked'
  | 'none';

export interface LoginActivityItem {
  id: string;
  userId: string;
  method: 'password' | 'google' | 'register' | 'recovery' | 'refresh' | 'reactivate' | 'switch';
  deviceName: string;
  ipAddress?: string;
  status: 'success' | 'failed';
  createdAt: string;
}

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
  createdAt?: string;
  isVerified?: boolean;
  role?: 'owner' | 'admin' | 'user';
  email?: string;
  phoneNumber?: string;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  hasPassword?: boolean;
  googleConnected?: boolean;
  googleEmail?: string;
  authProvider?: 'password' | 'google';
  authProviders?: ('password' | 'google' | 'phone' | 'email')[];
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  isPrivate?: boolean;
  deactivated?: boolean;
  deactivatedAt?: string;
  twoFactorEnabled?: boolean;
  friendsCount: number;
  followersCount: number;
  followingCount: number;
  postsCount?: number;
  videosCount?: number;
  smallVideosCount?: number;
  privacy: UserPrivacySettings;
  notificationPrefs?: NotificationPreferences;
  translationPrefs?: TranslationPreferences;
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
  parentId?: string;
  userId: string;
  userDisplayName: string;
  userUsername: string;
  userAvatar: string;
  text: string;
  createdAt: string;
  isEdited?: boolean;
  editedAt?: string;
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
  categoryId?: string;
  categoryLabel?: string;
  subcategory?: string;
  language?: 'bn' | 'en' | 'global';
  audience: 'public' | 'friends' | 'only_me';
  createdAt: string;
  isEdited?: boolean;
  editedAt?: string;
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
  durationSeconds?: number;
  aspectRatio?: string;
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
  clientOAuthReady?: boolean;
  googleClientId?: string | null;
  redirectUri?: string;
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
  email?: string;
  phoneNumber?: string;
  password: string;
  dateOfBirth: string;
  otpCode?: string;
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
  refreshToken?: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  user: UserProfile;
  sessionId?: string;
  reactivated?: boolean;
  message?: string;
}

export interface DeviceSessionInfo {
  id: string;
  deviceName: string;
  userAgent?: string;
  ipAddress?: string;
  authMethod?: 'password' | 'google' | 'register' | 'switch' | 'legacy' | 'reactivate' | 'recovery';
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  refreshExpiresAt?: string;
  isCurrent: boolean;
}

export interface MediaAssetRecord {
  id: string;
  ownerId: string;
  originalFilename: string;
  storedFilename: string;
  url: string;
  storageKey?: string;
  bucket?: string;
  visibility?: 'public' | 'private';
  conversationId?: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageProvider: 'local_persistent' | 'external_object_storage' | 'supabase_s3';
  createdAt: string;
  updatedAt: string;
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

export type ManagedServiceDomain =
  | 'main_app'
  | 'video'
  | 'messaging'
  | 'calls'
  | 'bd_services'
  | 'dream_world';

export interface ServerRegistryEntry {
  id: string;
  name: string;
  baseUrl: string;
  healthPath?: string;
  wsUrl?: string;
  environment?: 'production' | 'staging' | 'local' | 'isolated_game';
  assignedServices: ManagedServiceDomain[];
  enabled: boolean;
  isPrimary: boolean;
  isolated?: boolean;
  lastHealthStatus?: 'healthy' | 'degraded' | 'offline' | 'unknown';
  lastLatencyMs?: number | null;
  lastCheckedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerSwitchHistoryEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | 'set_primary' | 'rollback' | 'toggle' | 'health_check' | 'chat_command';
  serverId: string;
  serverName: string;
  previousPrimaryId?: string;
  newPrimaryId?: string;
  actorId: string;
  actorUsername: string;
  summary: string;
  createdAt: string;
}

export interface AdminConfigChatMessage {
  id: string;
  role: 'owner' | 'system';
  senderId?: string;
  senderName?: string;
  text: string;
  parsedIntent?: {
    action: string;
    targetServerId?: string;
    url?: string;
    requiresConfirmation?: boolean;
    confirmed?: boolean;
  };
  createdAt: string;
}

export type BangladeshServiceCategoryId =
  | 'gov_nid_passport'
  | 'education'
  | 'utilities'
  | 'mfs'
  | 'banking'
  | 'loan_financing'
  | 'health_emergency'
  | 'transport_ticketing'
  | 'jobs_career'
  | 'postal_weather';

export interface BangladeshServiceItem {
  id: string;
  category: BangladeshServiceCategoryId;
  titleEn: string;
  titleBn: string;
  providerEn: string;
  providerBn: string;
  descriptionBn: string;
  descriptionEn: string;
  url: string;
  domain: string;
  badgeType: 'official_gov' | 'verified_operator' | 'central_bank' | 'emergency';
  requiresLogin: boolean;
  officialFeeInfo: string;
  hotline?: string;
  requiresAdult?: boolean;
  allowIframe?: boolean;
  keywords: string[];
}

export type GameCategoryFilter =
  | 'all'
  | 'multiplayer'
  | 'social'
  | 'casual'
  | 'coming_soon';

export interface GameCatalogEntry {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: 'multiplayer' | 'social' | 'casual' | 'coming_soon';
  badge: string;
  status: 'playable' | 'coming_soon';
  supportedCapacities?: number[];
}

export type LiveSpyCapacity = 6 | 8;

export type LiveSpyPhase =
  | 'waiting'
  | 'countdown'
  | 'role_reveal'
  | 'clue'
  | 'discussion'
  | 'voting'
  | 'elimination'
  | 'winner';

export interface LiveSpyPlayerSeat {
  userId: string;
  displayName: string;
  username: string;
  avatar: string;
  seatIndex: number;
  cameraOn: boolean;
  micMuted: boolean;
  alive: boolean;
  clueSubmitted: boolean;
  hasVoted: boolean;
  readyToVote: boolean;
  wantsPlayAgain: boolean;
  revealedRole?: 'spy' | 'citizen';
}

export interface LiveSpyClueItem {
  round: number;
  userId: string;
  displayName: string;
  seatIndex: number;
  clue: string;
  createdAt: string;
}

export interface LiveSpyChatItem {
  id: string;
  userId: string;
  displayName: string;
  avatar: string;
  text: string;
  createdAt: string;
}

export interface LiveSpyVoteTallyEntry {
  targetUserId: string;
  displayName: string;
  votes: number;
}

export interface LiveSpyEliminationSummary {
  round: number;
  eliminatedUserId: string | null;
  eliminatedName: string | null;
  revealedRole: 'spy' | 'citizen' | null;
  reason: 'majority' | 'tie' | 'no_votes';
}

export interface LiveSpyFinalReveal {
  spyUserId: string;
  spyDisplayName: string;
  category: string;
  secretWord: string;
}

export interface LiveSpyPublicState {
  roomId: string;
  matchId: string;
  capacity: LiveSpyCapacity;
  phase: LiveSpyPhase;
  locked: boolean;
  countdownSec: number;
  round: number;
  category: string;
  phaseEndsAt: number | null;
  serverTime: number;
  players: LiveSpyPlayerSeat[];
  clues: LiveSpyClueItem[];
  messages: LiveSpyChatItem[];
  voteTally: LiveSpyVoteTallyEntry[];
  eliminatedThisRound: LiveSpyEliminationSummary | null;
  winner: 'citizens' | 'spy' | null;
  finalReveal: LiveSpyFinalReveal | null;
}

export interface LiveSpySecretAssignment {
  roomId: string;
  matchId: string;
  role: 'spy' | 'citizen';
  category: string;
  secretWord: string | null;
  instruction: string;
}

export type RecommendationLearningStage =
  | 'initial_discovery'
  | 'early_learning'
  | 'personalization'
  | 'continuous_adaptation';

export type RecommendationSignalType =
  | 'watch_progress'
  | 'complete'
  | 'replay'
  | 'like'
  | 'comment'
  | 'share'
  | 'save'
  | 'follow'
  | 'search'
  | 'skip'
  | 'not_interested'
  | 'hide_creator'
  | 'reduce_category';

export interface UserRecommendationProfile {
  userId: string;
  categoryScores: Record<string, number>;
  subcategoryScores: Record<string, number>;
  creatorScores: Record<string, number>;
  keywordScores: Record<string, number>;
  languageScores: Record<string, number>;
  searchInterests: string[];
  hiddenCreators: string[];
  reducedCategories: string[];
  notInterestedIds: string[];
  skippedIds: string[];
  replayedIds: string[];
  totalSignals: number;
  learningStage: RecommendationLearningStage;
  updatedAt: string;
}

export interface RecommendationSignalPayload {
  signalType: RecommendationSignalType;
  videoId?: string;
  postId?: string;
  creatorId?: string;
  creatorName?: string;
  categoryId?: string;
  subcategory?: string;
  title?: string;
  tags?: string[];
  language?: 'bn' | 'en' | 'global';
  watchSeconds?: number;
  durationSeconds?: number;
  searchQuery?: string;
}

export interface ActiveFeedVideoState {
  activeVideoId: string;
  currentFeedItemId: string;
  activeSource: 'youtube' | 'motherland';
  isPlaying: boolean;
  isPaused: boolean;
  hasStarted: boolean;
  ended: boolean;
  currentPlaybackTime: number;
  playbackDuration: number;
  currentScrollPosition: number;
  currentQueuePosition: number;
  updatedAt: number;
}

