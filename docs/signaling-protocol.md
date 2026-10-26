# Protocolo de sinalização

Fonte da verdade em código: [`packages/signaling/src/messages.ts`](../packages/signaling/src/messages.ts).
Toda mensagem é JSON com um campo `type` e é **validada com zod na entrada**; mensagens
inválidas encerram a conexão (código WS `1008 policy violation`).

- Tamanho máximo por mensagem: **32 KiB** (`MAX_MESSAGE_BYTES`).
- Versão do protocolo: `PROTOCOL_VERSION = 1`, enviada no `join` e no `auth`.
- Toda alteração aqui exige: atualizar o schema, este documento e subir a versão se quebrar
  compatibilidade.

## Canais

| Canal    | Endpoint      | Porta     | Bind              | Exposto pelo túnel? |
|----------|---------------|-----------|-------------------|---------------------|
| Público  | `/ws/viewer`  | pública   | 127.0.0.1 ou LAN  | Sim                 |
| Controle | `/ws/host`    | controle  | sempre 127.0.0.1  | **Nunca**           |

## Canal público (viewer ⇄ servidor)

### Viewer → servidor

| `type`   | Campos                                   | Permitido quando        |
|----------|------------------------------------------|-------------------------|
| `join`   | `v`, `token`, `displayName` (1–32 chars) | primeira mensagem, uma vez |
| `answer` | `sdp`                                    | viewer `admitted`       |
| `ice`    | `candidate` (`RTCIceCandidateInit`)      | viewer `admitted`       |
| `leave`  | —                                        | qualquer momento        |

### Servidor → viewer

| `type`     | Campos                 | Significado                                   |
|------------|------------------------|-----------------------------------------------|
| `waiting`  | `viewerId`             | Token válido; aguardando aprovação do host     |
| `admitted` | —                      | Host aprovou; o `offer` vem em seguida         |
| `rejected` | `reason`               | `invalid-token`, `host-declined`, `room-full`, `rate-limited` |
| `offer`    | `sdp`                  | Oferta WebRTC do host                          |
| `ice`      | `candidate`            | Candidato ICE do host                          |
| `kicked`   | —                      | Host removeu o viewer                          |
| `ended`    | —                      | Transmissão encerrada                          |
| `relay-start` | `mime`              | P2P falhou: a mídia passa a chegar como **frames binários** (WebM) neste WebSocket |

## Canal de controle (host ⇄ servidor)

### Host → servidor

| `type`   | Campos                     |
|----------|----------------------------|
| `auth`   | `v`, `secret`              |
| `admit`  | `viewerId`                 |
| `reject` | `viewerId`                 |
| `kick`   | `viewerId`                 |
| `offer`  | `viewerId`, `sdp`          |
| `ice`    | `viewerId`, `candidate`    |
| `end`    | —                          |
| `relay-start` | `viewerId`, `mime`    |

`auth` deve ser a primeira mensagem, em até 5 s; caso contrário a conexão é fechada.
Só uma conexão de controle autenticada por vez.

### Servidor → host

| `type`           | Campos                         |
|------------------|--------------------------------|
| `auth-ok`        | —                              |
| `viewer-request` | `viewerId`, `displayName`      |
| `viewer-answer`  | `viewerId`, `sdp`              |
| `viewer-ice`     | `viewerId`, `candidate`        |
| `viewer-left`    | `viewerId`                     |

## Sequência

```
Viewer                Servidor                    Host (renderer)
  │── join ─────────────▶│                              │
  │                      │ valida token + rate limit    │
  │◀──────── waiting ────│── viewer-request ───────────▶│
  │                      │◀─────────────────── admit ───│
  │◀─────── admitted ────│                              │
  │◀────────── offer ────│◀─────────────────── offer ───│
  │── answer ───────────▶│── viewer-answer ────────────▶│
  │◀─▶ ice ◀────────────▶│◀─▶ viewer-ice / ice ◀───────▶│
  │═════════════ mídia WebRTC (P2P, não passa pelo servidor) ═════════════│
```

## Modo retransmissão (fallback do P2P)

Quando o WebRTC não conecta em 15 s (ou falha), o host grava o stream com `MediaRecorder`
(WebM, pedaços de ~250 ms) e envia pelo canal de controle:

```
host → servidor : {"type":"relay-start","viewerId":"…","mime":"video/webm;codecs=vp8,opus"}
host → servidor : frames binários  [1 byte: len(viewerId)][viewerId][pedaço WebM]
servidor → viewer: {"type":"relay-start","mime":"…"}  e depois só o pedaço WebM (binário)
```

Regras: só o host autenticado envia binário (máx. `MAX_RELAY_CHUNK_BYTES`); viewer que
enviar binário é desconectado; o MIME é restrito a `video/webm;codecs=…`; viewer que não
consome rápido (buffer > 16 MB) é desconectado. Código: `packages/signaling/src/relayFrame.ts`.
