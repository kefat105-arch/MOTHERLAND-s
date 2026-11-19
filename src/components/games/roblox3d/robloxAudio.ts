class RobloxAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastFootstepAt = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock(): void {
    this.ensureContext();
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.14
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playFootstep(nowMs: number, intervalMs = 310): void {
    if (nowMs - this.lastFootstepAt < intervalMs) return;
    this.lastFootstepAt = nowMs;
    this.playTone(115 + Math.random() * 25, 65, 0.06, 'triangle', 0.045);
  }

  public playJump(): void {
    this.playTone(230, 520, 0.14, 'sine', 0.12);
  }

  public playCoin(): void {
    this.playTone(880, 1320, 0.09, 'sine', 0.12);
    setTimeout(() => this.playTone(1320, 1760, 0.11, 'triangle', 0.1), 55);
  }

  public playCheckpoint(): void {
    this.playTone(523.25, 659.25, 0.12, 'triangle', 0.13);
    setTimeout(() => this.playTone(659.25, 1046.5, 0.18, 'triangle', 0.13), 85);
  }

  public playElimination(): void {
    this.playTone(185, 48, 0.24, 'sawtooth', 0.16);
  }

  public playLaserScan(): void {
    this.playTone(760, 320, 0.19, 'square', 0.09);
  }

  public playDollChant(stepIndex: number): void {
    const notes = [440, 493.88, 523.25, 587.33, 523.25];
    const f = notes[stepIndex % notes.length];
    this.playTone(f, f * 1.01, 0.12, 'triangle', 0.09);
  }

  public playGlassShatter(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    [1420, 1980, 2650, 920].forEach((f, idx) => {
      setTimeout(() => this.playTone(f, f * 0.45, 0.11, 'square', 0.07), idx * 25);
    });
  }

  public playDoorCreak(): void {
    this.playTone(260, 190, 0.22, 'sawtooth', 0.07);
  }

  public playRushWarn(): void {
    this.playTone(130, 95, 0.35, 'sawtooth', 0.12);
    setTimeout(() => this.playTone(95, 65, 0.35, 'sawtooth', 0.14), 160);
  }

  public playGunshot(): void {
    this.playTone(320, 55, 0.16, 'sawtooth', 0.18);
  }

  public playSlash(): void {
    this.playTone(680, 190, 0.14, 'sawtooth', 0.12);
  }

  public playExplosion(): void {
    this.playTone(120, 32, 0.42, 'sawtooth', 0.18);
  }

  public playVictory(): void {
    const melody = [523.25, 659.25, 783.99, 1046.5];
    melody.forEach((f, i) => {
      setTimeout(() => this.playTone(f, f, 0.2, 'triangle', 0.14), i * 110);
    });
  }

  public playClick(): void {
    this.playTone(620, 740, 0.05, 'sine', 0.07);
  }
}

export const robloxAudio = new RobloxAudioEngine();
