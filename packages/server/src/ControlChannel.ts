import { decode, encode, HostToServer, PROTOCOL_VERSION, type ServerToHost } from '@luzocast/signaling';
import { CloseCode, toText, type MessageSocket } from './socket';

export type HostCommand = Exclude<HostToServer, { type: 'auth' }>;

export interface ControlChannelDeps {
  verifyHostSecret: (secret: string) => boolean;
  /** Chamado para cada comando do host já autenticado e validado. */
  onCommand: (command: HostCommand) => void;
  authTimeoutMs?: number;
}

/**
 * Canal de controle: única conexão do renderer do host. Porta própria, sempre em
 * 127.0.0.1 e NUNCA exposta pelo túnel (ADR-0002). Exige `auth` como primeira mensagem.
 */
export class ControlChannel {
  private host: MessageSocket | null = null;

  constructor(private readonly deps: ControlChannelDeps) {}

  get isConnected(): boolean {
    return this.host !== null;
  }

  accept(socket: MessageSocket): void {
    let authed = false;
    const timer = setTimeout(() => socket.close(CloseCode.policyViolation, 'auth timeout'), this.deps.authTimeoutMs ?? 5_000);

    socket.on('message', (data) => {
      const msg = decode(HostToServer, toText(data));
      if (!msg.ok) return socket.close(CloseCode.policyViolation, msg.error);
      const m = msg.value;

      if (!authed) {
        clearTimeout(timer);
        if (m.type !== 'auth' || m.v !== PROTOCOL_VERSION || !this.deps.verifyHostSecret(m.secret)) {
          return socket.close(CloseCode.policyViolation, 'auth failed');
        }
        if (this.host) return socket.close(CloseCode.tryAgainLater, 'host already connected');
        authed = true;
        this.host = socket;
        socket.send(encode({ type: 'auth-ok' } satisfies ServerToHost));
        return;
      }

      if (m.type === 'auth') return socket.close(CloseCode.policyViolation, 'already authed');
      this.deps.onCommand(m);
    });

    socket.on('close', () => {
      clearTimeout(timer);
      if (this.host === socket) this.host = null;
    });
  }

  send(message: ServerToHost): void {
    this.host?.send(encode(message));
  }

  close(): void {
    this.host?.close(CloseCode.normal, 'server stopping');
    this.host = null;
  }
}
