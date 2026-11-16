import React from 'react';
import { Play } from 'lucide-react';
import { MotherlandLogo } from '../layout/MotherlandLogo';

interface VideoBrandOverlayProps {
  mode: 'paused' | 'buffering';
  visible: boolean;
  compact?: boolean;
  interactive?: boolean;
  onResume?: () => void;
}

/**
 * Centered MOTHERLAND branded overlay for Pause & Genuine Buffering states.
 * - Uses the exact original <MotherlandLogo /> icon (never redrawn or duplicated).
 * - Paused mode renders a calm, smoothly rotating circular architectural ring
 *   plus a crisp Play resume cue so users immediately recognize PAUSED vs LOADING.
 * - Buffering mode renders a distinct sweeping progress arc + subtle Loading pill.
 * - Fades smoothly out with opacity-0 pointer-events-none during active playback.
 */
export const VideoBrandOverlay: React.FC<VideoBrandOverlayProps> = ({
  mode,
  visible,
  compact = false,
  interactive = false,
  onResume,
}) => {
  const logoSize = compact ? 28 : 38;
  const ringDim = compact ? 58 : 74;
  const canClickResume = interactive && mode === 'paused' && Boolean(onResume);

  return (
    <div
      data-testid={`video-brand-overlay-${mode}`}
      aria-hidden={!visible}
      className={`absolute inset-0 z-[18] flex items-center justify-center pointer-events-none transition-all duration-200 ease-out ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      {/* Subtle scrim only on center area — keeps video frame visible behind */}
      <div
        role={canClickResume ? 'button' : undefined}
        tabIndex={canClickResume ? 0 : undefined}
        aria-label={canClickResume ? 'Resume video playback' : undefined}
        onClick={
          canClickResume
            ? (e) => {
                e.stopPropagation();
                onResume?.();
              }
            : undefined
        }
        onKeyDown={
          canClickResume
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onResume?.();
                }
              }
            : undefined
        }
        className={`relative flex flex-col items-center gap-1.5 select-none ${
          canClickResume ? 'pointer-events-auto cursor-pointer group' : 'pointer-events-none'
        }`}
      >
        <div
          className="relative flex items-center justify-center rounded-full bg-black/55 backdrop-blur-md shadow-2xl border border-white/15 transition-transform duration-150 group-hover:scale-105 group-active:scale-95"
          style={{ width: ringDim, height: ringDim }}
        >
          {mode === 'paused' ? (
            <>
              {/* Calm, slow rotating emerald & gold orbital ring — Paused signature */}
              <svg
                viewBox="0 0 80 80"
                className="absolute inset-0 w-full h-full ml-pause-orbit-svg pointer-events-none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="mlPauseArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="55%" stopColor="#D0AF72" />
                    <stop offset="100%" stopColor="#F42A41" stopOpacity="0.85" />
                  </linearGradient>
                </defs>
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="2"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="url(#mlPauseArcGrad)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeDasharray="128 98"
                />
              </svg>

              {/* Exact Original MOTHERLAND Logo */}
              <div className="relative z-[1]">
                <MotherlandLogo size={logoSize} showText={false} />
              </div>

              {/* Tiny Play corner badge so Pause state reads instantaneously */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 rounded-full bg-[#D0AF72] text-[#111827] border-2 border-[#0b1019] flex items-center justify-center shadow-lg ${
                  compact ? 'w-5 h-5' : 'w-6 h-6'
                }`}
              >
                <Play className={compact ? 'w-2.5 h-2.5 fill-current ml-0.5' : 'w-3 h-3 fill-current ml-0.5'} />
              </span>
            </>
          ) : (
            <>
              {/* Distinct genuine buffering progress sweep */}
              <svg
                viewBox="0 0 80 80"
                className="absolute inset-0 w-full h-full ml-buffer-sweep-svg pointer-events-none"
                aria-hidden="true"
              >
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="#2B8A86"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="58 170"
                />
              </svg>

              {/* Exact Original MOTHERLAND Logo */}
              <div className="relative z-[1] opacity-90 animate-pulse">
                <MotherlandLogo size={logoSize} showText={false} />
              </div>
            </>
          )}
        </div>

        {/* Distinct Micro Status Chip (only visible when compact is false or buffering) */}
        {!compact && (
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase backdrop-blur-md border shadow-md ${
              mode === 'paused'
                ? 'bg-black/65 border-[#D0AF72]/40 text-[#F3F5F8]'
                : 'bg-black/70 border-[#2B8A86]/50 text-[#86EFAC]'
            }`}
          >
            {mode === 'paused' ? 'Paused · Tap to Play' : 'Buffering…'}
          </span>
        )}
      </div>
    </div>
  );
};
