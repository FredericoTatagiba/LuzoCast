# ADR-0009: Link personalizado (`luzocast-<id>`)

- **Status:** Aceito — implementado na branch `feat/link-personalizado`, desligado até haver domínio
- **Data:** 2026-10-26

## Contexto
O quick tunnel da Cloudflare gera um endereço aleatório (`palavras-aleatorias.trycloudflare.com`)
que **não pode ser escolhido**. Queremos algo como `https://abc123.luzocast.app`.

## Opções

| Opção | Funciona? | Custo / risco |
|-------|-----------|---------------|
| Quick tunnel com nome escolhido | **Não** — a Cloudflare não permite | — |
| Named tunnel com credencial embutida no app | Tecnicamente sim | **Inseguro:** qualquer um extrai a credencial do instalador e sequestra o domínio |
| Serviço próprio que cria um named tunnel + DNS por sessão (API da Cloudflare) | Sim | Exige domínio (~R$ 60/ano) e um backend pequeno com a chave da API — um servidor do projeto |
| Redirecionador próprio (`luzo.app/abc` → URL do quick tunnel) | Sim | Também é um servidor do projeto; o link final continua aleatório |

## Decisão (proposta)
Manter o quick tunnel enquanto o projeto é 100% local. O link personalizado entra como
**recurso do serviço pago** previsto no ADR-0006 (relay/TURN): o backend que vai existir para
o relay também provisiona o túnel nomeado. Entra como novo `TunnelProvider`
(`LuzoCloudTunnelProvider`) sem mudar o resto do app.

Importante: o `<id>` no link **não é** o token de acesso — o token continua no `#fragment`.

## Implementação
Ver [docs/link-personalizado.md](../link-personalizado.md). Em vez de um servidor próprio, o
backend é um **Cloudflare Worker** (sem máquina para manter, plano gratuito). O app tenta o
link personalizado e, se o broker falhar, cai no quick tunnel (`FallbackTunnelProvider`).

## Consequências
- + Link bonito e confiável; fim do aviso de domínio aleatório.
- − Introduz infraestrutura e custo recorrente; deixa de ser "zero servidor".
