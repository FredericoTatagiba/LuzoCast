# ADR-0002: Servidor local com portas de controle e pública

- **Status:** Aceito
- **Data:** 2026-10-26

## Contexto
O servidor roda na máquina do host. O renderer (onde vive o WebRTC) precisa conversar com
ele, e os viewers também. Se tudo ficar em uma porta só e essa porta for tunelada, o
endpoint de controle do host fica alcançável pela internet, protegido apenas por um segredo.

## Decisão
Dois servidores HTTP no mesmo processo:
- **Porta de controle** — `127.0.0.1` sempre, endpoint `/ws/host`, autenticado por
  `hostSecret` (256 bits). **Nunca** é exposta pelo túnel.
- **Porta pública** — serve a página do viewer e `/ws/viewer`. Bind em `127.0.0.1` no modo
  Internet (só o túnel alcança) ou no IP da LAN no modo "Somente rede local".

Ambas usam porta efêmera (`0`) escolhida pelo SO.

## Alternativas consideradas
- **Uma porta + segredo** — mais simples, mas a superfície de ataque inclui o canal de
  controle. Rejeitado.
- **IPC do Electron no lugar da porta de controle** — remove a porta, porém duplica o
  protocolo (WS para viewer, IPC para host). Pode ser revisitado depois sem quebrar o
  domínio, já que o hub é o Mediator.

## Consequências
- + Isolamento físico entre o que a internet vê e o que controla o host.
- + O mesmo protocolo tipado nos dois canais.
- − Duas portas para gerenciar (trivial com porta efêmera).
