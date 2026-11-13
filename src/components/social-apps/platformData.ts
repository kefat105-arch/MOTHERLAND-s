import type { SocialPlatformId, SocialPlatformInfo } from './types';

export const SOCIAL_PLATFORMS: Record<SocialPlatformId, SocialPlatformInfo> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    tagline: 'Official YouTube Search, Player & Comments',
    brandColor: '#FF0000',
    badgeText: 'YouTube API + IFrame',
    websiteUrl: 'https://www.youtube.com',
    mobileUrl: 'https://m.youtube.com',
    embedType: 'iframe_player',
    description:
      'Search YouTube videos directly inside MOTHERLAND, play videos using the official YouTube IFrame Player, inspect real YouTube comments, or paste any YouTube URL.',
    urlHint: 'Paste any youtube.com/watch?v=..., youtu.be/..., or /shorts/... link',
    supportedInPWA: [
      'Real YouTube Data API search & channel results inside MOTHERLAND',
      'Official youtube-nocookie.com IFrame video playback',
      'Real YouTube comment threads via Data API v3',
      'Paste any public YouTube video or Shorts URL to play in-app',
    ],
    restrictedInPWA: [
      'Full youtube.com site framing is blocked by Google X-Frame-Options',
      'Google account sign-in cannot run inside an embedded frame',
    ],
    curatedItems: [
      {
        id: '9No-FiEInLA',
        title: 'Nature & Aerial Horizon 4K Showcase',
        author: 'Featured Showcase',
        embedUrl: 'https://www.youtube-nocookie.com/embed/9No-FiEInLA?rel=0&playsinline=1',
        webUrl: 'https://www.youtube.com/watch?v=9No-FiEInLA',
        thumbnail: 'https://i.ytimg.com/vi/9No-FiEInLA/hqdefault.jpg',
        category: 'Travel 4K',
        aspectRatio: '16:9',
      },
      {
        id: 'LXb3EKWsInQ',
        title: 'COSTA RICA IN 4K 60fps HDR (Ultra HD)',
        author: 'Jacob + Katie Schwarz',
        embedUrl: 'https://www.youtube-nocookie.com/embed/LXb3EKWsInQ?rel=0&playsinline=1',
        webUrl: 'https://www.youtube.com/watch?v=LXb3EKWsInQ',
        thumbnail: 'https://i.ytimg.com/vi/LXb3EKWsInQ/hqdefault.jpg',
        category: 'Nature HDR',
        aspectRatio: '16:9',
      },
      {
        id: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up (Official 4K)',
        author: 'Rick Astley',
        embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1',
        webUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        category: 'Music',
        aspectRatio: '16:9',
      },
      {
        id: 'tgbNymZ7vqY',
        title: 'Bohemian Rhapsody | Muppet Music Video',
        author: 'The Muppets',
        embedUrl: 'https://www.youtube-nocookie.com/embed/tgbNymZ7vqY?rel=0&playsinline=1',
        webUrl: 'https://www.youtube.com/watch?v=tgbNymZ7vqY',
        thumbnail: 'https://i.ytimg.com/vi/tgbNymZ7vqY/hqdefault.jpg',
        category: 'Classic',
        aspectRatio: '16:9',
      },
    ],
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    tagline: 'Official Meta Video & Page Embeds',
    brandColor: '#1877F2',
    badgeText: 'Official Meta Plugin',
    websiteUrl: 'https://www.facebook.com',
    mobileUrl: 'https://m.facebook.com/watch',
    embedType: 'page_plugin',
    description:
      'Load public Facebook videos, posts, and community pages via Meta’s official Page & Video Plugins, or launch Facebook Watch directly in your browser.',
    urlHint: 'Paste a public facebook.com/.../videos/... or post URL',
    supportedInPWA: [
      'Official Facebook Video Plugin & Page Plugin embeds for public content',
      'Paste any public Facebook video or page post URL to render in-app',
      'One-tap external launch to Facebook Watch or native app',
    ],
    restrictedInPWA: [
      'Private Facebook Home feed and Messenger cannot be framed (X-Frame-Options: DENY)',
      'Account login and cookie capture are strictly blocked by Meta security headers',
    ],
    curatedItems: [
      {
        id: 'fb-official-video',
        title: 'Meta Public Engineering Video Showcase',
        author: 'Facebook Official Page',
        embedUrl:
          'https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Ffacebook%2Fvideos%2F10153231379946729%2F&show_text=0&width=560',
        webUrl: 'https://www.facebook.com/facebook/videos/10153231379946729/',
        category: 'Public Video Plugin',
        aspectRatio: '16:9',
      },
      {
        id: 'fb-official-page',
        title: 'Facebook Public Page Timeline Embed',
        author: 'Facebook',
        embedUrl:
          'https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Ffacebook&tabs=timeline&width=500&height=460&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false',
        webUrl: 'https://www.facebook.com/facebook',
        category: 'Page Timeline Plugin',
        aspectRatio: '16:9',
      },
    ],
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    tagline: 'Official TikTok Video Embeds & Portal',
    brandColor: '#00D2E6',
    badgeText: 'Official TikTok Embed',
    websiteUrl: 'https://www.tiktok.com',
    mobileUrl: 'https://www.tiktok.com',
    embedType: 'official_embed',
    description:
      'Play any public TikTok video inside MOTHERLAND using TikTok’s official v2 embed player by pasting its video link, or jump straight to TikTok discovery.',
    urlHint: 'Paste any tiktok.com/@username/video/1234567890123456789 link',
    supportedInPWA: [
      'Official tiktok.com/embed/v2/{videoId} player when a valid public TikTok video URL is provided',
      'Direct creator/discover links without storing passwords',
    ],
    restrictedInPWA: [
      'Full TikTok For You feed and login sessions are blocked inside iframes by ByteDance CSP/X-Frame headers',
      'No unauthenticated scraping API exists for TikTok’s main feed',
    ],
    curatedItems: [
      {
        id: 'tiktok-portal',
        title: 'Paste a public TikTok video URL above to play via Official Embed',
        author: 'TikTok Official Player',
        webUrl: 'https://www.tiktok.com/explore',
        category: 'URL Embed Resolver',
        aspectRatio: '9:16',
      },
    ],
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    tagline: 'Official Public Post & Reel Embeds',
    brandColor: '#E1306C',
    badgeText: 'Official Meta Embed',
    websiteUrl: 'https://www.instagram.com',
    mobileUrl: 'https://www.instagram.com/reels',
    embedType: 'official_embed',
    description:
      'Render public Instagram posts and Reels via Meta’s official embed endpoint by pasting any public /p/ or /reel/ link, or open Instagram in your browser.',
    urlHint: 'Paste any instagram.com/p/SHORTCODE/ or /reel/SHORTCODE/ link',
    supportedInPWA: [
      'Official instagram.com/p|reel/{shortcode}/embed/captioned/ viewer for public links',
      'Explore Reels and creators cleanly with explicit external launch',
    ],
    restrictedInPWA: [
      'Full Instagram Home feed, Stories, and DMs are blocked from third-party framing by Meta X-Frame-Options',
      'Instagram login cannot be embedded safely inside a web iframe',
    ],
    curatedItems: [
      {
        id: 'instagram-portal',
        title: 'Paste a public Instagram /p/ or /reel/ URL above to load Official Embed',
        author: 'Instagram Official Embed',
        webUrl: 'https://www.instagram.com/reels/',
        category: 'URL Embed Resolver',
        aspectRatio: '9:16',
      },
    ],
  },
};

