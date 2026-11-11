import React, { useState } from 'react';
import {
  Play,
  Pause,
  ExternalLink,
  Share2,
  Info,
  Check,
  Youtube,
  Video as VideoIcon,
  Instagram,
  Facebook,
  Maximize2,
} from 'lucide-react';
import { UnifiedVideo } from '../../types/video';

interface VideoCardProps {
  video: UnifiedVideo;
  isActive: boolean;
  onActivate: (videoId: string) => void;
  onDeactivate: () => void;
  onOpenDetails: (video: UnifiedVideo) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  isActive,
  onActivate,
  onDeactivate,
  onOpenDetails,
}) => {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(video.originalVideoUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPlatformIcon = () => {
    switch (video.platform) {
      case 'youtube':
        return <Youtube className="w-3.5 h-3.5 text-red-400" />;
      case 'tiktok':
        return <VideoIcon className="w-3.5 h-3.5 text-cyan-400" />;
      case 'instagram':
        return <Instagram className="w-3.5 h-3.5 text-pink-400" />;
      case 'facebook':
        return <Facebook className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  const getPlatformBadge = () => {
    switch (video.platform) {
      case 'youtube':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'tiktok':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'instagram':
        return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
      case 'facebook':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
  };

  const getPlatformLabel = () => {
    switch (video.platform) {
      case 'youtube':
        return 'YouTube';
      case 'tiktok':
        return 'TikTok';
      case 'instagram':
        return 'Instagram Reel';
      case 'facebook':
        return 'Facebook';
    }
  };

  // Determine aspect ratio class
  const isVertical = video.aspectRatio === '9:16';

  return (
    <article className="group relative w-full rounded-2xl sm:rounded-3xl bg-[#0f1422] border border-white/[0.08] hover:border-white/20 transition-all duration-300 overflow-hidden shadow-xl shadow-black/40">
      {/* Platform & Action Bar */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-[#12192b]/60">
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getPlatformBadge()}`}
          >
            {getPlatformIcon()}
            <span>{getPlatformLabel()}</span>
          </span>

          {video.category && (
            <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
              {video.category === 'bangladesh' ? '🇧🇩 Bangladesh' : video.category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Technical Details Info button */}
          <button
            onClick={() => onOpenDetails(video)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
            title="Inspect Video Source & Security"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Copy Share URL */}
          <button
            onClick={handleShare}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
            title="Share video URL"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
          </button>

          {/* Direct Platform Fallback Launcher */}
          <a
            href={video.originalVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium transition-all"
            title={`Open directly on ${getPlatformLabel()}`}
          >
            <span>Open</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Media Player Container */}
      <div
        className={`relative w-full bg-black flex items-center justify-center overflow-hidden ${
          isVertical ? 'aspect-[9/16] max-h-[580px]' : 'aspect-video'
        }`}
      >
        {isActive ? (
          <div className="relative w-full h-full bg-black">
            {/* Active IFrame Player */}
            {video.platform === 'youtube' && (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(
                  typeof window !== 'undefined' ? window.location.origin : ''
                )}`}
                title={video.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}

            {video.platform === 'tiktok' && (
              <iframe
                src={`https://www.tiktok.com/player/v1/${video.videoId}?music_info=1&description=1&autoplay=1`}
                title={video.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}

            {video.platform === 'instagram' && (
              <iframe
                src={`https://www.instagram.com/reel/${video.videoId}/embed/`}
                title={video.title}
                className="w-full h-full border-0 bg-white"
                allow="encrypted-media"
                allowFullScreen
              />
            )}

            {video.platform === 'facebook' && (
              <iframe
                src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
                  video.originalVideoUrl
                )}&show_text=false&width=500&autoplay=true`}
                title={video.title}
                className="w-full h-full border-0"
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            )}

            {/* Float Pause / Close Player Control */}
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeactivate();
                }}
                className="px-2.5 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white text-xs font-semibold backdrop-blur-md border border-white/20 shadow-lg flex items-center gap-1.5 transition-all"
                title="Pause and close interactive player"
              >
                <Pause className="w-3.5 h-3.5 text-amber-400" />
                <span>Pause</span>
              </button>
            </div>
          </div>
        ) : (
          /* Thumbnail preview with Play affordance */
          <div
            onClick={() => onActivate(video.id)}
            className="relative w-full h-full cursor-pointer group/thumb flex items-center justify-center bg-slate-950"
          >
            <img
              src={
                imgError
                  ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
                  : video.thumbnailUrl
              }
              alt={video.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
              loading="lazy"
            />

            {/* Gradient Dark Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Duration Badge */}
            {video.duration && (
              <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/85 text-[11px] font-mono font-medium text-white backdrop-blur-sm border border-white/10">
                {video.duration}
              </span>
            )}

            {/* Play Button Trigger */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-xl shadow-emerald-900/50 backdrop-blur-md transform transition-all duration-300 group-hover/thumb:scale-110 group-hover/thumb:bg-emerald-400">
                <Play className="w-6 h-6 sm:w-7 sm:h-7 ml-0.5 fill-current" />
              </div>
            </div>

            {/* Hint */}
            <div className="absolute bottom-3 left-3 text-[11px] font-medium text-slate-300/90 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1">
              <Maximize2 className="w-3 h-3 text-emerald-400" />
              <span>Tap to play</span>
            </div>
          </div>
        )}
      </div>

      {/* Video Metadata & Creator Info */}
      <div className="p-4 bg-[#0e1422]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3
              onClick={() => onActivate(video.id)}
              className="font-bold text-sm sm:text-base text-slate-100 line-clamp-2 hover:text-emerald-400 transition-colors cursor-pointer leading-snug"
            >
              {video.title}
            </h3>

            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                {video.creatorName}
              </span>
              {video.creatorHandle && (
                <span className="text-slate-500 font-mono text-[11px]">
                  {video.creatorHandle}
                </span>
              )}
              {video.publishedAt && (
                <>
                  <span className="text-slate-600">•</span>
                  <span>{video.publishedAt}</span>
                </>
              )}
            </div>

            {video.description && (
              <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {video.description}
              </p>
            )}

            {video.tags && video.tags.length > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                {video.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#161f33] text-slate-400 border border-white/5"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
