'use client';

/**
 * Synthesizes a classic ringback tone (440+480 Hz, 2s on / 4s off) via WebAudio
 * for the "calling/ringing" phase of the phone UI. No audio asset needed.
 */
export class Ringback {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    const ring = () => this.pulse();
    ring();
    this.timer = setInterval(ring, 6000);
  }

  private pulse(): void {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.05);
    gain.gain.setValueAtTime(0.12, t0 + 1.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.0);
    gain.connect(this.ctx.destination);
    for (const freq of [440, 480]) {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t0 + 2.0);
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}
