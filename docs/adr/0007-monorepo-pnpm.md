# ADR-0007: Monorepo com pnpm workspaces

- **Status:** Aceito
- **Data:** 2026-10-26

## Contexto
Host e viewer compartilham protocolo, domínio e componentes. Mudanças no protocolo precisam
atualizar os dois lados no mesmo commit.

## Decisão
Monorepo com `pnpm` workspaces: `apps/*` (executáveis) e `packages/*` (bibliotecas).
Pacotes internos são consumidos como fonte TypeScript (`"main": "src/index.ts"`), sem build
intermediário; cada app faz o bundle final.

## Alternativas consideradas
- **Repos separados** — versionar o protocolo entre repos é atrito sem benefício agora.
- **npm/yarn workspaces** — funcionam, mas pnpm é mais rápido e estrito com dependências
  fantasmas.

## Consequências
- + Refatorações atômicas; typecheck do projeto inteiro em um comando.
- − Contribuidores precisam do pnpm (`corepack enable`).
