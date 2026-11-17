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
} from '../types';
import {
  MotherlandDatabase,
  UserAccount,
  Session,
  ReactionRecord,
  YouTubeOAuthRecord,
} from './db.ts';
import type { DatabaseBackend } from './dbInterface.ts';
import type { BackupMetadata, PersistencePaths } from './persistence.ts';

/**
 * Async wrapper around the existing local JSON MotherlandDatabase.
 * Used automatically only when DATABASE_URL is not configured (e.g., local preview).
 */
export class MotherlandJsonAdapter implements DatabaseBackend {
  public readonly driverName = 'json' as const;
  private inner: MotherlandDatabase;

  constructor(customPaths?: PersistencePaths) {
    this.inner = new MotherlandDatabase(customPaths);
  }

  public async init(): Promise<void> {
    // Constructor already executes load() & non-destructive migrations synchronously.
  }

  public async close(): Promise<void> {
    this.inner.save();
  }

  public async healthCheck(): Promise<{
    ok: boolean;
    driver: 'postgres' | 'json';
    latencyMs?: number;
    details?: string;
  }> {
    return {
      ok: true,
      driver: 'json',
      latencyMs: 0,
      details: 'Local JSON persistence active (DATABASE_URL not configured).',
    };
  }

  public getPaths(): PersistencePaths {
    return this.inner.getPaths();
  }

  public async save(): Promise<void> {
    this.inner.save();
  }

  public async createBackup(reason = 'manual'): Promise<BackupMetadata> {
    return this.inner.createBackup(reason);
  }

  public async listBackups(): Promise<BackupMetadata[]> {
    return this.inner.listBackups();
  }

  public async getPersistenceHealth(): Promise<any> {
    return {
      driver: 'json',
      ...this.inner.getPersistenceHealth(),
    };
  }

  public async findUserById(id: string): Promise<UserAccount | undefined> {
    return this.inner.findUserById(id);
  }

  public async findUserByEmailOrUsername(identifier: string): Promise<UserAccount | undefined> {
    return this.inner.findUserByEmailOrUsername(identifier);
  }

  public async findUserByPhone(phone: string): Promise<UserAccount | undefined> {
    return this.inner.findUserByPhone(phone);
  }

  public async getAllUsers(): Promise<UserAccount[]> {
    return this.inner.getAllUsers();
  }

  public async createUser(account: UserAccount): Promise<UserAccount> {
    return this.inner.createUser(account);
  }

  public async updateUser(id: string, updates: Partial<UserAccount>): Promise<UserAccount | undefined> {
    return this.inner.updateUser(id, updates);
  }

  public async toPublicProfile(
    user: UserAccount,
    requestingUserId?: string,
    onlineUserIds?: Set<string>
  ): Promise<UserProfile> {
    return this.inner.toPublicProfile(user, requestingUserId, onlineUserIds);
  }

  public async getUserNetworkLists(
    targetUserId: string,
    viewerId?: string,
    onlineUserIds?: Set<string>
  ): Promise<{ friends: UserProfile[]; supporters: UserProfile[]; supporting: UserProfile[] }> {
    return this.inner.getUserNetworkLists(targetUserId, viewerId, onlineUserIds);
  }

  public async touchUserLastActive(userId: string): Promise<void> {
    this.inner.touchUserLastActive(userId);
  }

  public async deleteUserAccount(userId: string): Promise<{ ok: boolean; error?: string }> {
    return this.inner.deleteUserAccount(userId);
  }

  public async createSession(
    userId: string,
    userAgent?: string,
    meta?: { ipAddress?: string; authMethod?: Session['authMethod'] }
  ): Promise<Session & { token: string }> {
    return this.inner.createSession(userId, userAgent, meta);
  }

  public async findSessionByToken(rawToken: string): Promise<Session | undefined> {
    return this.inner.findSessionByToken(rawToken);
  }

  public async getUserSessions(userId: string, currentRawToken?: string): Promise<DeviceSessionInfo[]> {
    return this.inner.getUserSessions(userId, currentRawToken);
  }

