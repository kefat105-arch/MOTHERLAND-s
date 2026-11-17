import crypto from 'crypto';
import path from 'path';
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
  UserAccount,
  Session,
  ReactionRecord,
  YouTubeOAuthRecord,
  DEFAULT_PBKDF2_ITERATIONS,
} from './db.ts';
import type { DatabaseBackend } from './dbInterface.ts';
import {
  CURRENT_SCHEMA_VERSION,
  BackupMetadata,
  PersistencePaths,
  resolvePersistencePaths,
  getPersistentAuthSecret,
  hashSessionToken,
  parseDeviceName,
} from './persistence.ts';
import {
  pgQuery,
  withPgTransaction,
  pingPostgres,
  closePgPool,
} from './pgPool.ts';
import { runPostgresMigrations } from './pgMigrations.ts';

function toIso(val: any): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function toOptionalIso(val: any): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapUserRow(r: any): UserAccount {
  return {
    id: r.id,
    username: r.username,
    email: r.email || '',
    phoneNumber: r.phone_number || undefined,
    passwordHash: r.password_hash,
    passwordSalt: r.password_salt,
    passwordIterations: Number(r.password_iterations || DEFAULT_PBKDF2_ITERATIONS),
    hasPassword: typeof r.has_password === 'boolean' ? r.has_password : true,
    authProvider: r.auth_provider || 'password',
    authProviders: Array.isArray(r.auth_providers) ? r.auth_providers : ['password'],
    googleId: r.google_id || undefined,
    googleEmail: r.google_email || undefined,
    displayName: r.display_name,
    avatar: r.avatar || '',
    coverImage: r.cover_image || '',
    bio: r.bio || '',
    website: r.website || undefined,
    location: r.location || undefined,
    work: r.work || undefined,
    education: r.education || undefined,
    dateOfBirth: r.date_of_birth || undefined,
    gender: r.gender || undefined,
    address: r.address || undefined,
    joinedDate: r.joined_date || 'November 2026',
    isVerified: Boolean(r.is_verified),
    role: r.role || 'user',
    isEmailVerified: Boolean(r.is_email_verified),
    isPhoneVerified: Boolean(r.is_phone_verified),
    twoFactorEnabled: Boolean(r.two_factor_enabled),
    isPrivate: Boolean(r.is_private),
    deactivated: Boolean(r.deactivated),
    deactivatedAt: toOptionalIso(r.deactivated_at),
    privacy: r.privacy || {
      profileVisibility: 'public',
      showOnlineStatus: true,
      allowDirectMessages: 'everyone',
      showContactInfo: true,
    },
    notificationPrefs: r.notification_prefs || undefined,
    translationPrefs: r.translation_prefs || undefined,
    dataSaver: Boolean(r.data_saver),
    lastActiveAt: toOptionalIso(r.last_active_at),
    socialLinks: r.social_links || undefined,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapPostRow(r: any): Post {
  return {
    id: r.id,
    source: r.source || 'motherland',
    externalId: r.external_id || undefined,
    author: r.author_snapshot,
    content: r.content || '',
    mediaType: r.media_type || 'none',
    mediaUrl: r.media_url || undefined,
    images: Array.isArray(r.images) ? r.images : undefined,
    thumbnailUrl: r.thumbnail_url || undefined,
    mediaAspectRatio: r.media_aspect_ratio || '16:9',
    hashtags: Array.isArray(r.hashtags) ? r.hashtags : [],
    audience: r.audience || 'public',
    stats: r.stats || { likes: 0, comments: 0, shares: 0, views: 0 },
    sharedPost: r.shared_post || undefined,
    isEdited: Boolean(r.is_edited),
    editedAt: toOptionalIso(r.edited_at),
    createdAt: toIso(r.created_at),
  };
}

function mapStoryRow(r: any): Story {
  return {
    id: r.id,
    userId: r.user_id,
    userDisplayName: r.user_display_name,
    userUsername: r.user_username,
    userAvatar: r.user_avatar || '',
    isUserVerified: Boolean(r.is_user_verified),
    source: r.source || 'motherland',
    mediaUrl: r.media_url,
    mediaType: r.media_type === 'video' ? 'video' : 'image',
    caption: r.caption || '',
    viewersCount: Number(r.viewers_count || 0),
    isViewed: false,
    createdAt: toIso(r.created_at),
    expiresAt: toIso(r.expires_at),
  };
}

function mapMediaRow(r: any): MediaAssetRecord {
  return {
    id: r.id,
    ownerId: r.owner_id,
    originalFilename: r.original_filename,
    storedFilename: r.stored_filename,
    url: r.url,
    storageKey: r.storage_key || undefined,
    bucket: r.bucket || undefined,
    visibility: r.visibility === 'private' ? 'private' : 'public',
    conversationId: r.conversation_id || undefined,
    mimeType: r.mime_type,
    sizeBytes: Number(r.size_bytes || 0),
    sha256: r.sha256 || '',
    storageProvider: r.storage_provider || 'supabase_s3',
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

function mapConvRow(r: any): Conversation {
  return {
    id: r.id,
    isGroup: Boolean(r.is_group),
    name: r.name || undefined,
    photo: r.photo || undefined,
    creatorId: r.creator_id || undefined,
    adminIds: Array.isArray(r.admin_ids) ? r.admin_ids : [],
    pinnedMessageIds: Array.isArray(r.pinned_message_ids) ? r.pinned_message_ids : [],
    disappearingSeconds: Number(r.disappearing_seconds || 0),
    isRequest: Boolean(r.is_request),
    requestStatus: r.request_status || undefined,
    requestedBy: r.requested_by || undefined,
    archivedBy: Array.isArray(r.archived_by) ? r.archived_by : [],
    mutedBy: Array.isArray(r.muted_by) ? r.muted_by : [],
    pinnedBy: Array.isArray(r.pinned_by) ? r.pinned_by : [],
    participantIds: Array.isArray(r.participant_ids) ? r.participant_ids : [],
    participants: [],
    lastMessage: r.last_message || undefined,
    lastReadAtByUser: r.last_read_at_by_user || {},
    unreadCount: 0,
    updatedAt: toIso(r.updated_at),
  };
}

function mapChatMsgRow(r: any, isRead = false): ChatMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    senderAvatar: r.sender_avatar || '',
    text: r.text || '',
    mediaUrl: r.media_url || undefined,
    mediaType: r.media_type || undefined,
    fileName: r.file_name || undefined,
    fileSize: r.file_size !== null && r.file_size !== undefined ? Number(r.file_size) : undefined,
    mimeType: r.mime_type || undefined,
    attachments: Array.isArray(r.attachments) ? r.attachments : undefined,
    audioDuration: r.audio_duration !== null && r.audio_duration !== undefined ? Number(r.audio_duration) : undefined,
    audioWaveform: Array.isArray(r.audio_waveform) ? r.audio_waveform : undefined,
    replyTo: r.reply_to || undefined,
    forwardedFrom: r.forwarded_from || undefined,
    reactions: r.reactions || {},
    isEdited: Boolean(r.is_edited),
    editedAt: toOptionalIso(r.edited_at),
    isDeleted: Boolean(r.is_deleted),
    deletedForIds: Array.isArray(r.deleted_for_ids) ? r.deleted_for_ids : undefined,
    isPinned: Boolean(r.is_pinned),
    messageType: r.message_type || 'text',
    deliveredTo: Array.isArray(r.delivered_to) ? r.delivered_to : undefined,
    expiresAt: toOptionalIso(r.expires_at),
    createdAt: toIso(r.created_at),
    isRead,
  };
}

function mapCallRow(r: any): CallRecord {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    callerId: r.caller_id,
    callerName: r.caller_name,
    callerAvatar: r.caller_avatar || '',
    calleeIds: Array.isArray(r.callee_ids) ? r.callee_ids : [],
    calleeName: r.callee_name || undefined,
    calleeAvatar: r.callee_avatar || undefined,
    callType: r.call_type === 'video' ? 'video' : 'audio',
    isGroupCall: Boolean(r.is_group_call),
    status: r.status || 'ended',
    durationSeconds: Number(r.duration_seconds || 0),
    createdAt: toIso(r.created_at),
    endedAt: toOptionalIso(r.ended_at),
  };
}

function mapServerRow(r: any): ServerRegistryEntry {
  return {
    id: r.id,
    name: r.name,
    baseUrl: r.base_url,
    healthPath: r.health_path || undefined,
    wsUrl: r.ws_url || undefined,
    environment: r.environment || undefined,
    assignedServices: Array.isArray(r.assigned_services) ? r.assigned_services : ['main_app'],
    enabled: Boolean(r.enabled),
    isPrimary: Boolean(r.is_primary),
    isolated: Boolean(r.isolated),
    lastHealthStatus: r.last_health_status || 'unknown',
    lastLatencyMs: r.last_latency_ms !== null && r.last_latency_ms !== undefined ? Number(r.last_latency_ms) : null,
    lastCheckedAt: toOptionalIso(r.last_checked_at),
    notes: r.notes || undefined,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  };
}

export class MotherlandPostgresDb implements DatabaseBackend {
  public readonly driverName = 'postgres' as const;
  private paths: PersistencePaths;
  private initialized = false;
  private lastTouchCache = new Map<string, number>();

  constructor(customPaths?: PersistencePaths) {
    this.paths = customPaths || resolvePersistencePaths();
    getPersistentAuthSecret(this.paths);
  }

  public getPaths(): PersistencePaths {
    return this.paths;
  }

  public async init(): Promise<void> {
    if (this.initialized) return;
    const ping = await pingPostgres();
    if (!ping.ok) {
      throw new Error(`Failed to connect to Supabase PostgreSQL: ${ping.error}`);
    }
    await runPostgresMigrations();
    await this.ensureDefaultServerRegistryEntries();
    this.initialized = true;
  }

  public async close(): Promise<void> {
    await closePgPool();
    this.initialized = false;
  }

  public async healthCheck() {
    const ping = await pingPostgres();
    return {
      ok: ping.ok,
      driver: 'postgres' as const,
      latencyMs: ping.latencyMs,
      details: ping.ok ? `PostgreSQL Session Pooler connected (${ping.serverVersion || 'Postgres'})` : ping.error,
    };
  }

  public async save(): Promise<void> {
    // No-op: PostgreSQL writes are immediately persisted per operation/transaction.
  }

  private async ensureDefaultServerRegistryEntries(): Promise<void> {
    const now = new Date().toISOString();
    const existing = await pgQuery<{ id: string; is_primary: boolean; isolated: boolean }>(
      'SELECT id, is_primary, isolated FROM server_registry'
    );
    const hasLocal = existing.rows.some((r) => r.id === 'srv_motherland_local');
    const hasDream = existing.rows.some((r) => r.id === 'srv_dream_world');
    const hasPrimary = existing.rows.some((r) => r.is_primary && !r.isolated);

    if (!hasLocal) {
      await pgQuery(
        `INSERT INTO server_registry
          (id, name, base_url, health_path, ws_url, environment, assigned_services, enabled, is_primary, isolated, last_health_status, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, TRUE, $8, FALSE, 'healthy', $9, $10, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          'srv_motherland_local',
          'MOTHERLAND Core Engine',
          'http://127.0.0.1:3000',
          '/api/health',
          'ws://127.0.0.1:3000/ws',
          'local',
          JSON.stringify(['main_app', 'video', 'messaging', 'calls', 'bd_services']),
          !hasPrimary,
          'Primary active MOTHERLAND API, WebRTC WAVE signaling & Supabase PostgreSQL engine.',
          now,
        ]
      );
    }

    if (!hasDream) {
      await pgQuery(
        `INSERT INTO server_registry
          (id, name, base_url, health_path, ws_url, environment, assigned_services, enabled, is_primary, isolated, last_health_status, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, TRUE, FALSE, TRUE, 'unknown', $8, $9, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          'srv_dream_world',
          'Dream World Dedicated Game Server',
          'https://dream-world-open.onrender.com',
          '/health',
          'wss://dream-world-open.onrender.com/ws/game',
          'isolated_game',
          JSON.stringify(['dream_world']),
          'Strictly isolated external game server for Dream World. Never mixes with core MOTHERLAND social routing.',
          now,
        ]
      );
    }
  }

  public async createBackup(reason = 'manual'): Promise<BackupMetadata> {
    const countsRes = await pgQuery<{
      users: string;
      posts: string;
      stories: string;
      sessions: string;
      media_assets: string;
      conversations: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM posts) AS posts,
        (SELECT COUNT(*) FROM stories WHERE expires_at > NOW()) AS stories,
        (SELECT COUNT(*) FROM sessions WHERE expires_at > NOW()) AS sessions,
        (SELECT COUNT(*) FROM media_assets) AS media_assets,
        (SELECT COUNT(*) FROM conversations) AS conversations
    `);
    const row = countsRes.rows[0];
    const counts = {
      users: Number(row?.users || 0),
      posts: Number(row?.posts || 0),
      stories: Number(row?.stories || 0),
      sessions: Number(row?.sessions || 0),
      mediaAssets: Number(row?.media_assets || 0),
      conversations: Number(row?.conversations || 0),
    };
    const stamp = new Date().toISOString();
    const digest = crypto.createHash('sha256').update(JSON.stringify({ reason, stamp, counts })).digest('hex');
    return {
      filename: `pg_snapshot_${reason}_${stamp.replace(/[:.]/g, '-')}.json`,
      filePath: 'supabase-postgresql',
      reason,
      createdAt: stamp,
      byteSize: 0,
      sha256: digest,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      counts,
      verified: true,
    };
  }

  public async listBackups(): Promise<BackupMetadata[]> {
    return [await this.createBackup('live_postgres_status')];
  }

  public async getPersistenceHealth(): Promise<any> {
    const [ping, migsRes, countsRes] = await Promise.all([
      pingPostgres(),
      pgQuery('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC'),
      pgQuery(`
        SELECT
          (SELECT COUNT(*) FROM users) AS users,
          (SELECT COUNT(*) FROM sessions WHERE expires_at > NOW()) AS active_sessions,
          (SELECT COUNT(*) FROM posts) AS posts,
          (SELECT COUNT(*) FROM stories WHERE expires_at > NOW()) AS active_stories,
          (SELECT COUNT(*) FROM expired_stories_archive) AS archived_stories,
          (SELECT COUNT(*) FROM media_assets) AS media_assets,
          (SELECT COUNT(*) FROM short_videos) AS short_videos,
          (SELECT COUNT(*) FROM long_videos) AS long_videos,
          (SELECT COUNT(*) FROM conversations) AS conversations,
          (SELECT COUNT(*) FROM friendships) AS friendships,
          (SELECT COUNT(*) FROM notifications) AS notifications
      `),
    ]);
    const c = countsRes.rows[0] || {};
    return {
      driver: 'postgres',
      environment: this.paths.env,
      databaseConnected: ping.ok,
      latencyMs: ping.latencyMs,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      targetSchemaVersion: CURRENT_SCHEMA_VERSION,
      migrationsApplied: migsRes.rows.map((m: any) => ({
        version: Number(m.version),
        name: m.name,
        appliedAt: toIso(m.applied_at),
      })),
      counts: {
        users: Number(c.users || 0),
        activeSessions: Number(c.active_sessions || 0),
        posts: Number(c.posts || 0),
        activeStories: Number(c.active_stories || 0),
        archivedExpiredStories: Number(c.archived_stories || 0),
        mediaAssets: Number(c.media_assets || 0),
        shortVideos: Number(c.short_videos || 0),
        longVideos: Number(c.long_videos || 0),
        conversations: Number(c.conversations || 0),
        friendships: Number(c.friendships || 0),
        notifications: Number(c.notifications || 0),
      },
    };
  }

  // ==========================================
  // USERS & PROFILES
  // ==========================================
  public async findUserById(id: string): Promise<UserAccount | undefined> {
    if (!id) return undefined;
    const res = await pgQuery('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] ? mapUserRow(res.rows[0]) : undefined;
  }

  public async findUserByEmailOrUsername(identifier: string): Promise<UserAccount | undefined> {
    const clean = identifier.trim();
    if (!clean) return undefined;
    const term = clean.toLowerCase();
    const res = await pgQuery(
      `SELECT * FROM users
       WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR phone_number = $2
       LIMIT 1`,
      [term, clean]
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : undefined;
  }

  public async findUserByPhone(phone: string): Promise<UserAccount | undefined> {
    const clean = phone.replace(/[\s\-()]/g, '').trim();
    if (!clean) return undefined;
    const res = await pgQuery(
      `SELECT * FROM users
       WHERE phone_number IS NOT NULL
         AND REGEXP_REPLACE(phone_number, '[\\s\\-()]', '', 'g') = $1
       LIMIT 1`,
      [clean]
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : undefined;
  }

  public async getAllUsers(): Promise<UserAccount[]> {
    const res = await pgQuery('SELECT * FROM users ORDER BY created_at ASC');
    return res.rows.map(mapUserRow);
  }

  public async createUser(account: UserAccount): Promise<UserAccount> {
    const now = new Date().toISOString();
    const created = account.createdAt || now;
    const updated = account.updatedAt || now;
    await pgQuery(
      `INSERT INTO users (
        id, username, email, phone_number, password_hash, password_salt, password_iterations,
        has_password, auth_provider, auth_providers, google_id, google_email, display_name,
        avatar, cover_image, bio, website, location, work, education, date_of_birth, gender, address,
        joined_date, is_verified, role, is_email_verified, is_phone_verified, two_factor_enabled,
        is_private, deactivated, deactivated_at, privacy, notification_prefs, translation_prefs,
        data_saver, last_active_at, social_links, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10::jsonb, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29,
        $30, $31, $32, $33::jsonb, $34::jsonb, $35::jsonb,
        $36, $37, $38::jsonb, $39, $40
      )`,
      [
        account.id,
        account.username,
        account.email || '',
        account.phoneNumber || null,
        account.passwordHash,
        account.passwordSalt,
        account.passwordIterations || DEFAULT_PBKDF2_ITERATIONS,
        account.hasPassword !== false,
        account.authProvider || 'password',
        JSON.stringify(account.authProviders || [account.authProvider || 'password']),
        account.googleId || null,
        account.googleEmail || null,
        account.displayName,
        account.avatar || '',
        account.coverImage || '',
        account.bio || '',
        account.website || null,
        account.location || null,
        account.work || null,
        account.education || null,
        account.dateOfBirth || null,
        account.gender || null,
        account.address || null,
        account.joinedDate || 'November 2026',
        Boolean(account.isVerified),
        account.role || 'user',
        Boolean(account.isEmailVerified),
        Boolean(account.isPhoneVerified),
        Boolean(account.twoFactorEnabled),
        Boolean(account.isPrivate),
        Boolean(account.deactivated),
        account.deactivatedAt || null,
        JSON.stringify(account.privacy || {}),
        account.notificationPrefs ? JSON.stringify(account.notificationPrefs) : null,
        account.translationPrefs ? JSON.stringify(account.translationPrefs) : null,
        Boolean(account.dataSaver),
        account.lastActiveAt || now,
        account.socialLinks ? JSON.stringify(account.socialLinks) : null,
        created,
        updated,
      ]
    );
    return account;
  }

  public async updateUser(id: string, updates: Partial<UserAccount>): Promise<UserAccount | undefined> {
    const columnMap: Record<string, { col: string; json?: boolean }> = {
      username: { col: 'username' },
      email: { col: 'email' },
      phoneNumber: { col: 'phone_number' },
      passwordHash: { col: 'password_hash' },
      passwordSalt: { col: 'password_salt' },
      passwordIterations: { col: 'password_iterations' },
      hasPassword: { col: 'has_password' },
      authProvider: { col: 'auth_provider' },
      authProviders: { col: 'auth_providers', json: true },
      googleId: { col: 'google_id' },
      googleEmail: { col: 'google_email' },
      displayName: { col: 'display_name' },
      avatar: { col: 'avatar' },
      coverImage: { col: 'cover_image' },
      bio: { col: 'bio' },
      website: { col: 'website' },
      location: { col: 'location' },
      work: { col: 'work' },
      education: { col: 'education' },
      dateOfBirth: { col: 'date_of_birth' },
      gender: { col: 'gender' },
      address: { col: 'address' },
      isVerified: { col: 'is_verified' },
      role: { col: 'role' },
      isEmailVerified: { col: 'is_email_verified' },
      isPhoneVerified: { col: 'is_phone_verified' },
      twoFactorEnabled: { col: 'two_factor_enabled' },
      isPrivate: { col: 'is_private' },
      deactivated: { col: 'deactivated' },
      deactivatedAt: { col: 'deactivated_at' },
      privacy: { col: 'privacy', json: true },
      notificationPrefs: { col: 'notification_prefs', json: true },
      translationPrefs: { col: 'translation_prefs', json: true },
      dataSaver: { col: 'data_saver' },
      lastActiveAt: { col: 'last_active_at' },
      socialLinks: { col: 'social_links', json: true },
    };

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      const mapping = columnMap[key];
      if (!mapping || val === undefined) continue;
      if (mapping.json) {
        sets.push(`${mapping.col} = $${idx++}::jsonb`);
        params.push(JSON.stringify(val));
      } else {
        sets.push(`${mapping.col} = $${idx++}`);
        params.push(val);
      }
    }

    sets.push(`updated_at = $${idx++}`);
    params.push(new Date().toISOString());
    params.push(id);

    const res = await pgQuery(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return res.rows[0] ? mapUserRow(res.rows[0]) : undefined;
  }

  public async toPublicProfile(
    user: UserAccount,
    requestingUserId?: string,
    onlineUserIds?: Set<string>
  ): Promise<UserProfile> {
    const [
      friendIds,
      followersRes,
      followingRes,
      postsRes,
      shortsRes,
      longsRes,
      rel,
      isBlockedByViewer,
    ] = await Promise.all([
      this.getFriendIds(user.id),
      pgQuery<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM follows f
         JOIN users u ON u.id = f.follower_id
         WHERE f.following_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.user_id = $1 AND b.blocked_user_id = f.follower_id)
                OR (b.user_id = f.follower_id AND b.blocked_user_id = $1)
           )`,
        [user.id]
      ),
      pgQuery<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM follows f
         JOIN users u ON u.id = f.following_id
         WHERE f.follower_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM blocks b
             WHERE (b.user_id = $1 AND b.blocked_user_id = f.following_id)
                OR (b.user_id = f.following_id AND b.blocked_user_id = $1)
           )`,
        [user.id]
      ),
      pgQuery('SELECT * FROM posts WHERE author_id = $1', [user.id]),
      pgQuery<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM short_videos WHERE source = 'motherland' AND author_id = $1`,
        [user.id]
      ),
      pgQuery<{ cnt: string }>(
        `SELECT COUNT(*) AS cnt FROM long_videos WHERE source = 'motherland' AND author_id = $1`,
        [user.id]
      ),
      requestingUserId
        ? this.getRelationshipStatus(requestingUserId, user.id)
        : Promise.resolve({ status: 'none' as RelationshipStatus, requestId: undefined }),
      requestingUserId ? this.isBlocked(requestingUserId, user.id) : Promise.resolve(false),
    ]);

    const visiblePosts: Post[] = [];
    for (const row of postsRes.rows) {
      const p = mapPostRow(row);
      if (await this.canViewerSeePost(requestingUserId, p)) {
        visiblePosts.push(p);
      }
    }

    const postSmallVideosCount = visiblePosts.filter(
      (p) => p.mediaType === 'video' && p.mediaAspectRatio === '9:16'
    ).length;
    const postLongVideosCount = visiblePosts.filter(
      (p) => p.mediaType === 'video' && p.mediaAspectRatio !== '9:16'
    ).length;

    const isSelf = requestingUserId === user.id;
    const showOnline =
      onlineUserIds !== undefined &&
      (isSelf || (user.privacy?.showOnlineStatus !== false && !isBlockedByViewer));
    const showLastSeen =
      isSelf ||
      (user.privacy?.showOnlineStatus !== false &&
        user.privacy?.showLastSeen !== false &&
        !isBlockedByViewer);

    const defaultNotifPrefs = {
      messages: true,
      calls: true,
      friends: true,
      posts: true,
      videos: true,
      groups: true,
    };

    const mutualCount =
      requestingUserId && !isSelf ? await this.getMutualFriendCount(requestingUserId, user.id) : undefined;

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
      friendsCount: friendIds.length,
      followersCount: Number(followersRes.rows[0]?.cnt || 0),
      followingCount: Number(followingRes.rows[0]?.cnt || 0),
      postsCount: visiblePosts.length,
      videosCount: Number(longsRes.rows[0]?.cnt || 0) + postLongVideosCount,
      smallVideosCount: Number(shortsRes.rows[0]?.cnt || 0) + postSmallVideosCount,
      privacy: {
        showLastSeen: true,
        showReadReceipts: true,
        allowCalls: 'everyone',
        ...user.privacy,
      },
      notificationPrefs: isSelf ? { ...defaultNotifPrefs, ...(user.notificationPrefs || {}) } : undefined,
      translationPrefs: isSelf ? { enabled: true, targetLang: 'bn', ...(user.translationPrefs || {}) } : undefined,
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
      mutualFriendsCount: mutualCount,
      isOnline: showOnline ? onlineUserIds!.has(user.id) : false,
    };
  }

  public async getUserNetworkLists(
    targetUserId: string,
    viewerId?: string,
    onlineUserIds?: Set<string>
  ): Promise<{ friends: UserProfile[]; supporters: UserProfile[]; supporting: UserProfile[] }> {
    const [friendIds, followersRes, followingRes] = await Promise.all([
      this.getFriendIds(targetUserId),
      pgQuery<{ follower_id: string }>('SELECT follower_id FROM follows WHERE following_id = $1', [targetUserId]),
      pgQuery<{ following_id: string }>('SELECT following_id FROM follows WHERE follower_id = $1', [targetUserId]),
    ]);

    const supporterIds = followersRes.rows.map((r) => r.follower_id);
    const supportingIds = followingRes.rows.map((r) => r.following_id);
    const allIds = Array.from(new Set([...friendIds, ...supporterIds, ...supportingIds]));
    if (allIds.length === 0) return { friends: [], supporters: [], supporting: [] };

    const usersRes = await pgQuery('SELECT * FROM users WHERE id = ANY($1::text[])', [allIds]);
    const userMap = new Map(usersRes.rows.map((r: any) => [r.id, mapUserRow(r)]));

    const filterUnblocked = async (ids: string[]) => {
      const out: UserProfile[] = [];
      const seen = new Set<string>();
      for (const uid of ids) {
        if (seen.has(uid)) continue;
        seen.add(uid);
        const acc = userMap.get(uid);
        if (!acc) continue;
        if (await this.isBlocked(targetUserId, uid)) continue;
        if (viewerId && (await this.isBlocked(viewerId, uid))) continue;
        out.push(await this.toPublicProfile(acc, viewerId, onlineUserIds));
      }
      return out;
    };

    const [friends, supporters, supporting] = await Promise.all([
      filterUnblocked(friendIds),
      filterUnblocked(supporterIds),
      filterUnblocked(supportingIds),
    ]);
    return { friends, supporters, supporting };
  }

  public async touchUserLastActive(userId: string): Promise<void> {
    const nowMs = Date.now();
    const prevMs = this.lastTouchCache.get(userId) || 0;
    if (nowMs - prevMs < 2 * 60 * 1000) return;
    this.lastTouchCache.set(userId, nowMs);
    await pgQuery('UPDATE users SET last_active_at = $1 WHERE id = $2', [
      new Date(nowMs).toISOString(),
      userId,
    ]);
  }

  public async deleteUserAccount(userId: string): Promise<{ ok: boolean; error?: string }> {
    return withPgTransaction(async (client) => {
      const res = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
      if (res.rowCount === 0) {
        return { ok: false, error: 'Account not found.' };
      }
      await client.query(
        'DELETE FROM conversations c WHERE NOT EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = c.id)'
      );
      return { ok: true };
    });
  }

  // ==========================================
  // SESSIONS
  // ==========================================
  public async createSession(
    userId: string,
    userAgent?: string,
    meta?: { ipAddress?: string; authMethod?: Session['authMethod'] }
  ): Promise<Session & { token: string }> {
    const rawToken = `ml_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = hashSessionToken(rawToken);
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();
    const session: Session = {
      id: `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      tokenHash,
      userId,
      deviceName: parseDeviceName(userAgent),
      ipAddress: meta?.ipAddress,
      authMethod: meta?.authMethod || 'password',
      createdAt: nowIso,
      lastUsedAt: nowIso,
      expiresAt,
      userAgent,
    };

    await withPgTransaction(async (client) => {
      await client.query('DELETE FROM sessions WHERE expires_at <= NOW()');
      await client.query(
        `DELETE FROM sessions
         WHERE id IN (
           SELECT id FROM sessions
           WHERE user_id = $1
           ORDER BY last_used_at DESC, created_at DESC
           OFFSET 19
         )`,
        [userId]
      );
      await client.query(
        `INSERT INTO sessions (id, user_id, token_hash, device_name, ip_address, auth_method, user_agent, created_at, last_used_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)`,
        [
          session.id,
          session.userId,
          session.tokenHash,
          session.deviceName || null,
          session.ipAddress || null,
          session.authMethod || 'password',
          session.userAgent || null,
          session.createdAt,
          session.expiresAt,
        ]
      );
    });

    return { ...session, token: rawToken };
  }

  public async findSessionByToken(rawToken: string): Promise<Session | undefined> {
    if (!rawToken) return undefined;
    const targetHash = hashSessionToken(rawToken);
    const res = await pgQuery(
      `SELECT * FROM sessions
       WHERE expires_at > NOW() AND (token_hash = $1 OR token = $2)
       LIMIT 1`,
      [targetHash, rawToken]
    );
    const row = res.rows[0];
    if (!row) return undefined;

    const nowMs = Date.now();
    const lastUsedMs = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
    const expMs = new Date(row.expires_at).getTime();

    const needsHashUpgrade = !row.token_hash && Boolean(row.token);
    const needsLastUsedUpdate = !lastUsedMs || nowMs - lastUsedMs > 5 * 60 * 1000;
    const needsRenewal = expMs - nowMs < 1000 * 60 * 60 * 24 * 75;

    let nextExpires = toIso(row.expires_at);
    let nextLastUsed = toIso(row.last_used_at || row.created_at);

    if (needsHashUpgrade || needsLastUsedUpdate || needsRenewal) {
      if (needsLastUsedUpdate) nextLastUsed = new Date(nowMs).toISOString();
      if (needsRenewal) nextExpires = new Date(nowMs + 1000 * 60 * 60 * 24 * 90).toISOString();
      await pgQuery(
        `UPDATE sessions
         SET token_hash = $1, token = NULL, last_used_at = $2, expires_at = $3
         WHERE id = $4`,
        [targetHash, nextLastUsed, nextExpires, row.id]
      );
    }

    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: targetHash,
      deviceName: row.device_name || undefined,
      ipAddress: row.ip_address || undefined,
      authMethod: row.auth_method || 'password',
      userAgent: row.user_agent || undefined,
      createdAt: toIso(row.created_at),
      lastUsedAt: nextLastUsed,
      expiresAt: nextExpires,
    };
  }

  public async getUserSessions(userId: string, currentRawToken?: string): Promise<DeviceSessionInfo[]> {
    const currentHash = currentRawToken ? hashSessionToken(currentRawToken) : '';
    const res = await pgQuery(
      `SELECT * FROM sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_used_at DESC, created_at DESC`,
      [userId]
    );
    return res.rows.map((r: any) => ({
      id: r.id,
      deviceName: r.device_name || parseDeviceName(r.user_agent),
      userAgent: r.user_agent || undefined,
      ipAddress: r.ip_address || undefined,
      authMethod: r.auth_method || 'legacy',
      createdAt: toIso(r.created_at),
      lastUsedAt: toIso(r.last_used_at || r.created_at),
      expiresAt: toIso(r.expires_at),
      isCurrent: Boolean(
        currentRawToken && ((r.token_hash && r.token_hash === currentHash) || (r.token && r.token === currentRawToken))
      ),
    }));
  }

  public async revokeSessionById(
    userId: string,
    sessionId: string
  ): Promise<{ ok: boolean; statusCode: number; error?: string }> {
    const res = await pgQuery('SELECT user_id FROM sessions WHERE id = $1 LIMIT 1', [sessionId]);
    if (!res.rows[0]) return { ok: false, statusCode: 404, error: 'Session not found.' };
    if (res.rows[0].user_id !== userId) {
      return { ok: false, statusCode: 403, error: 'Forbidden: you cannot revoke another user session.' };
    }
    await pgQuery('DELETE FROM sessions WHERE id = $1 AND user_id = $2', [sessionId, userId]);
    return { ok: true, statusCode: 200 };
  }

  public async deleteSession(rawToken: string): Promise<boolean> {
    if (!rawToken) return false;
    const targetHash = hashSessionToken(rawToken);
    const res = await pgQuery('DELETE FROM sessions WHERE token_hash = $1 OR token = $2', [targetHash, rawToken]);
    return (res.rowCount || 0) > 0;
  }

  public async deleteUserSessionsExcept(userId: string, currentRawToken?: string): Promise<number> {
    if (!currentRawToken) {
      const res = await pgQuery('DELETE FROM sessions WHERE user_id = $1', [userId]);
      return res.rowCount || 0;
    }
    const currentHash = hashSessionToken(currentRawToken);
    const res = await pgQuery(
      'DELETE FROM sessions WHERE user_id = $1 AND COALESCE(token_hash, \'\') <> $2 AND COALESCE(token, \'\') <> $3',
      [userId, currentHash, currentRawToken]
    );
    return res.rowCount || 0;
  }

  public async deleteUserSessions(userId: string): Promise<void> {
    await pgQuery('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }

  // ==========================================
  // REACTIONS & SAVED POSTS
  // ==========================================
  public async getPostReactions(postId: string): Promise<ReactionRecord[]> {
    const res = await pgQuery('SELECT post_id, user_id, type, created_at FROM post_reactions WHERE post_id = $1', [postId]);
    return res.rows.map((r: any) => ({
      postId: r.post_id,
      userId: r.user_id,
      type: r.type as ReactionType,
      createdAt: toIso(r.created_at),
    }));
  }

  public async getUserReaction(postId: string, userId: string): Promise<ReactionRecord | undefined> {
    const res = await pgQuery(
      'SELECT post_id, user_id, type, created_at FROM post_reactions WHERE post_id = $1 AND user_id = $2 LIMIT 1',
      [postId, userId]
    );
    const r = res.rows[0];
    return r ? { postId: r.post_id, userId: r.user_id, type: r.type, createdAt: toIso(r.created_at) } : undefined;
  }

  public async toggleReaction(
    postId: string,
    userId: string,
    reactionType: ReactionType
  ): Promise<{ isLiked: boolean; reaction?: ReactionType; likesCount: number }> {
    return withPgTransaction(async (client) => {
      const existing = await client.query<{ type: ReactionType }>(
        'SELECT type FROM post_reactions WHERE post_id = $1 AND user_id = $2 FOR UPDATE',
        [postId, userId]
      );
      let isLiked = false;
      let reaction: ReactionType | undefined;

      if (existing.rows[0]) {
        if (existing.rows[0].type === reactionType) {
          await client.query('DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2', [postId, userId]);
          isLiked = false;
        } else {
          await client.query(
            'UPDATE post_reactions SET type = $3, created_at = NOW() WHERE post_id = $1 AND user_id = $2',
            [postId, userId, reactionType]
          );
          isLiked = true;
          reaction = reactionType;
        }
      } else {
        await client.query(
          'INSERT INTO post_reactions (post_id, user_id, type, created_at) VALUES ($1, $2, $3, NOW())',
          [postId, userId, reactionType]
        );
        isLiked = true;
        reaction = reactionType;
      }

      const cntRes = await client.query<{ cnt: string }>(
        'SELECT COUNT(*) AS cnt FROM post_reactions WHERE post_id = $1',
        [postId]
      );
      const likesCount = Number(cntRes.rows[0]?.cnt || 0);
      await client.query(
        `UPDATE posts SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{likes}', to_jsonb($2::int), TRUE) WHERE id = $1`,
        [postId, likesCount]
      );
      return { isLiked, reaction, likesCount };
    });
  }

  public async isPostSaved(postId: string, userId: string): Promise<boolean> {
    const res = await pgQuery('SELECT 1 FROM saved_posts WHERE post_id = $1 AND user_id = $2 LIMIT 1', [postId, userId]);
    return res.rows.length > 0;
  }

  public async toggleSavePost(postId: string, userId: string): Promise<boolean> {
    return withPgTransaction(async (client) => {
      const del = await client.query('DELETE FROM saved_posts WHERE post_id = $1 AND user_id = $2', [postId, userId]);
      if ((del.rowCount || 0) > 0) return false;
      await client.query(
        'INSERT INTO saved_posts (post_id, user_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
        [postId, userId]
      );
      return true;
    });
  }

  public async getUserSavedPostIds(userId: string): Promise<string[]> {
    const res = await pgQuery<{ post_id: string }>('SELECT post_id FROM saved_posts WHERE user_id = $1 ORDER BY created_at DESC', [
      userId,
    ]);
    return res.rows.map((r) => r.post_id);
  }

  // ==========================================
  // POSTS & FEED HYDRATION
  // ==========================================
  public async hydratePostForUser(post: Post, userId?: string): Promise<Post> {
    const [hydrated] = await this.hydratePostsForUserBatch([post], userId);
    return hydrated;
  }

  public async hydratePostsForUserBatch(posts: Post[], userId?: string): Promise<Post[]> {
    if (posts.length === 0) return [];
    const postIds = posts.map((p) => p.id);

    const [countsRes, userReactRes, userSavedRes] = await Promise.all([
      pgQuery<{ post_id: string; cnt: string }>(
        'SELECT post_id, COUNT(*) AS cnt FROM post_reactions WHERE post_id = ANY($1::text[]) GROUP BY post_id',
        [postIds]
      ),
      userId
        ? pgQuery<{ post_id: string; type: ReactionType }>(
            'SELECT post_id, type FROM post_reactions WHERE user_id = $1 AND post_id = ANY($2::text[])',
            [userId, postIds]
          )
        : Promise.resolve({ rows: [] as { post_id: string; type: ReactionType }[] }),
      userId
        ? pgQuery<{ post_id: string }>(
            'SELECT post_id FROM saved_posts WHERE user_id = $1 AND post_id = ANY($2::text[])',
            [userId, postIds]
          )
        : Promise.resolve({ rows: [] as { post_id: string }[] }),
    ]);

    const likesMap = new Map(countsRes.rows.map((r) => [r.post_id, Number(r.cnt || 0)]));
    const reactMap = new Map(userReactRes.rows.map((r) => [r.post_id, r.type]));
    const savedSet = new Set(userSavedRes.rows.map((r) => r.post_id));

    return posts.map((post) => {
      const reactCount = likesMap.get(post.id) ?? 0;
      const userReaction = reactMap.get(post.id);
      return {
        ...post,
        stats: {
          ...post.stats,
          likes: reactCount > 0 ? reactCount : post.stats?.likes || 0,
        },
        userInteractions: {
          isLiked: Boolean(userReaction),
          reaction: userReaction,
          isSaved: savedSet.has(post.id),
        },
      };
    });
  }

  public async canViewerSeePost(viewerId: string | undefined, post: Post): Promise<boolean> {
    const authorId = post.author?.id;
    if (!authorId) return post.audience === 'public';
    if (viewerId && viewerId === authorId) return true;
    if (viewerId && (await this.isBlocked(viewerId, authorId))) return false;

    const authorAcc = await this.findUserById(authorId);
    if (post.audience === 'only_me') return false;
    if (post.audience === 'friends') {
      return Boolean(viewerId && (await this.isFriend(viewerId, authorId)));
    }
    if (authorAcc) {
      if (authorAcc.privacy?.profileVisibility === 'private') return false;
      if (authorAcc.privacy?.profileVisibility === 'friends' || authorAcc.isPrivate) {
        return Boolean(viewerId && (await this.isFriend(viewerId, authorId)));
      }
    }
    return true;
  }

  public async getScoredForYouPosts(viewerId?: string): Promise<Post[]> {
    const allPosts = await this.getAllPosts();
    const eligible: Post[] = [];
    for (const p of allPosts) {
      if (await this.canViewerSeePost(viewerId, p)) eligible.push(p);
    }
    if (eligible.length === 0) return [];

    const viewerFriendIds = viewerId ? new Set(await this.getFriendIds(viewerId)) : new Set<string>();
    const viewerFollowIds = new Set<string>();
    const interestTags = new Map<string, number>();

    if (viewerId) {
      const [followsRes, reactsRes, savedRes] = await Promise.all([
        pgQuery<{ following_id: string }>('SELECT following_id FROM follows WHERE follower_id = $1', [viewerId]),
        pgQuery<{ post_id: string }>('SELECT post_id FROM post_reactions WHERE user_id = $1', [viewerId]),
        pgQuery<{ post_id: string }>('SELECT post_id FROM saved_posts WHERE user_id = $1', [viewerId]),
      ]);
      for (const r of followsRes.rows) viewerFollowIds.add(r.following_id);
      const interactedIds = new Set([
        ...reactsRes.rows.map((r) => r.post_id),
        ...savedRes.rows.map((r) => r.post_id),
      ]);
      for (const p of allPosts) {
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
      for (const tag of post.hashtags || []) {
        const w = interestTags.get(tag.toLowerCase()) || 0;
        if (w > 0) score += Math.min(15, w * 4);
      }
      if (post.mediaType === 'video') score += 5;
      else if (post.mediaType === 'image') score += 4;
      else score += 2;

      const reactionCount = post.stats?.likes || 0;
      const commentCount = post.stats?.comments || 0;
      const shareCount = post.stats?.shares || 0;
      const engagement = reactionCount * 1.5 + commentCount * 2.5 + shareCount * 2;
      score += Math.log10(engagement + 1) * 9;

      const ageHours = Math.max(0, (now - new Date(post.createdAt).getTime()) / (1000 * 60 * 60));
      score += 24 / (1 + ageHours / 18);
      return { post, score };
    });

    scored.sort((a, b) => b.score - a.score);

    const remaining = [...scored];
    const diversified: Post[] = [];
    const seenRecentAuthors: string[] = [];
    while (remaining.length > 0) {
      let pickIdx = remaining.findIndex((item) => !seenRecentAuthors.includes(item.post.author?.id || ''));
      if (pickIdx === -1) pickIdx = 0;
      const [picked] = remaining.splice(pickIdx, 1);
      diversified.push(picked.post);
      seenRecentAuthors.push(picked.post.author?.id || '');
      if (seenRecentAuthors.length > 2) seenRecentAuthors.shift();
    }
    return diversified;
  }

  public async getAllPosts(): Promise<Post[]> {
    const res = await pgQuery('SELECT * FROM posts ORDER BY created_at DESC');
    return res.rows.map(mapPostRow);
  }

  public async findPostById(postId: string): Promise<Post | undefined> {
    const res = await pgQuery('SELECT * FROM posts WHERE id = $1 LIMIT 1', [postId]);
    return res.rows[0] ? mapPostRow(res.rows[0]) : undefined;
  }

  public async addPost(post: Post): Promise<Post> {
    await pgQuery(
      `INSERT INTO posts (
        id, source, external_id, author_id, author_snapshot, content, media_type,
        media_url, images, thumbnail_url, media_aspect_ratio, hashtags, audience,
        stats, shared_post, is_edited, edited_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5::jsonb, $6, $7,
        $8, $9::jsonb, $10, $11, $12::jsonb, $13,
        $14::jsonb, $15::jsonb, $16, $17, $18
      )`,
      [
        post.id,
        post.source || 'motherland',
        post.externalId || null,
        post.author.id,
        JSON.stringify(post.author),
        post.content || '',
        post.mediaType || 'none',
        post.mediaUrl || null,
        post.images ? JSON.stringify(post.images) : null,
        post.thumbnailUrl || null,
        post.mediaAspectRatio || '16:9',
        JSON.stringify(post.hashtags || []),
        post.audience || 'public',
        JSON.stringify(post.stats || { likes: 0, comments: 0, shares: 0, views: 0 }),
        post.sharedPost ? JSON.stringify(post.sharedPost) : null,
        Boolean(post.isEdited),
        post.editedAt || null,
        post.createdAt || new Date().toISOString(),
      ]
    );

    const urls = [post.mediaUrl, ...(post.images || [])].filter((u): u is string =>
      Boolean(u && u.startsWith('/uploads/'))
    );
    if (urls.length > 0 && post.audience !== 'public') {
      await this.syncMediaVisibilityForUrls(urls, post.author.id, 'private');
    }
    return post;
  }

  public async updatePost(
    postId: string,
    actorId: string,
    actorRole: UserAccount['role'] | undefined,
    updates: { content?: string; audience?: 'public' | 'friends' | 'only_me'; hashtags?: string[] }
  ): Promise<{ ok: boolean; statusCode: number; error?: string; post?: Post }> {
    const existing = await this.findPostById(postId);
    if (!existing) return { ok: false, statusCode: 404, error: 'Post not found' };
    if (existing.author.id !== actorId && actorRole !== 'owner') {
      return { ok: false, statusCode: 403, error: 'Unauthorized to edit this post' };
    }

    let nextContent = existing.content;
    if (typeof updates.content === 'string') {
      const trimmed = updates.content.trim();
      if (!trimmed && !existing.mediaUrl && (!existing.images || existing.images.length === 0)) {
        return { ok: false, statusCode: 400, error: 'Post must contain text or media' };
      }
      nextContent = trimmed.slice(0, 10000);
    }

    const nextAudience =
      updates.audience && ['public', 'friends', 'only_me'].includes(updates.audience)
        ? updates.audience
        : existing.audience;
    const nextHashtags = Array.isArray(updates.hashtags)
      ? updates.hashtags.map((h) => String(h).slice(0, 48))
      : existing.hashtags || [];
    const editedAt = new Date().toISOString();

    const res = await pgQuery(
      `UPDATE posts
       SET content = $2, audience = $3, hashtags = $4::jsonb, is_edited = TRUE, edited_at = $5
       WHERE id = $1
       RETURNING *`,
      [postId, nextContent, nextAudience, JSON.stringify(nextHashtags), editedAt]
    );

    const updatedPost = mapPostRow(res.rows[0]);
    if (updates.audience) {
      const urls = [updatedPost.mediaUrl, ...(updatedPost.images || [])].filter((u): u is string =>
        Boolean(u && u.startsWith('/uploads/'))
      );
      if (urls.length > 0) {
        await this.syncMediaVisibilityForUrls(
          urls,
          updatedPost.author.id,
          nextAudience === 'public' ? 'public' : 'private'
        );
      }
    }

    return { ok: true, statusCode: 200, post: await this.hydratePostForUser(updatedPost, actorId) };
  }

  public async deletePost(postId: string): Promise<boolean> {
    const res = await pgQuery('DELETE FROM posts WHERE id = $1', [postId]);
    return (res.rowCount || 0) > 0;
  }

  public async incrementPostShare(postId: string): Promise<number> {
    const res = await pgQuery<{ shares: string }>(
      `UPDATE posts
       SET stats = jsonb_set(
         COALESCE(stats, '{"likes":0,"comments":0,"shares":0,"views":0}'::jsonb),
         '{shares}',
         to_jsonb(COALESCE((stats->>'shares')::int, 0) + 1),
         TRUE
       )
       WHERE id = $1
       RETURNING stats->>'shares' AS shares`,
      [postId]
    );
    return Number(res.rows[0]?.shares || 0);
  }

  // ==========================================
  // COMMENTS
  // ==========================================
  public async getComments(postId: string, viewerId?: string): Promise<any[]> {
    const res = await pgQuery(
      'SELECT * FROM post_comments WHERE post_id = $1 ORDER BY created_at ASC',
      [postId]
    );
    return res.rows.map((r: any) => {
      const likedBy: string[] = Array.isArray(r.liked_by) ? r.liked_by : [];
      return {
        id: r.id,
        postId: r.post_id,
        ...(r.parent_id ? { parentId: r.parent_id } : {}),
        userId: r.user_id,
        userDisplayName: r.user_display_name,
        userUsername: r.user_username,
        userAvatar: r.user_avatar,
        text: r.text,
        likedBy,
        likesCount: Math.max(likedBy.length, Number(r.likes_count || 0)),
        isLiked: viewerId ? likedBy.includes(viewerId) : false,
        isEdited: Boolean(r.is_edited),
        editedAt: toOptionalIso(r.edited_at),
        createdAt: toIso(r.created_at),
      };
    });
  }

  public async addComment(postId: string, comment: any): Promise<any> {
    const likedBy = Array.isArray(comment.likedBy) ? comment.likedBy : [];
    await withPgTransaction(async (client) => {
      await client.query(
        `INSERT INTO post_comments (
          id, post_id, parent_id, user_id, user_display_name, user_username, user_avatar,
          text, liked_by, likes_count, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)`,
        [
          comment.id,
          postId,
          comment.parentId || null,
          comment.userId,
          comment.userDisplayName,
          comment.userUsername,
          comment.userAvatar || '',
          comment.text,
          JSON.stringify(likedBy),
          likedBy.length,
          comment.createdAt || new Date().toISOString(),
        ]
      );
      const cnt = await client.query<{ cnt: string }>(
        'SELECT COUNT(*) AS cnt FROM post_comments WHERE post_id = $1',
        [postId]
      );
      await client.query(
        `UPDATE posts SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{comments}', to_jsonb($2::int), TRUE) WHERE id = $1`,
        [postId, Number(cnt.rows[0]?.cnt || 0)]
      );
    });
    return { ...comment, likedBy };
  }

  public async editComment(
    postId: string,
    commentId: string,
    actorId: string,
    actorRole: UserAccount['role'] | undefined,
    text: string
  ): Promise<{ ok: boolean; statusCode: number; error?: string; comment?: any }> {
    const res = await pgQuery('SELECT * FROM post_comments WHERE id = $1 AND post_id = $2 LIMIT 1', [
      commentId,
      postId,
    ]);
    const row = res.rows[0];
    if (!row) return { ok: false, statusCode: 404, error: 'Comment not found' };
    if (row.user_id !== actorId && actorRole !== 'owner') {
      return { ok: false, statusCode: 403, error: 'Unauthorized to edit this comment' };
    }
    const clean = text.trim().slice(0, 2000);
    const editedAt = new Date().toISOString();
    const upd = await pgQuery(
      'UPDATE post_comments SET text = $3, is_edited = TRUE, edited_at = $4 WHERE id = $1 AND post_id = $2 RETURNING *',
      [commentId, postId, clean, editedAt]
    );
    const r = upd.rows[0];
    const likedBy: string[] = Array.isArray(r.liked_by) ? r.liked_by : [];
    return {
      ok: true,
      statusCode: 200,
      comment: {
        id: r.id,
        postId: r.post_id,
        parentId: r.parent_id || undefined,
        userId: r.user_id,
        userDisplayName: r.user_display_name,
        userUsername: r.user_username,
        userAvatar: r.user_avatar,
        text: r.text,
        likedBy,
        likesCount: Math.max(likedBy.length, Number(r.likes_count || 0)),
        isLiked: likedBy.includes(actorId),
        isEdited: true,
        editedAt,
        createdAt: toIso(r.created_at),
      },
    };
  }

  public async deleteComment(
    postId: string,
    commentId: string,
    actorId: string,
    actorRole: UserAccount['role'] | undefined
  ): Promise<{ ok: boolean; statusCode: number; error?: string; totalComments?: number }> {
    return withPgTransaction(async (client) => {
      const cRes = await client.query('SELECT user_id FROM post_comments WHERE id = $1 AND post_id = $2 LIMIT 1', [
        commentId,
        postId,
      ]);
      if (!cRes.rows[0]) return { ok: false, statusCode: 404, error: 'Comment not found' };

      const pRes = await client.query('SELECT author_id FROM posts WHERE id = $1 LIMIT 1', [postId]);
      const isPostOwner = pRes.rows[0]?.author_id === actorId;
      if (cRes.rows[0].user_id !== actorId && !isPostOwner && actorRole !== 'owner') {
        return { ok: false, statusCode: 403, error: 'Unauthorized to delete this comment' };
      }

      await client.query(
        'DELETE FROM post_comments WHERE post_id = $1 AND (id = $2 OR parent_id = $2)',
        [postId, commentId]
      );
      const cntRes = await client.query<{ cnt: string }>(
        'SELECT COUNT(*) AS cnt FROM post_comments WHERE post_id = $1',
        [postId]
      );
      const totalComments = Number(cntRes.rows[0]?.cnt || 0);
      await client.query(
        `UPDATE posts SET stats = jsonb_set(COALESCE(stats, '{}'::jsonb), '{comments}', to_jsonb($2::int), TRUE) WHERE id = $1`,
        [postId, totalComments]
      );
      return { ok: true, statusCode: 200, totalComments };
    });
  }

  public async toggleCommentLike(
    postId: string,
    commentId: string,
    userId: string
  ): Promise<{ ok: boolean; comment?: any; isLiked?: boolean; likesCount?: number }> {
    return withPgTransaction(async (client) => {
      const res = await client.query(
        'SELECT * FROM post_comments WHERE id = $1 AND post_id = $2 FOR UPDATE',
        [commentId, postId]
      );
      const r = res.rows[0];
      if (!r) return { ok: false };
      const likedBy: string[] = Array.isArray(r.liked_by) ? [...r.liked_by] : [];
      const idx = likedBy.indexOf(userId);
      let isLiked = false;
      if (idx >= 0) {
        likedBy.splice(idx, 1);
        isLiked = false;
      } else {
        likedBy.push(userId);
        isLiked = true;
      }
      const likesCount = likedBy.length;
      await client.query(
        'UPDATE post_comments SET liked_by = $3::jsonb, likes_count = $4 WHERE id = $1 AND post_id = $2',
        [commentId, postId, JSON.stringify(likedBy), likesCount]
      );
      return {
        ok: true,
        isLiked,
        likesCount,
        comment: {
          id: r.id,
          postId: r.post_id,
          parentId: r.parent_id || undefined,
          userId: r.user_id,
          userDisplayName: r.user_display_name,
          userUsername: r.user_username,
          userAvatar: r.user_avatar,
          text: r.text,
          likedBy,
          likesCount,
          isLiked,
          createdAt: toIso(r.created_at),
        },
      };
    });
  }

  // ==========================================
  // STORIES
  // ==========================================
  public async getActiveStories(nowMs = Date.now()): Promise<Story[]> {
    const res = await pgQuery('SELECT * FROM stories WHERE expires_at > $1 ORDER BY created_at DESC', [
      new Date(nowMs).toISOString(),
    ]);
    return res.rows.map(mapStoryRow);
  }

  public async addStory(story: Story): Promise<Story> {
    const createdMs = Number.isFinite(Date.parse(story.createdAt)) ? Date.parse(story.createdAt) : Date.now();
    const canonicalCreatedIso = new Date(createdMs).toISOString();
    const canonicalExpiresIso = new Date(createdMs + 24 * 60 * 60 * 1000).toISOString();
    const normalized: Story = {
      ...story,
      createdAt: canonicalCreatedIso,
      expiresAt: canonicalExpiresIso,
    };
    await pgQuery(
      `INSERT INTO stories (
        id, user_id, user_display_name, user_username, user_avatar, is_user_verified,
        source, media_url, media_type, caption, viewers_count, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        normalized.id,
        normalized.userId,
        normalized.userDisplayName,
        normalized.userUsername,
        normalized.userAvatar || '',
        Boolean(normalized.isUserVerified),
        normalized.source || 'motherland',
        normalized.mediaUrl,
        normalized.mediaType || 'image',
        normalized.caption || '',
        Number(normalized.viewersCount || 0),
        normalized.createdAt,
        normalized.expiresAt,
      ]
    );
    return normalized;
  }

  public async recordStoryView(storyId: string): Promise<void> {
    await pgQuery('UPDATE stories SET viewers_count = viewers_count + 1 WHERE id = $1', [storyId]);
  }

  public async deleteStory(storyId: string): Promise<boolean> {
    const res = await pgQuery('DELETE FROM stories WHERE id = $1', [storyId]);
    return (res.rowCount || 0) > 0;
  }

  public async expireStoriesOlderThan24hUtc(nowMs = Date.now()) {
    const checkedAtUtc = new Date(nowMs).toISOString();
    return withPgTransaction(async (client) => {
      const expired = await client.query<{
        id: string;
        user_id: string;
        media_url: string;
        created_at: Date;
        expires_at: Date;
      }>(
        `DELETE FROM stories
         WHERE expires_at <= $1
         RETURNING id, user_id, media_url, created_at, expires_at`,
        [checkedAtUtc]
      );

      for (const row of expired.rows) {
        await client.query(
          `INSERT INTO expired_stories_archive (id, user_id, media_url, created_at, expires_at, expired_at_utc)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [row.id, row.user_id, row.media_url, row.created_at, row.expires_at, checkedAtUtc]
        );
      }

      const activeRes = await client.query<{ cnt: string }>(
        'SELECT COUNT(*) AS cnt FROM stories WHERE expires_at > $1',
        [checkedAtUtc]
      );
      return {
        expiredCount: expired.rowCount || 0,
        activeCount: Number(activeRes.rows[0]?.cnt || 0),
        checkedAtUtc,
      };
    });
  }

  // ==========================================
  // MEDIA ASSETS & PRIVATE MEDIA AUTHORIZATION
  // ==========================================
  public async registerMediaAsset(asset: MediaAssetRecord): Promise<MediaAssetRecord> {
    const now = new Date().toISOString();
    const res = await pgQuery(
      `INSERT INTO media_assets (
        id, owner_id, original_filename, stored_filename, url, storage_key, bucket,
        visibility, conversation_id, mime_type, size_bytes, sha256, storage_provider, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15
      )
      ON CONFLICT (stored_filename) DO UPDATE SET
        original_filename = EXCLUDED.original_filename,
        url = EXCLUDED.url,
        storage_key = COALESCE(EXCLUDED.storage_key, media_assets.storage_key),
        bucket = COALESCE(EXCLUDED.bucket, media_assets.bucket),
        visibility = EXCLUDED.visibility,
        conversation_id = COALESCE(EXCLUDED.conversation_id, media_assets.conversation_id),
        mime_type = EXCLUDED.mime_type,
        size_bytes = EXCLUDED.size_bytes,
        sha256 = EXCLUDED.sha256,
        storage_provider = EXCLUDED.storage_provider,
        updated_at = EXCLUDED.updated_at
      RETURNING *`,
      [
        asset.id,
        asset.ownerId,
        asset.originalFilename,
        asset.storedFilename,
        asset.url,
        asset.storageKey || null,
        asset.bucket || null,
        asset.visibility === 'private' ? 'private' : 'public',
        asset.conversationId || null,
        asset.mimeType,
        asset.sizeBytes,
        asset.sha256,
        asset.storageProvider,
        asset.createdAt || now,
        asset.updatedAt || now,
      ]
    );
    return mapMediaRow(res.rows[0]);
  }

  public async getMediaAsset(idOrFilename: string): Promise<MediaAssetRecord | undefined> {
    const clean = path.basename(idOrFilename);
    const res = await pgQuery(
      'SELECT * FROM media_assets WHERE id = $1 OR stored_filename = $2 OR url = $1 LIMIT 1',
      [idOrFilename, clean]
    );
    return res.rows[0] ? mapMediaRow(res.rows[0]) : undefined;
  }

  public async getUserMediaAssets(userId: string): Promise<MediaAssetRecord[]> {
    const res = await pgQuery('SELECT * FROM media_assets WHERE owner_id = $1 ORDER BY created_at DESC', [userId]);
    return res.rows.map(mapMediaRow);
  }

  public async deleteOwnedMediaAsset(
    idOrFilename: string,
    actorUserId: string,
    actorRole?: UserAccount['role']
  ): Promise<{ ok: boolean; statusCode: number; error?: string; asset?: MediaAssetRecord }> {
    const asset = await this.getMediaAsset(idOrFilename);
    if (!asset) return { ok: false, statusCode: 404, error: 'Media asset not found.' };
    if (asset.ownerId !== actorUserId && actorRole !== 'owner') {
      return { ok: false, statusCode: 403, error: 'Forbidden: you can only delete your own media.' };
    }
    await pgQuery('DELETE FROM media_assets WHERE id = $1', [asset.id]);
    return { ok: true, statusCode: 200, asset };
  }

  public async syncMediaVisibilityForUrls(
    urls: string[],
    ownerId: string,
    visibility: 'public' | 'private',
    conversationId?: string
  ): Promise<void> {
    if (urls.length === 0) return;
    const filenames = urls.map((u) => path.basename(u));
    await pgQuery(
      `UPDATE media_assets
       SET visibility = $1,
           conversation_id = COALESCE($2, conversation_id),
           updated_at = NOW()
       WHERE owner_id = $3 AND (url = ANY($4::text[]) OR stored_filename = ANY($5::text[]))`,
      [visibility, conversationId || null, ownerId, urls, filenames]
    );
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
      const partRes = await pgQuery(
        'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
        [asset.conversationId, viewerId]
      );
      if (partRes.rows.length > 0) return { allowed: true, statusCode: 200 };
      return { allowed: false, statusCode: 403, reason: 'Forbidden: private conversation media.' };
    }
    const postRes = await pgQuery(
      `SELECT * FROM posts
       WHERE media_url = $1 OR (images IS NOT NULL AND images ? $1)
       LIMIT 1`,
      [asset.url]
    );
    if (postRes.rows[0]) {
      const post = mapPostRow(postRes.rows[0]);
      if (await this.canViewerSeePost(viewerId, post)) {
        return { allowed: true, statusCode: 200 };
      }
    }
    return { allowed: false, statusCode: 403, reason: 'Forbidden: you do not have permission to view this private media.' };
  }

  // ==========================================
  // SHORTS & LONG VIDEOS
  // ==========================================
  public async getShortVideos(): Promise<ShortVideo[]> {
    const res = await pgQuery('SELECT payload FROM short_videos ORDER BY created_at DESC');
    return res.rows.map((r: any) => r.payload as ShortVideo);
  }

  public async addShortVideo(short: ShortVideo): Promise<ShortVideo> {
    await pgQuery(
      `INSERT INTO short_videos (id, author_id, source, youtube_id, payload, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
      [short.id, short.creator?.id || null, short.source || 'motherland', short.youtubeId || null, JSON.stringify(short)]
    );
    return short;
  }

  public async getLongVideos(): Promise<LongVideo[]> {
    const res = await pgQuery('SELECT payload FROM long_videos ORDER BY created_at DESC');
    return res.rows.map((r: any) => r.payload as LongVideo);
  }

  public async addLongVideo(video: LongVideo): Promise<LongVideo> {
    await pgQuery(
      `INSERT INTO long_videos (id, author_id, source, youtube_id, payload, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
      [video.id, video.channel?.id || null, video.source || 'motherland', video.youtubeId || null, JSON.stringify(video)]
    );
    return video;
  }

  // ==========================================
  // FRIENDSHIPS, FOLLOWS & BLOCKS
  // ==========================================
  public async getFriendIds(userId: string): Promise<string[]> {
    const res = await pgQuery<{ fid: string }>(
      `SELECT CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END AS fid
       FROM friendships
       WHERE user1_id = $1 OR user2_id = $1`,
      [userId]
    );
    return Array.from(new Set(res.rows.map((r) => r.fid)));
  }

  public async isFriend(userA: string, userB: string): Promise<boolean> {
    const res = await pgQuery(
      'SELECT 1 FROM friendships WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1) LIMIT 1',
      [userA, userB]
    );
    return res.rows.length > 0;
  }

  public async addFriendship(userA: string, userB: string): Promise<void> {
    await withPgTransaction(async (client) => {
      const existing = await client.query(
        'SELECT 1 FROM friendships WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1) LIMIT 1',
        [userA, userB]
      );
      if (existing.rows.length === 0) {
        const [u1, u2] = [userA, userB].sort();
        await client.query(
          'INSERT INTO friendships (user1_id, user2_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
          [u1, u2]
        );
      }
      if (userA !== userB) {
        await client.query(
          'INSERT INTO follows (follower_id, following_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
          [userA, userB]
        );
        await client.query(
          'INSERT INTO follows (follower_id, following_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
          [userB, userA]
        );
      }
    });
  }

  public async removeFriendship(userA: string, userB: string): Promise<void> {
    await pgQuery(
      'DELETE FROM friendships WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)',
      [userA, userB]
    );
  }

  public async getMutualFriendCount(userA: string, userB: string): Promise<number> {
    if (!userA || !userB || userA === userB) return 0;
    const [aList, bList] = await Promise.all([this.getFriendIds(userA), this.getFriendIds(userB)]);
    const setA = new Set(aList);
    let count = 0;
    for (const id of bList) if (setA.has(id)) count++;
    return count;
  }

  public async getRelationshipStatus(
    viewerId: string,
    targetId: string
  ): Promise<{ status: RelationshipStatus; requestId?: string }> {
    if (!viewerId || !targetId) return { status: 'none' };
    if (viewerId === targetId) return { status: 'self' };
    if (await this.isBlocked(viewerId, targetId)) return { status: 'blocked' };
    if (await this.isFriend(viewerId, targetId)) return { status: 'friend' };

    const reqRes = await pgQuery<{ id: string; sender_id: string; receiver_id: string }>(
      `SELECT id, sender_id, receiver_id FROM friend_requests
       WHERE status = 'pending'
         AND ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
       LIMIT 1`,
      [viewerId, targetId]
    );
    const row = reqRes.rows[0];
    if (row) {
      return row.sender_id === viewerId
        ? { status: 'pending_sent', requestId: row.id }
        : { status: 'pending_received', requestId: row.id };
    }
    return { status: 'none' };
  }

  public async getFriendRequests(userId: string): Promise<FriendRequest[]> {
    const res = await pgQuery(
      `SELECT fr.*, u.*
       FROM friend_requests fr
       JOIN users u ON u.id = fr.sender_id
       WHERE fr.receiver_id = $1 AND fr.status = 'pending'
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.user_id = $1 AND b.blocked_user_id = fr.sender_id)
              OR (b.user_id = fr.sender_id AND b.blocked_user_id = $1)
         )
       ORDER BY fr.created_at DESC`,
      [userId]
    );
    const out: FriendRequest[] = [];
    for (const r of res.rows) {
      out.push({
        id: r.id,
        sender: await this.toPublicProfile(mapUserRow(r), userId),
        receiverId: r.receiver_id,
        status: r.status,
        createdAt: toIso(r.created_at),
      });
    }
    return out;
  }

  public async getSentFriendRequests(userId: string): Promise<FriendRequest[]> {
    const senderAcc = await this.findUserById(userId);
    const res = await pgQuery(
      `SELECT fr.id AS req_id, fr.receiver_id, fr.status, fr.created_at AS req_created_at, u.*
       FROM friend_requests fr
       JOIN users u ON u.id = fr.receiver_id
       WHERE fr.sender_id = $1 AND fr.status = 'pending'
         AND NOT EXISTS (
           SELECT 1 FROM blocks b
           WHERE (b.user_id = $1 AND b.blocked_user_id = fr.receiver_id)
              OR (b.user_id = fr.receiver_id AND b.blocked_user_id = $1)
         )
       ORDER BY fr.created_at DESC`,
      [userId]
    );
    const senderProfile = senderAcc ? await this.toPublicProfile(senderAcc, userId) : ({ id: userId } as UserProfile);
    const out: FriendRequest[] = [];
    for (const r of res.rows) {
      out.push({
        id: r.req_id,
        sender: senderProfile,
        receiverId: r.receiver_id,
        recipient: await this.toPublicProfile(mapUserRow(r), userId),
        status: r.status,
        createdAt: toIso(r.req_created_at),
      });
    }
    return out;
  }

  public async createFriendRequestSafe(
    senderId: string,
    receiverId: string
  ): Promise<{ request?: FriendRequest; error?: string; autoAccepted?: boolean; alreadyPending?: boolean }> {
    if (!senderId || !receiverId || senderId === receiverId) {
      return { error: 'Cannot send a friend request to yourself.' };
    }
    const [senderAcc, receiverAcc] = await Promise.all([
      this.findUserById(senderId),
      this.findUserById(receiverId),
    ]);
    if (!senderAcc || !receiverAcc) return { error: 'User account not found.' };
    if (await this.isBlocked(senderId, receiverId)) {
      return { error: 'Unable to send friend request due to block settings.' };
    }
    if (await this.isFriend(senderId, receiverId)) {
      return { error: 'You are already friends with this user.' };
    }

    const existingSent = await pgQuery(
      `SELECT * FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending' LIMIT 1`,
      [senderId, receiverId]
    );
    if (existingSent.rows[0]) {
      const r = existingSent.rows[0];
      return {
        request: {
          id: r.id,
          sender: r.sender_snapshot,
          receiverId: r.receiver_id,
          recipient: r.recipient_snapshot || undefined,
          status: r.status,
          createdAt: toIso(r.created_at),
        },
        alreadyPending: true,
      };
    }

    const reversePending = await pgQuery(
      `SELECT * FROM friend_requests WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending' LIMIT 1`,
      [receiverId, senderId]
    );
    if (reversePending.rows[0]) {
      const r = reversePending.rows[0];
      await pgQuery(`UPDATE friend_requests SET status = 'accepted' WHERE id = $1`, [r.id]);
      await this.addFriendship(senderId, receiverId);
      return {
        request: {
          id: r.id,
          sender: r.sender_snapshot,
          receiverId: r.receiver_id,
          recipient: r.recipient_snapshot || undefined,
          status: 'accepted',
          createdAt: toIso(r.created_at),
        },
        autoAccepted: true,
      };
    }

    const [senderSnap, recipientSnap] = await Promise.all([
      this.toPublicProfile(senderAcc),
      this.toPublicProfile(receiverAcc),
    ]);
    const reqItem: FriendRequest = {
      id: `fr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      sender: senderSnap,
      receiverId,
      recipient: recipientSnap,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await pgQuery(
      `INSERT INTO friend_requests (id, sender_id, receiver_id, sender_snapshot, recipient_snapshot, status, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'pending', $6)`,
      [reqItem.id, senderId, receiverId, JSON.stringify(senderSnap), JSON.stringify(recipientSnap), reqItem.createdAt]
    );
    return { request: reqItem };
  }

  public async respondFriendRequest(
    requestId: string,
    action: 'accept' | 'reject' | 'cancel',
    actingUserId?: string
  ): Promise<{ ok: boolean; error?: string; request?: FriendRequest }> {
    const res = await pgQuery('SELECT * FROM friend_requests WHERE id = $1 LIMIT 1', [requestId]);
    const r = res.rows[0];
    if (!r) return { ok: false, error: 'Friend request not found.' };
    if (r.status !== 'pending') return { ok: false, error: 'This friend request has already been processed.' };

    if (actingUserId) {
      if ((action === 'accept' || action === 'reject') && r.receiver_id !== actingUserId) {
        return { ok: false, error: 'Only the recipient can accept or decline this request.' };
      }
      if (action === 'cancel' && r.sender_id !== actingUserId) {
        return { ok: false, error: 'Only the sender can cancel this request.' };
      }
    }

    let nextStatus: FriendRequest['status'];
    if (action === 'accept') nextStatus = 'accepted';
    else if (action === 'reject') nextStatus = 'rejected';
    else if (action === 'cancel') nextStatus = 'canceled';
    else return { ok: false, error: 'Invalid friend request action.' };

    await withPgTransaction(async (client) => {
      await client.query('UPDATE friend_requests SET status = $2 WHERE id = $1', [requestId, nextStatus]);
      if (action === 'accept') {
        await client.query(
          `UPDATE friend_requests SET status = 'accepted'
           WHERE id <> $1 AND status = 'pending' AND sender_id = $2 AND receiver_id = $3`,
          [requestId, r.receiver_id, r.sender_id]
        );
      }
    });

    if (action === 'accept') {
      await this.addFriendship(r.sender_id, r.receiver_id);
    }

    return {
      ok: true,
      request: {
        id: r.id,
        sender: r.sender_snapshot,
        receiverId: r.receiver_id,
        recipient: r.recipient_snapshot || undefined,
        status: nextStatus,
        createdAt: toIso(r.created_at),
      },
    };
  }

  public async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    if (!followerId || !followingId || followerId === followingId) return false;
    const res = await pgQuery('SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1', [
      followerId,
      followingId,
    ]);
    return res.rows.length > 0;
  }

  public async follow(followerId: string, followingId: string): Promise<boolean> {
    if (!followerId || !followingId || followerId === followingId) return false;
    if (await this.isBlocked(followerId, followingId)) return false;
    const [a, b] = await Promise.all([this.findUserById(followerId), this.findUserById(followingId)]);
    if (!a || !b) return false;
    await pgQuery(
      'INSERT INTO follows (follower_id, following_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
      [followerId, followingId]
    );
    return true;
  }

  public async unfollow(followerId: string, followingId: string): Promise<boolean> {
    const res = await pgQuery('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [
      followerId,
      followingId,
    ]);
    return (res.rowCount || 0) > 0;
  }

  public async isBlocked(userId: string, targetUserId: string): Promise<boolean> {
    if (!userId || !targetUserId) return false;
    const res = await pgQuery(
      'SELECT 1 FROM blocks WHERE (user_id = $1 AND blocked_user_id = $2) OR (user_id = $2 AND blocked_user_id = $1) LIMIT 1',
      [userId, targetUserId]
    );
    return res.rows.length > 0;
  }

  public async toggleBlock(userId: string, targetUserId: string): Promise<boolean> {
    return withPgTransaction(async (client) => {
      const del = await client.query('DELETE FROM blocks WHERE user_id = $1 AND blocked_user_id = $2', [
        userId,
        targetUserId,
      ]);
      if ((del.rowCount || 0) > 0) return false;

      await client.query(
        'INSERT INTO blocks (user_id, blocked_user_id, created_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING',
        [userId, targetUserId]
      );
      await client.query(
        'DELETE FROM friendships WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)',
        [userId, targetUserId]
      );
      await client.query(
        'DELETE FROM follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)',
        [userId, targetUserId]
      );
      return true;
    });
  }

  public async getBlockedUserIds(userId: string): Promise<string[]> {
    const res = await pgQuery<{ blocked_user_id: string }>(
      'SELECT blocked_user_id FROM blocks WHERE user_id = $1',
      [userId]
    );
    return res.rows.map((r) => r.blocked_user_id);
  }

  public async getSuggestedFriends(userId: string): Promise<UserProfile[]> {
    const res = await pgQuery(
      `SELECT u.* FROM users u
       WHERE u.id <> $1
         AND NOT EXISTS (SELECT 1 FROM friendships f WHERE (f.user1_id = $1 AND f.user2_id = u.id) OR (f.user1_id = u.id AND f.user2_id = $1))
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE b.user_id = $1 AND b.blocked_user_id = u.id)
         AND NOT EXISTS (SELECT 1 FROM friend_requests fr WHERE fr.sender_id = $1 AND fr.receiver_id = u.id AND fr.status = 'pending')
       ORDER BY u.created_at ASC`,
      [userId]
    );
    const totalEligible = res.rows.length;
    let maxCount = 0;
    if (totalEligible < 3) maxCount = 0;
    else if (totalEligible === 3) maxCount = 2;
    else if (totalEligible < 10) maxCount = Math.min(3, totalEligible - 1);
    else if (totalEligible < 50) maxCount = Math.min(5, Math.floor(totalEligible * 0.4));
    else maxCount = Math.min(12, Math.floor(totalEligible * 0.15));

    const out: UserProfile[] = [];
    for (const row of res.rows.slice(0, maxCount)) {
      out.push(await this.toPublicProfile(mapUserRow(row), userId));
    }
    return out;
  }

  // ==========================================
  // NOTIFICATIONS & OTP & YOUTUBE OAUTH
  // ==========================================
  public async getNotifications(userId: string, category?: string): Promise<NotificationItem[]> {
    const params: any[] = [userId];
    let sql = 'SELECT * FROM notifications WHERE recipient_id = $1';
    if (category && category !== 'all') {
      sql += ' AND category = $2';
      params.push(category);
    }
    sql += ' ORDER BY created_at DESC LIMIT 200';
    const res = await pgQuery(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      type: r.type,
      category: r.category,
      sender: r.sender_snapshot,
      title: r.title,
      body: r.body,
      targetId: r.target_id || undefined,
      targetType: r.target_type || undefined,
      isRead: Boolean(r.is_read),
      createdAt: toIso(r.created_at),
    }));
  }

  public async addNotification(notif: NotificationItem & { recipientId: string; category?: string }): Promise<void> {
    await pgQuery(
      `INSERT INTO notifications (id, recipient_id, category, type, sender_snapshot, title, body, target_id, target_type, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        notif.id,
        notif.recipientId,
        notif.category || 'motherland',
        notif.type,
        JSON.stringify(notif.sender),
        notif.title,
        notif.body,
        notif.targetId || null,
        notif.targetType || null,
        Boolean(notif.isRead),
        notif.createdAt || new Date().toISOString(),
      ]
    );
  }

  public async markNotificationsRead(userId: string, notificationId?: string): Promise<void> {
    if (notificationId) {
      await pgQuery('UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND id = $2', [
        userId,
        notificationId,
      ]);
    } else {
      await pgQuery('UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1', [userId]);
    }
  }

  public async deleteNotification(userId: string, notificationId: string): Promise<void> {
    await pgQuery('DELETE FROM notifications WHERE recipient_id = $1 AND id = $2', [userId, notificationId]);
  }

  public async setOtp(
    identifier: string,
    code: string,
    type: 'register' | 'phone_verify' | 'forgot_password'
  ): Promise<void> {
    const expiresAt = Date.now() + 10 * 60 * 1000;
    await pgQuery(
      `INSERT INTO otp_codes (identifier, type, code, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (identifier, type) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at`,
      [identifier, type, code, expiresAt]
    );
  }

  public async verifyOtp(
    identifier: string,
    code: string,
    type: 'register' | 'phone_verify' | 'forgot_password'
  ): Promise<boolean> {
    const res = await pgQuery(
      `DELETE FROM otp_codes
       WHERE identifier = $1 AND type = $2 AND code = $3 AND expires_at > $4
       RETURNING identifier`,
      [identifier, type, code, Date.now()]
    );
    return (res.rowCount || 0) > 0;
  }

  public async getYouTubeOAuth(userId: string): Promise<YouTubeOAuthRecord | undefined> {
    const res = await pgQuery('SELECT * FROM youtube_oauth_tokens WHERE user_id = $1 LIMIT 1', [userId]);
    const r = res.rows[0];
    if (!r) return undefined;
    return {
      userId: r.user_id,
      accessToken: r.access_token,
      refreshToken: r.refresh_token || undefined,
      expiresAt: Number(r.expires_at),
      scope: r.scope,
      channelId: r.channel_id,
      channelTitle: r.channel_title,
      channelAvatar: r.channel_avatar,
      subscriberCount: r.subscriber_count || undefined,
      customUrl: r.custom_url || undefined,
      connectedAt: toIso(r.connected_at),
      updatedAt: toIso(r.updated_at),
    };
  }

  public async setYouTubeOAuth(userId: string, record: YouTubeOAuthRecord): Promise<YouTubeOAuthRecord> {
    await pgQuery(
      `INSERT INTO youtube_oauth_tokens (
        user_id, access_token, refresh_token, expires_at, scope, channel_id,
        channel_title, channel_avatar, subscriber_count, custom_url, connected_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, youtube_oauth_tokens.refresh_token),
        expires_at = EXCLUDED.expires_at,
        scope = EXCLUDED.scope,
        channel_id = EXCLUDED.channel_id,
        channel_title = EXCLUDED.channel_title,
        channel_avatar = EXCLUDED.channel_avatar,
        subscriber_count = EXCLUDED.subscriber_count,
        custom_url = EXCLUDED.custom_url,
        updated_at = EXCLUDED.updated_at`,
      [
        userId,
        record.accessToken,
        record.refreshToken || null,
        record.expiresAt,
        record.scope,
        record.channelId,
        record.channelTitle,
        record.channelAvatar,
        record.subscriberCount || null,
        record.customUrl || null,
        record.connectedAt,
        record.updatedAt,
      ]
    );
    return record;
  }

  public async deleteYouTubeOAuth(userId: string): Promise<boolean> {
    const res = await pgQuery('DELETE FROM youtube_oauth_tokens WHERE user_id = $1', [userId]);
    return (res.rowCount || 0) > 0;
  }

  // ==========================================
  // WAVE MESSAGING & CONVERSATIONS
  // ==========================================
  public isConversationParticipant(conv: Conversation, userId: string): boolean {
    const ids = Array.isArray(conv.participantIds) && conv.participantIds.length > 0
      ? conv.participantIds
      : (conv.participants || []).map((p) => p.id);
    return ids.includes(userId);
  }

  private isConvAdmin(conv: Conversation, userId: string): boolean {
    if (!conv.isGroup) return true;
    if (conv.creatorId === userId) return true;
    return Array.isArray(conv.adminIds) && conv.adminIds.includes(userId);
  }

  public async getConversationById(conversationId: string): Promise<Conversation | undefined> {
    const res = await pgQuery('SELECT * FROM conversations WHERE id = $1 LIMIT 1', [conversationId]);
    return res.rows[0] ? mapConvRow(res.rows[0]) : undefined;
  }

  private async purgeExpiredMessagesForConversation(conversationId: string): Promise<boolean> {
    const del = await pgQuery(
      'DELETE FROM chat_messages WHERE conversation_id = $1 AND expires_at IS NOT NULL AND expires_at <= NOW()',
      [conversationId]
    );
    if ((del.rowCount || 0) > 0) {
      const latest = await pgQuery(
        'SELECT * FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
        [conversationId]
      );
      const lastMsg = latest.rows[0] ? mapChatMsgRow(latest.rows[0]) : null;
      await pgQuery('UPDATE conversations SET last_message = $2::jsonb WHERE id = $1', [
        conversationId,
        lastMsg ? JSON.stringify(lastMsg) : null,
      ]);
      return true;
    }
    return false;
  }

  private async hydrateConversationForUser(
    conv: Conversation,
    userId: string,
    onlineUserIds?: Set<string>
  ): Promise<Conversation> {
    await this.purgeExpiredMessagesForConversation(conv.id);
    const pIds = conv.participantIds || [];
    const usersRes = pIds.length
      ? await pgQuery('SELECT * FROM users WHERE id = ANY($1::text[])', [pIds])
      : { rows: [] as any[] };
    const userMap = new Map(usersRes.rows.map((r: any) => [r.id, mapUserRow(r)]));
    const hydratedParticipants: UserProfile[] = [];
    for (const id of pIds) {
      const acc = userMap.get(id);
      if (acc) hydratedParticipants.push(await this.toPublicProfile(acc, userId, onlineUserIds));
    }

    const lastReadIso = conv.lastReadAtByUser?.[userId] || '';
    const lastReadMs = lastReadIso ? new Date(lastReadIso).getTime() : 0;

    const msgsRes = await pgQuery(
      `SELECT * FROM chat_messages
       WHERE conversation_id = $1
         AND NOT (COALESCE(deleted_for_ids, '[]'::jsonb) ? $2)
       ORDER BY created_at ASC`,
      [conv.id, userId]
    );
    let unreadCount = 0;
    for (const r of msgsRes.rows) {
      if (r.sender_id !== userId && new Date(r.created_at).getTime() > lastReadMs) {
        unreadCount++;
      }
    }
    const lastRow = msgsRes.rows[msgsRes.rows.length - 1];
    const lastMessage = lastRow ? mapChatMsgRow(lastRow) : undefined;

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

  public async getUserConversations(userId: string, onlineUserIds?: Set<string>): Promise<Conversation[]> {
    const res = await pgQuery(
      `SELECT c.* FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = $1
       ORDER BY c.updated_at DESC`,
      [userId]
    );
    const out: Conversation[] = [];
    for (const row of res.rows) {
      const conv = mapConvRow(row);
      const pIds = conv.participantIds || [];
      if (!conv.isGroup && pIds.length === 2) {
        const otherId = pIds.find((id) => id !== userId);
        if (otherId && (await this.isBlocked(userId, otherId))) continue;
      }
      if (conv.isRequest && conv.requestStatus === 'declined' && conv.requestedBy !== userId) continue;
      out.push(await this.hydrateConversationForUser(conv, userId, onlineUserIds));
    }
    return out.sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return a.isPinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  public async getTotalUnreadMessages(userId: string): Promise<number> {
    const convs = await this.getUserConversations(userId);
    return convs
      .filter((c) => !c.isArchived && (!c.isRequest || c.requestStatus === 'accepted'))
      .reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  }

  public async getOrCreateDirectConversation(
    userId: string,
    targetUserId: string,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; error?: string; statusCode?: number }> {
    if (!userId || !targetUserId || userId === targetUserId) {
      return { error: 'Cannot start a direct conversation with yourself.', statusCode: 400 };
    }
    const targetUser = await this.findUserById(targetUserId);
    if (!targetUser) return { error: 'Target user not found.', statusCode: 404 };
    if (await this.isBlocked(userId, targetUserId)) {
      return { error: 'Communication is unavailable due to block settings.', statusCode: 403 };
    }

    const sortedPair = [userId, targetUserId].sort();
    const directId = `conv_${sortedPair[0]}_${sortedPair[1]}`;
    const existingRes = await pgQuery(
      `SELECT c.* FROM conversations c
       WHERE c.is_group = FALSE
         AND (c.id = $1 OR (
           EXISTS (SELECT 1 FROM conversation_participants p1 WHERE p1.conversation_id = c.id AND p1.user_id = $2)
           AND EXISTS (SELECT 1 FROM conversation_participants p2 WHERE p2.conversation_id = c.id AND p2.user_id = $3)
         ))
       LIMIT 1`,
      [directId, userId, targetUserId]
    );
    if (existingRes.rows[0]) {
      const existing = mapConvRow(existingRes.rows[0]);
      if (existing.isRequest && existing.requestStatus === 'declined') {
        return { error: 'This user declined your message request.', statusCode: 403 };
      }
      return { conversation: await this.hydrateConversationForUser(existing, userId, onlineUserIds) };
    }

    const areFriends = await this.isFriend(userId, targetUserId);
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
    const isRequest = !areFriends;
    const lastReadAtByUser = { [userId]: now, [targetUserId]: now };

    await withPgTransaction(async (client) => {
      await client.query(
        `INSERT INTO conversations (
          id, is_group, is_request, request_status, requested_by, participant_ids, last_read_at_by_user, updated_at
        ) VALUES ($1, FALSE, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
        ON CONFLICT (id) DO NOTHING`,
        [
          directId,
          isRequest,
          isRequest ? 'pending' : 'accepted',
          isRequest ? userId : null,
          JSON.stringify([userId, targetUserId]),
          JSON.stringify(lastReadAtByUser),
          now,
        ]
      );
      await client.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING',
        [directId, userId, targetUserId]
      );
    });

    const created = await this.getConversationById(directId);
    return { conversation: await this.hydrateConversationForUser(created!, userId, onlineUserIds) };
  }

  public async respondConversationRequest(
    conversationId: string,
    userId: string,
    action: 'accept' | 'decline',
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; recipientIds?: string[]; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation request not found.', statusCode: 404 };
    }
    if (!conv.isRequest) {
      return { conversation: await this.hydrateConversationForUser(conv, userId, onlineUserIds) };
    }
    if (conv.requestedBy === userId) {
      return { error: 'Only the recipient can accept or decline a message request.', statusCode: 403 };
    }
    const nextIsReq = action !== 'accept';
    const nextStatus = action === 'accept' ? 'accepted' : 'declined';
    const res = await pgQuery(
      'UPDATE conversations SET is_request = $2, request_status = $3, updated_at = NOW() WHERE id = $1 RETURNING *',
      [conversationId, nextIsReq, nextStatus]
    );
    const updated = mapConvRow(res.rows[0]);
    return {
      conversation: await this.hydrateConversationForUser(updated, userId, onlineUserIds),
      recipientIds: (updated.participantIds || []).filter((id) => id !== userId),
    };
  }

  public async createGroupConversation(
    creatorId: string,
    name: string,
    memberIds: string[],
    photo?: string,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; error?: string; statusCode?: number }> {
    const cleanName = (name || '').trim();
    if (!cleanName) return { error: 'Group name is required.', statusCode: 400 };
    const creator = await this.findUserById(creatorId);
    if (!creator) return { error: 'Creator user not found.', statusCode: 401 };

    const validMembers: string[] = [creatorId];
    const seen = new Set([creatorId]);
    for (const id of memberIds || []) {
      if (!id || seen.has(id)) continue;
      if ((await this.findUserById(id)) && !(await this.isBlocked(creatorId, id))) {
        seen.add(id);
        validMembers.push(id);
      }
    }
    if (validMembers.length < 2) {
      return { error: 'Select at least 1 other member to create a group.', statusCode: 400 };
    }

    const now = new Date().toISOString();
    const convId = `grp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const groupPhoto = photo || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(cleanName)}`;
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

    await withPgTransaction(async (client) => {
      await client.query(
        `INSERT INTO conversations (
          id, is_group, name, photo, creator_id, admin_ids, pinned_message_ids,
          disappearing_seconds, participant_ids, last_message, last_read_at_by_user, updated_at
        ) VALUES ($1, TRUE, $2, $3, $4, $5::jsonb, '[]'::jsonb, 0, $6::jsonb, $7::jsonb, $8::jsonb, $9)`,
        [
          convId,
          cleanName,
          groupPhoto,
          creatorId,
          JSON.stringify([creatorId]),
          JSON.stringify(validMembers),
          JSON.stringify(sysMsg),
          JSON.stringify({ [creatorId]: now }),
          now,
        ]
      );
      for (const uid of validMembers) {
        await client.query(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [convId, uid]
        );
      }
      await client.query(
        `INSERT INTO chat_messages (
          id, conversation_id, sender_id, sender_name, sender_avatar, text, message_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'system', $7)`,
        [sysMsg.id, convId, creatorId, creator.displayName, creator.avatar, sysMsg.text, now]
      );
    });

    const conv = await this.getConversationById(convId);
    return { conversation: await this.hydrateConversationForUser(conv!, creatorId, onlineUserIds) };
  }

  public async addGroupMembers(
    conversationId: string,
    actorId: string,
    memberIds: string[],
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; addedIds?: string[]; systemMessage?: ChatMessage; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !conv.isGroup) return { error: 'Group not found.', statusCode: 404 };
    if (!this.isConvAdmin(conv, actorId)) return { error: 'Only group admins can add members.', statusCode: 403 };

    const existing = new Set(conv.participantIds || []);
    const toAdd: string[] = [];
    const names: string[] = [];
    for (const id of memberIds || []) {
      if (existing.has(id)) continue;
      const u = await this.findUserById(id);
      if (u && !(await this.isBlocked(actorId, id))) {
        existing.add(id);
        toAdd.push(id);
        names.push(u.displayName);
      }
    }
    if (toAdd.length === 0) return { error: 'No eligible new members provided.', statusCode: 400 };

    const actor = await this.findUserById(actorId);
    const now = new Date().toISOString();
    const sysMsg: ChatMessage = {
      id: `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      conversationId,
      senderId: actorId,
      senderName: actor?.displayName || 'Admin',
      senderAvatar: actor?.avatar || '',
      text: `${actor?.displayName || 'Admin'} added ${names.join(', ')}`,
      messageType: 'system',
      createdAt: now,
      isRead: false,
    };
    const nextParticipants = Array.from(existing);

    await withPgTransaction(async (client) => {
      await client.query(
        'UPDATE conversations SET participant_ids = $2::jsonb, last_message = $3::jsonb, updated_at = $4 WHERE id = $1',
        [conversationId, JSON.stringify(nextParticipants), JSON.stringify(sysMsg), now]
      );
      for (const uid of toAdd) {
        await client.query(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [conversationId, uid]
        );
      }
      await client.query(
        `INSERT INTO chat_messages (
          id, conversation_id, sender_id, sender_name, sender_avatar, text, message_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'system', $7)`,
        [sysMsg.id, conversationId, actorId, sysMsg.senderName, sysMsg.senderAvatar, sysMsg.text, now]
      );
    });

    const updated = await this.getConversationById(conversationId);
    return {
      conversation: await this.hydrateConversationForUser(updated!, actorId, onlineUserIds),
      addedIds: toAdd,
      systemMessage: sysMsg,
    };
  }

  public async removeGroupMember(
    conversationId: string,
    actorId: string,
    targetUserId: string,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; systemMessage?: ChatMessage; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !conv.isGroup) return { error: 'Group not found.', statusCode: 404 };
    if (!this.isConvAdmin(conv, actorId)) return { error: 'Only group admins can remove members.', statusCode: 403 };
    if (targetUserId === conv.creatorId) return { error: 'The group creator cannot be removed.', statusCode: 403 };
    const currentIds = conv.participantIds || [];
    if (!currentIds.includes(targetUserId)) return { error: 'User is not a member of this group.', statusCode: 404 };

    const nextIds = currentIds.filter((id) => id !== targetUserId);
    const nextAdmins = (conv.adminIds || []).filter((id) => id !== targetUserId);
    const [actor, target] = await Promise.all([this.findUserById(actorId), this.findUserById(targetUserId)]);
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

    await withPgTransaction(async (client) => {
      await client.query(
        'UPDATE conversations SET participant_ids = $2::jsonb, admin_ids = $3::jsonb, last_message = $4::jsonb, updated_at = $5 WHERE id = $1',
        [conversationId, JSON.stringify(nextIds), JSON.stringify(nextAdmins), JSON.stringify(sysMsg), now]
      );
      await client.query('DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2', [
        conversationId,
        targetUserId,
      ]);
      await client.query(
        `INSERT INTO chat_messages (
          id, conversation_id, sender_id, sender_name, sender_avatar, text, message_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'system', $7)`,
        [sysMsg.id, conversationId, actorId, sysMsg.senderName, sysMsg.senderAvatar, sysMsg.text, now]
      );
    });

    const updated = await this.getConversationById(conversationId);
    return {
      conversation: await this.hydrateConversationForUser(updated!, actorId, onlineUserIds),
      systemMessage: sysMsg,
    };
  }

  public async setGroupAdmin(
    conversationId: string,
    actorId: string,
    targetUserId: string,
    makeAdmin: boolean,
    onlineUserIds?: Set<string>
  ): Promise<{ conversation?: Conversation; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
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
    await pgQuery('UPDATE conversations SET admin_ids = $2::jsonb WHERE id = $1', [
      conversationId,
      JSON.stringify(Array.from(set)),
    ]);
    const updated = await this.getConversationById(conversationId);
    return { conversation: await this.hydrateConversationForUser(updated!, actorId, onlineUserIds) };
  }

  public async leaveGroupConversation(
    conversationId: string,
    userId: string
  ): Promise<{ ok: boolean; remainingIds?: string[]; systemMessage?: ChatMessage; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !conv.isGroup) return { ok: false, error: 'Group not found.', statusCode: 404 };
    const currentIds = conv.participantIds || [];
    if (!currentIds.includes(userId)) {
      return { ok: false, error: 'You are not a member of this group.', statusCode: 403 };
    }
    const nextIds = currentIds.filter((id) => id !== userId);
    const nextAdmins = (conv.adminIds || []).filter((id) => id !== userId);
    let nextCreator = conv.creatorId;
    if (conv.creatorId === userId && nextIds.length > 0) {
      nextCreator = nextIds[0];
      if (!nextAdmins.includes(nextIds[0])) nextAdmins.push(nextIds[0]);
    }
    const actor = await this.findUserById(userId);
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

    await withPgTransaction(async (client) => {
      if (nextIds.length === 0) {
        await client.query('DELETE FROM conversations WHERE id = $1', [conversationId]);
      } else {
        await client.query(
          `UPDATE conversations
           SET participant_ids = $2::jsonb, admin_ids = $3::jsonb, creator_id = $4, last_message = $5::jsonb, updated_at = $6
           WHERE id = $1`,
          [conversationId, JSON.stringify(nextIds), JSON.stringify(nextAdmins), nextCreator || null, JSON.stringify(sysMsg), now]
        );
        await client.query('DELETE FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2', [
          conversationId,
          userId,
        ]);
        await client.query(
          `INSERT INTO chat_messages (
            id, conversation_id, sender_id, sender_name, sender_avatar, text, message_type, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, 'system', $7)`,
          [sysMsg.id, conversationId, userId, sysMsg.senderName, sysMsg.senderAvatar, sysMsg.text, now]
        );
      }
    });

    return { ok: true, remainingIds: nextIds, systemMessage: sysMsg };
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
    const conv = await this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    let broadcastMeta = false;
    let nextName = conv.name;
    let nextPhoto = conv.photo;
    let nextDisappearing = conv.disappearingSeconds || 0;

    if (updates.name !== undefined || updates.photo !== undefined) {
      if (conv.isGroup && !this.isConvAdmin(conv, userId)) {
        return { error: 'Only group admins can update group name or photo.', statusCode: 403 };
      }
      if (updates.name?.trim()) nextName = updates.name.trim();
      if (updates.photo !== undefined) nextPhoto = updates.photo;
      broadcastMeta = true;
    }
    if (updates.disappearingSeconds !== undefined) {
      if (conv.isGroup && !this.isConvAdmin(conv, userId)) {
        return { error: 'Only group admins can change disappearing timer in groups.', statusCode: 403 };
      }
      const allowed = [0, 86400, 604800];
      nextDisappearing = allowed.includes(updates.disappearingSeconds) ? updates.disappearingSeconds : 0;
      broadcastMeta = true;
    }

    const toggleList = (arr: string[] | undefined, val: boolean) => {
      const set = new Set(arr || []);
      if (val) set.add(userId);
      else set.delete(userId);
      return Array.from(set);
    };

    const nextPinned = typeof updates.isPinned === 'boolean' ? toggleList(conv.pinnedBy, updates.isPinned) : conv.pinnedBy || [];
    const nextArchived = typeof updates.isArchived === 'boolean' ? toggleList(conv.archivedBy, updates.isArchived) : conv.archivedBy || [];
    const nextMuted = typeof updates.isMuted === 'boolean' ? toggleList(conv.mutedBy, updates.isMuted) : conv.mutedBy || [];

    const res = await pgQuery(
      `UPDATE conversations
       SET name = $2, photo = $3, disappearing_seconds = $4,
           pinned_by = $5::jsonb, archived_by = $6::jsonb, muted_by = $7::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        conversationId,
        nextName || null,
        nextPhoto || null,
        nextDisappearing,
        JSON.stringify(nextPinned),
        JSON.stringify(nextArchived),
        JSON.stringify(nextMuted),
      ]
    );
    return {
      conversation: await this.hydrateConversationForUser(mapConvRow(res.rows[0]), userId, onlineUserIds),
      broadcastMeta,
    };
  }

  public async getConversationMessages(
    conversationId: string,
    userId: string,
    beforeId?: string,
    limit = 35
  ): Promise<{ messages?: ChatMessage[]; hasMore?: boolean; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv) return { error: 'Conversation not found.', statusCode: 404 };
    if (!this.isConversationParticipant(conv, userId)) {
      return { error: 'Forbidden: you are not a participant of this conversation.', statusCode: 403 };
    }
    await this.purgeExpiredMessagesForConversation(conversationId);

    const viewer = await this.findUserById(userId);
    const viewerReceiptsEnabled = viewer?.privacy?.showReadReceipts !== false;

    const allRes = await pgQuery(
      `SELECT * FROM chat_messages
       WHERE conversation_id = $1
         AND NOT (COALESCE(deleted_for_ids, '[]'::jsonb) ? $2)
       ORDER BY created_at ASC`,
      [conversationId, userId]
    );

    const allRows = allRes.rows;
    let endIdx = allRows.length;
    if (beforeId) {
      const idx = allRows.findIndex((r: any) => r.id === beforeId);
      if (idx !== -1) endIdx = idx;
    }
    const startIdx = Math.max(0, endIdx - limit);
    const sliceRows = allRows.slice(startIdx, endIdx);

    // Fetch peer receipt preferences in one batch
    const peerIds = Object.keys(conv.lastReadAtByUser || {}).filter((uid) => uid !== userId);
    const peerReceiptsMap = new Map<string, boolean>();
    if (viewerReceiptsEnabled && peerIds.length > 0) {
      const peersRes = await pgQuery<{ id: string; privacy: any }>(
        'SELECT id, privacy FROM users WHERE id = ANY($1::text[])',
        [peerIds]
      );
      for (const pr of peersRes.rows) {
        peerReceiptsMap.set(pr.id, pr.privacy?.showReadReceipts !== false);
      }
    }

    const convLastReadEntries = Object.entries(conv.lastReadAtByUser || {});
    const messages = sliceRows.map((r: any) => {
      const msgTime = new Date(r.created_at).getTime();
      const readByOther =
        viewerReceiptsEnabled &&
        convLastReadEntries.some(([uid, ts]) => {
          if (uid === r.sender_id) return false;
          if (peerReceiptsMap.get(uid) === false) return false;
          return new Date(ts).getTime() >= msgTime;
        });
      return mapChatMsgRow(r, readByOther);
    });

    return { messages, hasMore: startIdx > 0 };
  }

  public async markConversationRead(
    conversationId: string,
    userId: string
  ): Promise<{ ok: boolean; error?: string; statusCode?: number; participantIds?: string[]; sendReceipt?: boolean }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv) return { ok: false, error: 'Conversation not found.', statusCode: 404 };
    if (!this.isConversationParticipant(conv, userId)) return { ok: false, error: 'Forbidden.', statusCode: 403 };

    const now = new Date().toISOString();
    await pgQuery(
      `UPDATE conversations
       SET last_read_at_by_user = jsonb_set(COALESCE(last_read_at_by_user, '{}'::jsonb), ARRAY[$2], to_jsonb($3::text), TRUE)
       WHERE id = $1`,
      [conversationId, userId, now]
    );
    const user = await this.findUserById(userId);
    return {
      ok: true,
      participantIds: conv.participantIds || [],
      sendReceipt: user?.privacy?.showReadReceipts !== false,
    };
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
    const conv = await this.getConversationById(conversationId);
    if (!conv) return { error: 'Conversation not found.', statusCode: 404 };
    if (!this.isConversationParticipant(conv, senderId)) {
      return { error: 'Forbidden: you are not a participant of this conversation.', statusCode: 403 };
    }

    const pIds = conv.participantIds || [];
    if (!conv.isGroup && pIds.length === 2) {
      const otherId = pIds.find((id) => id !== senderId);
      if (otherId) {
        if (await this.isBlocked(senderId, otherId)) {
          return { error: 'Messaging is disabled due to block settings.', statusCode: 403 };
        }
        if (conv.isRequest && conv.requestStatus === 'declined') {
          return { error: 'Message request was declined.', statusCode: 403 };
        }
        if (!conv.isRequest && !(await this.isFriend(senderId, otherId))) {
          const other = await this.findUserById(otherId);
          if (other?.privacy?.allowDirectMessages !== 'everyone') {
            return { error: 'You can only send messages to accepted friends.', statusCode: 403 };
          }
        }
      }
    }

    const sender = await this.findUserById(senderId);
    if (!sender) return { error: 'Sender user not found.', statusCode: 401 };

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

    await withPgTransaction(async (client) => {
      await client.query(
        `INSERT INTO chat_messages (
          id, conversation_id, sender_id, sender_name, sender_avatar, text, media_url, media_type,
          file_name, file_size, mime_type, attachments, audio_duration, audio_waveform, reply_to,
          forwarded_from, reactions, message_type, delivered_to, expires_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12::jsonb, $13, $14::jsonb, $15::jsonb,
          $16::jsonb, '{}'::jsonb, $17, $18::jsonb, $19, $20
        )`,
        [
          newMsg.id,
          conversationId,
          newMsg.senderId,
          newMsg.senderName,
          newMsg.senderAvatar,
          newMsg.text,
          newMsg.mediaUrl || null,
          newMsg.mediaType || null,
          newMsg.fileName || null,
          newMsg.fileSize ?? null,
          newMsg.mimeType || null,
          newMsg.attachments ? JSON.stringify(newMsg.attachments) : null,
          newMsg.audioDuration ?? null,
          newMsg.audioWaveform ? JSON.stringify(newMsg.audioWaveform) : null,
          newMsg.replyTo ? JSON.stringify(newMsg.replyTo) : null,
          newMsg.forwardedFrom ? JSON.stringify(newMsg.forwardedFrom) : null,
          newMsg.messageType,
          JSON.stringify(deliveredTo),
          newMsg.expiresAt || null,
          now,
        ]
      );

      await client.query(
        `UPDATE conversations
         SET last_message = $2::jsonb,
             updated_at = $3::timestamptz,
             last_read_at_by_user = jsonb_set(COALESCE(last_read_at_by_user, '{}'::jsonb), ARRAY[$4::text], to_jsonb($5::text), TRUE)
         WHERE id = $1`,
        [conversationId, JSON.stringify(newMsg), now, senderId, now]
      );
    });

    const urls = [mediaUrl, ...(extra?.attachments || []).map((a) => a.url)].filter((u): u is string =>
      Boolean(u && u.startsWith('/uploads/'))
    );
    if (urls.length > 0) {
      await this.syncMediaVisibilityForUrls(urls, senderId, 'private', conversationId);
    }

    const updatedConv = await this.getConversationById(conversationId);
    return {
      message: newMsg,
      conversation: await this.hydrateConversationForUser(updatedConv!, senderId, extra?.onlineUserIds),
      recipientIds,
    };
  }

  public async editChatMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    newText: string
  ): Promise<{ message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    const clean = (newText || '').trim();
    if (!clean) return { error: 'Edited message text cannot be empty.', statusCode: 400 };

    return withPgTransaction(async (client) => {
      const mRes = await client.query(
        'SELECT * FROM chat_messages WHERE id = $1 AND conversation_id = $2 FOR UPDATE',
        [msgId, conversationId]
      );
      const row = mRes.rows[0];
      if (!row) return { error: 'Message not found.', statusCode: 404 };
      if (row.sender_id !== userId) return { error: 'You can only edit your own messages.', statusCode: 403 };
      if (row.is_deleted) return { error: 'Cannot edit a deleted message.', statusCode: 400 };

      const editedAt = new Date().toISOString();
      const upd = await client.query(
        'UPDATE chat_messages SET text = $3, is_edited = TRUE, edited_at = $4 WHERE id = $1 AND conversation_id = $2 RETURNING *',
        [msgId, conversationId, clean, editedAt]
      );
      const updatedMsg = mapChatMsgRow(upd.rows[0]);
      if (conv.lastMessage?.id === updatedMsg.id) {
        await client.query('UPDATE conversations SET last_message = $2::jsonb WHERE id = $1', [
          conversationId,
          JSON.stringify(updatedMsg),
        ]);
      }
      return {
        message: updatedMsg,
        recipientIds: (conv.participantIds || []).filter((id) => id !== userId),
      };
    });
  }

  public async deleteChatMessage(
    conversationId: string,
    msgId: string,
    userId: string,
    mode: 'me' | 'everyone' = 'everyone'
  ): Promise<{ message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }

    return withPgTransaction(async (client) => {
      const mRes = await client.query(
        'SELECT * FROM chat_messages WHERE id = $1 AND conversation_id = $2 FOR UPDATE',
        [msgId, conversationId]
      );
      const row = mRes.rows[0];
      if (!row) return { error: 'Message not found.', statusCode: 404 };

      if (mode === 'me') {
        const deletedFor: string[] = Array.isArray(row.deleted_for_ids) ? [...row.deleted_for_ids] : [];
        if (!deletedFor.includes(userId)) deletedFor.push(userId);
        const upd = await client.query(
          'UPDATE chat_messages SET deleted_for_ids = $3::jsonb WHERE id = $1 AND conversation_id = $2 RETURNING *',
          [msgId, conversationId, JSON.stringify(deletedFor)]
        );
        return { message: mapChatMsgRow(upd.rows[0]), recipientIds: [] };
      }

      const canDeleteForEveryone = row.sender_id === userId || (conv.isGroup && this.isConvAdmin(conv, userId));
      if (!canDeleteForEveryone) {
        return { error: 'Not authorized to delete this message for everyone.', statusCode: 403 };
      }

      const upd = await client.query(
        `UPDATE chat_messages
         SET is_deleted = TRUE, text = 'This message was deleted', media_url = NULL,
             media_type = NULL, attachments = NULL, audio_waveform = NULL, file_name = NULL, is_pinned = FALSE
         WHERE id = $1 AND conversation_id = $2
         RETURNING *`,
        [msgId, conversationId]
      );
      const deletedMsg = mapChatMsgRow(upd.rows[0]);
      const nextPinned = (conv.pinnedMessageIds || []).filter((id) => id !== msgId);
      await client.query(
        `UPDATE conversations
         SET pinned_message_ids = $2::jsonb,
             last_message = CASE WHEN last_message->>'id' = $3 THEN $4::jsonb ELSE last_message END
         WHERE id = $1`,
        [conversationId, JSON.stringify(nextPinned), msgId, JSON.stringify(deletedMsg)]
      );
      return {
        message: deletedMsg,
        recipientIds: (conv.participantIds || []).filter((id) => id !== userId),
      };
    });
  }

  public async toggleChatReaction(
    conversationId: string,
    msgId: string,
    userId: string,
    emoji: string
  ): Promise<{ message?: ChatMessage; recipientIds?: string[]; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }

    return withPgTransaction(async (client) => {
      const mRes = await client.query(
        'SELECT * FROM chat_messages WHERE id = $1 AND conversation_id = $2 FOR UPDATE',
        [msgId, conversationId]
      );
      const row = mRes.rows[0];
      if (!row || row.is_deleted) return { error: 'Message not found.', statusCode: 404 };

      const reactions: Record<string, string[]> = { ...(row.reactions || {}) };
      const list = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];
      if (list.includes(userId)) {
        const next = list.filter((id) => id !== userId);
        if (next.length === 0) delete reactions[emoji];
        else reactions[emoji] = next;
      } else {
        reactions[emoji] = [...list, userId];
      }

      const upd = await client.query(
        'UPDATE chat_messages SET reactions = $3::jsonb WHERE id = $1 AND conversation_id = $2 RETURNING *',
        [msgId, conversationId, JSON.stringify(reactions)]
      );
      return {
        message: mapChatMsgRow(upd.rows[0]),
        recipientIds: (conv.participantIds || []).filter((id) => id !== userId),
      };
    });
  }

  public async togglePinChatMessage(
    conversationId: string,
    msgId: string,
    userId: string
  ): Promise<{ message?: ChatMessage; pinnedMessageIds?: string[]; recipientIds?: string[]; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }

    return withPgTransaction(async (client) => {
      const mRes = await client.query(
        'SELECT * FROM chat_messages WHERE id = $1 AND conversation_id = $2 FOR UPDATE',
        [msgId, conversationId]
      );
      const row = mRes.rows[0];
      if (!row || row.is_deleted) return { error: 'Message not found.', statusCode: 404 };

      const pinnedSet = new Set(conv.pinnedMessageIds || []);
      let isPinned = false;
      if (pinnedSet.has(msgId)) {
        pinnedSet.delete(msgId);
        isPinned = false;
      } else {
        pinnedSet.add(msgId);
        isPinned = true;
      }
      const nextPinned = Array.from(pinnedSet);

      const upd = await client.query(
        'UPDATE chat_messages SET is_pinned = $3 WHERE id = $1 AND conversation_id = $2 RETURNING *',
        [msgId, conversationId, isPinned]
      );
      await client.query('UPDATE conversations SET pinned_message_ids = $2::jsonb WHERE id = $1', [
        conversationId,
        JSON.stringify(nextPinned),
      ]);
      return {
        message: mapChatMsgRow(upd.rows[0]),
        pinnedMessageIds: nextPinned,
        recipientIds: (conv.participantIds || []).filter((id) => id !== userId),
      };
    });
  }

  public async searchConversationMessages(
    conversationId: string,
    userId: string,
    query: string
  ): Promise<{ messages?: ChatMessage[]; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    await this.purgeExpiredMessagesForConversation(conversationId);
    const term = (query || '').trim();
    const res = term
      ? await pgQuery(
          `SELECT * FROM (
             SELECT * FROM chat_messages
             WHERE conversation_id = $1
               AND is_deleted = FALSE
               AND NOT (COALESCE(deleted_for_ids, '[]'::jsonb) ? $2)
               AND (text ILIKE $3 OR COALESCE(file_name, '') ILIKE $3)
             ORDER BY created_at DESC LIMIT 50
           ) sub ORDER BY created_at ASC`,
          [conversationId, userId, `%${term}%`]
        )
      : await pgQuery(
          `SELECT * FROM (
             SELECT * FROM chat_messages
             WHERE conversation_id = $1
               AND is_deleted = FALSE
               AND NOT (COALESCE(deleted_for_ids, '[]'::jsonb) ? $2)
             ORDER BY created_at DESC LIMIT 50
           ) sub ORDER BY created_at ASC`,
          [conversationId, userId]
        );
    return { messages: res.rows.map((r: any) => mapChatMsgRow(r)) };
  }

  public async getConversationSharedMedia(
    conversationId: string,
    userId: string
  ): Promise<{ items?: ChatMessage[]; links?: { messageId: string; url: string; senderName: string; createdAt: string }[]; error?: string; statusCode?: number }> {
    const conv = await this.getConversationById(conversationId);
    if (!conv || !this.isConversationParticipant(conv, userId)) {
      return { error: 'Conversation not found.', statusCode: 404 };
    }
    await this.purgeExpiredMessagesForConversation(conversationId);
    const res = await pgQuery(
      `SELECT * FROM chat_messages
       WHERE conversation_id = $1
         AND is_deleted = FALSE
         AND NOT (COALESCE(deleted_for_ids, '[]'::jsonb) ? $2)
       ORDER BY created_at DESC`,
      [conversationId, userId]
    );
    const msgs = res.rows.map((r: any) => mapChatMsgRow(r));
    const items = msgs.filter(
      (m) => Boolean(m.mediaUrl) || (Array.isArray(m.attachments) && m.attachments.length > 0)
    );
    const urlRegex = /https?:\/\/[^\s<>()]+/gi;
    const links: { messageId: string; url: string; senderName: string; createdAt: string }[] = [];
    for (const m of msgs) {
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
  // CALLS
  // ==========================================
  public async addCallRecord(record: CallRecord): Promise<CallRecord> {
    await pgQuery(
      `INSERT INTO call_records (
        id, conversation_id, caller_id, caller_name, caller_avatar, callee_ids,
        callee_name, callee_avatar, call_type, is_group_call, status, duration_seconds, created_at, ended_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO NOTHING`,
      [
        record.id,
        record.conversationId,
        record.callerId,
        record.callerName,
        record.callerAvatar || '',
        JSON.stringify(record.calleeIds || []),
        record.calleeName || null,
        record.calleeAvatar || null,
        record.callType,
        Boolean(record.isGroupCall),
        record.status,
        Number(record.durationSeconds || 0),
        record.createdAt || new Date().toISOString(),
        record.endedAt || null,
      ]
    );
    return record;
  }

  public async updateCallRecord(callId: string, updates: Partial<CallRecord>): Promise<CallRecord | undefined> {
    const existing = await this.getCallRecordById(callId);
    if (!existing) return undefined;
    const merged = { ...existing, ...updates };
    const res = await pgQuery(
      `UPDATE call_records
       SET status = $2, duration_seconds = $3, ended_at = $4
       WHERE id = $1
       RETURNING *`,
      [callId, merged.status, Number(merged.durationSeconds || 0), merged.endedAt || null]
    );
    return res.rows[0] ? mapCallRow(res.rows[0]) : undefined;
  }

  public async getCallRecordById(callId: string): Promise<CallRecord | undefined> {
    const res = await pgQuery('SELECT * FROM call_records WHERE id = $1 LIMIT 1', [callId]);
    return res.rows[0] ? mapCallRow(res.rows[0]) : undefined;
  }

  public async getUserCalls(userId: string): Promise<CallRecord[]> {
    const res = await pgQuery(
      `SELECT * FROM call_records
       WHERE caller_id = $1 OR COALESCE(callee_ids, '[]'::jsonb) ? $1
       ORDER BY created_at DESC LIMIT 300`,
      [userId]
    );
    return res.rows.map(mapCallRow);
  }

  // ==========================================
  // DRAFTS, SAVED VIDEOS & WATCH HISTORY
  // ==========================================
  public async getUserDrafts(userId: string): Promise<DraftPost[]> {
    const res = await pgQuery('SELECT * FROM drafts WHERE user_id = $1 ORDER BY updated_at DESC', [userId]);
    return res.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      mode: r.mode,
      content: r.content,
      shortTitle: r.short_title || undefined,
      mediaType: r.media_type || undefined,
      mediaUrl: r.media_url || undefined,
      images: Array.isArray(r.images) ? r.images : undefined,
      hashtags: Array.isArray(r.hashtags) ? r.hashtags : undefined,
      audience: r.audience || 'public',
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
    }));
  }

  public async saveDraft(draft: DraftPost): Promise<DraftPost> {
    const now = new Date().toISOString();
    const res = await pgQuery(
      `INSERT INTO drafts (
        id, user_id, mode, content, short_title, media_type, media_url, images, hashtags, audience, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        mode = EXCLUDED.mode,
        content = EXCLUDED.content,
        short_title = EXCLUDED.short_title,
        media_type = EXCLUDED.media_type,
        media_url = EXCLUDED.media_url,
        images = EXCLUDED.images,
        hashtags = EXCLUDED.hashtags,
        audience = EXCLUDED.audience,
        updated_at = $12
      RETURNING *`,
      [
        draft.id,
        draft.userId,
        draft.mode,
        draft.content,
        draft.shortTitle || null,
        draft.mediaType || 'none',
        draft.mediaUrl || null,
        draft.images ? JSON.stringify(draft.images) : null,
        draft.hashtags ? JSON.stringify(draft.hashtags) : null,
        draft.audience || 'public',
        draft.createdAt || now,
        now,
      ]
    );
    const r = res.rows[0];
    return {
      ...draft,
      createdAt: toIso(r.created_at),
      updatedAt: toIso(r.updated_at),
    };
  }

  public async deleteDraft(draftId: string, userId: string): Promise<boolean> {
    const res = await pgQuery('DELETE FROM drafts WHERE id = $1 AND user_id = $2', [draftId, userId]);
    return (res.rowCount || 0) > 0;
  }

  public async getUserSavedVideos(userId: string): Promise<SavedVideoItem[]> {
    const res = await pgQuery('SELECT * FROM saved_videos WHERE user_id = $1 ORDER BY saved_at DESC', [userId]);
    return res.rows.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      videoId: r.video_id,
      videoType: r.video_type,
      source: r.source,
      youtubeId: r.youtube_id || undefined,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      channelTitle: r.channel_title,
      channelAvatar: r.channel_avatar || undefined,
      duration: r.duration || undefined,
      videoUrl: r.video_url || undefined,
      savedAt: toIso(r.saved_at),
    }));
  }

  public async toggleSaveVideo(
    userId: string,
    item: Omit<SavedVideoItem, 'id' | 'userId' | 'savedAt'>
  ): Promise<{ isSaved: boolean; savedVideos: SavedVideoItem[] }> {
    const del = await pgQuery(
      `DELETE FROM saved_videos
       WHERE user_id = $1 AND (video_id = $2 OR ($3::text IS NOT NULL AND youtube_id = $3))`,
      [userId, item.videoId, item.youtubeId || null]
    );
    if ((del.rowCount || 0) > 0) {
      return { isSaved: false, savedVideos: await this.getUserSavedVideos(userId) };
    }
    const id = `sv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await pgQuery(
      `INSERT INTO saved_videos (
        id, user_id, video_id, video_type, source, youtube_id, title, thumbnail_url,
        channel_title, channel_avatar, duration, video_url, saved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (user_id, video_id) DO NOTHING`,
      [
        id,
        userId,
        item.videoId,
        item.videoType,
        item.source,
        item.youtubeId || null,
        item.title,
        item.thumbnailUrl || '',
        item.channelTitle || '',
        item.channelAvatar || null,
        item.duration || null,
        item.videoUrl || null,
      ]
    );
    return { isSaved: true, savedVideos: await this.getUserSavedVideos(userId) };
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
    const now = new Date().toISOString();
    const durSec = Math.max(0, Number(payload.durationSeconds || 0));
    const watchSec = Math.max(0, Number(payload.watchSeconds || 0));

    const existingRes = await pgQuery(
      'SELECT * FROM watch_history WHERE user_id = $1 AND video_id = $2 LIMIT 1',
      [userId, payload.videoId]
    );
    const existing = existingRes.rows[0];
    const maxWatch = Math.max(Number(existing?.watch_seconds || 0), watchSec);
    const maxDur = Math.max(Number(existing?.duration_seconds || 0), durSec);
    const completed = Boolean(existing?.completed || payload.completed || (maxDur > 0 && maxWatch / maxDur >= 0.85));
    const minSecondsThreshold = payload.videoType === 'short' ? 5 : 8;
    const meaningfulView = Boolean(
      existing?.meaningful_view ||
        completed ||
        maxWatch >= minSecondsThreshold ||
        (maxDur > 0 && maxWatch / maxDur >= 0.25)
    );

    const res = await pgQuery(
      `INSERT INTO watch_history (
        user_id, video_id, youtube_id, video_type, source, title, thumbnail_url, channel_title,
        duration, watch_seconds, duration_seconds, completed, meaningful_view, first_viewed_at, last_viewed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
      ON CONFLICT (user_id, video_id) DO UPDATE SET
        watch_seconds = GREATEST(watch_history.watch_seconds, EXCLUDED.watch_seconds),
        duration_seconds = GREATEST(watch_history.duration_seconds, EXCLUDED.duration_seconds),
        completed = watch_history.completed OR EXCLUDED.completed,
        meaningful_view = watch_history.meaningful_view OR EXCLUDED.meaningful_view,
        title = COALESCE(NULLIF(EXCLUDED.title, ''), watch_history.title),
        thumbnail_url = COALESCE(NULLIF(EXCLUDED.thumbnail_url, ''), watch_history.thumbnail_url),
        last_viewed_at = EXCLUDED.last_viewed_at
      RETURNING *`,
      [
        userId,
        payload.videoId,
        payload.youtubeId || null,
        payload.videoType,
        payload.source,
        payload.title || 'Watched Video',
        payload.thumbnailUrl || '',
        payload.channelTitle || 'Creator',
        payload.duration || null,
        maxWatch,
        maxDur,
        completed,
        meaningfulView,
        now,
      ]
    );
    const r = res.rows[0];
    return {
      userId: r.user_id,
      videoId: r.video_id,
      youtubeId: r.youtube_id || undefined,
      videoType: r.video_type,
      source: r.source,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      channelTitle: r.channel_title,
      duration: r.duration || undefined,
      watchSeconds: Number(r.watch_seconds),
      durationSeconds: Number(r.duration_seconds),
      completed: Boolean(r.completed),
      meaningfulView: Boolean(r.meaningful_view),
      firstViewedAt: toIso(r.first_viewed_at),
      lastViewedAt: toIso(r.last_viewed_at),
    };
  }

  public async getSuppressedVideoIds(userId: string | undefined, suppressionDays = 7): Promise<Set<string>> {
    const suppressed = new Set<string>();
    if (!userId || suppressionDays <= 0) return suppressed;
    const cutoff = new Date(Date.now() - suppressionDays * 24 * 60 * 60 * 1000).toISOString();
    const res = await pgQuery<{ video_id: string; youtube_id: string | null }>(
      `SELECT video_id, youtube_id FROM watch_history
       WHERE user_id = $1 AND meaningful_view = TRUE AND last_viewed_at >= $2`,
      [userId, cutoff]
    );
    for (const r of res.rows) {
      if (r.video_id) suppressed.add(r.video_id);
      if (r.youtube_id) suppressed.add(r.youtube_id);
    }
    return suppressed;
  }

  public async getUserWatchHistory(userId: string): Promise<WatchHistoryRecord[]> {
    const res = await pgQuery(
      'SELECT * FROM watch_history WHERE user_id = $1 ORDER BY last_viewed_at DESC LIMIT 200',
      [userId]
    );
    return res.rows.map((r: any) => ({
      userId: r.user_id,
      videoId: r.video_id,
      youtubeId: r.youtube_id || undefined,
      videoType: r.video_type,
      source: r.source,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      channelTitle: r.channel_title,
      duration: r.duration || undefined,
      watchSeconds: Number(r.watch_seconds),
      durationSeconds: Number(r.duration_seconds),
      completed: Boolean(r.completed),
      meaningfulView: Boolean(r.meaningful_view),
      firstViewedAt: toIso(r.first_viewed_at),
      lastViewedAt: toIso(r.last_viewed_at),
    }));
  }

  public async removeWatchHistoryItem(userId: string, videoId: string): Promise<boolean> {
    const res = await pgQuery(
      'DELETE FROM watch_history WHERE user_id = $1 AND (video_id = $2 OR youtube_id = $2)',
      [userId, videoId]
    );
    return (res.rowCount || 0) > 0;
  }

  public async getUserInterestKeywords(userId?: string): Promise<string[]> {
    if (!userId) return [];
    const counts = new Map<string, number>();
    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'from', 'this', 'that', 'your', 'into', 'video', 'youtube',
      'official', 'shorts', 'short', 'live', 'part', 'full', 'episode', 'new', 'best', 'top', '2025', '2026',
    ]);
    const collectTokens = (text: string, weight: number) => {
      const words = String(text || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopWords.has(w));
      for (const w of words.slice(0, 6)) counts.set(w, (counts.get(w) || 0) + weight);
    };

    const [histRes, savedRes, postRes] = await Promise.all([
      pgQuery('SELECT title, channel_title, completed FROM watch_history WHERE user_id = $1 ORDER BY last_viewed_at DESC LIMIT 20', [userId]),
      pgQuery('SELECT title FROM saved_videos WHERE user_id = $1 ORDER BY saved_at DESC LIMIT 15', [userId]),
      pgQuery(
        `SELECT p.hashtags, p.content FROM posts p
         WHERE p.id IN (
           SELECT post_id FROM post_reactions WHERE user_id = $1
           UNION
           SELECT post_id FROM saved_posts WHERE user_id = $1
         ) LIMIT 30`,
        [userId]
      ),
    ]);

    for (const h of histRes.rows) {
      collectTokens(h.title, h.completed ? 3 : 2);
      if (h.channel_title) collectTokens(h.channel_title, 1);
    }
    for (const sv of savedRes.rows) collectTokens(sv.title, 3);
    for (const p of postRes.rows) {
      for (const tag of Array.isArray(p.hashtags) ? p.hashtags : []) collectTokens(tag, 3);
      collectTokens(String(p.content || '').slice(0, 120), 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w]) => w);
  }

  // ==========================================
  // REPORTS, SERVERS, ADMIN CHAT & BD PREFS
  // ==========================================
  public async addUserReport(report: UserReport): Promise<UserReport> {
    await pgQuery(
      `INSERT INTO user_reports (id, reporter_id, target_user_id, target_conversation_id, target_message_id, reason, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        report.id,
        report.reporterId,
        report.targetUserId || null,
        report.targetConversationId || null,
        report.targetMessageId || null,
        report.reason,
        report.details || null,
        report.createdAt || new Date().toISOString(),
      ]
    );
    return report;
  }

  public async getServers(): Promise<ServerRegistryEntry[]> {
    const res = await pgQuery('SELECT * FROM server_registry ORDER BY created_at ASC');
    return res.rows.map(mapServerRow);
  }

  public async getServerById(id: string): Promise<ServerRegistryEntry | undefined> {
    const res = await pgQuery('SELECT * FROM server_registry WHERE id = $1 LIMIT 1', [id]);
    return res.rows[0] ? mapServerRow(res.rows[0]) : undefined;
  }

  public async recordServerHistory(
    entry: Omit<ServerSwitchHistoryEntry, 'id' | 'createdAt'>
  ): Promise<ServerSwitchHistoryEntry> {
    const rec: ServerSwitchHistoryEntry = {
      ...entry,
      id: `srvh_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      createdAt: new Date().toISOString(),
    };
    await pgQuery(
      `INSERT INTO server_switch_history (
        id, action, server_id, server_name, previous_primary_id, new_primary_id, actor_id, actor_username, summary, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        rec.id,
        rec.action,
        rec.serverId,
        rec.serverName,
        rec.previousPrimaryId || null,
        rec.newPrimaryId || null,
        rec.actorId,
        rec.actorUsername,
        rec.summary,
        rec.createdAt,
      ]
    );
    return rec;
  }

  public async getServerHistory(): Promise<ServerSwitchHistoryEntry[]> {
    const res = await pgQuery('SELECT * FROM server_switch_history ORDER BY created_at DESC LIMIT 100');
    return res.rows.map((r: any) => ({
      id: r.id,
      action: r.action,
      serverId: r.server_id,
      serverName: r.server_name,
      previousPrimaryId: r.previous_primary_id || undefined,
      newPrimaryId: r.new_primary_id || undefined,
      actorId: r.actor_id,
      actorUsername: r.actor_username,
      summary: r.summary,
      createdAt: toIso(r.created_at),
    }));
  }

  public async upsertServer(
    payload: Partial<ServerRegistryEntry> & { id?: string; name: string; baseUrl: string },
    actor: UserAccount
  ): Promise<ServerRegistryEntry> {
    const existing = payload.id ? await this.getServerById(payload.id) : undefined;
    const now = new Date().toISOString();
    if (existing) {
      if (existing.isolated && payload.assignedServices && payload.assignedServices.some((s) => s !== 'dream_world')) {
        throw new Error('Dream World server must remain isolated for Dream World only.');
      }
      const nextServices =
        Array.isArray(payload.assignedServices) && !existing.isolated
          ? payload.assignedServices
          : existing.assignedServices;
      const res = await pgQuery(
        `UPDATE server_registry
         SET name = $2, base_url = $3, health_path = $4, ws_url = $5, environment = $6,
             assigned_services = $7::jsonb, enabled = $8, notes = $9, updated_at = $10
         WHERE id = $1
         RETURNING *`,
        [
          existing.id,
          payload.name || existing.name,
          payload.baseUrl || existing.baseUrl,
          payload.healthPath !== undefined ? payload.healthPath : existing.healthPath || null,
          payload.wsUrl !== undefined ? payload.wsUrl : existing.wsUrl || null,
          payload.environment !== undefined ? payload.environment : existing.environment || null,
          JSON.stringify(nextServices),
          typeof payload.enabled === 'boolean' ? payload.enabled : existing.enabled,
          payload.notes !== undefined ? payload.notes : existing.notes || null,
          now,
        ]
      );
      const updated = mapServerRow(res.rows[0]);
      await this.recordServerHistory({
        action: 'update',
        serverId: updated.id,
        serverName: updated.name,
        actorId: actor.id,
        actorUsername: actor.username,
        summary: `Updated server configuration (${updated.baseUrl})`,
      });
      return updated;
    }

    const entryId = payload.id || `srv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const services =
      Array.isArray(payload.assignedServices) && payload.assignedServices.length > 0
        ? payload.assignedServices.filter((s) => s !== 'dream_world')
        : ['main_app'];
    const res = await pgQuery(
      `INSERT INTO server_registry (
        id, name, base_url, health_path, ws_url, environment, assigned_services,
        enabled, is_primary, isolated, last_health_status, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, FALSE, FALSE, 'unknown', $9, $10, $10)
      RETURNING *`,
      [
        entryId,
        payload.name,
        payload.baseUrl,
        payload.healthPath || '/health',
        payload.wsUrl || null,
        payload.environment || 'production',
        JSON.stringify(services),
        payload.enabled !== false,
        payload.notes || null,
        now,
      ]
    );
    const created = mapServerRow(res.rows[0]);
    await this.recordServerHistory({
      action: 'create',
      serverId: created.id,
      serverName: created.name,
      actorId: actor.id,
      actorUsername: actor.username,
      summary: `Registered server ${created.name} (${created.baseUrl})`,
    });
    return created;
  }

  public async updateServerHealth(
    id: string,
    status: 'healthy' | 'degraded' | 'offline',
    latencyMs: number | null
  ): Promise<ServerRegistryEntry | undefined> {
    const res = await pgQuery(
      `UPDATE server_registry
       SET last_health_status = $2, last_latency_ms = $3, last_checked_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status, latencyMs]
    );
    return res.rows[0] ? mapServerRow(res.rows[0]) : undefined;
  }

  public async setPrimaryServer(
    id: string,
    actor: UserAccount
  ): Promise<{ ok: boolean; error?: string; server?: ServerRegistryEntry; previousPrimaryId?: string }> {
    const servers = await this.getServers();
    const target = servers.find((s) => s.id === id);
    if (!target) return { ok: false, error: 'Server not found' };
    if (target.isolated || target.id === 'srv_dream_world') {
      return { ok: false, error: 'Isolated Dream World server cannot become primary MOTHERLAND engine.' };
    }
    if (!target.enabled) return { ok: false, error: 'Enable this server before promoting it to Primary.' };
    const prevPrimary = servers.find((s) => s.isPrimary && !s.isolated);

    await withPgTransaction(async (client) => {
      await client.query('UPDATE server_registry SET is_primary = (id = $1), updated_at = NOW() WHERE isolated = FALSE', [
        target.id,
      ]);
    });
    await this.recordServerHistory({
      action: 'set_primary',
      serverId: target.id,
      serverName: target.name,
      previousPrimaryId: prevPrimary?.id,
      newPrimaryId: target.id,
      actorId: actor.id,
      actorUsername: actor.username,
      summary: `Switched primary server to ${target.name} (${target.baseUrl})`,
    });
    return { ok: true, server: await this.getServerById(target.id), previousPrimaryId: prevPrimary?.id };
  }

  public async rollbackPrimaryServer(
    actor: UserAccount
  ): Promise<{ ok: boolean; error?: string; server?: ServerRegistryEntry }> {
    const history = await this.getServerHistory();
    const lastSwitch = history.find((h) => (h.action === 'set_primary' || h.action === 'rollback') && h.previousPrimaryId);
    const targetId = lastSwitch?.previousPrimaryId || 'srv_motherland_local';
    const target = await this.getServerById(targetId);
    if (!target || target.isolated) {
      return { ok: false, error: 'No eligible previous primary server found for rollback.' };
    }
    const servers = await this.getServers();
    const prevPrimary = servers.find((s) => s.isPrimary && !s.isolated);
    await withPgTransaction(async (client) => {
      await client.query(
        'UPDATE server_registry SET enabled = CASE WHEN id = $1 THEN TRUE ELSE enabled END, is_primary = (id = $1), updated_at = NOW() WHERE isolated = FALSE',
        [target.id]
      );
    });
    await this.recordServerHistory({
      action: 'rollback',
      serverId: target.id,
      serverName: target.name,
      previousPrimaryId: prevPrimary?.id,
      newPrimaryId: target.id,
      actorId: actor.id,
      actorUsername: actor.username,
      summary: `Rolled back primary server to ${target.name}`,
    });
    return { ok: true, server: await this.getServerById(target.id) };
  }

  public async deleteServer(id: string, actor: UserAccount): Promise<{ ok: boolean; error?: string }> {
    if (id === 'srv_dream_world' || id === 'srv_motherland_local') {
      return { ok: false, error: 'Built-in core or isolated Dream World server cannot be deleted (you can disable instead).' };
    }
    const target = await this.getServerById(id);
    if (!target) return { ok: false, error: 'Server not found' };
    if (target.isPrimary) return { ok: false, error: 'Switch primary server before deleting the active primary entry.' };
    await pgQuery('DELETE FROM server_registry WHERE id = $1', [id]);
    await this.recordServerHistory({
      action: 'delete',
      serverId: target.id,
      serverName: target.name,
      actorId: actor.id,
      actorUsername: actor.username,
      summary: `Removed server ${target.name}`,
    });
    return { ok: true };
  }

  public async getAdminConfigMessages(): Promise<AdminConfigChatMessage[]> {
    const res = await pgQuery('SELECT * FROM admin_config_messages ORDER BY created_at ASC LIMIT 150');
    return res.rows.map((r: any) => ({
      id: r.id,
      role: r.role,
      senderId: r.sender_id || undefined,
      senderName: r.sender_name || undefined,
      text: r.text,
      parsedIntent: r.parsed_intent || undefined,
      createdAt: toIso(r.created_at),
    }));
  }

  public async addAdminConfigMessage(msg: AdminConfigChatMessage): Promise<AdminConfigChatMessage> {
    await pgQuery(
      `INSERT INTO admin_config_messages (id, role, sender_id, sender_name, text, parsed_intent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [
        msg.id,
        msg.role,
        msg.senderId || null,
        msg.senderName || null,
        msg.text,
        msg.parsedIntent ? JSON.stringify(msg.parsedIntent) : null,
        msg.createdAt || new Date().toISOString(),
      ]
    );
    return msg;
  }

  public async getBdServicePrefs(userId: string): Promise<{ favorites: string[]; recent: string[] }> {
    const res = await pgQuery('SELECT favorites, recent FROM bd_service_prefs WHERE user_id = $1 LIMIT 1', [userId]);
    const r = res.rows[0];
    return {
      favorites: Array.isArray(r?.favorites) ? r.favorites : [],
      recent: Array.isArray(r?.recent) ? r.recent : [],
    };
  }

  public async toggleBdServiceFavorite(userId: string, serviceId: string): Promise<{ favorites: string[]; isFavorite: boolean }> {
    const current = await this.getBdServicePrefs(userId);
    const exists = current.favorites.includes(serviceId);
    const nextFavs = exists
      ? current.favorites.filter((id) => id !== serviceId)
      : [serviceId, ...current.favorites].slice(0, 50);
    await pgQuery(
      `INSERT INTO bd_service_prefs (user_id, favorites, recent, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET favorites = EXCLUDED.favorites, updated_at = NOW()`,
      [userId, JSON.stringify(nextFavs), JSON.stringify(current.recent)]
    );
    return { favorites: nextFavs, isFavorite: !exists };
  }

  public async recordBdServiceRecent(userId: string, serviceId: string): Promise<string[]> {
    const current = await this.getBdServicePrefs(userId);
    const nextRecent = [serviceId, ...current.recent.filter((id) => id !== serviceId)].slice(0, 20);
    await pgQuery(
      `INSERT INTO bd_service_prefs (user_id, favorites, recent, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, NOW())
       ON CONFLICT (user_id) DO UPDATE SET recent = EXCLUDED.recent, updated_at = NOW()`,
      [userId, JSON.stringify(current.favorites), JSON.stringify(nextRecent)]
    );
    return nextRecent;
  }
}
