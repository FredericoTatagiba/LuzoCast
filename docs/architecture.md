# Arquitetura do LuzoCast

> Documento vivo. Toda decisão estrutural relevante tem um ADR em [`docs/adr/`](./adr/).
> Ao mudar algo aqui, atualize (ou crie) o ADR correspondente.

## 1. Visão geral

O LuzoCast é um app desktop (Windows, no MVP) que captura a tela e o áudio do usuário
e transmite para quem abrir um link no navegador. **Não existe servidor do projeto na
nuvem**: o servidor roda dentro do próprio app, na máquina do host.

```
┌──────────────────────────── PC do host (app Electron) ─────────────────────────────┐
│                                                                                     │
│  Renderer (Vue 3)                          Main process (Node)                      │
│  ┌──────────────────────┐   ws://127.0.0.1  ┌────────────────────────────────────┐  │
│  │ HostApp              │◀──── porta de ───▶│ SignalingHub (@luzocast/server)    │  │
│  │  - getDisplayMedia   │     CONTROLE      │  ├─ ControlChannel  (só localhost) │  │
│  │  - 1 RTCPeerConn.    │   (hostSecret)    │  └─ PublicChannel   (viewers)      │  │
│  │    por viewer        │                   │        ▲ serve viewer + /ws/viewer │  │
│  └──────────────────────┘                   │        │ porta PÚBLICA (127.0.0.1) │  │
│            │ mídia WebRTC                   │  TunnelSupervisor ─▶ cloudflared   │  │
│            │ (P2P, DTLS-SRTP)               └────────┼───────────────────────────┘  │
└────────────┼─────────────────────────────────────────┼──────────────────────────────┘
             │                                          │ túnel de SAÍDA (HTTPS)
             │                                          ▼
             │                              https://xxxx.trycloudflare.com
             │                                          │ sinalização (WSS)
             ▼                                          ▼
     ┌────────────────────────── Navegador do espectador ──────────────────────────┐
     │ Viewer (Vue 3): abre o link → envia token → aguarda aprovação → recebe mídia │
     └──────────────────────────────────────────────────────────────────────────────┘
```

### Princípios

1. **O host nunca aceita conexão de entrada da internet.** Toda exposição pública é feita
   por túnel de saída ([ADR-0003](./adr/0003-tunel-de-saida.md)).
2. **Duas portas, duas superfícies.** A porta de *controle* (host ↔ servidor) nunca é
   tunelada; a porta *pública* só fala o protocolo do viewer ([ADR-0002](./adr/0002-servidor-local-duas-portas.md)).
3. **Somente envio.** O viewer não tem nenhum canal capaz de enviar comandos ao host além
   da sinalização mínima (join/answer/ice/leave).
4. **O servidor nunca toca na mídia.** Ele só roteia sinalização. A mídia vai direto do
   renderer para o navegador via WebRTC (ou, no fallback, por um canal dedicado).

## 2. Componentes

| Pacote / App            | Ambiente      | Responsabilidade (uma só — SRP)                                   |
|-------------------------|---------------|-------------------------------------------------------------------|
| `@luzocast/core`        | universal     | Domínio: sessão (State), viewers, eventos tipados (Observer), portas (interfaces) |
| `@luzocast/signaling`   | universal     | Protocolo de mensagens + validação (zod). Única fonte da verdade do protocolo |
| `@luzocast/security`    | Node          | Tokens, comparação em tempo constante, limitadores de tentativa   |
| `@luzocast/tunnel`      | Node          | Estratégias de exposição (Cloudflare, LAN) + supervisor de processo |
| `@luzocast/server`      | Node          | Servidor HTTP/WS local: canais de controle e público               |
| `@luzocast/transport`   | navegador     | Transporte de mídia (WebRTC, MSE), fábrica de PeerConnection, qualidade |
| `@luzocast/ui`          | navegador     | Componentes Vue reutilizáveis e responsivos                        |
| `apps/host`             | Electron      | Composição: liga tudo (Composition Root). Captura de tela/áudio     |
| `apps/viewer`           | navegador     | Página que o espectador abre                                       |

Regra de dependência (Dependency Inversion): **apps dependem de pacotes; pacotes dependem
de `core`/`signaling`; `core` não depende de ninguém.** Nenhum pacote importa um app.

