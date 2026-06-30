# PathGuard — Mapa d'Agents i Skills

Aquest índex és el **punt d'entrada** per a qualsevol agent o persona que treballa al projecte. Carrega el skill adequat segons la tasca.

## Carrega SEMPRE primer

| Skill | Motiu | Ubicació |
|---|---|---|
| `pathguard-core-state` | Saber on som (branca, spec, fase, pickup) | `.opencode/skills/pathguard-core-state/SKILL.md` |
| `pathguard-core-golden-rules` | Les 10 regles no negociables | `.opencode/skills/pathguard-core-golden-rules/SKILL.md` |
| `pathguard-core-conventions` | Branques, commits, IDs, idioma | `.opencode/skills/pathguard-core-conventions/SKILL.md` |

## Per rol d'agent

Cada agent té un skill que defineix el seu domini, les zones on NO pot tocar, i els recursos.

| Rol | Agent skill | Skills de domini associats |
|---|---|---|
| **Frontend** | `pathguard-agent-frontend` | `pathguard-domain-frontend-stack` |
| **Backend** | `pathguard-agent-backend` | `pathguard-domain-backend-stack` |
| **Android** | `pathguard-agent-android` | `pathguard-domain-android-plugin` |
| **iOS** | `pathguard-agent-ios` | `pathguard-domain-ios-plugin` |
| **Platform Integration** | `pathguard-agent-platform` | `pathguard-domain-bridge-contract`, `pathguard-domain-capacitor-config` |
| **QA** | `pathguard-agent-qa` | `pathguard-domain-test-pyramid`, `pathguard-domain-field-testing` |
| **DevOps** | `pathguard-agent-devops` | `pathguard-domain-cicd` |
| **Tech Lead** | `pathguard-agent-tech-lead` | (accés a tots els altres) |

Ubicació base: `.opencode/skills/_agents/`

## Per workflow SDD

| Pas | Skill |
|---|---|
| Crear spec | `pathguard-workflow-sdd-create-spec` |
| Revisar spec | `pathguard-workflow-sdd-review-spec` |
| Implementar spec | `pathguard-workflow-sdd-implement` |
| Validar spec | `pathguard-workflow-sdd-validate` |

Ubicació: `.opencode/skills/_workflow/`

## Per acció concreta

| Acció | Skill |
|---|---|
| Obrir/modificar branca | `pathguard-workflow-branching` |
| Fer commit | `pathguard-workflow-commit` |

Ubicació: `.opencode/skills/_workflow/`

## Per àrea de domini

| Àrea | Skill | On aplica |
|---|---|---|
| Frontend stack | `pathguard-domain-frontend-stack` | Next.js, React, Tailwind v4, Leaflet, PWA |
| Backend stack | `pathguard-domain-backend-stack` | FastAPI, SQLAlchemy, Pydantic, dual DB |
| Bridge TS | `pathguard-domain-bridge-contract` | Contracte Capacitor plugin |
| iOS plugin | `pathguard-domain-ios-plugin` | Swift, CLLocationManager, BufferStore |
| Android plugin | `pathguard-domain-android-plugin` | Java, FusedLocationProvider, ForegroundService |
| Capacitor config | `pathguard-domain-capacitor-config` | capacitor.config.ts/json |
| Test pyramid | `pathguard-domain-test-pyramid` | pytest, Vitest, Playwright |
| Field testing | `pathguard-domain-field-testing` | Procediment amb dispositius |
| CI/CD | `pathguard-domain-cicd` | GitHub Actions, secrets, builds |

Ubicació: `.opencode/skills/_domain/`

## Com usar aquest sistema

### Pas 1: Carrega `pathguard-core-state` sempre
A l'inici de cada sessió. Sense ell, no s'ha d'escriure codi.

### Pas 2: Identifica el teu rol
Si ets una IA o una persona nova, identifica quin agent ets consultant la columna "Rol".

### Pas 3: Carrega el skill del teu agent
Llegeix `.opencode/skills/_agents/pathguard-agent-<rol>.md`.

### Pas 4: Carrega els skills de domini
Segons la tasca concreta, llegeix els skills de domini aplicables.

### Pas 5: Si és tasca SDD, carrega el skill de workflow
- Estic creant una spec → `pathguard-workflow-sdd-create-spec`
- Estic revisant → `pathguard-workflow-sdd-review-spec`
- Estic implementant → `pathguard-workflow-sdd-implement`
- Estic validant → `pathguard-workflow-sdd-validate`

## Convencions dels skills

- **Ubicació:** `.opencode/skills/<categoria>/<nom>.md`
- **Format:** Markdown amb frontmatter YAML
- **Camps del frontmatter:**
  - `name` — identificador únic
  - `description` — què fa i quan carregar (1-2 frases)
  - `triggers` — llista de situacions que activen el skill
  - `agent_owner` — qui el pot carregar (`*` per tots)
  - `prerequisites` — altres skills que cal tenir carregats

## Exemple d'invocació

```
vull afegir una nova funcionalitat X que toca backend i frontend
```

1. Carrega `pathguard-core-state` (saber on som)
2. Carrega `pathguard-workflow-sdd-create-spec` (workflow)
3. Carrega `pathguard-agent-tech-lead` (revisarà la spec)
4. Carrega `pathguard-agent-backend` (si la spec toca backend)
5. Carrega `pathguard-agent-frontend` (si la spec toca frontend)
6. Carrega `pathguard-domain-bridge-contract` (si toca el bridge TS)

## Exemple de validació

```
la spec SPEC-020 ja està implementada, validar
```

1. Carrega `pathguard-core-state`
2. Carrega `pathguard-workflow-sdd-validate` (workflow)
3. Carrega `pathguard-agent-qa` (qui valida)
4. Carrega `pathguard-domain-test-pyramid` (per verificar tests)
5. Carrega `pathguard-domain-field-testing` (si cal validació de camp)
6. Carrega el skill de l'agent owner (per entendre el context)

## Manteniment d'aquest índex

Quan s'afegeix un nou skill:

1. Crear el fitxer `.opencode/skills/<categoria>/<nom>.md`
2. Afegir l'entrada a aquest INDEX
3. Notificar al Tech Lead per revisió
