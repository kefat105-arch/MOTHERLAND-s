import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbManager } from './src/server/database';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

function decodeEntities(str: string = ''): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function extractVideoRenderers(obj: any, results: any[] = [], seen = new Set<string>()): any[] {
  if (!obj || typeof obj !== 'object') return results;

  // 1. Standard videoRenderer
  if (obj.videoRenderer && obj.videoRenderer.videoId) {
    const vr = obj.videoRenderer;
    const vid = vr.videoId;
    if (!seen.has(vid)) {
      seen.add(vid);
      const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || 'YouTube Video';
      const creator =
        vr.ownerText?.runs?.[0]?.text ||
        vr.shortBylineText?.runs?.[0]?.text ||
        vr.longBylineText?.runs?.[0]?.text ||
        'YouTube Creator';
      const thumb =
        vr.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
        `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
      const published = vr.publishedTimeText?.simpleText || '';
      const desc =
        vr.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') ||
        vr.descriptionSnippet?.runs?.map((r: any) => r.text).join('') ||
        '';

      results.push({
        id: `yt_${vid}`,
        platform: 'youtube',
        videoId: vid,
        title: decodeEntities(title),
        creatorName: decodeEntities(creator),
        originalVideoUrl: `https://www.youtube.com/watch?v=${vid}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${vid}?enablejsapi=1`,
        thumbnailUrl: thumb,
        publishedAt: published,
        duration: vr.lengthText?.simpleText || '',
        playbackAvailability: 'playable_embed',
        aspectRatio: '16:9',
        category: 'trending',
        description: decodeEntities(desc),
      });
    }
  }

  // 2. Lockup view model & Shorts lockup view model
  const lockup = obj.lockupViewModel || obj.shortsLockupViewModel;
  if (lockup) {
    const url = lockup.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url || '';
    const m = url.match(/(?:\/watch\?v=|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    const vid = m ? m[1] : (lockup.entityId?.match(/([a-zA-Z0-9_-]{11})$/) || [])[1];
    if (vid && !seen.has(vid)) {
      seen.add(vid);
      const title =
        lockup.metadata?.lockupMetadataViewModel?.title?.content ||
        lockup.overlayMetadata?.primaryText?.content ||
        lockup.accessibilityText?.split(',')[0] ||
        'YouTube Video';
      const creator =
        lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content ||
        'YouTube Creator';
      const thumb =
        lockup.image?.sources?.slice(-1)[0]?.url ||
        `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

      results.push({
        id: `yt_${vid}`,
        platform: 'youtube',
        videoId: vid,
        title: decodeEntities(title),
        creatorName: decodeEntities(creator),
        originalVideoUrl: `https://www.youtube.com/watch?v=${vid}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${vid}?enablejsapi=1`,
        thumbnailUrl: thumb,
        publishedAt: 'Recent',
        duration: '',
        playbackAvailability: 'playable_embed',
        aspectRatio: '16:9',
        category: 'trending',
        description: '',
      });
    }
  }

  // 3. Reel Item Renderer (Shorts)
  if (obj.reelItemRenderer && obj.reelItemRenderer.videoId) {
    const rir = obj.reelItemRenderer;
    const vid = rir.videoId;
    if (!seen.has(vid)) {
      seen.add(vid);
      const title = rir.headline?.simpleText || 'YouTube Video';
      results.push({
        id: `yt_${vid}`,
        platform: 'youtube',
        videoId: vid,
        title: decodeEntities(title),
        creatorName: 'YouTube Creator',
        originalVideoUrl: `https://www.youtube.com/watch?v=${vid}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${vid}?enablejsapi=1`,
        thumbnailUrl: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
        publishedAt: 'Recent',
        duration: '',
        playbackAvailability: 'playable_embed',
        aspectRatio: '9:16',
        category: 'trending',
        description: '',
      });
    }
  }

  // 4. YouTube Community Post Renderer (with Image attachments)
  if (obj.backstagePostRenderer || obj.postRenderer) {
    const pr = obj.backstagePostRenderer || obj.postRenderer;
    const postId = pr.postId;
    if (postId && !seen.has(postId)) {
      seen.add(postId);
      const authorName = pr.authorText?.runs?.[0]?.text || 'YouTube Creator';
      const content = pr.contentText?.runs?.map((r: any) => r.text).join('') || '';
      const authorThumb = pr.authorThumbnail?.thumbnails?.slice(-1)[0]?.url || '';
      const imageThumb =
        pr.backstageAttachment?.backstageImageRenderer?.image?.thumbnails?.slice(-1)[0]?.url ||
        pr.backstageAttachment?.postMultiImageRenderer?.images?.[0]?.backstageImageRenderer?.image?.thumbnails?.slice(-1)[0]?.url ||
        '';

      results.push({
        id: `yt_comm_${postId}`,
        platform: 'youtube',
        videoId: '',
        title: decodeEntities(content.slice(0, 80)) || 'YouTube Community Post',
        creatorName: decodeEntities(authorName),
        originalVideoUrl: `https://www.youtube.com/post/${postId}`,
        thumbnailUrl: imageThumb || authorThumb,
        publishedAt: pr.publishedTimeText?.runs?.[0]?.text || 'Recent',
        duration: '',
        playbackAvailability: 'restricted_open_original',
        aspectRatio: '16:9',
        category: 'culture',
        description: decodeEntities(content),
        isCommunityPost: true,
        communityImageUrl: imageThumb,
      });
    }
  }

  for (const key of Object.keys(obj)) {
    extractVideoRenderers(obj[key], results, seen);
  }
  return results;
}

