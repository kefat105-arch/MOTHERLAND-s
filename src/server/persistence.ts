import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const CURRENT_SCHEMA_VERSION = 3;

export interface MigrationRecord {
  version: number;
  name: string;
  appliedAt: string;
  backupFile?: string;
}

export interface BackupMetadata {
  filename: string;
  filePath: string;
  reason: string;
  createdAt: string;
  byteSize: number;
  sha256: string;
  schemaVersion: number;
  counts: {
    users: number;
    posts: number;
    stories: number;
    sessions: number;
    mediaAssets: number;
    conversations: number;
  };
  verified?: boolean;
}

export interface ExpiredStoryArchiveEntry {
  id: string;
  userId: string;
  mediaUrl: string;
  createdAt: string;
  expiresAt: string;
  expiredAtUtc: string;
}

export interface PersistencePaths {
  env: 'production' | 'development';
  dataDir: string;
  dbPath: string;
  uploadsDir: string;
  backupsDir: string;
  authSecretPath: string;
}

/**
 * Resolves persistence paths with dev/production isolation support while
 * preserving existing data/motherland_db.json when custom env dirs aren't set.
 */
export function resolvePersistencePaths(): PersistencePaths {
  const isProd = process.env.NODE_ENV === 'production';
  const defaultRoot = path.resolve(process.cwd(), 'data');

  let dataDir = defaultRoot;
  if (process.env.DATA_DIR && process.env.DATA_DIR.trim()) {
    dataDir = path.resolve(process.env.DATA_DIR.trim());
  } else if (isProd && process.env.PROD_DATA_DIR && process.env.PROD_DATA_DIR.trim()) {
    dataDir = path.resolve(process.env.PROD_DATA_DIR.trim());
  } else if (!isProd && process.env.DEV_DATA_DIR && process.env.DEV_DATA_DIR.trim()) {
    dataDir = path.resolve(process.env.DEV_DATA_DIR.trim());
  }

  const dbFileName = (
    (isProd ? process.env.PROD_DB_FILE : process.env.DEV_DB_FILE) ||
    process.env.DB_FILE_NAME ||
    'motherland_db.json'
  ).trim();

  const dbPath = path.join(dataDir, dbFileName);
  const uploadsDir = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(dataDir, 'uploads');
  const backupsDir = process.env.BACKUPS_DIR
    ? path.resolve(process.env.BACKUPS_DIR)
    : path.join(dataDir, 'backups');
  const authSecretPath = path.join(dataDir, '.auth_secret');

  return {
    env: isProd ? 'production' : 'development',
    dataDir,
    dbPath,
    uploadsDir,
    backupsDir,
    authSecretPath,
  };
}

