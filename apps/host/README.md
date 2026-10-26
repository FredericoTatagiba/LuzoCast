# @luzocast/host

App Electron do host. Três partes, cada uma com seu `tsconfig`:

| Pasta            | Processo  | O que faz                                                    |
|------------------|-----------|--------------------------------------------------------------|
| `src/main`       | main (Node) | Composition Root, servidor local, túnel, captura, IPC       |
| `src/preload`    | preload (sandbox) | Expõe `window.luzo` (API mínima, ver `src/shared/api.ts`) |
| `src/renderer`   | renderer (Chromium) | UI Vue + WebRTC (`HostStreamingService` é a Facade)   |

## Rodando

```bash
pnpm install
pnpm --filter @luzocast/host fetch:cloudflared   # só para o modo Internet (Windows)
pnpm dev:host                                    # builda o viewer e abre o app
```

Sem o `cloudflared`, use **Somente rede local** e abra o link em outro aparelho da mesma rede.

## Fluxo interno

1. Renderer chama `window.luzo.start()` → main (`StreamingController`) cria credenciais,
   sobe as duas portas, inicia o túnel e devolve `shareUrl`, `controlUrl` e `hostSecret`.
2. Renderer chama `getDisplayMedia()`; o `ElectronCaptureAdapter` entrega a fonte escolhida
   com áudio `loopback`.
3. Renderer conecta no canal de controle e passa a atender pedidos de viewers.

## Segurança do Electron

`sandbox`, `contextIsolation`, sem `nodeIntegration`, navegação bloqueada, popups negados,
permissões limitadas à captura. Ver `src/main/window.ts` e `docs/security.md` (T11).