  public async revokeSessionById(
    userId: string,
    sessionId: string
  ): Promise<{ ok: boolean; statusCode: number; error?: string }> {
    return this.inner.revokeSessionById(userId, sessionId);
  }

  public async deleteSession(rawToken: string): Promise<boolean> {
    return this.inner.deleteSession(rawToken);
  }

  public async deleteUserSessionsExcept(userId: string, currentRawToken?: string): Promise<number> {
    return this.inner.deleteUserSessionsExcept(userId, currentRawToken);
  }

  public async deleteUserSessions(userId: string): Promise<void> {
    this.inner.deleteUserSessions(userId);
  }

  public async getPostReactions(postId: string): Promise<ReactionRecord[]> {
    return this.inner.getPostReactions(postId);
  }

  public async getUserReaction(postId: string, userId: string): Promise<ReactionRecord | undefined> {
    return this.inner.getUserReaction(postId, userId);
  }

  public async toggleReaction(
    postId: string,
    userId: string,
    reactionType: ReactionType
  ): Promise<{ isLiked: boolean; reaction?: ReactionType; likesCount: number }> {
    return this.inner.toggleReaction(postId, userId, reactionType);
  }

  public async isPostSaved(postId: string, userId: string): Promise<boolean> {
    return this.inner.isPostSaved(postId, userId);
  }

  public async toggleSavePost(postId: string, userId: string): Promise<boolean> {
    return this.inner.toggleSavePost(postId, userId);
  }

  public async getUserSavedPostIds(userId: string): Promise<string[]> {
    return this.inner.getUserSavedPostIds(userId);
  }

  public async hydratePostForUser(post: Post, userId?: string): Promise<Post> {
    return this.inner.hydratePostForUser(post, userId);
  }

  public async hydratePostsForUserBatch(posts: Post[], userId?: string): Promise<Post[]> {
    return posts.map((p) => this.inner.hydratePostForUser(p, userId));
  }

  public async canViewerSeePost(viewerId: string | undefined, post: Post): Promise<boolean> {
    return this.inner.canViewerSeePost(viewerId, post);
  }

  public async getScoredForYouPosts(viewerId?: string): Promise<Post[]> {
    return this.inner.getScoredForYouPosts(viewerId);
  }

  public async getAllPosts(): Promise<Post[]> {
    return this.inner.getAllPosts();
  }

  public async findPostById(postId: string): Promise<Post | undefined> {
    return this.inner.getAllPosts().find((p) => p.id === postId);
  }

  public async addPost(post: Post): Promise<Post> {
    const saved = this.inner.addPost(post);
    const urls = [post.mediaUrl, ...(post.images || [])].filter((u): u is string => Boolean(u && u.startsWith('/uploads/')));
    if (urls.length > 0 && post.audience !== 'public') {
      await this.syncMediaVisibilityForUrls(urls, post.author.id, 'private');
    }
    return saved;
  }

  public async updatePost(
    postId: string,
    actorId: string,
    actorRole: UserAccount['role'] | undefined,
    updates: { content?: string; audience?: 'public' | 'friends' | 'only_me'; hashtags?: string[] }
  ): Promise<{ ok: boolean; statusCode: number; error?: string; post?: Post }> {
    const res = this.inner.updatePost(postId, actorId, actorRole, updates);
    if (res.ok && res.post && updates.audience) {
      const urls = [res.post.mediaUrl, ...(res.post.images || [])].filter((u): u is string =>
        Boolean(u && u.startsWith('/uploads/'))
      );
      if (urls.length > 0) {
        await this.syncMediaVisibilityForUrls(urls, res.post.author.id, updates.audience === 'public' ? 'public' : 'private');
      }
    }
    return res;
  }

  public async deletePost(postId: string): Promise<boolean> {
    return this.inner.deletePost(postId);
  }

  public async incrementPostShare(postId: string): Promise<number> {
    return this.inner.incrementPostShare(postId);
  }

