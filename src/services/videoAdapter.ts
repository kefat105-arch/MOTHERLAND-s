/**
 * Universal Video Adapter — Motherland Super App
 * Coordinates multi-platform video curation, search, URL imports,
 * and unified continuous feeds.
 */

import { PlatformConfig, PlatformType, UnifiedVideo } from '../types/video';
import { VERIFIED_YOUTUBE_VIDEOS, resolveYouTubeUrl } from './youtubeService';
import { VERIFIED_TIKTOK_VIDEOS, resolveTikTokUrl } from './tiktokService';
import { VERIFIED_INSTAGRAM_VIDEOS, resolveInstagramUrl } from './instagramService';
import { VERIFIED_FACEBOOK_VIDEOS, resolveFacebookUrl } from './facebookService';

export const PLATFORM_CONFIGS: Record<PlatformType | 'all', PlatformConfig> = {
  all: {
    id: 'all',
    name: 'All Videos',
    shortName: 'All',
    iconName: 'Sparkles',
    brandColor: '#10B981', // Motherland Emerald
    glowClass: 'glow-motherland',
    badgeBg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    badgeText: 'Motherland Mixed',
    description: 'Unified cross-platform stream combining actual public videos from YouTube, TikTok, Instagram, and Facebook.',
    embedTechnology: 'Multi-Engine Native Embed',
    apiStatus: 'OPERATIONAL',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    shortName: 'YouTube',
    iconName: 'Youtube',
    brandColor: '#FF0000',
    glowClass: 'glow-youtube',
    badgeBg: 'bg-red-500/20 text-red-400 border border-red-500/30',
    badgeText: 'YouTube Data v3 + IFrame',
    description: 'Official YouTube Data API v3 search with IFrame Player API embedding and oEmbed metadata.',
    embedTechnology: 'YouTube IFrame Player API',
    apiStatus: 'OPERATIONAL',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    shortName: 'TikTok',
    iconName: 'Video',
    brandColor: '#00F2FE',
    glowClass: 'glow-tiktok',
    badgeBg: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    badgeText: 'TikTok Player v1',
    description: 'Official TikTok Player v1 iframe player for public videos with original sound & creator link.',
    embedTechnology: 'TikTok Player v1 Embed',
    apiStatus: 'IFRAME_EMBED_ONLY',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    shortName: 'Reels',
    iconName: 'Instagram',
    brandColor: '#E1306C',
    glowClass: 'glow-instagram',
    badgeBg: 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
    badgeText: 'Meta Reels Embed',
    description: 'Official Meta Instagram embed container for public Reels and video posts.',
    embedTechnology: 'Meta Instagram Embed Frame',
    apiStatus: 'IFRAME_EMBED_ONLY',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    shortName: 'Facebook',
    iconName: 'Facebook',
    brandColor: '#1877F2',
    glowClass: 'glow-facebook',
    badgeBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    badgeText: 'Meta Video Plugin',
    description: 'Official Meta Embedded Video Player plugin for public Facebook videos and watch streams.',
    embedTechnology: 'Facebook Embedded Player Plugin',
    apiStatus: 'IFRAME_EMBED_ONLY',
  },
};

const USER_IMPORTED_STORAGE_KEY = 'motherland_user_imported_videos';

/**
 * Gets user-imported videos from localStorage
 */
export function getUserImportedVideos(): UnifiedVideo[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_IMPORTED_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed reading user imported videos:', e);
    return [];
  }
}

/**
 * Saves a user-imported video
 */
export function saveUserImportedVideo(video: UnifiedVideo): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getUserImportedVideos();
    // Prepend if not already existing
    const exists = current.some((v) => v.id === video.id || v.originalVideoUrl === video.originalVideoUrl);
    if (!exists) {
      const updated = [video, ...current];
      localStorage.setItem(USER_IMPORTED_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed saving imported video:', e);
  }
}

/**
 * Imports any URL across YouTube, TikTok, Instagram, or Facebook
 */
export async function importVideoFromUrl(url: string): Promise<UnifiedVideo> {
  const trimmed = url.trim();

  if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
    const resolved = await resolveYouTubeUrl(trimmed);
    if (resolved) {
      saveUserImportedVideo(resolved);
      return resolved;
    }
    throw new Error('Could not parse YouTube video ID from the provided URL.');
  }

  if (trimmed.includes('tiktok.com')) {
    const resolved = await resolveTikTokUrl(trimmed);
    if (resolved) {
      saveUserImportedVideo(resolved);
      return resolved;
    }
    throw new Error('Could not parse TikTok video from the provided URL.');
  }

  if (trimmed.includes('instagram.com')) {
    const resolved = resolveInstagramUrl(trimmed);
    saveUserImportedVideo(resolved);
    return resolved;
  }

  if (trimmed.includes('facebook.com') || trimmed.includes('fb.watch')) {
    const resolved = resolveFacebookUrl(trimmed);
    saveUserImportedVideo(resolved);
    return resolved;
  }

  throw new Error('Unrecognized video URL. Please provide a valid YouTube, TikTok, Instagram Reel, or Facebook video link.');
}

/**
 * Returns merged catalog of all supported video sources
 */
export function getUnifiedVideoFeed(
  platformFilter: PlatformType | 'all' = 'all',
  categoryFilter?: string,
  searchQuery?: string
): UnifiedVideo[] {
  const userImports = getUserImportedVideos();

  // Combine standard verified streams with user imports
  let allVideos: UnifiedVideo[] = [
    ...userImports,
    ...VERIFIED_YOUTUBE_VIDEOS,
    ...VERIFIED_TIKTOK_VIDEOS,
    ...VERIFIED_INSTAGRAM_VIDEOS,
    ...VERIFIED_FACEBOOK_VIDEOS,
  ];

  // De-duplicate by ID
  const seenIds = new Set<string>();
  allVideos = allVideos.filter((v) => {
    if (seenIds.has(v.id)) return false;
    seenIds.add(v.id);
    return true;
  });

  // Filter by platform
  if (platformFilter !== 'all') {
    allVideos = allVideos.filter((v) => v.platform === platformFilter);
  }

  // Filter by category
  if (categoryFilter && categoryFilter !== 'all') {
    allVideos = allVideos.filter((v) => v.category === categoryFilter);
  }

  // Filter by search query
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    allVideos = allVideos.filter((v) => {
      const matchTitle = v.title.toLowerCase().includes(q);
      const matchCreator = v.creatorName.toLowerCase().includes(q);
      const matchHandle = v.creatorHandle?.toLowerCase().includes(q);
      const matchTag = v.tags?.some((t) => t.toLowerCase().includes(q));
      const matchDesc = v.description?.toLowerCase().includes(q);
      return matchTitle || matchCreator || matchHandle || matchTag || matchDesc;
    });
  }

  return allVideos;
}
