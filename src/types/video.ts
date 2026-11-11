/**
 * Universal Video Super App — Type Definitions
 * Motherland Unified Video Platform
 */

export type PlatformType = 'youtube' | 'tiktok' | 'instagram' | 'facebook';

export type PlaybackAvailability = 
  | 'playable_embed'              // Officially embeddable and playable
  | 'restricted_open_original'    // Embed blocked or restricted by platform/creator
  | 'permission_required';        // Requires user login/token on source platform

export interface UnifiedVideo {
  id: string;                          // Unique universal ID: e.g. yt_xxxx, tt_xxxx
  platform: PlatformType;              // Source platform
  videoId: string;                     // Platform native ID or code
  title: string;                       // Clean title
  creatorName: string;                 // Channel / Creator name
  creatorHandle?: string;              // @handle
  creatorAvatar?: string;              // Creator profile photo
  originalVideoUrl: string;            // Direct canonical link on original platform
  embedUrl: string;                    // Official player embed URL
  thumbnailUrl: string;                // Real video thumbnail
  duration?: string;                   // Video duration (e.g. "3:45", "0:59")
  publishedAt?: string;                // Date/time published
  playbackAvailability: PlaybackAvailability;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  category?: 'bangladesh' | 'trending' | 'music' | 'gaming' | 'tech' | 'culture' | 'news';
  tags?: string[];
  description?: string;
  sourceMetadata?: {
    isOfficialEmbed: boolean;
    license?: string;
    regionRestriction?: string;
    oEmbedResolved?: boolean;
    [key: string]: unknown;
  };
}

export interface PlatformConfig {
  id: PlatformType | 'all';
  name: string;
  shortName: string;
  iconName: string;
  brandColor: string;
  glowClass: string;
  badgeBg: string;
  badgeText: string;
  description: string;
  embedTechnology: string;
  apiStatus: 'OPERATIONAL' | 'RESTRICTED_KEY' | 'PUBLIC_OEMBED_ONLY' | 'IFRAME_EMBED_ONLY';
}
