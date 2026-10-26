import { describe, expect, it } from 'vitest';
import { AttemptLimiter, SessionCredentials, generateSecret, safeEqual } from './index';

describe('tokens', () => {
  it('gera segredos únicos com >=128 bits', () => {
    const a = generateSecret();
    expect(a).not.toBe(generateSecret());
    expect(Buffer.from(a, 'base64url').length).toBe(16);
    expect(() => generateSecret(8)).toThrow(RangeError);
  });

  it('safeEqual compara corretamente, inclusive tamanhos diferentes', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('shareUrl coloca o token no fragment', () => {
    const c = new SessionCredentials();
    const url = c.shareUrl('https://x.trycloudflare.com/');
    expect(url).toBe(`https://x.trycloudflare.com/#t=${c.accessToken}`);
    expect(new URL(url).search).toBe('');
  });
});

describe('AttemptLimiter', () => {
  it('bloqueia por origem e libera após a janela', () => {
    let t = 0;
    const l = new AttemptLimiter({ maxFailuresPerKey: 2, maxFailuresGlobal: 100, windowMs: 1000, now: () => t });
    l.recordFailure('ip1');
    l.recordFailure('ip1');
    expect(l.canAttempt('ip1')).toBe(false);
    expect(l.canAttempt('ip2')).toBe(true);
    t = 1001;
    expect(l.canAttempt('ip1')).toBe(true);
  });

  it('bloqueio global atinge todas as origens', () => {
    const l = new AttemptLimiter({ maxFailuresPerKey: 10, maxFailuresGlobal: 3, windowMs: 1000, now: () => 0 });
    ['a', 'b', 'c'].forEach((k) => l.recordFailure(k));
    expect(l.isGloballyLocked).toBe(true);
    expect(l.canAttempt('nova')).toBe(false);
  });
});
