import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { TypedEventEmitter, type PublicEndpoint } from '@luzocast/core';
import { CloudflareQuickTunnelProvider, TunnelSupervisor, type TunnelEvents, type TunnelProvider } from './index';

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; exitCode: number | null; kill: () => void };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.kill = () => {
    child.exitCode = 0;
    child.emit('exit', 0);
  };
  return child;
}

describe('CloudflareQuickTunnelProvider', () => {
  it('extrai a URL pública do stderr', async () => {
    const child = fakeChild();
    const p = new CloudflareQuickTunnelProvider({ binaryPath: 'cloudflared', spawnFn: (() => child) as never });
    const started = p.start(1234);
    child.stderr.emit('data', Buffer.from('INF |  https://abc-def.trycloudflare.com  |'));
    await expect(started).resolves.toEqual({ baseUrl: 'https://abc-def.trycloudflare.com', secure: true, behindTrustedProxy: true });
    await p.stop();
  });

  it('emite down em queda inesperada', async () => {
    const child = fakeChild();
    const p = new CloudflareQuickTunnelProvider({ binaryPath: 'x', spawnFn: (() => child) as never });
    const started = p.start(1);
    child.stdout.emit('data', Buffer.from('https://a.trycloudflare.com'));
    await started;
    const reasons: string[] = [];
    p.on('down', (e) => reasons.push(e.reason));
    child.emit('exit', 1);
    expect(reasons).toHaveLength(1);
  });
});

describe('TunnelSupervisor', () => {
  class FlakyProvider extends TypedEventEmitter<TunnelEvents> implements TunnelProvider {
    readonly name = 'flaky';
    starts = 0;
    async start(): Promise<PublicEndpoint> {
      this.starts++;
      return { baseUrl: `https://n${this.starts}.example`, secure: true, behindTrustedProxy: true };
    }
    async stop() {}
  }

  it('reinicia após queda e anuncia novo endpoint', async () => {
    const provider = new FlakyProvider();
    const sup = new TunnelSupervisor(provider, { sleep: async () => {} });
    const urls: string[] = [];
    sup.on('endpoint-changed', (e) => urls.push(e.baseUrl));
    await sup.start(80);
    provider.emit('down', { reason: 'test' });
    await new Promise((r) => setTimeout(r, 0));
    expect(urls).toEqual(['https://n1.example', 'https://n2.example']);
    await sup.stop();
  });
});
