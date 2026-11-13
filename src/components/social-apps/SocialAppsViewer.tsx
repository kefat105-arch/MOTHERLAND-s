import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Search,
  Lock,
  MessageCircle,
  Share2,
  Youtube,
  Loader2,
  Check,
  AlertCircle,
  Link2,
  X,
} from 'lucide-react';
import { api } from '../../api';
import { SOCIAL_PLATFORMS, resolveSocialUrl } from './platformData';
import { useBackHandler } from '../../hooks/useBackNavigation';
import type { LongVideo, YouTubeCommentThread } from '../../types';
import type { SocialPlatformId, SocialPlatformInfo } from './types';

interface SocialAppsViewerProps {
  initialPlatform?: SocialPlatformInfo;
  onBack: () => void;
  onCloseAll?: () => void;
}

export const SocialAppsViewer: React.FC<SocialAppsViewerProps> = ({
  initialPlatform = SOCIAL_PLATFORMS.youtube,
  onBack,
  onCloseAll,
}) => {
  const [currentPlatformId, setCurrentPlatformId] = useState<SocialPlatformId>(
    initialPlatform.id || 'youtube'
  );
  const platform = SOCIAL_PLATFORMS[currentPlatformId] || SOCIAL_PLATFORMS.youtube;

  // Address / URL resolver bar
  const [urlInput, setUrlInput] = useState('');
  const [urlFeedback, setUrlFeedback] = useState('');
  const [resolvedEmbedByPlatform, setResolvedEmbedByPlatform] = useState<
    Partial<Record<SocialPlatformId, { embedUrl?: string; webUrl: string; title: string }>>
  >({});

  // YouTube specific real search & comments state
  const [activeYoutubeIndex, setActiveYoutubeIndex] = useState(0);
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('');
  const [youtubeSearchResults, setYoutubeSearchResults] = useState<LongVideo[]>([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);
  const [ytSearchError, setYtSearchError] = useState('');
  const [activeSearchVideo, setActiveSearchVideo] = useState<LongVideo | null>(null);
  const [customYoutubeId, setCustomYoutubeId] = useState('');

  // In-app YouTube Comments state
  const [showYtComments, setShowYtComments] = useState(false);
  const [ytComments, setYtComments] = useState<YouTubeCommentThread[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsNotice, setCommentsNotice] = useState('');

  // Facebook plugin selection
  const [activeFbIndex, setActiveFbIndex] = useState(0);

  // Copy feedback & refresh key
  const [copiedKey, setCopiedKey] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  useBackHandler('social-apps-viewer', true, onBack, 65);

  useEffect(() => {
    setUrlFeedback('');
    setShowYtComments(false);
  }, [currentPlatformId]);

  const currentYtPreset =
    platform.curatedItems[activeYoutubeIndex] || SOCIAL_PLATFORMS.youtube.curatedItems[0];
  const activeYoutubeId = customYoutubeId || activeSearchVideo?.youtubeId || currentYtPreset?.id || '9No-FiEInLA';
  const activeYoutubeTitle = customYoutubeId
    ? `YouTube Video (${customYoutubeId})`
    : activeSearchVideo?.title || currentYtPreset?.title || 'YouTube Video';
  const activeYoutubeAuthor = activeSearchVideo?.channel?.title || currentYtPreset?.author || 'YouTube';
  const activeYoutubeWebUrl = `https://www.youtube.com/watch?v=${activeYoutubeId}`;

  const activePlatformEmbed = resolvedEmbedByPlatform[currentPlatformId];

  const handlePlatformSwitch = (id: SocialPlatformId) => {
    if (id === currentPlatformId) return;
    setCurrentPlatformId(id);
  };

  const handleUrlResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlFeedback('');
    if (!urlInput.trim()) return;

    const resolved = resolveSocialUrl(urlInput);
    if (!resolved) {
      setUrlFeedback('Please paste a valid YouTube, Facebook, TikTok, or Instagram public link.');
      return;
    }

    setCurrentPlatformId(resolved.platform);

    if (resolved.platform === 'youtube' && resolved.youtubeId) {
      setCustomYoutubeId(resolved.youtubeId);
      setActiveSearchVideo(null);
      setUrlFeedback(`Loaded YouTube video: ${resolved.youtubeId}`);
    } else if (resolved.embedUrl) {
      setResolvedEmbedByPlatform((prev) => ({
        ...prev,
        [resolved.platform]: {
          embedUrl: resolved.embedUrl,
          webUrl: resolved.webUrl,
          title: resolved.label,
        },
      }));
      setUrlFeedback(`Loaded official ${resolved.platform} embed inside MOTHERLAND.`);
    } else {
      setUrlFeedback(
        `Switched to ${resolved.platform}. Individual public post/video URLs are required for embedded playback.`
      );
    }
  };

  const handleYoutubeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = youtubeSearchQuery.trim();
    if (!q) return;

    // Allow pasting a direct YouTube link inside the YouTube search field too
    const resolved = resolveSocialUrl(q);
    if (resolved?.platform === 'youtube' && resolved.youtubeId) {
      setCustomYoutubeId(resolved.youtubeId);
      setActiveSearchVideo(null);
      setYtSearchError('');
      return;
    }

    setIsSearchingYt(true);
    setYtSearchError('');
    try {
      const res = await api.searchYouTube(q, 'video', 10);
      const items = res.items || [];
      setYoutubeSearchResults(items);
      if (items.length === 0) {
        setYtSearchError('No matching YouTube videos returned. Check API key or try another search.');
      }
    } catch (err: any) {
      setYtSearchError(err?.message || 'YouTube search failed.');
    } finally {
      setIsSearchingYt(false);
    }
  };

  const handleToggleYoutubeComments = async () => {
    if (showYtComments) {
      setShowYtComments(false);
      return;
    }
    setShowYtComments(true);
    setIsLoadingComments(true);
    setCommentsNotice('');
    try {
      const res = await api.getYouTubeComments(activeYoutubeId);
      if (res.commentsDisabled) {
        setCommentsNotice(res.message || 'Comments are disabled on this YouTube video.');
        setYtComments([]);
      } else {
        setYtComments(res.items || []);
        if (!res.items || res.items.length === 0) {
          setCommentsNotice('No comments returned (API key may be required for YouTube comments).');
        }
      }
    } catch {
      setCommentsNotice('Could not load YouTube comments right now.');
      setYtComments([]);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleCopyUrl = (url: string, key = 'main') => {
    navigator.clipboard?.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const currentExternalUrl =
    currentPlatformId === 'youtube'
      ? activeYoutubeWebUrl
      : activePlatformEmbed?.webUrl ||
        (currentPlatformId === 'facebook'
          ? SOCIAL_PLATFORMS.facebook.curatedItems[activeFbIndex]?.webUrl
          : undefined) ||
        platform.websiteUrl;

  return (
    <div
      data-testid="social-apps-viewer"
      className="fixed inset-0 z-50 ml-canvas-bg flex flex-col overflow-hidden text-[var(--text-primary)] pb-[env(safe-area-inset-bottom)]"
    >
      {/* 1. Top Controls & URL Resolver */}
      <header className="sticky top-0 z-50 bg-[var(--bg-glass-strong)] backdrop-blur-xl border-b border-[var(--border-subtle)] px-3 py-2 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          {/* In-App Back Button returning inside MOTHERLAND */}
          <button
            type="button"
            onClick={onBack}
            data-testid="marketplace-back-btn"
            className="flex items-center gap-1.5 min-h-[42px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] transition-all flex-shrink-0"
            title="Back to Marketplace"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>Back</span>
          </button>

          {/* Address / URL Embed Resolver */}
          <form onSubmit={handleUrlResolveSubmit} className="flex-1 max-w-xl flex items-center min-w-0">
            <div className="w-full flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus-within:border-[var(--accent-primary)] rounded-xl px-3 py-1.5 text-xs">
              <Lock className="w-3.5 h-3.5 text-[var(--accent-primary)] flex-shrink-0 mr-2" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste YouTube, Facebook, TikTok, or Instagram link..."
                className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs focus:outline-none truncate font-mono"
              />
              <button
                type="submit"
                className="ml-2 px-2 py-1 rounded-lg bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] text-[10px] uppercase font-bold whitespace-nowrap"
              >
                Load
              </button>
            </div>
          </form>

          {/* Refresh & Explicit External Link */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setReloadNonce((n) => n + 1)}
              className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center"
              title="Reload embed"
              aria-label="Reload embed"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <a
              href={currentExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs font-semibold flex items-center gap-1"
              title={`Open ${platform.name} in browser`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open {platform.name}</span>
            </a>

            {onCloseAll && (
              <button
                type="button"
                onClick={onCloseAll}
                className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center"
                title="Close Marketplace"
                aria-label="Close Marketplace"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* 4 Platform Switcher Tabs */}
        <div
          data-no-edge-back="true"
          className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar"
        >
          {(Object.values(SOCIAL_PLATFORMS) as SocialPlatformInfo[]).map((item) => {
            const isActive = currentPlatformId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`marketplace-tab-${item.id}`}
                onClick={() => handlePlatformSwitch(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] border-[var(--accent-primary-border)] shadow-sm'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.id === 'youtube' && <Youtube className="w-4 h-4" />}
                {item.id === 'facebook' && <span className="font-black text-sm leading-none">f</span>}
                {item.id === 'tiktok' && <span className="font-black text-[11px] leading-none">TT</span>}
                {item.id === 'instagram' && <span className="font-black text-[11px] leading-none">IG</span>}
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>

        {urlFeedback && (
          <div className="px-3 py-1.5 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[11px] text-[var(--accent-primary)] font-medium">
            {urlFeedback}
          </div>
        )}
      </header>

      {/* 2. Main In-App Workspace */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 flex flex-col items-center">
        <div className="w-full max-w-5xl space-y-4">
          {/* ========================================================= */}
          {/* YOUTUBE BROWSER (Real API Search + Official IFrame + Real Comments) */}
          {/* ========================================================= */}
          {currentPlatformId === 'youtube' && (
            <div className="space-y-4">
              {/* YouTube Real Search Bar */}
              <div className="ml-glass rounded-2xl p-3 space-y-3">
                <form onSubmit={handleYoutubeSearch} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={youtubeSearchQuery}
                      onChange={(e) => setYoutubeSearchQuery(e.target.value)}
                      placeholder="Search YouTube videos inside MOTHERLAND or paste URL..."
                      className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-red-500/60"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingYt}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF0000] hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {isSearchingYt ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Search</span>
                  </button>
                </form>

                {ytSearchError && (
                  <p className="text-xs text-[var(--accent-gold)] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{ytSearchError}</span>
                  </p>
                )}

                {/* Preset Topics */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-[11px]">
                  {SOCIAL_PLATFORMS.youtube.curatedItems.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveYoutubeIndex(idx);
                        setCustomYoutubeId('');
                        setActiveSearchVideo(null);
                        setShowYtComments(false);
                      }}
                      className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap border transition-all ${
                        activeYoutubeIndex === idx && !customYoutubeId && !activeSearchVideo
                          ? 'bg-red-500/15 text-red-500 border-red-500/40'
                          : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {item.category || item.title.slice(0, 18)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Official YouTube IFrame Player */}
              <div className="relative w-full rounded-2xl overflow-hidden bg-black border border-[var(--border-subtle)] shadow-lg aspect-video">
                <iframe
                  key={`${activeYoutubeId}-${reloadNonce}`}
                  src={`https://www.youtube-nocookie.com/embed/${activeYoutubeId}?rel=0&playsinline=1`}
                  title={activeYoutubeTitle}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              {/* Active Video Info + Real In-App Comments Toggle */}
              <div className="ml-glass rounded-2xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm sm:text-base text-[var(--text-primary)]">
                      {activeYoutubeTitle}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {activeYoutubeAuthor}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleToggleYoutubeComments}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      <span>{showYtComments ? 'Hide Comments' : 'Comments'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyUrl(activeYoutubeWebUrl, 'yt')}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"
                    >
                      {copiedKey === 'yt' ? (
                        <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'yt' ? 'Copied' : 'Copy Link'}</span>
                    </button>

                    <a
                      href={activeYoutubeWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#FF0000]/15 text-red-500 border border-red-500/30 text-xs font-bold flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open on YouTube</span>
                    </a>
                  </div>
                </div>

                {/* Real YouTube Comments Panel */}
                {showYtComments && (
                  <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2.5">
                    {isLoadingComments ? (
                      <div className="py-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-primary)]" />
                        <span>Loading real YouTube comments...</span>
                      </div>
                    ) : commentsNotice ? (
                      <p className="text-xs text-[var(--text-secondary)]">{commentsNotice}</p>
                    ) : (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {ytComments.map((c) => (
                          <div
                            key={c.id}
                            className="p-2.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex gap-2.5"
                          >
                            <img
                              src={c.authorProfileImageUrl || ''}
                              alt={c.authorDisplayName}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0 bg-[var(--bg-surface)]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                                {c.authorDisplayName}
                              </p>
                              <div
                                className="text-xs text-[var(--text-secondary)] mt-0.5 break-words"
                                dangerouslySetInnerHTML={{ __html: c.textDisplay }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Real YouTube Search Results Grid */}
              {youtubeSearchResults.length > 0 && (
                <div className="ml-glass rounded-2xl p-4 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)]">
                    Search Results
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {youtubeSearchResults.map((vid) => (
                      <button
                        key={vid.id}
                        type="button"
                        onClick={() => {
                          setActiveSearchVideo(vid);
                          setCustomYoutubeId(vid.youtubeId || vid.id);
                          setShowYtComments(false);
                        }}
                        className="text-left p-2 rounded-xl bg-[var(--bg-surface-alt)] hover:border-[var(--accent-primary-border)] border border-[var(--border-subtle)] transition-all space-y-2"
                      >
                        <img
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          loading="lazy"
                          className="w-full aspect-video rounded-lg object-cover bg-black"
                        />
                        <p className="font-bold text-xs text-[var(--text-primary)] line-clamp-2">
                          {vid.title}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] truncate">
                          {vid.channel?.title}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* FACEBOOK OFFICIAL EMBED VIEW                              */}
          {/* ========================================================= */}
          {currentPlatformId === 'facebook' && (
            <div className="ml-glass rounded-2xl p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-base text-[var(--text-primary)]">
                    Facebook Official Plugin Viewer
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Paste any public Facebook video or post link above to load its official Meta embed inside MOTHERLAND.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(currentExternalUrl, 'fb')}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"
                  >
                    {copiedKey === 'fb' ? (
                      <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === 'fb' ? 'Copied' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={currentExternalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#1877F2] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Facebook</span>
                  </a>
                </div>
              </div>

              {/* Selector between resolved pasted URL or official Meta plugins */}
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PLATFORMS.facebook.curatedItems.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveFbIndex(idx);
                      setResolvedEmbedByPlatform((prev) => ({ ...prev, facebook: undefined }));
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      !activePlatformEmbed && activeFbIndex === idx
                        ? 'bg-[#1877F2] text-white border-[#1877F2]'
                        : 'bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    {item.category}
                  </button>
                ))}
              </div>

              <div className="w-full rounded-2xl overflow-hidden bg-black/90 border border-[var(--border-subtle)] flex justify-center">
                <iframe
                  key={`${activePlatformEmbed?.embedUrl || SOCIAL_PLATFORMS.facebook.curatedItems[activeFbIndex]?.embedUrl}-${reloadNonce}`}
                  src={
                    activePlatformEmbed?.embedUrl ||
                    SOCIAL_PLATFORMS.facebook.curatedItems[activeFbIndex]?.embedUrl
                  }
                  title="Facebook Official Plugin"
                  className="w-full max-w-[600px] h-[440px] border-0 bg-white"
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] space-y-1">
                <p className="font-bold text-[var(--text-primary)]">Facebook Platform Limitations</p>
                {platform.restrictedInPWA.map((r, i) => (
                  <p key={i}>• {r}</p>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TIKTOK & INSTAGRAM OFFICIAL EMBED + RESOLVER VIEW         */}
          {/* ========================================================= */}
          {(currentPlatformId === 'tiktok' || currentPlatformId === 'instagram') && (
            <div className="ml-glass rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-base text-[var(--text-primary)]">
                    {platform.name} Official Embed Viewer
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">{platform.urlHint}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(currentExternalUrl, currentPlatformId)}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5"
                  >
                    {copiedKey === currentPlatformId ? (
                      <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedKey === currentPlatformId ? 'Copied' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={currentExternalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open {platform.name}</span>
                  </a>
                </div>
              </div>

              {activePlatformEmbed?.embedUrl ? (
                <div className="w-full flex flex-col items-center gap-3">
                  <div className="w-full max-w-[380px] aspect-[9/16] rounded-2xl overflow-hidden bg-black border border-[var(--border-subtle)] shadow-lg">
                    <iframe
                      key={`${activePlatformEmbed.embedUrl}-${reloadNonce}`}
                      src={activePlatformEmbed.embedUrl}
                      title={activePlatformEmbed.title}
                      className="w-full h-full border-0 bg-white"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setResolvedEmbedByPlatform((prev) => ({
                        ...prev,
                        [currentPlatformId]: undefined,
                      }))
                    }
                    className="text-xs font-semibold text-[var(--text-secondary)] hover:underline"
                  >
                    Clear loaded embed
                  </button>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] mx-auto flex items-center justify-center">
                    <Link2 className="w-6 h-6" />
                  </div>
                  <div className="max-w-md mx-auto space-y-1.5">
                    <p className="text-sm font-bold text-[var(--text-primary)]">
                      Paste a Public {platform.name} Link in the Address Bar Above
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      For user privacy and platform security, {platform.name} blocks embedding full logged-in feeds (`X-Frame-Options`), and MOTHERLAND never simulates fake video feeds. Paste any public {platform.name} URL above to play it inside MOTHERLAND using the official embed player.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] space-y-1">
                  <p className="font-bold text-[var(--accent-primary)]">Supported in MOTHERLAND</p>
                  {platform.supportedInPWA.map((s, i) => (
                    <p key={i} className="text-[var(--text-secondary)]">
                      • {s}
                    </p>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] space-y-1">
                  <p className="font-bold text-[var(--accent-gold)]">Platform Restrictions</p>
                  {platform.restrictedInPWA.map((r, i) => (
                    <p key={i} className="text-[var(--text-secondary)]">
                      • {r}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