  public async getComments(postId: string, viewerId?: string): Promise<any[]> {
    return this.inner.getComments(postId, viewerId);
  }

  public async addComment(postId: string, comment: any): Promise<any> {
    return this.inner.addComment(postId, comment);
  }

  public async editComment(
    postId: string,
    commentId: string,
    actorId: string,
    actorRole: UserAccount['role'] | undefined,
    text: string
  ): Promise<{ ok: boolean; statusCode: number; error?: string; comment?: any }> {
    return this.inner.editComment(postId, commentId, actorId, actorRole, text);
  }

  public async deleteComment(
    postId: string,
    commentId: string,
    actorId: string,
    actorRole: UserAccount['role'] | undefined
  ): Promise<{ ok: boolean; statusCode: number; error?: string; totalComments?: number }> {
    return this.inner.deleteComment(postId, commentId, actorId, actorRole);
  }

  public async toggleCommentLike(
    postId: string,
    commentId: string,
    userId: string
  ): Promise<{ ok: boolean; comment?: any; isLiked?: boolean; likesCount?: number }> {
    return this.inner.toggleCommentLike(postId, commentId, userId);
  }

  public async getActiveStories(nowMs = Date.now()): Promise<Story[]> {
    return this.inner.getActiveStories(nowMs);
  }

  public async addStory(story: Story): Promise<Story> {
    return this.inner.addStory(story);
  }

  public async recordStoryView(storyId: string): Promise<void> {
    const story = this.inner.getActiveStories().find((s) => s.id === storyId);
    if (story) {
      story.isViewed = true;
      story.viewersCount += 1;
      this.inner.save();
    }
  }

  public async deleteStory(storyId: string): Promise<boolean> {
    return this.inner.deleteStory(storyId);
  }

  public async expireStoriesOlderThan24hUtc(nowMs = Date.now()) {
    return this.inner.expireStoriesOlderThan24hUtc(nowMs);
  }

  public async registerMediaAsset(asset: MediaAssetRecord): Promise<MediaAssetRecord> {
    return this.inner.registerMediaAsset(asset);
  }

  public async getMediaAsset(idOrFilename: string): Promise<MediaAssetRecord | undefined> {
    return this.inner.getMediaAsset(idOrFilename);
  }

  public async getUserMediaAssets(userId: string): Promise<MediaAssetRecord[]> {
    return this.inner.getUserMediaAssets(userId);
  }

  public async deleteOwnedMediaAsset(
    idOrFilename: string,
    actorUserId: string,
    actorRole?: UserAccount['role']
  ): Promise<{ ok: boolean; statusCode: number; error?: string; asset?: MediaAssetRecord }> {
    return this.inner.deleteOwnedMediaAsset(idOrFilename, actorUserId, actorRole);
  }

