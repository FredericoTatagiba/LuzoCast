import type { CloudflareApi } from './CloudflareApi';
import type { KvNamespace } from './env';

/** O que fica salvo por sessão (KV `s:<id>`). Nunca guarda o token do túnel. */
export interface StoredSession {
  id: string;
  hostname: string;
  tunnelId: string;
  dnsRecordId: string;
  /** SHA-256 (hex) do segredo de encerramento — o segredo em si só o app conhece. */
  deleteSecretHash: string;
  createdAt: number;
}

export interface CreatedSession {
  sessionId: string;
  hostname: string;
  /** Token do cloudflared: dá acesso só a este túnel. */
  tunnelToken: string;
  /** Necessário para encerrar a sessão (DELETE). */
  deleteSecret: string;
  expiresAt: number;
}

export interface BrokerOptions {
  domain: string;
  hostPrefix: string;
  maxActiveSessions: number;
  ttlMs: number;
  now?: () => number;
  random?: (bytes: number) => Uint8Array;
}

export class BrokerError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // sem l/o/0/1: fácil de ditar
const KEY = (id: string) => `s:${id}`;

/**
 * Regras de negócio do broker, sem nada de HTTP (testável com fakes).
 * Fluxo de criação: túnel → ingress → DNS → token. Se algo falhar no meio,
 * desfaz o que já foi criado (nada fica órfão no domínio).
 */
export class Broker {
  private readonly now: () => number;
  private readonly random: (bytes: number) => Uint8Array;

  constructor(
    private readonly api: CloudflareApi,
    private readonly kv: KvNamespace,
    private readonly opts: BrokerOptions,
  ) {
    this.now = opts.now ?? Date.now;
    this.random = opts.random ?? ((n) => crypto.getRandomValues(new Uint8Array(n)));
  }

  async create(localPort: number): Promise<CreatedSession> {
    if (!Number.isInteger(localPort) || localPort < 1024 || localPort > 65535) throw new BrokerError(400, 'invalid-port');
    if ((await this.countActive()) >= this.opts.maxActiveSessions) throw new BrokerError(503, 'capacity');

    const id = this.newId();
    const hostname = `${this.opts.hostPrefix}${id}.${this.opts.domain}`;
    const deleteSecret = toBase64Url(this.random(16));
    const tunnel = await this.api.createTunnel(`luzocast-${id}`);
    let dnsRecordId: string | null = null;
    try {
      await this.api.configureIngress(tunnel.id, hostname, localPort);
      dnsRecordId = (await this.api.createCname(hostname, tunnel.id)).id;
      const tunnelToken = await this.api.getTunnelToken(tunnel.id);
      const createdAt = this.now();
      const stored: StoredSession = { id, hostname, tunnelId: tunnel.id, dnsRecordId, deleteSecretHash: await sha256Hex(deleteSecret), createdAt };
      // TTL do KV um pouco maior que o da sessão: o cron ainda precisa achar o registro para limpar.
      await this.kv.put(KEY(id), JSON.stringify(stored), { expirationTtl: Math.ceil(this.opts.ttlMs / 1000) + 3600 });
      return { sessionId: id, hostname, tunnelToken, deleteSecret, expiresAt: createdAt + this.opts.ttlMs };
    } catch (err) {
      await this.teardown(tunnel.id, dnsRecordId);
      throw err;
    }
  }

  async delete(id: string, deleteSecret: string): Promise<void> {
    const raw = await this.kv.get(KEY(id));
    if (!raw) return; // idempotente
    const s = JSON.parse(raw) as StoredSession;
    if (!timingSafeEqualHex(await sha256Hex(deleteSecret), s.deleteSecretHash)) throw new BrokerError(403, 'forbidden');
    await this.teardown(s.tunnelId, s.dnsRecordId);
    await this.kv.delete(KEY(id));
  }

  /** Chamado pelo cron: apaga sessões que passaram do TTL (app fechou sem encerrar, queda, etc.). */
  async cleanupExpired(): Promise<number> {
    let removed = 0;
    for await (const s of this.sessions()) {
      if (this.now() - s.createdAt < this.opts.ttlMs) continue;
      await this.teardown(s.tunnelId, s.dnsRecordId);
      await this.kv.delete(KEY(s.id));
      removed++;
    }
    return removed;
  }

  private async teardown(tunnelId: string, dnsRecordId: string | null): Promise<void> {
    await Promise.allSettled([dnsRecordId ? this.api.deleteDnsRecord(dnsRecordId) : Promise.resolve(), this.api.deleteTunnel(tunnelId)]);
  }

  private async countActive(): Promise<number> {
    let n = 0;
    for await (const _ of this.sessions()) n++;
    return n;
  }

  private async *sessions(): AsyncGenerator<StoredSession> {
    let cursor: string | undefined;
    do {
      const page = await this.kv.list({ prefix: 's:', ...(cursor ? { cursor } : {}) });
      for (const k of page.keys) {
        const raw = await this.kv.get(k.name);
        if (raw) yield JSON.parse(raw) as StoredSession;
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }

  private newId(): string {
    const bytes = this.random(6);
    return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
