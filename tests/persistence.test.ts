import test, { after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  hashPassword,
  verifyPassword,
  needsPasswordUpgrade,
  DEFAULT_PBKDF2_ITERATIONS,
  LEGACY_PBKDF2_ITERATIONS,
  UserAccount,
} from '../src/server/db.ts';
import { hashSessionToken, PersistencePaths } from '../src/server/persistence.ts';
import { MotherlandJsonAdapter } from '../src/server/jsonDbAdapter.ts';
import {
  buildMediaObjectKey,
  getS3Config,
  isS3Configured,
  checkS3Health,
} from '../src/server/s3Storage.ts';
import { pingPostgres, isPostgresConfigured, closePgPool } from '../src/server/pgPool.ts';

const tempDirs: string[] = [];

function createTempPaths(): PersistencePaths {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motherland-test-'));
  tempDirs.push(dir);
  return {
    env: 'development',
    dataDir: dir,
    dbPath: path.join(dir, 'motherland_db.json'),
    uploadsDir: path.join(dir, 'uploads'),
    backupsDir: path.join(dir, 'backups'),
    authSecretPath: path.join(dir, '.auth_secret'),
  };
}

function makeTestUser(overrides: Partial<UserAccount> & { id: string; username: string }): UserAccount {
  const { hash, salt, iterations } = hashPassword('StrongPass!2026');
  const now = new Date().toISOString();
  return {
    email: `${overrides.username}@example.com`,
    passwordHash: hash,
    passwordSalt: salt,
    passwordIterations: iterations,
    hasPassword: true,
    authProvider: 'password',
    authProviders: ['password'],
    displayName: overrides.username,
    avatar: '',
    coverImage: '',
    bio: '',
    joinedDate: 'November 2026',
    isVerified: false,
    role: 'user',
    isEmailVerified: false,
    isPhoneVerified: false,
    twoFactorEnabled: false,
    isPrivate: false,
    privacy: {
      profileVisibility: 'public',
      showOnlineStatus: true,
      allowDirectMessages: 'everyone',
      showContactInfo: false,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

after(async () => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup issues
    }
  }
  await closePgPool();
});

describe('MOTHERLAND Authentication & Cryptography Preservation', () => {
  test('supports both legacy (1000 iter) and modern (120000 iter) PBKDF2 password verification', () => {
    const legacy = hashPassword('LegacyPass99!', undefined, LEGACY_PBKDF2_ITERATIONS);
    assert.equal(verifyPassword('LegacyPass99!', legacy.hash, legacy.salt, LEGACY_PBKDF2_ITERATIONS), true);
    assert.equal(verifyPassword('LegacyPass99!', legacy.hash, legacy.salt), true);
    assert.equal(verifyPassword('WrongPass', legacy.hash, legacy.salt, LEGACY_PBKDF2_ITERATIONS), false);

    const modern = hashPassword('ModernPass99!', undefined, DEFAULT_PBKDF2_ITERATIONS);
    assert.equal(verifyPassword('ModernPass99!', modern.hash, modern.salt, DEFAULT_PBKDF2_ITERATIONS), true);
    assert.equal(verifyPassword('WrongPass', modern.hash, modern.salt, DEFAULT_PBKDF2_ITERATIONS), false);

    const legacyUser = makeTestUser({
      id: 'usr_legacy',
      username: 'legacy_u',
      passwordHash: legacy.hash,
      passwordSalt: legacy.salt,
      passwordIterations: LEGACY_PBKDF2_ITERATIONS,
    });
    const modernUser = makeTestUser({
      id: 'usr_modern',
      username: 'modern_u',
      passwordHash: modern.hash,
      passwordSalt: modern.salt,
      passwordIterations: DEFAULT_PBKDF2_ITERATIONS,
    });

    assert.equal(needsPasswordUpgrade(legacyUser), true);
    assert.equal(needsPasswordUpgrade(modernUser), false);
  });

  test('hashSessionToken uses deterministic HMAC-SHA256 with a supplied secret', () => {
    const t1 = hashSessionToken('raw-token-abc', 'secret-one');
    const t2 = hashSessionToken('raw-token-abc', 'secret-one');
    const t3 = hashSessionToken('raw-token-abc', 'secret-two');

    assert.equal(t1, t2);
    assert.notEqual(t1, t3);
    assert.equal(t1.length, 64);
  });
});

