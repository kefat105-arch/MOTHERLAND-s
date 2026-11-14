import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Conversation, UserProfile } from '../types';
import {
  unlockSoundEngine,
  startCallRingtoneLoop,
  stopCallRingtones,
  playCallConnectedChime,
  playCallEndedChime,
} from '../utils/motherlandSoundEngine';

export type CallPhase =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'ended';

export interface ActiveCallSession {
  callId: string;
  conversationId: string;
  peerUserId: string;
  peerName: string;
  peerAvatar: string;
  isGroupCall: boolean;
  groupName?: string;
  callType: 'audio' | 'video';
  phase: CallPhase;
  durationSeconds: number;
  isMuted: boolean;
  isCameraOff: boolean;
  facingMode: 'user' | 'environment';
  remoteMuted: boolean;
  remoteCameraOff: boolean;
  hasTurn: boolean;
  statusNote?: string;
  error?: string;
}

interface UseWebRTCParams {
  currentUser: UserProfile | null;
  sendWsEvent: (event: string, payload: Record<string, any>) => boolean;
  onCallEnded?: () => void;
}

export function useWebRTC({ currentUser, sendWsEvent, onCallEnded }: UseWebRTCParams) {
  const [call, setCall] = useState<ActiveCallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<ActiveCallSession | null>(null);
  const pendingOfferRef = useRef<{ sdp: RTCSessionDescriptionInit; callId: string } | null>(null);
  const queuedIceRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<number | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const endClearTimerRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<CallPhase>('idle');

  callRef.current = call;

  const stopTracks = (stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        // ignore
      }
    });
  };

  const cleanupPeerAndMedia = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    queuedIceRef.current = [];
    pendingOfferRef.current = null;

    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
    }

    stopTracks(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);

    stopTracks(remoteStreamRef.current);
    remoteStreamRef.current = null;
    setRemoteStream(null);
  }, []);

  const finishCallUI = useCallback(
    (finalPhase: 'ended' | 'failed', note?: string) => {
      cleanupPeerAndMedia();
      setCall((prev) =>
        prev
          ? {
              ...prev,
              phase: finalPhase,
              statusNote: note || prev.statusNote,
            }
          : null
      );
      if (endClearTimerRef.current) window.clearTimeout(endClearTimerRef.current);
      endClearTimerRef.current = window.setTimeout(() => {
        setCall(null);
        onCallEnded?.();
      }, finalPhase === 'failed' ? 5000 : 1800);
    },
    [cleanupPeerAndMedia, onCallEnded]
  );

  const startDurationTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = window.setInterval(() => {
      setCall((prev) => {
        if (!prev || prev.phase !== 'connected') return prev;
        return { ...prev, durationSeconds: prev.durationSeconds + 1 };
      });
    }, 1000);
  }, []);

  const createPeerConnection = useCallback(
    async (
      callId: string,
      conversationId: string,
      peerUserId: string,
      callType: 'audio' | 'video',
      stream: MediaStream
    ) => {
      const cfg = await api.getWebRtcConfig().catch(() => ({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
        hasTurn: false,
      }));

      setCall((prev) => (prev ? { ...prev, hasTurn: Boolean(cfg.hasTurn) } : prev));

      const pc = new RTCPeerConnection({ iceServers: cfg.iceServers });
      pcRef.current = pc;

      const remote = new MediaStream();
      remoteStreamRef.current = remote;
      setRemoteStream(remote);

      const tracks = stream.getTracks();
      if (tracks.length > 0) {
        tracks.forEach((track) => {
          pc.addTrack(track, stream);
        });
      }
      if (!tracks.some((t) => t.kind === 'audio')) {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      if (callType === 'video' && !tracks.some((t) => t.kind === 'video')) {
        pc.addTransceiver('video', { direction: 'recvonly' });
      }

      pc.ontrack = (event) => {
        event.streams.forEach((s) => {
          s.getTracks().forEach((t) => {
            if (!remote.getTracks().some((existing) => existing.id === t.id)) {
              remote.addTrack(t);
            }
          });
        });
        if (event.track && !remote.getTracks().some((existing) => existing.id === event.track.id)) {
          remote.addTrack(event.track);
        }
        // Trigger React update with fresh MediaStream wrapper sharing tracks
        setRemoteStream(new MediaStream(remote.getTracks()));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendWsEvent('call:signal', {
            callId,
            conversationId,
            targetUserId: peerUserId,
            callType,
            signalType: 'ice',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          if (ringTimeoutRef.current) {
            window.clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
          }
          setCall((prev) =>
            prev
              ? {
                  ...prev,
                  phase: 'connected',
                  statusNote: undefined,
                }
              : prev
          );
          startDurationTimer();
        } else if (state === 'connecting') {
          setCall((prev) =>
            prev && prev.phase !== 'connected'
              ? { ...prev, phase: 'connecting', statusNote: 'Establishing encrypted media stream...' }
              : prev
          );
        } else if (state === 'disconnected') {
          setCall((prev) =>
            prev && prev.phase === 'connected'
              ? { ...prev, phase: 'reconnecting', statusNote: 'Connection interrupted, reconnecting...' }
              : prev
          );
        } else if (state === 'failed') {
          finishCallUI(
            'failed',
            cfg.hasTurn
              ? 'Peer media connection failed.'
              : 'Media relay failed across NAT/firewall (no TURN server configured).'
          );
        } else if (state === 'closed') {
          if (callRef.current && callRef.current.phase !== 'ended' && callRef.current.phase !== 'failed') {
            finishCallUI('ended', 'Call ended');
          }
        }
      };

      return pc;
    },
    [finishCallUI, sendWsEvent, startDurationTimer]
  );

  const acquireUserMedia = useCallback(
    async (
      wantVideo: boolean,
      facingMode: 'user' | 'environment' = 'user'
    ): Promise<{ stream: MediaStream; actualVideo: boolean; actualAudio: boolean; fallbackNote?: string }> => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return {
          stream: new MediaStream(),
          actualVideo: false,
          actualAudio: false,
          fallbackNote: 'Microphone/camera unavailable in this browser context — listen-only mode.',
        };
      }
      if (wantVideo) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          return { stream, actualVideo: true, actualAudio: true };
        } catch (err: any) {
          // Graceful fallback to audio-only if camera denied or missing
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
              video: false,
            });
            return {
              stream: audioStream,
              actualVideo: false,
              actualAudio: true,
              fallbackNote: 'Camera unavailable — continuing as voice call.',
            };
          } catch (audioErr: any) {
            const name = audioErr?.name || err?.name || '';
            if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
              throw new Error('Microphone & camera permission denied. Please allow access in browser settings.');
            }
            return {
              stream: new MediaStream(),
              actualVideo: false,
              actualAudio: false,
              fallbackNote: 'No camera/microphone detected — joined in listen-only mode.',
            };
          }
        }
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        return { stream, actualVideo: false, actualAudio: true };
      } catch (audioErr: any) {
        const name = audioErr?.name || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          throw new Error('Microphone permission denied. Please allow microphone access in browser settings.');
        }
        return {
          stream: new MediaStream(),
          actualVideo: false,
          actualAudio: false,
          fallbackNote: 'No microphone detected — joined in listen-only mode.',
        };
      }
    },
    []
  );

  const flushQueuedIce = async (pc: RTCPeerConnection) => {
    const queue = queuedIceRef.current.splice(0, queuedIceRef.current.length);
    for (const c of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // ignore stale candidate
      }
    }
  };

  const startCall = useCallback(
    async (conv: Conversation, callType: 'audio' | 'video') => {
      if (!currentUser) return;
      if (callRef.current) return;
      // Synchronously unlock Web Audio on caller's button tap so outgoing ringback plays immediately
      void unlockSoundEngine();

      const peer = conv.participants.find((p) => p.id !== currentUser.id);
      if (!peer) {
        setCall({
          callId: `call_${Date.now()}`,
          conversationId: conv.id,
          peerUserId: currentUser.id,
          peerName: conv.name || currentUser.displayName,
          peerAvatar: currentUser.avatar,
          isGroupCall: Boolean(conv.isGroup),
          callType,
          phase: 'failed',
          durationSeconds: 0,
          isMuted: true,
          isCameraOff: true,
          facingMode: 'user',
          remoteMuted: false,
          remoteCameraOff: true,
          hasTurn: false,
          statusNote: 'No other member in this conversation to call.',
        });
        if (endClearTimerRef.current) window.clearTimeout(endClearTimerRef.current);
        endClearTimerRef.current = window.setTimeout(() => setCall(null), 3500);
        return;
      }

      const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const isGroup = Boolean(conv.isGroup);

      setCall({
        callId,
        conversationId: conv.id,
        peerUserId: peer.id,
        peerName: isGroup ? conv.name || 'Wave Group' : peer.displayName,
        peerAvatar: isGroup ? conv.photo || peer.avatar : peer.avatar,
        isGroupCall: isGroup,
        groupName: isGroup ? conv.name : undefined,
        callType,
        phase: 'outgoing',
        durationSeconds: 0,
        isMuted: false,
        isCameraOff: callType === 'audio',
        facingMode: 'user',
        remoteMuted: false,
        remoteCameraOff: callType === 'audio',
        hasTurn: false,
        statusNote: isGroup
          ? 'Ringing group member (peer-to-peer WebRTC; large multi-party calls require SFU media server)...'
          : 'Ringing...',
      });

      try {
        const { stream, actualVideo, actualAudio, fallbackNote } = await acquireUserMedia(
          callType === 'video',
          'user'
        );
        localStreamRef.current = stream;
        setLocalStream(stream);
        if ((callType === 'video' && !actualVideo) || !actualAudio || fallbackNote) {
          setCall((prev) =>
            prev
              ? {
                  ...prev,
                  callType: actualVideo ? 'video' : 'audio',
                  isCameraOff: !actualVideo,
                  isMuted: !actualAudio,
                  statusNote: fallbackNote || prev.statusNote,
                }
              : prev
          );
        }

        const effectiveCallType = actualVideo ? 'video' : 'audio';
        const pc = await createPeerConnection(callId, conv.id, peer.id, effectiveCallType, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const signalPayload = {
          callId,
          conversationId: conv.id,
          targetUserId: isGroup ? undefined : peer.id,
          callType: effectiveCallType,
          signalType: 'offer',
          sdp: offer,
        };

        let sent = sendWsEvent('call:signal', signalPayload);
        for (let attempt = 0; !sent && attempt < 8; attempt++) {
          await new Promise((r) => window.setTimeout(r, 300));
          const latestCall = callRef.current as ActiveCallSession | null;
          if (!latestCall || latestCall.callId !== callId) return;
          sent = sendWsEvent('call:signal', signalPayload);
        }

        if (!sent) {
          throw new Error('Realtime Wave socket is reconnecting. Please try again in a moment.');
        }

        if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = window.setTimeout(() => {
          const cur = callRef.current;
          if (cur && cur.callId === callId && cur.phase === 'outgoing') {
            sendWsEvent('call:signal', {
              callId,
              conversationId: conv.id,
              callType: cur.callType,
              signalType: 'missed',
              durationSeconds: 0,
            });
            finishCallUI('ended', 'No answer');
          }
        }, 40000);
      } catch (err: any) {
        finishCallUI('failed', err?.message || 'Microphone/Camera permission denied or unavailable.');
      }
    },
    [acquireUserMedia, createPeerConnection, currentUser, finishCallUI, sendWsEvent]
  );

  const acceptIncomingCall = useCallback(async () => {
    const cur = callRef.current;
    const pending = pendingOfferRef.current;
    if (!cur || cur.phase !== 'incoming' || !pending) return;

    void unlockSoundEngine();
    stopCallRingtones();
    setCall((prev) => (prev ? { ...prev, phase: 'connecting', statusNote: 'Connecting media...' } : prev));
    try {
      const { stream, actualVideo, actualAudio, fallbackNote } = await acquireUserMedia(
        cur.callType === 'video',
        cur.facingMode
      );
      localStreamRef.current = stream;
      setLocalStream(stream);
      if ((cur.callType === 'video' && !actualVideo) || !actualAudio || fallbackNote) {
        setCall((prev) =>
          prev
            ? {
                ...prev,
                isCameraOff: !actualVideo,
                isMuted: !actualAudio,
                callType: actualVideo ? 'video' : 'audio',
                statusNote: fallbackNote || prev.statusNote,
              }
            : prev
        );
      }

      const pc = await createPeerConnection(
        cur.callId,
        cur.conversationId,
        cur.peerUserId,
        actualVideo ? 'video' : 'audio',
        stream
      );

      await pc.setRemoteDescription(new RTCSessionDescription(pending.sdp));
      await flushQueuedIce(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendWsEvent('call:signal', {
        callId: cur.callId,
        conversationId: cur.conversationId,
        targetUserId: cur.peerUserId,
        callType: actualVideo ? 'video' : 'audio',
        signalType: 'accept',
        sdp: answer,
      });
    } catch (err: any) {
      sendWsEvent('call:signal', {
        callId: cur.callId,
        conversationId: cur.conversationId,
        targetUserId: cur.peerUserId,
        callType: cur.callType,
        signalType: 'decline',
      });
      finishCallUI('failed', err?.message || 'Unable to access microphone/camera.');
    }
  }, [acquireUserMedia, createPeerConnection, finishCallUI, sendWsEvent]);

  const declineIncomingCall = useCallback(() => {
    const cur = callRef.current;
    if (!cur) return;
    sendWsEvent('call:signal', {
      callId: cur.callId,
      conversationId: cur.conversationId,
      targetUserId: cur.peerUserId,
      callType: cur.callType,
      signalType: 'decline',
    });
    finishCallUI('ended', 'Call declined');
  }, [finishCallUI, sendWsEvent]);

  const endCall = useCallback(() => {
    const cur = callRef.current;
    if (!cur) return;
    if (cur.phase === 'ended' || cur.phase === 'failed') {
      if (endClearTimerRef.current) {
        window.clearTimeout(endClearTimerRef.current);
        endClearTimerRef.current = null;
      }
      cleanupPeerAndMedia();
      setCall(null);
      onCallEnded?.();
      return;
    }
    sendWsEvent('call:signal', {
      callId: cur.callId,
      conversationId: cur.conversationId,
      targetUserId: cur.isGroupCall ? undefined : cur.peerUserId,
      callType: cur.callType,
      signalType: cur.phase === 'outgoing' ? 'missed' : 'hangup',
      durationSeconds: cur.durationSeconds,
    });
    finishCallUI('ended', cur.phase === 'outgoing' ? 'Canceled' : 'Call ended');
  }, [cleanupPeerAndMedia, finishCallUI, onCallEnded, sendWsEvent]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    const cur = callRef.current;
    if (!cur) return;
    const nextMuted = !cur.isMuted;
    if (stream) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
    }
    setCall((prev) => (prev ? { ...prev, isMuted: nextMuted } : prev));
    sendWsEvent('call:signal', {
      callId: cur.callId,
      conversationId: cur.conversationId,
      targetUserId: cur.isGroupCall ? undefined : cur.peerUserId,
      callType: cur.callType,
      signalType: 'toggle_media',
      isMuted: nextMuted,
      isCameraOff: cur.isCameraOff,
    });
  }, [sendWsEvent]);

  const toggleCamera = useCallback(async () => {
    const cur = callRef.current;
    const stream = localStreamRef.current;
    if (!cur || !stream) return;
    const videoTracks = stream.getVideoTracks();
    const nextOff = !cur.isCameraOff;
    if (videoTracks.length > 0) {
      videoTracks.forEach((t) => {
        t.enabled = !nextOff;
      });
    } else if (!nextOff) {
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cur.facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        const newTrack = camStream.getVideoTracks()[0];
        if (newTrack) {
          stream.addTrack(newTrack);
          setLocalStream(new MediaStream(stream.getTracks()));
          if (pcRef.current) {
            const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              await sender.replaceTrack(newTrack);
            } else {
              pcRef.current.addTrack(newTrack, stream);
            }
          }
        }
      } catch {
        setCall((prev) => (prev ? { ...prev, statusNote: 'Camera access unavailable.' } : prev));
        return;
      }
    }
    setCall((prev) => (prev ? { ...prev, isCameraOff: nextOff, callType: nextOff ? prev.callType : 'video' } : prev));
    sendWsEvent('call:signal', {
      callId: cur.callId,
      conversationId: cur.conversationId,
      targetUserId: cur.isGroupCall ? undefined : cur.peerUserId,
      callType: cur.callType,
      signalType: 'toggle_media',
      isMuted: cur.isMuted,
      isCameraOff: nextOff,
    });
  }, [sendWsEvent]);

  const switchCamera = useCallback(async () => {
    const cur = callRef.current;
    const stream = localStreamRef.current;
    if (!cur || !stream) return;
    const nextMode: 'user' | 'environment' = cur.facingMode === 'user' ? 'environment' : 'user';
    try {
      const nextCam = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newTrack = nextCam.getVideoTracks()[0];
      if (!newTrack) return;
      const oldTracks = stream.getVideoTracks();
      oldTracks.forEach((t) => {
        stream.removeTrack(t);
        t.stop();
      });
      stream.addTrack(newTrack);
      setLocalStream(new MediaStream(stream.getTracks()));
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newTrack);
        }
      }
      setCall((prev) => (prev ? { ...prev, facingMode: nextMode } : prev));
    } catch {
      setCall((prev) => (prev ? { ...prev, statusNote: 'Unable to switch camera on this device.' } : prev));
    }
  }, []);

  const switchToAudioOnly = useCallback(() => {
    const cur = callRef.current;
    const stream = localStreamRef.current;
    if (!cur || !stream) return;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = false;
    });
    setCall((prev) => (prev ? { ...prev, isCameraOff: true, callType: 'audio' } : prev));
    sendWsEvent('call:signal', {
      callId: cur.callId,
      conversationId: cur.conversationId,
      targetUserId: cur.isGroupCall ? undefined : cur.peerUserId,
      callType: 'audio',
      signalType: 'toggle_media',
      isMuted: cur.isMuted,
      isCameraOff: true,
    });
  }, [sendWsEvent]);

  const handleCallSignal = useCallback(
    async (payload: Record<string, any>) => {
      const signalType = payload.signalType;
      const cur = callRef.current;

      if (signalType === 'offer') {
        if (cur && cur.callId !== payload.callId) {
          // Already in another call -> respond busy
          sendWsEvent('call:signal', {
            callId: payload.callId,
            conversationId: payload.conversationId,
            targetUserId: payload.fromUserId,
            callType: payload.callType || 'audio',
            signalType: 'busy',
          });
          return;
        }
        pendingOfferRef.current = { sdp: payload.sdp, callId: payload.callId };
        setCall({
          callId: payload.callId,
          conversationId: payload.conversationId,
          peerUserId: payload.fromUserId,
          peerName: payload.groupName || payload.fromUserName || 'MOTHERLAND Member',
          peerAvatar: payload.fromUserAvatar || '',
          isGroupCall: Boolean(payload.isGroupCall),
          groupName: payload.groupName,
          callType: payload.callType === 'video' ? 'video' : 'audio',
          phase: 'incoming',
          durationSeconds: 0,
          isMuted: false,
          isCameraOff: payload.callType !== 'video',
          facingMode: 'user',
          remoteMuted: false,
          remoteCameraOff: payload.callType !== 'video',
          hasTurn: false,
        });
        return;
      }

      if (!cur || cur.callId !== payload.callId) return;

      if (signalType === 'accept' && payload.sdp && pcRef.current) {
        if (ringTimeoutRef.current) {
          window.clearTimeout(ringTimeoutRef.current);
          ringTimeoutRef.current = null;
        }
        setCall((prev) => (prev ? { ...prev, phase: 'connecting', statusNote: 'Peer accepted, connecting...' } : prev));
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await flushQueuedIce(pcRef.current);
        } catch {
          finishCallUI('failed', 'Failed to negotiate session description.');
        }
        return;
      }

      if (signalType === 'ice' && payload.candidate) {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch {
            // ignore
          }
        } else {
          queuedIceRef.current.push(payload.candidate);
        }
        return;
      }

      if (signalType === 'decline') {
        finishCallUI(
          'ended',
          payload.reason === 'privacy_restricted'
            ? 'Call blocked by recipient privacy preferences.'
            : 'Call declined'
        );
        return;
      }

      if (signalType === 'busy') {
        finishCallUI('ended', 'Recipient is busy on another call');
        return;
      }

      if (signalType === 'hangup' || signalType === 'missed') {
        finishCallUI('ended', signalType === 'missed' ? 'Missed call' : 'Peer ended call');
        return;
      }

      if (signalType === 'toggle_media') {
        setCall((prev) =>
          prev
            ? {
                ...prev,
                remoteMuted: typeof payload.isMuted === 'boolean' ? payload.isMuted : prev.remoteMuted,
                remoteCameraOff:
                  typeof payload.isCameraOff === 'boolean' ? payload.isCameraOff : prev.remoteCameraOff,
              }
            : prev
        );
      }
    },
    [finishCallUI, sendWsEvent]
  );

  // Automatic ringtone & call chime lifecycle synced cleanly to call.phase
  useEffect(() => {
    const currentPhase: CallPhase = call?.phase || 'idle';
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = currentPhase;

    if (currentPhase === 'outgoing') {
      startCallRingtoneLoop('outgoing');
    } else if (currentPhase === 'incoming') {
      startCallRingtoneLoop('incoming');
    } else {
      stopCallRingtones();
      if (currentPhase === 'connected' && prevPhase !== 'connected' && prevPhase !== 'reconnecting') {
        playCallConnectedChime();
      } else if (
        (currentPhase === 'ended' || currentPhase === 'failed') &&
        prevPhase !== 'idle' &&
        prevPhase !== 'ended' &&
        prevPhase !== 'failed'
      ) {
        playCallEndedChime();
      }
    }
  }, [call?.phase]);

  useEffect(() => {
    return () => {
      stopCallRingtones();
      cleanupPeerAndMedia();
      if (endClearTimerRef.current) window.clearTimeout(endClearTimerRef.current);
    };
  }, [cleanupPeerAndMedia]);

  return {
    call,
    localStream,
    remoteStream,
    startCall,
    acceptIncomingCall,
    declineIncomingCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    switchToAudioOnly,
    handleCallSignal,
  };
}
