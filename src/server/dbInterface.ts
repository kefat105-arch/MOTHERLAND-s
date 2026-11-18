import type {
  UserProfile,
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
  ServerRegistryEntry,
  ServerSwitchHistoryEntry,
  AdminConfigChatMessage,
  UserRecommendationProfile,
  RecommendationSignalPayload,
} from '../types';
import type {
  UserAccount,
  Session,
  ReactionRecord,
  YouTubeOAuthRecord,
} from './db.ts';
import type { BackupMetadata, PersistencePaths } from './persistence.ts';

export interface DatabaseBackend {
  readonly driverName: 'postgres' | 'json';

  init(): Promise<void>;
  close(): Promise<void>;
  healthCheck(): Promise<{
    ok: boolean;
    driver: 'postgres' | 'json';
    latencyMs?: number;
    details?: string;
  }>;

  getPaths(): PersistencePaths;
  save(): Promise<void>;
  createBackup(reason?: string): Promise<BackupMetadata>;
  listBackups(): Promise<BackupMetadata[]>;
  getPersistenceHealth(): Promise<any>;

  // Users
  findUserById(id: string): Promise<UserAccount | undefined>;
  findUserByEmailOrUsername(identifier: string): Promise<UserAccount | undefined>;
  findUserByPhone(phone: string): Promise<UserAccount | undefined>;
  getAllUsers(): Promise<UserAccount[]>;
  createUser(account: UserAccount): Promise<UserAccount>;
  updateUser(id: string, updates: Partial<UserAccount>): Promise<UserAccount | undefined>;
  toPublicProfile(user: UserAccount, requestingUserId?: string, onlineUserIds?: Set<string>): Promise<UserProfile>;
  getUserNetworkLists(
    targetUserId: string,
    viewerId?: string,
    onlineUserIds?: Set<string>
  ): Promise<{ friends: UserProfile[]; supporters: UserProfile[]; supporting: UserProfile[] }>;
  touchUserLastActive(userId: string): Promise<void>;
  deleteUserAccount(userId: string): Promise<{ ok: boolean; error?: string }>;

  // Sessions
  createSession(
    userId: string,
    userAgent?: string,
    meta?: { ipAddress?: string; authMethod?: Session['authMethod'] }
  ): Promise<Session & { token: string; refreshToken: string }>;
  findSessionByToken(rawToken: string): Promise<Session | undefined>;
  findSessionByRefreshToken(rawRefreshToken: string): Promise<Session | undefined>;
  rotateSessionTokens(
    sessionId: string
  ): Promise<{ token: string; refreshToken: string; session: Session } | undefined>;
  getUserSessions(userId: string, currentRawToken?: string): Promise<DeviceSessionInfo[]>;
  revokeSessionById(userId: string, sessionId: string): Promise<{ ok: boolean; statusCode: number; error?: string }>;
  deleteSession(rawToken: string): Promise<boolean>;
  deleteUserSessionsExcept(userId: string, currentRawToken?: string): Promise<number>;
  deleteUserSessions(userId: string): Promise<void>;

  // Reactions & Saved Posts
  getPostReactions(postId: string): Promise<ReactionRecord[]>;
  getUserReaction(postId: string, userId: string): Promise<ReactionRecord | undefined>;
  toggleReaction(
    postId: string,
    userId: string,
    reactionType: ReactionType
  ): Promise<{ isLiked: boolean; reaction?: ReactionType; likesCount: number }>;
  isPostSaved(postId: string, userId: string): Promise<boolean>;
  toggleSavePost(postId: string, userId: string): Promise<boolean>;
  getUserSavedPostIds(userId: string): Promise<string[]>;

