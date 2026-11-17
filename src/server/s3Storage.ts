import crypto from 'crypto';
import { Readable, Transform } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const MAX_UPLOAD_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB

export interface S3StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function getS3Config(): S3StorageConfig | null {
  const endpoint = (process.env.SUPABASE_S3_ENDPOINT || '').trim();
  const region = (process.env.SUPABASE_S3_REGION || '').trim();
  const accessKeyId = (process.env.SUPABASE_S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.SUPABASE_S3_SECRET_ACCESS_KEY || '').trim();
  const bucket = (process.env.SUPABASE_STORAGE_BUCKET || '').trim();

  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  return {
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
  };
}

export function isS3Configured(): boolean {
  return getS3Config() !== null;
}

let cachedClient: S3Client | null = null;
let cachedConfigSig = '';

export function getS3Client(): { client: S3Client; config: S3StorageConfig } {
  const cfg = getS3Config();
  if (!cfg) {
    throw new Error(
      'Supabase S3 storage is not configured. Required env vars: SUPABASE_S3_ENDPOINT, SUPABASE_S3_REGION, SUPABASE_S3_ACCESS_KEY_ID, SUPABASE_S3_SECRET_ACCESS_KEY, SUPABASE_STORAGE_BUCKET.'
    );
  }
  const sig = `${cfg.endpoint}|${cfg.region}|${cfg.bucket}|${cfg.accessKeyId.slice(0, 6)}`;
  if (!cachedClient || cachedConfigSig !== sig) {
    cachedClient = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
    cachedConfigSig = sig;
  }
  return { client: cachedClient, config: cfg };
}

export function buildMediaObjectKey(params: {
  visibility: 'public' | 'private';
  ownerId: string;
  safeFilename: string;
}): string {
  const cleanOwner = params.ownerId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'user';
  const cleanFile = params.safeFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `media/${params.visibility}/${cleanOwner}/${cleanFile}`;
}

export async function uploadStreamToS3(params: {
  key: string;
  stream: Readable;
  contentType: string;
  contentLengthHeader?: number;
  maxBytes?: number;
}): Promise<{
  bucket: string;
  key: string;
  sizeBytes: number;
  sha256: string;
  etag?: string;
}> {
  const { client, config } = getS3Client();
  const maxBytes = params.maxBytes ?? MAX_UPLOAD_SIZE_BYTES;

  if (params.contentLengthHeader && params.contentLengthHeader > maxBytes) {
    const err: any = new Error(`File exceeds maximum allowed upload size of ${Math.round(maxBytes / (1024 * 1024))}MB.`);
    err.statusCode = 413;
    throw err;
  }

  const hash = crypto.createHash('sha256');
  let totalBytes = 0;

  const meteringStream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        const err: any = new Error(`Upload aborted: exceeded maximum size of ${Math.round(maxBytes / (1024 * 1024))}MB.`);
        err.statusCode = 413;
        callback(err);
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  const piped = params.stream.pipe(meteringStream);
  params.stream.on('error', (err) => {
    meteringStream.destroy(err);
  });

  const uploader = new Upload({
    client,
    params: {
      Bucket: config.bucket,
      Key: params.key,
      Body: piped,
      ContentType: params.contentType || 'application/octet-stream',
    },
    queueSize: 3,
    partSize: 5 * 1024 * 1024, // 5 MB S3 multipart chunk (keeps memory footprint tiny on Render Free)
    leavePartsOnError: false,
  });

  try {
    const out: any = await uploader.done();
    if (totalBytes === 0) {
      // Clean up empty object if created
      try {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: params.key }));
      } catch {
        // ignore cleanup error
      }
      const err: any = new Error('No media payload provided (0 bytes received).');
      err.statusCode = 400;
      throw err;
    }
    return {
      bucket: config.bucket,
      key: params.key,
      sizeBytes: totalBytes,
      sha256: hash.digest('hex'),
      etag: out?.ETag ? String(out.ETag).replace(/"/g, '') : undefined,
    };
  } catch (err) {
    try {
      await uploader.abort();
    } catch {
      // ignore abort failure
    }
    throw err;
  }
}

