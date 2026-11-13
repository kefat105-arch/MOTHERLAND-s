export type SocialPlatformId = 'youtube' | 'facebook' | 'tiktok' | 'instagram';

export interface CuratedSocialItem {
  id: string;
  title: string;
  author: string;
  embedUrl?: string;
  webUrl: string;
  thumbnail?: string;
  category?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
}

export interface SocialPlatformInfo {
  id: SocialPlatformId;
  name: string;
  tagline: string;
  brandColor: string;
  badgeText: string;
  websiteUrl: string;
  mobileUrl: string;
  embedType: 'iframe_player' | 'official_embed' | 'page_plugin';
  description: string;
  urlHint: string;
  supportedInPWA: string[];
  restrictedInPWA: string[];
  curatedItems: CuratedSocialItem[];
}
