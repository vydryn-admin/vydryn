export interface RecordingResult {
  blob: Blob;
  durationMs: number;
  audioStartTime: number;
  mimeType: string;
}

export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt   = 0;
  private audioStart  = 0;
  private mimeType    = '';
  private onDone: ((result: RecordingResult) => void) | null = null;
  private onError: ((err: Error) => void) | null = null;

  static bestMimeType(): string {
    const candidates = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];
    return candidates.find(m => {
      try { return MediaRecorder.isTypeSupported(m); } catch { return false; }
    }) ?? 'video/webm';
  }

  start(
    canvas: HTMLCanvasElement,
    audioStream: MediaStream | null,
    audioCurrentTime: number,
    onComplete: (result: RecordingResult) => void,
    onFail?: (err: Error) => void,
  ): void {
    this.onDone  = onComplete;
    this.onError = onFail ?? null;

    let videoStream: MediaStream;
    try {
      videoStream = canvas.captureStream(60);
    } catch (e) {
      this.onError?.(new Error('Canvas capture failed. Try a smaller export format.'));
      return;
    }

    const tracks = [...videoStream.getVideoTracks()];
    if (audioStream) tracks.push(...audioStream.getAudioTracks());

    this.mimeType   = Recorder.bestMimeType();
    this.chunks     = [];
    this.startedAt  = performance.now();
    this.audioStart = audioCurrentTime;

    try {
      this.mediaRecorder = new MediaRecorder(new MediaStream(tracks), {
        mimeType: this.mimeType,
        videoBitsPerSecond: 9_000_000,
      });
    } catch (e) {
      // Codec negotiation failure — retry without specifying codec
      try {
        this.mimeType = 'video/webm';
        this.mediaRecorder = new MediaRecorder(new MediaStream(tracks), {
          mimeType: this.mimeType,
        });
      } catch (e2) {
        this.onError?.(new Error('Recording is not supported in this browser.'));
        return;
      }
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data?.size) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      if (this.chunks.length === 0) {
        this.onError?.(new Error('Recording produced no data. Please try again.'));
        return;
      }
      const blob = new Blob(this.chunks, { type: this.mimeType });
      this.onDone?.({
        blob,
        durationMs:    performance.now() - this.startedAt,
        audioStartTime: this.audioStart,
        mimeType:      this.mimeType,
      });
      this.chunks = []; // free memory
    };

    this.mediaRecorder.onerror = (e) => {
      this.onError?.(new Error(`Recording error: ${(e as ErrorEvent).message ?? 'unknown'}`));
    };

    this.mediaRecorder.start(1000); // collect data in 1s chunks — safer for long recordings
  }

  stop(): void {
    if (this.mediaRecorder?.state !== 'inactive') {
      try { this.mediaRecorder?.stop(); } catch { /* already stopped */ }
    }
    this.mediaRecorder = null;
  }

  get isActive(): boolean {
    return !!this.mediaRecorder && this.mediaRecorder.state !== 'inactive';
  }

  static download(blob: Blob, baseName: string): void {
    const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const name = baseName.replace(/\.(mp4|webm)$/, '') + '.' + ext;
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Delay revoke so slow browsers finish the download initiation
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
