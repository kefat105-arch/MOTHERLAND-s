import React from 'react';
import { Bell, Search, Sun, Moon, Crown, UserCheck, Youtube } from 'lucide-react';
import type { UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { WaveLogo } from './wave/WaveLogo';
import { MotherlandLogo } from './layout/MotherlandLogo';

interface HeaderProps {
  currentUser: UserProfile | null;
  unreadNotifications: number;
  unreadMessages: number;
  theme: 'dark' | 'light';
  isYouTubeActive?: boolean;
  onToggleTheme: () => void;
  onOpenNotifications: () => void;
  onOpenMessages: () => void;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onOpenYouTube: () => void;
  onLogoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  unreadNotifications,
  unreadMessages,
  theme,
  isYouTubeActive = false,
  onToggleTheme,
  onOpenNotifications,
  onOpenMessages,
  onOpenSearch,
  onOpenProfile,
  onOpenAuth,
  onOpenYouTube,
  onLogoClick,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[var(--bg-glass)] backdrop-blur-xl border-b border-[var(--border-subtle)] px-3 sm:px-4 py-1.5 transition-colors shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
        {/* MOTHERLAND Logo + YouTube Launcher */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onLogoClick}
            className="flex items-center text-left min-h-[44px] focus:outline-none group flex-shrink-0"
            aria-label="MOTHERLAND Home"
          >
            <MotherlandLogo size={38} showText={true} />
          </button>

          {/* Red YouTube Logo Button */}
          <button
            type="button"
            onClick={onOpenYouTube}
            data-testid="header-youtube-btn"
            title="Open MOTHERLAND YouTube"
            aria-label="Open YouTube"
            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95 flex-shrink-0 ${
              isYouTubeActive
                ? 'bg-[#FF0000]/20 border-[#FF0000]/60 text-[var(--text-primary)] shadow-md'
                : 'bg-[var(--bg-surface)] hover:bg-[#FF0000]/10 border-[var(--border-subtle)] hover:border-[#FF0000]/40 text-[var(--text-primary)]'
            }`}
          >
            <span className="w-6 h-4 rounded-md bg-[#FF0000] flex items-center justify-center text-white shadow-sm">
              <Youtube className="w-3.5 h-3.5 fill-current" />
            </span>
            <span className="text-xs font-extrabold tracking-tight hidden xs:inline sm:inline">
              YouTube
            </span>
          </button>
        </div>

        {/* Action Controls (Min 44px touch targets on mobile) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] transition-colors"
            title="Search videos and posts"
            aria-label="Search"
          >
            <Search className="w-4.5 h-4.5" />
          </button>

          {/* MOTHERLAND WAVE */}
          <button
            type="button"
            onClick={currentUser ? onOpenMessages : onOpenAuth}
            className="relative w-10 h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] transition-colors"
            title="MOTHERLAND WAVE"
            aria-label="MOTHERLAND WAVE"
            data-testid="header-wave-btn"
          >
            <WaveLogo size={22} />
            {currentUser && unreadMessages > 0 && (
              <span
                data-testid="unread-messages-badge"
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[var(--accent-gold)] text-[#13161C] text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums"
              >
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={currentUser ? onOpenNotifications : onOpenAuth}
            className="relative w-10 h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            {currentUser && unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>

          {/* Light / Dark Theme Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            data-testid="theme-toggle-btn"
            className="flex w-10 h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] items-center justify-center text-[var(--text-primary)] transition-colors"
            title={theme === 'dark' ? 'Switch to Light Glass Theme' : 'Switch to Dark Glass Theme'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-4.5 h-4.5 text-[var(--accent-gold)]" />
            ) : (
              <Moon className="w-4.5 h-4.5 text-[var(--accent-royal)]" />
            )}
          </button>

          {/* PWA Install Button */}
          <div className="hidden md:block">
            <PWAInstallButton />
          </div>

          {/* Profile Shortcut OR Guest Sign In */}
          {currentUser ? (
            <button
              type="button"
              onClick={onOpenProfile}
              className="relative w-10 h-10 rounded-xl overflow-hidden border border-[var(--accent-gold-border)] ml-0.5 hover:ring-2 hover:ring-[var(--accent-primary)] transition-all flex items-center justify-center bg-[var(--bg-surface-alt)]"
              title={`${currentUser.displayName} — Profile`}
              aria-label="Profile"
            >
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.displayName} className="w-full h-full object-cover" />
              ) : (
                <UserCheck className="w-4 h-4 text-[var(--accent-primary)]" />
              )}
              {currentUser.role === 'owner' && (
                <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[var(--accent-gold)] rounded-full flex items-center justify-center border border-[var(--bg-canvas)]">
                  <Crown className="w-2.5 h-2.5 text-[#13161C]" />
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              data-testid="header-signin-btn"
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-bold shadow-sm whitespace-nowrap transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
