import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ChevronRight,
  Eye,
  Heart,
  Layers,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Settings,
  Smile,
  Trophy,
  UserCog,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { RealtimeEvent } from '../../../hooks/useRealtime';
import { useBackHandler } from '../../../hooks/useBackNavigation';
import type {
  RobloxAvatarConfig,
  UserProfile,
  WorldRoomPlayerSnapshot,
  WorldRoomPublicState,
} from '../../../types';
import { AvatarCustomizerModal } from './AvatarCustomizerModal';
import { DalgonaModalOverlay } from './DalgonaModalOverlay';
import { createUnifiedRobloxWorld, getRobloxWorldMeta } from './gameRegistry';
import { robloxAudio } from './robloxAudio';
import { RobloxCameraController } from './robloxCameraController';
import {
  animateRobloxCharacter,
  createRobloxCharacter,
  loadSavedRobloxAvatar,
  saveRobloxAvatar,
  smoothRotateYaw,
  type RobloxCharacterRig,
} from './robloxCharacter';
import { createRobloxRendererBundle } from './robloxRenderer';
import {
  SQUID_STAGES,
  type CustomGameDefinition,
  type PlayerInputState,
  type RobloxHudState,
  type ServerWorldContext,
  type SquidStageId,
  type WorldController,
} from './types';

interface RobloxGameStageProps {
  worldId: string;
  customGameDef?: CustomGameDefinition;
  initialSquidStage?: SquidStageId;
  currentUser: UserProfile | null;
  sendWsEvent: (event: string, payload: Record<string, any>) => boolean;
  subscribeSpyEvents: (listener: (evt: RealtimeEvent) => void) => () => void;
  onExit: () => void;
}

interface RemoteAvatarEntry {
  userId: string;
  displayName: string;
  rig: RobloxCharacterRig | null;
  avatarKey: string;
  avatarConfig: RobloxAvatarConfig;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetYaw: number;
  curX: number;
  curY: number;
  curZ: number;
  curYaw: number;
  speed: number;
  grounded: boolean;
  actionActive: boolean;
  inCar: boolean;
  speaking: boolean;
}

interface WorldChatEntry {
  id: string;
  userId: string;
  displayName: string;
  text: string;
  ts: number;
}

const _playerPos = new THREE.Vector3();

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function serializeAvatarKey(cfg: RobloxAvatarConfig, name: string): string {
  return `${name}|${cfg.skinHex}|${cfg.shirtHex}|${cfg.pantsHex}|${cfg.hairHex}|${cfg.hatStyle}|${cfg.faceMood}|${cfg.accessory}`;
}

function disposeThreeObject(obj: THREE.Object3D): void {
  obj.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => m?.dispose?.());
    } else if (mat) {
      mat.dispose?.();
    }
  });
}

