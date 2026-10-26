# Architecture Decision Records

Cada decisão estrutural fica registrada aqui. ADRs são **imutáveis**: para mudar uma
decisão, crie um ADR novo com status `Aceito` e marque o antigo como `Substituído por ADR-XXXX`.

| ADR | Título | Status |
|-----|--------|--------|
| [0001](./0001-electron-typescript.md) | Electron + TypeScript + Vue 3 | Aceito |
| [0002](./0002-servidor-local-duas-portas.md) | Servidor local com portas de controle e pública | Aceito |
| [0003](./0003-tunel-de-saida.md) | Exposição pública por túnel de saída | Aceito |
| [0004](./0004-transporte-de-midia.md) | WebRTC P2P com transporte de encode único acima de N viewers | Aceito |
| [0005](./0005-token-e-sala-de-espera.md) | Token no fragment + sala de espera | Aceito |
| [0006](./0006-licenca-agpl-cla.md) | AGPL-3.0 + CLA | Aceito |
| [0007](./0007-monorepo-pnpm.md) | Monorepo com pnpm workspaces | Aceito |
| [0008](./0008-audio-por-janela.md) | Áudio só da janela capturada | Proposto |
| [0009](./0009-link-personalizado.md) | Link personalizado (`luzocast-<id>`) | Proposto |

Modelo: [`template.md`](./template.md).
