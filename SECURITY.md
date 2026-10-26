# Política de segurança

## Reportando vulnerabilidades

**Não abra issue pública.** Use o recurso
[Report a vulnerability](https://github.com/FredericoTatagiba/luzocast/security/advisories/new)
do GitHub (aba *Security*). Resposta inicial em até 7 dias.

Inclua: versão, passos para reproduzir, impacto esperado.

## Escopo

Interessam especialmente:

- acesso à transmissão sem aprovação do host;
- qualquer forma de um espectador executar ação na máquina do host;
- acesso à porta de controle a partir da rede/túnel;
- vazamento de token ou `hostSecret`.

Modelo de ameaças: [`docs/security.md`](docs/security.md).