export const RobloxGameStage: React.FC<RobloxGameStageProps> = ({
  worldId,
  customGameDef,
  initialSquidStage = 's1_red_light',
  currentUser,
  sendWsEvent,
  subscribeSpyEvents,
  onExit,
}) => {
  const worldMeta = useMemo(() => getRobloxWorldMeta(worldId), [worldId]);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<WorldController | null>(null);
  const cameraCtrlRef = useRef<RobloxCameraController | null>(null);

  // Input refs for zero-rerender 60fps loop
  const keysRef = useRef<Set<string>>(new Set());
  const joyRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const jumpQueuedRef = useRef(false);
  const actionQueuedRef = useRef(false);
  const secondaryQueuedRef = useRef(false);
  const localEmoteUntilRef = useRef<number>(0);

  // Avatar & Server Room state
  const [avatarConfig, setAvatarConfig] = useState<RobloxAvatarConfig>(() => loadSavedRobloxAvatar());
  const avatarConfigRef = useRef<RobloxAvatarConfig>(avatarConfig);
  avatarConfigRef.current = avatarConfig;

  const guestIdRef = useRef<string>(
    (() => {
      try {
        const key = 'motherland_world_guest_id';
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;
        const created = `g_${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem(key, created);
        return created;
      } catch {
        return `g_${Math.random().toString(36).slice(2, 10)}`;
      }
    })()
  );

  const guestWsRef = useRef<WebSocket | null>(null);
  const selfUserIdRef = useRef<string>(currentUser?.id || `wg_${guestIdRef.current}`);
  const serverCtxRef = useRef<ServerWorldContext | null>(null);
  const remoteTargetsRef = useRef<Map<string, WorldRoomPlayerSnapshot>>(new Map());
  const remoteSceneMapRef = useRef<Map<string, RemoteAvatarEntry>>(new Map());

  const [serverHud, setServerHud] = useState<{
    serverNumber: number;
    playerCount: number;
    maxPlayers: number;
    players: WorldRoomPlayerSnapshot[];
  }>({
    serverNumber: 1,
    playerCount: 1,
    maxPlayers: 25,
    players: [],
  });

  const [hud, setHud] = useState<RobloxHudState>({
    worldTitle: customGameDef?.title || worldMeta?.entry.name || 'LOADING 3D WORLD',
    stageLabel: '',
    timerSec: null,
    score: 0,
    scoreLabel: 'SCORE',
    lives: 3,
    maxLives: 3,
    phase: 'playing',
    signalText: null,
    signalTone: 'info',
    actionLabel: null,
    secondaryActionLabel: null,
    canSwitchStage: worldId === 'squid_game',
    squidStageId: initialSquidStage,
  });

  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showStagePicker, setShowStagePicker] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // Unified Roblox CoreGui States: Core Menu, In-Game Messages, Voice Chat, Emotes
  const [coreMenuOpen, setCoreMenuOpen] = useState(false);
  const [coreMenuTab, setCoreMenuTab] = useState<'players' | 'settings'>('players');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<WorldChatEntry[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [emoteMenuOpen, setEmoteMenuOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<Array<{ userId: string; stream: MediaStream }>>([]);

  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // WebRTC Voice Mesh Refs
  const localVoiceStreamRef = useRef<MediaStream | null>(null);
  const voicePeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const voiceActiveRef = useRef(false);
  voiceActiveRef.current = voiceActive;

  // Virtual Joystick visual knob state
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const joyPointerIdRef = useRef<number | null>(null);
  const joyCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const clearAllMovementInputs = useCallback(() => {
    keysRef.current.clear();
    joyPointerIdRef.current = null;
    joyRef.current = { x: 0, z: 0 };
    jumpQueuedRef.current = false;
    setJoyKnob({ x: 0, y: 0, active: false });
  }, []);

  useBackHandler(
    'roblox-3d-stage',
    true,
    () => {
      if (coreMenuOpen) {
        setCoreMenuOpen(false);
        return;
      }
      if (chatOpen) {
        setChatOpen(false);
        return;
      }
      onExit();
    },
    30
  );

  // Transmit world events through authenticated App WS or isolated guest WS
  const emitWorldWs = useCallback(
    (event: string, payload: Record<string, any>): boolean => {
      if (currentUser) {
        return sendWsEvent(event, payload);
      }
      const ws = guestWsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        ws.send(JSON.stringify({ event, payload }));
        return true;
      } catch {
        return false;
      }
    },
    [currentUser, sendWsEvent]
  );

  const emitWorldWsRef = useRef(emitWorldWs);
  emitWorldWsRef.current = emitWorldWs;

  // WebRTC Voice Helpers
  const closeVoicePeer = useCallback((peerUserId: string) => {
    const pc = voicePeersRef.current.get(peerUserId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // ignore
      }
      voicePeersRef.current.delete(peerUserId);
    }
    setRemoteAudioStreams((prev) => prev.filter((item) => item.userId !== peerUserId));
  }, []);

  const createVoicePeer = useCallback(
    (peerUserId: string): RTCPeerConnection => {
      const existing = voicePeersRef.current.get(peerUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      voicePeersRef.current.set(peerUserId, pc);

      if (localVoiceStreamRef.current) {
        for (const track of localVoiceStreamRef.current.getAudioTracks()) {
          pc.addTrack(track, localVoiceStreamRef.current);
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          emitWorldWsRef.current('world:voice_signal', {
            targetUserId: peerUserId,
            signalData: { type: 'ice', candidate: e.candidate },
          });
        }
      };

      pc.ontrack = (e) => {
        const stream = e.streams?.[0];
        if (!stream) return;
        setRemoteAudioStreams((prev) => {
          if (prev.some((s) => s.userId === peerUserId)) {
            return prev.map((s) => (s.userId === peerUserId ? { userId: peerUserId, stream } : s));
          }
          return [...prev, { userId: peerUserId, stream }];
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closeVoicePeer(peerUserId);
        }
      };

      return pc;
    },
    [closeVoicePeer]
  );

  const handleVoiceSignalMessage = useCallback(
    async (fromUserId: string, signalData: any) => {
      if (!fromUserId || !signalData) return;
      try {
        const pc = createVoicePeer(fromUserId);
        if (signalData.type === 'offer' && signalData.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          emitWorldWsRef.current('world:voice_signal', {
            targetUserId: fromUserId,
            signalData: { type: 'answer', sdp: answer },
          });
        } else if (signalData.type === 'answer' && signalData.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        } else if (signalData.type === 'ice' && signalData.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      } catch {
        // ignore transient signaling race
      }
    },
    [createVoicePeer]
  );

  const stopVoiceChat = useCallback(() => {
    setVoiceActive(false);
    voiceActiveRef.current = false;
    emitWorldWsRef.current('world:voice_state', { speaking: false });
    if (localVoiceStreamRef.current) {
      for (const t of localVoiceStreamRef.current.getTracks()) t.stop();
      localVoiceStreamRef.current = null;
    }
    for (const uid of Array.from(voicePeersRef.current.keys())) {
      closeVoicePeer(uid);
    }
    setRemoteAudioStreams([]);
  }, [closeVoicePeer]);

  const toggleVoiceChat = useCallback(async () => {
    robloxAudio.unlock();
    robloxAudio.playClick();
    setVoiceError('');
    if (voiceActiveRef.current) {
      stopVoiceChat();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setVoiceError('এই ব্রাউজারে মাইক্রোফোন সাপোর্ট নেই');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localVoiceStreamRef.current = stream;
      setVoiceActive(true);
      voiceActiveRef.current = true;
      emitWorldWsRef.current('world:voice_state', { speaking: true });

      // Offer audio connection to all current remote players in the 25-player room
      for (const remoteId of remoteTargetsRef.current.keys()) {
        const pc = createVoicePeer(remoteId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          emitWorldWsRef.current('world:voice_signal', {
            targetUserId: remoteId,
            signalData: { type: 'offer', sdp: offer },
          });
        } catch {
          // ignore
        }
      }
    } catch {
      setVoiceError('মাইক্রোফোন পারমিশন দিন');
      stopVoiceChat();
    }
  }, [createVoicePeer, stopVoiceChat]);

  useEffect(() => {
    return () => {
      stopVoiceChat();
    };
  }, [stopVoiceChat]);

  const applyRoomStateSnapshot = useCallback(
    (state: WorldRoomPublicState, explicitSelfId?: string) => {
      if (!state || state.worldId !== worldId) return;
      if (explicitSelfId) {
        selfUserIdRef.current = explicitSelfId;
      }
      const selfId = selfUserIdRef.current;

      serverCtxRef.current = {
        phase: state.phase,
        phaseTimer: state.phaseTimer,
        phaseData: state.phaseData || {},
        playerCount: state.playerCount,
        selfUserId: selfId,
      };

      const roster = state.players || [];
      setServerHud({
        serverNumber: state.serverNumber || 1,
        playerCount: state.playerCount || Math.max(1, roster.length),
        maxPlayers: state.maxPlayers || 25,
        players: roster,
      });

      const nextMap = new Map<string, WorldRoomPlayerSnapshot>();
      for (const p of roster) {
        if (p.userId !== selfId) {
          nextMap.set(p.userId, p);
        }
      }
      remoteTargetsRef.current = nextMap;
    },
    [worldId]
  );

  // Real 25-Player Room WebSocket Bridge (Movement + Chat + WebRTC Voice)
  useEffect(() => {
    const displayName =
      currentUser?.displayName || `Player-${guestIdRef.current.slice(-4).toUpperCase()}`;

    const handleIncomingEvent = (evt: RealtimeEvent | Record<string, any>) => {
      const evType = evt.type || evt.event;
      if (!evType) return;
      if (evType === 'world:joined') {
        const state = evt.state as WorldRoomPublicState | undefined;
        if (state) applyRoomStateSnapshot(state, evt.selfUserId);
      } else if (evType === 'world:state') {
        const state = evt.state as WorldRoomPublicState | undefined;
        if (state) applyRoomStateSnapshot(state);
      } else if (evType === 'world:player_moved') {
        const p = evt.player as WorldRoomPlayerSnapshot | undefined;
        if (p && p.userId && p.userId !== selfUserIdRef.current) {
          remoteTargetsRef.current.set(p.userId, p);
        }
      } else if (evType === 'world:player_left') {
        const uid = String(evt.userId || '');
        if (uid) {
          remoteTargetsRef.current.delete(uid);
          closeVoicePeer(uid);
          setServerHud((prev) => ({
            ...prev,
            playerCount: typeof evt.playerCount === 'number' ? Math.max(1, evt.playerCount) : Math.max(1, prev.playerCount - 1),
            players: prev.players.filter((pl) => pl.userId !== uid),
          }));
        }
      } else if (evType === 'world:chat') {
        const msg: WorldChatEntry = {
          id: `${evt.ts || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          userId: String(evt.userId || ''),
          displayName: String(evt.displayName || 'Player'),
          text: String(evt.text || ''),
          ts: Number(evt.ts || Date.now()),
        };
        if (msg.text) {
          setChatMessages((prev) => [...prev.slice(-49), msg]);
          if (!chatOpenRef.current && msg.userId !== selfUserIdRef.current) {
            setUnreadChatCount((c) => c + 1);
          }
        }
      } else if (evType === 'world:voice_state') {
        const uid = String(evt.userId || '');
        if (uid) {
          const speaking = Boolean(evt.speaking);
          const target = remoteTargetsRef.current.get(uid);
          if (target) {
            target.speaking = speaking;
          }
          setServerHud((prev) => ({
            ...prev,
            players: prev.players.map((p) => (p.userId === uid ? { ...p, speaking } : p)),
          }));
        }
      } else if (evType === 'world:voice_signal') {
        const fromId = String(evt.fromUserId || '');
        if (fromId && fromId !== selfUserIdRef.current) {
          void handleVoiceSignalMessage(fromId, evt.signalData);
        }
      }
    };

    if (currentUser) {
      selfUserIdRef.current = currentUser.id;
      const unsub = subscribeSpyEvents(handleIncomingEvent);

      const joinNow = () => {
        sendWsEvent('world:join', {
          worldId,
          displayName,
          avatarConfig: avatarConfigRef.current,
        });
      };
      joinNow();
      const retryTimer = window.setTimeout(() => {
        if (!serverCtxRef.current) joinNow();
      }, 900);

      return () => {
        window.clearTimeout(retryTimer);
        unsub();
        sendWsEvent('world:leave', {});
        serverCtxRef.current = null;
        remoteTargetsRef.current.clear();
      };
    }

    // Fallback Guest WebSocket so non-logged-in users still join live 25-player Server #1 -> #2!
    let closed = false;
    let guestWs: WebSocket | null = null;
    let pingTimer: number | null = null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?worldGuest=1&guestId=${encodeURIComponent(
      guestIdRef.current
    )}`;

    try {
      guestWs = new WebSocket(wsUrl);
      guestWsRef.current = guestWs;
    } catch {
      guestWs = null;
    }

    if (guestWs) {
      guestWs.onopen = () => {
        if (closed || !guestWs) return;
        guestWs.send(
          JSON.stringify({
            event: 'world:join',
            payload: {
              worldId,
              displayName,
              avatarConfig: avatarConfigRef.current,
            },
          })
        );
        pingTimer = window.setInterval(() => {
          if (guestWs && guestWs.readyState === WebSocket.OPEN) {
            try {
              guestWs.send(JSON.stringify({ event: 'ping', payload: { ts: Date.now() } }));
            } catch {
              // ignore
            }
          }
        }, 25000);
      };

      guestWs.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(String(msg.data || '{}')) as Record<string, any>;
          const eventType = parsed.event || parsed.type;
          if (!eventType || eventType === 'pong') return;
          const payload = parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : parsed;
          handleIncomingEvent({ ...payload, type: eventType });
        } catch {
          // ignore malformed messages
        }
      };
    }

    return () => {
      closed = true;
      if (pingTimer) window.clearInterval(pingTimer);
      if (guestWs) {
        if (guestWs.readyState === WebSocket.OPEN) {
          try {
            guestWs.send(JSON.stringify({ event: 'world:leave', payload: {} }));
          } catch {
            // ignore
          }
        }
        try {
          guestWs.close();
        } catch {
          // ignore
        }
      }
      if (guestWsRef.current === guestWs) guestWsRef.current = null;
      serverCtxRef.current = null;
      remoteTargetsRef.current.clear();
    };
  }, [
    worldId,
    currentUser,
    sendWsEvent,
    subscribeSpyEvents,
    applyRoomStateSnapshot,
    closeVoicePeer,
    handleVoiceSignalMessage,
  ]);

  // Auto-scroll chat box when new messages arrive
  useEffect(() => {
    if (chatOpen && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages.length, chatOpen]);

  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = chatInput.trim();
    if (!clean) return;
    robloxAudio.unlock();
    robloxAudio.playClick();
    emitWorldWs('world:chat', { text: clean.slice(0, 140) });
    setChatInput('');
  };

  const triggerEmote = (label: string) => {
    robloxAudio.unlock();
    robloxAudio.playClick();
    localEmoteUntilRef.current = performance.now() + 2600;
    setEmoteMenuOpen(false);
    emitWorldWs('world:chat', { text: `*${label}*` });
  };

  // Update avatar live in Three.js world and broadcast to 25-player room
  const handleAvatarChange = useCallback(
    (next: RobloxAvatarConfig) => {
      setAvatarConfig(next);
      avatarConfigRef.current = next;
      saveRobloxAvatar(next);
      controllerRef.current?.setAvatarConfig?.(next);
      emitWorldWs('world:move', { avatarConfig: next });
    },
    [emitWorldWs]
  );

  // Clear movement whenever modals/drawers open
  useEffect(() => {
    if (
      showStagePicker ||
      showAvatarModal ||
      coreMenuOpen ||
      hud.dalgona?.active ||
      hud.phase !== 'playing'
    ) {
      clearAllMovementInputs();
    }
  }, [showStagePicker, showAvatarModal, coreMenuOpen, hud.dalgona?.active, hud.phase, clearAllMovementInputs]);

  const handleToggleCamera = useCallback(() => {
    const camCtrl = cameraCtrlRef.current;
    if (!camCtrl) return;
    robloxAudio.unlock();
    robloxAudio.playClick();
    const nextFp = camCtrl.toggleMode();
    setIsFirstPerson(nextFp);
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !robloxAudio.isMuted();
    robloxAudio.setMuted(next);
    setMuted(next);
  }, []);

  const handleSelectSquidStage = useCallback((stageId: SquidStageId) => {
    robloxAudio.unlock();
    robloxAudio.playClick();
    controllerRef.current?.setSquidStage?.(stageId);
    setShowStagePicker(false);
  }, []);

  const handleNextSquidStage = useCallback(() => {
    const currIdx = SQUID_STAGES.findIndex((s) => s.id === hud.squidStageId);
    if (currIdx >= 0 && currIdx < SQUID_STAGES.length - 1) {
      handleSelectSquidStage(SQUID_STAGES[currIdx + 1].id);
    }
  }, [hud.squidStageId, handleSelectSquidStage]);

  const handleRestart = useCallback(() => {
    robloxAudio.unlock();
    robloxAudio.playClick();
    clearAllMovementInputs();
    controllerRef.current?.reset();
    setCoreMenuOpen(false);
  }, [clearAllMovementInputs]);

  // Main Three.js Scene Lifecycle via Plug-and-Play Registry
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const bundle = createRobloxRendererBundle(mount);
    const camCtrl = new RobloxCameraController();
    cameraCtrlRef.current = camCtrl;

    const detachCamEvents = camCtrl.attach(bundle.renderer.domElement);

    const world: WorldController = createUnifiedRobloxWorld(
      worldId,
      bundle.scene,
      bundle.isSoftwareGl,
      bundle.maxAnisotropy,
      avatarConfigRef.current,
      initialSquidStage,
      customGameDef
    );
    controllerRef.current = world;
    world.setAvatarConfig?.(avatarConfigRef.current);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    bundle.renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    bundle.renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        bundle.resize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    resizeObserver.observe(mount);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const code = e.code;
      keysRef.current.add(code);
      if (code === 'Space') {
        jumpQueuedRef.current = true;
      } else if (code === 'KeyE' || code === 'KeyF') {
        actionQueuedRef.current = true;
      } else if (code === 'KeyQ') {
        secondaryQueuedRef.current = true;
      } else if (code === 'KeyV') {
        const nextFp = camCtrl.toggleMode();
        setIsFirstPerson(nextFp);
      } else if (code === 'Equal' || code === 'NumpadAdd') {
        camCtrl.stepZoom(-1.8);
      } else if (code === 'Minus' || code === 'NumpadSubtract') {
        camCtrl.stepZoom(1.8);
      } else if (code === 'Escape') {
        setCoreMenuOpen((prev) => !prev);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };
    const onWindowBlur = () => {
      clearAllMovementInputs();
    };
    const onVisibilityChange = () => {
      if (document.hidden) clearAllMovementInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    let stopped = false;
    let lastTime = performance.now();
    let elapsed = 0;
    let hudSyncAccum = 0;
    let moveNetAccum = 0;
    let lastSentPos = { x: 0, y: 0, z: 0, yaw: 0, speed: 0, score: -1, actionActive: false };
    const remoteMap = remoteSceneMapRef.current;

    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;

      const keys = keysRef.current;
      let moveX = joyRef.current.x;
      let moveZ = joyRef.current.z;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ += 1;

      const mag = Math.hypot(moveX, moveZ);
      if (mag > 1) {
        moveX /= mag;
        moveZ /= mag;
      }

      const input: PlayerInputState = {
        moveX,
        moveZ,
        jumpPressed: jumpQueuedRef.current,
        actionPressed: actionQueuedRef.current,
        secondaryPressed: secondaryQueuedRef.current,
        sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || mag > 0.88,
      };
      jumpQueuedRef.current = false;
      actionQueuedRef.current = false;
      secondaryQueuedRef.current = false;

      const camStateBefore = camCtrl.getState();
      const nextHud = world.update(
        dt,
        elapsed,
        input,
        camStateBefore.yaw,
        camStateBefore.pitch,
        camStateBefore.isFirstPerson,
        serverCtxRef.current
      );

      if (nextHud.serverSyncEvent) {
        emitWorldWsRef.current('world:action', {
          actionType: nextHud.serverSyncEvent.actionType,
          data: nextHud.serverSyncEvent.data,
        });
      }

      world.getPlayerPosition(_playerPos);
      const isFpNow = camCtrl.updateCamera(
        bundle.camera,
        _playerPos,
        2.5,
        world.groundHeightAt,
        dt
      );

      // Sync outbound local movement to 25-player room (~13Hz when active, ~1Hz heartbeat)
      moveNetAccum += dt;
      const playerYaw = world.getPlayerYaw();
      const playerSpeed = world.getPlayerSpeed();
      const playerGrounded = world.isPlayerGrounded();
      const localEmoteActive = now < localEmoteUntilRef.current;
      const movedEnough =
        Math.abs(_playerPos.x - lastSentPos.x) > 0.04 ||
        Math.abs(_playerPos.y - lastSentPos.y) > 0.04 ||
        Math.abs(_playerPos.z - lastSentPos.z) > 0.04 ||
        Math.abs(playerYaw - lastSentPos.yaw) > 0.05 ||
        Math.abs(playerSpeed - lastSentPos.speed) > 0.25 ||
        nextHud.score !== lastSentPos.score ||
        localEmoteActive !== lastSentPos.actionActive;

      if ((movedEnough && moveNetAccum >= 0.075) || moveNetAccum >= 1.5) {
        moveNetAccum = 0;
        lastSentPos = {
          x: _playerPos.x,
          y: _playerPos.y,
          z: _playerPos.z,
          yaw: playerYaw,
          speed: playerSpeed,
          score: nextHud.score,
          actionActive: localEmoteActive,
        };
        emitWorldWsRef.current('world:move', {
          x: Number(_playerPos.x.toFixed(2)),
          y: Number(_playerPos.y.toFixed(2)),
          z: Number(_playerPos.z.toFixed(2)),
          yaw: Number(playerYaw.toFixed(2)),
          speed: Number(playerSpeed.toFixed(2)),
          grounded: playerGrounded,
          actionActive: localEmoteActive,
          inCar: Boolean(nextHud.inCar),
          score: nextHud.score,
        });
      }

      // Sync Remote 25-Player Avatars inside Three.js scene
      const liveTargets = remoteTargetsRef.current;
      for (const [uid, entry] of remoteMap.entries()) {
        if (!liveTargets.has(uid)) {
          if (entry.rig) {
            bundle.scene.remove(entry.rig.root);
            disposeThreeObject(entry.rig.root);
          }
          remoteMap.delete(uid);
        }
      }
      for (const [uid, snap] of liveTargets.entries()) {
        const av = snap.avatarConfig || avatarConfigRef.current;
        const avKey = serializeAvatarKey(av, snap.displayName || 'Player');
        let entry = remoteMap.get(uid);
        if (!entry) {
          const rig = createRobloxCharacter({
            skinHex: av.skinHex,
            shirtHex: av.shirtHex,
            pantsHex: av.pantsHex,
            hairHex: av.hairHex,
            hatStyle: av.hatStyle,
            faceMood: av.faceMood,
            accessory: av.accessory,
            displayName: snap.displayName || 'Player',
          });
          rig.root.position.set(snap.x, snap.y, snap.z);
          rig.root.rotation.y = snap.yaw;
          bundle.scene.add(rig.root);
          entry = {
            userId: uid,
            displayName: snap.displayName || 'Player',
            rig,
            avatarKey: avKey,
            avatarConfig: av,
            targetX: snap.x,
            targetY: snap.y,
            targetZ: snap.z,
            targetYaw: snap.yaw,
            curX: snap.x,
            curY: snap.y,
            curZ: snap.z,
            curYaw: snap.yaw,
            speed: snap.speed || 0,
            grounded: snap.grounded !== false,
            actionActive: Boolean(snap.actionActive),
            inCar: Boolean(snap.inCar),
            speaking: Boolean(snap.speaking),
          };
          remoteMap.set(uid, entry);
        } else {
          if (entry.avatarKey !== avKey && entry.rig) {
            bundle.scene.remove(entry.rig.root);
            disposeThreeObject(entry.rig.root);
            const nextRig = createRobloxCharacter({
              skinHex: av.skinHex,
              shirtHex: av.shirtHex,
              pantsHex: av.pantsHex,
              hairHex: av.hairHex,
              hatStyle: av.hatStyle,
              faceMood: av.faceMood,
              accessory: av.accessory,
              displayName: snap.displayName || 'Player',
            });
            bundle.scene.add(nextRig.root);
            entry.rig = nextRig;
            entry.avatarKey = avKey;
          }
          entry.targetX = snap.x;
          entry.targetY = snap.y;
          entry.targetZ = snap.z;
          entry.targetYaw = snap.yaw;
          entry.speed = snap.speed || 0;
          entry.grounded = snap.grounded !== false;
          entry.actionActive = Boolean(snap.actionActive);
          entry.inCar = Boolean(snap.inCar);
          entry.speaking = Boolean(snap.speaking);
        }

        if (entry.rig) {
          const blend = 1 - Math.exp(-12 * dt);
          entry.curX += (entry.targetX - entry.curX) * blend;
          entry.curY += (entry.targetY - entry.curY) * blend;
          entry.curZ += (entry.targetZ - entry.curZ) * blend;
          entry.curYaw = smoothRotateYaw(entry.curYaw, entry.targetYaw, dt, 14);
          entry.rig.root.position.set(entry.curX, entry.curY, entry.curZ);
          entry.rig.root.rotation.y = entry.curYaw;
          entry.rig.setCarMode(entry.inCar);
          animateRobloxCharacter(
            entry.rig,
            entry.speed,
            entry.grounded,
            elapsed,
            entry.actionActive ? 0.32 : 0
          );
        }
      }

      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.09) {
        hudSyncAccum = 0;
        setIsFirstPerson(isFpNow);
        setHud(nextHud);
      }

      bundle.renderFrame(tick);
    };

    bundle.renderFrame(tick);

    return () => {
      stopped = true;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resizeObserver.disconnect();
      bundle.renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      bundle.renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      detachCamEvents();

      for (const entry of remoteMap.values()) {
        if (entry.rig) {
          bundle.scene.remove(entry.rig.root);
          disposeThreeObject(entry.rig.root);
        }
      }
      remoteMap.clear();

      world.dispose();
      bundle.dispose();
      controllerRef.current = null;
      cameraCtrlRef.current = null;
    };
  }, [worldId, customGameDef, initialSquidStage, clearAllMovementInputs]);

  // Joystick Pointer Handlers with strict 0.16 radial deadband
  const updateJoyFromPointer = (clientX: number, clientY: number) => {
    const maxR = 44;
    const dx = clientX - joyCenterRef.current.x;
    const dy = clientY - joyCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxR, dist);
    const ang = Math.atan2(dy, dx);
    const kx = Math.cos(ang) * clamped;
    const ky = Math.sin(ang) * clamped;
    const norm = clamped / maxR;

    if (norm < 0.16) {
      joyRef.current = { x: 0, z: 0 };
      setJoyKnob({ x: kx * 0.4, y: ky * 0.4, active: true });
      return;
    }

    const scaled = (norm - 0.16) / (1 - 0.16);
    joyRef.current = {
      x: Math.cos(ang) * scaled,
      z: Math.sin(ang) * scaled,
    };
    setJoyKnob({ x: kx, y: ky, active: true });
  };

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    robloxAudio.unlock();
    joyPointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const rect = e.currentTarget.getBoundingClientRect();
    joyCenterRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoyFromPointer(e.clientX, e.clientY);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoyFromPointer(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    joyPointerIdRef.current = null;
    joyRef.current = { x: 0, z: 0 };
    setJoyKnob({ x: 0, y: 0, active: false });
  };

  const signalColorClass =
    hud.signalTone === 'green'
      ? 'bg-emerald-950/90 border-emerald-400/60 text-emerald-200'
      : hud.signalTone === 'red'
      ? 'bg-rose-950/90 border-rose-400/60 text-rose-200'
      : hud.signalTone === 'gold'
      ? 'bg-amber-950/90 border-amber-400/60 text-amber-200'
      : 'bg-slate-900/90 border-slate-500/50 text-slate-100';

  const currentSquidIdx = SQUID_STAGES.findIndex((s) => s.id === hud.squidStageId);
  const hasNextSquidStage =
    worldId === 'squid_game' && currentSquidIdx >= 0 && currentSquidIdx < SQUID_STAGES.length - 1;

  const recentToastChat = chatMessages.slice(-2);
  const selfName =
    currentUser?.displayName || `Player-${guestIdRef.current.slice(-4).toUpperCase()}`;

  return (
    <div
      data-testid="roblox-3d-stage"
      className="fixed inset-0 z-50 h-[100dvh] w-full bg-[#070a12] text-slate-100 select-none overflow-hidden"
    >
      {/* Hidden Remote Room WebRTC Audio Playback Elements */}
      {remoteAudioStreams.map(({ userId, stream }) => (
        <RemoteAudioPlayer key={userId} stream={stream} />
      ))}

      {/* Dedicated Empty WebGL Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* First-Person Crosshair Reticle */}
      {isFirstPerson && hud.phase === 'playing' && !hud.dalgona?.active && (
        <div className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.9)]" />
            <div className="absolute inset-0 rounded-full border border-white/45" />
          </div>
        </div>
      )}

      {/* UNIFIED ROBLOX CORE TOPBAR (Same across ALL games!) */}
      <header className="pointer-events-none fixed top-0 inset-x-0 z-20 p-2.5 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          {/* TOP-LEFT COREGui STRIP: Tilted Roblox Menu + Chat/Messages + Voice Mic + Stage */}
          <div className="pointer-events-auto flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-1.5">
              {/* 1. Authentic Tilted Square Roblox Core Menu Button */}
              <button
                type="button"
                data-testid="roblox-core-menu-btn"
                onClick={() => {
                  robloxAudio.unlock();
                  robloxAudio.playClick();
                  setCoreMenuOpen((o) => !o);
                }}
                className="w-10 h-10 rounded-xl bg-[#111722]/90 border border-white/20 hover:border-white/45 flex items-center justify-center shadow-lg transition-all active:scale-95"
                title="Roblox Core Menu (Esc)"
                aria-label="Open Game Menu"
              >
                <div className="w-4 h-4 rounded-[3px] border-[3px] border-white rotate-[-14deg] flex items-center justify-center">
                  <div className="w-1 h-1 bg-[#111722]" />
                </div>
              </button>

              {/* 2. In-Game Messages / Chat Toggle */}
              <button
                type="button"
                data-testid="roblox-chat-toggle-btn"
                onClick={() => {
                  robloxAudio.unlock();
                  robloxAudio.playClick();
                  setChatOpen((o) => {
                    if (!o) setUnreadChatCount(0);
                    return !o;
                  });
                }}
                className={`relative w-10 h-10 rounded-xl border flex items-center justify-center shadow-lg transition-all ${
                  chatOpen
                    ? 'bg-sky-600/95 border-sky-300 text-white'
                    : 'bg-[#111722]/90 border-white/15 hover:border-white/35 text-slate-100'
                }`}
                title="মেসেজ / Room Chat"
                aria-label="In-Game Chat"
              >
                <MessageSquare className="w-4 h-4" />
                {unreadChatCount > 0 && !chatOpen && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center">
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </button>

              {/* 3. Voice Talk Section (WebRTC Room Voice Mic) */}
              <button
                type="button"
                data-testid="roblox-voice-toggle-btn"
                onClick={toggleVoiceChat}
                className={`h-10 px-2.5 rounded-xl border flex items-center gap-1.5 shadow-lg transition-all text-[11px] font-black ${
                  voiceActive
                    ? 'bg-emerald-600/95 border-emerald-300 text-white'
                    : 'bg-[#111722]/90 border-white/15 hover:border-white/35 text-slate-100'
                }`}
                title="কথা বলা সেকশন (Voice Chat)"
                aria-label="Toggle Voice Microphone"
              >
                {voiceActive ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4 text-slate-300" />}
                <span className="hidden sm:inline">{voiceActive ? 'কথা চালু' : 'ভয়েস'}</span>
              </button>

              {/* Current World Stage / Progress Pill */}
              {hud.stageLabel && (
                <div className="hidden md:flex px-3 h-10 rounded-xl bg-[#111722]/85 border border-white/12 items-center gap-2 max-w-[240px]">
                  <span className="text-[11px] font-bold text-slate-100 truncate">{hud.stageLabel}</span>
                </div>
              )}
            </div>

            {voiceError && (
              <div className="px-2.5 py-1 rounded-lg bg-rose-950/90 border border-rose-500/40 text-[10px] font-bold text-rose-200 max-w-xs">
                {voiceError}
              </div>
            )}

            {/* Floating Chat Toasts when Chat Box is collapsed */}
            {!chatOpen && recentToastChat.length > 0 && (
              <div className="pointer-events-none flex flex-col gap-1 max-w-[260px]">
                {recentToastChat.map((m) => (
                  <div
                    key={m.id}
                    className="px-2.5 py-1 rounded-lg bg-black/55 backdrop-blur-sm text-[11px] text-slate-100 truncate"
                  >
                    <span className="font-black text-amber-300">{m.displayName}: </span>
                    <span>{m.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Roblox-Style Corner Chat Drawer (Transparent Glass) */}
            {chatOpen && (
              <div
                data-testid="roblox-chat-drawer"
                className="w-[270px] sm:w-[320px] rounded-2xl bg-[#0d131f]/88 backdrop-blur-md border border-white/15 shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between text-[11px] font-black text-slate-200">
                  <span>সার্ভার #{serverHud.serverNumber} মেসেজ ({serverHud.playerCount}/25)</span>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    className="text-slate-400 hover:text-white"
                    aria-label="Close Chat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div
                  ref={chatScrollRef}
                  className="h-36 overflow-y-auto px-3 py-2 space-y-1.5 text-xs"
                >
                  {chatMessages.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      এই রুমের সবার সাথে কথা বলুন বা মেসেজ দিন...
                    </p>
                  ) : (
                    chatMessages.map((m) => (
                      <div key={m.id} className="leading-snug break-words">
                        <span className="font-black text-sky-300">{m.displayName}: </span>
                        <span className="text-slate-100">{m.text}</span>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendChat} className="p-2 border-t border-white/10 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="মেসেজ লিখুন..."
                    maxLength={140}
                    className="flex-1 bg-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                  <button
                    type="submit"
                    className="w-8 h-8 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center shrink-0"
                    aria-label="Send Message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* TOP-RIGHT COREGui STRIP: Server Players Pill + Score + 1P/3P + Emotes */}
          <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
            {hud.maxLives > 1 && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 h-10 rounded-xl bg-[#111722]/88 border border-white/15">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                <span className="text-[11px] font-black tabular-nums">{hud.lives}</span>
              </div>
            )}

            {hud.timerSec !== null && (
              <div className="px-2.5 h-10 rounded-xl bg-[#111722]/88 border border-white/15 flex items-center">
                <span className="text-[11px] font-black tabular-nums text-sky-300">{hud.timerSec}s</span>
              </div>
            )}

            <div className="px-2.5 h-10 rounded-xl bg-[#111722]/88 border border-white/15 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-black tabular-nums">{hud.score}</span>
            </div>

            <button
              type="button"
              data-testid="roblox-server-players-btn"
              onClick={() => {
                setCoreMenuTab('players');
                setCoreMenuOpen(true);
              }}
              className="h-10 px-2.5 rounded-xl bg-[#111722]/88 border border-teal-400/40 hover:border-teal-300 flex items-center gap-1.5 text-[11px] font-black text-teal-200 tabular-nums"
              title="Server Players (25 Max)"
            >
              <Users className="w-3.5 h-3.5 text-teal-400" />
              <span>
                S#{serverHud.serverNumber} · {serverHud.playerCount}/{serverHud.maxPlayers}
              </span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setEmoteMenuOpen((o) => !o)}
                className="w-10 h-10 rounded-xl bg-[#111722]/88 border border-white/15 hover:border-amber-400/50 text-amber-300 flex items-center justify-center"
                title="Emotes"
                aria-label="Emotes"
              >
                <Smile className="w-4 h-4" />
              </button>

              {emoteMenuOpen && (
                <div className="absolute right-0 top-11 w-36 rounded-xl bg-[#111722]/95 border border-white/15 p-1.5 space-y-1 shadow-xl z-30">
                  {['Wave 👋', 'Dance 💃', 'Cheer 🎉'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => triggerEmote(em)}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-xs font-bold text-white"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              data-testid="roblox-camera-toggle"
              onClick={handleToggleCamera}
              className="h-10 px-2.5 rounded-xl bg-[#111722]/88 border border-teal-400/40 text-[11px] font-black text-teal-300 flex items-center gap-1"
              title="1P / 3P"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isFirstPerson ? '1P' : '3P'}</span>
            </button>

            {hud.canSwitchStage && (
              <button
                type="button"
                data-testid="squid-stages-btn"
                onClick={() => setShowStagePicker((prev) => !prev)}
                className="h-10 px-2.5 rounded-xl bg-rose-600/95 hover:bg-rose-500 text-[11px] font-black text-white flex items-center gap-1"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">S1</span>
              </button>
            )}
          </div>
        </div>

        {/* Transient Signal Pill */}
        {hud.signalText && (
          <div className="flex justify-center">
            <div className={`px-3.5 py-1 rounded-xl border text-xs font-black tracking-wide ${signalColorClass}`}>
              {hud.signalText}
            </div>
          </div>
        )}

        {/* Tug of War / Boss Meter */}
        {hud.minigamePrompt && hud.phase === 'playing' && (
          <div className="mx-auto w-full max-w-xs rounded-2xl bg-[#0d1322]/90 border border-amber-400/50 p-2 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-black text-amber-300">
              <span>{hud.minigamePrompt.title}</span>
              <span>{hud.minigamePrompt.targetLabel}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-75"
                style={{ width: `${hud.minigamePrompt.meter}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* UNIFIED ROBLOX CORE PAUSE / SETTINGS / 25-PLAYER LIST DRAWER */}
      {coreMenuOpen && (
        <div
          data-testid="roblox-core-menu-modal"
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3"
        >
          <div className="w-full max-w-lg max-h-[85dvh] rounded-3xl bg-[#101622] border border-white/15 shadow-2xl overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2 bg-[#0b1019]">
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white truncate">
                  {customGameDef?.title || worldMeta?.entry.name || hud.worldTitle}
                </h2>
                <p className="text-[11px] font-bold text-teal-300">
                  Server #{serverHud.serverNumber} · {serverHud.playerCount}/{serverHud.maxPlayers} Players Connected
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCoreMenuOpen(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
                aria-label="Resume Game"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Core Menu Sub-Tabs */}
            <div className="px-4 pt-3 flex items-center gap-2 border-b border-white/10 pb-2.5">
              <button
                type="button"
                onClick={() => setCoreMenuTab('players')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                  coreMenuTab === 'players'
                    ? 'bg-white text-slate-950'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Players ({serverHud.playerCount}/25)</span>
              </button>
              <button
                type="button"
                onClick={() => setCoreMenuTab('settings')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${
                  coreMenuTab === 'settings'
                    ? 'bg-white text-slate-950'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings &amp; Controls</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCoreMenuOpen(false);
                  setShowAvatarModal(true);
                }}
                className="ml-auto px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black flex items-center gap-1.5"
              >
                <UserCog className="w-3.5 h-3.5" />
                <span>Avatar</span>
              </button>
            </div>

            {/* Core Menu Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {coreMenuTab === 'players' ? (
                <>
                  {/* Self Player Row */}
                  <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-400/35 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-7 h-7 rounded-lg border border-white/20 shrink-0"
                        style={{ backgroundColor: `#${avatarConfig.shirtHex.toString(16).padStart(6, '0')}` }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-black text-white truncate">{selfName} (You)</p>
                        <p className="text-[10px] text-teal-300">
                          {voiceActive ? 'Mic Active · Speaking Enabled' : 'In Server #' + serverHud.serverNumber}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-amber-300 tabular-nums">{hud.score}</span>
                  </div>

                  {/* Remote Players inside this 25-Player Server */}
                  {serverHud.players
                    .filter((pl) => pl.userId !== selfUserIdRef.current)
                    .map((pl) => (
                      <div
                        key={pl.userId}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-7 h-7 rounded-lg border border-white/15 shrink-0"
                            style={{
                              backgroundColor: `#${(pl.avatarConfig?.shirtHex ?? 0x2563eb)
                                .toString(16)
                                .padStart(6, '0')}`,
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-100 truncate flex items-center gap-1.5">
                              <span>{pl.displayName}</span>
                              {pl.speaking && <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-amber-300 tabular-nums">{pl.score || 0}</span>
                      </div>
                    ))}
                </>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="font-black text-white">Camera Mode (1P / 3P)</p>
                      <p className="text-[11px] text-slate-400">Pinch with 2 fingers or tap to toggle</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleCamera}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-500 text-slate-950 font-black"
                    >
                      {isFirstPerson ? '1st Person' : '3rd Person'}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="font-black text-white">Game Sound Effects</p>
                      <p className="text-[11px] text-slate-400">Footsteps, jumps, coins &amp; alerts</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleMute}
                      className="px-3.5 py-1.5 rounded-xl bg-white/10 text-white font-black flex items-center gap-1.5"
                    >
                      {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{muted ? 'Muted' : 'On'}</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="font-black text-white">Voice Chat (কথা বলা)</p>
                      <p className="text-[11px] text-slate-400">Live WebRTC audio inside this 25-player room</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleVoiceChat}
                      className={`px-3.5 py-1.5 rounded-xl font-black ${
                        voiceActive ? 'bg-emerald-500 text-slate-950' : 'bg-white/10 text-white'
                      }`}
                    >
                      {voiceActive ? 'Mic ON' : 'Mic OFF'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Roblox Core Actions */}
            <div className="p-3.5 border-t border-white/10 bg-[#0b1019] grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleRestart}
                className="h-10 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-black flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={() => setCoreMenuOpen(false)}
                className="h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black"
              >
                Resume
              </button>
              <button
                type="button"
                data-testid="roblox-exit-btn"
                onClick={() => {
                  stopVoiceChat();
                  onExit();
                }}
                className="h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Dalgona Carving Modal (Season 1 Episode 2) */}
      {hud.dalgona?.active && hud.phase === 'playing' && (
        <DalgonaModalOverlay
          shape={hud.dalgona.shape}
          onProgress={(progress, cracks, failed, completed) => {
            controllerRef.current?.submitDalgonaProgress?.(progress, cracks, failed, completed);
          }}
        />
      )}

      {/* Avatar Customizer Modal */}
      {showAvatarModal && (
        <AvatarCustomizerModal
          config={avatarConfig}
          onChange={handleAvatarChange}
          onClose={() => setShowAvatarModal(false)}
        />
      )}

      {/* Squid Game SEASON 1 ONLY Stage Selector */}
      {showStagePicker && hud.canSwitchStage && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-3">
          <div className="w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-3xl bg-[#0f1626] border border-rose-500/40 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-black text-white">SQUID GAME — SEASON 1</h2>
                <p className="text-xs text-slate-300">৬টি মূল খেলা থেকে যেকোনো স্টেজ সিলেক্ট করুন</p>
              </div>
              <button
                type="button"
                onClick={() => setShowStagePicker(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SQUID_STAGES.map((st) => {
                const active = st.id === hud.squidStageId;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleSelectSquidStage(st.id)}
                    className={`text-left p-3 rounded-2xl border transition-all ${
                      active
                        ? 'bg-rose-600/25 border-rose-400 text-white'
                        : 'bg-slate-900/80 border-white/10 hover:border-rose-400/50 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black">
                        {st.episodeNum}. {st.title}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                    </div>
                    <p className="text-[11px] font-bold text-amber-300 mt-0.5">{st.bnTitle}</p>
                    <p className="text-[11px] text-slate-300 mt-1 line-clamp-2">{st.ruleSummary}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Context Lost Recovery Notice */}
      {contextLost && (
        <div className="fixed inset-0 z-40 bg-black/85 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-slate-900 border border-amber-400/50 p-5 text-center space-y-3 max-w-xs">
            <p className="text-sm font-black text-amber-300">3D Graphics Context Paused</p>
            <button
              type="button"
              onClick={handleRestart}
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black"
            >
              Reload World
            </button>
          </div>
        </div>
      )}

      {/* Stage Clear / Eliminated / Victory Overlay */}
      {hud.phase !== 'playing' && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0e1525] border border-white/15 p-5 text-center space-y-4 shadow-2xl">
            <div className="space-y-1">
              <p
                className={`text-xs font-black uppercase tracking-widest ${
                  hud.phase === 'eliminated' ? 'text-rose-400' : 'text-amber-400'
                }`}
              >
                {hud.phase === 'eliminated'
                  ? 'ELIMINATED'
                  : hud.phase === 'victory'
                  ? 'CHAMPION VICTORY'
                  : 'STAGE CLEARED'}
              </p>
              <h3 className="text-lg font-black text-white">{hud.stageLabel}</h3>
              {hud.signalText && <p className="text-xs text-slate-300">{hud.signalText}</p>}
            </div>

            <div className="rounded-2xl bg-slate-900/90 border border-white/10 p-3 flex items-center justify-around text-xs">
              <div>
                <p className="text-slate-400 font-semibold">{hud.scoreLabel}</p>
                <p className="text-base font-black text-amber-300">{hud.score}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold">Server</p>
                <p className="text-base font-black text-teal-300">
                  #{serverHud.serverNumber} ({serverHud.playerCount}/{serverHud.maxPlayers})
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {hud.phase === 'stage_clear' && hasNextSquidStage && (
                <button
                  type="button"
                  data-testid="roblox-next-stage-btn"
                  onClick={handleNextSquidStage}
                  className="w-full h-11 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-black flex items-center justify-center gap-1.5"
                >
                  <span>Next Stage</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                data-testid="roblox-retry-btn"
                onClick={handleRestart}
                className="w-full h-11 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  stopVoiceChat();
                  onExit();
                }}
                className="w-full h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Bottom Touch Controls */}
      {hud.phase === 'playing' && !hud.dalgona?.active && (
        <div className="pointer-events-none fixed bottom-0 inset-x-0 z-20 p-3 sm:p-5 flex items-end justify-between">
          <div
            onPointerDown={handleJoyDown}
            onPointerMove={handleJoyMove}
            onPointerUp={handleJoyUp}
            onPointerCancel={handleJoyUp}
            className="pointer-events-auto relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-[#0d1322]/70 border-2 border-white/20 flex items-center justify-center touch-none"
          >
            <div className="w-10 h-10 rounded-full border border-white/15" />
            <div
              className="absolute w-12 h-12 rounded-full bg-teal-400/85 border-2 border-white shadow-lg"
              style={{
                transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)`,
              }}
            />
          </div>

          <div className="pointer-events-auto flex items-end gap-2.5">
            {hud.secondaryActionLabel && (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  robloxAudio.unlock();
                  secondaryQueuedRef.current = true;
                }}
                className="h-12 px-4 rounded-2xl bg-indigo-600/95 active:scale-95 border border-indigo-300/50 text-xs font-black text-white shadow-lg"
              >
                {hud.secondaryActionLabel}
              </button>
            )}

            {hud.actionLabel && (
              <button
                type="button"
                data-testid="roblox-action-btn"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  robloxAudio.unlock();
                  actionQueuedRef.current = true;
                }}
                className="h-14 px-5 rounded-2xl bg-amber-500/95 active:scale-95 border-2 border-amber-200/70 text-xs sm:text-sm font-black text-slate-950 shadow-xl"
              >
                {hud.actionLabel}
              </button>
            )}

            <button
              type="button"
              data-testid="roblox-jump-btn"
              onPointerDown={(e) => {
                e.stopPropagation();
                robloxAudio.unlock();
                jumpQueuedRef.current = true;
              }}
              className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-emerald-500/95 active:scale-95 border-2 border-emerald-200/80 text-xs font-black text-slate-950 shadow-xl flex items-center justify-center"
            >
              JUMP
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const RemoteAudioPlayer: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
};