```
apps/host ──▶ server ──▶ signaling ──▶ core
    │    └──▶ tunnel ──────────────────▶ core
    │    └──▶ security
    └──▶ transport ──▶ signaling, core
    └──▶ ui
apps/viewer ──▶ transport, ui, signaling
```

## 3. Fluxo de uma sessão

```
Host clica "Transmitir"
  1. main: gera token (128 bits) e hostSecret (256 bits) em memória
  2. main: sobe SignalingHub (porta controle + porta pública, ambas em 127.0.0.1)
  3. main: TunnelSupervisor inicia cloudflared → recebe https://xxxx.trycloudflare.com
  4. renderer: conecta na porta de controle e autentica com hostSecret
  5. renderer: usuário escolhe tela/janela → getDisplayMedia (vídeo + áudio loopback)
  6. UI mostra o link:  https://xxxx.trycloudflare.com/#t=<token>
Espectador abre o link
  7. viewer: lê o token do #fragment (nunca vai para logs de servidor/proxy)
  8. viewer → servidor: {type:"join", token, displayName}
  9. servidor valida token (tempo constante + rate limit) → coloca viewer em ESPERA
 10. servidor → host: {type:"viewer-request"} → UI mostra "Fulano quer entrar"
 11. host aprova → servidor → viewer: {type:"admitted"}
 12. host cria RTCPeerConnection (sendonly), envia offer → viewer responde answer
 13. ICE escolhe o melhor caminho: LAN direta > P2P via STUN > fallback
Encerrar
 14. host para → servidor envia {type:"ended"} a todos → túnel cai → token morre
```

O ciclo de vida da sessão é uma máquina de estados (padrão **State**):

```
 idle ──start()──▶ starting ──ready()──▶ live ──stop()──▶ stopping ──stopped()──▶ ended
   ▲                  │                    │                                      │
   │                  └──fail()──▶ error ◀─┘                                      │
   └───────────────────── reset() ─────────┴──────────────────────────────────────┘
```

Transições inválidas lançam `InvalidTransitionError` — o domínio nunca fica em estado
inconsistente.

## 4. Mídia e escala

- **Caminho padrão:** WebRTC, uma `RTCPeerConnection` por viewer, `sendonly`, preferindo
  H.264 (encoder de hardware via Media Foundation) e VP8 como fallback.
- **Limites reais:** cada viewer custa (a) uma cópia do upload e (b) um encoder. Ver
  [ADR-0004](./adr/0004-transporte-de-midia.md).
- **Qualidade adaptativa (Strategy):** `AdaptiveQualityStrategy` divide o orçamento de
  upload pelo número de viewers e reduz resolução/fps/bitrate.
- **Seleção de transporte (Strategy):** `ThresholdTransportSelector` — até N viewers usa
  WebRTC; acima disso, novos viewers entram pelo transporte de *encode único* (MSE). Fase 3.

## 5. Exposição de rede

| Modo                 | Provider                       | Quando usar                          |
|----------------------|--------------------------------|--------------------------------------|
| Internet (padrão)    | `CloudflareQuickTunnelProvider`| Amigos em qualquer lugar; funciona com CGNAT |
| Somente rede local   | `LanOnlyProvider`              | Sem internet; avisa que o token trafega sem TLS |

Mesmo no modo Internet, um viewer na mesma rede recebe a mídia pela LAN, porque o ICE
prefere candidatos locais. O túnel só carrega a sinalização.

## 6. Onde mexer para...

| Quero...                                   | Lugar                                              |
|--------------------------------------------|----------------------------------------------------|
| Adicionar mensagem ao protocolo            | `packages/signaling/src/messages.ts` + `docs/signaling-protocol.md` |
| Trocar o provedor de túnel                 | nova classe implementando `TunnelProvider` em `packages/tunnel` |
| Mudar política de qualidade                | nova `QualityStrategy` em `packages/transport/src/quality` |
| Novo estado de sessão                      | `packages/core/src/session/states.ts`              |
| Suportar macOS                             | novo adapter de captura em `apps/host/src/main/capture` |
| Novo componente visual                     | `packages/ui/src/components` (exportar no `index.ts`) |

Veja também: [segurança](./security.md) · [protocolo](./signaling-protocol.md) ·
[design patterns](./design-patterns.md) · [roadmap](./roadmap.md).
