# Desempenho, memória e jogos

## Quanto de RAM o LuzoCast usa

O app mostra o número **real** durante a transmissão (card "Desempenho", soma de todos os
processos do Electron via `app.getAppMetrics()`; passe o mouse para ver por processo).
Estimativas para planejamento, em Windows 11 x64:

| Situação                               | RAM aproximada |
|----------------------------------------|----------------|
| App aberto, sem transmitir             | 250–350 MB     |
| Transmitindo, 1 espectador (GPU)       | 350–500 MB     |
| Cada espectador a mais (encoder GPU)   | +30–60 MB      |
| Cada espectador a mais (encoder CPU)   | +60–120 MB     |
| `cloudflared` (modo Internet)          | +30–50 MB (processo separado, não entra na conta do card) |

Para jogos, o que importa não é tanto a RAM, e sim **GPU, CPU e upload** — abaixo.

## Gargalos ao transmitir jogos

| # | Gargalo | Sintoma | O que o LuzoCast faz | O que o usuário pode fazer |
|---|---------|---------|----------------------|----------------------------|
| G1 | **1 encoder por espectador** (WebRTC) | CPU/GPU sobem a cada pessoa que entra | Perfil Jogo reduz resolução antes de fps; card mostra gargalo | Poucos espectadores; MSE (encode único) na Fase 3 |
| G2 | **Limite de sessões NVENC** em GeForce (varia com o driver) | Acima do limite o Chromium cai para encoder de **software** → FPS do jogo despenca | Card "Encoder" fica vermelho em "Software" | Menos espectadores; atualizar driver |
| G3 | **Sem encoder de hardware** (GPU antiga, VM, driver genérico) | CPU alta desde o 1º espectador | Verificação de prontidão avisa | Atualizar driver de vídeo |
| G4 | **Upload** | Imagem borrada / travando para todos | Qualidade adaptativa divide o upload medido | Cabo em vez de Wi-Fi; fechar downloads |
| G5 | **Tela cheia exclusiva** | Tela preta para quem assiste | — | Rodar o jogo em "Janela sem bordas" (borderless) |
| G6 | **Áudio do sistema inteiro** | Espectadores ouvem Discord, notificações e o alerta do app | Aviso na tela de opções | Ver [ADR-0008](./adr/0008-audio-por-janela.md) |
| G7 | **GPU disputada** pela captura | Queda pequena de FPS (captura de tela usa a GPU) | — | Limitar o FPS do jogo deixa folga |

### Perfis

| Perfil | FPS | Sob pressão sacrifica | Dica ao encoder |
|--------|-----|-----------------------|-----------------|
| Jogo | 60 | resolução | `motion` |
| Apresentação | 30 | fps | `detail` |

Definidos em `apps/host/src/renderer/src/services/streamProfiles.ts`.

## Bundle do main {#bundle}

O main é bundlado por completo para o instalador não precisar de `node_modules`.
Dependências **opcionais** carregadas com `require` em `try/catch` (`bufferutil`,
`utf-8-validate` do `ws`; `pino-pretty` do fastify) **precisam** ficar externas: bundladas,
o fallback quebra e o WebSocket falha em runtime com `bufferUtil.mask is not a function`
(encontrado num teste de fumaça do bundle). Ao adicionar dependências ao main, rode o app
empacotado e conecte um viewer antes de publicar.
