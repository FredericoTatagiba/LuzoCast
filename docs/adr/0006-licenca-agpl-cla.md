# ADR-0006: AGPL-3.0 + CLA

- **Status:** Aceito
- **Data:** 2026-10-26

## Contexto
O projeto nasce open source, com possibilidade de monetização futura (relay pago,
recursos Pro, licença comercial).

## Decisão
Licença **AGPL-3.0-only** e **CLA** obrigatório para contribuições externas (via CLA
Assistant), mantendo o direito do mantenedor de oferecer licença dupla. O nome "LuzoCast"
é protegido separadamente (`TRADEMARK.md`).

## Alternativas consideradas
- **MIT** — máxima adoção, mas permite que terceiros fechem e vendam o código.
- **GPL-3.0** — não cobre uso via rede (relay como serviço).
- **BSL/FSL** — não é open source (OSI); afasta contribuidores.

## Consequências
- + Protege os caminhos de negócio e permite licença comercial.
- − Algumas empresas evitam AGPL.
- − CLA adiciona um passo para contribuidores.
- Dependências devem ser compatíveis com AGPL (MIT, BSD, Apache-2.0 são).
