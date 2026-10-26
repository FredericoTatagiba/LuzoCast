import type { MediaTransport, InboundSignal, SignalSink, TransportCallbacks } from './MediaTransport';
import { PeerConnectionFactory, preferredVideoCodecs } from './PeerConnectionFactory';
import type { QualityProfile } from './quality/QualityStrategy';

/**
 * Transporte padrão: uma RTCPeerConnection `sendonly` por viewer.
 * Não cria DataChannel — o viewer não tem como enviar nada pela conexão de mídia.
 */
export class WebRtcTransport implements MediaTransport {
  readonly kind = 'webrtc' as const;
  private readonly peers = new Map<string, RTCPeerConnection>();
  private quality: QualityProfile | null = null;

  constructor(
    private readonly sink: SignalSink,
    private readonly factory = new PeerConnectionFactory(),
    private readonly callbacks: TransportCallbacks = {},
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
    if (this.quality) await this.applyTo(pc, this.quality);
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

  close(): void {
    for (const id of [...this.peers.keys()]) this.removeViewer(id);
  }

  private preferCodecs(transceiver: RTCRtpTransceiver): void {
    const caps = RTCRtpSender.getCapabilities?.('video');
    if (caps && 'setCodecPreferences' in transceiver) {
      transceiver.setCodecPreferences(preferredVideoCodecs(caps.codecs));
    }
  }

  private async applyTo(pc: RTCPeerConnection, q: QualityProfile): Promise<void> {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      const params = sender.getParameters();
      if (!params.encodings?.length) params.encodings = [{}];
      for (const enc of params.encodings) {
        enc.maxBitrate = q.maxBitrateKbps * 1000;
        enc.maxFramerate = q.maxFramerate;
        enc.scaleResolutionDownBy = q.scaleResolutionDownBy;
      }
      // conteúdo de tela: priorizar nitidez sobre fluidez
      params.degradationPreference = 'maintain-resolution';
      await sender.setParameters(params).catch(() => undefined);
    }
  }
}
