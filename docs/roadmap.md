# Roadmap

## Fase 1 — Núcleo na LAN  ← *em andamento*
- [x] Monorepo, documentação, ADRs
- [x] Domínio (sessão/viewers), protocolo, segurança base
- [ ] Captura de tela + áudio loopback (Electron, Windows)
- [ ] Servidor local (duas portas) + viewer servindo pela LAN
- [ ] WebRTC host → viewer com aprovação na sala de espera

## Fase 2 — Internet
- [ ] `CloudflareQuickTunnelProvider` + `TunnelSupervisor` integrados
- [ ] Link com token no fragment, copiar/compartilhar
- [ ] Expulsar, revogar link, encerrar
- [ ] Modo "Somente rede local" com regra de firewall (perfil Privado)

## Fase 3 — Escala e qualidade
- [ ] `AdaptiveQualityStrategy` ligada ao número de viewers e upload medido
- [ ] Transporte MSE (encode único + fan-out) acima de N viewers
- [ ] Fallback automático quando ICE falha
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
