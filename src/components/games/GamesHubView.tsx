import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Clock,
  Loader2,
  Play,
  Shield,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import { api } from '../../api';
import type {
  GameCatalogEntry,
  GameCategoryFilter,
  LiveSpyCapacity,
  UserProfile,
} from '../../types';
import type { RealtimeEvent } from '../../hooks/useRealtime';
import { BmGamesIcon } from './BmGamesIcon';
import { LiveSpyEmblem } from './LiveSpyEmblem';

const LazyLiveSpyGame = lazy(() =>
  import('./LiveSpyGame').then((mod) => ({ default: mod.LiveSpyGame }))
);

interface GamesHubViewProps {
  currentUser: UserProfile | null;
  sendWsEvent: (event: string, payload: Record<string, any>) => boolean;
  subscribeSpyEvents: (listener: (evt: RealtimeEvent) => void) => () => void;
  onBack: () => void;
  onRequireAuth: () => void;
}

const DEFAULT_GAMES: GameCatalogEntry[] = [
  {
    id: 'live_spy',
    name: 'LIVE SPY',
    tagline: 'Live Camera Social Deduction',
    description:
      'Enter an upscale 3D private lounge with 6 or 8 real players. Stream live camera or sit as a 3D Teddy Avatar, trade sharp clues, debate in voice, and unmask the hidden Spy.',
    category: 'multiplayer',
    badge: 'Online Multiplayer',
    status: 'playable',
    supportedCapacities: [6, 8],
  },
  {
    id: 'ludo_royal',
    name: 'LUDO ROYAL',
    tagline: 'Real-Time 4-Player Board Duel',
    description:
      'Classic dice strategy with voice-chat tables and tournament ladders inside MOTHERLAND.',
    category: 'coming_soon',
    badge: 'Coming Soon',
    status: 'coming_soon',
  },
  {
    id: 'carrom_club',
    name: 'CARROM CLUB',
    tagline: 'Physics Strike & Pocket Arena',
    description:
      'Challenge friends on bespoke teakwood boards with smooth touch-flick precision.',
    category: 'coming_soon',
    badge: 'Coming Soon',
    status: 'coming_soon',
  },
  {
    id: 'dhaka_trivia',
    name: 'SPEED TRIVIA LIVE',
    tagline: 'Lightning Cultural & World Quiz',
    description:
      'Rapid-fire social rounds covering Bengal heritage, cinema, music, and global pop culture.',
    category: 'coming_soon',
    badge: 'Coming Soon',
    status: 'coming_soon',
  },
];

const CATEGORIES: Array<{ id: GameCategoryFilter; label: string }> = [
  { id: 'all', label: 'All Games' },
  { id: 'multiplayer', label: 'Multiplayer Games' },
  { id: 'social', label: 'Social Games' },
  { id: 'casual', label: 'Casual Games' },
  { id: 'coming_soon', label: 'Coming Soon' },
];

