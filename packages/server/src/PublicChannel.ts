import { RoomFullError, type ViewerId, type ViewerRegistry } from '@luzocast/core';
import type { AttemptLimiter } from '@luzocast/security';
import { decode, encode, PROTOCOL_VERSION, ViewerToServer, type IceCandidate, type ServerToViewer } from '@luzocast/signaling';
import { CloseCode, toText, type MessageSocket } from './socket';

export interface PublicChannelDeps {
  registry: ViewerRegistry;
  limiter: AttemptLimiter;
  verifyAccessToken: (token: string) => boolean;
  /** Repassa ao host (via Mediator) o que o viewer admitido enviou. */
  onViewerAnswer: (viewerId: ViewerId, sdp: string) => void;
  onViewerIce: (viewerId: ViewerId, candidate: IceCandidate) => void;
  joinTimeoutMs?: number;
}

/**
 * Canal público: conexões dos espectadores. Só aceita o protocolo do viewer;
 * nenhuma mensagem daqui consegue disparar ação no host além de sinalização WebRTC.
 */
export class PublicChannel {
  private readonly sockets = new Map<ViewerId, MessageSocket>();

  constructor(private readonly deps: PublicChannelDeps) {}

  /** Chamado a cada nova conexão WS em `/ws/viewer`. `originKey` alimenta o rate limit. */
  accept(socket: MessageSocket, originKey: string): void {
    let viewerId: ViewerId | null = null;
    const joinTimer = setTimeout(() => socket.close(CloseCode.policyViolation, 'join timeout'), this.deps.joinTimeoutMs ?? 10_000);

    socket.on('message', (data) => {
      const msg = decode(ViewerToServer, toText(data));
      if (!msg.ok) return socket.close(CloseCode.policyViolation, msg.error);
      const m = msg.value;

      if (viewerId === null) {
        if (m.type !== 'join') return socket.close(CloseCode.policyViolation, 'join expected');
        clearTimeout(joinTimer);
        viewerId = this.handleJoin(socket, originKey, m.token, m.displayName, m.v);
        return;
      }

      const viewer = this.deps.registry.get(viewerId);
      switch (m.type) {
        case 'join':
          return socket.close(CloseCode.policyViolation, 'already joined');
        case 'leave':
          return this.deps.registry.remove(viewerId, 'left');
        case 'answer':
          if (viewer?.status === 'admitted') this.deps.onViewerAnswer(viewerId, m.sdp);
          return;
        case 'ice':
          if (viewer?.status === 'admitted') this.deps.onViewerIce(viewerId, m.candidate);
          return;
      }
    });

    socket.on('close', () => {
      clearTimeout(joinTimer);
      if (viewerId !== null) {
        this.sockets.delete(viewerId);
        this.deps.registry.remove(viewerId, 'left');
      }
    });
  }

  /** Envia uma mensagem para um viewer específico (no-op se ele já saiu). */
  send(viewerId: ViewerId, message: ServerToViewer): void {
    this.sockets.get(viewerId)?.send(encode(message));
  }

  /** Envia a mensagem final e encerra a conexão do viewer. */
  sendAndClose(viewerId: ViewerId, message: ServerToViewer): void {
    const socket = this.sockets.get(viewerId);
    if (!socket) return;
    this.sockets.delete(viewerId);
    socket.send(encode(message));
    socket.close(CloseCode.normal, message.type);
  }

  private handleJoin(socket: MessageSocket, originKey: string, token: string, displayName: string, v: number): ViewerId | null {
    const reject = (reason: 'invalid-token' | 'rate-limited' | 'room-full') => {
      socket.send(encode({ type: 'rejected', reason } satisfies ServerToViewer));
      socket.close(CloseCode.policyViolation, reason);
      return null;
    };

    if (v !== PROTOCOL_VERSION) return reject('invalid-token');
    if (!this.deps.limiter.canAttempt(originKey)) return reject('rate-limited');
    if (!this.deps.verifyAccessToken(token)) {
      this.deps.limiter.recordFailure(originKey);
      return reject('invalid-token');
    }

    try {
      // `requested` só notifica o host; a resposta dele (admit) chega de forma
      // assíncrona, então o socket é registrado a tempo de receber `admitted`.
      const viewer = this.deps.registry.request(displayName);
      this.sockets.set(viewer.id, socket);
      socket.send(encode({ type: 'waiting', viewerId: viewer.id } satisfies ServerToViewer));
      return viewer.id;
    } catch (err) {
      if (err instanceof RoomFullError) return reject('room-full');
      throw err;
    }
  }
}
