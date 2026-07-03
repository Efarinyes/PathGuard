---
name: pathguard-core-conventions
description: |
  Convencions operatives del projecte: branques, commits, IDs,
  idioma, semver. Carregar quan s'inicia qualsevol tasca que
  toqui el sistema de control de versions o la nomenclatura.
metadata:
  triggers:
    - Obrir/modificar una branca
    - Fer commit
    - Crear spec / ADR
    - Crear tag / release
  agent_owner: "*"
  prerequisites: []
---

# PathGuard — Convencions

## Branques

Model: `main` (producció) ← `develop` (integració) ← `feat/*` o `fix/*` (treball)

| Prefix | Ús |
|---|---|
| `feat/` | Nova funcionalitat |
| `fix/` | Correcció de bug |
| `refactor/` | Refactorització sense canvi funcional |
| `docs/` | Només documentació |
| `release/` | Branca de release (snapshot) |
| `safety/` | Experiment d'alt risc (rara) |

**Regla:** mai no commitejar directament a `main` o `develop`. Sempre branca de treball + PR.

**Excepció:** només l'usuari pot decidir commit directe a `main` (per deploys Vercel).

## Commits

Estil: **Conventional Commits**

| Prefix | Ús |
|---|---|
| `feat:` | Nova funcionalitat |
| `fix:` | Correcció de bug |
| `refactor:` | Canvi intern sense funcionalitat nova |
| `docs:` | Només documentació |
| `test:` | Tests sense canvi de producció |
| `chore:` | Manteniment (deps, build) |
| `style:` | Format (sense canvi lògic) |

**Focus al "why", no al "what".**

Exemple bo: `fix: prevent GPS point loss when flush fails on iOS`
Exemple dolent: `fix: changed onFlushResult`

## Specs

Format: `<type>-SPEC-NNN-kebab-case-titol.md`

- `<type>` ∈ {`feature`, `tech`, `integration`}
- `NNN` és un nombre de 3 dígits correlatiu
- Títol en kebab-case

Ubicació: `specs/`

Catàleg: `specs/000-index.md` (sempre actualitzat)

Estats: `draft` → `review` → `approved` → `implementing` → `validated` → `archived`

## ADRs (Architecture Decision Records)

Format: `NNNN-kebab-case-titol.md`

- `NNNN` és un nombre de 4 dígits correlatiu (comença a 0001)
- Títol en kebab-case

Ubicació: `docs/decisions/`

Cada ADR ha de tenir:
1. **Context** — quina situació motiva la decisió
2. **Decision** — què hem decidit
3. **Consequences** — què implica (positiu i negatiu)
4. **Status** — proposat | acceptat | deprecated | superseded

## Tags i releases

- Semver: `vMAJOR.MINOR.PATCH[-PRERELEASE]`
- `MAJOR` — canvis incompatibles
- `MINOR` — nova funcionalitat compatible
- `PATCH` — correccions
- `PRERELEASE` — `beta.N`, `rc.N`

Cada milestone → tag + GitHub Release amb CHANGELOG.

## Idioma

- **Codi** (identificadors, comentaris): anglès
- **UI strings (català)**: hardcoded actualment, i18n post-beta
- **Documentació interna** (CONTEXT.md, specs/, ADRs): anglès
- **Comunicació amb l'usuari** (missatges d'error, README): català
- **Branca i commits**: anglès
- **Specs i ADRs**: anglès

## Skills (aquest sistema)

- Format: `<scope>-<name>.md` amb frontmatter YAML
- Ubicació: `.opencode/skills/`
- `state.example.json` commited; `STATE.json` gitignored
- Cada skill té: `name`, `description`, `triggers`, `agent_owner`, `prerequisites`

## Arxivat

Quan un document ja no és operatiu:
- Mou a `docs/archive/`
- Afegeix capçalera: `<!-- ARXIVAT: substituït per X -->`
- Mantén l'enllaç a l'`INDEX.md` però marcat com a històric

## Tests com a gate

- Backend: 152/152 (10 WS timing preexistents — ignorar)
- Frontend: 108/108 (6 skipped preexistents — ignorar)
- **Cap regressió tolerada**
- Abans de PR: tests verds + build OK

## Verificació manual quan aplica

- Walk real al dispositiu
- 2 dispositius (pacient + cuidador)
- Mode avió, background, kill app

Mínim: 1 passeig de 15 min amb captura GPS correcta.
