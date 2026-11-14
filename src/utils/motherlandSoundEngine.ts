/**
 * MOTHERLAND Signature Web Audio Sound Engine
 * Original acoustic-lydian synthesis ("Shonar Dhwani") for:
 *  - Incoming Call Ringtone
 *  - Outgoing Ringback Tone
 *  - Notification Chime
 *  - Wave Message Ripple
 *  - Call Connect / End Chimes
 *
 * 100% original procedural synthesis — zero external audio dependencies and
 * musically distinct from stock phone/OS ringtones.
 */

const SOUND_MUTE_STORAGE_KEY = 'motherland_sound_muted_v1';

let sharedCtx: AudioContext | null = null;
let autoUnlockListenersBound = false;
let callLoopTimer: number | null = null;
let currentCallLoopMode: 'incoming' | 'outgoing' | null = null;
let callRingTemporarilyMuted = false;
let lastNotifChimeMs = 0;
let lastMessageChimeMs = 0;
const activeStopCallbacks = new Set<() => void>();
const stateListeners = new Set<() => void>();

function notifyStateListeners() {
  stateListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
}

function getAudioContextClass(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null;
}

function getOrCreateContext(): AudioContext | null {
  const Ctx = getAudioContextClass();
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new Ctx();
    sharedCtx.onstatechange = () => {
      notifyStateListeners();
    };
  }
  return sharedCtx;
}

function bindAutoUnlockListeners() {
  if (autoUnlockListenersBound || typeof window === 'undefined') return;
  autoUnlockListenersBound = true;

  const tryUnlock = () => {
    const ctx = getOrCreateContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => notifyStateListeners())
        .catch(() => {});
    }
    if (ctx.state === 'running') {
      window.removeEventListener('pointerdown', tryUnlock, true);
      window.removeEventListener('touchstart', tryUnlock, true);
      window.removeEventListener('keydown', tryUnlock, true);
    }
  };

  window.addEventListener('pointerdown', tryUnlock, { capture: true, passive: true });
  window.addEventListener('touchstart', tryUnlock, { capture: true, passive: true });
  window.addEventListener('keydown', tryUnlock, { capture: true, passive: true });
}

if (typeof window !== 'undefined') {
  bindAutoUnlockListeners();
}

export function isGlobalSoundMuted(): boolean {
  try {
    return localStorage.getItem(SOUND_MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setGlobalSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(SOUND_MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // ignore storage errors
  }
  if (muted) {
    stopAllActiveVoices();
  }
  notifyStateListeners();
}

export function isCallAudioBlocked(): boolean {
  if (typeof window === 'undefined') return false;
  const ctx = sharedCtx;
  return Boolean(ctx && ctx.state === 'suspended');
}

export function subscribeSoundState(cb: () => void): () => void {
  stateListeners.add(cb);
  return () => {
    stateListeners.delete(cb);
  };
}

export async function unlockSoundEngine(): Promise<boolean> {
  const ctx = getOrCreateContext();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      notifyStateListeners();
      return false;
    }
  }
  notifyStateListeners();
  return ctx.state === 'running';
}

function stopAllActiveVoices() {
  activeStopCallbacks.forEach((stop) => {
    try {
      stop();
    } catch {
      // ignore cleanup errors
    }
  });
  activeStopCallbacks.clear();
}

interface BusNodes {
  input: GainNode;
  cleanup: () => void;
}

function createWarmEchoBus(ctx: AudioContext, volume: number, wetMix = 0.28): BusNodes {
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const delay = ctx.createDelay(1.0);
  const feedback = ctx.createGain();
  const warmthFilter = ctx.createBiquadFilter();
  const limiter = ctx.createDynamicsCompressor();

  dry.gain.value = 1.0;
  wet.gain.value = wetMix;
  delay.delayTime.value = 0.185;
  feedback.gain.value = 0.24;

  warmthFilter.type = 'lowpass';
  warmthFilter.frequency.value = 2300;
  warmthFilter.Q.value = 0.6;

  limiter.threshold.value = -10;
  limiter.knee.value = 12;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.005;
  limiter.release.value = 0.15;

  const master = ctx.createGain();
  master.gain.value = volume;

  // Dry path
  input.connect(dry);
  dry.connect(limiter);

  // Warm filtered echo path
  input.connect(delay);
  delay.connect(warmthFilter);
  warmthFilter.connect(feedback);
  feedback.connect(delay);
  warmthFilter.connect(wet);
  wet.connect(limiter);

  limiter.connect(master);
  master.connect(ctx.destination);

  return {
    input,
    cleanup: () => {
      try {
        master.disconnect();
        limiter.disconnect();
        delay.disconnect();
        warmthFilter.disconnect();
        feedback.disconnect();
        dry.disconnect();
        wet.disconnect();
        input.disconnect();
      } catch {
        // ignore
      }
    },
  };
}

