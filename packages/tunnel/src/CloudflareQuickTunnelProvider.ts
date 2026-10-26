import { spawn, type ChildProcess } from 'node:child_process';
import { TypedEventEmitter, type PublicEndpoint } from '@luzocast/core';
import type { TunnelEvents, TunnelProvider } from './TunnelProvider';

export interface CloudflareQuickTunnelOptions {
  /** Caminho do binário `cloudflared` embarcado no app. */
  binaryPath: string;
  /** Tempo máximo para o cloudflared anunciar a URL. */
  startTimeoutMs?: number;
  /** Injetável para testes. */
  spawnFn?: typeof spawn;
}

const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

/**
 * Cloudflare quick tunnel (sem conta). Conexão de SAÍDA — nenhuma porta é aberta no host.
 * O cloudflared imprime a URL pública no stderr; extraímos com `URL_PATTERN`.
 */
export class CloudflareQuickTunnelProvider extends TypedEventEmitter<TunnelEvents> implements TunnelProvider {
  readonly name = 'cloudflare-quick';
  private child: ChildProcess | null = null;
  private stopping = false;

  constructor(private readonly opts: CloudflareQuickTunnelOptions) {
    super();
  }

  start(localPort: number): Promise<PublicEndpoint> {
    if (this.child) return Promise.reject(new Error('Túnel já iniciado'));
    this.stopping = false;
    const spawnFn = this.opts.spawnFn ?? spawn;
    const child = spawnFn(
      this.opts.binaryPath,
      ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${localPort}`],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    this.child = child;

    return new Promise<PublicEndpoint>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => fail(new Error('cloudflared não anunciou a URL a tempo')), this.opts.startTimeoutMs ?? 20_000);

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        void this.stop();
        reject(err);
      };

      const onData = (chunk: Buffer) => {
        const match = URL_PATTERN.exec(chunk.toString());
        if (!match || settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ baseUrl: match[0], secure: true, behindTrustedProxy: true });
      };

      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.once('error', (err) => fail(err));
      child.once('exit', (code) => {
        this.child = null;
        if (!settled) return fail(new Error(`cloudflared saiu com código ${code}`));
        if (!this.stopping) this.emit('down', { reason: `cloudflared saiu (código ${code})` });
      });
    });
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const child = this.child;
    this.child = null;
    if (child && child.exitCode === null) child.kill();
  }
}
