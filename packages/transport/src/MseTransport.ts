import type { InboundSignal, MediaTransport } from './MediaTransport';
import type { QualityProfile } from './quality/QualityStrategy';

/**
 * Transporte de encode único (fMP4 via WebSocket + MSE). **Fase 3 — ainda não implementado.**
 *
 * Plano: um único `MediaRecorder`/WebCodecs codifica o stream; o main process distribui
 * os segmentos para todos os viewers deste transporte. Latência de 1–3 s, mas custo de
 * CPU constante independente do número de viewers (ADR-0004).
 */
export class MseTransport implements MediaTransport {
  readonly kind = 'mse' as const;
  readonly viewerCount = 0;

  async addViewer(_viewerId: string, _stream: MediaStream): Promise<void> {
    throw new Error('MseTransport ainda não implementado (Fase 3)');
  }
  async handleSignal(_viewerId: string, _signal: InboundSignal): Promise<void> {}
  removeViewer(_viewerId: string): void {}
  async applyQuality(_profile: QualityProfile): Promise<void> {}
  close(): void {}
}
