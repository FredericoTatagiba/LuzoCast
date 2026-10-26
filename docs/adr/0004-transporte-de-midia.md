# ADR-0004: WebRTC P2P com transporte de encode único acima de N viewers

- **Status:** Aceito
- **Data:** 2026-10-26

## Contexto
Requisitos: baixa latência, funcionar em qualquer navegador, número de viewers definido
pelo host. Em WebRTC, **cada `RTCPeerConnection` tem seu próprio encoder**: 10 viewers
significam 10 encodes e 10 cópias do upload.

## Decisão
1. Padrão: WebRTC `sendonly`, um peer por viewer, codec preferido H.264 (hardware), VP8 como
   fallback. STUN público; sem TURN (não há servidor do projeto).
2. Acima de um limiar N (configurável, inicialmente 5), novos viewers usam um transporte de
   **encode único** (fMP4 via WebSocket + MSE no navegador): o vídeo é codificado uma vez e os
   mesmos bytes são distribuídos. Latência de 1–3 s.
3. A escolha é uma **Strategy** (`TransportSelector`); a qualidade é outra (`QualityStrategy`).

## Alternativas consideradas
- **SFU local (mediasoup)** — encode único com baixa latência, mas adiciona dependência
  nativa pesada e não reduz o upload. Reavaliar na Fase 3.
- **Só HLS** — latência alta demais para o caso de uso principal.

## Consequências
- + Latência mínima para grupos pequenos; escala para grupos grandes.
- − Dois transportes para manter. Testes de contrato garantem que ambos honram `MediaTransport`.
- − Sem TURN, ~10–20% dos viewers externos podem falhar no ICE → fallback MSE pelo túnel.

## Atualização (2026-10-26)
O transporte de encode único entrou primeiro como **fallback do P2P** ("modo retransmissão"):
se o WebRTC não conecta em 15 s, o host retransmite WebM pelo túnel para aquele viewer
(`MseTransport` no host, `MseRelayPlayer` no viewer). Limitações: 1–3 s de atraso, um
`MediaRecorder` por viewer retransmitido e sem suporte no Safari/iPhone (WebM via MSE).