/**
 * Synthesizes an acoustic "kalimba-marimba-bell" voice unique to MOTHERLAND.
 */
function scheduleAcousticNote(
  ctx: AudioContext,
  dest: AudioNode,
  freqHz: number,
  startTime: number,
  durationSec: number,
  peakGain: number,
  shimmerLevel = 0.18
) {
  const oscMain = ctx.createOscillator();
  const oscHarmonic = ctx.createOscillator();
  const oscSub = ctx.createOscillator();

  const mainGain = ctx.createGain();
  const harmonicGain = ctx.createGain();
  const subGain = ctx.createGain();
  const voiceFilter = ctx.createBiquadFilter();
  const noteEnv = ctx.createGain();

  // Warm fundamental + golden triangle overtone + subtle octave-fifth shimmer
  oscMain.type = 'sine';
  oscMain.frequency.setValueAtTime(freqHz, startTime);
  // Microscopic organic pitch settle (2 cents) for natural acoustic character
  oscMain.frequency.exponentialRampToValueAtTime(freqHz * 1.0012, startTime + 0.04);
  oscMain.frequency.exponentialRampToValueAtTime(freqHz, startTime + durationSec);

  oscHarmonic.type = 'triangle';
  oscHarmonic.frequency.setValueAtTime(freqHz * 2, startTime);

  oscSub.type = 'sine';
  oscSub.frequency.setValueAtTime(freqHz * 0.5, startTime);

  mainGain.gain.value = 0.78;
  harmonicGain.gain.value = shimmerLevel;
  subGain.gain.value = 0.12;

  voiceFilter.type = 'lowpass';
  voiceFilter.frequency.setValueAtTime(Math.min(4800, freqHz * 4.2), startTime);
  voiceFilter.frequency.exponentialRampToValueAtTime(Math.max(900, freqHz * 1.5), startTime + durationSec);

  noteEnv.gain.setValueAtTime(0.0001, startTime);
  noteEnv.gain.linearRampToValueAtTime(peakGain, startTime + 0.014);
  noteEnv.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain * 0.34), startTime + durationSec * 0.42);
  noteEnv.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  oscMain.connect(mainGain);
  oscHarmonic.connect(harmonicGain);
  oscSub.connect(subGain);

  mainGain.connect(voiceFilter);
  harmonicGain.connect(voiceFilter);
  subGain.connect(voiceFilter);
  voiceFilter.connect(noteEnv);
  noteEnv.connect(dest);

  oscMain.start(startTime);
  oscHarmonic.start(startTime);
  oscSub.start(startTime);

  const stopAt = startTime + durationSec + 0.05;
  oscMain.stop(stopAt);
  oscHarmonic.stop(stopAt);
  oscSub.stop(stopAt);

  const stopImmediate = () => {
    try {
      const now = ctx.currentTime;
      noteEnv.gain.cancelScheduledValues(now);
      noteEnv.gain.setTargetAtTime(0.0001, now, 0.02);
      oscMain.stop(now + 0.06);
      oscHarmonic.stop(now + 0.06);
      oscSub.stop(now + 0.06);
    } catch {
      // ignore already stopped
    }
  };

  activeStopCallbacks.add(stopImmediate);
  oscMain.onended = () => {
    activeStopCallbacks.delete(stopImmediate);
  };
}

/**
 * Plays one full cycle of the signature MOTHERLAND Incoming Ringtone ("Shonar Dhwani").
 * D-Lydian acoustic motif: D5 -> A5 -> C#6 -> B5 -> G#5 -> A5 -> E6 over warm drone D4+A4.
 */