export function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function computeSha256(content: Buffer | string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Atomic file write via temp file + fsync + rename so a crash or restart
 * mid-write never truncates or corrupts the primary database or uploaded media.
 */
export function atomicWriteBufferSync(targetPath: string, data: Buffer): void {
  const dir = path.dirname(targetPath);
  ensureDirExists(dir);
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const fd = fs.openSync(tmpPath, 'w', 0o600);
  try {
    let offset = 0;
    while (offset < data.length) {
      const written = fs.writeSync(fd, data, offset, data.length - offset);
      if (written <= 0) break;
      offset += written;
    }
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, targetPath);
}

export function atomicWriteJsonSync(targetPath: string, payload: any, writeChecksumSidecar = false): string {
  const serialized = JSON.stringify(payload, null, 2);
  const buf = Buffer.from(serialized, 'utf-8');
  const sha256 = computeSha256(buf);
  atomicWriteBufferSync(targetPath, buf);

  if (writeChecksumSidecar) {
    const sidecarPath = `${targetPath}.sha256`;
    const meta = {
      sha256,
      byteSize: buf.length,
      updatedAt: new Date().toISOString(),
      schemaVersion: Number(payload?.schemaVersion || 0),
    };
    atomicWriteBufferSync(sidecarPath, Buffer.from(JSON.stringify(meta, null, 2), 'utf-8'));
  }

  return sha256;
}

/**
 * Stable HMAC/token signing secret. Reads from ENV first; otherwise reads or
 * generates a persistent random key stored securely inside DATA_DIR/.auth_secret.
 * Never regenerated on server restart so sessions survive updates/restarts.
 */
let cachedAuthSecret: string | null = null;
export function getPersistentAuthSecret(paths = resolvePersistencePaths()): string {
  if (cachedAuthSecret) return cachedAuthSecret;

  const envSecret = (
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.MOTHERLAND_AUTH_SECRET ||
    ''
  ).trim();
  if (envSecret.length >= 16) {
    cachedAuthSecret = envSecret;
    return envSecret;
  }

  ensureDirExists(paths.dataDir);
  if (fs.existsSync(paths.authSecretPath)) {
    const existing = fs.readFileSync(paths.authSecretPath, 'utf-8').trim();
    if (existing.length >= 32) {
      cachedAuthSecret = existing;
      return existing;
    }
  }

  const generated = crypto.randomBytes(48).toString('hex');
  atomicWriteBufferSync(paths.authSecretPath, Buffer.from(generated, 'utf-8'));
  cachedAuthSecret = generated;
  return generated;
}

export function hashSessionToken(rawToken: string, secret?: string): string {
  const key = secret || getPersistentAuthSecret();
  return crypto.createHmac('sha256', key).update(rawToken).digest('hex');
}

export function buildBackupMetadata(filename: string, filePath: string, reason: string, data: any, sha256: string, byteSize: number): BackupMetadata {
  return {
    filename,
    filePath,
    reason,
    createdAt: new Date().toISOString(),
    byteSize,
    sha256,
    schemaVersion: Number(data?.schemaVersion || 0),
    counts: {
      users: Array.isArray(data?.users) ? data.users.length : 0,
      posts: Array.isArray(data?.posts) ? data.posts.length : 0,
      stories: Array.isArray(data?.stories) ? data.stories.length : 0,
      sessions: Array.isArray(data?.sessions) ? data.sessions.length : 0,
      mediaAssets: Array.isArray(data?.mediaAssets) ? data.mediaAssets.length : 0,
      conversations: Array.isArray(data?.conversations) ? data.conversations.length : 0,
    },
  };
}

export function createDatabaseBackup(
  data: any,
  reason: string,
  paths = resolvePersistencePaths(),
  maxRetention = 35
): BackupMetadata {
  ensureDirExists(paths.backupsDir);
  const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || 'manual';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = crypto.randomBytes(3).toString('hex');
  const filename = `backup_${safeReason}_${stamp}_${suffix}.json`;
  const filePath = path.join(paths.backupsDir, filename);

  // Deep snapshot copy — completely independent of live in-memory references or live DB file
  const snapshot = JSON.parse(JSON.stringify(data));
  const serialized = JSON.stringify(snapshot, null, 2);
  const buf = Buffer.from(serialized, 'utf-8');
  const sha256 = computeSha256(buf);

  atomicWriteBufferSync(filePath, buf);
  const meta = buildBackupMetadata(filename, filePath, safeReason, snapshot, sha256, buf.length);
  atomicWriteBufferSync(`${filePath}.meta.json`, Buffer.from(JSON.stringify(meta, null, 2), 'utf-8'));

  pruneOldBackups(paths.backupsDir, maxRetention);
  return { ...meta, verified: true };
}

function pruneOldBackups(backupsDir: string, maxRetention: number): void {
  try {
    const entries = fs
      .readdirSync(backupsDir)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.json') && !f.endsWith('.meta.json'))
      .map((f) => {
        const full = path.join(backupsDir, f);
        return { name: f, full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (entries.length <= maxRetention) return;
    // Keep pre-migration backups longer where possible, prune oldest scheduled backups first
    const scheduled = entries.filter((e) => e.name.startsWith('backup_scheduled_'));
    const excessCount = entries.length - maxRetention;
    const toRemove = (scheduled.length >= excessCount ? scheduled.slice(-excessCount) : entries.slice(-excessCount));
    for (const item of toRemove) {
      try {
        if (fs.existsSync(item.full)) fs.unlinkSync(item.full);
        const metaPath = `${item.full}.meta.json`;
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      } catch {
        // Best-effort cleanup
      }
    }
  } catch {
    // Ignore prune errors
  }
}

export function verifyBackupFile(backupFilePath: string): {
  valid: boolean;
  error?: string;
  sha256?: string;
  meta?: BackupMetadata;
  parsed?: any;
} {
  try {
    if (!fs.existsSync(backupFilePath)) {
      return { valid: false, error: 'Backup file does not exist.' };
    }
    const rawBuf = fs.readFileSync(backupFilePath);
    const actualSha = computeSha256(rawBuf);
    const metaPath = `${backupFilePath}.meta.json`;
    let meta: BackupMetadata | undefined;

    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (meta?.sha256 && meta.sha256 !== actualSha) {
          return {
            valid: false,
            error: `Checksum mismatch (expected ${meta.sha256}, got ${actualSha})`,
            sha256: actualSha,
            meta,
          };
        }
      } catch {
        return { valid: false, error: 'Corrupt backup metadata sidecar.' };
      }
    }

    const parsed = JSON.parse(rawBuf.toString('utf-8'));
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.users) || !Array.isArray(parsed.posts)) {
      return { valid: false, error: 'Backup payload failed structural validation (missing users/posts).' };
    }

    return {
      valid: true,
      sha256: actualSha,
      meta: meta
        ? { ...meta, verified: true }
        : buildBackupMetadata(path.basename(backupFilePath), backupFilePath, 'verified', parsed, actualSha, rawBuf.length),
      parsed,
    };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Backup read/parse failure.' };
  }
}

