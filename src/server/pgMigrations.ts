import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getPgPool, withPgTransaction } from './pgPool.ts';

export interface AppliedSqlMigration {
  version: number;
  name: string;
  checksum: string;
  appliedAt: string;
}

function resolveMigrationsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'migrations'),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

export async function runPostgresMigrations(): Promise<{
  appliedNow: AppliedSqlMigration[];
  totalApplied: AppliedSqlMigration[];
}> {
  const pool = getPgPool();

  // Ensure schema_migrations table exists before acquiring migration lock
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const dir = resolveMigrationsDir();
  if (!fs.existsSync(dir)) {
    throw new Error(`Migrations directory not found at ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.*\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b));

  const appliedNow: AppliedSqlMigration[] = [];

  await withPgTransaction(async (client) => {
    // Advisory transaction lock prevents race conditions if two workers boot simultaneously
    await client.query('SELECT pg_advisory_xact_lock(724910421)');

    const existingRes = await client.query<{
      version: number;
      name: string;
      checksum: string;
      applied_at: Date;
    }>('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC');

    const appliedByVersion = new Map(
      existingRes.rows.map((r) => [Number(r.version), r])
    );

    for (const file of files) {
      const versionMatch = file.match(/^(\d+)_/);
      if (!versionMatch) continue;
      const version = parseInt(versionMatch[1], 10);
      const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      const already = appliedByVersion.get(version);
      if (already) {
        continue;
      }

      await client.query(sql);
      const ins = await client.query<{ applied_at: Date }>(
        `INSERT INTO schema_migrations (version, name, checksum)
         VALUES ($1, $2, $3)
         ON CONFLICT (version) DO NOTHING
         RETURNING applied_at`,
        [version, file, checksum]
      );
      appliedNow.push({
        version,
        name: file,
        checksum,
        appliedAt: (ins.rows[0]?.applied_at || new Date()).toISOString(),
      });
    }
  });

  const finalRes = await pool.query<{
    version: number;
    name: string;
    checksum: string;
    applied_at: Date;
  }>('SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC');

  return {
    appliedNow,
    totalApplied: finalRes.rows.map((r) => ({
      version: Number(r.version),
      name: r.name,
      checksum: r.checksum,
      appliedAt: new Date(r.applied_at).toISOString(),
    })),
  };
}
