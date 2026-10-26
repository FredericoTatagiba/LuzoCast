import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os';
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

  constructor(private readonly lanAddress: string = pickLanAddress(networkInterfaces()) ?? '127.0.0.1') {
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

/**
 * Adaptadores virtuais que NÃO são a rede real do usuário. Escolher um deles gera um link
 * que o celular não alcança (problema comum com WSL, Docker, Hyper-V e VPNs).
 */
const VIRTUAL_ADAPTER = /vethernet|wsl|hyper-v|docker|virtualbox|vmware|vbox|loopback|bluetooth|tailscale|zerotier|hamachi|npcap|radmin/i;

/**
 * Escolhe o IPv4 da rede local real.
 * Ordem de preferência: 192.168/16 (roteadores domésticos) > 10/8 > 172.16/12
 * (faixa usada por WSL/Docker), sempre ignorando adaptadores virtuais conhecidos.
 */
export function pickLanAddress(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): string | undefined {
  const rank = (ip: string) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : -1);
  const candidates: { ip: string; score: number }[] = [];
  for (const [name, list] of Object.entries(interfaces)) {
    if (VIRTUAL_ADAPTER.test(name)) continue;
    for (const info of list ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue;
      const score = rank(info.address);
      if (score >= 0) candidates.push({ ip: info.address, score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.ip;
}

/** @deprecated use `pickLanAddress(networkInterfaces())`. */
export const detectLanAddress = (): string | undefined => pickLanAddress(networkInterfaces());
