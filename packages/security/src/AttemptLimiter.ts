export interface AttemptLimiterOptions {
  /** Falhas permitidas por chave (origem) dentro da janela. */
  maxFailuresPerKey: number;
  /** Falhas permitidas somando todas as origens (protege contra ataque distribuído). */
  maxFailuresGlobal: number;
  /** Janela em ms. */
  windowMs: number;
  now?: () => number;
}

/**
 * Limita tentativas de autenticação com falha (janela deslizante simples).
 * Sucessos não consomem cota. Ao estourar o limite global, TODOS são bloqueados
 * até a janela passar — o host deve ser avisado (o link pode ter vazado).
 */
export class AttemptLimiter {
  private readonly perKey = new Map<string, number[]>();
  private global: number[] = [];
  private readonly now: () => number;

  constructor(private readonly opts: AttemptLimiterOptions) {
    this.now = opts.now ?? Date.now;
  }

  /** `true` se a origem ainda pode tentar. */
  canAttempt(key: string): boolean {
    const t = this.now();
    this.global = this.prune(this.global, t);
    if (this.global.length >= this.opts.maxFailuresGlobal) return false;
    const list = this.prune(this.perKey.get(key) ?? [], t);
    // não guarda chaves sem falhas: evita crescer a memória com origens únicas
    if (list.length === 0) this.perKey.delete(key);
    else this.perKey.set(key, list);
    return list.length < this.opts.maxFailuresPerKey;
  }

  /** Registra uma falha. */
  recordFailure(key: string): void {
    const t = this.now();
    const list = this.perKey.get(key) ?? [];
    list.push(t);
    this.perKey.set(key, list);
    this.global.push(t);
  }

  /** `true` quando o limite global foi atingido (sinal de ataque). */
  get isGloballyLocked(): boolean {
    this.global = this.prune(this.global, this.now());
    return this.global.length >= this.opts.maxFailuresGlobal;
  }

  private prune(list: number[], t: number): number[] {
    const from = t - this.opts.windowMs;
    return list.filter((x) => x > from);
  }
}
