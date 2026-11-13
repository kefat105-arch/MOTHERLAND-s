import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Flame, Search, Star, Clock, Sparkles, X } from 'lucide-react';
import {
  FIRE_EMOJI_CATEGORIES,
  FIRE_EMOJI_CATALOG,
  FireEmojiCategory,
  FireEmojiItem,
} from '../../data/fireEmojiCatalog';
import {
  filterFireEmojis,
  getFavoriteFireEmojiIds,
  recordRecentFireEmoji,
  toggleFavoriteFireEmoji,
} from '../../services/fireEmojiService';
import { FireEmojiIcon } from './FireEmojiIcon';

type PickerTab = 'All' | 'Recent' | 'Favorites' | FireEmojiCategory;

interface FireEmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: FireEmojiItem) => void;
  title?: string;
}

const TABS: Array<{ id: PickerTab; label: string }> = [
  { id: 'All', label: 'All (229)' },
  { id: 'Recent', label: 'Recent' },
  { id: 'Favorites', label: 'Favorites' },
  ...FIRE_EMOJI_CATEGORIES.map((c) => ({ id: c as PickerTab, label: c })),
];

export const FireEmojiPicker: React.FC<FireEmojiPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'MOTHERLAND Fire Emoji Universe',
}) => {
  const [activeTab, setActiveTab] = useState<PickerTab>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => getFavoriteFireEmojiIds());
  const [visibleLimit, setVisibleLimit] = useState(96);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFavoriteIds(getFavoriteFireEmojiIds());
    setVisibleLimit(96);
    const timer = setTimeout(() => {
      if (window.innerWidth >= 640) searchRef.current?.focus();
    }, 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  const filtered = useMemo(
    () =>
      filterFireEmojis({
        query: searchQuery,
        category: activeTab,
      }),
    [searchQuery, activeTab, favoriteIds]
  );

  const visibleItems = useMemo(() => filtered.slice(0, visibleLimit), [filtered, visibleLimit]);

  if (!isOpen) return null;

  const handleChoose = (emoji: FireEmojiItem) => {
    recordRecentFireEmoji(emoji.id);
    onSelect(emoji);
  };

  const handleToggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = toggleFavoriteFireEmoji(id);
    setFavoriteIds(updated);
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-[#0c1220] border border-orange-500/25 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-orange-950/50 flex flex-col max-h-[82vh] sm:max-h-[540px] overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-[#14192b] via-[#1c1315] to-[#14192b] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/assets/fire-emojis/expressions/exp_01.png"
              alt="Fire Universe"
              className="w-6 h-6 object-contain flex-shrink-0"
            />
            <div className="min-w-0">
              <h4 className="font-extrabold text-xs sm:text-sm text-white truncate">{title}</h4>
              <p className="text-[10px] text-amber-300/80 truncate">
                {FIRE_EMOJI_CATALOG.length} Original Fire Characters • Tap to insert
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors"
            aria-label="Close Fire Emoji Picker"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-3 pt-2.5 pb-2 border-b border-white/5 bg-[#090d17]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-amber-400/80 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleLimit(96);
              }}
              placeholder="Search fire emojis (love, haha, biryani, tiger, cricket...)"
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#131b2e] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/50"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 pb-0.5">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setVisibleLimit(96);
                  }}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap flex items-center gap-1 transition-all flex-shrink-0 ${
                    active
                      ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-md shadow-orange-950/50'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab.id === 'Recent' && <Clock className="w-3 h-3" />}
                  {tab.id === 'Favorites' && <Star className="w-3 h-3" />}
                  {tab.id === 'All' && <Flame className="w-3 h-3" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Emoji Grid */}
        <div
          className="flex-1 overflow-y-auto p-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 180) {
              setVisibleLimit((prev) => Math.min(filtered.length, prev + 80));
            }
          }}
        >
          {visibleItems.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Sparkles className="w-7 h-7 text-amber-500/60 mx-auto" />
              <p className="text-xs text-slate-400">
                No Fire Emojis matched &quot;{searchQuery}&quot; in {activeTab}.
              </p>
              {activeTab !== 'All' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('All')}
                  className="text-xs text-amber-400 hover:underline font-semibold"
                >
                  Browse All {FIRE_EMOJI_CATALOG.length} Fire Emojis
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
                {visibleItems.map((emoji) => {
                  const isFav = favoriteIds.includes(emoji.id);
                  return (
                    <div
                      key={emoji.id}
                      onClick={() => handleChoose(emoji)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleChoose(emoji);
                        }
                      }}
                      title={`${emoji.name} (${emoji.category})`}
                      className="group relative aspect-square rounded-2xl bg-[#12192b]/70 hover:bg-orange-500/15 border border-white/5 hover:border-orange-400/40 flex flex-col items-center justify-center p-1.5 cursor-pointer transition-all active:scale-90"
                    >
                      <FireEmojiIcon
                        item={emoji}
                        size="lg"
                        className="group-hover:scale-110 transition-transform duration-150"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(e, emoji.id)}
                        title={isFav ? 'Remove from Favorites' : 'Save to Favorites'}
                        className={`absolute top-1 right-1 p-0.5 rounded-full transition-opacity ${
                          isFav
                            ? 'opacity-100 text-amber-400'
                            : 'opacity-0 group-hover:opacity-100 text-slate-500 hover:text-amber-300'
                        }`}
                      >
                        <Star className={`w-2.5 h-2.5 ${isFav ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {visibleLimit < filtered.length && (
                <div className="pt-3 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((prev) => prev + 80)}
                    className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-amber-300 font-semibold"
                  >
                    Load More ({filtered.length - visibleLimit} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
