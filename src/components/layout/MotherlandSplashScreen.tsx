import React, { useEffect, useState } from 'react';
import { MotherlandLogo } from './MotherlandLogo';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { InstallAppButton } from '../common/InstallAppButton';

interface MotherlandSplashScreenProps {
  onFinish: () => void;
  durationMs?: number;
}

export const MotherlandSplashScreen: React.FC<MotherlandSplashScreenProps> = ({
  onFinish,
  durationMs = 2200,
}) => {
  const [fading, setFading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        setFading(true);
        setTimeout(() => {
          onFinish();
        }, 400);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [durationMs, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between p-8 bg-[#05070c] select-none transition-opacity duration-400 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-radial from-emerald-600/20 via-emerald-950/10 to-transparent blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-[#f42a41]/15 blur-2xl" />
      </div>

      {/* Top Bar with Secure Badge & Top-Right Install Button (Loading Screen only) */}
      <div className="relative z-20 w-full flex items-center justify-between pt-2 px-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-emerald-400 font-mono tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">SECURE SOCIAL ECOSYSTEM</span>
          <span className="sm:hidden">MOTHERLAND</span>
        </div>
        <div className="flex items-center">
          <InstallAppButton />
        </div>
      </div>

      {/* Center Hero Emblem */}
      <div className="relative z-10 flex flex-col items-center text-center space-y-6">
        <div className="relative">
          {/* Pulsing ring */}
          <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-emerald-500/20 via-teal-500/10 to-[#f42a41]/20 blur-xl animate-spin" style={{ animationDuration: '8s' }} />
          
          <div className="relative transform hover:scale-105 transition-transform duration-300">
            <MotherlandLogo size={88} showText={false} />
          </div>
        </div>

        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-wider text-white flex items-center justify-center gap-2">
            <span>MOTHERLAND</span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#f42a41] shadow-lg shadow-red-500/50" />
          </h1>
          <p className="text-xs sm:text-sm font-medium text-emerald-400 tracking-widest mt-1 uppercase">
            মাটির টানে, মানুষের সাথে • Connected World
          </p>
        </div>

        {/* Dynamic progress bar */}
        <div className="w-64 max-w-xs space-y-2">
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#f42a41] rounded-full transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>INITIALIZING FEED</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="relative z-10 text-center space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Universal Social, Video & Messenger Hub</span>
        </div>
        <p className="text-[10px] text-slate-600 font-mono">
          BANGLADESH HIGH-PERFORMANCE CLIENT v3.0
        </p>
      </div>
    </div>
  );
};