  // Posts & Feeds
  hydratePostForUser(post: Post, userId?: string): Promise<Post>;
  hydratePostsForUserBatch(posts: Post[], userId?: string): Promise<Post[]>;
  canViewerSeePost(viewerId: string | undefined, post: Post): Promise<boolean>;
  getScoredForYouPosts(viewerId?: string): Promise<Post[]>;
  getAllPosts(): Promise<Post[]>;
  findPostById(postId: string): Promise<Post | undefined>;
  addPost(post: Post): Promise<Post>;
  updatePost(
    postId: string,
    actorId: string,
    actorRole: UserAccount['role'] | undefined,
    updates: { content?: string; audience?: 'public' | 'friends' | 'only_me'; hashtags?: string[] }
  ): Promise<{ ok: boolean; statusCode: number; error?: string; post?: Post }>;
  deletePost(postId: string): Promise<boolean>;
  incrementPostShare(postId: string): Promise<number>;

  // Comments
  getComments(postId: string, viewerId?: string): Promise<any[]>;
  addComment(postId: string, comment: any): Promise<any>;
  editComment(
    postId: string,
    commentId: string,
    actorId: string,
    actorRole: UserAccount['role'] | undefined,
    text: string
  ): Promise<{ ok: boolean; statusCode: number; error?: string; comment?: any }>;
  deleteComment(
    postId: string,
    commentId: string,
    actorId: string,
    actorRole: UserAccount['role'] | undefined
  ): Promise<{ ok: boolean; statusCode: number; error?: string; totalComments?: number }>;
  toggleCommentLike(
    postId: string,
    commentId: string,
    userId: string
  ): Promise<{ ok: boolean; comment?: any; isLiked?: boolean; likesCount?: number }>;

  // Stories
  getActiveStories(nowMs?: number): Promise<Story[]>;
  addStory(story: Story): Promise<Story>;
  recordStoryView(storyId: string): Promise<void>;
  deleteStory(storyId: string): Promise<boolean>;
  expireStoriesOlderThan24hUtc(nowMs?: number): Promise<{
    expiredCount: number;
    activeCount: number;
    checkedAtUtc: string;
  }>;

  // Media Assets & Access Control
  registerMediaAsset(asset: MediaAssetRecord): Promise<MediaAssetRecord>;
  getMediaAsset(idOrFilename: string): Promise<MediaAssetRecord | undefined>;
  getUserMediaAssets(userId: string): Promise<MediaAssetRecord[]>;
  deleteOwnedMediaAsset(
    idOrFilename: string,
    actorUserId: string,
    actorRole?: UserAccount['role']
  ): Promise<{ ok: boolean; statusCode: number; error?: string; asset?: MediaAssetRecord }>;
  syncMediaVisibilityForUrls(
    urls: string[],
    ownerId: string,
    visibility: 'public' | 'private',
    conversationId?: string
  ): Promise<void>;
  canUserAccessMediaAsset(
    asset: MediaAssetRecord,
    viewerId?: string,
    viewerRole?: UserAccount['role']
  ): Promise<{ allowed: boolean; statusCode: number; reason?: string }>;

  // Shorts & Long Videos
  getShortVideos(): Promise<ShortVideo[]>;
  addShortVideo(short: ShortVideo): Promise<ShortVideo>;
  getLongVideos(): Promise<LongVideo[]>;
  addLongVideo(video: LongVideo): Promise<LongVideo>;

  // Friendships, Follows, Blocks
  getFriendIds(userId: string): Promise<string[]>;
  isFriend(userA: string, userB: string): Promise<boolean>;
  addFriendship(userA: string, userB: string): Promise<void>;
  removeFriendship(userA: string, userB: string): Promise<void>;
  getMutualFriendCount(userA: string, userB: string): Promise<number>;
  getRelationshipStatus(
    viewerId: string,
    targetId: string
  ): Promise<{ status: RelationshipStatus; requestId?: string }>;
  getFriendRequests(userId: string): Promise<FriendRequest[]>;
  getSentFriendRequests(userId: string): Promise<FriendRequest[]>;
  createFriendRequestSafe(
    senderId: string,
    receiverId: string
  ): Promise<{ request?: FriendRequest; error?: string; autoAccepted?: boolean; alreadyPending?: boolean }>;
  respondFriendRequest(
    requestId: string,
    action: 'accept' | 'reject' | 'cancel',
    actingUserId?: string
  ): Promise<{ ok: boolean; error?: string; request?: FriendRequest }>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  getUserFollowingIds(userId: string): Promise<string[]>;
  follow(followerId: string, followingId: string): Promise<boolean>;
  unfollow(followerId: string, followingId: string): Promise<boolean>;
  isBlocked(userId: string, targetUserId: string): Promise<boolean>;
  toggleBlock(userId: string, targetUserId: string): Promise<boolean>;
  getBlockedUserIds(userId: string): Promise<string[]>;
  getSuggestedFriends(userId: string): Promise<UserProfile[]>;