export function listDatabaseBackups(paths = resolvePersistencePaths()): BackupMetadata[] {
  ensureDirExists(paths.backupsDir);
  const files = fs
    .readdirSync(paths.backupsDir)
    .filter((f) => f.startsWith('backup_') && f.endsWith('.json') && !f.endsWith('.meta.json'))
    .map((f) => ({ name: f, full: path.join(paths.backupsDir, f), mtime: fs.statSync(path.join(paths.backupsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  return files.map((f) => {
    const check = verifyBackupFile(f.full);
    if (check.meta) {
      return { ...check.meta, verified: check.valid };
    }
    return {
      filename: f.name,
      filePath: f.full,
      reason: 'unknown',
      createdAt: new Date(f.mtime).toISOString(),
      byteSize: fs.statSync(f.full).size,
      sha256: check.sha256 || '',
      schemaVersion: 0,
      counts: { users: 0, posts: 0, stories: 0, sessions: 0, mediaAssets: 0, conversations: 0 },
      verified: check.valid,
    };
  });
}

export function restoreBackupToPath(
  backupFilePath: string,
  targetDbPath: string
): { ok: boolean; error?: string; restoredCounts?: BackupMetadata['counts']; sha256?: string } {
  const verification = verifyBackupFile(backupFilePath);
  if (!verification.valid || !verification.parsed) {
    return { ok: false, error: verification.error || 'Backup verification failed.' };
  }

  // If target exists and is valid, save a forensic pre-restore copy beside backups
  if (fs.existsSync(targetDbPath)) {
    try {
      const existingRaw = fs.readFileSync(targetDbPath, 'utf-8');
      const existingParsed = JSON.parse(existingRaw);
      const targetDir = path.dirname(targetDbPath);
      const backupDir = path.join(targetDir, 'backups');
      ensureDirExists(backupDir);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      atomicWriteJsonSync(path.join(backupDir, `pre_restore_${stamp}.json`), existingParsed, true);
    } catch {
      // Existing target may be corrupt; preserve raw bytes
      try {
        fs.copyFileSync(targetDbPath, `${targetDbPath}.pre_restore_corrupt.${Date.now()}`);
      } catch {
        // ignore
      }
    }
  }

  const sha256 = atomicWriteJsonSync(targetDbPath, verification.parsed, true);
  return {
    ok: true,
    sha256,
    restoredCounts: verification.meta?.counts,
  };
}

/**
 * Safely loads the database. NEVER wipes existing production data if DB_PATH
 * has a transient parse error — automatically recovers from latest verified backup
 * or throws loudly instead of silently resetting to seed data.
 */
export function loadDatabaseSafely<T extends { users: any[]; posts: any[] }>(
  paths: PersistencePaths,
  initialSeedFactory: () => T
): { data: T; loadedFrom: 'primary' | 'backup_recovery' | 'fresh_seed'; recoveredBackup?: string } {
  ensureDirExists(paths.dataDir);
  ensureDirExists(paths.uploadsDir);
  ensureDirExists(paths.backupsDir);

  if (fs.existsSync(paths.dbPath)) {
    try {
      const raw = fs.readFileSync(paths.dbPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.users) || !Array.isArray(parsed.posts)) {
        throw new Error('Database JSON missing critical collections (users/posts).');
      }
      return { data: parsed as T, loadedFrom: 'primary' };
    } catch (primaryErr: any) {
      console.error(`[PERSISTENCE CRITICAL] Primary DB read/parse failed (${paths.dbPath}):`, primaryErr?.message);
      // Preserve corrupt file for forensic recovery — NEVER silently delete it
      try {
        const forensicPath = `${paths.dbPath}.corrupt.${Date.now()}`;
        fs.copyFileSync(paths.dbPath, forensicPath);
        console.error(`[PERSISTENCE] Preserved unreadable DB file at ${forensicPath}`);
      } catch {
        // ignore copy error
      }

      // Attempt automatic recovery from newest verified backup
      const backups = listDatabaseBackups(paths);
      for (const b of backups) {
        const verified = verifyBackupFile(b.filePath);
        if (verified.valid && verified.parsed) {
          console.warn(`[PERSISTENCE RECOVERY] Restoring from verified backup ${b.filename}`);
          atomicWriteJsonSync(paths.dbPath, verified.parsed, true);
          return {
            data: verified.parsed as T,
            loadedFrom: 'backup_recovery',
            recoveredBackup: b.filename,
          };
        }
      }

      throw new Error(
        `FATAL PERSISTENCE GUARD: Primary DB (${paths.dbPath}) failed validation and no verified backup could be loaded. Refusing to overwrite with seed data.`
      );
    }
  }

  // Primary DB doesn't exist yet — check backups first before seeding!
  const backups = listDatabaseBackups(paths);
  for (const b of backups) {
    const verified = verifyBackupFile(b.filePath);
    if (verified.valid && verified.parsed) {
      console.warn(`[PERSISTENCE RECOVERY] Primary DB missing; restoring from verified backup ${b.filename}`);
      atomicWriteJsonSync(paths.dbPath, verified.parsed, true);
      return {
        data: verified.parsed as T,
        loadedFrom: 'backup_recovery',
        recoveredBackup: b.filename,
      };
    }
  }

  // True first-time installation
  const seeded = initialSeedFactory();
  atomicWriteJsonSync(paths.dbPath, seeded, true);
  return { data: seeded, loadedFrom: 'fresh_seed' };
}

export function inferMimeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.opus': 'audio/opus',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.zip': 'application/zip',
    '.json': 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}

export function parseDeviceName(userAgent?: string): string {
  const ua = (userAgent || '').trim();
  if (!ua) return 'Unknown Device';
  let os = 'Unknown OS';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/curl|node|undici|axios|postman/i.test(ua)) os = 'API Client';

  let browser = '';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/curl/i.test(ua)) browser = 'curl';

  return browser ? `${browser} on ${os}` : os;
}
