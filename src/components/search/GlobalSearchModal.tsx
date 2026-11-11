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
} from 'lucide-react';
import { SocialPost } from '../../types/social';
import { getStoredPosts } from '../../services/socialService';
import { searchYouTube } from '../../services/youtubeService';
import { UnifiedVideo } from '../../types/video';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo?: (video: UnifiedVideo) => void;
  onSelectPost?: (post: SocialPost) => void;
}

export type SearchPlatformFilter = 'all' | 'motherland' | 'youtube' | 'tiktok' | 'social';

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
  onSelectPost,
}) => {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<SearchPlatformFilter>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('motherland_recent_searches');
      return saved ? JSON.parse(saved) : ['Coke Studio Bangla', 'Bangladesh travel', 'Dhaka street food'];
    } catch {
      return ['Coke Studio Bangla', 'Bangladesh travel', 'Dhaka street food'];
    }
  });

  const [motherlandResults, setMotherlandResults] = useState<SocialPost[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<UnifiedVideo[]>([]);
  const [activePreviewVideo, setActivePreviewVideo] = useState<UnifiedVideo | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Execute search when query or platform changes
  useEffect(() => {
    if (!isOpen) return;

    if (!query.trim()) {
      setMotherlandResults([]);
      setYoutubeResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);

      const q = query.trim().toLowerCase();

      // 1. Search MOTHERLAND Native Posts
      if (platform === 'all' || platform === 'motherland' || platform === 'social') {
        const posts = getStoredPosts();
        const matched = posts.filter((p) => {
          return (
            p.content.toLowerCase().includes(q) ||
            p.author.name.toLowerCase().includes(q) ||
            p.author.handle.toLowerCase().includes(q) ||
            p.tags?.some((t) => t.toLowerCase().includes(q))
          );
        });
        setMotherlandResults(matched);
      } else {
        setMotherlandResults([]);
      }

      // 2. Search YouTube API v3 (Live Query)
      if (platform === 'all' || platform === 'youtube' || platform === 'tiktok') {
        try {
          const type = platform === 'tiktok' ? 'video' : 'video';
          const ytRes = await searchYouTube({
            query: platform === 'tiktok' ? `${q} shorts #shorts` : q,
            pageSize: 16,
            regionCode: 'BD',
            type,
          });
          setYoutubeResults(ytRes.videos);
        } catch (e) {
          console.warn('YouTube search failed:', e);
          setYoutubeResults([]);
        }
      } else {
        setYoutubeResults([]);
      }

      setIsLoading(false);
    }, 280);

    return () => clearTimeout(timer);
  }, [query, platform, isOpen]);

  const handleSaveRecent = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
    setRecentSearches(updated);
    try {
      localStorage.setItem('motherland_recent_searches', JSON.stringify(updated));
    } catch {}
  };

  const handleSelectRecent = (s: string) => {
    setQuery(s);
    handleSaveRecent(s);
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('motherland_recent_searches');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      handleSaveRecent(query);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="w-full sm:max-w-3xl h-full sm:h-[88vh] sm:max-h-[760px] bg-[#0c101d] sm:border border-white/10 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Search Bar */}
        <div className="p-3 sm:p-4 border-b border-white/10 bg-[#101626] flex items-center gap-3">
          <div className="relative flex-1 flex items-center">
            <Search className="w-5 h-5 absolute left-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search MOTHERLAND community, YouTube, videos, tags..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-11 pr-10 py-3 rounded-2xl bg-[#161e33] border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-hidden focus:border-emerald-500 shadow-inner"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Filter Tabs */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-[#0a0e18] border-b border-white/5 overflow-x-auto no-scrollbar text-xs">
          {[
            { id: 'all', label: 'All Platforms' },
            { id: 'motherland', label: 'MOTHERLAND Community' },
            { id: 'youtube', label: 'YouTube' },
            { id: 'tiktok', label: 'Vertical Shorts' },
            { id: 'social', label: 'Social Feeds' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPlatform(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-semibold transition-all ${
                platform === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Results Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">
          {/* Quick Suggestions & Recents when Query is empty */}
          {!query.trim() && (
            <div className="space-y-5">
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Recent Searches</span>
                    </span>
                    <button
                      onClick={handleClearRecent}
                      className="text-[11px] text-red-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectRecent(s)}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 border border-white/5 flex items-center gap-1.5 transition-colors"
                      >
                        <Search className="w-3 h-3 text-slate-500" />
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Topics in Bangladesh */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Trending in MOTHERLAND & Bangladesh</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    'Coke Studio Bangla',
                    'Cox’s Bazar Beach Drone',
                    'Sundarbans Tiger Safari',
                    'Dhaka Metro Rail',
                    'Kacchi Biryani Recipe',
                    'Sylhet Tea Gardens',
                  ].map((topic, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectRecent(topic)}
                      className="p-2.5 rounded-xl bg-[#141b2c] hover:bg-[#1a233b] border border-white/5 text-left text-xs font-medium text-slate-200 transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{topic}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              <span className="text-xs font-mono">Searching cross-platform network...</span>
            </div>
          )}

          {/* Search Results Display */}
          {!isLoading && query.trim() && (
            <div className="space-y-6">
              {/* 1. Native MOTHERLAND Results */}
              {(platform === 'all' || platform === 'motherland' || platform === 'social') &&
                motherlandResults.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>MOTHERLAND Community Posts ({motherlandResults.length})</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {motherlandResults.map((post) => (
                        <div
                          key={post.id}
                          onClick={() => {
                            if (onSelectPost) onSelectPost(post);
                            onClose();
                          }}
                          className="p-3 rounded-2xl bg-[#111726] hover:bg-[#172036] border border-white/5 cursor-pointer transition-all flex items-start gap-3 group"
                        >
                          <img
                            src={post.author.avatar}
                            alt={post.author.name}
                            className="w-10 h-10 rounded-full object-cover border border-emerald-500/30 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-white group-hover:text-emerald-300">
                                {post.author.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {post.author.handle}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 line-clamp-2 mt-1">
                              {post.content}
                            </p>
                            {post.media.length > 0 && (
                              <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-400 font-mono">
                                {post.media[0].type === 'video' ? (
                                  <Film className="w-3 h-3" />
                                ) : (
                                  <ImageIcon className="w-3 h-3" />
                                )}
                                <span>Includes {post.media[0].type} attachment</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 2. YouTube Search Results */}
              {(platform === 'all' || platform === 'youtube' || platform === 'tiktok') &&
                youtubeResults.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Youtube className="w-3.5 h-3.5" />
                        <span>YouTube Videos ({youtubeResults.length})</span>
                      </span>
                    </div>

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
                          className="rounded-2xl bg-[#111726] hover:bg-[#172036] border border-white/5 overflow-hidden cursor-pointer transition-all flex flex-col group shadow-lg"
                        >
                          {/* Thumbnail */}
                          <div className="aspect-video bg-black relative overflow-hidden">
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors" />

                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                                <Play className="w-5 h-5 ml-0.5 fill-current" />
                              </div>
                            </div>

                            {video.duration && (
                              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-white">
                                {video.duration}
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-3 flex-1 flex flex-col justify-between">
                            <h5 className="font-bold text-xs text-white group-hover:text-red-400 transition-colors line-clamp-2">
                              {video.title}
                            </h5>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                              <span className="truncate max-w-[140px]">{video.creatorName}</span>
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

              {/* No Results found */}
              {motherlandResults.length === 0 && youtubeResults.length === 0 && (
                <div className="py-16 text-center space-y-2">
                  <p className="text-slate-300 font-semibold text-sm">
                    No results found for &quot;{query}&quot;
                  </p>
                  <p className="text-xs text-slate-500">
                    Try searching for broader keywords like &quot;Bangladesh&quot;, &quot;Music&quot;, or &quot;Food&quot;.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Direct In-Modal Video Player Preview */}
        {activePreviewVideo && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/95">
            <div className="w-full max-w-2xl bg-[#0c101d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="font-bold text-xs text-white truncate max-w-md">
                  {activePreviewVideo.title}
                </span>
                <button
                  onClick={() => setActivePreviewVideo(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="aspect-video bg-black">
                <iframe
                  src={activePreviewVideo.embedUrl}
                  title={activePreviewVideo.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
