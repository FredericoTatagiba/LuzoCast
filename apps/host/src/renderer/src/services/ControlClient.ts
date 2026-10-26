import { TypedEventEmitter } from '@luzocast/core';
import { decode, encode, encodeRelayFrame, PROTOCOL_VERSION, ServerToHost, type HostToServer } from '@luzocast/signaling';

type ServerMessage = ServerToHost;
export type ControlEvents = {
  [K in ServerMessage['type']]: Extract<ServerMessage, { type: K }>;
} & { closed: { code: number } };

/**
 * Cliente do canal de controle (renderer → servidor local).
 * Converte mensagens do protocolo em eventos tipados (Observer).
 */
export class ControlClient extends TypedEventEmitter<ControlEvents> {
  private ws: WebSocket | null = null;

  /** Conecta e autentica. Resolve quando recebe `auth-ok`. */
  connect(url: string, secret: string, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error('timeout no canal de controle')), timeoutMs);
      ws.onopen = () => this.send({ type: 'auth', v: PROTOCOL_VERSION, secret });
      ws.onmessage = (e) => {
        const r = decode(ServerToHost, String(e.data));
        if (!r.ok) return;
        if (r.value.type === 'auth-ok') {
          clearTimeout(timer);
          resolve();
        }
        this.emit(r.value.type, r.value as never);
      };
      ws.onclose = (e) => {
        clearTimeout(timer);
        this.emit('closed', { code: e.code });
        reject(new Error(`canal de controle fechado (${e.code})`));
      };
    });
  }

  send(message: HostToServer): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encode(message));
  }

  /** Envia um pedaço de mídia do modo retransmissão para um viewer. */
  sendRelayChunk(viewerId: string, chunk: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encodeRelayFrame(viewerId, chunk) as Uint8Array<ArrayBuffer>);
  }

  close(): void {
    if (!this.ws) return;
    this.ws.onclose = null;
    this.ws.close();
    this.ws = null;
  }
}