function playIncomingCycleOnce(volume = 0.44) {
  const ctx = getOrCreateContext();
  if (!ctx || isGlobalSoundMuted() || callRingTemporarilyMuted) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (ctx.state !== 'running') {
    notifyStateListeners();
    return;
  }

  const bus = createWarmEchoBus(ctx, volume, 0.32);
  const t0 = ctx.currentTime + 0.03;

  // Soft warm acoustic drone foundation (D4 + A4)
  scheduleAcousticNote(ctx, bus.input, 293.66, t0, 2.2, 0.22, 0.05);
  scheduleAcousticNote(ctx, bus.input, 440.0, t0 + 0.06, 2.1, 0.16, 0.05);

  // Bespoke 7-note lyrical arpeggio signature
  const motif: Array<{ freq: number; offset: number; dur: number; gain: number; shimmer: number }> = [
    { freq: 587.33, offset: 0.0, dur: 0.55, gain: 0.42, shimmer: 0.18 }, // D5
    { freq: 880.0, offset: 0.19, dur: 0.52, gain: 0.44, shimmer: 0.20 }, // A5
    { freq: 1108.73, offset: 0.38, dur: 0.58, gain: 0.46, shimmer: 0.22 }, // C#6
    { freq: 987.77, offset: 0.62, dur: 0.48, gain: 0.38, shimmer: 0.16 }, // B5
    { freq: 830.61, offset: 0.84, dur: 0.50, gain: 0.36, shimmer: 0.16 }, // G#5 (Lydian lift)
    { freq: 880.0, offset: 1.06, dur: 0.62, gain: 0.42, shimmer: 0.20 }, // A5
    { freq: 1318.51, offset: 1.30, dur: 1.15, gain: 0.40, shimmer: 0.24 }, // E6 golden resolve
  ];

  for (const n of motif) {
    scheduleAcousticNote(ctx, bus.input, n.freq, t0 + n.offset, n.dur, n.gain, n.shimmer);
  }

  window.setTimeout(() => {
    bus.cleanup();
  }, 3200);
}

/**
 * Plays one full cycle of the Outgoing Ringback Melody ("Horizon Pulse").
 * Warm soothing chime when calling someone so outgoing calls sound alive & unmistakable.
 */
function playOutgoingCycleOnce(volume = 0.32) {
  const ctx = getOrCreateContext();
  if (!ctx || isGlobalSoundMuted() || callRingTemporarilyMuted) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (ctx.state !== 'running') {
    notifyStateListeners();
    return;
  }

  const bus = createWarmEchoBus(ctx, volume, 0.35);
  const t0 = ctx.currentTime + 0.03;

  // Soft welcoming two-phrase call-waiting shimmer
  scheduleAcousticNote(ctx, bus.input, 587.33, t0 + 0.0, 0.55, 0.34, 0.12); // D5
  scheduleAcousticNote(ctx, bus.input, 880.0, t0 + 0.14, 0.65, 0.30, 0.15); // A5
  scheduleAcousticNote(ctx, bus.input, 739.99, t0 + 0.56, 0.62, 0.32, 0.13); // F#5
  scheduleAcousticNote(ctx, bus.input, 1108.73, t0 + 0.72, 0.95, 0.28, 0.18); // C#6

  window.setTimeout(() => {
    bus.cleanup();
  }, 2600);
}

export function startCallRingtoneLoop(mode: 'incoming' | 'outgoing'): void {
  // Strictly ring ONLY the receiver's phone ('incoming'). Caller device stays completely silent.
  if (mode !== 'incoming') {
    stopCallRingtones();
    return;
  }
  if (currentCallLoopMode === 'incoming' && callLoopTimer !== null) return;
  stopCallRingtones();
  currentCallLoopMode = 'incoming';
  callRingTemporarilyMuted = false;

  const triggerCycle = () => {
    if (currentCallLoopMode !== 'incoming') return;
    playIncomingCycleOnce();
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !callRingTemporarilyMuted && !isGlobalSoundMuted()) {
        navigator.vibrate([220, 110, 220]);
      }
    } catch {
      // ignore vibration unsupported
    }
  };

  // Attempt immediate unlock & play
  unlockSoundEngine().finally(() => {
    if (currentCallLoopMode === 'incoming') {
      triggerCycle();
    }
  });

  callLoopTimer = window.setInterval(triggerCycle, 3350);
  notifyStateListeners();
}

export function stopCallRingtones(): void {
  currentCallLoopMode = null;
  if (callLoopTimer !== null) {
    window.clearInterval(callLoopTimer);
    callLoopTimer = null;
  }
  stopAllActiveVoices();
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(0);
    }
  } catch {
    // ignore
  }
  notifyStateListeners();
}

