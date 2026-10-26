import { TypedEventEmitter } from '../events/TypedEventEmitter';
import { IdleState, type SessionState, type SessionStatus } from './states';

export interface SessionEvents extends Record<string, unknown> {
  'status-changed': { from: SessionStatus; to: SessionStatus; reason?: string };
}

/**
 * Contexto da máquina de estados da transmissão.
 * Não sabe nada de rede, túnel ou mídia — quem orquestra isso é o Composition Root,
 * que chama as ações aqui e reage a `status-changed`.
 */
export class Session extends TypedEventEmitter<SessionEvents> {
  private state: SessionState = new IdleState();

  get status(): SessionStatus {
    return this.state.status;
  }

  start(): void {
    this.transition((s) => s.start());
  }
  ready(): void {
    this.transition((s) => s.ready());
  }
  stop(): void {
    this.transition((s) => s.stop());
  }
  stopped(): void {
    this.transition((s) => s.stopped());
  }
  fail(reason: string): void {
    this.transition((s) => s.fail(), reason);
  }
  reset(): void {
    this.transition((s) => s.reset());
  }

  private transition(action: (s: SessionState) => SessionState, reason?: string): void {
    const from = this.state.status;
    this.state = action(this.state);
    const to = this.state.status;
    if (from !== to) this.emit('status-changed', { from, to, ...(reason ? { reason } : {}) });
  }
}
