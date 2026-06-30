# PathGuard — Mapa d'Agents i Skills

Aquest índex és el **punt d'entrada** per a qualsevol agent o persona que treballa al projecte. Carrega el skill adequat segons la tasca.

## Carrega SEMPRE primer

| Skill | Motiu | Ubicació |
|---|---|---|
| `pathguard-state` | Saber on som (branca, spec, fase, pickup) | `.pathguard/skills/_core/pathguard-state.md` |
| `pathguard-golden-rules` | Les 10 regles no negociables | `.pathguard/skills/_core/pathguard-golden-rules.md` |
| `pathguard-conventions` | Branques, commits, IDs, idioma | `.pathguard/skills/_core/pathguard-conventions.md` |

## Per rol d'agent

Cada agent té un skill que defineix el seu domini, les zones on NO pot tocar, i els recursos.

| Rol | Agent skill | Skills de domini associats |
|---|---|---|
| **Frontend** | `pathguard-agent-frontend` | `pathguard-frontend-stack` |
| **Backend** | `pathguard-agent-backend` | `pathguard-backend-stack` |
| **Android** | `pathguard-agent-android` | `pathguard-android-plugin` |
| **iOS** | `pathguard-agent-ios` | `pathguard-ios-plugin` |
| **Platform Integration** | `pathguard-agent-platform` | `pathguard-bridge-contract`, `pathguard-capacitor-config` |
| **QA** | `pathguard-agent-qa` | `pathguard-test-pyramid`, `pathguard-field-testing` |
| **DevOps** | `pathguard-agent-devops` | `pathguard-cicd` |
| **Tech Lead** | `pathguard-agent-tech-lead` | (accés a tots els altres) |

Ubicació base: `.pathguard/skills/_agents/`

## Per workflow SDD

| Pas | Skill |
|---|---|
| Crear spec | `pathguard-sdd-create-spec` |
| Revisar spec | `pathguard-sdd-review-spec` |
| Implementar spec | `pathguard-sdd-implement` |
| Validar spec | `pathguard-sdd-validate` |

Ubicació: `.pathguard/skills/_workflow/`

## Per acció concreta

| Acció | Skill |
|---|---|
| Obrir/modificar branca | `pathguard-branching` |
| Fer commit | `pathguard-commit` |

Ubicació: `.pathguard/skills/_workflow/`

## Per àrea de domini

| Àrea | Skill | On aplica |
|---|---|---|
| Frontend stack | `pathguard-frontend-stack` | Next.js, React, Tailwind v4, Leaflet, PWA |
| Backend stack | `pathguard-backend-stack` | FastAPI, SQLAlchemy, Pydantic, dual DB |
| Bridge TS | `pathguard-bridge-contract` | Contracte Capacitor plugin |
| iOS plugin | `pathguard-ios-plugin` | Swift, CLLocationManager, BufferStore |
| Android plugin | `pathguard-android-plugin` | Java, FusedLocationProvider, ForegroundService |
| Capacitor config | `pathguard-capacitor-config` | capacitor.config.ts/json |
| Test pyramid | `pathguard-test-pyramid` | pytest, Vitest, Playwright |
| Field testing | `pathguard-field-testing` | Procediment amb dispositius |
| CI/CD | `pathguard-cicd` | GitHub Actions, secrets, builds |

Ubicació: `.pathguard/skills/_domain/`

## Com usar aquest sistema

### Pas 1: Carrega `pathguard-state` sempre
A l'inici de cada sessió. Sense ell, no s'ha d'escriure codi.

### Pas 2: Identifica el teu rol
Si ets una IA o una persona nova, identifica quin agent ets consultant la columna "Rol".

### Pas 3: Carrega el skill del teu agent
Llegeix `.pathguard/skills/_agents/pathguard-agent-<rol>.md`.

### Pas 4: Carrega els skills de domini
Segons la tasca concreta, llegeix els skills de domini aplicables.

### Pas 5: Si és tasca SDD, carrega el skill de workflow
- Estic creant una spec → `pathguard-sdd-create-spec`
- Estic revisant → `pathguard-sdd-review-spec`
- Estic implementant → `pathguard-sdd-implement`
- Estic validant → `pathguard-sdd-validate`

## Convencions dels skills

- **Ubicació:** `.pathguard/skills/<categoria>/<nom>.md`
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

1. Carrega `pathguard-state` (saber on som)
2. Carrega `pathguard-sdd-create-spec` (workflow)
3. Carrega `pathguard-agent-tech-lead` (revisarà la spec)
4. Carrega `pathguard-agent-backend` (si la spec toca backend)
5. Carrega `pathguard-agent-frontend` (si la spec toca frontend)
6. Carrega `pathguard-bridge-contract` (si toca el bridge TS)

## Exemple de validació

```
la spec SPEC-020 ja està implementada, validar
```

1. Carrega `pathguard-state`
2. Carrega `pathguard-sdd-validate` (workflow)
3. Carrega `pathguard-agent-qa` (qui valida)
4. Carrega `pathguard-test-pyramid` (per verificar tests)
5. Carrega `pathguard-field-testing` (si cal validació de camp)
6. Carrega el skill de l'agent owner (per entendre el context)

## Manteniment d'aquest índex

Quan s'afegeix un nou skill:

1. Crear el fitxer `.pathguard/skills/<categoria>/<nom>.md`
2. Afegir l'entrada a aquest INDEX
3. Notificar al Tech Lead per revisió
