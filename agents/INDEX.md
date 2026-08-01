# PathGuard — Mapa d'Agents i Skills

Aquest índex és el **punt d'entrada** per a qualsevol agent o persona que treballa al projecte. Carrega el skill adequat segons la tasca.

> Skills ubicats a `.cursor/skills/<nom>/SKILL.md`

## Carrega SEMPRE primer

| Skill | Motiu | Ubicació |
|---|---|---|
| `pathguard-core-state` | Saber on som (branca, spec, fase, pickup) | `.cursor/skills/pathguard-core-state/SKILL.md` |
| `pathguard-core-golden-rules` | Les 10 regles no negociables | `.cursor/skills/pathguard-core-golden-rules/SKILL.md` |
| `pathguard-core-conventions` | Branques, commits, IDs, idioma | `.cursor/skills/pathguard-core-conventions/SKILL.md` |

## Per rol d'agent

| Rol | Agent skill | Skills de domini associats |
|---|---|---|
| **Frontend** | `pathguard-agent-frontend` | (skill fusionat: rol + stack) |
| **Backend** | `pathguard-agent-backend` | (skill fusionat: rol + stack) |
| **Android** | `pathguard-agent-android` | (skill fusionat: rol + plugin) |
| **iOS** | `pathguard-agent-ios` | (skill fusionat: rol + plugin) |
| **Platform Integration** | `pathguard-agent-platform` | `pathguard-domain-bridge-contract`, `pathguard-domain-capacitor-config` |
| **QA** | `pathguard-agent-qa` | `pathguard-domain-field-testing` |
| **DevOps** | `pathguard-agent-devops` | (skill fusionat: rol + CI/CD) |
| **Tech Lead** | `pathguard-agent-tech-lead` | (accés a tots els altres) |

Ubicació base: `.cursor/skills/`

## Per workflow SDD

| Pas | Skill |
|---|---|
| Crear spec | `pathguard-workflow-sdd-create-spec` |
| Revisar spec | `pathguard-workflow-sdd-review-spec` |
| Implementar spec | `pathguard-workflow-sdd-implement` |
| Validar spec | `pathguard-workflow-sdd-validate` |
| **Tancar sessió** | `pathguard-workflow-session-close` |

## Per acció concreta

| Acció | Skill |
|---|---|
| Obrir/modificar branca | `pathguard-workflow-branching` |
| Fer commit | `pathguard-workflow-commit` |
| **Tancar sessió / actualitzar STATE** | `pathguard-workflow-session-close` |

## Per àrea de domini

| Àrea | Skill | On aplica |
|---|---|---|
| Bridge TS | `pathguard-domain-bridge-contract` | Contracte Capacitor plugin |
| Capacitor config | `pathguard-domain-capacitor-config` | capacitor.config.ts/json |
| Field testing | `pathguard-domain-field-testing` | Procediment amb dispositius |

## Com usar aquest sistema (Cursor)

### Pas 1: Bootstrap
La rule `.cursor/rules/pathguard-bootstrap.mdc` s'aplica sempre. Llegeix `.pathguard/STATE.json` abans de canvis.

### Pas 2: Identifica el teu rol
Consulta la columna "Rol" i llegeix el skill corresponent.

### Pas 3: Rules per glob
Quan edites fitxers d'un domini, Cursor carrega la rule associada (frontend, backend, android, ios, platform).

### Pas 4: Workflows SDD
Carrega explícitament el skill de workflow quan creïs, revisis, implementis o validis specs.

## Convencions dels skills

- **Ubicació:** `.cursor/skills/<nom>/SKILL.md`
- **Format:** Markdown amb frontmatter YAML (`name`, `description`)
- **Workflows:** `disable-model-invocation: true` — carregar explícitament

## Afegir un skill nou

1. Crear `.cursor/skills/<nom>/SKILL.md` amb frontmatter Cursor
2. Actualitzar aquest índex
3. Si cal, afegir rule a `.cursor/rules/` amb globs adequats

## Històric

La configuració OpenCode original (`.opencode/skills/`, `.opencode/governance/`) es conserva a la branca `archive/opencode-governance-2026-07-30`.
