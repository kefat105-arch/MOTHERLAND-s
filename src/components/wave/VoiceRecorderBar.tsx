import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, RotateCcw } from 'lucide-react';
import { api } from '../../api';

interface VoiceRecorderBarProps {
  onCancel: () => void;
  onSendVoice: (payload: {
    url: string;
    mimeType: string;
    fileName: string;
    fileSize: number;
    durationSeconds: number;
    waveform: number[];
  }) => Promise<void>;
}

function formatSec(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const VoiceRecorderBar: React.FC<VoiceRecorderBarProps> = ({ onCancel, onSendVoice }) => {
  const [status, setStatus] = useState<'initializing' | 'recording' | 'preview' | 'uploading' | 'error'>('initializing');
  const [errorMsg, setErrorMsg] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [liveBars, setLiveBars] = useState<number[]>(new Array(24).fill(18));
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const mimeRef = useRef<string>('audio/webm');
  const waveformSamplesRef = useRef<number[]>([]);
  const timerRef = useRef<number | null>(null);
  const analyserRafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const stopResources = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (analyserRafRef.current) {
      window.cancelAnimationFrame(analyserRafRef.current);
      analyserRafRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  };

  useEffect(() => {
    let mounted = true;
    const begin = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Microphone recording is not supported in this browser.');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
        const chosenMime = candidates.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
        mimeRef.current = chosenMime || 'audio/webm';

        const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        waveformSamplesRef.current = [];
        startedAtRef.current = Date.now();

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeRef.current });
          blobRef.current = blob;
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setStatus('preview');
          stopResources();
        };

        // Live Web Audio AnalyserNode for genuine waveform sampling
        try {
          const Ctx = window.AudioContext || (window as any).webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            audioCtxRef.current = ctx;
            const src = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            src.connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            let lastPush = 0;

            const tick = () => {
              if (!mounted) return;
              analyser.getByteFrequencyData(data);
              const avg = data.reduce((acc, v) => acc + v, 0) / Math.max(1, data.length);
              const normalized = Math.max(15, Math.min(100, Math.round((avg / 140) * 100)));
              const now = performance.now();
              if (now - lastPush > 75) {
                lastPush = now;
                waveformSamplesRef.current.push(normalized);
                setLiveBars((prev) => [...prev.slice(1), normalized]);
              }
              analyserRafRef.current = window.requestAnimationFrame(tick);
            };
            tick();
          }
        } catch {
          // Non-fatal fallback if Web Audio context restricted
        }

        recorder.start(250);
        setStatus('recording');
        timerRef.current = window.setInterval(() => {
          const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
          setElapsedSec(secs);
          if (secs >= 180) {
            stopRecording();
          }
        }, 250);
      } catch (err: any) {
        if (!mounted) return;
        setErrorMsg(err?.message || 'Microphone permission denied.');
        setStatus('error');
        stopResources();
      }
    };

    begin();

    return () => {
      mounted = false;
      stopResources();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
  };

  const togglePreview = async () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPlayingPreview) {
      audio.pause();
      setIsPlayingPreview(false);
    } else {
      await audio.play().catch(() => {});
      setIsPlayingPreview(true);
    }
  };

  const buildDownsampledWaveform = (): number[] => {
    const samples = waveformSamplesRef.current;
    if (!samples.length) return liveBars;
    const targetLen = 24;
    const out: number[] = [];
    for (let i = 0; i < targetLen; i++) {
      const start = Math.floor((i * samples.length) / targetLen);
      const end = Math.max(start + 1, Math.floor(((i + 1) * samples.length) / targetLen));
      const slice = samples.slice(start, end);
      const avg = slice.reduce((a, b) => a + b, 0) / Math.max(1, slice.length);
      out.push(Math.max(16, Math.min(100, Math.round(avg))));
    }
    return out;
  };

  const handleSend = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    setStatus('uploading');
    setErrorMsg('');
    setUploadProgress(5);
    try {
      const ext = mimeRef.current.includes('mp4') ? 'm4a' : mimeRef.current.includes('ogg') ? 'ogg' : 'webm';
      const file = new File([blob], `wave-voice-${Date.now()}.${ext}`, { type: blob.type || mimeRef.current });
      const uploaded = await api.uploadMediaFile(file, (pct) => setUploadProgress(pct));
      await onSendVoice({
        url: uploaded.url,
        mimeType: uploaded.mimeType,
        fileName: uploaded.filename,
        fileSize: uploaded.size,
        durationSeconds: Math.max(1, elapsedSec),
        waveform: buildDownsampledWaveform(),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Voice upload failed. Tap retry.');
      setStatus('preview');
    }
  };

  if (status === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-sm">
        <span className="text-red-400 font-medium truncate">{errorMsg}</span>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-xl bg-[var(--ml-surface)] text-[var(--ml-text-primary)] font-semibold text-xs shrink-0 cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-[var(--ml-surface-soft)] border border-[var(--ml-accent-teal)]/35">
      <button
        type="button"
        onClick={() => {
          stopResources();
          onCancel();
        }}
        title="Discard voice message"
        aria-label="Discard voice message"
        className="w-10 h-10 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/10 transition shrink-0 cursor-pointer"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {status === 'recording' || status === 'initializing' ? (
        <>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 tabular-nums shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {formatSec(elapsedSec)}
          </span>
          <div className="flex-1 flex items-center gap-[2px] h-7 overflow-hidden">
            {liveBars.map((val, i) => (
              <span
                key={i}
                style={{ height: `${val}%` }}
                className="flex-1 rounded-[2px] bg-[var(--ml-accent-teal)] transition-all duration-75"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={stopRecording}
            aria-label="Stop recording"
            className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition shrink-0 cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        </>
      ) : (
        <>
          {previewUrl && (
            <audio
              ref={previewAudioRef}
              src={previewUrl}
              onEnded={() => setIsPlayingPreview(false)}
            />
          )}
          <button
            type="button"
            onClick={togglePreview}
            aria-label={isPlayingPreview ? 'Pause preview' : 'Play recorded voice preview'}
            className="w-9 h-9 rounded-full bg-[var(--ml-accent-teal)]/20 text-[var(--ml-accent-teal)] flex items-center justify-center shrink-0 cursor-pointer"
          >
            {isPlayingPreview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2">
              <Mic className="w-3.5 h-3.5 text-[var(--ml-accent-teal)] shrink-0" />
              <span className="text-xs font-semibold text-[var(--ml-text-primary)] tabular-nums">
                {status === 'uploading' ? `Sending audio ${uploadProgress}%` : `Voice preview (${formatSec(elapsedSec)})`}
              </span>
            </div>
            {errorMsg && <span className="text-[11px] text-red-400 truncate">{errorMsg}</span>}
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={status === 'uploading'}
            className="px-3.5 h-10 rounded-xl bg-[var(--ml-accent-teal)] text-white font-semibold text-xs inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-60 transition shrink-0 cursor-pointer"
          >
            {errorMsg ? <RotateCcw className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            {errorMsg ? 'Retry' : 'Send'}
          </button>
        </>
      )}
    </div>
  );
};
