import type { IceCandidate } from '@luzocast/signaling';
import type { QualityProfile } from './quality/QualityStrategy';

/** Sinal recebido do viewer (via servidor) que o transporte precisa processar. */
export type InboundSignal = { type: 'answer'; sdp: string } | { type: 'ice'; candidate: IceCandidate };

/** Para onde o transporte manda os sinais destinados a um viewer. */
export interface SignalSink {
  offer(viewerId: string, sdp: string): void;
  ice(viewerId: string, candidate: IceCandidate): void;
}

/** Diagnóstico do encode (Chromium `outbound-rtp`), agregado entre os viewers. */
export interface TransportStats {
  /** Ex.: "MediaFoundationVideoEncodeAccelerator" (hardware) ou "libvpx"/"OpenH264" (software). */
  encoderImplementation: string | null;
  /** `true` = encoder de hardware (GPU). `null` = navegador não informou. */
  hardwareEncoder: boolean | null;
  /** Pior limitação entre os viewers: 'cpu' e 'bandwidth' indicam gargalo. */
  qualityLimitation: 'none' | 'cpu' | 'bandwidth' | 'other';
  /** Menor fps e resolução entregues entre os viewers. */
  framesPerSecond: number | null;
  frameHeight: number | null;
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
  getStats(): Promise<TransportStats | null>;
  close(): void;
}
