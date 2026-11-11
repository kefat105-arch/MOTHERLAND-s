import React, { useState } from 'react';
import {
  X,
  Link as LinkIcon,
  Sparkles,
  Youtube,
  Video as VideoIcon,
  Instagram,
  Facebook,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { importVideoFromUrl } from '../../services/videoAdapter';
import { UnifiedVideo } from '../../types/video';

interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoAdded: (video: UnifiedVideo) => void;
}

export const AddVideoModal: React.FC<AddVideoModalProps> = ({
  isOpen,
  onClose,
  onVideoAdded,
}) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<UnifiedVideo | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const video = await importVideoFromUrl(url.trim());
      setSuccess(video);
      onVideoAdded(video);
      setTimeout(() => {
        onClose();
        setUrl('');
        setSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSample = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0e1423] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Import Public Video URL</h3>
              <p className="text-xs text-slate-400">Paste any link from supported platforms</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supported Platforms Badges */}
        <div className="py-4 flex items-center justify-between gap-2 text-xs">
          <div className="flex-1 p-2 rounded-xl bg-[#141c2e] border border-white/5 flex flex-col items-center gap-1 text-center">
            <Youtube className="w-4 h-4 text-red-400" />
            <span className="text-[11px] text-slate-300 font-medium">YouTube</span>
          </div>
          <div className="flex-1 p-2 rounded-xl bg-[#141c2e] border border-white/5 flex flex-col items-center gap-1 text-center">
            <VideoIcon className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] text-slate-300 font-medium">TikTok</span>
          </div>
          <div className="flex-1 p-2 rounded-xl bg-[#141c2e] border border-white/5 flex flex-col items-center gap-1 text-center">
            <Instagram className="w-4 h-4 text-pink-400" />
            <span className="text-[11px] text-slate-300 font-medium">Reels</span>
          </div>
          <div className="flex-1 p-2 rounded-xl bg-[#141c2e] border border-white/5 flex flex-col items-center gap-1 text-center">
            <Facebook className="w-4 h-4 text-blue-400" />
            <span className="text-[11px] text-slate-300 font-medium">Facebook</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Video or Reel Web Link
            </label>
            <input
              type="url"
              required
              placeholder="https://www.youtube.com/watch?v=... or TikTok / Reel / FB link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#131b2c] border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Quick Paste Samples */}
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-1.5">
              Quick Test Examples (Click to Fill):
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickSample('https://www.youtube.com/watch?v=fJ9rUzIMcZQ')}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 font-mono transition-all"
              >
                YT: Bohemian Rhapsody
              </button>
              <button
                type="button"
                onClick={() => handleQuickSample('https://www.tiktok.com/@tiktok/video/7106594312292453678')}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 font-mono transition-all"
              >
                TikTok: #7106594312292453678
              </button>
              <button
                type="button"
                onClick={() => handleQuickSample('https://www.instagram.com/reel/C1xyzBangladesh/')}
                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 font-mono transition-all"
              >
                IG: Sundarbans Reel
              </button>
            </div>
          </div>

          {/* Error & Success States */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>Successfully imported &quot;{success.title}&quot;! Added to your stream.</span>
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Resolving Video...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Add to Stream</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
