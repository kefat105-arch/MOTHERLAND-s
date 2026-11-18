import React from 'react';
import { Home, Flame, Users, Plus, PlaySquare, Menu } from 'lucide-react';

export type NavTab = 'home' | 'shorts' | 'friends' | 'create' | 'video' | 'menu' | 'profile' | 'youtube' | 'motherland_live' | 'games';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenCreate: () => void;
  unreadFriendsCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenCreate,
  unreadFriendsCount = 0,
}) => {
  const itemClass = (isActive: boolean) =>
    `min-w-0 w-full min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-colors touch-manipulation select-none ${
      isActive
        ? 'text-[var(--accent-primary)] font-bold'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;

  return (
    <nav
      aria-label="Primary bottom navigation"
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 w-full max-w-[100vw] overflow-hidden z-40 bg-[var(--bg-glass)] backdrop-blur-xl border-t border-[var(--border-subtle)] px-1 sm:px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] transition-colors"
    >
      <div className="w-full max-w-xl mx-auto grid grid-cols-6 items-center gap-0.5">
        {/* 1. HOME */}
        <button
          type="button"
          data-testid="nav-home-btn"
          onClick={() => onTabChange('home')}
          className={itemClass(activeTab === 'home')}
        >
          <Home className={`w-5 h-5 shrink-0 ${activeTab === 'home' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[9px] sm:text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-full">
            HOME
          </span>
        </button>

        {/* 2. SMALL VIDEO */}
        <button
          type="button"
          data-testid="nav-small-btn"
          onClick={() => onTabChange('shorts')}
          className={itemClass(activeTab === 'shorts')}
          aria-label="Small Video"
        >
          <Flame className={`w-5 h-5 shrink-0 ${activeTab === 'shorts' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[9px] sm:text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-full">
            SMALL
          </span>
        </button>

        {/* 3. FRIENDS */}
        <button
          type="button"
          data-testid="nav-friends-btn"
          onClick={() => onTabChange('friends')}
          className={`relative ${itemClass(activeTab === 'friends')}`}
        >
          <Users className={`w-5 h-5 shrink-0 ${activeTab === 'friends' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[9px] sm:text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-full">
            FRIENDS
          </span>
          {unreadFriendsCount > 0 && (
            <span className="absolute top-1.5 right-2.5 w-2 h-2 bg-[var(--accent-gold)] rounded-full" />
          )}
        </button>

        {/* 4. CREATE (+) */}
        <button
          type="button"
          data-testid="nav-create-btn"
          onClick={onOpenCreate}
          className="min-w-0 w-full min-h-[48px] flex flex-col items-center justify-center py-0.5 touch-manipulation select-none"
          title="Create Post, Story, Upload Video, Create Small Video"
        >
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] border border-[var(--accent-gold-border)] flex items-center justify-center shadow-sm active:scale-95 transition-all shrink-0">
            <Plus className="w-5 h-5 stroke-[2.75px]" />
          </span>
          <span className="text-[9px] font-bold text-[var(--accent-primary)] leading-tight tracking-tight mt-0.5 truncate max-w-full">
            CREATE
          </span>
        </button>

        {/* 5. VIDEO */}
        <button
          type="button"
          data-testid="nav-video-btn"
          onClick={() => onTabChange('video')}
          className={itemClass(activeTab === 'video')}
        >
          <PlaySquare className={`w-5 h-5 shrink-0 ${activeTab === 'video' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[9px] sm:text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-full">
            VIDEO
          </span>
        </button>

        {/* 6. MENU */}
        <button
          type="button"
          data-testid="nav-menu-btn"
          onClick={() => onTabChange('menu')}
          className={itemClass(activeTab === 'menu' || activeTab === 'profile')}
        >
          <Menu className={`w-5 h-5 shrink-0 ${activeTab === 'menu' || activeTab === 'profile' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[9px] sm:text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-full">
            MENU
          </span>
        </button>
      </div>
    </nav>
  );
};
