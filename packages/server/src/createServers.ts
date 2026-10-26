import type { AddressInfo } from 'node:net';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { MAX_MESSAGE_BYTES, MAX_RELAY_CHUNK_BYTES } from '@luzocast/signaling';
import type { SignalingHub } from './SignalingHub';
import { securityHeaders } from './securityHeaders';

export interface CreateServersOptions {
  hub: SignalingHub;
  /** Pasta com o build da página do viewer (apps/viewer/dist). */
  viewerStaticDir: string;
  /** Bind da porta pública: '127.0.0.1' (modo túnel) ou IP da LAN (modo LAN). */
  publicHost: string;
  /**
   * Origens aceitas no canal de controle (defesa extra contra páginas web locais
   * tentando abrir WS em 127.0.0.1). Ex.: ['http://localhost:5173', 'file://'].
   * Conexões sem Origin (o próprio Electron em alguns contextos) são aceitas.
   */
  allowedControlOrigins: readonly string[];
  /** Lido a cada conexão: só confiar em `cf-connecting-ip` atrás do túnel. */
  trustProxyHeader: () => boolean;
}

export interface RunningServers {
  controlPort: number;
  publicPort: number;
  close(): Promise<void>;
}

/** Sobe as duas portas (ADR-0002) e as conecta ao hub. */
export async function createServers(opts: CreateServersOptions): Promise<RunningServers> {
  // Só aceita o upgrade WS no caminho exato do canal. Sem isso, o @fastify/static
  // (rota curinga) completaria o handshake em QUALQUER caminho antes de responder 404.
  const wsOptions = (path: string, maxPayload: number) => ({
    options: {
      maxPayload,
      verifyClient: (info: { req: { url?: string } }) => info.req.url === path,
    },
  });

  // ── Porta de CONTROLE: sempre 127.0.0.1, nunca tunelada
  const control = Fastify({ logger: false });
  await control.register(fastifyWebsocket, wsOptions('/ws/host', MAX_RELAY_CHUNK_BYTES + 128));
  control.get('/ws/host', { websocket: true }, (socket, req) => {
    const origin = req.headers.origin;
    if (origin && !opts.allowedControlOrigins.includes(origin)) return socket.close(1008, 'origin');
    opts.hub.acceptHost(socket);
  });
  control.setNotFoundHandler((_req, reply) => reply.code(404).send());

  // ── Porta PÚBLICA: viewer estático + /ws/viewer
  const pub = Fastify({ logger: false, bodyLimit: 1024 });
  pub.addHook('onSend', async (_req, reply) => {
    reply.headers(securityHeaders());
  });
  await pub.register(fastifyWebsocket, wsOptions('/ws/viewer', MAX_MESSAGE_BYTES));
  await pub.register(fastifyStatic, { root: opts.viewerStaticDir, index: 'index.html', dotfiles: 'deny', list: false });
  pub.get('/ws/viewer', { websocket: true }, (socket, req) => {
    opts.hub.acceptViewer(socket, originKey(req, opts.trustProxyHeader()));
  });

  await listen(control, '127.0.0.1');
  await listen(pub, opts.publicHost);

  return {
    controlPort: port(control),
    publicPort: port(pub),
    async close() {
      await Promise.allSettled([control.close(), pub.close()]);
    },
  };
}

function originKey(req: FastifyRequest, trustProxy: boolean): string {
  const header = req.headers['cf-connecting-ip'];
  if (trustProxy && typeof header === 'string' && header.length <= 64) return header;
  return req.socket.remoteAddress ?? 'unknown';
}

async function listen(app: FastifyInstance, host: string): Promise<void> {
  await app.listen({ host, port: 0 }); // porta efêmera escolhida pelo SO
}

function port(app: FastifyInstance): number {
  return (app.server.address() as AddressInfo).port;
}