export async function uploadBufferToS3(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{
  bucket: string;
  key: string;
  sizeBytes: number;
  sha256: string;
  etag?: string;
}> {
  const { client, config } = getS3Client();
  const sha256 = crypto.createHash('sha256').update(params.buffer).digest('hex');
  const out = await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
      Body: params.buffer,
      ContentType: params.contentType || 'application/octet-stream',
      ContentLength: params.buffer.length,
    })
  );
  return {
    bucket: config.bucket,
    key: params.key,
    sizeBytes: params.buffer.length,
    sha256,
    etag: out.ETag ? String(out.ETag).replace(/"/g, '') : undefined,
  };
}

export async function headObjectInS3(
  key: string,
  bucketOverride?: string
): Promise<{
  exists: boolean;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
}> {
  const { client, config } = getS3Client();
  const bucket = bucketOverride || config.bucket;
  try {
    const res = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return {
      exists: true,
      contentType: res.ContentType,
      contentLength: typeof res.ContentLength === 'number' ? res.ContentLength : undefined,
      etag: res.ETag ? String(res.ETag).replace(/"/g, '') : undefined,
      lastModified: res.LastModified,
    };
  } catch (err: any) {
    const code = err?.$metadata?.httpStatusCode || err?.name;
    if (code === 404 || code === 'NotFound' || code === 'NoSuchKey') {
      return { exists: false };
    }
    throw err;
  }
}

export async function getObjectStreamFromS3(params: {
  key: string;
  bucketOverride?: string;
  range?: string;
}): Promise<{
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  acceptRanges?: string;
  etag?: string;
  statusCode: 200 | 206;
}> {
  const { client, config } = getS3Client();
  const bucket = params.bucketOverride || config.bucket;
  const res = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Range: params.range || undefined,
    })
  );

  if (!res.Body) {
    const err: any = new Error('Object body stream is empty.');
    err.statusCode = 404;
    throw err;
  }

  const bodyStream =
    res.Body instanceof Readable
      ? res.Body
      : Readable.fromWeb(res.Body as any);

  const isPartial = Boolean(res.ContentRange || res.$metadata?.httpStatusCode === 206);
  return {
    stream: bodyStream,
    contentType: res.ContentType,
    contentLength: typeof res.ContentLength === 'number' ? res.ContentLength : undefined,
    contentRange: res.ContentRange,
    acceptRanges: res.AcceptRanges || 'bytes',
    etag: res.ETag ? String(res.ETag).replace(/"/g, '') : undefined,
    statusCode: isPartial ? 206 : 200,
  };
}

export async function deleteObjectFromS3(key: string, bucketOverride?: string): Promise<void> {
  const { client, config } = getS3Client();
  const bucket = bucketOverride || config.bucket;
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export async function createSignedReadUrl(
  key: string,
  expiresInSeconds = 900,
  bucketOverride?: string
): Promise<string> {
  const { client, config } = getS3Client();
  const bucket = bucketOverride || config.bucket;
  const clamped = Math.max(60, Math.min(3600, Math.floor(expiresInSeconds)));
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: clamped }
  );
}

export async function createSignedUploadUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<{ url: string; bucket: string; key: string; expiresInSeconds: number }> {
  const { client, config } = getS3Client();
  const expiresInSeconds = Math.max(60, Math.min(900, Math.floor(params.expiresInSeconds || 300)));
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.key,
      ContentType: params.contentType || 'application/octet-stream',
    }),
    { expiresIn: expiresInSeconds }
  );
  return {
    url,
    bucket: config.bucket,
    key: params.key,
    expiresInSeconds,
  };
}

export async function checkS3Health(): Promise<{
  configured: boolean;
  ok: boolean;
  bucket?: string;
  region?: string;
  latencyMs?: number;
  error?: string;
}> {
  const cfg = getS3Config();
  if (!cfg) {
    return { configured: false, ok: false };
  }
  const t0 = Date.now();
  try {
    const { client } = getS3Client();
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    return {
      configured: true,
      ok: true,
      bucket: cfg.bucket,
      region: cfg.region,
      latencyMs: Date.now() - t0,
    };
  } catch (err: any) {
    return {
      configured: true,
      ok: false,
      bucket: cfg.bucket,
      region: cfg.region,
      latencyMs: Date.now() - t0,
      error: err?.message || 'Bucket health check failed',
    };
  }
}
