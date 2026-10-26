import { describe, expect, it } from 'vitest';
import { decode, HostToServer, MAX_MESSAGE_BYTES, PROTOCOL_VERSION, ViewerToServer } from './index';

describe('protocolo', () => {
  it('aceita join válido', () => {
    const r = decode(ViewerToServer, JSON.stringify({ type: 'join', v: PROTOCOL_VERSION, token: 'abc', displayName: 'Ana' }));
    expect(r.ok).toBe(true);
  });

  it('rejeita campos extras (strict)', () => {
    const r = decode(ViewerToServer, JSON.stringify({ type: 'leave', exec: 'rm -rf' }));
    expect(r).toEqual({ ok: false, error: 'invalid-schema' });
  });

  it('rejeita tipo desconhecido vindo do viewer', () => {
    const r = decode(ViewerToServer, JSON.stringify({ type: 'kick', viewerId: 'x' }));
    expect(r.ok).toBe(false);
  });

  it('rejeita nome com caractere de controle', () => {
    const r = decode(ViewerToServer, JSON.stringify({ type: 'join', v: 1, token: 'a', displayName: 'A\u0007' }));
    expect(r.ok).toBe(false);
  });

  it('rejeita mensagem grande demais', () => {
    expect(decode(HostToServer, 'x'.repeat(MAX_MESSAGE_BYTES + 1))).toEqual({ ok: false, error: 'too-large' });
  });

  it('rejeita JSON inválido', () => {
    expect(decode(HostToServer, '{')).toEqual({ ok: false, error: 'invalid-json' });
  });
});

import { decodeRelayFrame, encodeRelayFrame, ServerToViewer as S2V } from './index';

describe('modo retransmissão', () => {
  it('frame ida e volta', () => {
    const f = encodeRelayFrame('abc_123', new Uint8Array([1, 2, 3]));
    expect(decodeRelayFrame(f)).toEqual({ viewerId: 'abc_123', chunk: new Uint8Array([1, 2, 3]) });
  });

  it('rejeita frames malformados', () => {
    expect(decodeRelayFrame(new Uint8Array([5, 97]))).toBeNull();
    expect(decodeRelayFrame(new Uint8Array([2, 0x2f, 0x2e, 1]))).toBeNull(); // id com '/' e '.'
    expect(() => encodeRelayFrame('../x', new Uint8Array())).toThrow();
  });

  it('relay-start só aceita MIME webm', () => {
    expect(decode(S2V, JSON.stringify({ type: 'relay-start', mime: 'video/webm;codecs=vp8,opus' })).ok).toBe(true);
    expect(decode(S2V, JSON.stringify({ type: 'relay-start', mime: 'text/html' })).ok).toBe(false);
  });
});
