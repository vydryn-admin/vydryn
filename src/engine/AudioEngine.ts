import { AudioFeatures } from '../types';

// Maximum audio file size accepted (200 MB — protects against tab crash on mobile)
export const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private destNode: MediaStreamAudioDestinationNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> =
  new Uint8Array(new ArrayBuffer(0));
  private waveData: Uint8Array<ArrayBuffer> =
  new Uint8Array(new ArrayBuffer(0));
  private currentObjectURL: string | null = null;

  private bassAvg = 0;
  private midAvg  = 0;
  private highAvg = 0;
  private beatEnv = 0;
  private _initialized = false;

  init(audioEl: HTMLAudioElement): void {
    if (this._initialized) return;
    const AC = (window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    this.audioCtx = new AC();
    this.source   = this.audioCtx.createMediaElementSource(audioEl);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.78;
    this.destNode = this.audioCtx.createMediaStreamDestination();

    this.source.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    this.analyser.connect(this.destNode);

    this.freqData = new Uint8Array(
  new ArrayBuffer(this.analyser.frequencyBinCount)
);

this.waveData = new Uint8Array(
  new ArrayBuffer(this.analyser.frequencyBinCount)
);
    this._initialized = true;
  }

  /**
   * Load an audio file. Validates size and type before creating an object URL.
   * Revokes the previous URL to prevent memory leaks.
   * Returns an error string on failure, null on success.
   */
  loadFile(audioEl: HTMLAudioElement, file: File): string | null {
    if (file.size > MAX_AUDIO_BYTES) {
      return `File too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum is 200 MB.`;
    }
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|flac|aac)$/i)) {
      return 'Please upload an audio file (mp3, wav, m4a).';
    }
    // Revoke previous object URL to free memory
    if (this.currentObjectURL) {
      URL.revokeObjectURL(this.currentObjectURL);
    }
    this.currentObjectURL = URL.createObjectURL(file);
    audioEl.src = this.currentObjectURL;
    return null;
  }

  resume(): void {
    if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
  }

  /** Suspend AudioContext when page is hidden — saves battery and CPU. */
  handleVisibilityChange(): void {
    if (!this.audioCtx) return;
    if (document.hidden) {
      this.audioCtx.suspend();
    } else {
      this.audioCtx.resume();
    }
  }

  get isInitialized(): boolean { return this._initialized; }
  get mediaStream(): MediaStream | null { return this.destNode?.stream ?? null; }

  update(timestamp: number): AudioFeatures {
    if (!this.analyser || !this._initialized) return this.idleFeatures(timestamp);

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.waveData);

    const n  = this.freqData.length;
    const be = Math.floor(n * 0.08);
    const me = Math.floor(n * 0.33);

    let b = 0, m = 0, h = 0;
    for (let i = 0; i < n; i++) {
      const v = this.freqData[i] / 255;
      if (i < be)      b += v;
      else if (i < me) m += v;
      else             h += v;
    }
    b /= be; m /= (me - be); h /= (n - me);

    let sumSq = 0;
    for (let i = 0; i < this.waveData.length; i++) {
      const d = (this.waveData[i] - 128) / 128;
      sumSq += d * d;
    }
    const vol = Math.min(1, Math.sqrt(sumSq / this.waveData.length) * 2.2);

    this.bassAvg = this.bassAvg * 0.92 + b * 0.08;
    this.midAvg  = this.midAvg  * 0.94 + m * 0.06;
    this.highAvg = this.highAvg * 0.94 + h * 0.06;

    const kick  = Math.min(1, Math.max(0, b - this.bassAvg * 1.22) * 5);
    const snare = Math.min(1, Math.max(0, m - this.midAvg  * 1.25) * 4);
    const hat   = Math.min(1, Math.max(0, h - this.highAvg * 1.18) * 3);

    this.beatEnv = Math.max(this.beatEnv * 0.86, Math.min(1, kick));

    return { bass: b, mid: m, high: h, vol, kick, snare, hat, beat: this.beatEnv };
  }

  private idleFeatures(timestamp: number): AudioFeatures {
    const t = timestamp / 1000;
    return {
      bass:  0.25 + 0.18 * Math.sin(t * 0.8),
      mid:   0.2  + 0.1  * Math.sin(t * 0.5),
      high:  0.18 + 0.1  * Math.sin(t * 1.7),
      vol:   0.2,
      kick:  0.15 * Math.max(0, Math.sin(t * 2.2)),
      snare: 0.08,
      hat:   0.12,
      beat:  0.2,
    };
  }

  /** Release all resources. Call when component unmounts. */
  destroy(): void {
    if (this.currentObjectURL) {
      URL.revokeObjectURL(this.currentObjectURL);
      this.currentObjectURL = null;
    }
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.destNode?.disconnect();
    this.audioCtx?.close();
    this.audioCtx = null;
    this._initialized = false;
  }
}
