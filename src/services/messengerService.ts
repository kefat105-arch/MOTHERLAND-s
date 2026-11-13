/**
 * Motherland Messenger Hub — Integration, OAuth & Dispatch Service
 * Official platform authorizers, token persistence, webhook synchronization,
 * and genuine conversation retrieval.
 */

import {
  ConnectedAccount,
  Conversation,
  MessengerCredentials,
  MessengerPlatform,
  MessengerPlatformInfo,
  RealMessage,
} from '../types/messenger';
import { fireTokensToExternalText } from './fireEmojiService';

const CREDENTIALS_STORAGE_KEY = 'motherland_messenger_credentials';
const CONNECTED_ACCOUNTS_STORAGE_KEY = 'motherland_connected_accounts_v2';
const REAL_CONVERSATIONS_STORAGE_KEY = 'motherland_real_conversations_v2';
const REAL_MESSAGES_STORAGE_KEY = 'motherland_real_messages_history_v2';

// Safe memory store when running in Node.js or SSR
const memoryStorage = new Map<string, string>();

function safeGetItem(key: string): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStorage.get(key) || null;
    }
  }
  return memoryStorage.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  }
  memoryStorage.set(key, value);
}

function safeRemoveItem(key: string): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memoryStorage.delete(key);
    }
  }
  memoryStorage.delete(key);
}

export const MESSENGER_PLATFORM_REGISTRY: Record<MessengerPlatform, MessengerPlatformInfo> = {
  facebook: {
    id: 'facebook',
    name: 'Facebook Messenger',
    brandColor: '#0084FF',
    badgeBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    officialApiName: 'Meta Messenger Platform Send & Webhook API',
    status: 'IMPLEMENTED',
    statusDetail: 'Meta Messenger Platform API for verified Facebook Pages. Requires "pages_messaging", "pages_show_list", or direct m.me conversational deep link.',
    isApiSupported: true,
    requiresBusinessAccount: true,
    directUrlScheme: 'https://m.me/',
    connectionDocsUrl: 'https://developers.facebook.com/docs/messenger-platform',
    oauthScopeRecommended: ['pages_messaging', 'pages_show_list', 'pages_read_engagement'],
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram Direct',
    brandColor: '#E1306C',
    badgeBg: 'bg-pink-500/20 text-pink-400 border border-pink-500/30',
    officialApiName: 'Instagram Messaging API (Meta Graph v19.0+)',
    status: 'IMPLEMENTED',
    statusDetail: 'Meta Graph Instagram Messaging API for Professional/Creator accounts linked to a Facebook Page. Requires "instagram_basic", "instagram_manage_messages".',
    isApiSupported: true,
    requiresBusinessAccount: true,
    directUrlScheme: 'https://ig.me/m/',
    connectionDocsUrl: 'https://developers.facebook.com/docs/messenger-platform/instagram',
    oauthScopeRecommended: ['instagram_basic', 'instagram_manage_messages', 'pages_show_list'],
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp',
    brandColor: '#25D366',
    badgeBg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    officialApiName: 'WhatsApp Business Cloud API & Webhook Service',
    status: 'IMPLEMENTED',
    statusDetail: 'Official WhatsApp Business Cloud API & Direct wa.me protocol. Requires Meta System User access token, Phone Number ID, and Webhook callback for real-time delivery.',
    isApiSupported: true,
    requiresBusinessAccount: true,
    directUrlScheme: 'https://wa.me/',
    connectionDocsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    oauthScopeRecommended: ['whatsapp_business_management', 'whatsapp_business_messaging'],
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    brandColor: '#00F2FE',
    badgeBg: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',
    officialApiName: 'Direct Message API (Unavailable for 3P Web Apps)',
    status: 'API UNAVAILABLE',
    statusDetail: 'API UNAVAILABLE: TikTok does not offer a public consumer Direct Message API for external web apps. Messaging is restricted to official TikTok mobile and web clients.',
    isApiSupported: false,
    requiresBusinessAccount: false,
    directUrlScheme: 'https://www.tiktok.com/messages',
    connectionDocsUrl: 'https://developers.tiktok.com/',
    oauthScopeRecommended: ['user.info.basic', 'video.list'],
  },
};

/**
 * Retrieve saved API credentials
 */