describe('MOTHERLAND Persistence Lifecycle & Media Access Control (JsonDbAdapter)', () => {
  test('persists users, sessions, posts, comments, friendships, and Wave messages across reload', async () => {
    const paths = createTempPaths();
    const db1 = new MotherlandJsonAdapter(paths);
    await db1.init();

    const alice = await db1.createUser(makeTestUser({ id: 'usr_alice', username: 'alice_bd' }));
    const bob = await db1.createUser(makeTestUser({ id: 'usr_bob', username: 'bob_bd' }));

    const session = await db1.createSession(alice.id, 'Mozilla/5.0 TestAgent', {
      ipAddress: '127.0.0.1',
      authMethod: 'password',
    });
    assert.ok(session.token && session.token.length > 16);
    assert.ok(await db1.findSessionByToken(session.token));

    await db1.addFriendship(alice.id, bob.id);
    assert.equal(await db1.isFriend(alice.id, bob.id), true);

    const post = await db1.addPost({
      id: 'post_001',
      source: 'motherland',
      author: {
        id: alice.id,
        displayName: alice.displayName,
        username: alice.username,
        avatar: '',
        isVerified: false,
      },
      content: 'Persistent post from Dhaka',
      hashtags: ['dhaka'],
      createdAt: new Date().toISOString(),
      stats: {
        likes: 0,
        comments: 0,
        shares: 0,
      },
      audience: 'public',
    });
    assert.equal(post.id, 'post_001');

    await db1.addComment('post_001', {
      id: 'cmt_001',
      postId: 'post_001',
      userId: bob.id,
      userDisplayName: bob.displayName,
      userUsername: bob.username,
      userAvatar: '',
      text: 'Hello Alice!',
      createdAt: new Date().toISOString(),
      likesCount: 0,
    });

    const convRes = await db1.getOrCreateDirectConversation(alice.id, bob.id);
    assert.ok(convRes.conversation);
    const convId = convRes.conversation.id;

    const msgRes = await db1.addChatMessage(convId, alice.id, 'Shuvo sokal Bob!');
    assert.ok(msgRes.message);

    await db1.close();

    // Reload from disk in a fresh adapter instance
    const db2 = new MotherlandJsonAdapter(paths);
    await db2.init();

    const loadedAlice = await db2.findUserById(alice.id);
    assert.equal(loadedAlice?.username, 'alice_bd');

    const reloadedSession = await db2.findSessionByToken(session.token);
    assert.equal(reloadedSession?.userId, alice.id);

    const loadedPost = await db2.findPostById('post_001');
    assert.equal(loadedPost?.content, 'Persistent post from Dhaka');

    const loadedComments = await db2.getComments('post_001');
    assert.equal(loadedComments.length, 1);
    assert.equal(loadedComments[0].text, 'Hello Alice!');

    const loadedMsgs = await db2.getConversationMessages(convId, alice.id);
    assert.equal(loadedMsgs.messages?.length, 1);
    assert.equal(loadedMsgs.messages?.[0].text, 'Shuvo sokal Bob!');

    // Session revocation
    assert.equal(await db2.deleteSession(session.token), true);
    assert.equal(await db2.findSessionByToken(session.token), undefined);

    await db2.close();
  });

  test('enforces strict private media authorization (401 anonymous, 403 outsider, 200 participant/owner)', async () => {
    const paths = createTempPaths();
    const adapter = new MotherlandJsonAdapter(paths);
    await adapter.init();

    const alice = await adapter.createUser(makeTestUser({ id: 'usr_a', username: 'alice' }));
    const bob = await adapter.createUser(makeTestUser({ id: 'usr_b', username: 'bob' }));
    const mallory = await adapter.createUser(makeTestUser({ id: 'usr_m', username: 'mallory' }));

    const convRes = await adapter.getOrCreateDirectConversation(alice.id, bob.id);
    assert.ok(convRes.conversation);
    const convId = convRes.conversation.id;

    const now = new Date().toISOString();
    const asset = await adapter.registerMediaAsset({
      id: 'media_priv_1',
      ownerId: alice.id,
      originalFilename: 'voice.webm',
      storedFilename: 'voice_123.webm',
      url: '/uploads/voice_123.webm',
      mimeType: 'audio/webm',
      sizeBytes: 1024,
      sha256: 'abc',
      visibility: 'public',
      createdAt: now,
      updatedAt: now,
      storageProvider: 'local_persistent',
    });

    // Public before sync -> everyone allowed
    assert.equal((await adapter.canUserAccessMediaAsset(asset, undefined)).allowed, true);

    // Sync to private conversation -> strictly restricted
    await adapter.syncMediaVisibilityForUrls(['/uploads/voice_123.webm'], alice.id, 'private', convId);
    const updatedAsset = await adapter.getMediaAsset('voice_123.webm');
    assert.ok(updatedAsset);
    assert.equal(updatedAsset.visibility, 'private');
    assert.equal(updatedAsset.conversationId, convId);

    // Anonymous -> 401
    const anonCheck = await adapter.canUserAccessMediaAsset(updatedAsset, undefined);
    assert.equal(anonCheck.allowed, false);
    assert.equal(anonCheck.statusCode, 401);

    // Unrelated user -> 403
    const outsiderCheck = await adapter.canUserAccessMediaAsset(updatedAsset, mallory.id, 'user');
    assert.equal(outsiderCheck.allowed, false);
    assert.equal(outsiderCheck.statusCode, 403);

    // Conversation participant -> 200
    const bobCheck = await adapter.canUserAccessMediaAsset(updatedAsset, bob.id, 'user');
    assert.equal(bobCheck.allowed, true);
    assert.equal(bobCheck.statusCode, 200);

    // Private post asset (no conversationId) -> owner allowed, non-owner denied
    const postAsset = await adapter.registerMediaAsset({
      id: 'media_priv_post',
      ownerId: alice.id,
      originalFilename: 'secret_photo.jpg',
      storedFilename: 'secret_photo.jpg',
      url: '/uploads/secret_photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 2048,
      sha256: 'def',
      visibility: 'private',
      createdAt: now,
      updatedAt: now,
      storageProvider: 'local_persistent',
    });

    assert.equal((await adapter.canUserAccessMediaAsset(postAsset, bob.id, 'user')).allowed, false);
    assert.equal((await adapter.canUserAccessMediaAsset(postAsset, alice.id, 'user')).allowed, true);

    await adapter.close();
  });
});

