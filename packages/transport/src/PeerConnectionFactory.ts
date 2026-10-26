/**
 * Factory: toda RTCPeerConnection do projeto nasce aqui, com a mesma configuração.
 * Sem TURN por padrão (não há servidor do projeto — ADR-0004).
 */
export interface PeerConnectionFactoryOptions {
  iceServers?: RTCIceServer[];
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
];

export class PeerConnectionFactory {
  constructor(private readonly opts: PeerConnectionFactoryOptions = {}) {}

  create(): RTCPeerConnection {
    return new RTCPeerConnection({
      iceServers: this.opts.iceServers ?? DEFAULT_ICE_SERVERS,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    });
  }
}

/**
 * Ordena codecs de vídeo: H.264 primeiro (encoder de hardware no Windows), VP8 depois,
 * mantendo os demais (RTX, RED, FEC) no fim.
 */
export function preferredVideoCodecs(codecs: RTCRtpCodec[]): RTCRtpCodec[] {
  const rank = (c: RTCRtpCodec) => {
    const mime = c.mimeType.toLowerCase();
    if (mime === 'video/h264') return 0;
    if (mime === 'video/vp8') return 1;
    if (mime === 'video/vp9' || mime === 'video/av1') return 2;
    return 3;
  };
  return [...codecs].sort((a, b) => rank(a) - rank(b));
}
