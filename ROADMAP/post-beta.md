# PathGuard — Roadmap Post-Beta

Què ve després de la beta `v2.7.0-beta.1`?

## Categoria 1 — Internacionalització (P2)

| Espec | Títol | Owner |
|---|---|---|
| SPEC-100 | i18n: CA/ES/EN | Frontend |

Permet obrir a mercats ES/EN. Cookie-based detection + manual override.

## Categoria 2 — Qualitat i tests (P2)

| Espec | Títol | Owner |
|---|---|---|
| SPEC-110 | Tests unitaris natius (XCTest + JUnit) | iOS + Android + QA |

Cobertura > 70% als plugins natius. Detectar regressions abans de field tests.

## Categoria 3 — Escalat i operacions (P2)

| Espec | Títol | Owner |
|---|---|---|
| SPEC-120 | WebSocket presence via Redis | Backend + DevOps |

Permet múltiples workers a Render. Resiliència millorada.

## Categoria 4 — Millores UX (P2)

TBD després de feedback de beta. Possibles:

- Predicció de ruta (ML)
- Geofencing (avisar quan surt d'una zona)
- Notificacions push natives
- Widget Android/iOS
- Compartir ubicació amb enllaç temporal

## Categoria 5 — Plataforma (P3+)

- iPad layout natiu
- Apple Watch / Wear OS
- Android Auto / CarPlay
- Integració amb Siri / Google Assistant

## Categoria 6 — Seguretat i privacitat (P3+)

- E2E encryption (cap avall)
- Auto-delete walks antics
- Export/import de dades
- GDPR compliance (DPO tools)

## Després de la 3.0.0

- Model de negoci (freemium, subscripció)
- Marketing
- Suport multi-idioma
- Localització a altres països

## Decissions pendents

- Monetització? Subscripció? B2C vs B2B?
- Marca blanca?
- Plataformes addicionals (web standalone sense PWA)?

## Referències

- [`beta-readiness.md`](beta-readiness.md) — Cronograma beta
- [`milestones.md`](milestones.md) — Versions
- [`../specs/000-index.md`](../specs/000-index.md) — Catàleg de specs
