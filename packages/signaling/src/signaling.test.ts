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