export const GamesHubView: React.FC<GamesHubViewProps> = ({
  currentUser,
  sendWsEvent,
  subscribeSpyEvents,
  onBack,
  onRequireAuth,
}) => {
  const [activeCategory, setActiveCategory] = useState<GameCategoryFilter>('all');
  const [games, setGames] = useState<GameCatalogEntry[]>(DEFAULT_GAMES);
  const [selectedCapacity, setSelectedCapacity] = useState<LiveSpyCapacity>(6);
  const [activeLiveSpyCapacity, setActiveLiveSpyCapacity] = useState<LiveSpyCapacity | null>(null);

  useEffect(() => {
    api
      .getGamesCatalog()
      .then((res) => {
        if (Array.isArray(res.games) && res.games.length > 0) {
          setGames(res.games);
        }
      })
      .catch(() => {});
  }, []);

  const filteredGames = useMemo(() => {
    if (activeCategory === 'all') return games;
    if (activeCategory === 'multiplayer' || activeCategory === 'social') {
      return games.filter((g) => g.id === 'live_spy');
    }
    if (activeCategory === 'casual') {
      return games.filter((g) => g.category === 'casual' || g.status === 'coming_soon');
    }
    return games.filter((g) => g.status === 'coming_soon');
  }, [activeCategory, games]);

  const liveSpyGame = filteredGames.find((g) => g.id === 'live_spy') || null;
  const comingSoonGames = filteredGames.filter((g) => g.status === 'coming_soon');

  const handlePlayLiveSpy = () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setActiveLiveSpyCapacity(selectedCapacity);
  };

  if (activeLiveSpyCapacity && currentUser) {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 z-50 bg-[#0b0e14] text-slate-100 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            <p className="text-sm font-bold text-slate-200">Entering 3D Private Lounge...</p>
          </div>
        }
      >
        <LazyLiveSpyGame
          currentUser={currentUser}
          capacity={activeLiveSpyCapacity}
          sendWsEvent={sendWsEvent}
          subscribeSpyEvents={subscribeSpyEvents}
          onExit={() => setActiveLiveSpyCapacity(null)}
        />
      </Suspense>
    );
  }

  return (
    <div
      data-testid="games-hub-view"
      className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 space-y-5"
    >
      {/* Games Hub Header */}
      <div className="ml-glass rounded-2xl p-4 sm:p-5 border border-[var(--border-subtle)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            data-testid="games-hub-back-btn"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] shrink-0 transition-colors"
            aria-label="Back to Home Feed"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="w-11 h-11 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center shrink-0">
            <BmGamesIcon className="w-7 h-7" />
          </div>

          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-[var(--text-primary)] truncate">
              MOTHERLAND GAMES
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[var(--text-secondary)] truncate">
              Play. Connect. Enjoy.
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-xs font-bold text-[var(--accent-primary)] shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
          <span>BM Arcade</span>
        </span>
      </div>

      {/* Category Filter Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              data-testid={`games-cat-${cat.id}`}
              onClick={() => setActiveCategory(cat.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition-all ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] border-transparent shadow-sm'
                  : 'ml-glass text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Featured LIVE SPY Game Card */}
      {liveSpyGame && (
        <section
          data-testid="live-spy-featured-card"
          className="rounded-3xl overflow-hidden border border-[var(--accent-primary-border)] bg-gradient-to-br from-[#0e1726] via-[#101c2d] to-[#0a1019] text-slate-100 shadow-2xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* 3D Private Lounge Visual Preview */}
            <div className="lg:col-span-5 relative min-h-[220px] sm:min-h-[250px] bg-[#0b1018] overflow-hidden flex items-center justify-center p-4 border-b lg:border-b-0 lg:border-r border-white/10">
              {/* Atmospheric Private Lounge 3D Illustration Preview */}
              <svg
                viewBox="0 0 400 260"
                className="w-full h-full max-w-[380px] drop-shadow-2xl"
                aria-hidden="true"
              >
                <defs>
                  <radialGradient id="lounge_glow" cx="50%" cy="38%" r="55%">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.32" />
                    <stop offset="55%" stopColor="#14B8A6" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#090D16" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id="screen_grad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0F172A" />
                    <stop offset="100%" stopColor="#082F49" />
                  </linearGradient>
                </defs>

                <rect width="400" height="260" rx="18" fill="#0B111C" />
                <ellipse cx="200" cy="115" rx="175" ry="105" fill="url(#lounge_glow)" />

                {/* Wood slat lounge backdrop */}
                {[38, 62, 86, 314, 338, 362].map((x) => (
                  <rect key={x} x={x} y="18" width="8" height="175" rx="3" fill="#2B1D14" opacity="0.7" />
                ))}

                {/* Front Wall Digital Display */}
                <rect x="115" y="24" width="170" height="72" rx="8" fill="url(#screen_grad)" stroke="#14B8A6" strokeWidth="2" />
                <text x="200" y="51" textAnchor="middle" fill="#14B8A6" fontSize="10" fontWeight="800">
                  MOTHERLAND LOUNGE
                </text>
                <text x="200" y="72" textAnchor="middle" fill="#F8FAFC" fontSize="17" fontWeight="900">
                  LIVE SPY · 3D
                </text>
                <rect x="166" y="80" width="68" height="10" rx="4" fill="#F59E0B" opacity="0.85" />

                {/* Circular Luxury Mahogany Table */}
                <ellipse cx="200" cy="196" rx="108" ry="38" fill="#422618" stroke="#D97706" strokeWidth="2.5" />
                <ellipse cx="200" cy="196" rx="44" ry="15" fill="none" stroke="#14B8A6" strokeWidth="1.5" opacity="0.8" />
                <circle cx="200" cy="186" r="10" fill="#FFB86C" opacity="0.95" />

                {/* Seated Avatars around Table */}
                {[
                  { x: 108, y: 158, cam: true },
                  { x: 152, y: 136, cam: false },
                  { x: 248, y: 136, cam: true },
                  { x: 292, y: 158, cam: false },
                ].map((s, idx) => (
                  <g key={idx} transform={`translate(${s.x}, ${s.y})`}>
                    <rect x="-14" y="8" width="28" height="22" rx="6" fill="#1E293B" stroke="#475569" strokeWidth="1.2" />
                    {s.cam ? (
                      <>
                        <rect x="-15" y="-12" width="30" height="21" rx="4" fill="#0F172A" stroke="#14B8A6" strokeWidth="1.6" />
                        <circle cx="0" cy="-3" r="4.5" fill="#94A3B8" />
                        <circle cx="10" cy="-7" r="2.2" fill="#EF4444" />
                      </>
                    ) : (
                      <>
                        {/* Miniature 3D Teddy silhouette */}
                        <circle cx="-6" cy="-10" r="4" fill="#B97A4B" />
                        <circle cx="6" cy="-10" r="4" fill="#B97A4B" />
                        <circle cx="0" cy="-4" r="9" fill="#B97A4B" />
                        <ellipse cx="0" cy="-2" rx="4.5" ry="3.2" fill="#F1DCC2" />
                        <circle cx="0" cy="-3" r="1.4" fill="#111827" />
                      </>
                    )}
                  </g>
                ))}
              </svg>

              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0d1523]/95 border border-teal-400/40 text-[11px] font-extrabold text-teal-300">
                <Video className="w-3.5 h-3.5" />
                <span>3D Private Lounge</span>
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0d1523]/95 border border-amber-400/40 text-[11px] font-extrabold text-amber-300">
                <span>{liveSpyGame.badge}</span>
              </div>
            </div>

            {/* Game Info & Automatic Matchmaking Trigger */}
            <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <LiveSpyEmblem className="w-12 h-12 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                        {liveSpyGame.name}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/20 border border-teal-400/40 text-[11px] font-bold text-teal-300">
                        {liveSpyGame.badge}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-amber-400 mt-0.5">
                      {liveSpyGame.tagline}
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {liveSpyGame.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-slate-200">
                    <Camera className="w-4 h-4 text-teal-400 shrink-0" />
                    <span>Live Cam + Teddy Avatar</span>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-slate-200">
                    <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Private Secret Roles</span>
                  </div>
                  <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-xs text-slate-200">
                    <Users className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>Real Players Only</span>
                  </div>
                </div>
              </div>

              {/* Match Size Selector + Single PLAY NOW Button (No Create/Join Room) */}
              <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Table Size:</span>
                  {([6, 8] as const).map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      data-testid={`live-spy-size-${cap}`}
                      onClick={() => setSelectedCapacity(cap)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                        selectedCapacity === cap
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-sm'
                          : 'bg-slate-800/80 text-slate-200 border-white/10 hover:border-amber-400/40'
                      }`}
                    >
                      {cap} Players
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  data-testid="live-spy-play-now-btn"
                  onClick={handlePlayLiveSpy}
                  className="min-h-[48px] px-7 py-2.5 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-sm font-black tracking-wide flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>PLAY NOW</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Upcoming / Coming Soon Games */}
      {comingSoonGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent-gold)]" />
              <span>Coming Soon to MOTHERLAND GAMES</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {comingSoonGames.map((game) => (
              <div
                key={game.id}
                className="ml-glass rounded-2xl p-4 border border-[var(--border-subtle)] flex flex-col justify-between gap-3 opacity-90"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-black text-[var(--text-primary)]">{game.name}</h4>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/35 text-[10px] font-extrabold text-[var(--accent-gold)]">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[var(--accent-primary)]">{game.tagline}</p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {game.description}
                  </p>
                </div>

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)]">
                  <span>In Development</span>
                  <span>Stay Tuned</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
