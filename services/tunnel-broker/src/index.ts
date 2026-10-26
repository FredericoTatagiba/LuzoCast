/**
 * LuzoCast Tunnel Broker — Cloudflare Worker.
 *
 *   POST   /v1/sessions        { "localPort": 51234 }  → cria túnel + subdomínio
 *   DELETE /v1/sessions/:id    header x-delete-secret  → encerra
 *   cron                                               → apaga sessões vencidas
 *
 * A chave da API da Cloudflare só existe aqui (secret do Worker), nunca no app.
 * Ver docs/link-personalizado.md para publicar.
 */
import { Broker, BrokerError } from './Broker';
import { CloudflareApi } from './CloudflareApi';
import type { Env } from './env';

const PROTOCOL_HEADER = 'x-luzocast-protocol';
const PROTOCOL_VERSION = '1';

function makeBroker(env: Env): Broker {
  const api = new CloudflareApi({ token: env.CF_API_TOKEN, accountId: env.CF_ACCOUNT_ID, zoneId: env.CF_ZONE_ID });
  return new Broker(api, env.SESSIONS, {
    domain: env.DOMAIN,
    hostPrefix: env.HOST_PREFIX ?? '',
    maxActiveSessions: Number(env.MAX_ACTIVE_SESSIONS ?? 50),
    ttlMs: Number(env.SESSION_TTL_HOURS ?? 12) * 3600_000,
  });
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function handleRequest(req: Request, env: Env, broker = makeBroker(env)): Promise<Response> {
  const url = new URL(req.url);
  if (req.headers.get(PROTOCOL_HEADER) !== PROTOCOL_VERSION) return json(400, { error: 'protocol' });

  // Limite por IP (proteção contra abuso: cada sessão cria recursos na sua conta Cloudflare).
  const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
  if (env.RATE_LIMITER && !(await env.RATE_LIMITER.limit({ key: ip })).success) return json(429, { error: 'rate-limited' });

  try {
    if (req.method === 'POST' && url.pathname === '/v1/sessions') {
      const body = (await req.json().catch(() => null)) as { localPort?: unknown } | null;
      const session = await broker.create(Number(body?.localPort));
      return json(201, session);
    }
    const m = /^\/v1\/sessions\/([a-z0-9]{6})$/.exec(url.pathname);
    if (req.method === 'DELETE' && m) {
      await broker.delete(m[1]!, req.headers.get('x-delete-secret') ?? '');
      return new Response(null, { status: 204 });
    }
    return json(404, { error: 'not-found' });
  } catch (err) {
    if (err instanceof BrokerError) return json(err.status, { error: err.code });
    console.error('broker error', err);
    return json(502, { error: 'upstream' });
  }
}

export default {
  fetch: (req: Request, env: Env) => handleRequest(req, env),
  scheduled: async (_event: unknown, env: Env) => {
    const removed = await makeBroker(env).cleanupExpired();
    if (removed) console.log(`luzocast: ${removed} sessão(ões) vencida(s) removida(s)`);
  },
};
