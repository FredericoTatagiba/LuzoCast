import { RoomFullError, ViewerNotFoundError, InvalidTransitionError } from '../errors';
import { TypedEventEmitter } from '../events/TypedEventEmitter';

export type ViewerId = string;
export type ViewerStatus = 'pending' | 'admitted';

export interface Viewer {
  readonly id: ViewerId;
  readonly displayName: string;
  status: ViewerStatus;
  readonly requestedAt: number;
}

export type ViewerRemovalReason = 'left' | 'rejected' | 'kicked' | 'ended';

export interface ViewerEvents extends Record<string, unknown> {
  requested: Viewer;
  admitted: Viewer;
  removed: { viewer: Viewer; reason: ViewerRemovalReason };
}

export interface ViewerRegistryOptions {
  /** Limite de viewers (pendentes + admitidos). */
  maxViewers: number;
  /** Gerador de IDs — injetado para testes e para não acoplar a `crypto`. */
  generateId: () => ViewerId;
  now?: () => number;
}

/**
 * Fonte da verdade sobre quem está na sala de espera e quem está assistindo.
 * Emite eventos (Observer) para o servidor e a UI reagirem.
 */
export class ViewerRegistry extends TypedEventEmitter<ViewerEvents> {
  private readonly viewers = new Map<ViewerId, Viewer>();

  constructor(private readonly opts: ViewerRegistryOptions) {
    super();
  }

  get size(): number {
    return this.viewers.size;
  }

  get admittedCount(): number {
    let n = 0;
    for (const v of this.viewers.values()) if (v.status === 'admitted') n++;
    return n;
  }

  list(): readonly Viewer[] {
    return [...this.viewers.values()];
  }

  get(id: ViewerId): Viewer | undefined {
    return this.viewers.get(id);
  }

  /** Coloca um viewer na sala de espera. Lança `RoomFullError` se lotado. */
  request(displayName: string): Viewer {
    if (this.viewers.size >= this.opts.maxViewers) throw new RoomFullError(this.opts.maxViewers);
    const viewer: Viewer = {
      id: this.opts.generateId(),
      displayName,
      status: 'pending',
      requestedAt: (this.opts.now ?? Date.now)(),
    };
    this.viewers.set(viewer.id, viewer);
    this.emit('requested', viewer);
    return viewer;
  }

  admit(id: ViewerId): Viewer {
    const viewer = this.require(id);
    if (viewer.status !== 'pending') throw new InvalidTransitionError(viewer.status, 'admit');
    viewer.status = 'admitted';
    this.emit('admitted', viewer);
    return viewer;
  }

  /** Remove o viewer (rejeitado, expulso, saiu). Idempotente. */
  remove(id: ViewerId, reason: ViewerRemovalReason): void {
    const viewer = this.viewers.get(id);
    if (!viewer) return;
    this.viewers.delete(id);
    this.emit('removed', { viewer, reason });
  }

  /** Remove todos (fim da sessão). */
  clear(): void {
    for (const id of [...this.viewers.keys()]) this.remove(id, 'ended');
  }

  private require(id: ViewerId): Viewer {
    const viewer = this.viewers.get(id);
    if (!viewer) throw new ViewerNotFoundError(id);
    return viewer;
  }
}
