/** Parâmetros de encode aplicados a cada viewer. */
export interface QualityProfile {
  readonly maxBitrateKbps: number;
  readonly maxFramerate: number;
  /** 1 = resolução nativa; 2 = metade da largura/altura. */
  readonly scaleResolutionDownBy: number;
}

/** Strategy: decide a qualidade a partir do número de viewers. */
export interface QualityStrategy {
  profileFor(viewerCount: number): QualityProfile;
}

export interface AdaptiveQualityOptions {
  /** Upload disponível do host, em kbps (medido ou informado pelo usuário). */
  uploadKbps: number;
  /** Fração do upload que podemos usar (o resto fica para o túnel, etc.). */
  headroom?: number;
  floorKbps?: number;
  ceilingKbps?: number;
  /** FPS alvo: 30 (apresentação) ou 60 (jogo). Com pouco bitrate o fps cai junto. */
  targetFps?: number;
}

/**
 * Divide o orçamento de upload pelo número de viewers e reduz fps/resolução
 * conforme o bitrate por viewer cai.
 */
export class AdaptiveQualityStrategy implements QualityStrategy {
  constructor(private readonly opts: AdaptiveQualityOptions) {}

  profileFor(viewerCount: number): QualityProfile {
    const { uploadKbps, headroom = 0.8, floorKbps = 400, ceilingKbps = 6000, targetFps = 30 } = this.opts;
    const n = Math.max(1, viewerCount);
    const perViewer = Math.round(Math.min(ceilingKbps, Math.max(floorKbps, (uploadKbps * headroom) / n)));
    return {
      maxBitrateKbps: perViewer,
      maxFramerate: perViewer >= 2500 ? targetFps : perViewer >= 1000 ? Math.min(targetFps, 30) : Math.min(targetFps, 15),
      scaleResolutionDownBy: perViewer >= 3500 ? 1 : perViewer >= 1500 ? 1.5 : 2,
    };
  }

  /** Estimativa de quantos viewers cabem acima do piso de qualidade. */
  maxViewersAtFloor(): number {
    const { uploadKbps, headroom = 0.8, floorKbps = 400 } = this.opts;
    return Math.max(1, Math.floor((uploadKbps * headroom) / floorKbps));
  }
}

/** Qualidade fixa — útil para testes e para o usuário travar manualmente. */
export class FixedQualityStrategy implements QualityStrategy {
  constructor(private readonly profile: QualityProfile) {}
  profileFor(): QualityProfile {
    return this.profile;
  }
}
