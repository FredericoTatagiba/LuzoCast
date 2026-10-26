import type { InboundSignal, MediaTransport, TransportStats } from './MediaTransport';
import type { QualityProfile } from './quality/QualityStrategy';

/** Para onde vão o anúncio e os pedaços do modo retransmissão (canal de controle). */
export interface RelaySink {
  start(viewerId: string, mime: string): void;
  chunk(viewerId: string, data: Uint8Array): void;
}

/** Formatos em ordem de preferência; o primeiro suportado pelo MediaRecorder é usado. */
const MIME_CANDIDATES = {
  withAudio: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus'],
  videoOnly: ['video/webm;codecs=vp8', 'video/webm;codecs=vp9'],
};

export function pickRelayMime(hasAudio: boolean, isSupported: (m: string) => boolean): string | null {
  return (hasAudio ? MIME_CANDIDATES.withAudio : MIME_CANDIDATES.videoOnly).find(isSupported) ?? null;
}

/**
 * Modo RETRANSMISSÃO (fallback quando o P2P falha — ADR-0004).
 * Cada viewer ganha um MediaRecorder que gera WebM em pedaços de ~250 ms; os pedaços vão
 * pelo canal de controle → servidor local → túnel → WebSocket do viewer → MediaSource.
 *
 * Por que um recorder POR viewer: o WebM só é tocável a partir do cabeçalho inicial; um
 * gravador dedicado garante que cada viewer recebe o fluxo desde o começo. Como só quem
 * falhou no P2P usa este modo, o custo extra é pequeno.
 *
 * Trade-offs: latência de 1–3 s e todo o vídeo passa pelo túnel (mais upload pela Cloudflare).
 */
export class MseTransport implements MediaTransport {
  readonly kind = 'mse' as const;
  private readonly recorders = new Map<string, MediaRecorder>();
  private bitrateKbps = 2500;

  constructor(
    private readonly sink: RelaySink,
    private readonly env = {
      createRecorder: (s: MediaStream, o: MediaRecorderOptions) => new MediaRecorder(s, o),
      isSupported: (m: string) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
    },
  ) {}

  get viewerCount(): number {
    return this.recorders.size;
  }

  async addViewer(viewerId: string, stream: MediaStream): Promise<void> {
    if (this.recorders.has(viewerId)) return;
    const mime = pickRelayMime(stream.getAudioTracks().length > 0, this.env.isSupported);
    if (!mime) throw new Error('Este PC não consegue gravar WebM para o modo retransmissão');

    const recorder = this.env.createRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: this.bitrateKbps * 1000,
      audioBitsPerSecond: 96_000,
    });
    this.recorders.set(viewerId, recorder);
    this.sink.start(viewerId, mime);
    recorder.ondataavailable = (e) => {
      if (!e.data.size || !this.recorders.has(viewerId)) return;
      void e.data.arrayBuffer().then((buf) => this.sink.chunk(viewerId, new Uint8Array(buf)));
    };
    recorder.start(250);
  }

  async handleSignal(_viewerId: string, _signal: InboundSignal): Promise<void> {
    /* sem sinalização: o fluxo é unidirecional */
  }

  removeViewer(viewerId: string): void {
    const r = this.recorders.get(viewerId);
    this.recorders.delete(viewerId);
    if (r && r.state !== 'inactive') r.stop();
  }

  /** Vale para os próximos viewers (o MediaRecorder não muda bitrate em andamento). */
  async applyQuality(profile: QualityProfile): Promise<void> {
    // pelo túnel, mais conservador que no P2P
    this.bitrateKbps = Math.min(profile.maxBitrateKbps, 3000);
  }

  async getStats(): Promise<TransportStats | null> {
    return null;
  }

  close(): void {
    for (const id of [...this.recorders.keys()]) this.removeViewer(id);
  }
}
