import React, { useRef, useState } from 'react';
import {
  Search,
  Mic,
  MicOff,
  Download,
  Play,
  X,
  Loader2,
  CheckCircle2,
  Link2,
  Sparkles,
  FileDown,
  Pause,
} from 'lucide-react';
import { saveVideoOffline } from '../services/offlineVideoEngine';
import type { LongVideo } from '../types';

interface HelperBdFormat {
  id: string;
  label: string;
  quality: string;
  ext: 'mp4' | 'mp3' | 'webm';
  mimeType: string;
  hasAudio: boolean;
  watermarkFree: boolean;
  directUrl: string;
  proxyStreamUrl: string;
  proxyDownloadUrl: string;
  proxyVerified?: boolean;
  sizeBytes?: number;
}

interface HelperBdItem {
  id: string;
  platform: string;
  platformLabel: string;
  sourceUrl: string;
  title: string;
  author: string;
  authorAvatar?: string;
  thumbnailUrl: string;
  duration?: string;
  durationSeconds?: number;
  kind: 'video' | 'short';
  playUrl?: string;
  downloadUrl?: string;
  watermarkFree: boolean;
  requiresResolve?: boolean;
  formats: HelperBdFormat[];
}

export const HelperBdDownloader: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [results, setResults] = useState<HelperBdItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [savingOfflineId, setSavingOfflineId] = useState<string | null>(null);
  const [offlineSavedIds, setOfflineSavedIds] = useState<Record<string, boolean>>({});
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string>('');
  const recognitionRef = useRef<any>(null);

  const runSearch = async (rawQuery?: string) => {
    const q = (rawQuery ?? query).trim();
    if (!q) return;
    setIsSearching(true);
    setHasSearched(true);
    setErrorMsg('');
    setStatusFeedback('');
    setPreviewItemId(null);

    try {
      const r = await fetch(`/api/helper-bd/search?q=${encodeURIComponent(q)}`);
      if (!r.ok) {
        throw new Error('Could not process this link or search query.');
      }
      const data = await r.json();
      const items: HelperBdItem[] = Array.isArray(data?.items) ? data.items : [];
      setResults(items);
      if (items.length === 0) {
        setErrorMsg(
          data?.mode === 'url'
            ? 'Could not extract a downloadable video from this link. Make sure the post/video is public.'
            : 'No videos found for this search. Try another keyword or paste a video link.'
        );
      }
    } catch (err: any) {
      setResults([]);
      setErrorMsg(err?.message || 'Search failed. Please check your connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleVoiceSearch = () => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setErrorMsg('Voice search is not supported in this browser. Type or paste URL instead.');
      return;
    }

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      recognitionRef.current = rec;
      rec.lang = 'bn-BD';
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        setErrorMsg('');
      };
      rec.onresult = (event: any) => {
        const transcript = String(event?.results?.[0]?.[0]?.transcript || '').trim();
        setIsListening(false);
        if (transcript) {
          setQuery(transcript);
          void runSearch(transcript);
        }
      };
      rec.onerror = () => {
        setIsListening(false);
        setErrorMsg('Could not capture voice clearly. Please try again or type.');
      };
      rec.onend = () => {
        setIsListening(false);
      };
      rec.start();
    } catch {
      setIsListening(false);
      setErrorMsg('Microphone permission is needed for voice search.');
    }
  };

  const ensureResolvedItem = async (item: HelperBdItem): Promise<HelperBdItem> => {
    if (!item.requiresResolve && item.formats.length > 0) return item;
    setResolvingId(item.id);
    try {
      const r = await fetch('/api/helper-bd/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.sourceUrl }),
      });
      if (!r.ok) {
        const errData = await r.json().catch(() => ({}));
        throw new Error(errData?.message || 'Could not resolve download link for this video.');
      }
      const data = await r.json();
      const resolved: HelperBdItem | undefined = data?.item;
      if (!resolved) {
        throw new Error('No downloadable formats found.');
      }
      const merged: HelperBdItem = {
        ...item,
        ...resolved,
        id: item.id,
        requiresResolve: false,
      };
      setResults((prev) => prev.map((x) => (x.id === item.id ? merged : x)));
      return merged;
    } finally {
      setResolvingId(null);
    }
  };

  const triggerFileDownload = async (item: HelperBdItem, chosenFormat?: HelperBdFormat) => {
    setErrorMsg('');
    setStatusFeedback('');
    setDownloadingId(`${item.id}_${chosenFormat?.id || 'default'}`);
    try {
      const activeItem = await ensureResolvedItem(item);
      const fmt =
        chosenFormat ||
        activeItem.formats.find((f) => f.ext === 'mp4' && f.hasAudio && f.proxyVerified) ||
        activeItem.formats.find((f) => f.ext === 'mp4' && f.proxyVerified) ||
        activeItem.formats.find((f) => f.ext === 'mp4') ||
        activeItem.formats[0];

      if (!fmt) {
        throw new Error('No downloadable file format available for this video.');
      }

      const ext = fmt.ext || 'mp4';
      const safeName = `${(activeItem.title || 'helper_bd_video')
        .replace(/[^\w\u0980-\u09FF\s-]+/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 48) || 'helper_bd_video'}.${ext}`;

      const dlTarget = fmt.proxyVerified ? fmt.proxyDownloadUrl : fmt.directUrl;
      const isSameOrigin = dlTarget.startsWith('/');

      if (isSameOrigin) {
        // Fetch blob cleanly from our proxy and save directly to user's Downloads without opening popups
        const resp = await fetch(dlTarget);
        if (!resp.ok) {
          throw new Error('Direct download stream failed. Please try another quality.');
        }
        const blob = await resp.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
        setStatusFeedback(`"${activeItem.title}" ডাউনলোড সম্পন্ন হয়েছে ✓ (${fmt.label})`);
      } else {
        const a = document.createElement('a');
        a.href = dlTarget;
        a.download = safeName;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setStatusFeedback(`Download started for "${activeItem.title}" (${fmt.quality})`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Download could not complete.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSaveToOfflineVault = async (item: HelperBdItem) => {
    setErrorMsg('');
    setStatusFeedback('');
    setSavingOfflineId(item.id);
    try {
      const activeItem = await ensureResolvedItem(item);
      const streamFmt =
        activeItem.formats.find((f) => f.ext === 'mp4' && f.proxyVerified) ||
        activeItem.formats.find((f) => f.proxyStreamUrl?.startsWith('/'));
      const streamUrl = streamFmt?.proxyStreamUrl || activeItem.playUrl;
      if (!streamUrl || !streamUrl.startsWith('/')) {
        throw new Error('This host blocks offline caching. Use Direct File Download instead.');
      }
      const mappedVideo: LongVideo = {
        id: `hbd_off_${activeItem.id}`,
        source: 'motherland',
        videoUrl: streamUrl,
        thumbnailUrl: activeItem.thumbnailUrl,
        title: activeItem.title,
        description: `${activeItem.platformLabel} · Downloaded via Helper BD`,
        duration: activeItem.duration || 'Video',
        channel: {
          id: `hbd_${activeItem.platform}`,
          title: activeItem.author || activeItem.platformLabel,
          avatar: activeItem.authorAvatar || '',
          isVerified: true,
        },
        stats: { views: 0, likes: 0, comments: 0 },
        publishedAt: 'Helper BD Offline ✓',
      };
      const ok = await saveVideoOffline(mappedVideo);
      if (ok) {
        setOfflineSavedIds((prev) => ({ ...prev, [item.id]: true }));
        setStatusFeedback(`"${activeItem.title}" অফলাইন ভল্টে সেভ হয়েছে ✓`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save to Offline Vault.');
    } finally {
      setSavingOfflineId(null);
    }
  };

  return (
    <section
      data-testid="menu-helper-bd-section"
      className="pt-2 pb-4 space-y-2.5"
    >
      {/* Full-width Header matching Search Bar width right above it */}
      <div className="w-full space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-black tracking-wide text-[var(--accent-primary)]">
            <Sparkles className="w-4 h-4" />
            <span>Helper BD</span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Without Watermark
          </span>
        </div>

        <p
          data-testid="helper-bd-caption"
          className="w-full text-xs font-bold leading-snug text-[var(--text-primary)] bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2"
        >
          TikTok Instagram Facebook YouTube and all social media video download for without watermark
        </p>
      </div>

      {/* Helper BD Search Bar (URL + Keyword + Voice Mic) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
        className="w-full ml-glass rounded-2xl p-2 border border-[var(--accent-primary-border)] shadow-lg"
      >
        <div className="flex items-center gap-1.5 w-full">
          <div className="flex items-center gap-2 flex-1 min-w-0 px-2.5 py-2 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] focus-within:border-[var(--accent-primary)]">
            <Link2 className="w-4 h-4 text-[var(--accent-primary)] shrink-0" />
            <input
              type="text"
              data-testid="helper-bd-search-input"
              aria-label="Helper BD"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Helper BD — Paste URL or search by text/voice..."
              className="w-full bg-transparent text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setHasSearched(false);
                  setErrorMsg('');
                  setStatusFeedback('');
                }}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0"
                aria-label="Clear Helper BD search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            data-testid="helper-bd-voice-btn"
            onClick={handleVoiceSearch}
            className={`min-h-[42px] w-10 rounded-xl flex items-center justify-center border transition-colors shrink-0 cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                : 'bg-[var(--bg-surface-alt)] text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]'
            }`}
            title="Voice Search (Helper BD)"
            aria-label="Voice search"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="submit"
            data-testid="helper-bd-search-submit"
            disabled={isSearching || !query.trim()}
            className="min-h-[42px] px-3.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] text-xs font-bold flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Go</span>
          </button>
        </div>
      </form>

      {/* Feedback Banner */}
      {statusFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-semibold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-xl bg-[var(--danger-soft)] border border-[var(--danger)]/35 text-xs font-semibold text-[var(--danger)]">
          {errorMsg}
        </div>
      )}

      {/* Results Directly Below Search Bar */}
      {hasSearched && !isSearching && results.length > 0 && (
        <div data-testid="helper-bd-results" className="space-y-3 pt-1">
          {results.map((item) => {
            const isPreviewOpen = previewItemId === item.id;
            const playableStreamFmt =
              item.formats.find((f) => f.ext === 'mp4' && f.proxyVerified) ||
              item.formats.find((f) => f.ext === 'mp4');
            const activePreviewSrc = playableStreamFmt?.proxyStreamUrl || item.playUrl;
            const isBusy = resolvingId === item.id || downloadingId?.startsWith(item.id);

            return (
              <div
                key={item.id}
                data-testid={`helper-bd-result-${item.id}`}
                className="ml-glass rounded-2xl p-3 space-y-2.5 border border-[var(--border-subtle)]"
              >
                <div className="flex gap-3 items-start">
                  <div className="relative w-24 h-16 rounded-xl overflow-hidden bg-black shrink-0 border border-[var(--border-subtle)]">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/60">
                        <Play className="w-5 h-5" />
                      </div>
                    )}
                    {item.duration && (
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[9px] font-mono text-white">
                        {item.duration}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] text-[10px] font-bold">
                        {item.platformLabel}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                        No Watermark
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--text-primary)] line-clamp-2 leading-snug">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                      {item.author}
                    </p>
                  </div>
                </div>

                {/* Inline Preview Player when Playing */}
                {isPreviewOpen && activePreviewSrc && (
                  <div className="rounded-xl overflow-hidden bg-black border border-[var(--border-subtle)]">
                    <video
                      src={activePreviewSrc}
                      poster={item.thumbnailUrl || undefined}
                      controls
                      autoPlay
                      playsInline
                      className="w-full max-h-64 object-contain"
                    />
                  </div>
                )}

                {/* Action Buttons: Preview + Direct File Download (Without Watermark) + Save Offline */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (isPreviewOpen) {
                        setPreviewItemId(null);
                        return;
                      }
                      const resolved = await ensureResolvedItem(item).catch((e) => {
                        setErrorMsg(e?.message || 'Could not load video preview.');
                        return null;
                      });
                      if (resolved) setPreviewItemId(item.id);
                    }}
                    disabled={isBusy}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[var(--bg-surface-alt)] hover:border-[var(--accent-primary)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer"
                  >
                    {isPreviewOpen ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isPreviewOpen ? 'Close' : 'Watch'}</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`helper-bd-download-${item.id}`}
                    onClick={() => void triggerFileDownload(item)}
                    disabled={Boolean(isBusy)}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-55 flex-1 justify-center"
                  >
                    {isBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileDown className="w-3.5 h-3.5" />
                    )}
                    <span>Download (Without Watermark)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSaveToOfflineVault(item)}
                    disabled={savingOfflineId === item.id || Boolean(offlineSavedIds[item.id])}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[var(--accent-primary)] text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60"
                  >
                    {savingOfflineId === item.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : offlineSavedIds[item.id] ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{offlineSavedIds[item.id] ? 'Saved ✓' : 'Offline'}</span>
                  </button>
                </div>

                {/* Quality & Format Selector Buttons */}
                {item.formats.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
                    {item.formats.map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => void triggerFileDownload(item, fmt)}
                        disabled={Boolean(downloadingId)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-alt)] hover:bg-[var(--accent-primary-soft)] border border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent-primary)] flex items-center gap-1 cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>{fmt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
