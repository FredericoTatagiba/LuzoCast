import { describe, expect, it } from 'vitest';
import { AdaptiveQualityStrategy } from './quality/QualityStrategy';
import { ThresholdTransportSelector } from './TransportSelector';
import { preferredVideoCodecs } from './PeerConnectionFactory';

describe('AdaptiveQualityStrategy', () => {
  const q = new AdaptiveQualityStrategy({ uploadKbps: 20_000 });

  it('1 viewer recebe o teto', () => {
    expect(q.profileFor(1)).toEqual({ maxBitrateKbps: 6000, maxFramerate: 30, scaleResolutionDownBy: 1 });
  });

  it('degrada conforme entram viewers e respeita o piso', () => {
    expect(q.profileFor(8).maxBitrateKbps).toBe(2000);
    expect(q.profileFor(8).scaleResolutionDownBy).toBe(1.5);
    expect(q.profileFor(100).maxBitrateKbps).toBe(400);
  });

  it('estima capacidade no piso', () => {
    expect(q.maxViewersAtFloor()).toBe(40);
  });
});

describe('ThresholdTransportSelector', () => {
  it('troca para mse acima do limiar, se disponível', () => {
    expect(new ThresholdTransportSelector(5, true).select(5)).toBe('mse');
    expect(new ThresholdTransportSelector(5, true).select(4)).toBe('webrtc');
    expect(new ThresholdTransportSelector(5, false).select(10)).toBe('webrtc');
  });
});

describe('preferredVideoCodecs', () => {
  it('coloca H.264 e VP8 na frente', () => {
    const codecs = ['video/rtx', 'video/VP9', 'video/VP8', 'video/H264'].map((mimeType) => ({ mimeType, clockRate: 90000 }));
    expect(preferredVideoCodecs(codecs).map((c) => c.mimeType)).toEqual(['video/H264', 'video/VP8', 'video/VP9', 'video/rtx']);
  });
});

import { summarizeOutboundStats } from './stats';

describe('perfil de jogo', () => {
  it('mantém 60 fps com banda sobrando e cai para 30 quando aperta', () => {
    const q = new AdaptiveQualityStrategy({ uploadKbps: 20_000, targetFps: 60 });
    expect(q.profileFor(1).maxFramerate).toBe(60);
    expect(q.profileFor(12).maxFramerate).toBe(30);
  });
});

describe('summarizeOutboundStats', () => {
  it('reporta software se algum viewer caiu para encoder de CPU', () => {
    const r = summarizeOutboundStats([
      { encoderImplementation: 'MediaFoundationVideoEncodeAccelerator', powerEfficientEncoder: true, qualityLimitationReason: 'none', framesPerSecond: 60, frameHeight: 1080 },
      { encoderImplementation: 'OpenH264', qualityLimitationReason: 'cpu', framesPerSecond: 24, frameHeight: 720 },
    ]);
    expect(r).toEqual({ encoderImplementation: 'OpenH264', hardwareEncoder: false, qualityLimitation: 'cpu', framesPerSecond: 24, frameHeight: 720 });
  });

  it('null sem viewers', () => {
    expect(summarizeOutboundStats([])).toBeNull();
  });
});
