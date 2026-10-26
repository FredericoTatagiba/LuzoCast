import { networkInterfaces } from 'node:os';
import { TypedEventEmitter, type PublicEndpoint } from '@luzocast/core';
import type { TunnelEvents, TunnelProvider } from './TunnelProvider';

/**
 * Modo "Somente rede local": sem túnel. O servidor público precisa estar em bind no IP
 * da LAN (quem decide é o Composition Root) e o firewall liberado só no perfil Privado.
 *
 * ⚠️ Sem TLS: o token trafega em texto claro dentro da LAN. A UI deve avisar.
 */
export class LanOnlyProvider extends TypedEventEmitter<TunnelEvents> implements TunnelProvider {
  readonly name = 'lan-only';

  constructor(private readonly lanAddress: string = detectLanAddress() ?? '127.0.0.1') {
    super();
  }

  get address(): string {
    return this.lanAddress;
  }

  async start(localPort: number): Promise<PublicEndpoint> {
    return { baseUrl: `http://${this.lanAddress}:${localPort}`, secure: false, behindTrustedProxy: false };
  }

  async stop(): Promise<void> {
    /* nada a encerrar */
  }
}

/** Primeiro IPv4 privado não-interno (192.168/16, 10/8, 172.16/12). */
export function detectLanAddress(): string | undefined {
  const isPrivate = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  for (const list of Object.values(networkInterfaces())) {
    for (const info of list ?? []) {
      if (info.family === 'IPv4' && !info.internal && isPrivate(info.address)) return info.address;
    }
  }
  return undefined;
}