function findContinuationToken(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.continuationCommand?.token) {
    return obj.continuationCommand.token;
  }
  for (const k of Object.keys(obj)) {
    const t = findContinuationToken(obj[k]);
    if (t) return t;
  }
  return null;
}

// Backend fallback search proxy for when Google Data API v3 daily quota (10,000 units) is exceeded
app.get('/api/youtube/search', async (req: Request, res: Response) => {
  const query = (req.query.q as string) || 'Bangladesh trending viral videos 2026';
  const pageToken = (req.query.pageToken as string) || '';

  try {
    // If a continuation token is provided, query YouTube continuation API
    if (pageToken && !pageToken.startsWith('page_token_')) {
      const contRes = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240101.00.00',
              hl: 'bn',
              gl: 'BD',
            },
          },
          continuation: pageToken,
        }),
      });

      if (contRes.ok) {
        const contData = await contRes.json();
        const vids = extractVideoRenderers(contData);
        const nextContToken = findContinuationToken(contData);

        return res.json({
          videos: vids,
          nextPageToken: nextContToken || undefined,
          fromLiveFallback: true,
        });
      }
    }

    // Initial search or fresh query
    const targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const ytRes = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'bn-BD,bn;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!ytRes.ok) {
      return res.status(ytRes.status).json({ error: 'Failed to fetch YouTube content' });
    }

    const html = await ytRes.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);

    if (match) {
      const data = JSON.parse(match[1]);
      const vids = extractVideoRenderers(data);
      const nextToken = findContinuationToken(data);

      return res.json({
        videos: vids,
        nextPageToken: nextToken || undefined,
        fromLiveFallback: true,
      });
    }

    return res.json({ videos: [], nextPageToken: undefined });
  } catch (err: any) {
    console.error('YouTube search fallback error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// --- MOTHERLAND REST API & Real Database Endpoints ---

// 1. Google OAuth Verification & Channel Link
app.post('/api/auth/google', async (req: Request, res: Response) => {
  const { accessToken, clientUserData } = req.body;

  if (!accessToken && !clientUserData) {
    return res.status(400).json({ error: 'Missing access token or user credentials' });
  }

  try {
    let googleId = clientUserData?.googleId || `goog_${Date.now()}`;
    let email = clientUserData?.email || 'user@gmail.com';
    let name = clientUserData?.name || 'Google User';
    let avatar = clientUserData?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80';
    let channelData = clientUserData?.connectedYouTubeChannel || null;

    // Verify token with Google's official userinfo endpoint if token provided
    if (accessToken) {
      try {
        const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (uRes.ok) {
          const uInfo = await uRes.json();
          googleId = uInfo.sub || googleId;
          email = uInfo.email || email;
          name = uInfo.name || name;
          avatar = uInfo.picture || avatar;
        }

        // Query authentic YouTube channel details
        const chRes = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true',
          {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          }
        );

        if (chRes.ok) {
          const chJson = await chRes.json();
          if (chJson.items && chJson.items.length > 0) {
            const ch = chJson.items[0];
            const stats = ch.statistics || {};
            const snippet = ch.snippet || {};

            channelData = {
              channelId: ch.id,
              channelTitle: snippet.title || name,
              channelHandle: snippet.customUrl || `@${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
              avatarUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || avatar,
              subscriberCount: stats.hiddenSubscriberCount ? 'Hidden by creator' : (stats.subscriberCount ? Number(stats.subscriberCount).toLocaleString() : '0'),
              videoCount: stats.videoCount ? Number(stats.videoCount).toLocaleString() : '0',
              viewCount: stats.viewCount ? Number(stats.viewCount).toLocaleString() : '0',
              description: snippet.description || '',
            };
          }
        }
      } catch (err) {
        console.warn('[AUTH] Google verification network warning, falling back to client claims:', err);
      }
    }

    const user = dbManager.upsertGoogleUser({
      googleId,
      email,
      name,
      avatar,
      connectedYouTubeChannel: channelData,
    });

    return res.json({ success: true, user });
  } catch (err: any) {
    console.error('[AUTH] Google auth failed:', err);
    return res.status(500).json({ error: err.message || 'Authentication error' });
  }
});

// 2. Disconnect YouTube without deleting user account
app.post('/api/auth/disconnect-youtube', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const updated = dbManager.disconnectYouTube(userId);
  return res.json({ success: true, user: updated });
});

// 3. Get Current User Profile
app.get('/api/auth/me', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || 'usr_motherland_citizen';
  const user = dbManager.getUser(userId);
  return res.json({ user });
});

// 4. Get Posts (with real reaction counts, ZERO fake numbers)
app.get('/api/posts', (req: Request, res: Response) => {
  const platform = req.query.platform as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

  const result = dbManager.getPosts({ platform, limit, offset });
  return res.json(result);
});

// 5. Create New Post
app.post('/api/posts', (req: Request, res: Response) => {
  const { authorId, author, content, media, privacy, platform, location, tags, youtubeVideoId, originalVideoUrl } = req.body;

  if (!content && (!media || media.length === 0)) {
    return res.status(400).json({ error: 'Post must contain text content or media' });
  }

  const newPost = dbManager.createPost({
    authorId: authorId || author?.id || 'usr_motherland_citizen',
    author: author || {
      id: authorId || 'usr_motherland_citizen',
      name: 'Kefat Hossain',
      handle: '@kefat',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      isVerified: true,
      platform: 'motherland',
    },
    content: content || '',
    media: media || [],
    createdAt: 'Just now',
    privacy: privacy || 'public',
    location,
    tags,
    platform: platform || 'motherland',
    youtubeVideoId,
    originalVideoUrl,
  });

  return res.json({ success: true, post: newPost });
});

// 6. Delete Post
app.delete('/api/posts/:id', (req: Request, res: Response) => {
  const postId = req.params.id;
  const userId = (req.body.userId || req.query.userId) as string;

  if (!userId) return res.status(401).json({ error: 'User unauthorized' });
  const success = dbManager.deletePost(postId, userId);
  return res.json({ success });
});

// 7. Real Reaction / Like (Prevents duplicates, strictly calculates true count)
app.post('/api/posts/:id/react', (req: Request, res: Response) => {
  const postId = req.params.id;
  const { userId, reaction } = req.body;

  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const updatedPost = dbManager.reactPost(postId, userId, reaction || null);

  if (!updatedPost) return res.status(404).json({ error: 'Post not found' });
  return res.json({ success: true, post: updatedPost });
});

// 8. Track Real Native Share
app.post('/api/posts/:id/share', (req: Request, res: Response) => {
  const postId = req.params.id;
  const updated = dbManager.trackShare(postId);
  if (!updated) return res.status(404).json({ error: 'Post not found' });
  return res.json({ success: true, post: updated });
});

// 9. Comments: Get Saved Comments & Replies
app.get('/api/posts/:id/comments', (req: Request, res: Response) => {
  const postId = req.params.id;
  const comments = dbManager.getComments(postId);
  return res.json({ comments });
});

// 10. Comments: Add Comment
app.post('/api/posts/:id/comments', (req: Request, res: Response) => {
  const postId = req.params.id;
  const { author, text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text cannot be empty' });
  }

  const comment = dbManager.addComment(postId, author, text);
  if (!comment) return res.status(404).json({ error: 'Post not found' });
  return res.json({ success: true, comment });
});

// 11. Comments: Add Reply
app.post('/api/posts/:id/comments/:commentId/reply', (req: Request, res: Response) => {
  const { id: postId, commentId } = req.params;
  const { author, text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Reply text cannot be empty' });
  }

  const reply = dbManager.addReply(postId, commentId, author, text);
  if (!reply) return res.status(404).json({ error: 'Comment not found' });
  return res.json({ success: true, reply });
});

// 12. Comments: Toggle Like on Comment or Reply
app.post('/api/posts/:id/comments/:commentId/like', (req: Request, res: Response) => {
  const { id: postId, commentId } = req.params;
  const { replyId, userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const success = dbManager.toggleCommentLike(postId, commentId, replyId, userId);
  return res.json({ success });
});

// 13. Comments: Delete Comment or Reply
app.delete('/api/posts/:id/comments/:commentId', (req: Request, res: Response) => {
  const { id: postId, commentId } = req.params;
  const { replyId, userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  const success = dbManager.deleteComment(postId, commentId, replyId, userId);
  return res.json({ success });
});

// 14. Follow / Unfollow Real User Relationship
app.post('/api/users/:id/follow', (req: Request, res: Response) => {
  const targetUserId = req.params.id;
  const { followerId } = req.body;

  if (!followerId) return res.status(400).json({ error: 'Missing followerId' });
  const result = dbManager.toggleFollow(followerId, targetUserId);
  return res.json({ success: true, ...result });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'MOTHERLAND Super App' });
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MOTHERLAND] Unified Full-Stack Server running on port ${PORT} (dev: ${isDev})`);
  });
}

startServer();
