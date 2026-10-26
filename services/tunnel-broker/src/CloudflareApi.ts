/**
 * Cliente mínimo da API da Cloudflare (v4) — só o que o broker usa.
 * Docs: https://developers.cloudflare.com/api/  (Cloudflare Tunnel, DNS Records)
 *
 * ⚠️ Escrito contra a documentação, ainda NÃO exercitado contra a API real (sem domínio).
 * Ao ativar, rode o checklist de docs/link-personalizado.md.
 */
export class CloudflareApiError extends Error {
  constructor(
    readonly status: number,
    readonly errors: unknown,
  ) {
    super(`Cloudflare API ${status}: ${JSON.stringify(errors)}`);
  }
}

export interface CloudflareApiOptions {
  token: string;
  accountId: string;
  zoneId: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}

export class CloudflareApi {
  private readonly fetchFn: typeof fetch;
  private readonly base: string;

  constructor(private readonly opts: CloudflareApiOptions) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.base = opts.baseUrl ?? 'https://api.cloudflare.com/client/v4';
  }

  /** Cria um túnel com configuração gerenciada remotamente (ingress definido via API). */
  async createTunnel(name: string): Promise<{ id: string }> {
    const r = await this.call<{ id: string }>('POST', `/accounts/${this.opts.accountId}/cfd_tunnel`, { name, config_src: 'cloudflare' });
    return { id: r.id };
  }

  /** Aponta o hostname público para a porta local do app (127.0.0.1:<port>). */
  async configureIngress(tunnelId: string, hostname: string, localPort: number): Promise<void> {
    await this.call('PUT', `/accounts/${this.opts.accountId}/cfd_tunnel/${tunnelId}/configurations`, {
      config: {
        ingress: [{ hostname, service: `http://127.0.0.1:${localPort}` }, { service: 'http_status:404' }],
      },
    });
  }

  /** Token que o `cloudflared tunnel run` usa. Dá acesso SÓ a este túnel. */
  async getTunnelToken(tunnelId: string): Promise<string> {
    return this.call<string>('GET', `/accounts/${this.opts.accountId}/cfd_tunnel/${tunnelId}/token`);
  }

  async createCname(name: string, tunnelId: string): Promise<{ id: string }> {
    const r = await this.call<{ id: string }>('POST', `/zones/${this.opts.zoneId}/dns_records`, {
      type: 'CNAME',
      name,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
      ttl: 1,
      comment: 'luzocast: sessão temporária',
    });
    return { id: r.id };
  }

  async deleteDnsRecord(recordId: string): Promise<void> {
    await this.call('DELETE', `/zones/${this.opts.zoneId}/dns_records/${recordId}`, undefined, [404]);
  }

  /** Derruba conexões ativas e apaga o túnel (a API recusa apagar túnel com conexões). */
  async deleteTunnel(tunnelId: string): Promise<void> {
    await this.call('DELETE', `/accounts/${this.opts.accountId}/cfd_tunnel/${tunnelId}/connections`, undefined, [404]);
    await this.call('DELETE', `/accounts/${this.opts.accountId}/cfd_tunnel/${tunnelId}`, undefined, [404]);
  }

  private async call<T>(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<T> {
    const res = await this.fetchFn(`${this.base}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.opts.token}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (okStatuses.includes(res.status)) return undefined as T;
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; result?: T; errors?: unknown };
    if (!res.ok || json.success === false) throw new CloudflareApiError(res.status, json.errors ?? null);
    return json.result as T;
  }
}
