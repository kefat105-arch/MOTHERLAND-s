import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  Clock,
  Edit3,
  Gamepad2,
  Hammer,
  Layers,
  Loader2,
  Mic,
  MessageSquare,
  Play,
  Plus,
  Search,
  Server,
  Shield,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  Video,
} from 'lucide-react';
import { api } from '../../api';
import type {
  GameCatalogEntry,
  GameCategoryFilter,
  LiveSpyCapacity,
  RobloxAvatarConfig,
  UserProfile,
} from '../../types';
import type { RealtimeEvent } from '../../hooks/useRealtime';
import { BmGamesIcon } from './BmGamesIcon';
import { LiveSpyEmblem } from './LiveSpyEmblem';
import { AvatarCustomizerModal } from './roblox3d/AvatarCustomizerModal';
import {
  loadLocalCustomGames,
  removeLocalCustomGame,
  upsertLocalCustomGame,
} from './roblox3d/GameCreatorStudio';
import { ROBLOX_DEFAULT_GAMES, ROBLOX_GAME_THUMBNAILS } from './roblox3d/gameCatalog';
import {
  CUSTOM_GAME_THUMBNAIL,
  PORTAL_PLAY_THUMBNAIL,
  ROBLOX_WORLD_ID_SET,
  ROBLOX_WORLD_REGISTRY,
} from './roblox3d/gameRegistry';
import { loadSavedRobloxAvatar, saveRobloxAvatar } from './roblox3d/robloxCharacter';
import {
  SQUID_STAGES,
  type CustomGameDefinition,
  type RobloxWorldId,
  type SquidStageId,
} from './roblox3d/types';

const LazyLiveSpyGame = lazy(() =>
  import('./LiveSpyGame').then((mod) => ({ default: mod.LiveSpyGame }))
);

const LazyRobloxGameStage = lazy(() =>
  import('./roblox3d/RobloxGameStage').then((mod) => ({ default: mod.RobloxGameStage }))
);

const LazyGameCreatorStudio = lazy(() =>
  import('./roblox3d/GameCreatorStudio').then((mod) => ({ default: mod.GameCreatorStudio }))
);

interface GamesHubViewProps {
  currentUser: UserProfile | null;
  sendWsEvent: (event: string, payload: Record<string, any>) => boolean;
  subscribeSpyEvents: (listener: (evt: RealtimeEvent) => void) => () => void;
  onBack: () => void;
  onRequireAuth: () => void;
}

const CATEGORIES: Array<{ id: GameCategoryFilter; label: string }> = [
  { id: 'all', label: 'Discover All' },
  { id: 'roleplay', label: 'Ocean, Pets & City' },
  { id: 'obby', label: 'Sky Citadel & Obby' },
  { id: 'action', label: 'Cyber Velocity & Combat' },
  { id: 'survival', label: 'Volcano & Squid S1' },
  { id: 'tycoon', label: 'Swarm & Tycoon' },
  { id: 'horror', label: 'Doors 100' },
  { id: 'multiplayer', label: 'Live Spy' },
];

type ServerStatsMap = Record<
  string,
  {
    activeServers: number;
    totalPlayers: number;
    maxPerRoom: number;
    rooms: Array<{ serverNumber: number; players: number }>;
  }
>;

