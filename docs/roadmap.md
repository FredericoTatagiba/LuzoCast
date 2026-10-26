# Roadmap

## Fase 1 — Núcleo na LAN  ← *em andamento*
- [x] Monorepo, documentação, ADRs
- [x] Domínio (sessão/viewers), protocolo, segurança base
- [ ] Captura de tela + áudio loopback (Electron, Windows)
- [ ] Servidor local (duas portas) + viewer servindo pela LAN
- [ ] WebRTC host → viewer com aprovação na sala de espera

## Melhorias de 26/10
- [x] Alerta sonoro + piscar na barra de tarefas + notificação nativa em pedidos de entrada
- [x] Perfis Jogo (60 fps) / Apresentação (30 fps)
- [x] Card de desempenho: RAM/CPU reais, encoder GPU/CPU, gargalo, resolução e fps entregues
- [x] Verificação de prontidão (internet, upload medido, túnel, rede local, RAM, encoder, STUN)
- [x] Upload medido alimenta a qualidade adaptativa
- [x] Instalador NSIS (electron-builder) com Electron, viewer e cloudflared embutidos
- [x] `pnpm run setup:dev` para o ambiente de desenvolvimento
- [x] Viewer: estados "Aprovado, conectando…" e "falha de conexão" (antes ficava em "Aguardando")
- [x] Escolha do IP da LAN ignora adaptadores virtuais (WSL, Docker, Hyper-V, VPNs)
- [ ] Áudio só da janela capturada — [ADR-0008](./adr/0008-audio-por-janela.md)
- [ ] Link personalizado — [ADR-0009](./adr/0009-link-personalizado.md)
- [x] Ícone do app (`apps/host/build/icon.svg` → `pnpm --filter @luzocast/host icons`)
- [x] Layout responsivo (celular, janela estreita, tablet, desktop largo)

## Correções de 26/10 (tarde)
- [x] Áudio: se o loopback falhar, transmite só vídeo e avisa (antes a transmissão não iniciava)
- [x] Alerta sonoro nunca derruba o pedido de entrada em PC sem som
- [x] P2P: timeout de 15 s + modo retransmissão pelo túnel; viewer mostra "Tentando outra rota…"

## Fase 2 — Internet
- [ ] `CloudflareQuickTunnelProvider` + `TunnelSupervisor` integrados
- [ ] Link com token no fragment, copiar/compartilhar
- [ ] Expulsar, revogar link, encerrar
- [ ] Modo "Somente rede local" com regra de firewall (perfil Privado)

## Fase 3 — Escala e qualidade
- [ ] `AdaptiveQualityStrategy` ligada ao número de viewers e upload medido
- [ ] Transporte MSE (encode único + fan-out) acima de N viewers
- [x] Fallback automático quando ICE falha (modo retransmissão pelo túnel)
- [ ] Microfone como trilha opcional

## Fase 4 — Distribuição
- [ ] Instalador assinado (code signing)
- [ ] Auto-update (app + cloudflared com verificação de hash)
- [ ] Testes de carga e hardening
- [ ] Revisar termos de uso do quick tunnel para vídeo contínuo

## Riscos abertos
- Termos da Cloudflare para quick tunnel (o `TunnelProvider` permite trocar).
- Custo do certificado de code signing.
- Limite de CPU com muitos encoders WebRTC simultâneos.
