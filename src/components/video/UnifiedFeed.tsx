import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VideoCard } from './VideoCard';
import { UnifiedVideo, PlatformType } from '../../types/video';
import {
  Search,
  Filter,
  RefreshCw,
  PlusCircle,
  PlaySquare,
  Sparkles,
  Loader2,
  X,
  Flame,
  TrendingUp,
  Clock,
  Compass,
} from 'lucide-react';
import {
  searchYouTube,
  getYouTubeSearchHistory,
  addYouTubeSearchHistory,
} from '../../services/youtubeService';

interface UnifiedFeedProps {
  videos: UnifiedVideo[];
  activePlatform: PlatformType | 'all';
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onOpenAddVideo: () => void;
  onOpenDetails: (video: UnifiedVideo) => void;
  searchOpen: boolean;
  onResetFilters: () => void;
}

const CATEGORY_QUERIES: Record<string, string> = {
  all: 'Bangladesh trending viral videos 2026',
  bangladesh: 'Bangladesh culture documentary news songs',
  trending: 'Top viral trending videos 2026',
  music: 'Coke Studio Bangla top songs music video',
  natok: 'Bangla new natok drama episode',
  cricket: 'Bangladesh cricket tigers match highlights',
  funny: 'Bangla comedy funny entertainment viral',
  tech: 'Technology gadget AI review bangla',
  culture: 'Sundarbans Bangladesh travel documentary',
};

