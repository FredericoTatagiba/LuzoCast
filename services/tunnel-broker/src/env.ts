/**
 * Bindings e variáveis do Worker (definidos em wrangler.toml + `wrangler secret put`).
 * Tipos mínimos escritos à mão para não depender de @cloudflare/workers-types.
 */
export interface KvNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

/** Binding de Rate Limiting do Workers (`[[unsafe.bindings]] type = "ratelimit"`). */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** SEGREDO: token de API com "Account › Cloudflare Tunnel › Edit" e "Zone › DNS › Edit" (só esta zona). */
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
  CF_ZONE_ID: string;
  /** Ex.: "luzocast.app". */
  DOMAIN: string;
  /** Prefixo do subdomínio. "" → abc123.luzocast.app; "luzocast-" → luzocast-abc123.dominio.com */
  HOST_PREFIX?: string;
  /** Teto de sessões simultâneas (proteção de custo/abuso). */
  MAX_ACTIVE_SESSIONS?: string;
  /** Duração máxima de uma sessão em horas (depois o cron apaga). */
  SESSION_TTL_HOURS?: string;
  SESSIONS: KvNamespace;
  RATE_LIMITER?: RateLimiter;
}