export const GamesHubView: React.FC<GamesHubViewProps> = ({
  currentUser,
  sendWsEvent,
  subscribeSpyEvents,
  onBack,
  onRequireAuth,
}) => {
  // Always open the Game Icon with the Two-Box Portal: Box 1 ("গেম খেলুন") & Box 2 ("গেম তৈরি করুন")
  const [hubMode, setHubMode] = useState<'portal' | 'play' | 'studio'>('portal');
  const [activeCategory, setActiveCategory] = useState<GameCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [games, setGames] = useState<GameCatalogEntry[]>(ROBLOX_DEFAULT_GAMES);
  const [customGames, setCustomGames] = useState<CustomGameDefinition[]>(() => loadLocalCustomGames());
  const [editingCustomGame, setEditingCustomGame] = useState<CustomGameDefinition | null>(null);
  const [serverStats, setServerStats] = useState<ServerStatsMap>({});
  const [selectedCapacity, setSelectedCapacity] = useState<LiveSpyCapacity>(6);
  const [activeLiveSpyCapacity, setActiveLiveSpyCapacity] = useState<LiveSpyCapacity | null>(null);

  const [avatarConfig, setAvatarConfig] = useState<RobloxAvatarConfig>(() => loadSavedRobloxAvatar());
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  const [activeRobloxLaunch, setActiveRobloxLaunch] = useState<{
    worldId: string;
    squidStage?: SquidStageId;
    customGameDef?: CustomGameDefinition;
  } | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api
      .getGamesCatalog()
      .then((res) => {
        if (Array.isArray(res.games) && res.games.length > 0) {
          const byId = new Map<string, GameCatalogEntry>();
          for (const g of ROBLOX_DEFAULT_GAMES) byId.set(g.id, g);
          for (const srv of res.games) {
            const existing = byId.get(srv.id);
            byId.set(srv.id, existing ? { ...srv, ...existing } : srv);
          }
          setGames(Array.from(byId.values()));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getCustomGames()
      .then((res) => {
        if (Array.isArray(res?.customGames) && res.customGames.length > 0) {
          setCustomGames((prev) => {
            const merged = new Map<string, CustomGameDefinition>();
            for (const g of prev) merged.set(g.id, g);
            for (const g of res.customGames as CustomGameDefinition[]) {
              merged.set(g.id, g);
              upsertLocalCustomGame(g);
            }
            return Array.from(merged.values());
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeRobloxLaunch || hubMode !== 'play') return;
    let cancelled = false;
    const refreshStats = () => {
      api
        .getWorldServersSummary()
        .then((res) => {
          if (!cancelled && res?.servers) setServerStats(res.servers);
        })
        .catch(() => {});
    };
    refreshStats();
    const timer = window.setInterval(refreshStats, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeRobloxLaunch, hubMode]);

  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const catFiltered =
      activeCategory === 'all'
        ? games
        : activeCategory === 'multiplayer' || activeCategory === 'social'
        ? games.filter((g) => g.id === 'live_spy')
        : games.filter((g) => g.category === activeCategory);

    if (!q) return catFiltered;
    return catFiltered.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.subtitle || '').toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q) ||
        (g.tagline || '').toLowerCase().includes(q)
    );
  }, [activeCategory, games, searchQuery]);

  const filteredCustomGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customGames;
    return customGames.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
    );
  }, [customGames, searchQuery]);

  const topPickUltraWorld =
    !searchQuery.trim() && activeCategory === 'all'
      ? filteredGames.find((g) => g.id === 'sky_citadel') || null
      : null;

  const squidGame = filteredGames.find((g) => g.id === 'squid_game') || null;
  const otherRobloxGames = filteredGames.filter(
    (g) =>
      g.id !== 'squid_game' &&
      g.id !== 'live_spy' &&
      g.id !== topPickUltraWorld?.id &&
      ROBLOX_WORLD_ID_SET.has(g.id)
  );
  const liveSpyGame = filteredGames.find((g) => g.id === 'live_spy') || null;

  const formatServerLabel = (worldId: string) => {
    const stat = serverStats[worldId];
    if (!stat || stat.activeServers === 0 || !stat.rooms || stat.rooms.length === 0) {
      return 'Server #1 · 0/25 Open';
    }
    const openRoom =
      stat.rooms.find((r) => r.players < stat.maxPerRoom) || stat.rooms[stat.rooms.length - 1];
    return `${stat.activeServers} Server${stat.activeServers > 1 ? 's' : ''} · S#${
      openRoom.serverNumber
    } (${openRoom.players}/25)`;
  };

  const handlePlayLiveSpy = () => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setActiveLiveSpyCapacity(selectedCapacity);
  };

  const handleLaunchRobloxWorld = (worldId: RobloxWorldId, squidStage?: SquidStageId) => {
    setActiveRobloxLaunch({ worldId, squidStage });
  };

  const handleLaunchCustomGame = (def: CustomGameDefinition) => {
    setActiveRobloxLaunch({ worldId: def.id, customGameDef: def });
  };

  const handleDeleteCustomGame = async (id: string) => {
    const next = removeLocalCustomGame(id);
    setCustomGames(next);
    if (currentUser) {
      api.deleteCustomGame(id).catch(() => {});
    }
  };

  const handleUpdateAvatar = (next: RobloxAvatarConfig) => {
    setAvatarConfig(next);
    saveRobloxAvatar(next);
  };

  // Active 3D Game Stage (Built-in OR User-Created Studio Game)
  if (activeRobloxLaunch) {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 z-50 bg-[#070a12] text-slate-100 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="text-sm font-black tracking-wide text-slate-100">
              Joining 25-Player Server...
            </p>
          </div>
        }
      >
        <LazyRobloxGameStage
          worldId={activeRobloxLaunch.worldId}
          customGameDef={activeRobloxLaunch.customGameDef}
          initialSquidStage={activeRobloxLaunch.squidStage}
          currentUser={currentUser}
          sendWsEvent={sendWsEvent}
          subscribeSpyEvents={subscribeSpyEvents}
          onExit={() => setActiveRobloxLaunch(null)}
        />
      </Suspense>
    );
  }

  // Active Live Spy Multiplayer Lounge
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

  // Active 3D Game Creator Studio ("গেম তৈরি করুন")
  if (hubMode === 'studio') {
    return (
      <Suspense
        fallback={
          <div className="w-full max-w-6xl mx-auto px-4 py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="text-sm font-bold text-[var(--text-secondary)]">Loading 3D Game Studio...</p>
          </div>
        }
      >
        <LazyGameCreatorStudio
          initialDefinition={editingCustomGame}
          currentUser={currentUser}
          onBack={() => {
            setEditingCustomGame(null);
            setHubMode('portal');
          }}
          onRunAndPlay={(def) => handleLaunchCustomGame(def)}
          onPublished={(def) => {
            setCustomGames((prev) => {
              const idx = prev.findIndex((g) => g.id === def.id);
              return idx >= 0 ? prev.map((g, i) => (i === idx ? def : g)) : [def, ...prev];
            });
          }}
        />
      </Suspense>
    );
  }

  // =========================================================================
  // ENTRY VIEW ON GAME ICON CLICK: TWO-BOX PORTAL ("গেম খেলুন" & "গেম তৈরি করুন")
  // =========================================================================
  if (hubMode === 'portal') {
    const totalPlayableCount = ROBLOX_WORLD_REGISTRY.length + 1 + customGames.length;
    return (
      <div
        data-testid="games-hub-portal"
        className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-5 space-y-6 pb-24"
      >
        {showAvatarModal && (
          <AvatarCustomizerModal
            config={avatarConfig}
            onChange={handleUpdateAvatar}
            onClose={() => setShowAvatarModal(false)}
          />
        )}

        {/* Portal Header */}
        <div className="ml-glass rounded-2xl p-3.5 sm:p-4 border border-[var(--border-subtle)] flex items-center justify-between gap-3">
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

            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center shrink-0">
              <BmGamesIcon className="w-6 h-6" />
            </div>

            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-black tracking-tight text-[var(--text-primary)] truncate">
                BM GAMES · 3D WORLD PLATFORM
              </h1>
              <p className="text-[11px] sm:text-xs font-medium text-[var(--text-secondary)] truncate">
                খেলুন অথবা নিজেই তৈরি করুন আল্ট্রা প্রোম্যাক্স ৩ডি গেম (২৫ প্লেয়ার সার্ভার)
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="hub-avatar-customizer-btn"
            onClick={() => setShowAvatarModal(true)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[var(--accent-primary-soft)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] border border-[var(--accent-primary-border)] text-xs font-black text-[var(--accent-primary)] flex items-center gap-1.5 shrink-0 transition-all"
          >
            <UserCog className="w-4 h-4" />
            <span className="hidden sm:inline">ক্যারেক্টার</span>
          </button>
        </div>

        {/* Two Prominent Interactive Boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* BOX 1: গেম খেলুন */}
          <button
            type="button"
            data-testid="portal-box-play"
            onClick={() => setHubMode('play')}
            className="group text-left rounded-3xl overflow-hidden border border-emerald-400/40 bg-gradient-to-br from-[#0b1f2a] via-[#102937] to-[#08121b] text-slate-100 shadow-2xl hover:border-emerald-400 hover:-translate-y-0.5 transition-all flex flex-col justify-between"
          >
            <div className="relative h-56 sm:h-64 w-full bg-[#07111a] overflow-hidden">
              <img
                src={PORTAL_PLAY_THUMBNAIL}
                alt="গেম খেলুন - 3D Games Arena"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08121b] via-[#08121b]/20 to-transparent" />
              <div className="absolute top-3.5 left-3.5 px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-black shadow">
                {totalPlayableCount} 3D WORLDS · 25/SERVER
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-3 w-full">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  গেম খেলুন
                </h2>
                <span className="w-11 h-11 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg group-hover:bg-emerald-400 transition-colors shrink-0">
                  <Play className="w-5 h-5 fill-current" />
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Aether Sky Citadel, Cyber Velocity 2099, Obsidian Volcano, Ocean Odyssey, Squid Game Season 1 এবং আপনার তৈরি সকল ৩ডি গেম খেলুন!
              </p>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-black text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" /> ভয়েস + মেসেজ + 1P/3P
                </span>
                <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>খেলতে ঢুকুন</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </button>

          {/* BOX 2: গেম তৈরি করুন */}
          <button
            type="button"
            data-testid="portal-box-create"
            onClick={() => {
              setEditingCustomGame(null);
              setHubMode('studio');
            }}
            className="group text-left rounded-3xl overflow-hidden border border-amber-400/40 bg-gradient-to-br from-[#231426] via-[#201936] to-[#0b101d] text-slate-100 shadow-2xl hover:border-amber-400 hover:-translate-y-0.5 transition-all flex flex-col justify-between"
          >
            <div className="relative h-56 sm:h-64 w-full bg-[#120d1d] overflow-hidden">
              <img
                src={CUSTOM_GAME_THUMBNAIL}
                alt="গেম তৈরি করুন - 3D Creator Studio"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b101d] via-[#0b101d]/20 to-transparent" />
              <div className="absolute top-3.5 left-3.5 px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black shadow">
                3D CREATOR STUDIO · BUILD & PLAY
              </div>
            </div>

            <div className="p-5 sm:p-6 space-y-3 w-full">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  গেম তৈরি করুন
                </h2>
                <span className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg group-hover:bg-amber-300 transition-colors shrink-0">
                  <Hammer className="w-5 h-5" />
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                মার্বেল প্ল্যাটফর্ম, নিয়ন ব্রিজ, ক্রিস্টাল, গাছ, লেজার ও বিজয় পোর্টাল সাজিয়ে নিজের ৩ডি গেম তৈরি করুন, সরাসরি চালিয়ে দেখুন ও প্রকাশ করুন!
              </p>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-black text-amber-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> সেভ করা গেম: {customGames.length}টি
                </span>
                <span className="inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>স্টুডিও খুলুন</span>
                  <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PLAY HUB ("গেম খেলুন" — ALL 15 BUILT-IN 3D WORLDS + CUSTOM GAMES + LIVE SPY)
  // =========================================================================
  return (
    <div
      data-testid="games-hub-view"
      className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-5 pb-24"
    >
      {/* Avatar Editor Modal */}
      {showAvatarModal && (
        <AvatarCustomizerModal
          config={avatarConfig}
          onChange={handleUpdateAvatar}
          onClose={() => setShowAvatarModal(false)}
        />
      )}

      {/* Roblox-Style Platform Launcher Header */}
      <div className="ml-glass rounded-2xl p-3.5 sm:p-4 border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              data-testid="games-hub-back-btn"
              onClick={() => setHubMode('portal')}
              className="w-10 h-10 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-primary)] shrink-0 transition-colors"
              aria-label="Back to Games Portal"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 rounded-2xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center shrink-0">
              <BmGamesIcon className="w-6 h-6" />
            </div>

            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-black tracking-tight text-[var(--text-primary)] truncate">
                গেম খেলুন · BM 3D ARENA
              </h1>
              <p className="text-[11px] sm:text-xs font-medium text-[var(--text-secondary)] truncate flex items-center gap-2">
                <span>25 Players/Server Auto-Match</span>
                <span className="inline-flex items-center gap-1 text-emerald-500 font-bold">
                  <Mic className="w-3 h-3" /> ভয়েস
                </span>
                <span className="inline-flex items-center gap-1 text-sky-400 font-bold">
                  <MessageSquare className="w-3 h-3" /> মেসেজ
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Experiences Input */}
            <div className="flex-1 sm:w-52 h-10 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] px-3 flex items-center gap-2">
              <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 3D games..."
                className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
              />
            </div>

            <button
              type="button"
              data-testid="hub-open-studio-btn"
              onClick={() => {
                setEditingCustomGame(null);
                setHubMode('studio');
              }}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1 shrink-0 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden md:inline">গেম তৈরি করুন</span>
            </button>

            <button
              type="button"
              data-testid="hub-avatar-customizer-btn"
              onClick={() => setShowAvatarModal(true)}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-[var(--accent-primary-soft)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-primary-contrast)] border border-[var(--accent-primary-border)] text-xs font-black text-[var(--accent-primary)] flex items-center gap-1.5 shrink-0 transition-all"
            >
              <UserCog className="w-4 h-4" />
              <span className="hidden lg:inline">ক্যারেক্টার</span>
            </button>
          </div>
        </div>
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

      {/* USER-CREATED STUDIO WORLDS SECTION */}
      {filteredCustomGames.length > 0 && activeCategory === 'all' && (
        <section data-testid="custom-games-section" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-black text-[var(--text-primary)] flex items-center gap-2">
              <Hammer className="w-4 h-4 text-amber-400" />
              <span>আপনার ও কমিউনিটির তৈরি গেম ({filteredCustomGames.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setEditingCustomGame(null);
                setHubMode('studio');
              }}
              className="text-xs font-black text-amber-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>নতুন তৈরি করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomGames.map((cg) => (
              <article
                key={cg.id}
                data-testid={`custom-game-card-${cg.id}`}
                className="ml-glass rounded-3xl overflow-hidden border border-amber-400/35 flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="relative h-36 bg-[#0b101b] overflow-hidden">
                    <img
                      src={CUSTOM_GAME_THUMBNAIL}
                      alt={cg.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black">
                      USER STUDIO · {cg.objects.length} OBJECTS
                    </span>
                    <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-[#0d1322]/90 border border-teal-400/35 text-[10px] font-black text-teal-300">
                      {formatServerLabel(cg.id)}
                    </span>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <h3 className="text-base font-black text-[var(--text-primary)] truncate">{cg.title}</h3>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {cg.description || 'কাস্টম থ্রিডি ওয়ার্ল্ড — ২৫ প্লেয়ার সার্ভারে খেলুন!'}
                    </p>
                    <p className="text-[11px] font-bold text-amber-400">
                      by {cg.creatorName || 'Creator'} · Biome: {cg.biome}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCustomGame(cg);
                        setHubMode('studio');
                      }}
                      className="p-2 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-amber-400"
                      title="Edit in Studio"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomGame(cg.id)}
                      className="p-2 rounded-xl bg-rose-500/15 border border-rose-400/30 text-rose-400 hover:bg-rose-500/25"
                      title="Delete Custom Game"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    data-testid={`play-custom-${cg.id}`}
                    onClick={() => handleLaunchCustomGame(cg)}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>PLAY NOW</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* NEW ULTRA PRO MAX TOP PICK HERO: AETHER SKY CITADEL */}
      {topPickUltraWorld && (
        <section
          data-testid="sky-citadel-featured-card"
          className="rounded-3xl overflow-hidden border border-sky-400/40 bg-gradient-to-br from-[#0e1e36] via-[#132946] to-[#0a1322] text-slate-100 shadow-2xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="lg:col-span-6 relative min-h-[220px] sm:min-h-[260px] bg-[#0b1322] overflow-hidden">
              {!failedImages['sky_citadel'] ? (
                <img
                  src={ROBLOX_GAME_THUMBNAILS.sky_citadel}
                  alt={topPickUltraWorld.name}
                  onError={() => setFailedImages((p) => ({ ...p, sky_citadel: true }))}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-sky-950">
                  <Gamepad2 className="w-16 h-16 text-sky-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b1322]/90 via-transparent to-black/25" />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-[11px] font-black shadow">
                NEW ULTRA PRO MAX · PBR 3D
              </div>
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-[#0d1322]/90 border border-teal-400/40 text-[11px] font-black text-teal-300 flex items-center gap-1">
                <Server className="w-3 h-3" />
                <span>{formatServerLabel('sky_citadel')}</span>
              </div>
            </div>

            <div className="lg:col-span-6 p-4 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-2.5">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {topPickUltraWorld.name}
                </h2>
                {topPickUltraWorld.subtitle && (
                  <p className="text-xs sm:text-sm font-bold text-sky-300">
                    {topPickUltraWorld.subtitle}
                  </p>
                )}
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  {topPickUltraWorld.description}
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-bold text-amber-300">
                  {(topPickUltraWorld.features || []).map((f) => (
                    <span key={f} className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>25 Players / Room · Voice + Chat Built-In</span>
                </span>
                <button
                  type="button"
                  data-testid="play-roblox-sky_citadel"
                  onClick={() => handleLaunchRobloxWorld('sky_citadel')}
                  className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black tracking-wide flex items-center gap-2 shadow-lg active:scale-95 transition-all shrink-0"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>PLAY NOW</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FLAGSHIP FEATURED GAME: SQUID GAME SEASON 1 ONLY */}
      {squidGame && (
        <section
          data-testid="squid-game-featured-card"
          className="rounded-3xl overflow-hidden border border-rose-500/40 bg-gradient-to-br from-[#130b14] via-[#171222] to-[#0a1019] text-slate-100 shadow-2xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Hero Visual */}
            <div className="lg:col-span-5 relative min-h-[240px] sm:min-h-[290px] bg-[#090c14] overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
              {!failedImages['squid_game'] ? (
                <img
                  src={ROBLOX_GAME_THUMBNAILS.squid_game}
                  alt="Squid Game Season 1 3D Arena"
                  onError={() => setFailedImages((prev) => ({ ...prev, squid_game: true }))}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-950 to-slate-950 p-6">
                  <Gamepad2 className="w-16 h-16 text-rose-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a12] via-transparent to-black/30" />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-rose-600 text-[11px] font-black text-white shadow">
                SEASON 1 ONLY · 6 FULL GAMES
              </div>
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-[#0d1322]/90 border border-teal-400/40 text-[11px] font-black text-teal-300 flex items-center gap-1">
                <Server className="w-3 h-3" />
                <span>{formatServerLabel('squid_game')}</span>
              </div>
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2 text-xs font-bold text-slate-100">
                <span>25 Players / Server · Auto Room #2 on Full</span>
              </div>
            </div>

            {/* Season 1 Info + Direct 6-Stage Launcher */}
            <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                      {squidGame.name}
                    </h2>
                    <span className="text-xs font-extrabold text-amber-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{squidGame.estimatedSession || '30–60 Mins'} · 25/Room</span>
                    </span>
                  </div>
                  {squidGame.subtitle && (
                    <p className="text-xs sm:text-sm font-bold text-rose-300 mt-0.5">
                      {squidGame.subtitle}
                    </p>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {squidGame.description}
                </p>

                {/* Season 1 Stages Only */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-rose-400" />
                      <span>সিজন ১-এর ৬টি পূর্ণাঙ্গ স্টেজ:</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {SQUID_STAGES.map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        data-testid={`launch-squid-${stage.id}`}
                        onClick={() => handleLaunchRobloxWorld('squid_game', stage.id)}
                        className="text-left p-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-400/50 transition-all group"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-black text-white truncate">
                            {stage.episodeNum}. {stage.title}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-rose-300 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                        <p className="text-[11px] font-bold text-amber-300 truncate">{stage.bnTitle}</p>
                        <p className="text-[10px] text-slate-300 mt-0.5 line-clamp-1">{stage.ruleSummary}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-teal-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 shrink-0" />
                  <span>প্রতি সার্ভারে ২৫ জন একসাথে · ২৬তম প্লেয়ারে অটো সার্ভার #২</span>
                </p>

                <button
                  type="button"
                  data-testid="squid-play-campaign-btn"
                  onClick={() => handleLaunchRobloxWorld('squid_game', 's1_red_light')}
                  className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-black tracking-wide flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all shrink-0"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>PLAY SEASON 1</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ALL 25-PLAYER 3D ROBLOX & ULTRA PRO MAX EXPERIENCES GRID */}
      {otherRobloxGames.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm sm:text-base font-black text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent-gold)]" />
              <span>সকল আল্ট্রা প্রোম্যাক্স ও ২৫-প্লেয়ার ৩ডি ওয়ার্ল্ড</span>
            </h2>
            <span className="text-xs font-bold text-[var(--text-secondary)]">
              {otherRobloxGames.length} Worlds
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherRobloxGames.map((game) => {
              const worldId = game.id as RobloxWorldId;
              const thumb = ROBLOX_GAME_THUMBNAILS[worldId];
              return (
                <article
                  key={game.id}
                  data-testid={`roblox-card-${game.id}`}
                  className="ml-glass rounded-3xl overflow-hidden border border-[var(--border-subtle)] flex flex-col justify-between shadow-lg hover:border-[var(--accent-primary-border)] transition-all"
                >
                  <div>
                    <div className="relative h-44 bg-[#0b101b] overflow-hidden">
                      {!failedImages[game.id] && thumb ? (
                        <img
                          src={thumb}
                          alt={game.name}
                          onError={() => setFailedImages((prev) => ({ ...prev, [game.id]: true }))}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                          <Gamepad2 className="w-12 h-12 text-amber-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-[#0d1322]/90 border border-white/15 text-[10px] font-black text-amber-300">
                        {game.badge}
                      </span>
                      <span className="absolute bottom-2.5 left-2.5 px-2.5 py-0.5 rounded-lg bg-[#0d1322]/90 border border-teal-400/35 text-[10px] font-black text-teal-300 flex items-center gap-1">
                        <Server className="w-3 h-3" />
                        <span>{formatServerLabel(game.id)}</span>
                      </span>
                    </div>

                    <div className="p-4 space-y-2">
                      <div>
                        <h3 className="text-base font-black text-[var(--text-primary)] leading-tight">
                          {game.name}
                        </h3>
                        {game.subtitle && (
                          <p className="text-xs font-bold text-[var(--accent-primary)] mt-0.5">
                            {game.subtitle}
                          </p>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-[var(--text-secondary)]">
                        {[game.difficulty, game.estimatedSession || '30–60 Mins', '25/Server']
                          .filter(Boolean)
                          .join(' · ')}
                      </p>

                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {game.description}
                      </p>

                      {game.features && game.features.length > 0 && (
                        <p className="text-[11px] font-bold text-[var(--text-primary)] pt-1">
                          {game.features.join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-4 pb-4 pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-teal-500 dark:text-teal-300 truncate flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span>25 Players / Room</span>
                    </span>
                    <button
                      type="button"
                      data-testid={`play-roblox-${game.id}`}
                      onClick={() => handleLaunchRobloxWorld(worldId)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-black flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>JOIN SERVER</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* PRESERVED FEATURED LIVE SPY MULTIPLAYER CARD */}
      {liveSpyGame && (
        <section
          data-testid="live-spy-featured-card"
          className="rounded-3xl overflow-hidden border border-[var(--accent-primary-border)] bg-gradient-to-br from-[#0e1726] via-[#101c2d] to-[#0a1019] text-slate-100 shadow-2xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* 3D Private Lounge Visual Preview */}
            <div className="lg:col-span-5 relative min-h-[220px] sm:min-h-[250px] bg-[#0b1018] overflow-hidden flex items-center justify-center p-4 border-b lg:border-b-0 lg:border-r border-white/10">
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

                {[38, 62, 86, 314, 338, 362].map((x) => (
                  <rect key={x} x={x} y="18" width="8" height="175" rx="3" fill="#2B1D14" opacity="0.7" />
                ))}

                <rect x="115" y="24" width="170" height="72" rx="8" fill="url(#screen_grad)" stroke="#14B8A6" strokeWidth="2" />
                <text x="200" y="51" textAnchor="middle" fill="#14B8A6" fontSize="10" fontWeight="800">
                  MOTHERLAND LOUNGE
                </text>
                <text x="200" y="72" textAnchor="middle" fill="#F8FAFC" fontSize="17" fontWeight="900">
                  LIVE SPY · 3D
                </text>
                <rect x="166" y="80" width="68" height="10" rx="4" fill="#F59E0B" opacity="0.85" />

                <ellipse cx="200" cy="196" rx="108" ry="38" fill="#422618" stroke="#D97706" strokeWidth="2.5" />
                <ellipse cx="200" cy="196" rx="44" ry="15" fill="none" stroke="#14B8A6" strokeWidth="1.5" opacity="0.8" />
                <circle cx="200" cy="186" r="10" fill="#FFB86C" opacity="0.95" />

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
            </div>

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
    </div>
  );
};
