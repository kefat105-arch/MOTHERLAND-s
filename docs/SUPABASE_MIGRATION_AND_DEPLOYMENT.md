# MOTHERLAND — Supabase PostgreSQL & Private S3 Storage Migration & Deployment Guide

This guide documents the production persistence architecture implemented for **MOTHERLAND** (`kefat105-arch/MOTHERLAND-s` on Render service `motherland-social`) using **Supabase PostgreSQL (Session Pooler)** and **Supabase Private S3 Object Storage (`motherland-media`)**.

---

## 1. Architecture Overview

| Layer | Implementation | Notes |
| --- | --- | --- |
| **Database Driver Selector** | `src/server/database.ts` | Auto-selects `postgres` when `DATABASE_URL` starts with `postgres://` or `postgresql://` (or when `DB_DRIVER=postgres`). Falls back to `json` (`MotherlandJsonAdapter`) only when `DATABASE_URL` is absent. |
| **PostgreSQL Pool** | `src/server/pgPool.ts` | Singleton `pg.Pool` with SSL enabled by default for Supabase (`PGSSLMODE=require`), transaction helper `withPgTransaction`, and `pingPostgres()`. |
| **SQL Schema & Migrations** | `migrations/001_initial_schema.sql`, `migrations/002_media_visibility_and_indexes.sql`, `src/server/pgMigrations.ts` | Transactional startup runner guarded by `pg_advisory_xact_lock` and tracked via `schema_migrations`. Non-destructive (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). |
| **PostgreSQL Repository** | `src/server/postgresDb.ts` | Full `DatabaseBackend` implementation preserving all existing string IDs (`usr_*`, `post_*`, `conv_*`, `msg_*`, `media_*`), PBKDF2 password compatibility (`1000` legacy + `120000` upgraded), HMAC session hashing, stories, feeds, reactions, comments, friendships, blocks, Wave messaging, notifications, calls, servers, and BD service prefs. |
| **Private Object Storage** | `src/server/s3Storage.ts` | Official AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner`) configured with `forcePathStyle: true`, 5 MB streaming multipart chunks, 250 MB max size enforcement, and SHA-256 verification. |
| **Media Access Control & Streaming** | `server.ts` (`/uploads/:filename`, `/api/media/*`) | Keeps `motherland-media` **PRIVATE**. All private media (Wave chat attachments, voice notes, `friends`/`only_me` post media) enforce `401` (unauthenticated) / `403` (unauthorized) via `db.canUserAccessMediaAsset` and support HTTP `Range` (`206 Partial Content`) streaming. |

---

## 2. Supabase Project Setup Checklist

1. **Database — Session Pooler (IPv4 Safe for Render)**:
   - Project: `motherland-production` (`rkbkxllsibjcdximykjd`)
   - Region: `ap-northeast-1`
   - Use **Session Pooler** (port `5432`), NOT Direct Connection (which may require IPv6):
     ```
     postgresql://postgres.rkbkxllsibjcdximykjd:<URL_ENCODED_PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
     ```
   - URL-encode any special characters in the database password (`@`, `#`, `%`, `/`, `?`, `:`).

2. **Storage — Private Bucket & S3 Access Keys**:
   - Bucket name: `motherland-media`
   - Visibility: Keep **PRIVATE** (do NOT make the bucket public).
   - Generate S3 Access Keys in **Supabase Dashboard -> Project Settings -> Storage -> S3 Access Keys**.
   - S3 Endpoint: `https://rkbkxllsibjcdximykjd.supabase.co/storage/v1/s3`
   - S3 Region: `ap-northeast-1`

---

## 3. Required Render Environment Variables (`motherland-social` -> Environment)

> **Important:** AI Studio preview secrets are isolated from Render. You MUST set these variables inside **Render Dashboard -> `motherland-social` -> Environment**. Never commit real credentials to GitHub.

| Variable | Required Value / Format |
| --- | --- |
| `NODE_ENV` | `production` |
| `DB_DRIVER` | `postgres` |
| `DATABASE_URL` | `postgresql://postgres.rkbkxllsibjcdximykjd:<PASSWORD>@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres` |
| `PGSSLMODE` | `require` |
| `PG_POOL_MAX` | `10` |
| `AUTH_SECRET` | Fixed 64-char random hex secret (so active user sessions survive restarts/redeploys) |
| `SUPABASE_URL` | `https://rkbkxllsibjcdximykjd.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase project publishable (`sb_publishable_...`) key |
| `SUPABASE_SECRET_KEY` | Supabase secret (`sb_secret_...`) key |
| `SUPABASE_S3_ENDPOINT` | `https://rkbkxllsibjcdximykjd.supabase.co/storage/v1/s3` |
| `SUPABASE_S3_REGION` | `ap-northeast-1` |
| `SUPABASE_S3_ACCESS_KEY_ID` | Generated Supabase S3 Access Key ID |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | Generated Supabase S3 Secret Access Key |
| `SUPABASE_STORAGE_BUCKET` | `motherland-media` |
| `MEDIA_STORAGE_MODE` | `s3` |
| `OBJECT_STORAGE_PROVIDER` | `supabase_s3` |

---

## 4. Zero-Downtime Deployment & Verification Steps

1. Push the updated repository to GitHub (`kefat105-arch/MOTHERLAND-s`, branch `main`).
2. Add all Environment Variables above in **Render Dashboard -> `motherland-social` -> Environment**.
3. Trigger **Manual Deploy -> Deploy latest commit** on Render.
4. On startup, `await initDatabase()` automatically connects to Supabase PostgreSQL via Session Pooler and applies `001_initial_schema.sql` and `002_media_visibility_and_indexes.sql` inside an advisory-locked transaction.
5. Verify live health after deploy:
   - `GET https://motherland-social.onrender.com/api/health?deep=1`
   - Confirm `status === "healthy"`, `database.driver === "postgres"`, `database.ok === true`, `objectStorage.provider === "supabase_s3"`, and `objectStorage.probeOk === true`.
6. Verify persistence & media privacy:
   - Register/login a user, create a post with an image/video, send a Wave voice message/image, restart the Render service, and confirm all records, media playback (`206 Partial Content` seeking), and private attachment `401`/`403` protections hold.

---

## 5. Migrating Existing JSON Data (If Existing Production JSON File Exists)

If your current Render instance has existing records in `data/motherland_db.json` (or `PROD_DATA_DIR/motherland_db.json`), export a verified JSON snapshot before switching `DB_DRIVER=postgres` (`GET /api/system/persistence-status` as Owner or download the latest snapshot from `data/backups/`). Always preserve original user IDs (`usr_*`), password hashes/salts/iterations, posts, comments, conversations, and messages when importing rows into the matching PostgreSQL tables (`users`, `posts`, `post_comments`, `conversations`, `conversation_participants`, `chat_messages`, `media_assets`).
