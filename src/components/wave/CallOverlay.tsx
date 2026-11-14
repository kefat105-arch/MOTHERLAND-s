import React, { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  RefreshCw,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ActiveCallSession } from '../../hooks/useWebRTC';
import { WaveLogo } from './WaveLogo';
import {
  isCallAudioBlocked,
  isCallRingTemporarilyMuted,
  isGlobalSoundMuted,
  subscribeSoundState,
  toggleCallRingTemporarilyMuted,
  unlockSoundEngine,
} from '../../utils/motherlandSoundEngine';

interface CallOverlayProps {
  call: ActiveCallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onSwitchToAudioOnly: () => void;
}

function formatCallTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const CallOverlay: React.FC<CallOverlayProps> = ({
  call,
  localStream,
  remoteStream,
  onAccept,
  onDecline,
  onEnd,
  onToggleMute,
  onToggleCamera,
  onSwitchCamera,
  onSwitchToAudioOnly,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ringMuted, setRingMuted] = useState<boolean>(
    () => isCallRingTemporarilyMuted() || isGlobalSoundMuted()
  );
  const [audioBlocked, setAudioBlocked] = useState<boolean>(() => isCallAudioBlocked());

  useEffect(() => {
    const sync = () => {
      setRingMuted(isCallRingTemporarilyMuted() || isGlobalSoundMuted());
      setAudioBlocked(isCallAudioBlocked());
    };
    sync();
    return subscribeSoundState(sync);
  }, [call?.phase, call?.callId]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream, call?.phase, call?.isCameraOff]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream, call?.phase]);

  if (!call) return null;

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await el.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  };

  const triggerNativePiP = async () => {
    const v = remoteVideoRef.current;
    if (!v || !('pictureInPictureEnabled' in document)) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch {
      // Browser PiP not available or remote video has no active frame yet
    }
  };

  // Incoming Call Floating Banner / Modal
  if (call.phase === 'incoming') {
    return (
      <div className="fixed inset-x-0 top-4 z-[200] flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-[#0D1E31]/95 backdrop-blur-xl border border-[#C9A25B]/40 shadow-2xl p-4 text-white animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <WaveLogo size={24} showWordmark compact />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#E6C987]">
                Incoming {call.callType === 'video' ? 'Video' : 'Voice'} Call
              </span>
              <button
                type="button"
                onClick={() => {
                  if (audioBlocked) {
                    void unlockSoundEngine();
                  } else {
                    toggleCallRingTemporarilyMuted();
                  }
                }}
                aria-label={ringMuted ? 'Unmute ringtone' : 'Silence ringtone'}
                title={ringMuted ? 'Unmute ringtone' : 'Silence ringtone'}
                className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                {ringMuted || audioBlocked ? (
                  <VolumeX className="w-4 h-4 text-slate-300" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#E6C987]" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3.5 mb-4">
            {call.peerAvatar ? (
              <img
                src={call.peerAvatar}
                alt={call.peerName}
                className="w-14 h-14 rounded-full object-cover ring-2 ring-[#2A6F72]"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#2A6F72]/30 flex items-center justify-center text-xl font-bold">
                {call.peerName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="font-display font-bold text-lg truncate">{call.peerName}</h4>
              <p className="text-xs text-slate-300">
                {call.isGroupCall ? 'Wave Group P2P Call' : 'Direct WebRTC Encrypted Media'}
              </p>
              {audioBlocked && (
                <button
                  type="button"
                  onClick={() => void unlockSoundEngine()}
                  className="mt-1.5 text-[11px] font-semibold text-[#E6C987] underline cursor-pointer"
                >
                  Tap to enable ringtone sound
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onDecline}
              className="min-h-[46px] rounded-xl bg-red-500/90 hover:bg-red-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" /> Decline
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="min-h-[46px] rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {call.callType === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasRemoteVideo = Boolean(remoteStream && remoteStream.getVideoTracks().some((t) => t.enabled));
  const statusLabel =
    call.phase === 'outgoing'
      ? 'Calling...'
      : call.phase === 'connecting'
      ? 'Connecting...'
      : call.phase === 'connected'
      ? formatCallTime(call.durationSeconds)
      : call.phase === 'reconnecting'
      ? `Reconnecting · ${formatCallTime(call.durationSeconds)}`
      : call.phase === 'failed'
      ? 'Call Failed'
      : 'Call Ended';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-[#07111C]/95 backdrop-blur-xl text-white flex flex-col justify-between p-4 sm:p-6"
    >
      {/* Hidden audio output element guarantees voice audio plays even when camera is off */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-2.5">
          <WaveLogo size={26} />
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-[#E6C987]">MOTHERLAND WAVE</p>
            <p className="text-xs text-slate-300 tabular-nums">{statusLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {call.phase === 'outgoing' && (
            <button
              type="button"
              onClick={() => {
                if (audioBlocked) {
                  void unlockSoundEngine();
                } else {
                  toggleCallRingTemporarilyMuted();
                }
              }}
              title={ringMuted || audioBlocked ? 'Enable ringback tone' : 'Mute ringback tone'}
              aria-label={ringMuted || audioBlocked ? 'Enable ringback tone' : 'Mute ringback tone'}
              className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
            >
              {ringMuted || audioBlocked ? (
                <VolumeX className="w-4 h-4 text-slate-300" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#E6C987]" />
              )}
            </button>
          )}
          {call.callType === 'video' && hasRemoteVideo && (
            <button
              type="button"
              onClick={triggerNativePiP}
              title="Picture in Picture"
              aria-label="Picture in Picture"
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Media Stage */}
      <div className="relative flex-1 my-4 rounded-3xl overflow-hidden bg-[#0D1E31] border border-white/10 flex items-center justify-center">
        {call.callType === 'video' && hasRemoteVideo && !call.remoteCameraOff ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center text-center px-6 max-w-md">
            <div className="relative mb-5">
              {call.peerAvatar ? (
                <img
                  src={call.peerAvatar}
                  alt={call.peerName}
                  className={`w-28 h-28 rounded-full object-cover ring-4 ${
                    call.phase === 'connected' ? 'ring-emerald-400/60' : 'ring-[#2A6F72]/60 animate-pulse'
                  }`}
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-[#2A6F72]/35 flex items-center justify-center text-4xl font-bold">
                  {call.peerName.slice(0, 1).toUpperCase()}
                </div>
              )}
              {call.remoteMuted && (
                <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shadow">
                  <MicOff className="w-4 h-4" />
                </span>
              )}
            </div>
            <h2 className="font-display font-bold text-2xl mb-1">{call.peerName}</h2>
            <p className="text-sm text-slate-300 tabular-nums mb-3">{statusLabel}</p>
            {call.statusNote && (
              <div className="inline-flex items-start gap-2 px-3.5 py-2 rounded-xl bg-white/10 text-xs text-slate-200 text-left">
                <ShieldAlert className="w-4 h-4 text-[#E6C987] shrink-0 mt-0.5" />
                <span>{call.statusNote}</span>
              </div>
            )}
          </div>
        )}

        {/* Picture-in-Picture Local Camera Tile */}
        {localStream && !call.isCameraOff && localStream.getVideoTracks().length > 0 && (
          <div className="absolute bottom-4 right-4 w-28 sm:w-36 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/25 shadow-2xl bg-black">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${call.facingMode === 'user' ? '-scale-x-100' : ''}`}
            />
          </div>
        )}
      </div>

      {/* Bottom Controls Dock */}
      <div className="flex flex-wrap items-center justify-center gap-3 pb-2 z-10">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={call.isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer ${
            call.isMuted ? 'bg-white text-slate-900' : 'bg-white/15 hover:bg-white/25 text-white'
          }`}
        >
          {call.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={onToggleCamera}
          aria-label={call.isCameraOff ? 'Turn camera on' : 'Turn camera off'}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition cursor-pointer ${
            call.isCameraOff ? 'bg-white text-slate-900' : 'bg-white/15 hover:bg-white/25 text-white'
          }`}
        >
          {call.isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
        </button>

        {!call.isCameraOff && (
          <button
            type="button"
            onClick={onSwitchCamera}
            title="Switch front/back camera"
            aria-label="Switch front or back camera"
            className="w-12 h-12 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}

        {call.callType === 'video' && (
          <button
            type="button"
            onClick={onSwitchToAudioOnly}
            className="px-3.5 h-12 rounded-2xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition cursor-pointer"
          >
            Audio Only
          </button>
        )}

        <button
          type="button"
          onClick={onEnd}
          aria-label={call.phase === 'failed' || call.phase === 'ended' ? 'Close call screen' : 'End call'}
          className="px-4 h-12 rounded-2xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
        >
          <PhoneOff className="w-5 h-5" />
          {(call.phase === 'failed' || call.phase === 'ended') && (
            <span className="text-xs font-bold">Close</span>
          )}
        </button>
      </div>
    </div>
  );
};
