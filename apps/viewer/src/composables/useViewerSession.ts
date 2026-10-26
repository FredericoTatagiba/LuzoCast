import { onBeforeUnmount, ref, shallowRef } from 'vue';
import { decode, encode, PROTOCOL_VERSION, ServerToViewer, type RejectReason, type ViewerToServer } from '@luzocast/signaling';
import { ViewerPeer } from '@luzocast/transport';

export type ViewerPhase =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'admitted'
  | 'connected'
  | 'failed'
  | 'rejected'
  | 'kicked'
  | 'ended'
  | 'disconnected';

/**
 * Lógica do espectador: WebSocket de sinalização + ViewerPeer.
 * A UI só observa `phase`, `stream` e `rejectReason`.
 */
export function useViewerSession(url: string, token: string) {
  const phase = ref<ViewerPhase>('idle');
  const stream = shallowRef<MediaStream | null>(null);
  const rejectReason = ref<RejectReason | null>(null);
  let ws: WebSocket | null = null;
  let peer: ViewerPeer | null = null;

  const send = (m: ViewerToServer) => ws?.readyState === WebSocket.OPEN && ws.send(encode(m));

  function join(displayName: string) {
    cleanup();
    phase.value = 'connecting';
    ws = new WebSocket(url);
    ws.onopen = () => send({ type: 'join', v: PROTOCOL_VERSION, token, displayName });
    ws.onmessage = (e) => void handle(String(e.data));
    ws.onclose = () => {
      if (['connecting', 'waiting', 'admitted', 'connected'].includes(phase.value)) phase.value = 'disconnected';
    };
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
          // ICE falhou: nenhum caminho de rede entre host e viewer (NAT restritivo, sem TURN)
          onStateChange: (state) => {
            if (state === 'failed') finish('failed');
          },
        });
        return;
      case 'offer':
        await peer?.handleOffer(m.sdp);
        return;
      case 'ice':
        await peer?.handleIce(m.candidate);
        return;
      case 'rejected':
        rejectReason.value = m.reason;
        return finish('rejected');
      case 'kicked':
        // o host remove automaticamente quem falhou; mantém a mensagem de falha
        return finish(phase.value === 'failed' ? 'failed' : 'kicked');
      case 'ended':
        return finish('ended');
    }
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
    peer?.close();
    peer = null;
    stream.value = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
  }

  onBeforeUnmount(cleanup);
  return { phase, stream, rejectReason, join, leave };
}
