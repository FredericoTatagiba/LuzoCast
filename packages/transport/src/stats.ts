import type { TransportStats } from './MediaTransport';

const LIMIT_RANK: Record<TransportStats['qualityLimitation'], number> = { none: 0, other: 1, bandwidth: 2, cpu: 3 };

/** Nomes de encoders de software do Chromium (o resto é tratado como hardware). */
const SOFTWARE_ENCODER = /libvpx|openh264|libaom|software|fallback/i;

/**
 * Agrega estatísticas `outbound-rtp` de vídeo de vários viewers em um diagnóstico só.
 * Função pura (testável sem navegador).
 */
export function summarizeOutboundStats(outbound: Record<string, unknown>[]): TransportStats | null {
  if (outbound.length === 0) return null;
  let impl: string | null = null;
  let hardware: boolean | null = null;
  let limitation: TransportStats['qualityLimitation'] = 'none';
  let fps: number | null = null;
  let height: number | null = null;

  for (const s of outbound) {
    const name = typeof s['encoderImplementation'] === 'string' ? s['encoderImplementation'] : null;
    const efficient = typeof s['powerEfficientEncoder'] === 'boolean' ? s['powerEfficientEncoder'] : null;
    const isHw = efficient ?? (name ? !SOFTWARE_ENCODER.test(name) : null);
    // Se QUALQUER viewer está em software, reporta software (é o que pesa no jogo).
    if (isHw === false || impl === null) {
      impl = name ?? impl;
      hardware = isHw;
    }
    const reason = s['qualityLimitationReason'];
    const lim = reason === 'cpu' || reason === 'bandwidth' || reason === 'other' ? reason : 'none';
    if (LIMIT_RANK[lim] > LIMIT_RANK[limitation]) limitation = lim;
    if (typeof s['framesPerSecond'] === 'number') fps = fps === null ? s['framesPerSecond'] : Math.min(fps, s['framesPerSecond']);
    if (typeof s['frameHeight'] === 'number') height = height === null ? s['frameHeight'] : Math.min(height, s['frameHeight']);
  }
  return { encoderImplementation: impl, hardwareEncoder: hardware, qualityLimitation: limitation, framesPerSecond: fps, frameHeight: height };
}