  public async syncMediaVisibilityForUrls(
    urls: string[],
    ownerId: string,
    visibility: 'public' | 'private',
    conversationId?: string
  ): Promise<void> {
    let changed = false;
    for (const url of urls) {
      const asset = this.inner.getMediaAsset(url);
      if (asset && asset.ownerId === ownerId) {
        asset.visibility = visibility;
        if (conversationId) asset.conversationId = conversationId;
        asset.updatedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) this.inner.save();
  }

  public async canUserAccessMediaAsset(
    asset: MediaAssetRecord,
    viewerId?: string,
    viewerRole?: UserAccount['role']
  ): Promise<{ allowed: boolean; statusCode: number; reason?: string }> {
    if (asset.visibility !== 'private' && !asset.conversationId) {
      return { allowed: true, statusCode: 200 };
    }
    if (!viewerId) {
      return { allowed: false, statusCode: 401, reason: 'Authentication required to access private media.' };
    }
    if (asset.ownerId === viewerId || viewerRole === 'owner') {
      return { allowed: true, statusCode: 200 };
    }
    if (asset.conversationId) {
      const conv = this.inner.getConversationById(asset.conversationId);
      if (conv && this.inner.isConversationParticipant(conv, viewerId)) {
        return { allowed: true, statusCode: 200 };
      }
      return { allowed: false, statusCode: 403, reason: 'Forbidden: private conversation media.' };
    }
    const post = this.inner
      .getAllPosts()
      .find((p) => p.mediaUrl === asset.url || (Array.isArray(p.images) && p.images.includes(asset.url)));
    if (post && this.inner.canViewerSeePost(viewerId, post)) {
      return { allowed: true, statusCode: 200 };
    }
    return { allowed: false, statusCode: 403, reason: 'Forbidden: you do not have permission to view this private media.' };
  }

  public async getShortVideos(): Promise<ShortVideo[]> {
    return this.inner.getShortVideos();
  }

  public async addShortVideo(short: ShortVideo): Promise<ShortVideo> {
    return this.inner.addShortVideo(short);
  }

  public async getLongVideos(): Promise<LongVideo[]> {
    return this.inner.getLongVideos();
  }

  public async addLongVideo(video: LongVideo): Promise<LongVideo> {
    return this.inner.addLongVideo(video);
  }

  public async getFriendIds(userId: string): Promise<string[]> {
    return this.inner.getFriendIds(userId);
  }

  public async isFriend(userA: string, userB: string): Promise<boolean> {
    return this.inner.isFriend(userA, userB);
  }

  public async addFriendship(userA: string, userB: string): Promise<void> {
    this.inner.addFriendship(userA, userB);
  }

  public async removeFriendship(userA: string, userB: string): Promise<void> {
    this.inner.removeFriendship(userA, userB);
  }

  public async getMutualFriendCount(userA: string, userB: string): Promise<number> {
    return this.inner.getMutualFriendCount(userA, userB);
  }

  public async getRelationshipStatus(
    viewerId: string,
    targetId: string
  ): Promise<{ status: RelationshipStatus; requestId?: string }> {
    return this.inner.getRelationshipStatus(viewerId, targetId);
  }

  public async getFriendRequests(userId: string): Promise<FriendRequest[]> {
    return this.inner.getFriendRequests(userId);
  }

  public async getSentFriendRequests(userId: string): Promise<FriendRequest[]> {
    return this.inner.getSentFriendRequests(userId);
  }

  public async createFriendRequestSafe(
    senderId: string,
    receiverId: string
  ): Promise<{ request?: FriendRequest; error?: string; autoAccepted?: boolean; alreadyPending?: boolean }> {
    return this.inner.createFriendRequestSafe(senderId, receiverId);
  }

  public async respondFriendRequest(
    requestId: string,
    action: 'accept' | 'reject' | 'cancel',
    actingUserId?: string
  ): Promise<{ ok: boolean; error?: string; request?: FriendRequest }> {
    return this.inner.respondFriendRequest(requestId, action, actingUserId);
  }

  public async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return this.inner.isFollowing(followerId, followingId);
  }

  public async follow(followerId: string, followingId: string): Promise<boolean> {
    return this.inner.follow(followerId, followingId);
  }

  public async unfollow(followerId: string, followingId: string): Promise<boolean> {
    return this.inner.unfollow(followerId, followingId);
  }

  public async isBlocked(userId: string, targetUserId: string): Promise<boolean> {
    return this.inner.isBlocked(userId, targetUserId);
  }

  public async toggleBlock(userId: string, targetUserId: string): Promise<boolean> {
    return this.inner.toggleBlock(userId, targetUserId);
  }

  public async getBlockedUserIds(userId: string): Promise<string[]> {
    return this.inner.getBlockedUserIds(userId);
  }

  public async getSuggestedFriends(userId: string): Promise<UserProfile[]> {
    return this.inner.getSuggestedFriends(userId);
  }

  public async getNotifications(userId: string, category?: string): Promise<NotificationItem[]> {
    return this.inner.getNotifications(userId, category);
  }

