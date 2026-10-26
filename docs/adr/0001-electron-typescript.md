# ADR-0001: Electron + TypeScript + Vue 3

- **Status:** Aceito
- **Data:** 2026-10-26

## Contexto
O app precisa capturar tela e **áudio do sistema** no Windows, falar WebRTC e servir uma
página web para os viewers. A mesma UI deve ser reaproveitada no host e no viewer.

## Decisão
Electron com TypeScript em todo o código; Vue 3 nas duas UIs; `electron-vite` para build.

## Alternativas consideradas
- **Tauri** — app leve, mas WebView2 tem limitações para captura de áudio do sistema e
  não oferece o equivalente ao `setDisplayMediaRequestHandler` com `audio: 'loopback'`.
- **.NET/WPF + SIPSorcery** — controle total, porém codecs, captura e WebRTC precisariam
  ser integrados manualmente. Custo alto para o MVP.

## Consequências
- + WebRTC e captura prontos no Chromium; encoder H.264 de hardware no Windows.
- + Componentes Vue compartilhados entre host e viewer (`@luzocast/ui`).
- − Instalador maior (~90 MB) e consumo de RAM maior.
- − Superfície do Electron exige hardening (ver `docs/security.md`, T11).
