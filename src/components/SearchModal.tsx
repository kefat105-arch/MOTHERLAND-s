import React, { useEffect, useState } from 'react';
import { Search, X, Play, Flame, Users, Loader2, Film, Shield, Youtube } from 'lucide-react';
import { api } from '../api';
import type { LongVideo, Post, ShortVideo, UserProfile } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWatchVideo: (video: LongVideo) => void;
  onOpenShortsPlayer: (list: ShortVideo[], startIndex: number) => void;
  onOpenCreator: (user: UserProfile) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onWatchVideo,
  onOpenShortsPlayer,
  onOpenCreator,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'videos' | 'shorts' | 'people'>('all');
  const [loading, setLoading] = useState(false);

  const [videos, setVideos] = useState<LongVideo[]>([]);
  const [shorts, setShorts] = useState<ShortVideo[]>([]);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  useBackHandler('universal-search-modal', isOpen, onClose, 66);

  useEffect(() => {
    if (!isOpen) return;
    const clean = query.trim();
    if (!clean) {
      setVideos([]);
      setShorts([]);
      setPeople([]);
      setPosts([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const lower = clean.toLowerCase();
        // Include watched videos in intentional search so users can revisit them
        const [ytRes, localLongRes, localShortsRes, usersRes, postsRes] = await Promise.all([
          api.searchYouTube(clean, '', 14).catch(() => ({ items: [] })),
          api.getLongVideos(true).catch(() => ({ videos: [] })),
          api.getShorts(true).catch(() => ({ shorts: [] })),
          api.searchUsers(clean).catch(() => ({ users: [] })),
          api.getPosts('motherland', 'motherland', 1, 20).catch(() => ({ posts: [] })),
        ]);

        const matchedLocalLong = (localLongRes.videos || []).filter(
          (v) =>
            v.title.toLowerCase().includes(lower) ||
            v.description?.toLowerCase().includes(lower) ||
            v.channel?.title?.toLowerCase().includes(lower)
        );
        const ytMapped: LongVideo[] = (ytRes.items || []).map((item: any) => ({
          id: item.id,
          source: 'youtube',
          youtubeId: item.youtubeId,
          thumbnailUrl: item.thumbnailUrl,
          title: item.title,
          description: item.description || '',
          duration: item.duration || '0:00',
          channel: item.channel,
          stats: item.stats || { views: 0, likes: 0, comments: 0 },
          publishedAt: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Recently',
        }));

        const matchedShorts = (localShortsRes.shorts || []).filter(
          (s) =>
            s.title.toLowerCase().includes(lower) ||
            s.caption?.toLowerCase().includes(lower) ||
            s.creator?.name?.toLowerCase().includes(lower)
        );

        const matchedPosts = (postsRes.posts || []).filter(
          (p) =>
            p.content.toLowerCase().includes(lower) ||
            p.author.displayName.toLowerCase().includes(lower) ||
            p.author.username.toLowerCase().includes(lower)
        );

        setVideos([...matchedLocalLong, ...ytMapped]);
        setShorts(matchedShorts);
        setPeople(usersRes.users || []);
        setPosts(matchedPosts);
      } finally {
        setLoading(false);
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  const showVideos = activeTab === 'all' || activeTab === 'videos';
  const showShorts = activeTab === 'all' || activeTab === 'shorts';
  const showPeople = activeTab === 'all' || activeTab === 'people';

  return (
    <div
      data-testid="universal-search-modal"
      className="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm flex items-start justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-[92vh] sm:h-[82vh] sm:rounded-3xl ml-glass-elevated border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-3 sm:p-4 border-b border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 h-11 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] focus-within:border-[var(--accent-primary)]">
              <Search className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
              <input
                type="text"
                autoFocus
                data-testid="universal-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search videos, shorts, creators, posts..."
                className="flex-1 bg-transparent text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-3 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
            >
              Close
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'videos', label: 'Videos' },
                { id: 'shorts', label: 'Shorts' },
                { id: 'people', label: 'Creators' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[34px] px-3.5 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === t.id
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)]'
                    : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {!query.trim() ? (
            <div className="py-16 text-center space-y-2 text-xs text-[var(--text-secondary)]">
              <Search className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
              <p className="font-semibold text-[var(--text-primary)]">Search across MOTHERLAND</p>
              <p className="max-w-xs mx-auto">
                Find long videos, Shorts, creators, or revisit previously watched videos anytime.
              </p>
            </div>
          ) : loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
            </div>
          ) : videos.length === 0 && shorts.length === 0 && people.length === 0 && posts.length === 0 ? (
            <div className="py-14 text-center text-xs text-[var(--text-secondary)]">
              No results found for "{query.trim()}".
            </div>
          ) : (
            <>
              {showPeople && people.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Creators ({people.length})</span>
                  </h4>
                  <div className="space-y-1.5">
                    {people.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenCreator(u);
                        }}
                        className="w-full p-2.5 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center gap-3 text-left"
                      >
                        {u.avatar ? (
                          <img src={u.avatar} alt={u.displayName} className="w-10 h-10 rounded-xl object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center text-xs font-bold text-[var(--text-primary)]">
                            {u.displayName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{u.displayName}</p>
                          <p className="text-[11px] text-[var(--text-secondary)] truncate">@{u.username}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {showShorts && shorts.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                    <span>Shorts ({shorts.length})</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {shorts.map((s, idx) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenShortsPlayer(shorts, idx);
                        }}
                        className="rounded-2xl overflow-hidden bg-black border border-[var(--border-subtle)] aspect-[9/16] relative text-left group"
                      >
                        <img src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-[11px] font-bold text-white line-clamp-2">{s.title}</p>
                          <p className="text-[10px] text-white/75 truncate">{s.creator.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {showVideos && videos.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>Videos ({videos.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {videos.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          onClose();
                          onWatchVideo(v);
                        }}
                        className="w-full p-2 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] flex items-center gap-3 text-left"
                      >
                        <div className="relative w-32 aspect-video rounded-xl overflow-hidden bg-black flex-shrink-0">
                          <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-current" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[var(--text-primary)] line-clamp-2">{v.title}</p>
                          <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5 flex items-center gap-1">
                            {v.source === 'youtube' ? (
                              <Youtube className="w-3 h-3 text-red-500 flex-shrink-0" />
                            ) : (
                              <Shield className="w-3 h-3 text-[var(--accent-primary)] flex-shrink-0" />
                            )}
                            <span>{v.channel?.title || 'Unavailable'}</span>
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {activeTab === 'all' && posts.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    Posts ({posts.length})
                  </h4>
                  <div className="space-y-2">
                    {posts.slice(0, 6).map((p) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-xs"
                      >
                        <p className="font-bold text-[var(--text-primary)]">{p.author.displayName}</p>
                        <p className="text-[var(--text-secondary)] line-clamp-2 mt-0.5">{p.content}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
