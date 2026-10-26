import type { IceCandidate } from '@luzocast/signaling';
import type { QualityProfile } from './quality/QualityStrategy';

/** Sinal recebido do viewer (via servidor) que o transporte precisa processar. */
export type InboundSignal = { type: 'answer'; sdp: string } | { type: 'ice'; candidate: IceCandidate };

/** Para onde o transporte manda os sinais destinados a um viewer. */
export interface SignalSink {
  offer(viewerId: string, sdp: string): void;
  ice(viewerId: string, candidate: IceCandidate): void;
}

export interface TransportCallbacks {
  /** O caminho de mídia com o viewer falhou (ex.: ICE `failed`). */
  onViewerFailed?: (viewerId: string) => void;
}

/**
 * Strategy de transporte de mídia do lado do HOST.
 * Implementações: `WebRtcTransport` (padrão), `MseTransport` (encode único, Fase 3).
 * Contrato (LSP): `removeViewer` e `close` são idempotentes; sinais de viewers
 * desconhecidos são ignorados.
 */
export interface MediaTransport {
  readonly kind: 'webrtc' | 'mse';
  readonly viewerCount: number;
  addViewer(viewerId: string, stream: MediaStream): Promise<void>;
  handleSignal(viewerId: string, signal: InboundSignal): Promise<void>;
  removeViewer(viewerId: string): void;
  applyQuality(profile: QualityProfile): Promise<void>;
  close(): void;
}
