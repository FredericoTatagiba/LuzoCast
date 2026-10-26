import { describe, expect, it, vi } from 'vitest';
import { InvalidTransitionError, RoomFullError, Session, ViewerRegistry } from './index';

describe('Session (State)', () => {
  it('percorre o ciclo feliz e emite eventos', () => {
    const s = new Session();
    const seen: string[] = [];
    s.on('status-changed', (e) => seen.push(e.to));
    s.start();
    s.ready();
    s.stop();
    s.stopped();
    expect(seen).toEqual(['starting', 'live', 'stopping', 'ended']);
  });

  it('rejeita transição inválida sem mudar o estado', () => {
    const s = new Session();
    expect(() => s.ready()).toThrow(InvalidTransitionError);
    expect(s.status).toBe('idle');
  });

  it('falha leva a error e permite reset', () => {
    const s = new Session();
    s.start();
    s.fail('tunnel-down');
    expect(s.status).toBe('error');
    s.reset();
    expect(s.status).toBe('idle');
  });
});

describe('ViewerRegistry', () => {
  const make = (max = 2) => {
    let n = 0;
    return new ViewerRegistry({ maxViewers: max, generateId: () => `v${++n}` });
  };

  it('pendente → admitido → removido', () => {
    const r = make();
    const removed = vi.fn();
    r.on('removed', removed);
    const v = r.request('Ana');
    expect(v.status).toBe('pending');
    r.admit(v.id);
    expect(r.admittedCount).toBe(1);
    r.remove(v.id, 'kicked');
    expect(r.size).toBe(0);
    expect(removed).toHaveBeenCalledWith(expect.objectContaining({ reason: 'kicked' }));
  });

  it('respeita o limite da sala', () => {
    const r = make(1);
    r.request('A');
    expect(() => r.request('B')).toThrow(RoomFullError);
  });

  it('não admite duas vezes', () => {
    const r = make();
    const v = r.request('A');
    r.admit(v.id);
    expect(() => r.admit(v.id)).toThrow(InvalidTransitionError);
  });
});
