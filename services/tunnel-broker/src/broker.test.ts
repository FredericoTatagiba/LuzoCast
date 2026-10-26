import { describe, expect, it, vi } from 'vitest';
import { Broker, BrokerError } from './Broker';
import { CloudflareApi } from './CloudflareApi';
import type { Env, KvNamespace } from './env';
import { handleRequest } from './index';

class MemoryKv implements KvNamespace {
  data = new Map<string, string>();
  async get(k: string) {
    return this.data.get(k) ?? null;
  }
  async put(k: string, v: string) {
    this.data.set(k, v);
  }
  async delete(k: string) {
    this.data.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return { keys: [...this.data.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

/** API falsa que registra as chamadas; `failOn` simula erro numa etapa. */
function fakeApi(failOn?: string) {
  const calls: string[] = [];
  const step = (name: string, result?: unknown) => async () => {
    calls.push(name);
    if (name === failOn) throw new Error(`falhou: ${name}`);
    return result;
  };
  const api = {
    createTunnel: step('createTunnel', { id: 'tun-1' }),
    configureIngress: step('configureIngress'),
    createCname: step('createCname', { id: 'dns-1' }),
    getTunnelToken: step('getTunnelToken', 'TUNNEL-TOKEN'),
    deleteDnsRecord: step('deleteDnsRecord'),
    deleteTunnel: step('deleteTunnel'),
  } as unknown as CloudflareApi;
  return { api, calls };
}

const opts = (over: Partial<ConstructorParameters<typeof Broker>[2]> = {}) => ({
  domain: 'luzocast.app',
  hostPrefix: '',
  maxActiveSessions: 2,
  ttlMs: 3600_000,
  random: (n: number) => new Uint8Array(n).fill(7),
  ...over,
});

describe('Broker', () => {
  it('cria túnel, ingress, DNS e devolve token + segredo de encerramento', async () => {
    const { api, calls } = fakeApi();
    const kv = new MemoryKv();
    const s = await new Broker(api, kv, opts()).create(51234);
    expect(calls).toEqual(['createTunnel', 'configureIngress', 'createCname', 'getTunnelToken']);
    expect(s.hostname).toMatch(/^[a-z2-9]{6}\.luzocast\.app$/);
    expect(s.tunnelToken).toBe('TUNNEL-TOKEN');
    // o KV não guarda o token nem o segredo em claro
    const stored = [...kv.data.values()][0]!;
    expect(stored).not.toContain('TUNNEL-TOKEN');
    expect(stored).not.toContain(s.deleteSecret);
  });

  it('aplica o prefixo do subdomínio', async () => {
    const s = await new Broker(fakeApi().api, new MemoryKv(), opts({ hostPrefix: 'luzocast-' })).create(51234);
    expect(s.hostname).toMatch(/^luzocast-[a-z2-9]{6}\.luzocast\.app$/);
  });

  it('desfaz o que criou se uma etapa falhar (nada fica órfão)', async () => {
    const { api, calls } = fakeApi('getTunnelToken');
    await expect(new Broker(api, new MemoryKv(), opts()).create(51234)).rejects.toThrow();
    expect(calls).toContain('deleteTunnel');
    expect(calls).toContain('deleteDnsRecord');
  });

  it('recusa porta inválida e respeita o teto de sessões', async () => {
    const b = new Broker(fakeApi().api, new MemoryKv(), opts({ maxActiveSessions: 1, random: undefined }));
    await expect(b.create(80)).rejects.toMatchObject({ code: 'invalid-port' });
    await b.create(51234);
    await expect(b.create(51235)).rejects.toMatchObject({ status: 503, code: 'capacity' });
  });

  it('encerrar exige o segredo certo', async () => {
    const { api, calls } = fakeApi();
    const kv = new MemoryKv();
    const b = new Broker(api, kv, opts());
    const s = await b.create(51234);
    await expect(b.delete(s.sessionId, 'errado')).rejects.toBeInstanceOf(BrokerError);
    await b.delete(s.sessionId, s.deleteSecret);
    expect(calls.filter((c) => c === 'deleteTunnel')).toHaveLength(1);
    expect(kv.data.size).toBe(0);
  });

  it('cron remove só sessões vencidas', async () => {
    let t = 0;
    const kv = new MemoryKv();
    const b = new Broker(fakeApi().api, kv, opts({ now: () => t, random: undefined }));
    await b.create(51234);
    t = 1000;
    expect(await b.cleanupExpired()).toBe(0);
    t = 3600_001;
    expect(await b.cleanupExpired()).toBe(1);
    expect(kv.data.size).toBe(0);
  });
});

describe('CloudflareApi', () => {
  it('monta as chamadas e lança erro quando success=false', async () => {
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) =>
      new Response(JSON.stringify(init.method === 'POST' ? { success: true, result: { id: 'abc' } } : { success: false, errors: [{ code: 1 }] }), {
        status: init.method === 'POST' ? 200 : 400,
      }),
    );
    const api = new CloudflareApi({ token: 'T', accountId: 'ACC', zoneId: 'Z', fetchFn: fetchFn as never });
    expect(await api.createTunnel('luzocast-x')).toEqual({ id: 'abc' });
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/ACC/cfd_tunnel');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer T');
    await expect(api.getTunnelToken('abc')).rejects.toThrow('Cloudflare API 400');
  });
});

describe('handleRequest', () => {
  const env = { SESSIONS: new MemoryKv() } as unknown as Env;

  it('exige header de protocolo e aplica rate limit', async () => {
    const res1 = await handleRequest(new Request('https://api.x/v1/sessions', { method: 'POST' }), env, {} as Broker);
    expect(res1.status).toBe(400);
    const limited = { ...env, RATE_LIMITER: { limit: async () => ({ success: false }) } } as Env;
    const res2 = await handleRequest(new Request('https://api.x/v1/sessions', { method: 'POST', headers: { 'x-luzocast-protocol': '1' } }), limited, {} as Broker);
    expect(res2.status).toBe(429);
  });

  it('POST cria e DELETE encerra', async () => {
    const broker = { create: vi.fn(async () => ({ sessionId: 'abc234' })), delete: vi.fn(async () => {}) } as unknown as Broker;
    const h = { 'x-luzocast-protocol': '1' };
    const created = await handleRequest(new Request('https://api.x/v1/sessions', { method: 'POST', headers: h, body: JSON.stringify({ localPort: 50000 }) }), env, broker);
    expect(created.status).toBe(201);
    const deleted = await handleRequest(new Request('https://api.x/v1/sessions/abc234', { method: 'DELETE', headers: { ...h, 'x-delete-secret': 's' } }), env, broker);
    expect(deleted.status).toBe(204);
  });
});