describe('SQL Migrations & Supabase S3 Storage Helpers', () => {
  test('001_initial_schema.sql and 002_media_visibility_and_indexes.sql contain all required tables and indexes', () => {
    const m1 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/001_initial_schema.sql'), 'utf-8');
    const m2 = fs.readFileSync(path.resolve(process.cwd(), 'migrations/002_media_visibility_and_indexes.sql'), 'utf-8');

    const requiredTables = [
      'schema_migrations',
      'users',
      'sessions',
      'otp_codes',
      'verified_contacts',
      'login_activity',
      'youtube_oauth_tokens',
      'posts',
      'post_reactions',
      'saved_posts',
      'post_comments',
      'drafts',
      'stories',
      'expired_stories_archive',
      'media_assets',
      'short_videos',
      'long_videos',
      'saved_videos',
      'watch_history',
      'friendships',
      'friend_requests',
      'follows',
      'blocks',
      'user_reports',
      'notifications',
      'conversations',
      'conversation_participants',
      'chat_messages',
      'call_records',
      'server_registry',
      'server_switch_history',
      'admin_config_messages',
      'bd_service_prefs',
    ];

    for (const tbl of requiredTables) {
      assert.match(m1, new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${tbl}\\b`, 'i'), `Missing table ${tbl}`);
    }
    assert.match(m2, /visibility/i);
    assert.match(m2, /conversation_id/i);
  });

  test('s3Storage helper safely reports unconfigured when env vars are absent and formats deterministic keys', () => {
    const key = buildMediaObjectKey({
      visibility: 'private',
      ownerId: 'usr/123:abc',
      safeFilename: 'voice note.webm',
    });
    assert.equal(key, 'media/private/usr_123_abc/voice_note.webm');

    if (!process.env.SUPABASE_S3_ENDPOINT) {
      assert.equal(isS3Configured(), false);
      assert.equal(getS3Config(), null);
    }
  });
});

describe('Live Supabase Infrastructure (Env-Gated — Skipped When Credentials Unset)', () => {
  test(
    'live Supabase PostgreSQL Session Pooler connectivity check',
    { skip: !isPostgresConfigured() ? 'DATABASE_URL not set in workspace' : false },
    async () => {
      const ping = await pingPostgres();
      assert.equal(ping.ok, true, ping.error);
    }
  );

  test(
    'live Supabase S3 private bucket HeadBucket check',
    { skip: !isS3Configured() ? 'SUPABASE_S3_* env vars not set in workspace' : false },
    async () => {
      const res = await checkS3Health();
      assert.equal(res.ok, true, res.error);
    }
  );
});
