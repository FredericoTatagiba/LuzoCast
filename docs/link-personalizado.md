# Link personalizado (`abc123.seu-dominio.app`)

> **Status:** código pronto na branch `feat/link-personalizado`, **desligado** até existir
> um domínio. Sem configuração, o app usa o link aleatório do quick tunnel, como antes.
> Decisão: [ADR-0009](./adr/0009-link-personalizado.md).

## Como funciona

```
App LuzoCast ──POST /v1/sessions {localPort}──▶ Broker (Cloudflare Worker)
                                                  │ API Cloudflare (chave só aqui)
                                                  ├─ cria túnel nomeado "luzocast-abc123"
                                                  ├─ ingress: abc123.dominio → 127.0.0.1:<porta>
                                                  ├─ DNS: CNAME abc123 → <túnel>.cfargotunnel.com
                                                  └─ devolve token do túnel + segredo de encerramento
App ── cloudflared tunnel run (TUNNEL_TOKEN=…) ──▶ borda da Cloudflare
Amigo ── https://abc123.dominio/#t=<token de acesso> ──▶ sua máquina
App encerra ──DELETE /v1/sessions/abc123──▶ Broker apaga DNS + túnel
Cron (30 min) ──▶ apaga sessões com mais de 12 h (app fechado sem encerrar)
```

O `<id>` no domínio **não** é o token de acesso: o token continua no `#fragment` e a sala
de espera continua valendo. O subdomínio só deixa o link reconhecível.

| Peça | Onde |
|------|------|
| Worker (broker) | `services/tunnel-broker/` |
| Provider no app | `packages/tunnel/src/LuzoCloudTunnelProvider.ts` |
| Fallback para link aleatório | `packages/tunnel/src/FallbackTunnelProvider.ts` |
| Liga/desliga | `apps/host/resources/cloud.json` (`brokerUrl`) |

## Checklist para ativar (quando comprar o domínio)

1. **Domínio na Cloudflare** — comprado lá ou com os nameservers apontando para ela.
2. **Anote** o *Account ID* e o *Zone ID* (painel do domínio → *Overview*, coluna direita).
3. **Token de API** (*My Profile → API Tokens → Create Token → Custom*), com **somente**:
   - Account → **Cloudflare Tunnel** → Edit
   - Zone → **DNS** → Edit — *Zone Resources: Include → Specific zone → seu domínio*
4. **KV para as sessões:**
   ```powershell
   cd services/tunnel-broker
   npx wrangler@4 login
   npx wrangler@4 kv namespace create SESSIONS     # copie o id para wrangler.toml
   ```
5. **Preencha** os `TODO` do `services/tunnel-broker/wrangler.toml` (domínio, IDs, rota `api.<domínio>`).
6. **Segredo e deploy:**
   ```powershell
   npx wrangler@4 secret put CF_API_TOKEN
   pnpm --filter @luzocast/tunnel-broker deploy
   ```
7. **Teste o broker** (deve responder 201 com `hostname`):
   ```powershell
   curl -X POST https://api.<dominio>/v1/sessions -H "x-luzocast-protocol: 1" -H "content-type: application/json" -d '{\"localPort\":50000}'
   ```
   Depois apague a sessão com o `sessionId`/`deleteSecret` retornados (ou espere o cron).
8. **Ative no app** — em `apps/host/resources/cloud.json`:
   ```json
   { "brokerUrl": "https://api.<dominio>" }
   ```
   Para testar sem rebuild: `$env:LUZOCAST_BROKER_URL="https://api.<dominio>"; pnpm dev:host`.

## O que ainda não foi validado

O cliente da API foi escrito pela documentação da Cloudflare e testado com respostas
simuladas (`services/tunnel-broker/src/broker.test.ts`). Na ativação, confira:

- [ ] `POST cfd_tunnel` com `config_src: "cloudflare"` cria o túnel e o token funciona no `cloudflared tunnel run`.
- [ ] O ingress `http://127.0.0.1:<porta>` chega à porta pública do app.
- [ ] WebSocket (`/ws/viewer`) passa pelo túnel nomeado.
- [ ] `DELETE` limpa DNS e túnel; nada sobra em *Zero Trust → Networks → Tunnels*.
- [ ] O cron apaga sessões vencidas.

## Custos e limites

- Domínio: anual. Workers, KV, túneis e DNS: plano gratuito cobre o uso pessoal.
- `MAX_ACTIVE_SESSIONS` (padrão 50) e o rate limit (10 criações/min por IP) protegem a sua
  conta contra abuso. **Limitação conhecida:** qualquer pessoa que descubra a URL do broker
  pode criar sessões até esses limites. Antes de distribuir publicamente, adicionar
  autenticação por instalação (chave registrada no primeiro uso) ou Cloudflare Turnstile.
