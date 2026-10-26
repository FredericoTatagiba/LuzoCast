# Design patterns e SOLID

Lista dos padrões adotados. **Novo código deve reutilizar estes padrões** antes de
introduzir outros; se precisar de um novo, registre aqui e em um ADR.

| Padrão        | Onde                                                     | Por quê |
|---------------|----------------------------------------------------------|---------|
| **State**     | `core/session` — `IdleState`, `StartingState`, `LiveState`… | Transições explícitas; estado inválido é impossível |
| **Observer**  | `core/events/TypedEventEmitter`                          | UI, servidor e túnel reagem a eventos sem se conhecerem |
| **Mediator**  | `server/SignalingHub`                                    | Host e viewers nunca falam diretamente; o hub roteia |
| **Strategy**  | `tunnel/TunnelProvider`, `transport/QualityStrategy`, `transport/TransportSelector` | Trocar provedor/política sem tocar em quem usa |
| **Factory**   | `transport/PeerConnectionFactory`                        | Toda `RTCPeerConnection` nasce com a mesma configuração segura |
| **Adapter**   | `apps/host/src/main/capture/ElectronCaptureAdapter.ts` (porta `CaptureSourceProvider`) | Isola a API do Electron; facilita macOS depois |
| **Facade**    | `apps/host/src/renderer/src/services/HostStreamingService.ts`        | UI chama `start()/stop()/admit()/kick()` sem saber de WebRTC |
| **Supervisor**| `tunnel/TunnelSupervisor`                                | Reinicia o túnel com backoff e avisa quando o link muda |
| **Composition Root** | `apps/host/src/main/index.ts`                     | Único lugar que instancia implementações concretas |

## SOLID na prática

- **S** — cada pacote tem uma responsabilidade (ver tabela em `architecture.md`). Arquivos
  grandes demais são sinal de violação.
- **O** — novos provedores de túnel, políticas de qualidade e transportes entram como novas
  classes; o código existente não muda.
- **L** — qualquer `TunnelProvider`/`MediaTransport` deve poder substituir outro. Testes de
  contrato em `*.contract.test.ts` garantem isso.
- **I** — interfaces pequenas (`TunnelProvider` tem 2 métodos + eventos). Não engordar.
- **D** — pacotes dependem de interfaces de `core`; implementações concretas só são
  escolhidas no Composition Root.

## Front-end

- Todo elemento visual repetível vira componente em `@luzocast/ui`.
- Componentes são *burros* (props/emits); lógica fica em composables (`use*`).
- Layout mobile-first; breakpoints em `packages/ui/src/styles/tokens.css`.
