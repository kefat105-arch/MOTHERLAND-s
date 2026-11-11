import React, { useState, useMemo } from 'react';
import {
  Search,
  Star,
  ExternalLink,
  ShieldCheck,
  Building2,
  Lock,
  Landmark,
  GraduationCap,
  Zap,
  Smartphone,
  HandCoins,
  HeartPulse,
  Train,
  Briefcase,
  Mail,
  Info,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import {
  BANGLADESH_CATEGORIES,
  VERIFIED_BANGLADESH_SERVICES,
  getFavoriteServiceIds,
  toggleFavoriteService,
  markServiceVisited,
} from '../../services/bangladeshServicesData';
import { BangladeshServiceEntry, ServiceCategory } from '../../types/bangladeshServices';
import { InAppBrowserModal } from './InAppBrowserModal';

export const BangladeshServicesHub: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(getFavoriteServiceIds());
  const [activeBrowserService, setActiveBrowserService] = useState<BangladeshServiceEntry | null>(null);

  const handleToggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = toggleFavoriteService(id);
    setFavorites(updated);
  };

  const handleOpenService = (service: BangladeshServiceEntry) => {
    markServiceVisited(service.id);
    setActiveBrowserService(service);
  };

  const filteredServices = useMemo(() => {
    let list = VERIFIED_BANGLADESH_SERVICES;

    if (selectedCategory !== 'all') {
      list = list.filter((s) => s.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        const inName = s.name.toLowerCase().includes(q);
        const inBengali = s.bengaliName.toLowerCase().includes(q);
        const inAuth = s.authority.toLowerCase().includes(q);
        const inDesc = s.description.toLowerCase().includes(q);
        const inDomain = s.officialDomain.toLowerCase().includes(q);
        const inKeywords = s.keywords.some((k) => k.toLowerCase().includes(q));
        return inName || inBengali || inAuth || inDesc || inDomain || inKeywords;
      });
    }

    return list;
  }, [selectedCategory, searchQuery]);

  const favoriteServices = useMemo(() => {
    return VERIFIED_BANGLADESH_SERVICES.filter((s) => favorites.includes(s.id));
  }, [favorites]);

  const getCategoryIcon = (catId: ServiceCategory) => {
    switch (catId) {
      case 'government':
        return <Landmark className="w-4 h-4 text-emerald-400" />;
      case 'education':
        return <GraduationCap className="w-4 h-4 text-teal-400" />;
      case 'utilities':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'payments':
        return <Smartphone className="w-4 h-4 text-cyan-400" />;
      case 'banking':
        return <Building2 className="w-4 h-4 text-blue-400" />;
      case 'loans':
        return <HandCoins className="w-4 h-4 text-purple-400" />;
      case 'health':
        return <HeartPulse className="w-4 h-4 text-rose-400" />;
      case 'transport':
        return <Train className="w-4 h-4 text-emerald-300" />;
      case 'jobs':
        return <Briefcase className="w-4 h-4 text-amber-300" />;
      case 'communication':
        return <Mail className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 pb-28 text-slate-100">
      {/* Hero Banner with Bangladesh Theme */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#003829] via-[#052b20] to-[#0b1626] border border-emerald-500/30 p-6 sm:p-8 shadow-2xl mb-8">
        {/* Crimson flag circle motif */}
        <div className="absolute right-6 -bottom-10 w-44 h-44 rounded-full bg-[#f42a41]/20 blur-2xl pointer-events-none" />
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3.5 h-3.5 rounded-full bg-[#f42a41] border-2 border-white/80 shadow-md shadow-red-500/50" />
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              NATIONAL DIGITAL SERVICES HUB • বাংলাদেশের ডিজিটাল সেবা
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            BANGLADESH SERVICES
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            One organized portal for verified Bangladesh government portals, public examination results, utility bill payments, mobile financial directories, railway e-ticketing, emergency services, and official recruitment notices.
          </p>

          {/* Quick Search */}
          <div className="mt-6 relative flex items-center max-w-xl">
            <Search className="w-5 h-5 text-emerald-400 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services (e.g. NID, জন্ম নিবন্ধন, বিদ্যুৎ বিল, SSC Result, বিকাশ, পাসপোর্ট, ট্রেন টিকিট)..."
              className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-[#09111c]/90 border border-emerald-500/40 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 text-xs text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mandatory Section 16 Independent Platform Notice */}
      <div className="p-3.5 rounded-2xl bg-[#0e1628] border border-white/5 text-xs text-slate-300 flex items-start gap-2.5 mb-6">
        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed text-[11px] sm:text-xs">
          <strong>Official Authority Verification Notice:</strong> MOTHERLAND is an independent platform connecting citizens directly to official service endpoints. External services are provided by their respective Bangladesh government departments, boards, and authorized licensees. MOTHERLAND does not represent or impersonate those organizations.
        </div>
      </div>

      {/* Favorites Row (if any) */}
      {favoriteServices.length > 0 && !searchQuery && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <h3 className="font-bold text-sm text-white">Your Starred Services (দ্রুত সেবা)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {favoriteServices.map((service) => (
              <div
                key={`fav_${service.id}`}
                onClick={() => handleOpenService(service)}
                className="p-3.5 rounded-2xl bg-[#111827] border border-amber-500/30 hover:border-amber-400/50 cursor-pointer transition-all flex items-start justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono uppercase text-emerald-400 block mb-0.5">
                    {service.categoryBengali}
                  </span>
                  <h4 className="font-bold text-xs sm:text-sm text-white group-hover:text-amber-300 transition-colors truncate">
                    {service.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{service.bengaliName}</p>
                </div>
                <button
                  onClick={(e) => handleToggleFav(e, service.id)}
                  className="text-amber-400 p-1 hover:text-slate-400"
                  title="Remove from favorites"
                >
                  <Star className="w-4 h-4 fill-current" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills Filter */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-semibold transition-all border ${
            selectedCategory === 'all'
              ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-900/40'
              : 'bg-[#0f172a] text-slate-300 hover:bg-[#18233f] border-white/5'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>All Categories ({VERIFIED_BANGLADESH_SERVICES.length})</span>
          </span>
        </button>

        {BANGLADESH_CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-2xl text-xs font-medium transition-all border flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-emerald-500 text-black font-semibold border-emerald-400 shadow-md shadow-emerald-900/40'
                  : 'bg-[#0f172a] text-slate-300 hover:bg-[#18233f] border-white/5'
              }`}
            >
              {getCategoryIcon(cat.id)}
              <span>{cat.name}</span>
              <span className="text-[10px] opacity-75 font-mono">({cat.bengaliName})</span>
            </button>
          );
        })}
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((service) => {
          const isFav = favorites.includes(service.id);
          return (
            <div
              key={service.id}
              onClick={() => handleOpenService(service)}
              className="p-5 rounded-3xl bg-[#0d1322] border border-white/10 hover:border-emerald-500/40 cursor-pointer transition-all duration-200 flex flex-col justify-between group shadow-lg hover:shadow-emerald-900/20"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {getCategoryIcon(service.category)}
                    <span className="text-[10px] font-mono uppercase text-slate-400">
                      {service.categoryBengali}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleToggleFav(e, service.id)}
                    className="p-1 rounded-lg text-slate-500 hover:text-amber-400 transition-colors"
                    title={isFav ? 'Starred' : 'Add to favorites'}
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'text-amber-400 fill-amber-400' : ''}`} />
                  </button>
                </div>

                {/* Service Name */}
                <h4 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors leading-snug">
                  {service.name}
                </h4>
                <p className="text-xs text-emerald-400 font-medium mt-0.5">{service.bengaliName}</p>

                {/* Authority & Domain */}
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  <span className="font-mono text-[10px] text-slate-300 truncate">
                    {service.officialDomain}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-2">
                  {service.description}
                </p>
              </div>

              {/* Bottom Specs & Action */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-300">
                  {service.feeStructure === 'FREE_PUBLIC_SERVICE' ? 'Free Service' : 'Gov/Official Fee'}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenService(service);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/90 group-hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 transition-all shadow-md active:scale-95"
                >
                  <span>Open Portal</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredServices.length === 0 && (
        <div className="text-center py-16 px-4 rounded-3xl bg-[#0c1220] border border-dashed border-white/10 my-6">
          <Info className="w-10 h-10 text-emerald-400/60 mx-auto mb-3" />
          <h4 className="text-base font-bold text-white">No services found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No official portals matched &quot;{searchQuery}&quot;. Try searching in Bengali or English.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
          >
            Reset Search
          </button>
        </div>
      )}

      {/* In-App Browser Modal */}
      <InAppBrowserModal
        service={activeBrowserService}
        onClose={() => setActiveBrowserService(null)}
      />
    </div>
  );
};
