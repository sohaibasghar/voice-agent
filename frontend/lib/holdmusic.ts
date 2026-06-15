'use client';

/**
 * Gentle looping hold music played while a call is being transferred between
 * agents, so the caller hears the line is connecting (not dead air).
 * A soft arpeggio over a warm pad, synthesized via WebAudio (no asset).
 */
const ARP = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6

export class HoldMusic {
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pad: { osc: OscillatorNode; gain: GainNode }[] = [];
  private step = 0;

  start(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    const master = this.ctx.createGain();
    master.gain.value = 0.18;
    master.connect(this.ctx.destination);

    // Warm sustained pad (root + fifth).
    for (const freq of [130.81, 196.0]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.25;
      osc.connect(gain).connect(master);
      osc.start();
      this.pad.push({ osc, gain });
    }

    const playNote = () => {
      if (!this.ctx) return;
      const t0 = this.ctx.currentTime;
      const freq = ARP[this.step % ARP.length];
      this.step++;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      osc.connect(g).connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.5);
    };
    playNote();
    this.timer = setInterval(playNote, 420);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const { osc } of this.pad) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    }
    this.pad = [];
    this.step = 0;
    void this.ctx?.close();
    this.ctx = null;
  }
}
