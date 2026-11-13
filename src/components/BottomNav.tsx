import React from 'react';
import { Home, Flame, Users, Plus, PlaySquare, Menu } from 'lucide-react';

export type NavTab = 'home' | 'shorts' | 'friends' | 'create' | 'video' | 'menu' | 'profile' | 'youtube';

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
    `flex-1 min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors ${
      isActive
        ? 'text-[var(--accent-primary)] font-bold'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;

  return (
    <nav
      aria-label="Primary bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-glass)] backdrop-blur-xl border-t border-[var(--border-subtle)] px-1.5 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] transition-colors"
    >
      <div className="max-w-xl mx-auto flex items-center justify-between gap-0.5">
        {/* 1. HOME */}
        <button
          type="button"
          onClick={() => onTabChange('home')}
          className={itemClass(activeTab === 'home')}
        >
          <Home className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">HOME</span>
        </button>

        {/* 2. SHORTS */}
        <button
          type="button"
          onClick={() => onTabChange('shorts')}
          className={itemClass(activeTab === 'shorts')}
        >
          <Flame className={`w-5 h-5 ${activeTab === 'shorts' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">SHORTS</span>
        </button>

        {/* 3. FRIENDS */}
        <button
          type="button"
          onClick={() => onTabChange('friends')}
          className={`relative ${itemClass(activeTab === 'friends')}`}
        >
          <Users className={`w-5 h-5 ${activeTab === 'friends' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">FRIENDS</span>
          {unreadFriendsCount > 0 && (
            <span className="absolute top-1.5 right-3 w-2 h-2 bg-[var(--accent-gold)] rounded-full" />
          )}
        </button>

        {/* 4. CREATE (+) */}
        <button
          type="button"
          onClick={onOpenCreate}
          className="flex-1 min-h-[48px] flex flex-col items-center justify-center py-0.5"
          title="Create Post, Story, Upload Video, Create Short"
        >
          <span className="w-10 h-10 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] border border-[var(--accent-gold-border)] flex items-center justify-center shadow-sm active:scale-95 transition-all">
            <Plus className="w-5 h-5 stroke-[2.75px]" />
          </span>
          <span className="text-[9px] font-bold text-[var(--accent-primary)] tracking-tight mt-0.5">
            CREATE
          </span>
        </button>

        {/* 5. VIDEO */}
        <button
          type="button"
          onClick={() => onTabChange('video')}
          className={itemClass(activeTab === 'video')}
        >
          <PlaySquare className={`w-5 h-5 ${activeTab === 'video' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">VIDEO</span>
        </button>

        {/* 6. MENU */}
        <button
          type="button"
          onClick={() => onTabChange('menu')}
          className={itemClass(activeTab === 'menu' || activeTab === 'profile')}
        >
          <Menu className={`w-5 h-5 ${activeTab === 'menu' || activeTab === 'profile' ? 'stroke-[2.5px]' : 'stroke-[1.75px]'}`} />
          <span className="text-[10px] tracking-tight mt-0.5">MENU</span>
        </button>
      </div>
    </nav>
  );
};
