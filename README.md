# LuzoCast

**Transmita sua tela e o áudio do seu PC com um clique.** O LuzoCast gera um link seguro
que seus amigos abrem em qualquer navegador — sem servidor externo, sem cadastro e sem
abrir portas no roteador. P2P via WebRTC, funciona na rede local e pela internet.

> 🇬🇧 One-click screen and audio streaming straight from your PC. LuzoCast generates a secure
> link your friends open in any browser, with no external server, no sign-up and no router
> port forwarding.

> ⚠️ **Status:** em desenvolvimento (Fase 1). Ainda não há release.

## Como funciona

1. Você abre o LuzoCast e clica em **Transmitir**.
2. Escolhe a tela ou janela. O áudio do sistema vai junto.
3. O app gera um link como `https://xxxx.trycloudflare.com/#t=…`. Envie aos amigos.
4. Cada amigo que abrir o link aparece para você aprovar. Só quem você aprovar assiste.
5. Clicou em **Encerrar**, o link deixa de existir.

Quem está na mesma rede recebe o vídeo direto pela LAN; quem está fora recebe P2P pela
internet. O servidor roda **dentro do app, no seu PC** — nada fica hospedado em nuvem nossa.

## Segurança em uma frase

Seu PC **não aceita conexões de entrada**: o link público vem de um túnel de saída, o
espectador só consegue *assistir* (não há controle remoto) e cada pessoa precisa da sua
aprovação. Detalhes em [`docs/security.md`](docs/security.md).

## Requisitos

- **Host:** Windows 10/11 (macOS/Linux no futuro).
- **Espectador:** qualquer navegador moderno (Chrome, Edge, Firefox, Safari), desktop ou celular.

## Desenvolvimento

```bash
corepack enable          # habilita o pnpm
pnpm install
pnpm dev:host            # abre o app Electron em modo dev
pnpm dev:viewer          # página do espectador isolada (http://localhost:5173)
pnpm typecheck           # checa tipos de todo o monorepo
pnpm test                # testes unitários
```

### Estrutura

```
apps/
  host/          App Electron (main + preload + renderer Vue)
  viewer/        Página web que o espectador abre
packages/
  core/          Domínio: sessão (State), viewers, eventos (Observer), interfaces
  signaling/     Protocolo de mensagens + validação (zod)
  security/      Tokens, comparação segura, limitadores de tentativa
  tunnel/        Exposição pública (Cloudflare, LAN) + supervisor
  server/        Servidor local (porta de controle + porta pública)
  transport/     Transporte de mídia (WebRTC, MSE), qualidade adaptativa
  ui/            Componentes Vue reutilizáveis e responsivos
docs/            Arquitetura, segurança, protocolo, patterns, roadmap, ADRs
```

### Documentação

| Documento | Conteúdo |
|-----------|----------|
| [Arquitetura](docs/architecture.md) | Visão geral, componentes, fluxo, onde mexer |
| [Segurança](docs/security.md) | Ameaças e mitigações |
| [Protocolo](docs/signaling-protocol.md) | Mensagens de sinalização |
| [Design patterns](docs/design-patterns.md) | Padrões adotados e SOLID |
| [Roadmap](docs/roadmap.md) | Fases e riscos |
| [ADRs](docs/adr/README.md) | Decisões de arquitetura |

## Contribuindo

Leia o [`CONTRIBUTING.md`](CONTRIBUTING.md). Contribuições exigem aceitar o
[CLA](CLA.md) (o bot pede automaticamente no PR).

## Licença

[GNU AGPL-3.0](LICENSE). O nome e a marca "LuzoCast" não são cobertos pela licença — veja
[`TRADEMARK.md`](TRADEMARK.md). Para licença comercial, abra uma issue.
