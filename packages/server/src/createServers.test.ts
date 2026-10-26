import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { ViewerRegistry } from '@luzocast/core';
import { AttemptLimiter } from '@luzocast/security';
import { SignalingHub, createServers, type RunningServers } from './index';

/** Teste de integração: portas reais, Fastify real, WebSockets reais. */
describe('createServers (integração)', () => {
  let servers: RunningServers | null = null;
  afterEach(async () => {
    await servers?.close();
    servers = null;
  });

  async function boot() {
    const dir = mkdtempSync(join(tmpdir(), 'luzo-viewer-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><p>viewer</p>');
    writeFileSync(join(dir, '.env'), 'SEGREDO=1');
    let n = 0;
    const hub = new SignalingHub({
      registry: new ViewerRegistry({ maxViewers: 5, generateId: () => `v${++n}` }),
      limiter: new AttemptLimiter({ maxFailuresPerKey: 5, maxFailuresGlobal: 50, windowMs: 60_000 }),
      verifyAccessToken: (t) => t === 'TOKEN',
      verifyHostSecret: (s) => s === 'SECRET',
    });
    servers = await createServers({
      hub,
      viewerStaticDir: dir,
      publicHost: '127.0.0.1',
      allowedControlOrigins: ['http://app.local'],
      trustProxyHeader: () => false,
    });
    return servers;
  }

  const open = (url: string, origin?: string) =>
    new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(url, origin ? { origin } : {});
      ws.once('open', () => resolve(ws));
      ws.once('error', reject);
    });
  const next = (ws: WebSocket) => new Promise<any>((r) => ws.once('message', (d) => r(JSON.parse(String(d)))));
  const closed = (ws: WebSocket) => new Promise<number>((r) => ws.once('close', (code) => r(code)));

  it('porta pública serve o viewer com CSP e não expõe dotfiles', async () => {
    const s = await boot();
    const res = await fetch(`http://127.0.0.1:${s.publicPort}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect((await fetch(`http://127.0.0.1:${s.publicPort}/.env`)).status).not.toBe(200);
    expect((await fetch(`http://127.0.0.1:${s.publicPort}/../../etc/passwd`)).status).not.toBe(200);
  });

  it('porta pública NÃO tem o endpoint de controle', async () => {
    const s = await boot();
    await expect(open(`ws://127.0.0.1:${s.publicPort}/ws/host`)).rejects.toBeTruthy();
  });

  it('canal de controle recusa Origin não permitido', async () => {
    const s = await boot();
    const ws = await open(`ws://127.0.0.1:${s.controlPort}/ws/host`, 'https://site-malicioso.com');
    expect(await closed(ws)).toBe(1008);
  });

  it('fluxo real host ↔ viewer até o offer', async () => {
    const s = await boot();
    const host = await open(`ws://127.0.0.1:${s.controlPort}/ws/host`, 'http://app.local');
    host.send(JSON.stringify({ type: 'auth', v: 1, secret: 'SECRET' }));
    expect(await next(host)).toEqual({ type: 'auth-ok' });

    const viewer = await open(`ws://127.0.0.1:${s.publicPort}/ws/viewer`);
    const hostGotRequest = next(host);
    viewer.send(JSON.stringify({ type: 'join', v: 1, token: 'TOKEN', displayName: 'Ana' }));
    expect(await next(viewer)).toEqual({ type: 'waiting', viewerId: 'v1' });
    expect(await hostGotRequest).toEqual({ type: 'viewer-request', viewerId: 'v1', displayName: 'Ana' });

    const admitted = next(viewer);
    host.send(JSON.stringify({ type: 'admit', viewerId: 'v1' }));
    expect(await admitted).toEqual({ type: 'admitted' });

    const offer = next(viewer);
    host.send(JSON.stringify({ type: 'offer', viewerId: 'v1', sdp: 'v=0' }));
    expect(await offer).toEqual({ type: 'offer', sdp: 'v=0' });

    host.close();
    viewer.close();
  });
});
