import { spawn, type ChildProcess } from 'node:child_process';
import { TypedEventEmitter, type PublicEndpoint } from '@luzocast/core';
import type { TunnelEvents, TunnelProvider } from './TunnelProvider';

export interface LuzoCloudTunnelOptions {
  /** URL do broker (Cloudflare Worker). Ex.: https://api.luzocast.app */
  brokerUrl: string;
  binaryPath: string;
  startTimeoutMs?: number;
  fetchFn?: typeof fetch;
  spawnFn?: typeof spawn;
}

interface BrokerSession {
  sessionId: string;
  hostname: string;
  tunnelToken: string;
  deleteSecret: string;
}

/** O cloudflared imprime isto quando a conexão com a borda da Cloudflare está de pé. */
const CONNECTED = /Registered tunnel connection/i;

/**
 * Link personalizado (ADR-0009): pede ao broker um túnel nomeado + subdomínio
 * (`abc123.seu-dominio.app`) e roda o cloudflared com o token dele.
 *
 * Segurança: o token vai por variável de ambiente (TUNNEL_TOKEN), não por argumento —
 * argumentos de processo ficam visíveis para qualquer programa do PC.
 */
export class LuzoCloudTunnelProvider extends TypedEventEmitter<TunnelEvents> implements TunnelProvider {
  readonly name = 'luzocast-cloud';
  private child: ChildProcess | null = null;
  private session: BrokerSession | null = null;
  private stopping = false;

  constructor(private readonly opts: LuzoCloudTunnelOptions) {
    super();
  }

  async start(localPort: number): Promise<PublicEndpoint> {
    if (this.child) throw new Error('Túnel já iniciado');
    this.stopping = false;
    this.session = await this.createSession(localPort);
    try {
      await this.runCloudflared(this.session.tunnelToken);
    } catch (err) {
      await this.stop();
      throw err;
    }
    return { baseUrl: `https://${this.session.hostname}`, secure: true, behindTrustedProxy: true };
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const child = this.child;
    this.child = null;
    if (child && child.exitCode === null) child.kill();
    const s = this.session;
    this.session = null;
    if (s) await this.deleteSession(s).catch(() => undefined); // o cron do broker limpa se falhar
  }

  private async createSession(localPort: number): Promise<BrokerSession> {
    const res = await this.fetch(`${this.opts.brokerUrl}/v1/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-luzocast-protocol': '1' },
      body: JSON.stringify({ localPort }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const reasons: Record<string, string> = {
        capacity: 'Servidor de links lotado. Tente de novo em alguns minutos ou use o link aleatório.',
        'rate-limited': 'Muitas tentativas seguidas. Aguarde um minuto.',
      };
      throw new Error(reasons[body.error ?? ''] ?? `Falha ao criar link personalizado (HTTP ${res.status}).`);
    }
    return (await res.json()) as BrokerSession;
  }

  private async deleteSession(s: BrokerSession): Promise<void> {
    await this.fetch(`${this.opts.brokerUrl}/v1/sessions/${s.sessionId}`, {
      method: 'DELETE',
      headers: { 'x-luzocast-protocol': '1', 'x-delete-secret': s.deleteSecret },
      signal: AbortSignal.timeout(10_000),
    });
  }

  private runCloudflared(token: string): Promise<void> {
    const spawnFn = this.opts.spawnFn ?? spawn;
    const child = spawnFn(this.opts.binaryPath, ['tunnel', '--no-autoupdate', 'run'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: { ...process.env, TUNNEL_TOKEN: token },
    });
    this.child = child;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };
      const timer = setTimeout(() => done(new Error('cloudflared não conectou a tempo')), this.opts.startTimeoutMs ?? 30_000);
      const onData = (chunk: Buffer) => {
        if (CONNECTED.test(chunk.toString())) done();
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.once('error', (err) => done(err));
      child.once('exit', (code) => {
        this.child = null;
        if (!settled) return done(new Error(`cloudflared saiu com código ${code}`));
        if (!this.stopping) this.emit('down', { reason: `cloudflared saiu (código ${code})` });
      });
    });
  }

  private fetch(url: string, init: RequestInit): Promise<Response> {
    return (this.opts.fetchFn ?? fetch)(url, init);
  }
}
