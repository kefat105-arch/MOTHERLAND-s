import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

interface AudioBubblePlayerProps {
  src: string;
  durationHint?: number;
  waveform?: number[];
  isOwn?: boolean;
}

const DEFAULT_WAVE = [24, 42, 68, 52, 85, 64, 38, 72, 90, 58, 44, 78, 66, 48, 82, 54, 36, 62, 74, 40, 52, 34, 46, 28];

function formatSec(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const AudioBubblePlayer: React.FC<AudioBubblePlayerProps> = ({
  src,
  durationHint = 0,
  waveform,
  isOwn = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const [error, setError] = useState(false);

  const bars = waveform && waveform.length >= 12 ? waveform.slice(0, 28) : DEFAULT_WAVE;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        setError(false);
        await audio.play();
        setIsPlaying(true);
      } catch {
        setError(true);
        setIsPlaying(false);
      }
    }
  };

  const handleSeekBar = (index: number) => {
    const audio = audioRef.current;
    const total = duration || durationHint || 0;
    if (!audio || !total || !Number.isFinite(total)) return;
    const ratio = (index + 0.5) / bars.length;
    const target = Math.max(0, Math.min(total, ratio * total));
    audio.currentTime = target;
    setCurrentTime(target);
  };

  const cycleSpeed = () => {
    setSpeed((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  const effectiveDuration = duration > 0 && Number.isFinite(duration) ? duration : durationHint;
  const progressRatio = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;

  return (
    <div className="flex items-center gap-2.5 min-w-[215px] max-w-[280px] py-0.5 select-none">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setIsPlaying(false);
          setError(true);
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition cursor-pointer ${
          isOwn
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-[var(--ml-accent-teal)] text-white hover:opacity-90'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-[2px] h-7 cursor-pointer" role="slider" aria-label="Voice note progress">
          {bars.map((amp, idx) => {
            const barProgress = idx / bars.length;
            const active = barProgress <= progressRatio && (isPlaying || currentTime > 0);
            const heightPct = Math.max(18, Math.min(100, amp));
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleSeekBar(idx)}
                className="flex-1 h-full flex items-center justify-center group"
                aria-label={`Seek to ${Math.round((idx / bars.length) * 100)}%`}
              >
                <span
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-[2px] transition-colors ${
                    active
                      ? isOwn
                        ? 'bg-[#E6C987]'
                        : 'bg-[var(--ml-accent-teal)]'
                      : isOwn
                      ? 'bg-white/35 group-hover:bg-white/60'
                      : 'bg-[var(--ml-text-muted)]/35 group-hover:bg-[var(--ml-text-muted)]/60'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] tabular-nums">
          <span className={isOwn ? 'text-white/80' : 'text-[var(--ml-text-secondary)]'}>
            {error ? 'Audio unavailable' : isPlaying || currentTime > 0 ? formatSec(currentTime) : formatSec(effectiveDuration)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
              isOwn
                ? 'bg-white/15 hover:bg-white/25 text-white'
                : 'bg-[var(--ml-surface-soft)] hover:bg-[var(--ml-border)] text-[var(--ml-text-secondary)]'
            }`}
          >
            {speed}x
          </button>
        </div>
      </div>
    </div>
  );
};