  public async addNotification(notif: NotificationItem & { recipientId: string; category?: string }): Promise<void> {
    this.inner.addNotification(notif);
  }

  public async markNotificationsRead(userId: string, notificationId?: string): Promise<void> {
    this.inner.markNotificationsRead(userId, notificationId);
  }

  public async deleteNotification(userId: string, notificationId: string): Promise<void> {
    this.inner.deleteNotification(userId, notificationId);
  }

  public async setOtp(identifier: string, code: string, type: 'register' | 'phone_verify' | 'forgot_password'): Promise<void> {
    this.inner.setOtp(identifier, code, type);
  }

  public async verifyOtp(identifier: string, code: string, type: 'register' | 'phone_verify' | 'forgot_password'): Promise<boolean> {
    return this.inner.verifyOtp(identifier, code, type);
  }

  public async getYouTubeOAuth(userId: string): Promise<YouTubeOAuthRecord | undefined> {
    return this.inner.getYouTubeOAuth(userId);
  }

  public async setYouTubeOAuth(userId: string, record: YouTubeOAuthRecord): Promise<YouTubeOAuthRecord> {
    return this.inner.setYouTubeOAuth(userId, record);
  }

  public async deleteYouTubeOAuth(userId: string): Promise<boolean> {
    return this.inner.deleteYouTubeOAuth(userId);
  }

  public isConversationParticipant(conv: Conversation, userId: string): boolean {
    return this.inner.isConversationParticipant(conv, userId);
  }

  public async getConversationById(conversationId: string): Promise<Conversation | undefined> {
    return this.inner.getConversationById(conversationId);
  }

  public async getUserConversations(userId: string, onlineUserIds?: Set<string>): Promise<Conversation[]> {
    return this.inner.getUserConversations(userId, onlineUserIds);
  }

  public async getTotalUnreadMessages(userId: string): Promise<number> {
    return this.inner.getTotalUnreadMessages(userId);
  }

  public async getOrCreateDirectConversation(
    userId: string,
    targetUserId: string,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; error?: string; statusCode?: number }> {
    return this.inner.getOrCreateDirectConversation(userId, targetUserId, onlineUserIds);
  }

  public async respondConversationRequest(
    conversationId: string,
    userId: string,
    action: 'accept' | 'decline',
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; recipientIds?: string[]; error?: string; statusCode?: number }> {
    return this.inner.respondConversationRequest(conversationId, userId, action, onlineUserIds);
  }

  public async createGroupConversation(
    creatorId: string,
    name: string,
    memberIds: string[],
    photo?: string,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; error?: string; statusCode?: number }> {
    return this.inner.createGroupConversation(creatorId, name, memberIds, photo, onlineUserIds);
  }

  public async addGroupMembers(
    conversationId: string,
    actorId: string,
    memberIds: string[],
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; addedIds?: string[]; systemMessage?: ChatMessage; error?: string; statusCode?: number }> {
    return this.inner.addGroupMembers(conversationId, actorId, memberIds, onlineUserIds);
  }

  public async removeGroupMember(
    conversationId: string,
    actorId: string,
    targetUserId: string,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; systemMessage?: ChatMessage; error?: string; statusCode?: number }> {
    return this.inner.removeGroupMember(conversationId, actorId, targetUserId, onlineUserIds);
  }

  public async setGroupAdmin(
    conversationId: string,
    actorId: string,
    targetUserId: string,
    makeAdmin: boolean,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; error?: string; statusCode?: number }> {
    return this.inner.setGroupAdmin(conversationId, actorId, targetUserId, makeAdmin, onlineUserIds);
  }

  public async leaveGroupConversation(
    conversationId: string,
    userId: string
  ): Promise<{ ok: boolean; remainingIds?: string[]; systemMessage?: ChatMessage; error?: string; statusCode?: number }> {
    return this.inner.leaveGroupConversation(conversationId, userId);
  }

