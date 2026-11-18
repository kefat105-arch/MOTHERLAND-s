import React from 'react';
import { Bell, Search, Crown, UserCheck, Youtube } from 'lucide-react';
import type { UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { WaveLogo } from './wave/WaveLogo';
import { MotherlandLogo } from './layout/MotherlandLogo';
import { MotherlandLiveIcon } from './live/MotherlandLiveIcon';

interface HeaderProps {
  currentUser: UserProfile | null;
  unreadNotifications: number;
  unreadMessages: number;
  isYouTubeActive?: boolean;
  isMotherlandLiveActive?: boolean;
  onOpenNotifications: () => void;
  onOpenMessages: () => void;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onOpenYouTube: () => void;
  onOpenMotherlandLive?: () => void;
  onLogoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  unreadNotifications,
  unreadMessages,
  isYouTubeActive = false,
  isMotherlandLiveActive = false,
  onOpenNotifications,
  onOpenMessages,
  onOpenSearch,
  onOpenProfile,
  onOpenAuth,
  onOpenYouTube,
  onOpenMotherlandLive,
  onLogoClick,
}) => {
  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-40 w-full max-w-[100vw] overflow-hidden bg-[var(--bg-glass)] backdrop-blur-xl border-b border-[var(--border-subtle)] px-1.5 min-[375px]:px-2.5 sm:px-4 py-1.5 transition-colors shadow-sm"
    >
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-1 sm:gap-2 min-w-0">
        {/* MOTHERLAND Logo + Always-Visible Bespoke MOTHERLAND Wordmark */}
        <button
          type="button"
          onClick={onLogoClick}
          data-testid="header-brand-btn"
          className="flex items-center text-left min-h-[38px] sm:min-h-[44px] focus:outline-none group min-w-0 shrink"
          aria-label="MOTHERLAND Home"
        >
          <MotherlandLogo
            showText={true}
            className="gap-1.5 sm:gap-2.5"
            iconClassName="w-[28px] h-[28px] min-[375px]:w-[32px] min-[375px]:h-[32px] sm:w-[36px] sm:h-[36px]"
          />
        </button>

        {/* Action Controls (Fitted cleanly from 320px Android up to 1440px+ desktop) */}
        <div className="flex items-center gap-[3px] min-[375px]:gap-1 sm:gap-2 shrink-0">
          {/* Motherland live (Live TV, Movies & Drama) Quick Entry */}
          {onOpenMotherlandLive && (
            <button
              type="button"
              onClick={onOpenMotherlandLive}
              data-testid="header-motherland-live-btn"
              title="Motherland live — Live TV"
              aria-label="Motherland live"
              className={`h-7 min-[375px]:h-8 sm:h-10 px-1.5 min-[375px]:px-2 sm:px-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                isMotherlandLiveActive
                  ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                  : 'bg-[var(--bg-surface)] hover:bg-rose-500/10 border-[var(--border-subtle)] hover:border-rose-500/40 text-[var(--text-primary)]'
              }`}
            >
              <MotherlandLiveIcon
                className="w-4 h-4 min-[375px]:w-[17px] min-[375px]:h-[17px]"
                active={isMotherlandLiveActive}
              />
              <span className="hidden md:inline">Live TV</span>
            </button>
          )}

          {/* Always-Accessible Universal Search */}
          <button
            type="button"
            onClick={onOpenSearch}
            data-testid="header-search-btn"
            className="w-7 h-7 min-[375px]:w-8 min-[375px]:h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] transition-colors shrink-0"
            title="Search videos, small videos, and creators"
            aria-label="Search"
          >
            <Search className="w-3.5 h-3.5 min-[375px]:w-4 min-[375px]:h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* MOTHERLAND WAVE */}
          <button
            type="button"
            onClick={currentUser ? onOpenMessages : onOpenAuth}
            className="relative w-7 h-7 min-[375px]:w-8 min-[375px]:h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] transition-colors shrink-0"
            title="MOTHERLAND WAVE"
            aria-label="MOTHERLAND WAVE"
            data-testid="header-wave-btn"
          >
            <WaveLogo size={17} />
            {currentUser && unreadMessages > 0 && (
              <span
                data-testid="unread-messages-badge"
                className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 bg-[var(--accent-gold)] text-[#13161C] text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums"
              >
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={currentUser ? onOpenNotifications : onOpenAuth}
            className="relative w-7 h-7 min-[375px]:w-8 min-[375px]:h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] transition-colors shrink-0"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-3.5 h-3.5 min-[375px]:w-4 min-[375px]:h-4 sm:w-4.5 sm:h-4.5" />
            {currentUser && unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            )}
          </button>

          {/* Red YouTube Logo Button */}
          <button
            type="button"
            onClick={onOpenYouTube}
            data-testid="header-youtube-btn"
            title="Open MOTHERLAND YouTube"
            aria-label="Open YouTube"
            className={`w-7 h-7 min-[375px]:w-8 min-[375px]:h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
              isYouTubeActive
                ? 'bg-[#FF0000]/20 border-[#FF0000]/60 text-[var(--text-primary)] shadow-md'
                : 'bg-[var(--bg-surface)] hover:bg-[#FF0000]/10 border-[var(--border-subtle)] hover:border-[#FF0000]/40 text-[var(--text-primary)]'
            }`}
          >
            <span className="w-4 h-3 min-[375px]:w-5 min-[375px]:h-3.5 sm:w-6 sm:h-4 rounded-md bg-[#FF0000] flex items-center justify-center text-white shadow-sm">
              <Youtube className="w-2.5 h-2.5 min-[375px]:w-3 min-[375px]:h-3 sm:w-3.5 sm:h-3.5 fill-current" />
            </span>
          </button>

          {/* PWA Install Button */}
          <div className="hidden md:block">
            <PWAInstallButton variant="header" />
          </div>

          {/* Profile Shortcut OR Guest Sign In */}
          {currentUser ? (
            <button
              type="button"
              onClick={onOpenProfile}
              data-testid="header-profile-btn"
              className="relative w-7 h-7 min-[375px]:w-8 min-[375px]:h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-[var(--accent-gold-border)] hover:ring-2 hover:ring-[var(--accent-primary)] transition-all flex items-center justify-center bg-[var(--bg-surface-alt)] shrink-0"
              title={`${currentUser.displayName} — Profile`}
              aria-label="Profile"
            >
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.displayName} className="w-full h-full object-cover" />
              ) : (
                <UserCheck className="w-4 h-4 text-[var(--accent-primary)]" />
              )}
              {currentUser.role === 'owner' && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[var(--accent-gold)] rounded-full flex items-center justify-center border border-[var(--bg-canvas)]">
                  <Crown className="w-2 h-2 text-[#13161C]" />
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              data-testid="header-signin-btn"
              className="min-h-[30px] min-[375px]:min-h-[34px] sm:min-h-[40px] px-2 min-[375px]:px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-[10px] min-[375px]:text-[11px] sm:text-xs font-bold shadow-sm whitespace-nowrap transition-colors shrink-0"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
