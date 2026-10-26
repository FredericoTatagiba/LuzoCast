/**
 * Perfis de transmissão. Para criar um novo, adicione uma entrada aqui — a UI lista
 * automaticamente e o serviço aplica os parâmetros (Open/Closed).
 */
export type StreamProfileId = 'game' | 'presentation';

export interface StreamProfile {
  id: StreamProfileId;
  label: string;
  description: string;
  fps: number;
  /** Dica ao encoder: 'motion' (movimento) ou 'detail' (texto/nitidez). */
  contentHint: 'motion' | 'detail';
  /** O que sacrificar sob pressão: resolução (jogo) ou fps (apresentação). */
  degradationPreference: RTCDegradationPreference;
}

export const STREAM_PROFILES: Record<StreamProfileId, StreamProfile> = {
  game: {
    id: 'game',
    label: 'Jogo',
    description: '60 fps; reduz a resolução antes de travar o movimento.',
    fps: 60,
    contentHint: 'motion',
    degradationPreference: 'maintain-framerate',
  },
  presentation: {
    id: 'presentation',
    label: 'Apresentação',
    description: '30 fps; mantém texto e detalhes nítidos.',
    fps: 30,
    contentHint: 'detail',
    degradationPreference: 'maintain-resolution',
  },
};
