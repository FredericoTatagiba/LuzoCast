import { onBeforeUnmount, ref, shallowRef } from 'vue';
import { decode, encode, PROTOCOL_VERSION, ServerToViewer, type RejectReason, type ViewerToServer } from '@luzocast/signaling';
import { MseRelayPlayer, ViewerPeer } from '@luzocast/transport';

export type ViewerPhase =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'admitted'
  /** P2P falhou; aguardando o host iniciar o modo retransmissão pelo túnel. */
  | 'fallback'
  | 'connected'
  | 'failed'
  | 'unsupported'
  | 'rejected'
  | 'kicked'
  | 'ended'
  | 'disconnected';

/** Quanto esperar o host mandar o `relay-start` depois que o P2P falha. */
const RELAY_WAIT_MS = 15_000;

/**
 * Lógica do espectador: WebSocket de sinalização + mídia.
 * Caminho normal: WebRTC (P2P). Se ele falhar, o host passa a retransmitir pelo próprio
 * WebSocket (frames WebM → MediaSource). A UI só observa `phase`, `stream`/`src` e `route`.
 */
export function useViewerSession(url: string, token: string) {
  const phase = ref<ViewerPhase>('idle');
  const stream = shallowRef<MediaStream | null>(null);
  /** URL blob: do MediaSource no modo retransmissão. */
  const src = ref<string | null>(null);
  const route = ref<'p2p' | 'relay'>('p2p');
  const rejectReason = ref<RejectReason | null>(null);
  let ws: WebSocket | null = null;
  let peer: ViewerPeer | null = null;
  let player: MseRelayPlayer | null = null;
  let relayTimer: ReturnType<typeof setTimeout> | null = null;

  const send = (m: ViewerToServer) => ws?.readyState === WebSocket.OPEN && ws.send(encode(m));

  function join(displayName: string) {
    cleanup();
    phase.value = 'connecting';
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => send({ type: 'join', v: PROTOCOL_VERSION, token, displayName });
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) player?.append(new Uint8Array(e.data));
      else void handle(String(e.data));
    };
    ws.onclose = () => {
      if (['connecting', 'waiting', 'admitted', 'fallback', 'connected'].includes(phase.value)) finish('disconnected');
    };
  }

  /** Chamado quando o P2P falha: espera o host iniciar a retransmissão. */
  function onPeerFailed() {
    peer?.close();
    peer = null;
    if (route.value === 'relay') return;
    stream.value = null;
    phase.value = 'fallback';
    relayTimer = setTimeout(() => finish('failed'), RELAY_WAIT_MS);
  }

  async function handle(raw: string) {
    const r = decode(ServerToViewer, raw);
    if (!r.ok) return;
    const m = r.value;
    switch (m.type) {
      case 'waiting':
        phase.value = 'waiting';
        return;
      case 'admitted':
        phase.value = 'admitted';
        peer = new ViewerPeer({
          onStream: (s) => {
            stream.value = s;
            phase.value = 'connected';
          },
          onIce: (candidate) => send({ type: 'ice', candidate }),
          onAnswer: (sdp) => send({ type: 'answer', sdp }),
          onStateChange: (state) => {
            if (state === 'failed') onPeerFailed();
          },
        });
        return;
      case 'offer':
        await peer?.handleOffer(m.sdp);
        return;
      case 'ice':
        await peer?.handleIce(m.candidate);
        return;
      case 'relay-start':
        return startRelay(m.mime);
      case 'rejected':
        rejectReason.value = m.reason;
        return finish('rejected');
      case 'kicked':
        return finish(phase.value === 'fallback' ? 'failed' : 'kicked');
      case 'ended':
        return finish('ended');
    }
  }

  function startRelay(mime: string) {
    if (relayTimer) clearTimeout(relayTimer);
    relayTimer = null;
    peer?.close();
    peer = null;
    stream.value = null;
    if (!MseRelayPlayer.isSupported(mime)) {
      // iPhone/Safari não tocam WebM via MediaSource
      send({ type: 'leave' });
      return finish('unsupported');
    }
    player = new MseRelayPlayer(mime);
    src.value = player.url;
    route.value = 'relay';
    phase.value = 'connected';
  }

  /** O <video> do palco avisa quando está pronto (o player controla a latência). */
  function attachVideo(el: HTMLVideoElement) {
    player?.attach(el);
  }

  function finish(p: ViewerPhase) {
    phase.value = p;
    cleanup();
  }

  function leave() {
    send({ type: 'leave' });
    finish('ended');
  }

  function cleanup() {
    if (relayTimer) clearTimeout(relayTimer);
    relayTimer = null;
    peer?.close();
    peer = null;
    player?.close();
    player = null;
    src.value = null;
    stream.value = null;
    route.value = 'p2p';
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
  }

  onBeforeUnmount(cleanup);
  return { phase, stream, src, route, rejectReason, join, leave, attachVideo };
}
