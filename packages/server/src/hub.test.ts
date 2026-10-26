import { describe, expect, it } from 'vitest';
import { ViewerRegistry } from '@luzocast/core';
import { AttemptLimiter } from '@luzocast/security';
import { encodeRelayFrame } from '@luzocast/signaling';
import { SignalingHub, type MessageSocket } from './index';

class FakeSocket implements MessageSocket {
  sent: any[] = [];
  closed: { code?: number; reason?: string } | null = null;
  binary: Uint8Array[] = [];
  private handlers: Record<string, Array<(d?: unknown, b?: boolean) => void>> = {};
  send(data: string | Uint8Array) {
    if (typeof data === 'string') this.sent.push(JSON.parse(data));
    else this.binary.push(data);
  }
  close(code?: number, reason?: string) {
    if (this.closed) return;
    this.closed = { code, reason };
    this.handlers.close?.forEach((h) => h());
  }
  on(event: string, listener: (d?: unknown, b?: boolean) => void) {
    (this.handlers[event] ??= []).push(listener);
    return this;
  }
  receive(msg: object) {
    this.handlers.message?.forEach((h) => h(JSON.stringify(msg), false));
  }
  receiveBinary(bytes: Uint8Array) {
    this.handlers.message?.forEach((h) => h(bytes, true));
  }
  last() {
    return this.sent.at(-1);
  }
}

function setup(maxViewers = 5) {
  let n = 0;
  const registry = new ViewerRegistry({ maxViewers, generateId: () => `v${++n}` });
  const limiter = new AttemptLimiter({ maxFailuresPerKey: 3, maxFailuresGlobal: 50, windowMs: 60_000 });
  const hub = new SignalingHub({
    registry,
    limiter,
    verifyAccessToken: (t) => t === 'TOKEN',
    verifyHostSecret: (s) => s === 'SECRET',
  });
  const host = new FakeSocket();
  hub.acceptHost(host);
  host.receive({ type: 'auth', v: 1, secret: 'SECRET' });
  return { hub, host, registry };
}

describe('SignalingHub', () => {
  it('fluxo completo: join → espera → admit → offer/answer', () => {
    const { hub, host } = setup();
    expect(host.last()).toEqual({ type: 'auth-ok' });

    const viewer = new FakeSocket();
    hub.acceptViewer(viewer, '1.1.1.1');
    viewer.receive({ type: 'join', v: 1, token: 'TOKEN', displayName: 'Ana' });
    expect(viewer.last()).toEqual({ type: 'waiting', viewerId: 'v1' });
    expect(host.last()).toEqual({ type: 'viewer-request', viewerId: 'v1', displayName: 'Ana' });

    // antes de admitido, answer é ignorado
    viewer.receive({ type: 'answer', sdp: 'x' });
    expect(host.last().type).toBe('viewer-request');

    host.receive({ type: 'admit', viewerId: 'v1' });
    expect(viewer.last()).toEqual({ type: 'admitted' });
    host.receive({ type: 'offer', viewerId: 'v1', sdp: 'OFFER' });
    expect(viewer.last()).toEqual({ type: 'offer', sdp: 'OFFER' });
    viewer.receive({ type: 'answer', sdp: 'ANSWER' });
    expect(host.last()).toEqual({ type: 'viewer-answer', viewerId: 'v1', sdp: 'ANSWER' });
  });

  it('token inválido é rejeitado e conta para o rate limit', () => {
    const { hub } = setup();
    for (let i = 0; i < 3; i++) {
      const v = new FakeSocket();
      hub.acceptViewer(v, '6.6.6.6');
      v.receive({ type: 'join', v: 1, token: 'ERRADO', displayName: 'X' });
      expect(v.sent[0]).toEqual({ type: 'rejected', reason: 'invalid-token' });
    }
    const v = new FakeSocket();
    hub.acceptViewer(v, '6.6.6.6');
    v.receive({ type: 'join', v: 1, token: 'TOKEN', displayName: 'X' });
    expect(v.sent[0]).toEqual({ type: 'rejected', reason: 'rate-limited' });
  });

  it('kick fecha o viewer e avisa o host', () => {
    const { hub, host } = setup();
    const viewer = new FakeSocket();
    hub.acceptViewer(viewer, 'a');
    viewer.receive({ type: 'join', v: 1, token: 'TOKEN', displayName: 'Ana' });
    host.receive({ type: 'kick', viewerId: 'v1' });
    expect(viewer.last()).toEqual({ type: 'kicked' });
    expect(viewer.closed).not.toBeNull();
    expect(host.last()).toEqual({ type: 'viewer-left', viewerId: 'v1' });
  });

  it('viewer não consegue enviar comandos de host', () => {
    const { hub } = setup();
    const viewer = new FakeSocket();
    hub.acceptViewer(viewer, 'a');
    viewer.receive({ type: 'join', v: 1, token: 'TOKEN', displayName: 'Ana' });
    viewer.receive({ type: 'kick', viewerId: 'v1' });
    expect(viewer.closed?.code).toBe(1008);
  });

  it('segundo host é recusado e host com segredo errado é fechado', () => {
    const { hub } = setup();
    const intruder = new FakeSocket();
    hub.acceptHost(intruder);
    intruder.receive({ type: 'auth', v: 1, secret: 'SECRET' });
    expect(intruder.closed?.code).toBe(1013);
    const wrong = new FakeSocket();
    hub.acceptHost(wrong);
    wrong.receive({ type: 'auth', v: 1, secret: 'nope' });
    expect(wrong.closed?.code).toBe(1008);
  });

  it('shutdown envia ended para todos', () => {
    const { hub } = setup();
    const viewer = new FakeSocket();
    hub.acceptViewer(viewer, 'a');
    viewer.receive({ type: 'join', v: 1, token: 'TOKEN', displayName: 'Ana' });
    hub.shutdown();
    expect(viewer.last()).toEqual({ type: 'ended' });
  });

  it('modo retransmissão: relay-start + frames só para viewer admitido', () => {
    const { hub, host } = setup();
    const viewer = new FakeSocket();
    hub.acceptViewer(viewer, 'a');
    viewer.receive({ type: 'join', v: 1, token: 'TOKEN', displayName: 'Ana' });
    // ainda pendente: nada passa
    host.receiveBinary(encodeRelayFrame('v1', new Uint8Array([9])));
    expect(viewer.binary).toHaveLength(0);
    host.receive({ type: 'admit', viewerId: 'v1' });
    host.receive({ type: 'relay-start', viewerId: 'v1', mime: 'video/webm;codecs=vp8,opus' });
    expect(viewer.last()).toEqual({ type: 'relay-start', mime: 'video/webm;codecs=vp8,opus' });
    host.receiveBinary(encodeRelayFrame('v1', new Uint8Array([1, 2])));
    expect(viewer.binary).toEqual([new Uint8Array([1, 2])]);
  });

  it('viewer que manda binário é desconectado; host com frame inválido também', () => {
    const { hub, host } = setup();
    const viewer = new FakeSocket();
    hub.acceptViewer(viewer, 'a');
    viewer.receive({ type: 'join', v: 1, token: 'TOKEN', displayName: 'Ana' });
    viewer.receiveBinary(new Uint8Array([1]));
    expect(viewer.closed?.code).toBe(1008);
    host.receiveBinary(new Uint8Array([0]));
    expect(host.closed?.code).toBe(1008);
  });
});
