import React, { useState } from 'react';
import { AlertCircle, ChevronRight, X, Key } from 'lucide-react';
import { YouTubeApiDiagnostic } from '../../services/youtubeService';

interface ApiStatusBannerProps {
  diagnostic: YouTubeApiDiagnostic;
  onOpenDiagnostics: () => void;
}

export const ApiStatusBanner: React.FC<ApiStatusBannerProps> = ({
  diagnostic,
  onOpenDiagnostics,
}) => {
  const [dismissed, setDismissed] = useState(false);

  // If dismissed or fully successful without custom key notice, don't nag
  if (dismissed) return null;

  const isRestricted = diagnostic.status === 'PERMISSION_DENIED';

  return (
    <div
      className={`w-full py-2 px-3 sm:px-4 text-xs flex items-center justify-between border-b ${
        isRestricted
          ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
      }`}
    >
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          {isRestricted ? (
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          ) : (
            <Key className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          )}

          <p className="truncate text-[11px] sm:text-xs">
            {isRestricted ? (
              <span>
                <strong>YouTube API Notice:</strong> Key configured ({diagnostic.keyUsed}) has status{' '}
                <span className="font-mono font-bold">403 PERMISSION_DENIED</span>. Official oEmbed fallback & verified stream active.
              </span>
            ) : (
              <span>
                <strong>YouTube API Operational:</strong> Key ({diagnostic.keyUsed}) active.
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onOpenDiagnostics}
            className="px-2 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold flex items-center gap-1 transition-all"
          >
            <span>View Specs</span>
            <ChevronRight className="w-3 h-3" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
