/**
 * Lado do ESPECTADOR no modo retransmissão: recebe pedaços WebM e toca via MediaSource.
 * Mantém a latência baixa: se o buffer acumular mais que `maxLagSeconds`, pula para perto
 * do fim (melhor perder meio segundo do que ficar cada vez mais atrasado).
 */
export interface RelayPlayerOptions {
  maxLagSeconds?: number;
  /** Quantos segundos de passado manter no buffer antes de descartar. */
  keepSeconds?: number;
}

export class MseRelayPlayer {
  readonly url: string;
  private readonly media = new MediaSource();
  private buffer: SourceBuffer | null = null;
  private readonly queue: Uint8Array[] = [];
  private video: HTMLVideoElement | null = null;

  /** `true` se este navegador consegue tocar o formato (iPhone/Safari geralmente não). */
  static isSupported(mime: string): boolean {
    return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(mime);
  }

  constructor(
    private readonly mime: string,
    private readonly opts: RelayPlayerOptions = {},
  ) {
    this.url = URL.createObjectURL(this.media);
    this.media.addEventListener('sourceopen', () => {
      this.buffer = this.media.addSourceBuffer(this.mime);
      this.buffer.mode = 'sequence';
      this.buffer.addEventListener('updateend', () => this.flush());
      this.flush();
    });
  }

  /** Liga o player ao <video> (para controlar a latência). */
  attach(video: HTMLVideoElement): void {
    this.video = video;
  }

  append(chunk: Uint8Array): void {
    this.queue.push(chunk);
    this.flush();
  }

  close(): void {
    this.queue.length = 0;
    try {
      if (this.media.readyState === 'open') this.media.endOfStream();
    } catch {
      /* já encerrado */
    }
    URL.revokeObjectURL(this.url);
  }

  private flush(): void {
    const sb = this.buffer;
    if (!sb || sb.updating) return;
    this.trimAndCatchUp(sb);
    if (sb.updating) return;
    const next = this.queue.shift();
    if (!next) return;
    try {
      sb.appendBuffer(next as BufferSource);
    } catch (err) {
      // buffer cheio: descarta passado e tenta de novo no próximo updateend
      if ((err as DOMException).name === 'QuotaExceededError') this.queue.unshift(next);
    }
  }

  private trimAndCatchUp(sb: SourceBuffer): void {
    const v = this.video;
    if (!v || sb.buffered.length === 0) return;
    const end = sb.buffered.end(sb.buffered.length - 1);
    const start = sb.buffered.start(0);
    if (end - v.currentTime > (this.opts.maxLagSeconds ?? 3)) v.currentTime = Math.max(start, end - 0.5);
    const keep = this.opts.keepSeconds ?? 10;
    if (v.currentTime - start > keep * 2) sb.remove(start, v.currentTime - keep);
  }
}
