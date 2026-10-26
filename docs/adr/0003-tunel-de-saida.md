# ADR-0003: Exposição pública por túnel de saída

- **Status:** Aceito
- **Data:** 2026-10-26

## Contexto
Os viewers podem estar fora da rede do host. No Brasil, CGNAT é comum em banda larga e
universal em 4G/5G, então abrir porta no roteador (UPnP/port forwarding) falha com frequência
e ainda expõe a máquina.

## Decisão
O host faz uma conexão **de saída** com um provedor de túnel que devolve uma URL HTTPS
pública. Implementação padrão: Cloudflare quick tunnel (`cloudflared`), sem conta.
O provedor é uma **Strategy** (`TunnelProvider`), supervisionada por `TunnelSupervisor`.

## Alternativas consideradas
- **UPnP/NAT-PMP** — falha com CGNAT; expõe porta. Rejeitado.
- **Servidor de sinalização próprio na nuvem** — contraria o requisito de não haver servidor
  externo do projeto. Pode virar um `TunnelProvider` pago no futuro (modelo de negócio).
- **ngrok** — exige conta/token; fica como provider alternativo.

## Consequências
- + Funciona com CGNAT, sem abrir portas, com HTTPS válido de graça.
- − Dependência de terceiro sem SLA; URL muda a cada sessão.
- − Termos de uso para vídeo contínuo precisam ser verificados (risco no roadmap). Como a
  mídia WebRTC normalmente não passa pelo túnel, o volume nele é pequeno.
