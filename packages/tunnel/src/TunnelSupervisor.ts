import { TypedEventEmitter, type PublicEndpoint } from '@luzocast/core';
import type { TunnelProvider } from './TunnelProvider';

export interface SupervisorEvents extends Record<string, unknown> {
  /** Novo endereço público (primeiro start ou após reinício). O link muda! */
  'endpoint-changed': PublicEndpoint;
  /** Desistiu após `maxRestarts` tentativas. */
  'gave-up': { reason: string };
}

export interface TunnelSupervisorOptions {
  maxRestarts?: number;
  /** Backoff base em ms (dobra a cada tentativa). */
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Supervisor: mantém um `TunnelProvider` vivo. Se ele cair, reinicia com backoff
 * exponencial e emite `endpoint-changed` — a UI deve mostrar o novo link.
 */
export class TunnelSupervisor extends TypedEventEmitter<SupervisorEvents> {
  private localPort = 0;
  private running = false;
  private offDown: (() => void) | null = null;

  constructor(
    private readonly provider: TunnelProvider,
    private readonly opts: TunnelSupervisorOptions = {},
  ) {
    super();
  }

  async start(localPort: number): Promise<PublicEndpoint> {
    this.localPort = localPort;
    this.running = true;
    this.offDown = this.provider.on('down', ({ reason }) => void this.restart(reason));
    const endpoint = await this.provider.start(localPort);
    this.emit('endpoint-changed', endpoint);
    return endpoint;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.offDown?.();
    this.offDown = null;
    await this.provider.stop();
  }

  private async restart(reason: string): Promise<void> {
    const max = this.opts.maxRestarts ?? 5;
    const base = this.opts.baseDelayMs ?? 1000;
    const sleep = this.opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    for (let attempt = 0; attempt < max && this.running; attempt++) {
      await sleep(base * 2 ** attempt);
      if (!this.running) return;
      try {
        const endpoint = await this.provider.start(this.localPort);
        this.emit('endpoint-changed', endpoint);
        return;
      } catch {
        /* tenta de novo */
      }
    }
    if (this.running) this.emit('gave-up', { reason });
  }
}