  public async updateConversationSettings(
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
  ): Promise<{ conversation?: Conversation; broadcastMeta?: boolean; error?: string; statusCode?: number }> {
    return this.inner.updateConversationSettings(conversationId, userId, updates, onlineUserIds);
  }

  public async getConversationMessages(
    conversationId: string,
    userId: string,
    beforeId?: string,
    limit = 35
  ): Promise<{ messages?: ChatMessage[]; hasMore?: boolean; error?: string; statusCode?: number }> {
    return this.inner.getConversationMessages(conversationId, userId, beforeId, limit);
  }

  public async markConversationRead(
    conversationId: string,
    userId: string
  ): Promise<{ ok: boolean; error?: string; statusCode?: number; participantIds?: string[]; sendReceipt?: boolean }> {
    return this.inner.markConversationRead(conversationId, userId);
  }

  public async addChatMessage(
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
  ): Promise<{ message?: ChatMessage; conversation?: Conversation; recipientIds?: string[]; error?: string; statusCode?: number }> {
    const res = this.inner.addChatMessage(conversationId, senderId, text, mediaUrl, mediaType, extra);
    if (res.message) {
      const urls = [
        mediaUrl,
        ...(extra?.attachments || []).map((a) => a.url),
      ].filter((u): u is string => Boolean(u && u.startsWith('/uploads/')));
      if (urls.length > 0) {
        await this.syncMediaVisibilityForUrls(urls, senderId, 'private', conversationId);
      }
    }
    return res;
  }

