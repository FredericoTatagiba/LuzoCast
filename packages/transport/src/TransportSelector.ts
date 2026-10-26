export type TransportKind = 'webrtc' | 'mse';

/** Strategy: escolhe o transporte para o PRÓXIMO viewer admitido. */
export interface TransportSelector {
  select(currentWebRtcViewers: number): TransportKind;
}

/**
 * Até `threshold` viewers usa WebRTC (baixa latência, 1 encoder por viewer);
 * acima disso usa o transporte de encode único (ADR-0004).
 */
export class ThresholdTransportSelector implements TransportSelector {
  constructor(
    private readonly threshold: number,
    private readonly mseAvailable: boolean,
  ) {}

  select(currentWebRtcViewers: number): TransportKind {
    return this.mseAvailable && currentWebRtcViewers >= this.threshold ? 'mse' : 'webrtc';
  }
}
