# Modelo de segurança

## Ativos

1. **O conteúdo da tela/áudio do host** — só quem o host aprovou deve ver.
2. **A máquina do host** — nada vindo da internet deve conseguir executar ações nela.

## Ameaças e mitigações

| # | Ameaça                                             | Mitigação                                                                 | Onde no código |
|---|----------------------------------------------------|---------------------------------------------------------------------------|----------------|
| T1 | Link vazado / repassado                           | Sala de espera: host aprova cada viewer; expulsar; link morre ao encerrar  | `server/PublicChannel`, `core/ViewerRegistry` |
| T2 | Força bruta no token                              | 128 bits aleatórios; `AttemptLimiter` por origem **e** global; comparação em tempo constante | `security/` |
| T3 | Token em logs (proxy, Cloudflare, histórico)      | Token no `#fragment` (não sai do navegador) e enviado só dentro do WS       | `apps/viewer/src/composables/useViewerSession.ts` |
| T4 | Acesso à porta do servidor pela LAN               | Bind em `127.0.0.1` no modo Internet; modo LAN exige ação explícita + regra de firewall só no perfil *Privado* (Fase 2) | `server/createServers`, `tunnel/LanOnlyProvider` |
| T5 | Viewer tentando controlar o host                  | Não há DataChannel; `sendonly`; protocolo do viewer não tem comandos; canal de controle em porta separada nunca tunelada | `server/ControlChannel`, `transport/WebRtcTransport` |
| T6 | Outro processo local se passando pelo host        | `hostSecret` de 256 bits, gerado em memória, entregue ao renderer via preload; uma conexão de controle por vez | `apps/host/src/main` |
| T7 | Mensagens malformadas / DoS de memória            | Validação zod, `MAX_MESSAGE_BYTES`, limite de viewers, timeout de `join`/`auth` | `signaling/`, `server/` |
| T8 | XSS na página do viewer (ex.: `displayName`)      | Vue escapa por padrão; nunca usar `v-html`; CSP rígida servida pelo servidor | `server/securityHeaders` |
| T9 | Captura além do pretendido                        | Usuário escolhe tela/janela; indicador "AO VIVO" sempre visível            | `apps/host/src/renderer` |
| T10 | Binários desatualizados (Electron, cloudflared)  | Auto-update (Fase 4); versão do cloudflared fixada e verificada por hash   | roadmap |
| T11 | Renderer comprometido acessando Node             | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, preload expõe API mínima | `apps/host/src/main/window.ts` |
| T12 | Handshake WS aceito em caminhos arbitrários        | `verifyClient` só aceita upgrade no caminho exato de cada canal; testado em `createServers.test.ts` | `server/createServers` |

## Regras para quem contribui

- **Nunca** adicionar rota HTTP que leia arquivos fora da pasta estática do viewer.
- **Nunca** adicionar mensagem viewer → host que dispare ação além de sinalização WebRTC.
- **Nunca** logar `token`, `hostSecret` ou SDP completo.
- Qualquer mudança em `server/`, `security/` ou no protocolo precisa de revisão com este
  documento aberto. Se a mudança criar uma ameaça nova, adicione uma linha na tabela.

## Endereço IP de origem

No modo Internet, todas as conexões chegam do processo `cloudflared` (127.0.0.1). Por isso
o rate limit por origem usa o cabeçalho `cf-connecting-ip` **somente** quando o servidor
está atrás do túnel (`trustProxyHeader: true`). No modo LAN o cabeçalho é ignorado, pois
seria trivial de forjar.

Vulnerabilidades: veja [`SECURITY.md`](../SECURITY.md).
