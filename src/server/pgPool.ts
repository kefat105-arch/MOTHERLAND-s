import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;

function shouldUseSsl(connectionString: string): boolean {
  const mode = (process.env.PGSSLMODE || process.env.DATABASE_SSL || '').trim().toLowerCase();
  if (mode === 'disable' || mode === 'false' || mode === '0') return false;
  if (mode === 'require' || mode === 'verify-ca' || mode === 'verify-full' || mode === 'true' || mode === '1') {
    return true;
  }
  return (
    connectionString.includes('supabase.com') ||
    connectionString.includes('supabase.co') ||
    connectionString.includes('pooler.supabase.com') ||
    connectionString.includes('sslmode=require') ||
    process.env.NODE_ENV === 'production'
  );
}

export function isPostgresConfigured(): boolean {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) return false;
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

export function getPgPool(): Pool {
  if (pool) return pool;
  const connectionString = (process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  const max = Math.max(2, Math.min(30, Number(process.env.PG_POOL_MAX || 10)));
  const idleTimeoutMillis = Math.max(5000, Number(process.env.PG_IDLE_TIMEOUT_MS || 30000));
  const connectionTimeoutMillis = Math.max(2000, Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000));

  const useSsl = shouldUseSsl(connectionString);
  const rejectUnauthorized =
    (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED || '').trim().toLowerCase() === 'true';

  pool = new Pool({
    connectionString,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    ssl: useSsl ? { rejectUnauthorized } : undefined,
    allowExitOnIdle: false,
  });

  pool.on('error', (err) => {
    // Never log connectionString or passwords
    console.error('[POSTGRES POOL] Unexpected idle client error:', err?.message || 'Unknown pool error');
  });

  return pool;
}

export async function pgQuery<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const p = getPgPool();
  return p.query<T>(text, params);
}

export async function withPgTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPgPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function pingPostgres(): Promise<{ ok: boolean; latencyMs: number; serverVersion?: string; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await pgQuery<{ version: string }>('SELECT version() AS version');
    return {
      ok: true,
      latencyMs: Date.now() - t0,
      serverVersion: res.rows[0]?.version?.split(' ').slice(0, 2).join(' '),
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err?.message || 'PostgreSQL connection check failed',
    };
  }
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    const current = pool;
    pool = null;
    await current.end();
  }
}