export interface ResolvedSocialUrl {
  platform: SocialPlatformId;
  embedUrl?: string;
  youtubeId?: string;
  webUrl: string;
  label: string;
}

export function resolveSocialUrl(rawInput: string): ResolvedSocialUrl | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();

    // YouTube
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      const ytMatch = normalized.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?.*v=|shorts\/|live\/))([\w-]{11})/
      );
      if (ytMatch?.[1]) {
        return {
          platform: 'youtube',
          youtubeId: ytMatch[1],
          embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0&playsinline=1`,
          webUrl: `https://www.youtube.com/watch?v=${ytMatch[1]}`,
          label: `YouTube Video (${ytMatch[1]})`,
        };
      }
      return {
        platform: 'youtube',
        webUrl: normalized,
        label: 'YouTube Link',
      };
    }

    // TikTok
    if (host.includes('tiktok.com')) {
      const ttMatch = parsed.pathname.match(/\/video\/(\d+)/);
      if (ttMatch?.[1]) {
        return {
          platform: 'tiktok',
          embedUrl: `https://www.tiktok.com/embed/v2/${ttMatch[1]}`,
          webUrl: normalized,
          label: `TikTok Video #${ttMatch[1]}`,
        };
      }
      return {
        platform: 'tiktok',
        webUrl: normalized,
        label: 'TikTok Portal',
      };
    }

    // Instagram
    if (host.includes('instagram.com')) {
      const igMatch = parsed.pathname.match(/\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
      if (igMatch?.[1] && igMatch?.[2]) {
        return {
          platform: 'instagram',
          embedUrl: `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/embed/captioned/`,
          webUrl: normalized,
          label: `Instagram ${igMatch[1] === 'reel' ? 'Reel' : 'Post'} (${igMatch[2]})`,
        };
      }
      return {
        platform: 'instagram',
        webUrl: normalized,
        label: 'Instagram Portal',
      };
    }

    // Facebook
    if (host.includes('facebook.com') || host.includes('fb.watch')) {
      const isVideo = parsed.pathname.includes('/videos/') || parsed.pathname.includes('/reel/') || host.includes('fb.watch');
      const pluginType = isVideo ? 'video.php' : 'post.php';
      return {
        platform: 'facebook',
        embedUrl: `https://www.facebook.com/plugins/${pluginType}?href=${encodeURIComponent(normalized)}&show_text=true&width=560`,
        webUrl: normalized,
        label: isVideo ? 'Facebook Video Embed' : 'Facebook Post Embed',
      };
    }
  } catch {
    return null;
  }

  return null;
}
