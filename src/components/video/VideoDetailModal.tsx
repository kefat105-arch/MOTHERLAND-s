import React from 'react';
import {
  X,
  ShieldCheck,
  ExternalLink,
  Layers,
  Globe,
  Film,
  Lock,
} from 'lucide-react';
import { UnifiedVideo } from '../../types/video';

interface VideoDetailModalProps {
  video: UnifiedVideo | null;
  onClose: () => void;
}

export const VideoDetailModal: React.FC<VideoDetailModalProps> = ({
  video,
  onClose,
}) => {
  if (!video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#0e1423] border border-white/10 rounded-3xl p-6 shadow-2xl text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base text-white">Video Source & Technical Specs</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5 text-xs">
          <div className="p-3 rounded-2xl bg-[#141b2e] border border-white/5">
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Title
            </span>
            <p className="font-semibold text-white text-sm">{video.title}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-[#141b2e] border border-white/5">
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                Platform
              </span>
              <p className="font-bold text-emerald-400 uppercase">{video.platform}</p>
            </div>

            <div className="p-3 rounded-xl bg-[#141b2e] border border-white/5">
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                Playback Status
              </span>
              <p className="font-bold text-slate-200">{video.playbackAvailability}</p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#141b2e] border border-white/5 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Layers className="w-3.5 h-3.5 text-teal-400" />
              <span>Official Embed Technology</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              {video.platform === 'youtube' &&
                'Rendered via official YouTube IFrame Player API (youtube-nocookie.com) with enablejsapi=1 parameter.'}
              {video.platform === 'tiktok' &&
                'Rendered via official TikTok Player v1 iframe embed endpoint with creator attribution.'}
              {video.platform === 'instagram' &&
                'Rendered via official Meta Instagram Reel embed container.'}
              {video.platform === 'facebook' &&
                'Rendered via official Meta Embedded Video Player plugin with origin isolation.'}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-[#141b2e] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>Canonical Source URL</span>
            </div>
            <a
              href={video.originalVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline break-all block font-mono text-[11px]"
            >
              {video.originalVideoUrl}
            </a>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-start gap-2">
            <Lock className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
            <span>
              <strong>Zero-Scraping Compliance:</strong> Content is strictly embedded using official platform player methods without rehosting or copyright bypass.
            </span>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
          <a
            href={video.originalVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-medium"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Open on {video.platform}</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
