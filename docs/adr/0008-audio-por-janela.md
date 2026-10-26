# ADR-0008: Áudio só da janela capturada

- **Status:** Proposto
- **Data:** 2026-10-26

## Contexto
Ao transmitir uma janela, o usuário espera transmitir só o som dela. Hoje, no Windows, o
Electron/Chromium oferece apenas `audio: 'loopback'`, que captura **o mix do sistema inteiro**
— inclusive Discord, notificações e o alerta do próprio LuzoCast. Não existe opção de
áudio por janela no Chromium para Windows.

O Windows 10 (build 20348+) e 11 têm a **Process Loopback API**
(`AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK`), que captura o áudio de um processo
(e seus filhos), ou de tudo **exceto** um processo.

## Decisão (proposta)
1. **Curto prazo (feito):** avisar na UI quando o usuário escolhe uma janela com áudio ligado.
2. **Fase 3:** um *helper* nativo pequeno (`luzocast-audio.exe`, Rust ou C++) que:
   - recebe o PID (obtido do HWND da fonte `window:<HWND>:0` via `GetWindowThreadProcessId`);
   - captura com Process Loopback e escreve PCM no stdout;
   - o main repassa ao renderer, que injeta num `MediaStreamTrack` (AudioWorklet).
   Exposto como Strategy `AudioCaptureProvider`: `SystemLoopbackProvider` (atual) e
   `ProcessLoopbackProvider` (novo). Com tela inteira, usar o modo **"tudo exceto o LuzoCast"**,
   o que também tira o alerta sonoro da transmissão.

## Alternativas consideradas
- **Addon N-API** — integra melhor, mas exige recompilar a cada versão do Electron.
- **FFI (koffi) direto na API COM** — ativação assíncrona de COM via FFI é frágil.

## Consequências
- + Áudio correto para janelas; alerta deixa de vazar para os espectadores.
- − Um binário nativo a mais para assinar, verificar (hash) e manter.
- − Só Windows 10 2004+/11; versões antigas continuam com o loopback do sistema.
