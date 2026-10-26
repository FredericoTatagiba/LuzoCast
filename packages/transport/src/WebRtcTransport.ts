import type { MediaTransport, InboundSignal, SignalSink, TransportCallbacks, TransportStats } from './MediaTransport';
import { PeerConnectionFactory, preferredVideoCodecs } from './PeerConnectionFactory';
import type { QualityProfile } from './quality/QualityStrategy';
import { summarizeOutboundStats } from './stats';

export interface WebRtcTransportOptions {
  /**
   * O que sacrificar quando falta banda/CPU:
   * - 'maintain-resolution' (apresentação): texto nítido, fps cai;
   * - 'maintain-framerate' (jogo): movimento fluido, resolução cai.
   */
  degradationPreference?: RTCDegradationPreference;
}

/**
 * Transporte padrão: uma RTCPeerConnection `sendonly` por viewer.
 * Não cria DataChannel — o viewer não tem como enviar nada pela conexão de mídia.
 *
 * ⚠️ Cada viewer = 1 encoder. Em GPUs NVIDIA de consumo há limite de sessões NVENC
 * simultâneas; acima dele o Chromium cai para encoder de software (CPU). Ver docs/performance.md.
 */
export class WebRtcTransport implements MediaTransport {
  readonly kind = 'webrtc' as const;
  private readonly peers = new Map<string, RTCPeerConnection>();
  private quality: QualityProfile | null = null;

  constructor(
    private readonly sink: SignalSink,
    private readonly factory = new PeerConnectionFactory(),
    private readonly callbacks: TransportCallbacks = {},
    private readonly options: WebRtcTransportOptions = {},
  ) {}

  get viewerCount(): number {
    return this.peers.size;
  }

  async addViewer(viewerId: string, stream: MediaStream): Promise<void> {
    if (this.peers.has(viewerId)) return;
    const pc = this.factory.create();
    this.peers.set(viewerId, pc);

    for (const track of stream.getTracks()) {
      const transceiver = pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
      if (track.kind === 'video') this.preferCodecs(transceiver);
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) this.sink.ice(viewerId, e.candidate.toJSON() as never);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.callbacks.onViewerFailed?.(viewerId);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.applyTo(pc, this.quality);
    this.sink.offer(viewerId, pc.localDescription?.sdp ?? offer.sdp ?? '');
  }

  async handleSignal(viewerId: string, signal: InboundSignal): Promise<void> {
    const pc = this.peers.get(viewerId);
    if (!pc) return;
    if (signal.type === 'answer') await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
    else await pc.addIceCandidate(signal.candidate);
  }

  removeViewer(viewerId: string): void {
    this.peers.get(viewerId)?.close();
    this.peers.delete(viewerId);
  }

  async applyQuality(profile: QualityProfile): Promise<void> {
    this.quality = profile;
    await Promise.all([...this.peers.values()].map((pc) => this.applyTo(pc, profile)));
  }

  async getStats(): Promise<TransportStats | null> {
    if (this.peers.size === 0) return null;
    const reports = await Promise.all([...this.peers.values()].map((pc) => pc.getStats().catch(() => null)));
    const outbound: Record<string, unknown>[] = [];
    for (const report of reports) {
      report?.forEach((s: Record<string, unknown>) => {
        if (s['type'] === 'outbound-rtp' && s['kind'] === 'video') outbound.push(s);
      });
    }
    return summarizeOutboundStats(outbound);
  }

  close(): void {
    for (const id of [...this.peers.keys()]) this.removeViewer(id);
  }

  private preferCodecs(transceiver: RTCRtpTransceiver): void {
    const caps = RTCRtpSender.getCapabilities?.('video');
    if (caps && 'setCodecPreferences' in transceiver) {
      transceiver.setCodecPreferences(preferredVideoCodecs(caps.codecs));
    }
  }

  private async applyTo(pc: RTCPeerConnection, q: QualityProfile | null): Promise<void> {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      if (q) {
        for (const enc of params.encodings) {
          enc.maxBitrate = q.maxBitrateKbps * 1000;
          enc.maxFramerate = q.maxFramerate;
          enc.scaleResolutionDownBy = q.scaleResolutionDownBy;
        }
      }
      params.degradationPreference = this.options.degradationPreference ?? 'maintain-resolution';
      await sender.setParameters(params).catch(() => undefined);
    }
  }
}
