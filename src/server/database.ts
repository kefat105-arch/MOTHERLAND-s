import type { DatabaseBackend } from './dbInterface.ts';
import { MotherlandJsonAdapter } from './jsonDbAdapter.ts';
import { MotherlandPostgresDb } from './postgresDb.ts';
import { isPostgresConfigured } from './pgPool.ts';

let activeBackend: DatabaseBackend | null = null;
let initializedPromise: Promise<DatabaseBackend> | null = null;

export function selectDatabaseDriver(): 'postgres' | 'json' {
  const forced = (process.env.DB_DRIVER || '').trim().toLowerCase();
  if (forced === 'postgres') return 'postgres';
  if (forced === 'json') return 'json';
  return isPostgresConfigured() ? 'postgres' : 'json';
}

export async function initDatabase(): Promise<DatabaseBackend> {
  if (activeBackend) return activeBackend;
  if (initializedPromise) return initializedPromise;

  initializedPromise = (async () => {
    const driver = selectDatabaseDriver();
    if (driver === 'postgres') {
      if (!isPostgresConfigured()) {
        throw new Error('DB_DRIVER=postgres is set, but DATABASE_URL is missing or invalid.');
      }
      const pgDb = new MotherlandPostgresDb();
      await pgDb.init();
      activeBackend = pgDb;
      console.log('[MOTHERLAND DB] Initialized PostgreSQL persistent backend (Supabase Session Pooler).');
      return pgDb;
    }

    const jsonDb = new MotherlandJsonAdapter();
    await jsonDb.init();
    activeBackend = jsonDb;
    console.log('[MOTHERLAND DB] Initialized local JSON fallback backend (DATABASE_URL not configured).');
    return jsonDb;
  })();

  try {
    return await initializedPromise;
  } catch (err) {
    initializedPromise = null;
    throw err;
  }
}

export function getDb(): DatabaseBackend {
  if (!activeBackend) {
    throw new Error('Database has not been initialized yet. Call await initDatabase() at startup.');
  }
  return activeBackend;
}

export async function closeDatabase(): Promise<void> {
  if (activeBackend) {
    await activeBackend.close();
    activeBackend = null;
    initializedPromise = null;
  }
}

/**
 * Proxy object so existing `db.<method>(...)` call sites cleanly delegate
 * to whichever initialized backend (`postgres` or `json`) is active.
 */
export const db: DatabaseBackend = new Proxy({} as DatabaseBackend, {
  get(_target, prop) {
    const instance = getDb() as any;
    const val = instance[prop];
    return typeof val === 'function' ? val.bind(instance) : val;
  },
});