  // Notifications
  getNotifications(userId: string, category?: string): Promise<NotificationItem[]>;
  addNotification(notif: NotificationItem & { recipientId: string; category?: string }): Promise<void>;
  markNotificationsRead(userId: string, notificationId?: string): Promise<void>;
  deleteNotification(userId: string, notificationId: string): Promise<void>;

  // OTP
  setOtp(identifier: string, code: string, type: 'register' | 'phone_verify' | 'forgot_password'): Promise<void>;
  verifyOtp(identifier: string, code: string, type: 'register' | 'phone_verify' | 'forgot_password'): Promise<boolean>;

  // YouTube OAuth
  getYouTubeOAuth(userId: string): Promise<YouTubeOAuthRecord | undefined>;
  setYouTubeOAuth(userId: string, record: YouTubeOAuthRecord): Promise<YouTubeOAuthRecord>;
  deleteYouTubeOAuth(userId: string): Promise<boolean>;

  // Wave Conversations & Messages
  isConversationParticipant(conv: Conversation, userId: string): boolean;
  getConversationById(conversationId: string): Promise<Conversation | undefined>;
  getUserConversations(userId: string, onlineUserIds?: Set<string>): Promise<Conversation[]>;
  getTotalUnreadMessages(userId: string): Promise<number>;
  getOrCreateDirectConversation(
    userId: string,
    targetUserId: string,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; error?: string; statusCode?: number }>;
  respondConversationRequest(
    conversationId: string,
    userId: string,
    action: 'accept' | 'decline',
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; recipientIds?: string[]; error?: string; statusCode?: number }>;
  createGroupConversation(
    creatorId: string,
    name: string,
    memberIds: string[],
    photo?: string,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; error?: string; statusCode?: number }>;
  addGroupMembers(
    conversationId: string,
    actorId: string,
    memberIds: string[],
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; addedIds?: string[]; systemMessage?: ChatMessage; error?: string; statusCode?: number }>;
  removeGroupMember(
    conversationId: string,
    actorId: string,
    targetUserId: string,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; systemMessage?: ChatMessage; error?: string; statusCode?: number }>;
  setGroupAdmin(
    conversationId: string,
    actorId: string,
    targetUserId: string,
    makeAdmin: boolean,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; error?: string; statusCode?: number }>;
  leaveGroupConversation(
    conversationId: string,
    userId: string
  ): Promise<{ ok: boolean; remainingIds?: string[]; systemMessage?: ChatMessage; error?: string; statusCode?: number }>;
  updateConversationSettings(
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
  ): Promise<{ conversation?: Conversation; broadcastMeta?: boolean; error?: string; statusCode?: number }>;
  getConversationMessages(
    conversationId: string,
    userId: string,
    beforeId?: string,
    limit?: number
  ): Promise<{ messages?: ChatMessage[]; hasMore?: boolean; error?: string; statusCode?: number }>;
  markConversationRead(
    conversationId: string,
    userId: string
  ): Promise<{ ok: boolean; error?: string; statusCode?: number; participantIds?: string[]; sendReceipt?: boolean }>;
  addChatMessage(
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
  ): Promise<{ message?: ChatMessage; conversation?: Conversation; recipientIds?: string[]; error?: string; statusCode?: number }>;
  editChatMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    newText: string
  ): Promise<{ message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number }>;
  deleteChatMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    mode?: 'me' | 'everyone'
  ): Promise<{ message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number }>;
  toggleChatReaction(
    conversationId: string,
    msgId: string,
    userId: string,
    emoji: string
  ): Promise<{ message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number }>;
  togglePinChatMessage(
    conversationId: string,
    msgId: string,
    userId: string
  ): Promise<{ message?: ChatMessage; pinnedMessageIds?: string[]; recipientIds?: string[]; error?: string; statusCode?: number }>;
  searchConversationMessages(
    conversationId: string,
    userId: string,
    query: string
  ): Promise<{ messages?: ChatMessage[]; error?: string; statusCode?: number }>;
  getConversationSharedMedia(
    conversationId: string,
    userId: string
  ): Promise<{ items?: ChatMessage[]; links?: { messageId: string; url: string; senderName: string; createdAt: string }[]; error?: string; statusCode?: number }>;

  // Calls
  addCallRecord(record: CallRecord): Promise<CallRecord>;
  updateCallRecord(callId: string, updates: Partial<CallRecord>): Promise<CallRecord | undefined>;
  getCallRecordById(callId: string): Promise<CallRecord | undefined>;
  getUserCalls(userId: string): Promise<CallRecord[]>;

  // Drafts, Saved Videos, Watch History
  getUserDrafts(userId: string): Promise<DraftPost[]>;
  saveDraft(draft: DraftPost): Promise<DraftPost>;
  deleteDraft(draftId: string, userId: string): Promise<boolean>;
  getUserSavedVideos(userId: string): Promise<SavedVideoItem[]>;
  toggleSaveVideo(
    userId: string,
    item: Omit<SavedVideoItem, 'id' | 'userId' | 'savedAt'>
  ): Promise<{ isSaved: boolean; savedVideos: SavedVideoItem[] }>;
  upsertWatchProgress(
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
  ): Promise<WatchHistoryRecord>;
  getSuppressedVideoIds(userId: string | undefined, suppressionDays?: number): Promise<Set<string>>;
  getUserWatchHistory(userId: string): Promise<WatchHistoryRecord[]>;
  removeWatchHistoryItem(userId: string, videoId: string): Promise<boolean>;
  getUserInterestKeywords(userId?: string): Promise<string[]>;

  // Reports
  addUserReport(report: UserReport): Promise<UserReport>;

  // Server Registry & Admin Chat
  getServers(): Promise<ServerRegistryEntry[]>;
  getServerById(id: string): Promise<ServerRegistryEntry | undefined>;
  recordServerHistory(entry: Omit<ServerSwitchHistoryEntry, 'id' | 'createdAt'>): Promise<ServerSwitchHistoryEntry>;
  getServerHistory(): Promise<ServerSwitchHistoryEntry[]>;
  upsertServer(
    payload: Partial<ServerRegistryEntry> & { id?: string; name: string; baseUrl: string },
    actor: UserAccount
  ): Promise<ServerRegistryEntry>;
  updateServerHealth(
    id: string,
    status: 'healthy' | 'degraded' | 'offline',
    latencyMs: number | null
  ): Promise<ServerRegistryEntry | undefined>;
  setPrimaryServer(
    id: string,
    actor: UserAccount
  ): Promise<{ ok: boolean; error?: string; server?: ServerRegistryEntry; previousPrimaryId?: string }>;
  rollbackPrimaryServer(actor: UserAccount): Promise<{ ok: boolean; error?: string; server?: ServerRegistryEntry }>;
  deleteServer(id: string, actor: UserAccount): Promise<{ ok: boolean; error?: string }>;
  getAdminConfigMessages(): Promise<AdminConfigChatMessage[]>;
  addAdminConfigMessage(msg: AdminConfigChatMessage): Promise<AdminConfigChatMessage>;

  // BD Services
  getBdServicePrefs(userId: string): Promise<{ favorites: string[]; recent: string[] }>;
  toggleBdServiceFavorite(userId: string, serviceId: string): Promise<{ favorites: string[]; isFavorite: boolean }>;
  recordBdServiceRecent(userId: string, serviceId: string): Promise<string[]>;

  // Personalized Recommendations
  getRecommendationProfile(userId?: string): Promise<UserRecommendationProfile | null>;
  recordRecommendationSignal(
    userId: string,
    payload: RecommendationSignalPayload
  ): Promise<UserRecommendationProfile>;
}