export const UnifiedFeed: React.FC<UnifiedFeedProps> = ({
  videos,
  activePlatform,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  onOpenAddVideo,
  onOpenDetails,
  searchOpen,
  onResetFilters,
}) => {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [feedVideos, setFeedVideos] = useState<UnifiedVideo[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(true);
  const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false);
  const [inputVal, setInputVal] = useState<string>(searchQuery || '');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Persistent refs to avoid re-render loops and stale closures
  const fallbackVideosRef = useRef<UnifiedVideo[]>(videos);
  fallbackVideosRef.current = videos;

  const activeQueryRef = useRef<string>(searchQuery || '');
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const debounceTimerRef = useRef<any>(null);

  const categories = [
    { id: 'all', label: '🔥 All Streams' },
    { id: 'bangladesh', label: '🇧🇩 Bangladesh' },
    { id: 'trending', label: '⚡ Trending' },
    { id: 'music', label: '🎵 Music' },
    { id: 'natok', label: '🎭 বাংলা নাটক' },
    { id: 'cricket', label: '🏏 ক্রিকেট' },
    { id: 'funny', label: '😂 কমেডি' },
    { id: 'tech', label: '📱 Tech & AI' },
    { id: 'culture', label: '🏛️ ভ্রমণ ও সংস্কৃতি' },
  ];

  // Refresh recent search history once on mount
  useEffect(() => {
    try {
      setRecentSearches(getYouTubeSearchHistory().slice(0, 6));
    } catch {
      // ignore
    }
  }, []);

  // Core feed loader that queries YouTube API or platform videos
  const fetchVideos = useCallback(
    async (queryTerm: string, category: string, platform: PlatformType | 'all', refresh: boolean = true) => {
      // If user selected TikTok, Facebook, or Instagram, use platform videos
      if (platform !== 'all' && platform !== 'youtube') {
        let filtered = fallbackVideosRef.current;
        if (queryTerm.trim()) {
          const q = queryTerm.toLowerCase().trim();
          filtered = filtered.filter(
            (v) =>
              v.title.toLowerCase().includes(q) ||
              v.creatorName.toLowerCase().includes(q) ||
              v.description?.toLowerCase().includes(q)
          );
        }
        setFeedVideos(filtered);
        setIsLoadingInitial(false);
        return;
      }

      if (refresh) {
        setIsLoadingInitial(true);
        seenIdsRef.current.clear();
      }

      const effectiveQuery =
        queryTerm.trim() ||
        CATEGORY_QUERIES[category] ||
        'Bangladesh trending viral videos 2026';

      activeQueryRef.current = effectiveQuery;

      try {
        const res = await searchYouTube({
          query: effectiveQuery,
          pageSize: 24, // High capacity batch
          regionCode: 'BD',
          safeSearch: 'none', // Allow all videos without strict blockage
        });

        const uniqueNew: UnifiedVideo[] = [];
        for (const v of res.videos) {
          if (!seenIdsRef.current.has(v.id) && !seenIdsRef.current.has(v.videoId)) {
            seenIdsRef.current.add(v.id);
            seenIdsRef.current.add(v.videoId);
            uniqueNew.push(v);
          }
        }

        setFeedVideos((prev) => (refresh ? uniqueNew : [...prev, ...uniqueNew]));
        setNextPageToken(res.nextPageToken);
      } catch (err) {
        console.warn('Live YouTube feed load fallback:', err);
        if (refresh && fallbackVideosRef.current.length > 0) {
          setFeedVideos(fallbackVideosRef.current);
        }
      } finally {
        setIsLoadingInitial(false);
      }
    },
    []
  );

  // Initial load and category/platform changes
  useEffect(() => {
    fetchVideos(inputVal, selectedCategory, activePlatform, true);
  }, [selectedCategory, activePlatform, fetchVideos]);

  // Load next page continuously ("ভিডিও অসংখ্য কোন ভিডিও শেষ থাকবে না")
  const loadNextPage = useCallback(async () => {
    if (isFetchingMore) return;
    if (activePlatform !== 'all' && activePlatform !== 'youtube') return;

    setIsFetchingMore(true);
    const query = activeQueryRef.current || 'Bangladesh trending viral videos 2026';

    try {
      const res = await searchYouTube({
        query,
        pageToken: nextPageToken,
        pageSize: 24,
        regionCode: 'BD',
        safeSearch: 'none',
      });

      const uniqueNew: UnifiedVideo[] = [];
      for (const v of res.videos) {
        if (!seenIdsRef.current.has(v.id) && !seenIdsRef.current.has(v.videoId)) {
          seenIdsRef.current.add(v.id);
          seenIdsRef.current.add(v.videoId);
          uniqueNew.push(v);
        }
      }

      if (uniqueNew.length > 0) {
        setFeedVideos((prev) => [...prev, ...uniqueNew]);
      }
      setNextPageToken(res.nextPageToken);
    } catch (err) {
      console.warn('Pagination load error:', err);
    } finally {
      setIsFetchingMore(false);
    }
  }, [isFetchingMore, activePlatform, nextPageToken]);

  // Infinite scroll trigger via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingMore && nextPageToken) {
          loadNextPage();
        }
      },
      { threshold: 0.1, rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadNextPage, isFetchingMore, nextPageToken]);

  // Execute Search immediately
  const handleExecuteSearch = (rawTerm: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const term = rawTerm.trim();
    setInputVal(term);
    onSearchChange(term);
    if (term) {
      addYouTubeSearchHistory(term);
      try {
        setRecentSearches(getYouTubeSearchHistory().slice(0, 6));
      } catch {}
    }
    fetchVideos(term, selectedCategory, activePlatform, true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleExecuteSearch(inputVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);

    // Debounced search after 450ms
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      handleExecuteSearch(val);
    }, 450);
  };

  const handleClearSearch = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setInputVal('');
    onSearchChange('');
    fetchVideos('', selectedCategory, activePlatform, true);
  };

  return (
    <div className="w-full pb-24 text-slate-100">
      {/* Search Input Bar (Always accessible, live and responsive) */}
      <div className="px-3 sm:px-4 py-3 bg-[#0d1320]/95 backdrop-blur-md border-b border-white/10 sticky top-[55px] z-30 shadow-xl">
        <div className="max-w-3xl mx-auto space-y-2">
          <form onSubmit={handleFormSubmit} className="relative flex items-center">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={inputVal}
              onChange={handleInputChange}
              placeholder="সার্চ করুন: বাংলা নাটক, গান, খবর, ক্রিকেট, বা যা ইচ্ছা..."
              className="w-full pl-10 pr-24 py-2.5 rounded-2xl bg-[#141b2d] border border-emerald-500/40 text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner"
            />
            <div className="absolute right-2 flex items-center gap-1">
              {inputVal && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                className="px-3.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Search
              </button>
            </div>
          </form>

          {/* Quick Search Chips from recent history */}
          {recentSearches.length > 0 && !inputVal && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px]">
              <span className="text-slate-400 font-mono flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>সাম্প্রতিক:</span>
              </span>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => handleExecuteSearch(term)}
                  className="px-2.5 py-0.5 rounded-full bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 transition-colors flex-shrink-0 cursor-pointer"
                >
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Pills Bar (Rich & Comprehensive) */}
      <div className="px-3 sm:px-4 py-3 max-w-7xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span className="text-slate-500 text-xs font-semibold mr-1 flex items-center gap-1 hidden xs:flex">
          <Filter className="w-3.5 h-3.5 text-emerald-400" />
          <span>ফিল্টার:</span>
        </span>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.id);
                fetchVideos(inputVal, cat.id, activePlatform, true);
              }}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500 text-black border-emerald-400 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-[#12192a] text-slate-300 hover:bg-[#1a243d] border-white/5'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Stream Stats Header */}
      <div className="px-4 py-2 max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {inputVal ? (
              <>
                <strong className="text-emerald-400 font-semibold">&quot;{inputVal}&quot;</strong> এর জন্য{' '}
                <strong className="text-white font-mono">{feedVideos.length}</strong> টি ভিডিও
              </>
            ) : (
              <>
                মোট <strong className="text-white font-mono">{feedVideos.length}</strong> টি ভিডিও প্রদর্শিত
              </>
            )}
          </span>
          <span className="text-slate-500 hidden sm:inline">• কন্টিনিউয়াস লাইভ ফিড</span>
        </div>

        <button
          onClick={onOpenAddVideo}
          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-xs font-medium cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Import link</span>
        </button>
      </div>

      {/* Video Stream Grid / Continuous Feed */}
      <div className="w-full max-w-full sm:max-w-2xl sm:mx-auto px-1 sm:px-4 pt-2 space-y-4 sm:space-y-6">
        {isLoadingInitial ? (
          /* Initial Loading State */
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-sm font-semibold text-slate-300">ভিডিও লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
            <p className="text-xs text-slate-500 font-mono">লাইভ ইউটিউব ডাটা অনুসন্ধান চলছে...</p>
          </div>
        ) : feedVideos.length > 0 ? (
          feedVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isActive={activeVideoId === video.id}
              onActivate={(id) => setActiveVideoId(id)}
              onDeactivate={() => setActiveVideoId(null)}
              onOpenDetails={onOpenDetails}
            />
          ))
        ) : (
          /* Empty Search / Filter State with Recovery Button */
          <div className="text-center py-16 px-4 rounded-3xl bg-[#0e1320] border border-dashed border-white/10 my-6 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-slate-400">
              <PlaySquare className="w-7 h-7 text-emerald-400/60" />
            </div>
            <h4 className="text-base font-bold text-slate-200">কোনো ভিডিও মেলেনি</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              &quot;{inputVal || selectedCategory}&quot; এর জন্য সরাসরি কোনো ভিডিও পাওয়া যায়নি। ট্রেন্ডিং ভিডিও দেখুন:
            </p>
            <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  handleClearSearch();
                  onResetFilters();
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>সব ভিডিও রিলোড করুন</span>
              </button>
              <button
                onClick={onOpenAddVideo}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/30 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>যেকোনো ভিডিও লিংক দিন</span>
              </button>
            </div>
          </div>
        )}

        {/* Sentinel & Continuous Pagination Loader */}
        <div ref={sentinelRef} className="pt-6 pb-12 flex flex-col items-center justify-center">
          {isFetchingMore ? (
            <div className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#141b2c] border border-emerald-500/30 text-white text-xs font-semibold shadow-xl">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>আরও নতুন ভিডিও লোড হচ্ছে...</span>
            </div>
          ) : nextPageToken ? (
            <button
              onClick={loadNextPage}
              className="px-8 py-3 rounded-full bg-[#141b2c] hover:bg-[#1a2339] border border-emerald-500/30 hover:border-emerald-500/60 text-slate-200 hover:text-white font-bold text-xs transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 mx-auto cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>আরও ভিডিও দেখুন ({feedVideos.length} টি লোড হয়েছে)</span>
            </button>
          ) : feedVideos.length > 0 ? (
            <button
              onClick={() => {
                // Procedural discovery continuation so user can always get more videos
                fetchVideos(inputVal.trim() || 'Bangladesh trending viral drama music 2026', selectedCategory, activePlatform, false);
              }}
              className="px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-mono transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-emerald-400" />
              <span>আরও নতুন ভিডিও আবিষ্কার করুন</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
