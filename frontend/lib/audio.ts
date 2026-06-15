'use client';

/**
 * Browser audio engine for the server-side realtime topology (research.md D3).
 * Captures the mic and streams it to the backend as PCM16 mono @ 24kHz, and
 * plays back the PCM16 @ 24kHz audio the backend forwards from OpenAI.
 *
 * Playback uses a continuous ring-buffer AudioWorklet that resamples 24kHz →
 * device rate with a single fractional read position. This is what removes the
 * agent-voice distortion: the previous approach created one AudioBuffer per
 * streamed chunk and let Web Audio resample each independently, so every chunk
 * boundary was a discontinuity → constant buzz/garble. One continuous stream has
 * no boundaries. A short prebuffer absorbs network jitter; underruns emit silence.
 *
 * Worklets are loaded from Blob URLs so we never depend on separately-served
 * files (the cause of "unable to load a worklet's module").
 */
const TARGET_RATE = 24000;

const CAPTURE_WORKLET = `
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) this.port.postMessage(input[0].slice(0));
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

// Continuous PCM player: accumulates 24kHz samples and resamples to the context
// rate with a fractional read index; prebuffers ~120ms before starting.
const PLAYER_WORKLET = `
class PcmPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(0);
    this.read = 0;
    this.srcRate = ${TARGET_RATE};
    this.playing = false;
    this.minPrebuffer = ${Math.round(TARGET_RATE * 0.12)};
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'clear') { this.buf = new Float32Array(0); this.read = 0; this.playing = false; return; }
      if (d.type === 'samples') {
        const keep = Math.floor(this.read);
        const tail = this.buf.subarray(keep);
        const merged = new Float32Array(tail.length + d.samples.length);
        merged.set(tail, 0);
        merged.set(d.samples, tail.length);
        this.buf = merged;
        this.read -= keep;
      }
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return true;
    const avail = this.buf.length - this.read;
    if (!this.playing) {
      if (avail < this.minPrebuffer) { out.fill(0); return true; }
      this.playing = true;
    }
    const step = this.srcRate / sampleRate;
    for (let i = 0; i < out.length; i++) {
      const idx = this.read;
      const i0 = Math.floor(idx);
      if (i0 + 1 >= this.buf.length) { out[i] = 0; this.playing = false; continue; }
      const frac = idx - i0;
      out[i] = this.buf[i0] * (1 - frac) + this.buf[i0 + 1] * frac;
      this.read += step;
    }
    return true;
  }
}
registerProcessor('pcm-player', PcmPlayer);
`;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private playerNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private outGain: GainNode | null = null;
  // Fallback (no AudioWorklet) playback scheduling state:
  private nextPlayTime = 0;
  private liveSources = new Set<AudioBufferSourceNode>();

  async startCapture(onFrame: (pcm16: ArrayBuffer) => void): Promise<void> {
    this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.outGain = this.ctx.createGain();
    this.outGain.gain.value = 1;
    this.outGain.connect(this.ctx.destination);

    const hasWorklet = typeof this.ctx.audioWorklet?.addModule === 'function';
    if (hasWorklet) {
      try {
        await this.ctx.audioWorklet.addModule(blobUrl(CAPTURE_WORKLET));
        await this.ctx.audioWorklet.addModule(blobUrl(PLAYER_WORKLET));
        this.playerNode = new AudioWorkletNode(this.ctx, 'pcm-player', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
        });
        this.playerNode.connect(this.outGain);
      } catch (err) {
        console.warn('AudioWorklet unavailable; using fallback paths', err);
        this.playerNode = null;
      }
    }

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.source = this.ctx.createMediaStreamSource(this.micStream);
    const inRate = this.ctx.sampleRate;
    const handle = (frame: Float32Array) =>
      onFrame(floatToPcm16(downsample(frame, inRate, TARGET_RATE)));

    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    mute.connect(this.ctx.destination);

    if (this.playerNode) {
      // Worklet available → use it for capture too.
      this.workletNode = new AudioWorkletNode(this.ctx, 'capture-processor');
      this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => handle(e.data);
      this.source.connect(this.workletNode);
      this.workletNode.connect(mute);
    } else {
      this.scriptNode = this.ctx.createScriptProcessor(4096, 1, 1);
      this.scriptNode.onaudioprocess = (e) => handle(e.inputBuffer.getChannelData(0));
      this.source.connect(this.scriptNode);
      this.scriptNode.connect(mute);
    }
  }

  /** Enqueue a PCM16 (24kHz) chunk from the backend. */
  playChunk(pcm16: ArrayBuffer): void {
    if (!this.ctx) return;
    const float = pcm16ToFloat(pcm16);
    if (float.length === 0) return;

    if (this.playerNode) {
      this.playerNode.port.postMessage({ type: 'samples', samples: float }, [float.buffer]);
      return;
    }
    // Fallback: schedule contiguous AudioBuffers with a small lead.
    const buffer = this.ctx.createBuffer(1, float.length, TARGET_RATE);
    buffer.getChannelData(0).set(float);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.outGain!);
    const now = this.ctx.currentTime;
    if (this.nextPlayTime < now + 0.02) this.nextPlayTime = now + 0.15;
    src.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;
    this.liveSources.add(src);
    src.onended = () => this.liveSources.delete(src);
  }

  /** Barge-in: flush playback immediately. */
  stopPlayback(): void {
    this.playerNode?.port.postMessage({ type: 'clear' });
    for (const src of this.liveSources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.liveSources.clear();
    this.nextPlayTime = 0;
  }

  async close(): Promise<void> {
    this.stopPlayback();
    this.workletNode?.disconnect();
    this.playerNode?.disconnect();
    if (this.scriptNode) {
      this.scriptNode.onaudioprocess = null;
      this.scriptNode.disconnect();
    }
    this.source?.disconnect();
    this.outGain?.disconnect();
    this.micStream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close();
    this.ctx = null;
    this.micStream = null;
    this.workletNode = null;
    this.playerNode = null;
    this.scriptNode = null;
    this.source = null;
    this.outGain = null;
    this.nextPlayTime = 0;
  }
}

function blobUrl(src: string): string {
  return URL.createObjectURL(new Blob([src], { type: 'application/javascript' }));
}

/** Linear-interpolation resample of a mono Float32 frame from inRate → outRate. */
function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (inRate === outRate || input.length === 0) return input;
  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function floatToPcm16(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out.buffer;
}

function pcm16ToFloat(buf: ArrayBuffer): Float32Array {
  const view = new Int16Array(buf);
  const out = new Float32Array(view.length);
  for (let i = 0; i < view.length; i++) out[i] = view[i] / 0x8000;
  return out;
}
