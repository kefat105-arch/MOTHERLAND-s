import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Star,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Phone,
  Lock,
  Globe,
  X,
  ArrowLeft,
  Info,
} from 'lucide-react';
import {
  BANGLADESH_SERVICE_CATEGORIES,
  BANGLADESH_SERVICES,
} from '../data/bangladeshServicesData';
import type { BangladeshServiceCategoryId, BangladeshServiceItem, UserProfile } from '../types';
import { api } from '../api';

interface BangladeshServicesViewProps {
  currentUser: UserProfile | null;
  onBack?: () => void;
  onOpenAuth?: () => void;
}

export const BangladeshServicesView: React.FC<BangladeshServicesViewProps> = ({
  currentUser,
  onBack,
  onOpenAuth,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'favorites' | 'recent' | BangladeshServiceCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [eligibility, setEligibility] = useState<{
    authenticated: boolean;
    ageYears: number | null;
    loanEligible: boolean | null;
    isMinor: boolean;
  }>({ authenticated: Boolean(currentUser), ageYears: null, loanEligible: null, isMinor: false });

  const [activePortal, setActivePortal] = useState<BangladeshServiceItem | null>(null);
  const [showIframePreview, setShowIframePreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getBdServicePrefs()
      .then((prefs) => {
        if (!cancelled) {
          setFavorites(prefs.favorites || []);
          setRecentIds(prefs.recent || []);
        }
      })
      .catch(() => {});
    api.getBdServiceEligibility()
      .then((res) => {
        if (!cancelled) setEligibility(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = BANGLADESH_SERVICES;

    if (selectedCategory === 'favorites') {
      const favSet = new Set(favorites);
      list = list.filter((s) => favSet.has(s.id));
    } else if (selectedCategory === 'recent') {
      const map = new Map(BANGLADESH_SERVICES.map((s) => [s.id, s]));
      list = recentIds.map((id) => map.get(id)).filter((s): s is BangladeshServiceItem => Boolean(s));
    } else if (selectedCategory !== 'all') {
      list = list.filter((s) => s.category === selectedCategory);
    }

    if (!q) return list;

    return list.filter((s) => {
      const haystack = [
        s.titleEn,
        s.titleBn,
        s.providerEn,
        s.providerBn,
        s.descriptionBn,
        s.descriptionEn,
        s.domain,
        s.hotline || '',
        ...s.keywords,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [searchQuery, selectedCategory, favorites, recentIds]);

  const handleToggleFavorite = async (e: React.MouseEvent, serviceId: string) => {
    e.stopPropagation();
    if (!currentUser) {
      onOpenAuth?.();
      return;
    }
    try {
      const res = await api.toggleBdServiceFavorite(serviceId);
      setFavorites(res.favorites || []);
    } catch {
      // ignore
    }
  };

  const handleOpenService = async (service: BangladeshServiceItem) => {
    setActivePortal(service);
    setShowIframePreview(false);
    if (currentUser) {
      api.recordBdServiceRecent(service.id)
        .then((res) => setRecentIds(res.recent || []))
        .catch(() => {});
    } else {
      setRecentIds((prev) => [service.id, ...prev.filter((id) => id !== service.id)].slice(0, 15));
    }
  };

  const getBadgeLabel = (badgeType: BangladeshServiceItem['badgeType']) => {
    switch (badgeType) {
      case 'official_gov':
        return { text: 'GOV.BD Official', cls: 'bg-[#006A4E]/15 text-[#006A4E] border-[#006A4E]/35' };
      case 'central_bank':
        return { text: 'Central Bank', cls: 'bg-[#1E6091]/15 text-[#1E6091] border-[#1E6091]/35' };
      case 'emergency':
        return { text: 'Emergency 24/7', cls: 'bg-red-500/15 text-red-500 border-red-500/35' };
      default:
        return { text: 'Verified Operator', cls: 'bg-[#2B8A86]/15 text-[#2B8A86] border-[#2B8A86]/35' };
    }
  };

  const isLoanRestrictedForViewer = selectedCategory === 'loan_financing' && eligibility.isMinor;

  return (
    <div data-testid="bangladesh-services-view" className="w-full max-w-[1040px] mx-auto px-3 sm:px-5 py-4 space-y-4">
      {/* Top Banner: Official Bangladesh Heritage Header */}
      <div className="rounded-2xl border border-[#006A4E]/35 bg-gradient-to-br from-[#006A4E]/15 via-[var(--ml-surface)] to-[#F42A41]/10 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] flex items-center justify-center text-[var(--ml-text-primary)] hover:border-[#006A4E] cursor-pointer shrink-0"
                aria-label="Back to Home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#006A4E] text-white">
                  🇧🇩 বাংলাদেশ ডিজিটাল সেবা
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-[var(--ml-text-secondary)]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#006A4E]" />
                  Verified Official Links Only
                </span>
              </div>
              <h1 className="font-display font-bold text-lg sm:text-2xl text-[var(--ml-text-primary)] mt-1.5">
                BANGLADESH SERVICES — বাংলাদেশের সরকারি ও ডিজিটাল সেবা
              </h1>
              <p className="text-xs sm:text-sm text-[var(--ml-text-secondary)] mt-0.5">
                NID, ই-পাসপোর্ট, জন্ম নিবন্ধন, বিদ্যুৎ-গ্যাস-পানি বিল, bKash/Nagad, ব্যাংক, ট্রেন টিকিট ও জরুরি ৯৯৯ — এক জায়গায় নিরাপদ অফিসিয়াল পোর্টাল ডিরেক্টরি।
              </p>
            </div>
          </div>

          <a
            href="tel:999"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/15 border border-red-500/35 text-red-500 text-xs font-bold whitespace-nowrap hover:bg-red-500/20"
          >
            <Phone className="w-3.5 h-3.5" /> জরুরি: ৯৯৯
          </a>
        </div>

        {/* Non-Impersonation Legal Transparency Notice */}
        <div className="mt-3 rounded-xl bg-[var(--ml-surface)]/80 border border-[var(--ml-border)] px-3 py-2 flex items-start gap-2 text-[11px] text-[var(--ml-text-secondary)]">
          <Info className="w-4 h-4 text-[#2B8A86] shrink-0 mt-0.5" />
          <span>
            <strong>স্বচ্ছতা ঘোষণা:</strong> এটি একটি অফিসিয়াল নাগরিক সেবা ডিরেক্টরি। MOTHERLAND কোনো সরকারি সংস্থা বা ব্যাংকের ছদ্মবেশ ধারণ করে না এবং আপনার এনআইডি বা পিন সংরক্ষণ করে না — প্রতিটি লিংক সরাসরি সংশ্লিষ্ট অফিসিয়াল ডোমেইনে (.gov.bd / স্বীকৃত প্রতিষ্ঠান) খোলে।
          </span>
        </div>
      </div>

      {/* Bilingual & Phonetic Search Bar */}
      <div className="sticky top-[57px] z-20 bg-[var(--ml-bg)]/95 backdrop-blur-md py-2">
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--ml-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="খুঁজুন: এনআইডি, পাসপোর্ট, বিদ্যুৎ, রেল, 999 বা লিখুন nid, passport, desco, bkash, loan..."
            className="w-full min-h-[44px] pl-10 pr-10 py-2.5 rounded-xl bg-[var(--ml-surface)] border border-[var(--ml-border)] text-sm text-[var(--ml-text-primary)] placeholder:text-[var(--ml-text-muted)] focus:outline-none focus:border-[#006A4E]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ml-text-muted)] hover:text-[var(--ml-text-primary)] absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#006A4E] text-white border-[#006A4E]'
                : 'bg-[var(--ml-surface)] text-[var(--ml-text-secondary)] border-[var(--ml-border)] hover:text-[var(--ml-text-primary)]'
            }`}
          >
            🌐 সব সেবা ({BANGLADESH_SERVICES.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('favorites')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border inline-flex items-center gap-1 transition cursor-pointer ${
              selectedCategory === 'favorites'
                ? 'bg-[#D0AF72] text-[#0E1117] border-[#D0AF72]'
                : 'bg-[var(--ml-surface)] text-[var(--ml-text-secondary)] border-[var(--ml-border)] hover:text-[var(--ml-text-primary)]'
            }`}
          >
            <Star className="w-3.5 h-3.5" /> প্রিয় ({favorites.length})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('recent')}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border inline-flex items-center gap-1 transition cursor-pointer ${
              selectedCategory === 'recent'
                ? 'bg-[#2B8A86] text-white border-[#2B8A86]'
                : 'bg-[var(--ml-surface)] text-[var(--ml-text-secondary)] border-[var(--ml-border)] hover:text-[var(--ml-text-primary)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> সাম্প্রতিক ({recentIds.length})
          </button>

          {BANGLADESH_SERVICE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border inline-flex items-center gap-1.5 transition cursor-pointer ${
                selectedCategory === cat.id
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-[var(--ml-surface)] text-[var(--ml-text-secondary)] border-[var(--ml-border)] hover:text-[var(--ml-text-primary)]'
              }`}
              style={selectedCategory === cat.id ? { backgroundColor: cat.accent } : undefined}
            >
              <span>{cat.icon}</span>
              <span>{cat.titleBn}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loan & Financing Age Gate + Official Anti-Scam Safety Banner */}
      {selectedCategory === 'loan_financing' && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-[var(--ml-text-primary)] space-y-1">
              <p className="font-bold">
                ঋণ ও অর্থায়ন নীতিমালা ও প্রতারণা সতর্কতা (১৮+ প্রাপ্তবয়স্কদের জন্য)
              </p>
              <p className="text-[var(--ml-text-secondary)]">
                ভুয়া অনলাইন লোন অ্যাপ থেকে দূরে থাকুন। কোনো বৈধ বাংলাদেশি ব্যাংক বা পিকেএসএফ/এমআরএ সংস্থা প্রসেসিং ফি বাবদ ব্যক্তিগত বিকাশ/নগদ নম্বরে অগ্রিম টাকা বা পিন/ওটিপি চায় না।
              </p>
            </div>
          </div>
          {isLoanRestrictedForViewer && (
            <div
              data-testid="bd-loan-minor-guard"
              className="mt-2 rounded-xl bg-red-500/15 border border-red-500/40 p-3 flex items-center gap-2 text-xs text-red-400 font-semibold"
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                ১৮ বছরের কম বয়সী (বয়স {eligibility.ageYears}) অ্যাকাউন্টের জন্য ঋণ সংক্রান্ত পোর্টাল সংযোগ সীমাবদ্ধ। কেবল প্রাপ্তবয়স্ক (১৮+) ব্যবহারকারীরাই ব্যাংক বা ঋণ তথ্যের জন্য আবেদন করতে পারবেন।
              </span>
            </div>
          )}
        </div>
      )}

      {/* Services Grid */}
      {isLoanRestrictedForViewer ? (
        <div className="rounded-2xl bg-[var(--ml-surface)] border border-[var(--ml-border)] p-8 text-center space-y-2">
          <Lock className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="font-bold text-base text-[var(--ml-text-primary)]">Age 18+ Verification Protected</h3>
          <p className="text-xs text-[var(--ml-text-secondary)] max-w-md mx-auto">
            Loan & financing portals in Bangladesh require legal adult status (18+) with National ID verification. This section is locked for minor accounts.
          </p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-2xl bg-[var(--ml-surface)] border border-[var(--ml-border)] p-10 text-center space-y-2">
          <Globe className="w-8 h-8 text-[var(--ml-text-muted)] mx-auto" />
          <p className="text-sm font-semibold text-[var(--ml-text-primary)]">কোনো সেবা পাওয়া যায়নি</p>
          <p className="text-xs text-[var(--ml-text-secondary)]">
            অন্য শব্দ দিয়ে খুঁজুন অথবা উপরের ক্যাটাগরি পরিবর্তন করুন।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredServices.map((srv) => {
            const isFav = favorites.includes(srv.id);
            const badge = getBadgeLabel(srv.badgeType);
            return (
              <div
                key={srv.id}
                onClick={() => handleOpenService(srv)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleOpenService(srv);
                }}
                className="group rounded-2xl bg-[var(--ml-surface)] border border-[var(--ml-border)] hover:border-[#006A4E]/60 p-4 flex flex-col justify-between gap-3 transition shadow-sm cursor-pointer"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.cls}`}>
                          {badge.text}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--ml-text-muted)] truncate">
                          {srv.domain}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm sm:text-base text-[var(--ml-text-primary)] group-hover:text-[#006A4E] transition-colors">
                        {srv.titleBn}
                      </h3>
                      <p className="text-xs font-medium text-[var(--ml-text-secondary)]">
                        {srv.titleEn} • {srv.providerBn}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleFavorite(e, srv.id)}
                      aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
                      className={`min-w-[38px] min-h-[38px] rounded-xl border flex items-center justify-center transition cursor-pointer shrink-0 ${
                        isFav
                          ? 'bg-[#D0AF72]/15 border-[#D0AF72] text-[#D0AF72]'
                          : 'bg-[var(--ml-surface-soft)] border-[var(--ml-border)] text-[var(--ml-text-muted)] hover:text-[#D0AF72]'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <p className="text-xs text-[var(--ml-text-secondary)] leading-relaxed">
                    {srv.descriptionBn}
                  </p>
                </div>

                <div className="pt-2 border-t border-[var(--ml-border)] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 flex-wrap text-[var(--ml-text-muted)]">
                    <span>{srv.requiresLogin ? '🔐 লগইন প্রয়োজন' : '🔓 উন্মুক্ত পোর্টাল'}</span>
                    {srv.hotline && (
                      <span className="px-2 py-0.5 rounded-md bg-[var(--ml-surface-soft)] font-semibold text-[var(--ml-text-primary)]">
                        ☎️ {srv.hotline}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 font-bold text-[#006A4E] whitespace-nowrap">
                    পোর্টাল দেখুন <ExternalLink className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Safe Portal Viewer Modal */}
      {activePortal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
          onClick={() => setActivePortal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[var(--ml-surface)] border border-[var(--ml-border)] shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[var(--ml-border)] flex items-center justify-between gap-2 bg-[var(--ml-surface-soft)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#006A4E] shrink-0" />
                  <span className="text-xs font-mono font-semibold text-[#006A4E] truncate">
                    https://{activePortal.domain}
                  </span>
                </div>
                <h2 className="font-bold text-sm sm:text-base text-[var(--ml-text-primary)] truncate">
                  {activePortal.titleBn} ({activePortal.titleEn})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActivePortal(null)}
                aria-label="Close portal dialog"
                className="w-9 h-9 rounded-xl bg-[var(--ml-surface)] border border-[var(--ml-border)] flex items-center justify-center text-[var(--ml-text-secondary)] hover:text-[var(--ml-text-primary)] cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {activePortal.requiresAdult && eligibility.isMinor ? (
                <div className="rounded-xl bg-red-500/15 border border-red-500/40 p-4 text-sm text-red-400">
                  ১৮ বছরের কম বয়সী অ্যাকাউন্টের জন্য এই অর্থায়ন বা ঋণ সংক্রান্ত লিংক সীমাবদ্ধ রাখা হয়েছে।
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] p-3.5 space-y-2 text-xs sm:text-sm">
                    <p className="text-[var(--ml-text-primary)] font-medium">
                      {activePortal.descriptionBn}
                    </p>
                    <p className="text-[var(--ml-text-secondary)]">{activePortal.descriptionEn}</p>
                    <div className="pt-2 border-t border-[var(--ml-border)] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[var(--ml-text-muted)]">দপ্তর/প্রতিষ্ঠান: </span>
                        <span className="font-semibold text-[var(--ml-text-primary)]">{activePortal.providerBn}</span>
                      </div>
                      <div>
                        <span className="text-[var(--ml-text-muted)]">লগইন/অ্যাকাউন্ট: </span>
                        <span className="font-semibold text-[var(--ml-text-primary)]">
                          {activePortal.requiresLogin ? 'প্রয়োজন হতে পারে' : 'প্রয়োজন নেই'}
                        </span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-[var(--ml-text-muted)]">অফিসিয়াল ফি / চার্জ: </span>
                        <span className="font-semibold text-[var(--ml-text-primary)]">{activePortal.officialFeeInfo}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#006A4E]/30 bg-[#006A4E]/10 p-3 text-xs text-[var(--ml-text-secondary)]">
                    🔒 নিরাপত্তার কারণে অধিকাংশ সরকারি (.gov.bd) ও ব্যাংকিং সাইট ব্রাউজারের নিরাপত্তা নীতিমালায় (X-Frame-Options) সরাসরি নতুন সুরক্ষিত ট্যাবে খুলতে হয়। আপনার পাসওয়ার্ড বা ওটিপি কেবল অফিসিয়াল ডোমেইনেই দিন।
                  </div>

                  {showIframePreview && (
                    <div className="rounded-xl border border-[var(--ml-border)] overflow-hidden bg-white h-80 relative">
                      <iframe
                        src={activePortal.url}
                        title={activePortal.titleEn}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        className="w-full h-full border-0"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5">
                    <a
                      href={activePortal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#006A4E] text-white font-bold text-sm inline-flex items-center justify-center gap-2 hover:opacity-95"
                    >
                      <span>অফিসিয়াল পোর্টাল খুলুন ({activePortal.domain})</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {activePortal.hotline && (
                      <a
                        href={`tel:${activePortal.hotline}`}
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-[var(--ml-text-primary)] font-bold text-sm inline-flex items-center gap-1.5"
                      >
                        <Phone className="w-4 h-4 text-[#006A4E]" /> {activePortal.hotline}
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowIframePreview((v) => !v)}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[var(--ml-surface-soft)] border border-[var(--ml-border)] text-xs font-semibold text-[var(--ml-text-secondary)] hover:text-[var(--ml-text-primary)] cursor-pointer"
                    >
                      {showIframePreview ? 'Hide Frame' : 'Try In-App Frame'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
