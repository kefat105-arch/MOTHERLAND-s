import React from 'react';
import { Bell, Search, Crown, UserCheck, Youtube, Globe } from 'lucide-react';
import type { UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { WaveLogo } from './wave/WaveLogo';
import { MotherlandLogo } from './layout/MotherlandLogo';

interface HeaderProps {
  currentUser: UserProfile | null;
  unreadNotifications: number;
  unreadMessages: number;
  isYouTubeActive?: boolean;
  isBdServicesActive?: boolean;
  onOpenNotifications: () => void;
  onOpenMessages: () => void;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onOpenYouTube: () => void;
  onOpenBdServices?: () => void;
  onLogoClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  unreadNotifications,
  unreadMessages,
  isYouTubeActive = false,
  isBdServicesActive = false,
  onOpenNotifications,
  onOpenMessages,
  onOpenSearch,
  onOpenProfile,
  onOpenAuth,
  onOpenYouTube,
  onOpenBdServices,
  onLogoClick,
}) => {
  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-40 w-full max-w-[100vw] overflow-hidden bg-[var(--bg-glass)] backdrop-blur-xl border-b border-[var(--border-subtle)] px-2 sm:px-4 py-1.5 transition-colors shadow-sm"
    >
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-1 sm:gap-2 min-w-0">
        {/* MOTHERLAND Logo */}
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center text-left min-h-[40px] sm:min-h-[44px] focus:outline-none group min-w-0 shrink max-[374px]:[&_div:nth-child(2)]:hidden"
          aria-label="MOTHERLAND Home"
        >
          <MotherlandLogo size={34} showText={true} />
        </button>

        {/* Action Controls (Fitted cleanly from 320px Android up to 1440px+ desktop) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Bangladesh Services Quick Entry */}
          {onOpenBdServices && (
            <button
              type="button"
              onClick={onOpenBdServices}
              data-testid="header-bd-services-btn"
              title="BANGLADESH SERVICES (বাংলাদেশ)"
              aria-label="Bangladesh Services"
              className={`h-8 sm:h-10 px-1.5 sm:px-2.5 rounded-xl border flex items-center justify-center gap-1 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                isBdServicesActive
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                  : 'bg-[var(--bg-surface)] hover:bg-emerald-500/10 border-[var(--border-subtle)] text-[var(--text-primary)]'
              }`}
            >
              <Globe className={`w-4 h-4 ${isBdServicesActive ? 'text-white' : 'text-emerald-500'}`} />
              <span className="hidden md:inline">বাংলাদেশ</span>
            </button>
          )}

          {/* Always-Accessible Universal Search */}
          <button
            type="button"
            onClick={onOpenSearch}
            data-testid="header-search-btn"
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] transition-colors shrink-0"
            title="Search videos, small videos, and creators"
            aria-label="Search"
          >
            <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* MOTHERLAND WAVE */}
          <button
            type="button"
            onClick={currentUser ? onOpenMessages : onOpenAuth}
            className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] transition-colors shrink-0"
            title="MOTHERLAND WAVE"
            aria-label="MOTHERLAND WAVE"
            data-testid="header-wave-btn"
          >
            <WaveLogo size={19} />
            {currentUser && unreadMessages > 0 && (
              <span
                data-testid="unread-messages-badge"
                className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-[var(--accent-gold)] text-[#13161C] text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums"
              >
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            )}
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={currentUser ? onOpenNotifications : onOpenAuth}
            className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] transition-colors shrink-0"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {currentUser && unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
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
            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all active:scale-95 shrink-0 ${
              isYouTubeActive
                ? 'bg-[#FF0000]/20 border-[#FF0000]/60 text-[var(--text-primary)] shadow-md'
                : 'bg-[var(--bg-surface)] hover:bg-[#FF0000]/10 border-[var(--border-subtle)] hover:border-[#FF0000]/40 text-[var(--text-primary)]'
            }`}
          >
            <span className="w-5 h-3.5 sm:w-6 sm:h-4 rounded-md bg-[#FF0000] flex items-center justify-center text-white shadow-sm">
              <Youtube className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
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
              className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden border border-[var(--accent-gold-border)] hover:ring-2 hover:ring-[var(--accent-primary)] transition-all flex items-center justify-center bg-[var(--bg-surface-alt)] shrink-0"
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
              className="min-h-[34px] sm:min-h-[40px] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-[11px] sm:text-xs font-bold shadow-sm whitespace-nowrap transition-colors shrink-0"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
