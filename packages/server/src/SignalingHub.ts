import { TypedEventEmitter, type ViewerRegistry } from '@luzocast/core';
import type { AttemptLimiter } from '@luzocast/security';
import { ControlChannel, type HostCommand } from './ControlChannel';
import { PublicChannel } from './PublicChannel';
import type { MessageSocket } from './socket';

export interface SignalingHubDeps {
  registry: ViewerRegistry;
  limiter: AttemptLimiter;
  verifyAccessToken: (token: string) => boolean;
  verifyHostSecret: (secret: string) => boolean;
}

export interface SignalingHubEvents extends Record<string, unknown> {
  /** O host pediu para encerrar a transmissão. */
  'end-requested': undefined;
}

/**
 * Mediator: host e viewers nunca falam diretamente; todo roteio passa por aqui.
 * Não conhece HTTP — recebe sockets já abertos (ver `createServers`), o que o torna
 * testável com sockets falsos.
 */
export class SignalingHub extends TypedEventEmitter<SignalingHubEvents> {
  readonly control: ControlChannel;
  readonly public: PublicChannel;
  private readonly unsubscribe: Array<() => void> = [];

  constructor(private readonly deps: SignalingHubDeps) {
    super();
    this.control = new ControlChannel({
      verifyHostSecret: deps.verifyHostSecret,
      onCommand: (c) => this.onHostCommand(c),
    });
    this.public = new PublicChannel({
      registry: deps.registry,
      limiter: deps.limiter,
      verifyAccessToken: deps.verifyAccessToken,
      onViewerAnswer: (viewerId, sdp) => this.control.send({ type: 'viewer-answer', viewerId, sdp }),
      onViewerIce: (viewerId, candidate) => this.control.send({ type: 'viewer-ice', viewerId, candidate }),
    });
    this.wireRegistry();
  }

  acceptHost(socket: MessageSocket): void {
    this.control.accept(socket);
  }

  acceptViewer(socket: MessageSocket, originKey: string): void {
    this.public.accept(socket, originKey);
  }

  /** Encerra: avisa todos os viewers e desconecta o host. */
  shutdown(): void {
    this.deps.registry.clear();
    this.control.close();
    this.unsubscribe.forEach((off) => off());
  }

  private wireRegistry(): void {
    const r = this.deps.registry;
    this.unsubscribe.push(
      r.on('requested', (v) => this.control.send({ type: 'viewer-request', viewerId: v.id, displayName: v.displayName })),
      r.on('admitted', (v) => this.public.send(v.id, { type: 'admitted' })),
      r.on('removed', ({ viewer, reason }) => {
        if (reason === 'rejected') this.public.sendAndClose(viewer.id, { type: 'rejected', reason: 'host-declined' });
        else if (reason === 'kicked') this.public.sendAndClose(viewer.id, { type: 'kicked' });
        else if (reason === 'ended') this.public.sendAndClose(viewer.id, { type: 'ended' });
        this.control.send({ type: 'viewer-left', viewerId: viewer.id });
      }),
    );
  }

  private onHostCommand(c: HostCommand): void {
    const r = this.deps.registry;
    switch (c.type) {
      case 'admit':
        if (r.get(c.viewerId)?.status === 'pending') r.admit(c.viewerId);
        return;
      case 'reject':
        return r.remove(c.viewerId, 'rejected');
      case 'kick':
        return r.remove(c.viewerId, 'kicked');
      case 'offer':
        if (r.get(c.viewerId)?.status === 'admitted') this.public.send(c.viewerId, { type: 'offer', sdp: c.sdp });
        return;
      case 'ice':
        if (r.get(c.viewerId)?.status === 'admitted') this.public.send(c.viewerId, { type: 'ice', candidate: c.candidate });
        return;
      case 'end':
        return this.emit('end-requested', undefined);
    }
  }
}
