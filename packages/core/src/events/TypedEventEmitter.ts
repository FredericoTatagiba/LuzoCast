/**
 * Observer tipado e independente de ambiente (funciona em Node e no navegador).
 *
 * @example
 * type Events = { 'status-changed': { from: string; to: string } };
 * const bus = new TypedEventEmitter<Events>();
 * const off = bus.on('status-changed', (e) => console.log(e.to));
 * off(); // remove o listener
 */
export type EventMap = Record<string, unknown>;
export type Listener<T> = (payload: T) => void;

export class TypedEventEmitter<E extends EventMap> {
  private readonly listeners = new Map<keyof E, Set<Listener<never>>>();

  /** Registra um listener. Retorna a função que o remove. */
  on<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return () => this.off(event, listener);
  }

  /** Registra um listener que dispara uma única vez. */
  once<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void {
    const off = this.on(event, (payload) => {
      off();
      listener(payload);
    });
    return off;
  }

  off<K extends keyof E>(event: K, listener: Listener<E[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  /**
   * Emite o evento. Um listener que lança erro não impede os demais de rodarem;
   * o erro é repassado a `onListenerError` (por padrão, `console.error`).
   */
  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as Listener<E[K]>)(payload);
      } catch (err) {
        this.onListenerError(err, String(event));
      }
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  protected onListenerError(err: unknown, event: string): void {
    console.error(`[luzocast] listener de "${event}" falhou`, err);
  }
}
