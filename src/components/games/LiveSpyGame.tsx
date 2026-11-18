import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Check,
  Eye,
  EyeOff,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
  Video,
  Vote,
} from 'lucide-react';
import { api } from '../../api';
import type {
  LiveSpyCapacity,
  LiveSpyPublicState,
  LiveSpySecretAssignment,
  UserProfile,
} from '../../types';
import type { RealtimeEvent } from '../../hooks/useRealtime';
import { useBackHandler } from '../../hooks/useBackNavigation';
import { LiveSpyLounge3D, type CameraPreset } from './LiveSpyLounge3D';
import { LiveSpyEmblem } from './LiveSpyEmblem';

type BgMode = 'raw' | 'blur' | 'lounge';

interface LiveSpyGameProps {
  currentUser: UserProfile;
  capacity: LiveSpyCapacity;
  sendWsEvent: (event: string, payload: Record<string, any>) => boolean;
  subscribeSpyEvents: (listener: (evt: RealtimeEvent) => void) => () => void;
  onExit: () => void;
}

export const LiveSpyGame: React.FC<LiveSpyGameProps> = ({
  currentUser,
  capacity,
  sendWsEvent,
  subscribeSpyEvents,
  onExit,
}) => {
  const [roomState, setRoomState] = useState<LiveSpyPublicState | null>(null);
  const [secret, setSecret] = useState<LiveSpySecretAssignment | null>(null);
  const [showSecretPeek, setShowSecretPeek] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [bgMode, setBgMode] = useState<BgMode>('lounge');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [clueInput, setClueInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [mediaSources, setMediaSources] = useState<
    Record<string, HTMLVideoElement | HTMLCanvasElement | null>
  >({});

  const roomStateRef = useRef<LiveSpyPublicState | null>(null);
  roomStateRef.current = roomState;

  const rawStreamRef = useRef<MediaStream | null>(null);
  const outboundStreamRef = useRef<MediaStream | null>(null);
  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
  const segCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const segRafRef = useRef<number>(0);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const queuedIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const iceConfigRef = useRef<RTCIceServer[]>([
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ]);

  const bgModeRef = useRef<BgMode>(bgMode);
  bgModeRef.current = bgMode;

  const cameraOnRef = useRef(cameraOn);
  cameraOnRef.current = cameraOn;

  const micMutedRef = useRef(micMuted);
  micMutedRef.current = micMuted;

  // Countdown tick for HUD timers
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  // Load ICE/TURN servers once
  useEffect(() => {
    api
      .getWebRtcConfig()
      .then((cfg) => {
        if (Array.isArray(cfg?.iceServers) && cfg.iceServers.length > 0) {
          iceConfigRef.current = cfg.iceServers;
        }
      })
      .catch(() => {});
  }, []);

  // Refresh secret if needed whenever match advances out of waiting/countdown
  useEffect(() => {
    if (
      roomState &&
      roomState.phase !== 'waiting' &&
      roomState.phase !== 'countdown' &&
      (!secret || secret.matchId !== roomState.matchId)
    ) {
      api
        .getLiveSpySecret()
        .then((res) => {
          if (res.secret) setSecret(res.secret);
        })
        .catch(() => {});
    }
    if (roomState?.phase === 'role_reveal') {
      setShowSecretPeek(true);
    } else if (roomState?.phase === 'clue') {
      setShowSecretPeek(false);
    }
  }, [roomState?.phase, roomState?.matchId]);

  const syncOutboundTracksToPeers = useCallback(() => {
    const stream = outboundStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0] || null;
    const videoTrack = stream.getVideoTracks()[0] || null;

    for (const pc of peersRef.current.values()) {
      const senders = pc.getSenders();
      if (audioTrack) {
        const audioSender = senders.find((s) => s.track?.kind === 'audio');
        if (audioSender) {
          void audioSender.replaceTrack(audioTrack).catch(() => {});
        } else {
          pc.addTrack(audioTrack, stream);
        }
      }
      if (videoTrack) {
        const videoSender = senders.find((s) => s.track?.kind === 'video');
        if (videoSender) {
          void videoSender.replaceTrack(videoTrack).catch(() => {});
        } else {
          pc.addTrack(videoTrack, stream);
        }
      }
    }
  }, []);

  // Start background portrait segmentation + soft luxury lounge matte pipeline
  const rebuildLocalPipeline = useCallback(
    async (enableCam: boolean, muteMic: boolean, mode: BgMode) => {
      if (segRafRef.current) {
        window.cancelAnimationFrame(segRafRef.current);
        segRafRef.current = 0;
      }

      // Stop old outbound stream if cloned canvas track
      if (outboundStreamRef.current) {
        outboundStreamRef.current.getTracks().forEach((t) => {
          if (!rawStreamRef.current?.getTracks().some((rt) => rt.id === t.id)) {
            try {
              t.stop();
            } catch {
              // ignore
            }
          }
        });
      }

      let raw = rawStreamRef.current;
      const needAudio = !raw || raw.getAudioTracks().length === 0;
      const needVideo = enableCam && (!raw || raw.getVideoTracks().length === 0);

      if ((needAudio || needVideo) && navigator.mediaDevices?.getUserMedia) {
        try {
          if (enableCam) {
            const acquired = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
              video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            });
            rawStreamRef.current?.getTracks().forEach((t) => t.stop());
            raw = acquired;
            rawStreamRef.current = raw;
          } else if (needAudio) {
            const acquired = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
              video: false,
            });
            rawStreamRef.current?.getTracks().forEach((t) => t.stop());
            raw = acquired;
            rawStreamRef.current = raw;
          }
        } catch {
          if (enableCam) {
            setStatusError('Camera unavailable on this device — using 3D Teddy Avatar & Voice.');
            setCameraOn(false);
            enableCam = false;
            try {
              if (!rawStreamRef.current) {
                raw = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                rawStreamRef.current = raw;
              }
            } catch {
              raw = new MediaStream();
              rawStreamRef.current = raw;
            }
          } else {
            raw = raw || new MediaStream();
            rawStreamRef.current = raw;
          }
        }
      }

      if (!raw) {
        raw = new MediaStream();
        rawStreamRef.current = raw;
      }

      raw.getAudioTracks().forEach((t) => {
        t.enabled = !muteMic;
      });
      raw.getVideoTracks().forEach((t) => {
        t.enabled = enableCam;
      });

      const actualCamActive = enableCam && raw.getVideoTracks().length > 0;

      if (actualCamActive) {
        if (!localVideoElRef.current) {
          const vid = document.createElement('video');
          vid.muted = true;
          vid.playsInline = true;
          vid.autoplay = true;
          localVideoElRef.current = vid;
        }
        const vid = localVideoElRef.current;
        if (vid.srcObject !== raw) {
          vid.srcObject = raw;
          void vid.play().catch(() => {});
        }

        if (mode === 'raw') {
          outboundStreamRef.current = raw;
          setMediaSources((prev) => ({ ...prev, [currentUser.id]: vid }));
        } else {
          // Real-time foreground portrait matte + blurred / virtual lounge backdrop on Canvas
          if (!segCanvasRef.current) {
            const c = document.createElement('canvas');
            c.width = 360;
            c.height = 270;
            segCanvasRef.current = c;
          }
          const canvas = segCanvasRef.current;
          const ctx = canvas.getContext('2d');

          const drawSegFrame = () => {
            if (!cameraOnRef.current || bgModeRef.current === 'raw') return;
            if (ctx && vid.readyState >= 2 && vid.videoWidth > 0) {
              const w = canvas.width;
              const h = canvas.height;
              ctx.save();
              if (bgModeRef.current === 'lounge') {
                // Luxury warm-lit private lounge virtual backdrop
                const bgGrad = ctx.createLinearGradient(0, 0, w, h);
                bgGrad.addColorStop(0, '#1e1612');
                bgGrad.addColorStop(0.5, '#13242b');
                bgGrad.addColorStop(1, '#0c1118');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = 'rgba(245, 158, 11, 0.16)';
                ctx.beginPath();
                ctx.arc(w * 0.5, h * 0.2, w * 0.38, 0, Math.PI * 2);
                ctx.fill();
              } else {
                // Privacy background blur
                ctx.filter = 'blur(12px) brightness(0.75)';
                ctx.drawImage(vid, 0, 0, w, h);
                ctx.filter = 'none';
              }

              // Soft portrait head-and-shoulders foreground mask
              ctx.save();
              ctx.beginPath();
              ctx.ellipse(w * 0.5, h * 0.42, w * 0.24, h * 0.34, 0, 0, Math.PI * 2);
              ctx.ellipse(w * 0.5, h * 0.92, w * 0.39, h * 0.36, 0, Math.PI, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(vid, 0, 0, w, h);
              ctx.restore();

              // Crisp foreground rim vignette
              ctx.strokeStyle = 'rgba(20, 184, 166, 0.35)';
              ctx.lineWidth = 3;
              ctx.strokeRect(2, 2, w - 4, h - 4);
              ctx.restore();
            }
            segRafRef.current = window.requestAnimationFrame(drawSegFrame);
          };
          drawSegFrame();

          const captured = canvas.captureStream ? canvas.captureStream(20) : new MediaStream();
          const outStream = new MediaStream();
          captured.getVideoTracks().forEach((vt) => outStream.addTrack(vt));
          raw.getAudioTracks().forEach((at) => outStream.addTrack(at));
          outboundStreamRef.current = outStream;
          setMediaSources((prev) => ({ ...prev, [currentUser.id]: canvas }));
        }
      } else {
        outboundStreamRef.current = raw;
        setMediaSources((prev) => ({ ...prev, [currentUser.id]: null }));
      }

      syncOutboundTracksToPeers();
      sendWsEvent('spy:media_state', { cameraOn: actualCamActive, micMuted: muteMic });
    },
    [currentUser.id, sendWsEvent, syncOutboundTracksToPeers]
  );

  // Clean up a single peer connection
  const closePeer = useCallback((peerUserId: string) => {
    const pc = peersRef.current.get(peerUserId);
    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
      } catch {
        // ignore
      }
      peersRef.current.delete(peerUserId);
    }
    queuedIceRef.current.delete(peerUserId);
    remoteStreamsRef.current.delete(peerUserId);
    const v = remoteVideosRef.current.get(peerUserId);
    if (v) {
      v.srcObject = null;
      remoteVideosRef.current.delete(peerUserId);
    }
    const a = remoteAudiosRef.current.get(peerUserId);
    if (a) {
      a.srcObject = null;
      remoteAudiosRef.current.delete(peerUserId);
    }
    setMediaSources((prev) => {
      if (!(peerUserId in prev)) return prev;
      const next = { ...prev };
      delete next[peerUserId];
      return next;
    });
  }, []);

  const ensurePeerConnection = useCallback(
    (peerUserId: string, initiateOffer: boolean) => {
      let pc = peersRef.current.get(peerUserId);
      if (pc) return pc;

      pc = new RTCPeerConnection({ iceServers: iceConfigRef.current });
      peersRef.current.set(peerUserId, pc);

      const outStream = outboundStreamRef.current || rawStreamRef.current;
      if (outStream) {
        outStream.getTracks().forEach((t) => pc!.addTrack(t, outStream));
      }
      if (!outStream || outStream.getAudioTracks().length === 0) {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      if (!outStream || outStream.getVideoTracks().length === 0) {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }

      const remoteStream = new MediaStream();
      remoteStreamsRef.current.set(peerUserId, remoteStream);

      pc.ontrack = (event) => {
        event.streams.forEach((s) => {
          s.getTracks().forEach((t) => {
            if (!remoteStream.getTracks().some((ex) => ex.id === t.id)) {
              remoteStream.addTrack(t);
            }
          });
        });
        if (event.track && !remoteStream.getTracks().some((ex) => ex.id === event.track.id)) {
          remoteStream.addTrack(event.track);
        }

        if (event.track.kind === 'video') {
          let vid = remoteVideosRef.current.get(peerUserId);
          if (!vid) {
            vid = document.createElement('video');
            vid.muted = true;
            vid.playsInline = true;
            vid.autoplay = true;
            remoteVideosRef.current.set(peerUserId, vid);
          }
          vid.srcObject = remoteStream;
          void vid.play().catch(() => {});
          setMediaSources((prev) => ({ ...prev, [peerUserId]: vid! }));
        }
        if (event.track.kind === 'audio') {
          let aud = remoteAudiosRef.current.get(peerUserId);
          if (!aud) {
            aud = document.createElement('audio');
            aud.autoplay = true;
            remoteAudiosRef.current.set(peerUserId, aud);
          }
          aud.srcObject = remoteStream;
          void aud.play().catch(() => {});
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWsEvent('spy:webrtc_signal', {
            targetUserId: peerUserId,
            signalType: 'ice',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      if (initiateOffer) {
        pc.createOffer()
          .then((offer) => pc!.setLocalDescription(offer).then(() => offer))
          .then((offer) => {
            sendWsEvent('spy:webrtc_signal', {
              targetUserId: peerUserId,
              signalType: 'offer',
              sdp: offer,
            });
          })
          .catch(() => {});
      }

      return pc;
    },
    [sendWsEvent]
  );

  // Maintain WebRTC mesh connections matching seated real players
  useEffect(() => {
    if (!roomState) return;
    const activePeerIds = new Set(
      roomState.players.filter((p) => p.userId !== currentUser.id).map((p) => p.userId)
    );

    for (const existingPeer of Array.from(peersRef.current.keys())) {
      if (!activePeerIds.has(existingPeer)) {
        closePeer(existingPeer);
      }
    }

    for (const peerId of activePeerIds) {
      if (!peersRef.current.has(peerId)) {
        const shouldInitiate = currentUser.id < peerId;
        ensurePeerConnection(peerId, shouldInitiate);
      }
    }
  }, [roomState?.players, currentUser.id, closePeer, ensurePeerConnection]);

  // Enter matchmaking + attach WebSocket listener cleanly
  useEffect(() => {
    const unsubscribe = subscribeSpyEvents((evt) => {
      if (evt.type === 'spy:state' && evt.state) {
        setRoomState(evt.state);
        setStatusError('');
      } else if (evt.type === 'spy:secret' && evt.secret) {
        setSecret(evt.secret);
      } else if (evt.type === 'spy:error' && evt.message) {
        setStatusError(String(evt.message));
      } else if (evt.type === 'spy:webrtc_signal' && evt.fromUserId) {
        const fromId = String(evt.fromUserId);
        const signalType = String(evt.signalType || '');
        if (signalType === 'offer' && evt.sdp) {
          const pc = ensurePeerConnection(fromId, false);
          pc.setRemoteDescription(new RTCSessionDescription(evt.sdp))
            .then(async () => {
              const queued = queuedIceRef.current.get(fromId) || [];
              queuedIceRef.current.delete(fromId);
              for (const c of queued) {
                await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
              }
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              sendWsEvent('spy:webrtc_signal', {
                targetUserId: fromId,
                signalType: 'answer',
                sdp: answer,
              });
            })
            .catch(() => {});
        } else if (signalType === 'answer' && evt.sdp) {
          const pc = peersRef.current.get(fromId);
          if (pc && pc.signalingState !== 'stable') {
            pc.setRemoteDescription(new RTCSessionDescription(evt.sdp))
              .then(async () => {
                const queued = queuedIceRef.current.get(fromId) || [];
                queuedIceRef.current.delete(fromId);
                for (const c of queued) {
                  await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
                }
              })
              .catch(() => {});
          }
        } else if (signalType === 'ice' && evt.candidate) {
          const pc = peersRef.current.get(fromId);
          if (pc && pc.remoteDescription) {
            void pc.addIceCandidate(new RTCIceCandidate(evt.candidate)).catch(() => {});
          } else {
            const list = queuedIceRef.current.get(fromId) || [];
            list.push(evt.candidate);
            queuedIceRef.current.set(fromId, list);
          }
        }
      }
    });

    // Trigger automatic queue join via REST (immediate sync) + WS subscription
    api
      .joinLiveSpyQueue(capacity)
      .then((res) => {
        if (res.state) setRoomState(res.state);
      })
      .catch((err: any) => {
        setStatusError(err?.message || 'Unable to enter LIVE SPY matchmaking.');
      });
    sendWsEvent('spy:join_queue', { capacity });

    // Start microphone (camera stays OFF initially showing 3D Teddy Avatar until user turns cam ON)
    void rebuildLocalPipeline(false, false, bgModeRef.current);

    return () => {
      unsubscribe();
      if (segRafRef.current) window.cancelAnimationFrame(segRafRef.current);
      for (const peerId of Array.from(peersRef.current.keys())) {
        closePeer(peerId);
      }
      rawStreamRef.current?.getTracks().forEach((t) => t.stop());
      outboundStreamRef.current?.getTracks().forEach((t) => t.stop());
      rawStreamRef.current = null;
      outboundStreamRef.current = null;
      sendWsEvent('spy:leave_queue', {});
      void api.leaveLiveSpyRoom().catch(() => {});
    };
  }, [capacity]);

  const handleExitGame = useCallback(() => {
    sendWsEvent('spy:leave_queue', {});
    void api.leaveLiveSpyRoom().catch(() => {});
    onExit();
  }, [onExit, sendWsEvent]);

  useBackHandler('live-spy-game', true, handleExitGame, 30);

  const handleToggleCamera = () => {
    const nextCam = !cameraOn;
    setCameraOn(nextCam);
    void rebuildLocalPipeline(nextCam, micMuted, bgMode);
  };

  const handleToggleMic = () => {
    const nextMuted = !micMuted;
    setMicMuted(nextMuted);
    void rebuildLocalPipeline(cameraOn, nextMuted, bgMode);
  };

  const handleCycleBgMode = () => {
    const next: BgMode = bgMode === 'lounge' ? 'blur' : bgMode === 'blur' ? 'raw' : 'lounge';
    setBgMode(next);
    if (cameraOn) {
      void rebuildLocalPipeline(true, micMuted, next);
    }
  };

  const handleSubmitClue = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = clueInput.trim();
    if (!clean) return;
    sendWsEvent('spy:submit_clue', { clue: clean });
    setClueInput('');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;
    sendWsEvent('spy:chat', { text: clean });
    setChatInput('');
  };

  const mySeat = useMemo(
    () => roomState?.players.find((p) => p.userId === currentUser.id) || null,
    [roomState, currentUser.id]
  );

  const secondsLeft = roomState?.phaseEndsAt
    ? Math.max(0, Math.ceil((roomState.phaseEndsAt - nowMs) / 1000))
    : 0;

  const phaseLabel = useMemo(() => {
    if (!roomState) return 'Connecting...';
    switch (roomState.phase) {
      case 'waiting':
        return `Waiting (${roomState.players.length}/${roomState.capacity})`;
      case 'countdown':
        return `Starting in ${Math.max(1, roomState.countdownSec || 1)}`;
      case 'role_reveal':
        return `Secret Roles · ${secondsLeft}s`;
      case 'clue':
        return `Clue Round ${roomState.round} · ${secondsLeft}s`;
      case 'discussion':
        return `Discussion · ${secondsLeft}s`;
      case 'voting':
        return `Voting · ${secondsLeft}s`;
      case 'elimination':
        return `Verdict · ${secondsLeft}s`;
      case 'winner':
        return roomState.winner === 'citizens' ? 'Citizens Win!' : 'Spy Wins!';
    }
  }, [roomState, secondsLeft]);

  return (
    <div
      data-testid="live-spy-game-view"
      className="fixed inset-0 z-50 bg-[#0b0e14] text-slate-100 flex flex-col overflow-hidden"
    >
      {/* Full-bleed 3D Private Lounge Viewport */}
      <div className="flex-1 relative min-h-0">
        <LiveSpyLounge3D
          roomState={roomState}
          currentUserId={currentUser.id}
          cameraPreset={cameraPreset}
          mediaSources={mediaSources}
        />

        {/* Top Compact Floating HUD (Opaque dark-slate surfaces, zero backdrop-blur over WebGL) */}
        <div className="absolute top-0 left-0 right-0 p-2.5 sm:p-3.5 flex items-center justify-between gap-2 pointer-events-none z-10">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              data-testid="live-spy-exit-btn"
              onClick={handleExitGame}
              className="min-h-[42px] px-3 rounded-xl bg-[#0e1522]/95 border border-white/15 hover:border-teal-400/50 text-slate-100 text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Exit</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0e1522]/95 border border-white/15">
              <LiveSpyEmblem className="w-6 h-6" />
              <span className="text-xs font-extrabold tracking-wide text-amber-400">LIVE SPY</span>
            </div>
          </div>

          {/* Center Public Match Telemetry */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div
              data-testid="live-spy-player-count"
              className="px-3 py-1.5 rounded-xl bg-[#0e1522]/95 border border-teal-500/40 text-xs font-extrabold text-teal-300 flex items-center gap-1.5 shadow-lg"
            >
              <Users className="w-3.5 h-3.5" />
              <span>
                {roomState ? `${roomState.players.length}/${roomState.capacity} PLAYERS` : `0/${capacity} PLAYERS`}
              </span>
            </div>

            <div
              data-testid="live-spy-phase-badge"
              className="px-3 py-1.5 rounded-xl bg-[#0e1522]/95 border border-amber-500/40 text-xs font-extrabold text-amber-300 shadow-lg"
            >
              {phaseLabel}
            </div>
          </div>

          {/* Camera View Preset Switcher */}
          <div className="hidden md:flex items-center gap-1 bg-[#0e1522]/95 border border-white/15 rounded-xl p-1 pointer-events-auto">
            {(
              [
                { id: 'overview', label: 'Lounge' },
                { id: 'screen', label: 'Screen' },
                { id: 'overhead', label: 'Table' },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setCameraPreset(preset.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                  cameraPreset === preset.id
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Private Role & Secret Word Floating Toggle (Strictly visible ONLY to local player when tapped) */}
        {secret && roomState && roomState.phase !== 'waiting' && roomState.phase !== 'countdown' && (
          <div className="absolute top-16 left-2.5 sm:left-3.5 z-10 pointer-events-auto max-w-[290px]">
            <button
              type="button"
              data-testid="live-spy-secret-toggle"
              onClick={() => setShowSecretPeek((v) => !v)}
              className={`px-3 py-2 rounded-xl border text-left shadow-xl transition-colors flex items-center gap-2 ${
                showSecretPeek
                  ? secret.role === 'spy'
                    ? 'bg-[#2a1015]/95 border-red-500/60 text-red-100'
                    : 'bg-[#0c2424]/95 border-teal-400/60 text-teal-100'
                  : 'bg-[#0e1522]/95 border-white/20 text-slate-200 hover:border-teal-400/50'
              }`}
            >
              {showSecretPeek ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0 text-teal-400" />}
              <div className="min-w-0">
                {showSecretPeek ? (
                  <>
                    <p className="text-[11px] font-black uppercase tracking-wider">
                      {secret.role === 'spy' ? 'YOU ARE THE SPY' : `CITIZEN · ${secret.category}`}
                    </p>
                    <p className="text-xs font-extrabold text-amber-300 truncate">
                      {secret.role === 'spy' ? 'No secret word — blend in!' : `Secret Word: ${secret.secretWord}`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-bold">Tap to Peek Private Role</p>
                )}
              </div>
            </button>
          </div>
        )}

        {/* Right Side Media Controls Strip (Mic, Camera, Virtual BG, In-Room Chat) */}
        <div className="absolute top-16 right-2.5 sm:right-3.5 z-10 flex flex-col gap-2 pointer-events-auto">
          <button
            type="button"
            data-testid="live-spy-mic-btn"
            onClick={handleToggleMic}
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shadow-lg transition-colors ${
              micMuted
                ? 'bg-red-950/90 border-red-500/50 text-red-300'
                : 'bg-[#0e1522]/95 border-white/15 text-teal-300 hover:border-teal-400/50'
            }`}
            title={micMuted ? 'Unmute Mic' : 'Mute Mic'}
            aria-label={micMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {micMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            type="button"
            data-testid="live-spy-camera-btn"
            onClick={handleToggleCamera}
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shadow-lg transition-colors ${
              cameraOn
                ? 'bg-teal-950/90 border-teal-400/60 text-teal-300'
                : 'bg-[#0e1522]/95 border-white/15 text-slate-300 hover:border-amber-400/50'
            }`}
            title={cameraOn ? 'Turn Camera Off (Show 3D Teddy)' : 'Turn Camera On'}
            aria-label={cameraOn ? 'Turn Camera Off' : 'Turn Camera On'}
          >
            {cameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={handleCycleBgMode}
            className="w-11 h-11 rounded-xl bg-[#0e1522]/95 border border-white/15 text-[10px] font-extrabold text-amber-300 flex flex-col items-center justify-center shadow-lg"
            title={`Virtual Background: ${bgMode.toUpperCase()}`}
            aria-label="Toggle Background Segmentation Mode"
          >
            <Sparkles className="w-3.5 h-3.5 mb-0.5" />
            <span>{bgMode === 'lounge' ? 'BG' : bgMode === 'blur' ? 'BLUR' : 'RAW'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowChatDrawer((s) => !s)}
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shadow-lg relative ${
              showChatDrawer
                ? 'bg-teal-600 text-slate-950 border-teal-300'
                : 'bg-[#0e1522]/95 border-white/15 text-slate-200'
            }`}
            title="Toggle Room Chat"
            aria-label="Toggle Room Chat"
          >
            <MessageSquare className="w-5 h-5" />
            {(roomState?.messages.length || 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                {Math.min(9, roomState!.messages.length)}
              </span>
            )}
          </button>
        </div>

        {/* Center Countdown Overlay Pulse during 3-2-1 Lock */}
        {roomState?.phase === 'countdown' && (
          <div
            data-testid="live-spy-countdown-overlay"
            className="absolute inset-x-0 top-1/3 flex flex-col items-center justify-center pointer-events-none z-10"
          >
            <div className="px-7 py-5 rounded-3xl bg-[#0b1320]/95 border-2 border-amber-400 shadow-2xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-widest text-teal-300">
                {roomState.capacity}/{roomState.capacity} Real Players Joined · Match Locked
              </p>
              <p className="text-6xl font-black text-white mt-1">
                {Math.max(1, roomState.countdownSec || 1)}
              </p>
            </div>
          </div>
        )}

        {/* Expandable Room Text Chat Panel */}
        {showChatDrawer && roomState && (
          <div className="absolute right-16 top-16 bottom-4 w-72 max-w-[calc(100vw-5.5rem)] bg-[#0d1421]/96 border border-white/15 rounded-2xl p-3 flex flex-col z-20 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <span className="text-xs font-extrabold text-teal-300">Lounge Chat</span>
              <button
                type="button"
                onClick={() => setShowChatDrawer(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 space-y-2 text-xs">
              {roomState.messages.length === 0 ? (
                <p className="text-slate-400 text-[11px] text-center py-6">
                  Discuss clues or bluff live in voice and chat.
                </p>
              ) : (
                roomState.messages.map((m) => (
                  <div key={m.id} className="bg-white/5 rounded-xl px-2.5 py-1.5">
                    <span className="font-bold text-amber-300">{m.displayName}: </span>
                    <span className="text-slate-100">{m.text}</span>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleSendChat} className="pt-2 flex items-center gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Say something..."
                maxLength={180}
                className="flex-1 bg-[#141d2e] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-400"
              />
              <button
                type="submit"
                className="w-9 h-9 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Interactive Phase Control Dock */}
      <div className="bg-[#0d131f] border-t border-white/12 px-3 sm:px-5 py-3 z-20">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {statusError && (
            <div className="px-3 py-2 rounded-xl bg-red-950/80 border border-red-500/40 text-xs font-semibold text-red-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{statusError}</span>
            </div>
          )}

          {/* Phase 1: Waiting Room */}
          {(!roomState || roomState.phase === 'waiting') && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                  <p className="text-sm font-extrabold text-white">
                    {roomState
                      ? `Waiting for real players (${roomState.players.length}/${roomState.capacity})...`
                      : `Joining ${capacity}-Player Automatic Matchmaking...`}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Camera off displays your 3D Teddy Avatar. Match starts with a 3-2-1 countdown once all {capacity} seats fill.
                </p>
                {roomState && roomState.players.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {roomState.players.map((p) => (
                      <span
                        key={p.userId}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          p.userId === currentUser.id
                            ? 'bg-teal-950/80 border-teal-400/50 text-teal-200'
                            : 'bg-slate-800/80 border-white/10 text-slate-200'
                        }`}
                      >
                        Seat {p.seatIndex + 1}: {p.displayName}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="min-h-[42px] px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 flex items-center gap-1.5 border border-white/10"
                >
                  <Video className="w-4 h-4 text-teal-400" />
                  <span>{cameraOn ? 'Cam ON' : 'Test Cam'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExitGame}
                  className="min-h-[42px] px-4 rounded-xl bg-red-950/70 hover:bg-red-900/80 border border-red-500/40 text-xs font-bold text-red-200"
                >
                  Leave Queue
                </button>
              </div>
            </div>
          )}

          {/* Phase 2: Role Reveal */}
          {roomState?.phase === 'role_reveal' && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Category: {roomState.category}
                </p>
                <p className="text-sm font-extrabold text-white mt-0.5">
                  {secret?.role === 'spy'
                    ? 'You are the SPY — stay calm and deduce the Citizens’ word!'
                    : `Secret Word: ${secret?.secretWord || 'Loading...'}`}
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-xl bg-teal-950/80 border border-teal-500/40 text-xs font-bold text-teal-200">
                Clue round begins in {secondsLeft}s
              </span>
            </div>
          )}

          {/* Phase 3: Clue Submission */}
          {roomState?.phase === 'clue' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-amber-300">
                  ROUND {roomState.round} · CATEGORY: {roomState.category.toUpperCase()} · CLUE SUBMISSION
                </p>
                {roomState.clues.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {roomState.clues.map((c) => (
                      <span
                        key={`${c.round}_${c.userId}`}
                        className="px-2.5 py-1 rounded-lg bg-[#162033] border border-white/10 text-[11px] font-semibold"
                      >
                        <strong className="text-teal-300">{c.displayName}:</strong> {c.clue}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {mySeat?.alive ? (
                mySeat.clueSubmitted ? (
                  <div className="px-3 py-2.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-xs font-bold text-teal-200 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>Clue submitted! Waiting for remaining teammates ({secondsLeft}s)...</span>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitClue} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={clueInput}
                      onChange={(e) => setClueInput(e.target.value)}
                      placeholder={
                        secret?.role === 'spy'
                          ? `Blend in! Enter a subtle clue for "${roomState.category}"...`
                          : 'Enter a short clue without revealing the exact secret word...'
                      }
                      maxLength={48}
                      className="flex-1 bg-[#141d2e] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-400"
                    />
                    <button
                      type="submit"
                      className="min-h-[42px] px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold whitespace-nowrap"
                    >
                      Submit Clue
                    </button>
                  </form>
                )
              ) : (
                <p className="text-xs text-slate-400">
                  You were eliminated — observing Clue Round ({secondsLeft}s).
                </p>
              )}
            </div>
          )}

          {/* Phase 4: Discussion */}
          {roomState?.phase === 'discussion' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="space-y-1.5 flex-1 min-w-0">
                <p className="text-xs font-extrabold text-teal-300">
                  LIVE DISCUSSION · SPOT THE SPY ({secondsLeft}s)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {roomState.clues.length === 0 ? (
                    <span className="text-xs text-slate-400">No clues submitted this round.</span>
                  ) : (
                    roomState.clues.map((c) => (
                      <span
                        key={`${c.round}_${c.userId}`}
                        className="px-2.5 py-1 rounded-lg bg-[#162033] border border-white/10 text-xs"
                      >
                        <strong className="text-amber-300">{c.displayName}:</strong> {c.clue}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {mySeat?.alive && (
                <button
                  type="button"
                  disabled={mySeat.readyToVote}
                  onClick={() => sendWsEvent('spy:ready_to_vote', {})}
                  className={`min-h-[42px] px-4 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shrink-0 ${
                    mySeat.readyToVote
                      ? 'bg-teal-950/70 border border-teal-500/40 text-teal-200'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  <Vote className="w-4 h-4" />
                  <span>{mySeat.readyToVote ? 'Ready to Vote ✓' : 'Ready to Vote'}</span>
                </button>
              )}
            </div>
          )}

          {/* Phase 5: Voting */}
          {roomState?.phase === 'voting' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-extrabold text-red-400">
                  VOTING ROUND · WHO IS THE SPY? ({secondsLeft}s)
                </p>
                {mySeat?.hasVoted && (
                  <span className="text-xs font-bold text-teal-300">Vote Locked ✓</span>
                )}
              </div>

              {mySeat?.alive && !mySeat.hasVoted ? (
                <div className="flex flex-wrap gap-2">
                  {roomState.players
                    .filter((p) => p.alive && p.userId !== currentUser.id)
                    .map((candidate) => (
                      <button
                        key={candidate.userId}
                        type="button"
                        onClick={() => sendWsEvent('spy:vote', { targetUserId: candidate.userId })}
                        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#162033] hover:bg-red-950/80 border border-white/15 hover:border-red-400/60 text-xs font-bold text-slate-100 flex items-center gap-2 transition-colors"
                      >
                        {candidate.avatar ? (
                          <img
                            src={candidate.avatar}
                            alt={candidate.displayName}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {(candidate.displayName || 'P').slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span>Vote {candidate.displayName}</span>
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => sendWsEvent('spy:vote', { targetUserId: 'skip' })}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-bold text-slate-300"
                  >
                    Skip Vote
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-300">
                  Waiting for remaining players to cast their votes...
                </p>
              )}
            </div>
          )}

          {/* Phase 6: Elimination Reveal */}
          {roomState?.phase === 'elimination' && roomState.eliminatedThisRound && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-amber-300">
                  {roomState.eliminatedThisRound.eliminatedName
                    ? `${roomState.eliminatedThisRound.eliminatedName} was eliminated — they were ${
                        roomState.eliminatedThisRound.revealedRole === 'spy' ? 'THE SPY!' : 'a CITIZEN.'
                      }`
                    : roomState.eliminatedThisRound.reason === 'tie'
                      ? 'Vote ended in a tie — nobody was eliminated.'
                      : 'No votes cast — nobody was eliminated.'}
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400 shrink-0">
                Next phase in {secondsLeft}s
              </span>
            </div>
          )}

          {/* Phase 7: Winner Announcement & Play Again */}
          {roomState?.phase === 'winner' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-base font-black text-white">
                    {roomState.winner === 'citizens' ? 'CITIZENS WIN THE MATCH!' : 'THE SPY WINS THE MATCH!'}
                  </p>
                  {roomState.finalReveal && (
                    <p className="text-xs text-slate-300">
                      Spy: <strong className="text-red-300">{roomState.finalReveal.spyDisplayName}</strong> ·
                      Secret Word: <strong className="text-teal-300">{roomState.finalReveal.secretWord}</strong>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  data-testid="live-spy-play-again-btn"
                  onClick={() => {
                    setSecret(null);
                    setShowSecretPeek(false);
                    sendWsEvent('spy:play_again', { capacity });
                  }}
                  className="min-h-[42px] px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Play Again</span>
                </button>
                <button
                  type="button"
                  onClick={handleExitGame}
                  className="min-h-[42px] px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/15 text-xs font-bold text-slate-100"
                >
                  Games Hub
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
