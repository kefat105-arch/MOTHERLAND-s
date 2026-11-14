import React, { useState, useEffect } from 'react';
import {
  User,
  Youtube,
  Sun,
  Moon,
  Bookmark,
  Bell,
  Users,
  Compass,
  SlidersHorizontal,
  Upload,
  LogOut,
  ChevronRight,
  Crown,
  CheckCircle2,
  Loader2,
  UserPlus,
  WifiOff,
  History,
} from 'lucide-react';
import { api } from '../api';
import type { UserProfile, YouTubeOAuthStatus } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { WaveLogo } from './wave/WaveLogo';

interface MenuViewProps {
  currentUser: UserProfile | null;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  unreadNotifications: number;
  unreadMessages: number;
  youtubeKeyConnected: boolean;
  onOpenProfile: () => void;
  onOpenFriends: () => void;
  onOpenSavedPosts: () => void;
  onOpenNotifications: () => void;
  onOpenMessages: () => void;
  onOpenYouTubePublish: () => void;
  onOpenSocialApps: () => void;
  onOpenPlatformHub: () => void;
  onOpenWatchHistory?: () => void;
  onUserUpdated?: (user: UserProfile) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export const MenuView: React.FC<MenuViewProps> = ({
  currentUser,
  theme,
  onToggleTheme,
  unreadNotifications,
  unreadMessages,
  youtubeKeyConnected,
  onOpenProfile,
  onOpenFriends,
  onOpenSavedPosts,
  onOpenNotifications,
  onOpenMessages,
  onOpenYouTubePublish,
  onOpenSocialApps,
  onOpenPlatformHub,
  onOpenWatchHistory,
  onUserUpdated,
  onOpenAuth,
  onLogout,
}) => {
  const [ytOAuth, setYtOAuth] = useState<YouTubeOAuthStatus | null>(null);
  const [isLoadingOAuth, setIsLoadingOAuth] = useState(true);
  const [oauthMessage, setOauthMessage] = useState('');

  const loadOAuthStatus = async () => {
    setIsLoadingOAuth(true);
    try {
      const status = await api.getYouTubeOAuthStatus();
      setYtOAuth(status);
    } catch {
      setYtOAuth(null);
    } finally {
      setIsLoadingOAuth(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      loadOAuthStatus();
    } else {
      setYtOAuth(null);
      setIsLoadingOAuth(false);
    }
  }, [currentUser?.id]);

  const handleDisconnectYouTube = async () => {
    try {
      await api.disconnectYouTubeOAuth();
      setOauthMessage('YouTube account disconnected.');
      await loadOAuthStatus();
    } catch (err: any) {
      setOauthMessage(err?.message || 'Could not disconnect YouTube account.');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-[var(--text-primary)]">Menu</h2>
        <div className="md:hidden">
          <PWAInstallButton />
        </div>
      </div>

      {/* 1. Profile Card or Guest Sign-In Card */}
      {currentUser ? (
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full text-left ml-glass rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-[var(--accent-primary-border)] transition-all"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.displayName}
              className="w-12 h-12 rounded-2xl object-cover border border-[var(--border-subtle)] flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-[var(--text-primary)] truncate">
                  {currentUser.displayName}
                </span>
                {currentUser.role === 'owner' && (
                  <Crown className="w-3.5 h-3.5 text-[var(--accent-gold)] flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                See your profile, posts, &amp; account details
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
        </button>
      ) : (
        <div className="ml-glass rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center text-[var(--accent-primary)] flex-shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-[var(--text-primary)]">Guest Mode</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Sign in to create posts, chat with friends, and sync your profile
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-bold whitespace-nowrap"
          >
            Sign In
          </button>
        </div>
      )}

      {/* 2. Theme Appearance Switch */}
      <div className="ml-glass rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center text-[var(--accent-gold)]">
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">Appearance Theme</p>
            <p className="text-xs text-[var(--text-secondary)]">
              {theme === 'dark' ? 'Deep Charcoal Glass (Dark)' : 'Frosted Daylight Glass (Light)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          data-testid="theme-toggle-btn"
          aria-label={theme === 'dark' ? 'Switch to Light theme' : 'Switch to Dark theme'}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[var(--accent-primary-soft)] hover:bg-[var(--accent-primary)] text-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] border border-[var(--accent-primary-border)] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          <span>{theme === 'dark' ? 'Light (সাদা)' : 'Dark (কালো)'}</span>
        </button>
      </div>

      {/* 2b. Data Saver Switch */}
      {currentUser && (
        <div className="ml-glass rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <WifiOff className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)]">Data Saver Mode</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {currentUser.dataSaver
                  ? 'Active — pauses background feed checks & video preloading'
                  : 'Off — automatic smart feed updates active'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await api.updatePreferences({ dataSaver: !currentUser.dataSaver });
                onUserUpdated?.(res.user);
              } catch {
                // ignore
              }
            }}
            className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer shrink-0 ${
              currentUser.dataSaver
                ? 'bg-[var(--accent-primary)] text-white border-transparent'
                : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
            }`}
          >
            {currentUser.dataSaver ? 'On' : 'Off'}
          </button>
        </div>
      )}

      {/* 3. Official YouTube Account Connection Card */}
      <div className="ml-glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF0000] flex items-center justify-center text-white">
              <Youtube className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                YouTube Account Connection
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Official OAuth 2.0 channel upload access
              </p>
            </div>
          </div>

          {isLoadingOAuth ? (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
          ) : ytOAuth?.connected ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent-primary)]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {ytOAuth?.oauthConfigured ? 'Not connected' : 'OAuth unconfigured'}
            </span>
          )}
        </div>

        {ytOAuth?.connected && ytOAuth.channel ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-2.5 min-w-0">
              {ytOAuth.channel.avatar && (
                <img
                  src={ytOAuth.channel.avatar}
                  alt={ytOAuth.channel.title}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {ytOAuth.channel.title}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {Number(ytOAuth.channel.subscriberCount || 0).toLocaleString()} subscribers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={onOpenYouTubePublish}
                className="min-h-[42px] px-3 py-1.5 rounded-xl bg-[#FF0000] hover:bg-red-700 text-white text-xs font-bold"
              >
                Upload
              </button>
              <button
                type="button"
                onClick={handleDisconnectYouTube}
                className="min-h-[42px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-[var(--text-secondary)]">
              {ytOAuth?.oauthConfigured
                ? 'Connect your Google channel to upload directly to YouTube from MOTHERLAND.'
                : 'OAuth client credentials can be configured on the server to enable direct channel uploads.'}
            </p>
            <button
              type="button"
              onClick={currentUser ? onOpenYouTubePublish : onOpenAuth}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FF0000] hover:bg-red-700 text-white text-xs font-bold whitespace-nowrap flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{currentUser ? (ytOAuth?.oauthConfigured ? 'Connect Channel' : 'View Setup') : 'Sign In'}</span>
            </button>
          </div>
        )}

        {oauthMessage && (
          <p className="text-[11px] text-[var(--accent-primary)] font-medium">{oauthMessage}</p>
        )}
      </div>

      {/* 4. Quick Shortcuts Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={currentUser ? onOpenSavedPosts : onOpenAuth}
          className="ml-glass rounded-2xl p-3.5 text-left hover:border-[var(--accent-primary-border)] transition-all min-h-[78px]"
        >
          <Bookmark className="w-5 h-5 text-[var(--accent-primary)] mb-2" />
          <p className="text-xs font-bold text-[var(--text-primary)]">Saved Collection</p>
          <p className="text-[10px] text-[var(--text-secondary)]">Posts &amp; saved videos</p>
        </button>

        <button
          type="button"
          onClick={onOpenFriends}
          className="ml-glass rounded-2xl p-3.5 text-left hover:border-[var(--accent-primary-border)] transition-all min-h-[78px]"
        >
          <Users className="w-5 h-5 text-[var(--accent-primary)] mb-2" />
          <p className="text-xs font-bold text-[var(--text-primary)]">Friends</p>
          <p className="text-[10px] text-[var(--text-secondary)]">
            {currentUser ? `${currentUser.friendsCount} connections` : 'Sign in to connect'}
          </p>
        </button>

        <button
          type="button"
          onClick={currentUser ? onOpenNotifications : onOpenAuth}
          className="ml-glass rounded-2xl p-3.5 text-left hover:border-[var(--accent-gold-border)] transition-all min-h-[78px] relative"
        >
          <Bell className="w-5 h-5 text-[var(--accent-gold)] mb-2" />
          <p className="text-xs font-bold text-[var(--text-primary)]">Notifications</p>
          <p className="text-[10px] text-[var(--text-secondary)]">
            {currentUser ? (unreadNotifications > 0 ? `${unreadNotifications} unread` : 'All caught up') : 'Sign in required'}
          </p>
        </button>

        <button
          type="button"
          onClick={currentUser ? onOpenMessages : onOpenAuth}
          className="ml-glass rounded-2xl p-3.5 text-left hover:border-[var(--accent-primary-border)] transition-all min-h-[78px]"
        >
          <div className="mb-2">
            <WaveLogo size={22} />
          </div>
          <p className="text-xs font-bold text-[var(--text-primary)]">MOTHERLAND WAVE</p>
          <p className="text-[10px] text-[var(--text-secondary)]">
            {currentUser ? (unreadMessages > 0 ? `${unreadMessages} unread` : 'Chats, Voice & Video Calls') : 'Sign in required'}
          </p>
        </button>

        {onOpenWatchHistory && (
          <button
            type="button"
            onClick={currentUser ? onOpenWatchHistory : onOpenAuth}
            className="col-span-2 ml-glass rounded-2xl p-3.5 flex items-center justify-between text-left hover:border-[var(--accent-primary-border)] transition-all"
          >
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-[var(--accent-teal)] text-[var(--accent-primary)]" />
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Watch History</p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  Revisit videos hidden from discovery for 7 days
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        )}
      </div>

      {/* 5. Apps & API Settings List */}
      <div className="ml-glass rounded-2xl divide-y divide-[var(--border-subtle)] overflow-hidden">
        <button
          type="button"
          onClick={onOpenSocialApps}
          data-testid="menu-marketplace-btn"
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-alt)] transition-colors min-h-[56px]"
        >
          <div className="flex items-center gap-3">
            <Compass className="w-5 h-5 text-[var(--accent-primary)]" />
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">Marketplace · Social Apps</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                YouTube, Facebook, TikTok, Instagram
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        <button
          type="button"
          onClick={onOpenPlatformHub}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-alt)] transition-colors min-h-[56px]"
        >
          <div className="flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5 text-[var(--accent-gold)]" />
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">YouTube API &amp; Platform Hub</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {youtubeKeyConnected ? 'YouTube Data API connected' : 'Configure YouTube Data API key'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        <button
          type="button"
          onClick={onOpenAuth}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[var(--bg-surface-alt)] transition-colors min-h-[56px]"
        >
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5 text-[var(--accent-primary)]" />
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {currentUser ? 'Switch or Add Account' : 'Sign In / Create Account'}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {currentUser ? `Signed in as @${currentUser.username}` : 'Register with email or username'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* 6. Sign Out */}
      {currentUser && (
        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-[48px] py-3 rounded-2xl bg-[var(--danger-soft)] hover:opacity-90 border border-[var(--danger)]/30 text-[var(--danger)] text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      )}
    </div>
  );
};
