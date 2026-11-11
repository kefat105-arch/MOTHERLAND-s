/**
 * Motherland Messenger Hub — Type Definitions
 * Strict Official Messaging APIs, Authenticated Connections & Disclosures
 */

export type MessengerPlatform = 'facebook' | 'instagram' | 'whatsapp' | 'tiktok';

export type MessengerStatus = 
  | 'NOT CONNECTED'
  | 'CONNECTED'
  | 'PERMISSION REQUIRED'
  | 'API UNAVAILABLE'
  | 'IMPLEMENTED'
  | 'TESTED'
  | 'FAILED';

export interface ConnectedAccount {
  platform: MessengerPlatform;
  accountId: string; // e.g. Facebook Page ID, Instagram Business Account ID, WhatsApp Phone Number ID
  accountName: string; // Official display name from API or user
  profilePictureUrl?: string;
  connectedAt: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  scope?: string[];
  webhookActive?: boolean;
  webhookCallbackUrl?: string;
  accountType: 'business_page' | 'creator_professional' | 'cloud_api' | 'consumer_restricted';
}

export interface MessengerPlatformInfo {
  id: MessengerPlatform;
  name: string;
  brandColor: string;
  badgeBg: string;
  officialApiName: string;
  status: MessengerStatus;
  statusDetail: string;
  isApiSupported: boolean;
  requiresBusinessAccount: boolean;
  directUrlScheme: string; // e.g. "https://wa.me/"
  connectionDocsUrl: string;
  oauthScopeRecommended: string[];
}

export interface RealMessage {
  id: string;
  platform: MessengerPlatform;
  recipientHandleOrPhone: string;
  recipientName?: string;
  text: string;
  timestamp: string;
  status: 'sent_via_api' | 'direct_launcher_opened' | 'received' | 'failed';
  direction?: 'incoming' | 'outgoing';
  errorMessage?: string;
}

export interface MessengerCredentials {
  // WhatsApp Cloud API
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
  whatsappBusinessAccountId?: string;

  // Facebook Messenger (Meta Graph API)
  facebookPageId?: string;
  facebookPageAccessToken?: string;

  // Instagram Direct (Meta Graph API for Instagram)
  instagramAccountId?: string;
  instagramAccessToken?: string;

  // TikTok Client Credentials (if applied)
  tiktokClientKey?: string;
  tiktokClientSecret?: string;
}

export interface Conversation {
  id: string;
  platform: MessengerPlatform;
  contactName: string;
  contactHandleOrPhone: string;
  avatarUrl?: string;
  lastMessageText: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  isOnline: boolean;
  isOfficialAccount: boolean;
  connectedAccountId?: string;
}
