import { DEFAULT_ICE_SERVERS } from './PeerConnectionFactory';

/** Mesmo formato do `ReadinessItem` do host (compatível estruturalmente). */
export interface BrowserCheckItem {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

/**
 * O navegador consegue codificar H.264 1080p60 em hardware?
 * Sem hardware, cada viewer custa CPU e o jogo perde FPS.
 */
export async function checkHardwareEncoder(): Promise<BrowserCheckItem> {
  const base = { id: 'encoder', label: 'Codificador de vídeo (GPU)' };
  try {
    const info = await navigator.mediaCapabilities.encodingInfo({
      type: 'webrtc',
      video: { contentType: 'video/H264; profile-level-id=42e01f', width: 1920, height: 1080, bitrate: 6_000_000, framerate: 60 },
    });
    if (!info.supported) return { ...base, status: 'warn', detail: 'H.264 indisponível; será usado VP8 por software (mais CPU).' };
    return info.powerEfficient
      ? { ...base, status: 'ok', detail: 'H.264 por hardware disponível — ideal para jogos.' }
      : { ...base, status: 'warn', detail: 'Só encoder por software: transmitir jogos vai consumir CPU e pode derrubar FPS.' };
  } catch {
    return { ...base, status: 'warn', detail: 'Não foi possível detectar o encoder.' };
  }
}

/**
 * Consegue descobrir o endereço público via STUN? Sem isso, só viewers na mesma rede
 * (ou via fallback futuro) conseguem receber o vídeo.
 */
export async function checkStun(timeoutMs = 4000, iceServers: RTCIceServer[] = DEFAULT_ICE_SERVERS): Promise<BrowserCheckItem> {
  const base = { id: 'stun', label: 'Conexão P2P com quem está fora da sua rede' };
  const pc = new RTCPeerConnection({ iceServers });
  try {
    // DataChannel só local, para disparar a coleta de candidatos; nunca é conectado.
    pc.createDataChannel('probe');
    const found = new Promise<boolean>((resolve) => {
      pc.onicecandidate = (e) => {
        if (e.candidate?.type === 'srflx') resolve(true);
        if (!e.candidate) resolve(false);
      };
      setTimeout(() => resolve(false), timeoutMs);
    });
    await pc.setLocalDescription(await pc.createOffer());
    return (await found)
      ? { ...base, status: 'ok', detail: 'Endereço público detectado; amigos de outras redes devem conectar.' }
      : { ...base, status: 'warn', detail: 'STUN bloqueado: amigos fora da sua rede podem não receber o vídeo.' };
  } finally {
    pc.close();
  }
}
