# PathGuard — Documentació

Aquest és l'**ÍNDEX** de tota la documentació del projecte. Si ets una IA o una persona nova, comença aquí.

## Història del projecte

| Document | Què hi ha |
|---|---|
| [`EVOLUTION.md`](EVOLUTION.md) | Cronologia narrativa: concepció → PWA → natiu → GPS de camp → `is_recovered` → avui |

## Estructura

| Carpella | Què hi ha |
|---|---|
| [`architecture/`](architecture/) | Visió general (`overview.md`) |
| [`decisions/`](decisions/) | Architecture Decision Records (ADRs) |
| [`guides/`](guides/) | Guies pràctiques (setup, deploy, IDEs, camp) |
| [`phases/`](phases/) | Resum de fase (punter; dia a dia → `STATE.json`) |
| [`field-tests/`](field-tests/) | Plantilla + reports de proves de camp |
| [`governance/`](governance/) | Rols, orquestració, auditoria, migració OpenCode |
| [`archive/`](archive/) | Documents antics (només lectura) |

### Guies ràpides

| Guia | Contingut |
|---|---|
| [`guides/getting-started.md`](guides/getting-started.md) | Setup local backend/frontend |
| [`guides/native-ide-setup.md`](guides/native-ide-setup.md) | Xcode + Android Studio |
| [`guides/deployment.md`](guides/deployment.md) | Deploy |
| [`guides/real-world-testing.md`](guides/real-world-testing.md) | Proves de camp (punter al skill) |

## Porta d'entrada per a IA / nous agents

1. [`../CONTEXT.md`](../CONTEXT.md) — Golden rules + manifest
2. [`../agents/INDEX.md`](../agents/INDEX.md) — Mapa d'agents i skills
3. [`../specs/000-index.md`](../specs/000-index.md) — Catàleg de specs
4. Llegeix `.cursor/skills/pathguard-core-state/SKILL.md` (saber on som)
5. [`EVOLUTION.md`](EVOLUTION.md) — context històric si cal

## Porta d'entrada per a persones noves

1. [`../README.md`](../README.md) — Visió general
2. [`guides/getting-started.md`](guides/getting-started.md) — Setup local
3. [`guides/native-ide-setup.md`](guides/native-ide-setup.md) — Xcode / Android Studio (si cal natiu)
4. [`architecture/overview.md`](architecture/overview.md) — Com funciona

## Històric (només lectura)

Tot el que és antic viu a [`archive/`](archive/) amb capçalera `ARXIVAT`. **No editar.** Si cal actualitzar, crea un document nou fora d’`archive/`.

Assets històrics (p. ex. captures): [`archive/assets/`](archive/assets/).

## Manteniment

Aquest índex ha de mantenir-se sincronitzat amb l'estructura real. Si mous o crees documents, actualitza'l.