export function isCallRingTemporarilyMuted(): boolean {
  return callRingTemporarilyMuted;
}

export function toggleCallRingTemporarilyMuted(): boolean {
  callRingTemporarilyMuted = !callRingTemporarilyMuted;
  if (callRingTemporarilyMuted) {
    stopAllActiveVoices();
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
    } catch {
      // ignore
    }
  } else if (currentCallLoopMode === 'incoming') {
    unlockSoundEngine().then(() => playIncomingCycleOnce());
  }
  notifyStateListeners();
  return callRingTemporarilyMuted;
}

/**
 * Preview signature ringtone cleanly from Settings.
 */
export async function previewMotherlandRingtone(): Promise<void> {
  await unlockSoundEngine();
  callRingTemporarilyMuted = false;
  stopAllActiveVoices();
  playIncomingCycleOnce(0.46);
}

/**
 * Quick upward chime when call media connects.
 */
export function playCallConnectedChime(): void {
  if (isGlobalSoundMuted()) return;
  const ctx = getOrCreateContext();
  if (!ctx || ctx.state !== 'running') return;
  const bus = createWarmEchoBus(ctx, 0.34, 0.18);
  const t0 = ctx.currentTime + 0.01;
  scheduleAcousticNote(ctx, bus.input, 587.33, t0, 0.22, 0.38, 0.14); // D5
  scheduleAcousticNote(ctx, bus.input, 880.0, t0 + 0.09, 0.34, 0.42, 0.18); // A5
  window.setTimeout(() => bus.cleanup(), 900);
}

/**
 * Gentle downward chime when call ends or declines.
 */
export function playCallEndedChime(): void {
  if (isGlobalSoundMuted()) return;
  const ctx = getOrCreateContext();
  if (!ctx || ctx.state !== 'running') return;
  const bus = createWarmEchoBus(ctx, 0.30, 0.16);
  const t0 = ctx.currentTime + 0.01;
  scheduleAcousticNote(ctx, bus.input, 493.88, t0, 0.22, 0.36, 0.10); // B4
  scheduleAcousticNote(ctx, bus.input, 329.63, t0 + 0.11, 0.36, 0.34, 0.08); // E4
  window.setTimeout(() => bus.cleanup(), 900);
}

/**
 * Original MOTHERLAND Notification Chime ("Dewdrop Chime").
 * Fires on incoming notifications cleanly with burst protection cooldown.
 */
export async function playNotificationChime(forcePreview = false): Promise<void> {
  if (!forcePreview && isGlobalSoundMuted()) return;
  const now = Date.now();
  if (!forcePreview && now - lastNotifChimeMs < 650) return;
  lastNotifChimeMs = now;

  const ctx = getOrCreateContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }
  if (ctx.state !== 'running') return;

  const bus = createWarmEchoBus(ctx, 0.38, 0.28);
  const t0 = ctx.currentTime + 0.015;
  // Crisp crystalline 3-note MOTHERLAND notification sparkle: F#5 -> C#6 -> E6
  scheduleAcousticNote(ctx, bus.input, 739.99, t0, 0.32, 0.38, 0.18);
  scheduleAcousticNote(ctx, bus.input, 1108.73, t0 + 0.09, 0.38, 0.42, 0.22);
  scheduleAcousticNote(ctx, bus.input, 1318.51, t0 + 0.19, 0.56, 0.36, 0.24);
  window.setTimeout(() => bus.cleanup(), 1500);
}

/**
 * Subtle Wave chat message droplet chime.
 */
export function playMessageChime(): void {
  if (isGlobalSoundMuted()) return;
  const now = Date.now();
  if (now - lastMessageChimeMs < 900) return;
  lastMessageChimeMs = now;

  const ctx = getOrCreateContext();
  if (!ctx || ctx.state !== 'running') return;

  const bus = createWarmEchoBus(ctx, 0.24, 0.20);
  const t0 = ctx.currentTime + 0.01;
  scheduleAcousticNote(ctx, bus.input, 880.0, t0, 0.22, 0.30, 0.12); // A5
  scheduleAcousticNote(ctx, bus.input, 1318.51, t0 + 0.08, 0.34, 0.28, 0.16); // E6
  window.setTimeout(() => bus.cleanup(), 1100);
}
