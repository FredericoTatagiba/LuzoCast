import type { PublicEndpoint, TypedEventEmitter } from '@luzocast/core';

export interface TunnelEvents extends Record<string, unknown> {
  /** O túnel caiu sem `stop()` ter sido chamado. */
  down: { reason: string };
}

/**
 * Strategy de exposição pública do servidor local.
 * Implementações: `CloudflareQuickTunnelProvider`, `LanOnlyProvider`.
 *
 * Contrato (LSP): `start` resolve com um endpoint utilizável ou rejeita; `stop` é
 * idempotente; `down` só é emitido para quedas inesperadas.
 */
export interface TunnelProvider extends Pick<TypedEventEmitter<TunnelEvents>, 'on' | 'off'> {
  /** Nome legível para logs/UI. */
  readonly name: string;
  /** Expõe `127.0.0.1:localPort` (ou a interface LAN) e devolve o endereço público. */
  start(localPort: number): Promise<PublicEndpoint>;
  stop(): Promise<void>;
}
