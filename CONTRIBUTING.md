# Contribuindo com o LuzoCast

Obrigado pelo interesse! Antes de abrir um PR:

1. **Leia** [`docs/architecture.md`](docs/architecture.md) e [`docs/design-patterns.md`](docs/design-patterns.md).
2. **Mudou algo estrutural?** Crie um ADR em `docs/adr/` usando o [template](docs/adr/template.md).
3. **Mexeu em `server/`, `security/` ou no protocolo?** Revise [`docs/security.md`](docs/security.md).
4. **Aceite o CLA** — o bot comenta no PR; basta responder com a frase indicada.

## Regras de código

- TypeScript estrito; sem `any` sem justificativa em comentário.
- SOLID: uma responsabilidade por classe/módulo; dependa de interfaces de `@luzocast/core`.
- Implementações concretas são instanciadas **apenas** no Composition Root
  (`apps/host/src/main/index.ts` e `apps/viewer/src/main.ts`).
- Front-end: tudo que se repete vira componente em `@luzocast/ui`; layout mobile-first.
- Comentários TSDoc em toda API pública de pacote.
- Testes para domínio e segurança (`vitest`).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/pt-br/): `feat(server): ...`,
`fix(transport): ...`, `docs(adr): ...`.

## Fluxo

```bash
pnpm install
pnpm typecheck && pnpm test   # precisa passar antes do PR
```
