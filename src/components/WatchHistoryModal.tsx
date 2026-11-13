import React, { useEffect, useState } from 'react';
import { X, History, Play, Trash2, Loader2, EyeOff } from 'lucide-react';
import { api } from '../api';
import type { WatchHistoryRecord } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';

interface WatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayHistoryItem: (item: WatchHistoryRecord) => void;
}

export const WatchHistoryModal: React.FC<WatchHistoryModalProps> = ({
  isOpen,
  onClose,
  onPlayHistoryItem,
}) => {
  const [history, setHistory] = useState<WatchHistoryRecord[]>([]);
  const [suppressionDays, setSuppressionDays] = useState(7);
  const [loading, setLoading] = useState(false);

  useBackHandler('watch-history-modal', isOpen, onClose, 62);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    api
      .getWatchHistory()
      .then((res) => {
        setHistory(res.history || []);
        if (res.suppressionDays) setSuppressionDays(res.suppressionDays);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemove = async (videoId: string) => {
    await api.deleteWatchHistoryItem(videoId).catch(() => {});
    setHistory((prev) => prev.filter((item) => item.videoId !== videoId));
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl h-[85vh] sm:h-[78vh] rounded-t-3xl sm:rounded-3xl ml-glass-elevated border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="px-4 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Watch History</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Watched items are hidden from discovery feeds for {suppressionDays} days
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close watch history"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {loading ? (
            <div className="py-12 flex justify-center text-[var(--accent-primary)]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-xs text-[var(--text-secondary)]">
              <EyeOff className="w-8 h-8 mx-auto text-[var(--text-muted)] opacity-50" />
              <p className="font-semibold text-[var(--text-primary)]">No watch history yet</p>
              <p className="max-w-xs mx-auto">
                Videos you watch for several seconds appear here and are temporarily filtered out of Home &amp; Video discovery feeds for {suppressionDays} days.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.videoId}
                className="flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onPlayHistoryItem(item);
                    onClose();
                  }}
                  className="relative w-28 sm:w-32 aspect-video rounded-xl overflow-hidden bg-black shrink-0 group cursor-pointer"
                >
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                  ) : null}
                  <div className="absolute inset-0 bg-black/35 group-hover:bg-black/50 flex items-center justify-center transition">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                </button>

                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      onPlayHistoryItem(item);
                      onClose();
                    }}
                    className="text-left cursor-pointer"
                  >
                    <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] line-clamp-2 hover:text-[var(--accent-primary)]">
                      {item.title}
                    </p>
                  </button>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                    {item.channelTitle} · {item.videoType === 'short' ? 'Short' : 'Video'}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] tabular-nums mt-0.5">
                    Watched {item.watchSeconds}s · {new Date(item.lastViewedAt).toLocaleDateString()}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(item.videoId)}
                  title="Remove from watch history"
                  aria-label="Remove from watch history"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
