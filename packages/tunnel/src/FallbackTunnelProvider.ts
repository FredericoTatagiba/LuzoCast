import { TypedEventEmitter, type PublicEndpoint } from '@luzocast/core';
import type { TunnelEvents, TunnelProvider } from './TunnelProvider';

/**
 * Tenta os providers em ordem e usa o primeiro que subir (Chain of Responsibility).
 * Uso: link personalizado → se o broker estiver fora/lotado, cai no link aleatório.
 * `onFallback` permite avisar a UI de que o link não é o personalizado.
 */
export class FallbackTunnelProvider extends TypedEventEmitter<TunnelEvents> implements TunnelProvider {
  private active: TunnelProvider | null = null;
  private offDown: (() => void) | null = null;

  constructor(
    private readonly providers: readonly TunnelProvider[],
    private readonly onFallback?: (from: string, to: string, error: unknown) => void,
  ) {
    super();
    if (providers.length === 0) throw new Error('FallbackTunnelProvider precisa de ao menos um provider');
  }

  get name(): string {
    return this.active?.name ?? this.providers.map((p) => p.name).join('→');
  }

  async start(localPort: number): Promise<PublicEndpoint> {
    let lastError: unknown;
    for (const [i, provider] of this.providers.entries()) {
      try {
        const endpoint = await provider.start(localPort);
        this.active = provider;
        this.offDown = provider.on('down', (e) => this.emit('down', e));
        return endpoint;
      } catch (err) {
        lastError = err;
        const next = this.providers[i + 1];
        if (next) this.onFallback?.(provider.name, next.name, err);
      }
    }
    throw lastError;
  }

  async stop(): Promise<void> {
    this.offDown?.();
    this.offDown = null;
    const p = this.active;
    this.active = null;
    await p?.stop();
  }
}
