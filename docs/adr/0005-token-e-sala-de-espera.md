# ADR-0005: Token no fragment + sala de espera

- **Status:** Aceito
- **Data:** 2026-10-26

## Contexto
O link será compartilhado em apps de mensagem e pode vazar. URLs com query string
aparecem em logs de proxies e do provedor de túnel.

## Decisão
- Link no formato `https://<host>/#t=<token>`. O fragment nunca é enviado ao servidor HTTP.
- Token de 128 bits (base64url), gerado por sessão; enviado só dentro do WebSocket (`join`).
- Validação em tempo constante + `AttemptLimiter` por origem e global.
- Todo viewer com token válido entra em **espera** até o host aprovar.

## Alternativas consideradas
- **Senha digitada pelo viewer** — mais atrito; o token + aprovação já cobre o caso.
- **Aprovação automática** — fica como opção futura, desativada por padrão.

## Consequências
- + Link vazado sozinho não dá acesso.
- − O host precisa estar atento à UI para aprovar (notificação nativa ajuda).