  public async editChatMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    newText: string
  ): Promise<{ message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number }> {
    return this.inner.editChatMessage(conversationId, msgId, userId, newText);
  }

  public async deleteChatMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    mode: 'me' | 'everyone' = 'everyone'
  ): Promise<{ message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number }> {
    return this.inner.deleteChatMessage(conversationId, msgId, userId, mode);
  }

  public async toggleChatReaction(
    conversationId: string,
    msgId: string,
    userId: string,
    emoji: string
  ): Promise<{ message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number }> {
    return this.inner.toggleChatReaction(conversationId, msgId, userId, emoji);
  }

  public async togglePinChatMessage(
    conversationId: string,
    msgId: string,
    userId: string
  ): Promise<{ message?: ChatMessage; pinnedMessageIds?: string[]; recipientIds?: string[]; error?: string; statusCode?: number }> {
    return this.inner.togglePinChatMessage(conversationId, msgId, userId);
  }

  public async searchConversationMessages(
    conversationId: string,
    userId: string,
    query: string
  ): Promise<{ messages?: ChatMessage[]; error?: string; statusCode?: number }> {
    return this.inner.searchConversationMessages(conversationId, userId, query);
  }

  public async getConversationSharedMedia(
    conversationId: string,
    userId: string
  ): Promise<{ items?: ChatMessage[]; links?: { messageId: string; url: string; senderName: string; createdAt: string }[]; error?: string; statusCode?: number }> {
    return this.inner.getConversationSharedMedia(conversationId, userId);
  }

  public async addCallRecord(record: CallRecord): Promise<CallRecord> {
    return this.inner.addCallRecord(record);
  }

  public async updateCallRecord(callId: string, updates: Partial<CallRecord>): Promise<CallRecord | undefined> {
    return this.inner.updateCallRecord(callId, updates);
  }

  public async getCallRecordById(callId: string): Promise<CallRecord | undefined> {
    return this.inner.getCallRecordById(callId);
  }

  public async getUserCalls(userId: string): Promise<CallRecord[]> {
    return this.inner.getUserCalls(userId);
  }

  public async getUserDrafts(userId: string): Promise<DraftPost[]> {
    return this.inner.getUserDrafts(userId);
  }

  public async saveDraft(draft: DraftPost): Promise<DraftPost> {
    return this.inner.saveDraft(draft);
  }

  public async deleteDraft(draftId: string, userId: string): Promise<boolean> {
    return this.inner.deleteDraft(draftId, userId);
  }

  public async getUserSavedVideos(userId: string): Promise<SavedVideoItem[]> {
    return this.inner.getUserSavedVideos(userId);
  }

  public async toggleSaveVideo(
    userId: string,
    item: Omit<SavedVideoItem, 'id' | 'userId' | 'savedAt'>
  ): Promise<{ isSaved: boolean; savedVideos: SavedVideoItem[] }> {
    return this.inner.toggleSaveVideo(userId, item);
  }

  public async upsertWatchProgress(
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
  ): Promise<WatchHistoryRecord> {
    return this.inner.upsertWatchProgress(userId, payload);
  }

  public async getSuppressedVideoIds(userId: string | undefined, suppressionDays = 7): Promise<Set<string>> {
    return this.inner.getSuppressedVideoIds(userId, suppressionDays);
  }

  public async getUserWatchHistory(userId: string): Promise<WatchHistoryRecord[]> {
    return this.inner.getUserWatchHistory(userId);
  }

  public async removeWatchHistoryItem(userId: string, videoId: string): Promise<boolean> {
    return this.inner.removeWatchHistoryItem(userId, videoId);
  }

  public async getUserInterestKeywords(userId?: string): Promise<string[]> {
    return this.inner.getUserInterestKeywords(userId);
  }

  public async addUserReport(report: UserReport): Promise<UserReport> {
    return this.inner.addUserReport(report);
  }

  public async getServers(): Promise<ServerRegistryEntry[]> {
    return this.inner.getServers();
  }

  public async getServerById(id: string): Promise<ServerRegistryEntry | undefined> {
    return this.inner.getServerById(id);
  }

  public async recordServerHistory(entry: Omit<ServerSwitchHistoryEntry, 'id' | 'createdAt'>): Promise<ServerSwitchHistoryEntry> {
    return this.inner.recordServerHistory(entry);
  }

  public async getServerHistory(): Promise<ServerSwitchHistoryEntry[]> {
    return this.inner.getServerHistory();
  }

  public async upsertServer(
    payload: Partial<ServerRegistryEntry> & { id?: string; name: string; baseUrl: string },
    actor: UserAccount
  ): Promise<ServerRegistryEntry> {
    return this.inner.upsertServer(payload, actor);
  }

  public async updateServerHealth(
    id: string,
    status: 'healthy' | 'degraded' | 'offline',
    latencyMs: number | null
  ): Promise<ServerRegistryEntry | undefined> {
    return this.inner.updateServerHealth(id, status, latencyMs);
  }

  public async setPrimaryServer(
    id: string,
    actor: UserAccount
  ): Promise<{ ok: boolean; error?: string; server?: ServerRegistryEntry; previousPrimaryId?: string }> {
    return this.inner.setPrimaryServer(id, actor);
  }

  public async rollbackPrimaryServer(actor: UserAccount): Promise<{ ok: boolean; error?: string; server?: ServerRegistryEntry }> {
    return this.inner.rollbackPrimaryServer(actor);
  }

  public async deleteServer(id: string, actor: UserAccount): Promise<{ ok: boolean; error?: string }> {
    return this.inner.deleteServer(id, actor);
  }

  public async getAdminConfigMessages(): Promise<AdminConfigChatMessage[]> {
    return this.inner.getAdminConfigMessages();
  }

  public async addAdminConfigMessage(msg: AdminConfigChatMessage): Promise<AdminConfigChatMessage> {
    return this.inner.addAdminConfigMessage(msg);
  }

  public async getBdServicePrefs(userId: string): Promise<{ favorites: string[]; recent: string[] }> {
    return this.inner.getBdServicePrefs(userId);
  }

  public async toggleBdServiceFavorite(userId: string, serviceId: string): Promise<{ favorites: string[]; isFavorite: boolean }> {
    return this.inner.toggleBdServiceFavorite(userId, serviceId);
  }

  public async recordBdServiceRecent(userId: string, serviceId: string): Promise<string[]> {
    return this.inner.recordBdServiceRecent(userId, serviceId);
  }
}