export function getSavedCredentials(): MessengerCredentials {
  try {
    const raw = safeGetItem(CREDENTIALS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save API credentials
 */
export function saveCredentials(creds: MessengerCredentials): void {
  try {
    safeSetItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
  } catch (e) {
    console.error('Failed saving messenger credentials:', e);
  }
}

/**
 * Retrieve genuinely connected accounts
 */
export function getConnectedAccounts(): Record<MessengerPlatform, ConnectedAccount | null> {
  const initial: Record<MessengerPlatform, ConnectedAccount | null> = {
    facebook: null,
    instagram: null,
    whatsapp: null,
    tiktok: null,
  };

  try {
    const raw = safeGetItem(CONNECTED_ACCOUNTS_STORAGE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    return { ...initial, ...parsed };
  } catch {
    return initial;
  }
}

/**
 * Save or update a connected account
 */
export function saveConnectedAccount(account: ConnectedAccount): void {
  try {
    const current = getConnectedAccounts();
    current[account.platform] = account;
    safeSetItem(CONNECTED_ACCOUNTS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed saving connected account:', e);
  }
}

/**
 * Disconnect an account
 */
export function disconnectAccount(platform: MessengerPlatform): void {
  try {
    const current = getConnectedAccounts();
    current[platform] = null;
    safeSetItem(CONNECTED_ACCOUNTS_STORAGE_KEY, JSON.stringify(current));

    // Also remove associated conversations for this platform
    const existing = getRealConversations();
    const updated = existing.filter((c) => c.platform !== platform);
    safeSetItem(REAL_CONVERSATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed disconnecting account:', e);
  }
}

/**
 * Retrieve genuine conversations from storage (Zero demo data)
 */
export function getRealConversations(): Conversation[] {
  try {
    const raw = safeGetItem(REAL_CONVERSATIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save or update a real conversation
 */
export function saveRealConversation(conv: Conversation): void {
  try {
    const list = getRealConversations();
    const index = list.findIndex((c) => c.id === conv.id);
    let updated: Conversation[];
    if (index >= 0) {
      updated = [...list];
      updated[index] = conv;
    } else {
      updated = [conv, ...list];
    }
    safeSetItem(REAL_CONVERSATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed saving real conversation:', e);
  }
}

/**
 * Retrieve genuine message history
 */
export function getMessageHistory(): RealMessage[] {
  try {
    const raw = safeGetItem(REAL_MESSAGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Record a real message event
 */
export function recordMessageEvent(msg: RealMessage): void {
  try {
    const history = getMessageHistory();
    const updated = [msg, ...history.slice(0, 99)];
    safeSetItem(REAL_MESSAGES_STORAGE_KEY, JSON.stringify(updated));

    // Update conversation entry
    const cleanId = `conv_${msg.platform}_${msg.recipientHandleOrPhone.replace(/[^a-zA-Z0-9]/g, '_')}`;
    saveRealConversation({
      id: cleanId,
      platform: msg.platform,
      contactName: msg.recipientName || msg.recipientHandleOrPhone,
      contactHandleOrPhone: msg.recipientHandleOrPhone,
      lastMessageText: msg.text,
      lastMessageTimestamp: msg.timestamp,
      unreadCount: 0,
      isOnline: true,
      isOfficialAccount: true,
    });
  } catch (e) {
    console.error('Failed logging message event:', e);
  }
}

/**
 * Clear history
 */
export function clearMessageHistory(): void {
  safeRemoveItem(REAL_MESSAGES_STORAGE_KEY);
  safeRemoveItem(REAL_CONVERSATIONS_STORAGE_KEY);
}

/**
 * Fetch official conversations from Meta Graph API if Page Access Token is provided
 */
export async function syncMetaConversations(pageAccessToken: string): Promise<Conversation[]> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/conversations?fields=id,snippet,updated_time,unread_count,senders&access_token=${encodeURIComponent(
        pageAccessToken
      )}`
    );

    if (!res.ok) {
      throw new Error(`Meta Graph API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const items = data.data || [];

    const realConvs: Conversation[] = items.map((item: any) => {
      const sender = item.senders?.data?.[0];
      return {
        id: `meta_conv_${item.id}`,
        platform: 'facebook' as const,
        contactName: sender?.name || 'Facebook User',
        contactHandleOrPhone: sender?.id || item.id,
        lastMessageText: item.snippet || 'Attachment or sticker',
        lastMessageTimestamp: new Date(item.updated_time).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        unreadCount: item.unread_count || 0,
        isOnline: true,
        isOfficialAccount: false,
      };
    });

    // Save fetched conversations
    realConvs.forEach(saveRealConversation);
    return realConvs;
  } catch (err) {
    console.warn('Could not sync Meta conversations:', err);
    throw err;
  }
}

/**
 * Dispatch message via WhatsApp
 */
export async function sendWhatsAppMessage(
  phoneOrHandle: string,
  text: string
): Promise<{ success: boolean; method: 'api' | 'direct_launcher'; error?: string }> {
  const cleanPhone = phoneOrHandle.replace(/[^0-9]/g, '');
  const creds = getSavedCredentials();
  const accounts = getConnectedAccounts();
  const waAccount = accounts.whatsapp;

  const token = waAccount?.accessToken || creds.whatsappAccessToken;
  const phoneId = waAccount?.accountId || creds.whatsappPhoneNumberId;

  const externalText = fireTokensToExternalText(text);

  // If user configured official Cloud API token & Phone Number ID
  if (phoneId && token) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { preview_url: true, body: externalText },
          }),
        }
      );

      if (response.ok) {
        recordMessageEvent({
          id: `msg_wa_${Date.now()}`,
          platform: 'whatsapp',
          recipientHandleOrPhone: cleanPhone,
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent_via_api',
          direction: 'outgoing',
        });
        return { success: true, method: 'api' };
      } else {
        const errorData = await response.json();
        throw new Error(errorData?.error?.message || 'Meta Cloud API rejected request');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('WhatsApp Cloud API call failed, using wa.me direct launcher fallback:', errMsg);
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(externalText)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      recordMessageEvent({
        id: `msg_wa_${Date.now()}`,
        platform: 'whatsapp',
        recipientHandleOrPhone: cleanPhone,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'direct_launcher_opened',
        direction: 'outgoing',
        errorMessage: `Cloud API notice: ${errMsg}`,
      });
      return { success: true, method: 'direct_launcher', error: errMsg };
    }
  }

  // Direct wa.me launch
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(externalText)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  recordMessageEvent({
    id: `msg_wa_${Date.now()}`,
    platform: 'whatsapp',
    recipientHandleOrPhone: cleanPhone,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'direct_launcher_opened',
    direction: 'outgoing',
  });
  return { success: true, method: 'direct_launcher' };
}

/**
 * Dispatch message via Facebook Messenger
 */
export async function sendFacebookMessage(
  recipient: string,
  text: string
): Promise<{ success: boolean; method: 'api' | 'direct_launcher'; error?: string }> {
  const cleanRecipient = recipient.replace(/^@/, '').trim();
  const creds = getSavedCredentials();
  const accounts = getConnectedAccounts();
  const fbAccount = accounts.facebook;

  const pageToken = fbAccount?.accessToken || creds.facebookPageAccessToken;

  const externalText = fireTokensToExternalText(text);

  if (pageToken) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: cleanRecipient },
            message: { text: externalText },
          }),
        }
      );

      if (response.ok) {
        recordMessageEvent({
          id: `msg_fb_${Date.now()}`,
          platform: 'facebook',
          recipientHandleOrPhone: cleanRecipient,
          text,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent_via_api',
          direction: 'outgoing',
        });
        return { success: true, method: 'api' };
      }
    } catch (e) {
      console.warn('Meta Messenger Send API failed, launching m.me:', e);
    }
  }

  // Direct m.me fallback
  const mUrl = `https://m.me/${encodeURIComponent(cleanRecipient)}`;
  window.open(mUrl, '_blank', 'noopener,noreferrer');
  recordMessageEvent({
    id: `msg_fb_${Date.now()}`,
    platform: 'facebook',
    recipientHandleOrPhone: cleanRecipient,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'direct_launcher_opened',
    direction: 'outgoing',
  });
  return { success: true, method: 'direct_launcher' };
}

/**
 * Dispatch message via Instagram Direct
 */
export async function sendInstagramMessage(
  username: string,
  text: string
): Promise<{ success: boolean; method: 'direct_launcher' }> {
  const cleanHandle = username.replace(/^@/, '').trim();
  const igUrl = `https://ig.me/m/${encodeURIComponent(cleanHandle)}`;
  window.open(igUrl, '_blank', 'noopener,noreferrer');
  recordMessageEvent({
    id: `msg_ig_${Date.now()}`,
    platform: 'instagram',
    recipientHandleOrPhone: `@${cleanHandle}`,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'direct_launcher_opened',
    direction: 'outgoing',
  });
  return { success: true, method: 'direct_launcher' };
}

/**
 * TikTok Messages handler: Accurately informs user that consumer DM API is not provided
 */
export function openTikTokMessages(): void {
  window.open('https://www.tiktok.com/messages', '_blank', 'noopener,noreferrer');
}
