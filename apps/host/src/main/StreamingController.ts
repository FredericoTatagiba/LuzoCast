import { existsSync } from 'node:fs';
import { LuzoError, Session, ViewerRegistry, type CaptureSourceProvider, type SessionStatus } from '@luzocast/core';
import { AttemptLimiter, SessionCredentials, generateId } from '@luzocast/security';
import { SignalingHub, createServers, type RunningServers } from '@luzocast/server';
import { CloudflareQuickTunnelProvider, LanOnlyProvider, TunnelSupervisor, type TunnelProvider } from '@luzocast/tunnel';
import type { StartOptions, StartResult } from '../shared/api';

export interface StreamingControllerDeps {
  capture: CaptureSourceProvider;
  viewerStaticDir: string;
  cloudflaredPath: string;
  allowedControlOrigins: string[];
  maxViewers?: number;
  onStatus: (e: { status: SessionStatus; reason?: string }) => void;
  onShareUrl: (url: string) => void;
}

interface RunningSession {
  servers: RunningServers;
  hub: SignalingHub;
  supervisor: TunnelSupervisor;
}

/**
 * Orquestra uma transmissão no main process: credenciais → servidor (2 portas) →
 * túnel → link. Não sabe nada de mídia (ela vive no renderer).
 * Dependências concretas são criadas aqui a partir das opções; tudo o que é
 * plataforma (captura, caminhos) chega injetado pelo Composition Root.
 */
export class StreamingController {
  private readonly session = new Session();
  private running: RunningSession | null = null;

  constructor(private readonly deps: StreamingControllerDeps) {
    this.session.on('status-changed', ({ to, reason }) => deps.onStatus({ status: to, ...(reason ? { reason } : {}) }));
  }

  get status(): SessionStatus {
    return this.session.status;
  }

  async start(opts: StartOptions): Promise<StartResult> {
    if (this.session.status === 'ended' || this.session.status === 'error') this.session.reset();
    this.session.start();
    try {
      this.deps.capture.select(opts.sourceId, { systemAudio: opts.systemAudio });
      const credentials = new SessionCredentials();
      const registry = new ViewerRegistry({ maxViewers: this.deps.maxViewers ?? 50, generateId });
      const limiter = new AttemptLimiter({ maxFailuresPerKey: 5, maxFailuresGlobal: 30, windowMs: 10 * 60_000 });
      const hub = new SignalingHub({
        registry,
        limiter,
        verifyAccessToken: (t) => credentials.verifyAccessToken(t),
        verifyHostSecret: (s) => credentials.verifyHostSecret(s),
      });
      hub.on('end-requested', () => void this.stop());

      const provider = this.createProvider(opts.mode);
      const servers = await createServers({
        hub,
        viewerStaticDir: this.deps.viewerStaticDir,
        publicHost: provider instanceof LanOnlyProvider ? provider.address : '127.0.0.1',
        allowedControlOrigins: this.deps.allowedControlOrigins,
        trustProxyHeader: () => opts.mode === 'internet',
      });

      const supervisor = new TunnelSupervisor(provider);
      supervisor.on('endpoint-changed', (e) => this.deps.onShareUrl(credentials.shareUrl(e.baseUrl)));
      supervisor.on('gave-up', ({ reason }) => {
        this.session.fail(`túnel caiu: ${reason}`);
        void this.teardown();
      });
      this.running = { servers, hub, supervisor };

      const endpoint = await supervisor.start(servers.publicPort);
      this.session.ready();
      return {
        shareUrl: credentials.shareUrl(endpoint.baseUrl),
        controlUrl: `ws://127.0.0.1:${servers.controlPort}/ws/host`,
        hostSecret: credentials.hostSecret,
        ...(endpoint.secure ? {} : { warning: 'Modo rede local: o link não usa criptografia. Use apenas em redes que você confia.' }),
      };
    } catch (err) {
      await this.teardown();
      this.session.fail(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.session.status !== 'live' && this.session.status !== 'starting' && this.session.status !== 'error') return;
    this.session.stop();
    await this.teardown();
    this.session.stopped();
  }

  private createProvider(mode: StartOptions['mode']): TunnelProvider {
    if (mode === 'lan') return new LanOnlyProvider();
    if (!existsSync(this.deps.cloudflaredPath)) {
      throw new LuzoError('cloudflared-missing', 'cloudflared não encontrado. Rode "pnpm --filter @luzocast/host fetch:cloudflared" ou use o modo rede local.');
    }
    return new CloudflareQuickTunnelProvider({ binaryPath: this.deps.cloudflaredPath });
  }

  private async teardown(): Promise<void> {
    const r = this.running;
    this.running = null;
    if (!r) return;
    r.hub.shutdown(); // avisa viewers com "ended"
    await Promise.allSettled([r.supervisor.stop(), r.servers.close()]);
  }
}
