import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Clock,
  Trash2,
  Play,
  Film,
  Image as ImageIcon,
  Youtube,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  User,
  Flame,
  CheckCircle2,
  UserPlus,
  UserCheck,
  Loader2,
} from 'lucide-react';
import { SocialPost } from '../../types/social';
import { universalSearch, fetchSearchSuggestions, toggleUserFollow, getStoredCurrentUser } from '../../services/socialService';
import { UnifiedVideo } from '../../types/video';
import { FireRichText } from '../fire/FireRichText';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo?: (video: UnifiedVideo) => void;
  onSelectPost?: (post: SocialPost) => void;
  onSelectUser?: (userId: string) => void;
}

export type SearchCategoryFilter = 'all' | 'videos' | 'shorts' | 'people' | 'posts' | 'youtube';

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
  onSelectPost,
  onSelectUser,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategoryFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('motherland_recent_searches_v5');
      return saved ? JSON.parse(saved) : ['Bangladesh beautiful places', 'Coke Studio Bangla', 'Sajek Valley', 'Cricket match highlights'];
    } catch {
      return ['Bangladesh beautiful places', 'Coke Studio Bangla', 'Sajek Valley', 'Cricket match highlights'];
    }
  });

  // Search Results
  const [usersResults, setUsersResults] = useState<any[]>([]);
  const [postsResults, setPostsResults] = useState<SocialPost[]>([]);
  const [shortsResults, setShortsResults] = useState<any[]>([]);
  const [motherlandVideos, setMotherlandVideos] = useState<any[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<any[]>([]);
  const [activePreviewVideo, setActivePreviewVideo] = useState<any | null>(null);
  const [supportedUsersMap, setSupportedUsersMap] = useState<Record<string, boolean>>({});
  const [hoveredSupportId, setHoveredSupportId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Fetch Autocomplete Suggestions as user types
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const list = await fetchSearchSuggestions(query);
      setSuggestions(list);
    }, 150);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query]);

  // Trigger Full Universal Search
  const performSearch = async (term: string) => {
    const q = term.trim();
    if (!q) return;

    setIsLoading(true);
    setSuggestions([]);

    // Save to recents
    setRecentSearches((prev) => {
      const updated = [q, ...prev.filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 8);
      try {
        localStorage.setItem('motherland_recent_searches_v5', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    try {
      const data = await universalSearch(q);
      setUsersResults(data.users || []);
      setPostsResults(data.posts || []);
      setShortsResults(data.shorts || []);
      setMotherlandVideos(data.motherlandVideos || []);
      setYoutubeResults(data.youtubeVideos || []);
    } catch (err) {
      console.warn('Search execution warning:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleSelectSuggestion = (text: string) => {
    setQuery(text);
    performSearch(text);
  };

  const clearRecent = (term: string) => {
    const updated = recentSearches.filter((t) => t !== term);
    setRecentSearches(updated);
    try {
      localStorage.setItem('motherland_recent_searches_v5', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#0e1423] border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col overflow-hidden mt-2 sm:mt-6">
        {/* Header & Single Universal Search Input */}
        <div className="flex items-center gap-2 pb-3 border-b border-white/10">
          <form onSubmit={handleSubmit} className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search YouTube, MOTHERLAND videos, shorts, people, posts..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-[#141b2d] border border-white/10 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 shadow-inner transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSuggestions([]);
                }}
                className="absolute right-3 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>

          <button
            onClick={() => performSearch(query)}
            className="px-3.5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <span>Search</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Autocomplete Suggestions Dropdown (Section 11 Requirement) */}
        {suggestions.length > 0 && (
          <div className="p-2 my-2 rounded-2xl bg-[#131b2e] border border-emerald-500/30 space-y-1 shadow-xl">
            <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider px-2 block">
              ⚡ Suggested Search Terms
            </span>
            {suggestions.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectSuggestion(sug)}
                className="w-full text-left px-3 py-1.5 rounded-xl hover:bg-white/5 text-xs text-slate-200 hover:text-emerald-300 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span>{sug}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            ))}
          </div>
        )}

        {/* Category Filters Bar */}
        <div className="flex items-center gap-1.5 py-2 overflow-x-auto no-scrollbar border-b border-white/5">
          {(
            [
              { id: 'all', label: '🔥 All Results' },
              { id: 'videos', label: '🎬 Videos' },
              { id: 'shorts', label: '⚡ Shorts' },
              { id: 'people', label: '👥 People' },
              { id: 'posts', label: '📝 Posts' },
              { id: 'youtube', label: '🔴 YouTube' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div className="overflow-y-auto flex-1 mt-3 space-y-5 pr-1">
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs text-slate-400">Searching across MOTHERLAND &amp; YouTube networks...</p>
            </div>
          )}

          {/* If no search performed yet, show Recent Searches & Popular Topics */}
          {!isLoading && !query.trim() && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Recent Searches</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-slate-200 transition-colors"
                    >
                      <button onClick={() => handleSelectSuggestion(term)} className="hover:text-emerald-300">
                        {term}
                      </button>
                      <button
                        onClick={() => clearRecent(term)}
                        className="text-slate-500 hover:text-slate-300 ml-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Popular in Bangladesh</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    'Bangladesh beautiful places',
                    'Coke Studio Bangla top songs',
                    'Sajek Valley clouds 4K',
                    'Bangladesh Cricket Tigers highlights',
                    'Sundarbans documentary',
                    'Coxs Bazar sea beach surfing',
                  ].map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectSuggestion(topic)}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-left text-slate-300 hover:text-emerald-300 flex items-center justify-between transition-colors border border-white/5"
                    >
                      <span>{topic}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Results Display */}
          {!isLoading && query.trim() && (
            <div className="space-y-6">
              {/* 1. PEOPLE / PROFILES (Section 11) */}
              {(activeCategory === 'all' || activeCategory === 'people') && usersResults.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    <span>People &amp; Profiles ({usersResults.length})</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {usersResults.map((u) => (
                      <div
                        key={u.id}
                        className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div
                          onClick={() => {
                            if (onSelectUser) onSelectUser(u.id);
                          }}
                          className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                        >
                          <div className="w-10 h-10 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center overflow-hidden flex-shrink-0 text-white font-bold">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{u.name.slice(0, 1)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-xs text-white truncate block hover:text-emerald-300">
                              {u.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block truncate">
                              {u.handle}
                            </span>
                            {u.bio && (
                              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                <FireRichText text={u.bio} emojiSize="xs" />
                              </p>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const current = getStoredCurrentUser();
                          if (current?.id === u.id) return null;
                          const isSupporting = Boolean(supportedUsersMap[u.id] ?? u.isFollowing);
                          const isHovered = hoveredSupportId === u.id;
                          return (
                            <button
                              onClick={async () => {
                                const res = await toggleUserFollow(u.id);
                                setSupportedUsersMap((prev) => ({
                                  ...prev,
                                  [u.id]: res.isFollowing,
                                }));
                              }}
                              onMouseEnter={() => setHoveredSupportId(u.id)}
                              onMouseLeave={() => setHoveredSupportId(null)}
                              className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold transition-all flex items-center gap-1 flex-shrink-0 ${
                                isSupporting
                                  ? isHovered
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-white/10 text-emerald-300 border-emerald-500/40'
                                  : 'bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/40'
                              }`}
                            >
                              {isSupporting ? (
                                <>
                                  <UserCheck className="w-3 h-3" />
                                  <span>{isHovered ? 'Stop Supporting' : 'Supporting'}</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus className="w-3 h-3" />
                                  <span>Support</span>
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. SHORTS (Section 11) */}
              {(activeCategory === 'all' || activeCategory === 'shorts') && shortsResults.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Flame className="w-4 h-4" />
                    <span>Shorts Videos ({shortsResults.length})</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {shortsResults.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (s.media?.[0]?.url) {
                            setActivePreviewVideo({
                              title: s.content,
                              embedUrl: s.media[0].url,
                              isDirectVideo: true,
                            });
                          }
                        }}
                        className="aspect-[9/16] rounded-2xl bg-black border border-white/10 overflow-hidden relative group cursor-pointer shadow-lg"
                      >
                        {s.media?.[0]?.thumbnailUrl ? (
                          <img
                            src={s.media[0].thumbnailUrl}
                            alt={s.content}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900">
                            <Flame className="w-8 h-8 text-rose-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-2 left-2 right-2 text-white">
                          <p className="text-[10px] font-bold line-clamp-2">
                            <FireRichText text={s.content} emojiSize="xs" />
                          </p>
                          <span className="text-[9px] text-slate-300 mt-1 block">
                            {s.author.name}
                          </span>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-9 h-9 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg">
                            <Play className="w-4 h-4 ml-0.5 fill-current" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. YOUTUBE & LONG VIDEOS (Section 11) */}
              {(activeCategory === 'all' || activeCategory === 'videos' || activeCategory === 'youtube') &&
                youtubeResults.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Youtube className="w-4 h-4" />
                      <span>YouTube Videos ({youtubeResults.length})</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {youtubeResults.map((video) => (
                        <div
                          key={video.id}
                          onClick={() => {
                            if (onSelectVideo) {
                              onSelectVideo(video);
                              onClose();
                            } else {
                              setActivePreviewVideo(video);
                            }
                          }}
                          className="rounded-2xl bg-[#111726] hover:bg-[#162035] border border-white/5 overflow-hidden cursor-pointer transition-all flex flex-col group shadow-lg"
                        >
                          <div className="aspect-video bg-black relative overflow-hidden">
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                                <Play className="w-5 h-5 ml-0.5 fill-current" />
                              </div>
                            </div>
                            {video.duration && (
                              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/85 font-mono text-[10px] text-white">
                                {video.duration}
                              </span>
                            )}
                          </div>

                          <div className="p-3 flex-1 flex flex-col justify-between">
                            <h5 className="font-bold text-xs text-white group-hover:text-red-400 transition-colors line-clamp-2">
                              {video.title}
                            </h5>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                              <span className="truncate max-w-[150px]">{video.creatorName}</span>
                              <span className="font-mono text-[10px] text-emerald-400">
                                {video.duration || 'YouTube'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 4. POSTS (Section 11) */}
              {(activeCategory === 'all' || activeCategory === 'posts') && postsResults.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>MOTHERLAND Posts ({postsResults.length})</span>
                  </h4>
                  <div className="space-y-2.5">
                    {postsResults.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => {
                          if (onSelectPost) {
                            onSelectPost(post);
                            onClose();
                          }
                        }}
                        className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 cursor-pointer transition-all flex items-start gap-3"
                      >
                        <div className="w-9 h-9 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center overflow-hidden flex-shrink-0 text-white font-bold text-xs">
                          {post.author.avatar ? (
                            <img src={post.author.avatar} alt={post.author.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{post.author.name.slice(0, 1)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white">{post.author.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{post.author.handle}</span>
                          </div>
                          <p className="text-xs text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                            <FireRichText text={post.content} emojiSize="xs" />
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {usersResults.length === 0 &&
                postsResults.length === 0 &&
                shortsResults.length === 0 &&
                youtubeResults.length === 0 && (
                  <div className="py-16 text-center space-y-2">
                    <p className="text-slate-300 font-semibold text-sm">
                      No matching results found for &quot;{query}&quot;
                    </p>
                    <p className="text-xs text-slate-500">
                      Try searching broader terms like &quot;Bangladesh&quot;, &quot;Music&quot;, &quot;Dhaka&quot;, or &quot;Travel&quot;.
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* In-Modal Playback Preview */}
        {activePreviewVideo && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/95">
            <div className="w-full max-w-2xl bg-[#0c101d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="font-bold text-xs text-white truncate max-w-md">
                  {activePreviewVideo.title}
                </span>
                <button
                  onClick={() => setActivePreviewVideo(null)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="aspect-video bg-black flex items-center justify-center">
                {activePreviewVideo.isDirectVideo ? (
                  <video
                    src={activePreviewVideo.embedUrl}
                    controls
                    autoPlay
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <iframe
                    src={activePreviewVideo.embedUrl}
                    title={activePreviewVideo.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
