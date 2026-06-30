# AGENTS — Instruccions globals per a agents opencode a PathGuard

Aquest fitxer és la **primera lectura obligatòria** per a qualsevol agent opencode que treballi al projecte. Complementa (no substitueix) `CONTEXT.md`.

---

## Primera acció de cada sessió

Invocar **abans de qualsevol altra cosa**, com a primera crida de tool:

```
skill({ name: "pathguard-state" })
```

Aquest skill llegeix `.pathguard/STATE.json` i retorna:

- Branca actual
- Fase del projecte
- Spec activa (`SPEC-NNN`) i el seu estat
- Agent actiu (quin dels 8 rols)
- Pròxim pas concret
- Bloquejos
- Pickup-point per continuar la propera sessió

**No escriure codi, obrir branques ni fer commits** sense haver carregat aquest skill.

---

## Com es resolen els skills

Tots els 26 skills de PathGuard viuen a `.opencode/skills/<nom>/SKILL.md` i són **symlinks** cap a `.pathguard/skills/<categoria>/<nom>.md`. La font única de veritat és `.pathguard/skills/`.

| Categoria | Ubicació font | Què conté |
|---|---|---|
| `_core` | `.pathguard/skills/_core/` | `pathguard-state`, `pathguard-golden-rules`, `pathguard-conventions` |
| `_agents` | `.pathguard/skills/_agents/` | 8 skills de rol (frontend, backend, android, ios, platform, qa, devops, tech-lead) |
| `_domain` | `.pathguard/skills/_domain/` | 9 skills de domini (stacks, plugins, CI/CD, testing) |
| `_workflow` | `.pathguard/skills/_workflow/` | 6 skills de workflow (SDD, branching, commit) |

Mapeig complet amb descripcions i prerequisits: `agents/INDEX.md`.

---

## Convencions d'ús dels skills

1. **Carrega `pathguard-state` SEMPRE primer.**
2. **Carrega `pathguard-golden-rules` i `pathguard-conventions`** abans d'escriure codi o obrir branques.
3. **Carrega el skill del teu rol** (`pathguard-agent-<rol>`) quan la tasca afecta el teu domini.
4. **Carrega skills de domini** segons la zona tocada (ex: `pathguard-ios-plugin` si toques Swift/CLLocationManager).
5. **Carrega skills de workflow** quan iniciïs un cicle SDD (`pathguard-sdd-create-spec`, etc.).
6. **No carreguis `customize-opencode`** — és un skill built-in d'opencode per configurar la pròpia eina, no per treballar al projecte.

---

## Regles d'or (resum; detall a `pathguard-golden-rules`)

1. SOLID + CleanCode + SRP
2. Zero `fetch()` en components — tot via `services/`
3. No `any` en TypeScript
4. No `console.log` en producció — usa `logger`
5. No mutable state a nivell de mòdul
6. No `tailwind.config.js` — tokens a `globals.css/@theme`
7. No hex hardcoded — usa tokens semàntics
8. No URLs hardcoded — env vars
9. No magic — tot explícit
10. Si la solució sembla un hack, està rebutjada

---

## Idioma

- **Codi** (identificadors, comentaris): anglès
- **UI strings (català)**: hardcoded actualment, i18n post-beta
- **Documentació interna** (specs, ADRs, aquest fitxer): anglès permès, català acceptable
- **Comunicació amb l'usuari** (errors, missatges al xat): català
- **Branques i commits**: anglès

---

## Estructura del projecte (resum)

| Capa | Path | Propietari |
|---|---|---|
| Backend | `backend/` | Agent Backend |
| Frontend PWA | `frontend/app/`, `components/`, `hooks/`, `services/`, `lib/` | Agent Frontend |
| Plugin Android | `frontend/plugins/location-sync/android/` + `frontend/android/` | Agent Android |
| Plugin iOS | `frontend/plugins/location-sync/ios/` + `frontend/ios/` | Agent iOS |
| Bridge TS | `frontend/plugins/location-sync/src/index.ts` | Agent Platform Integration |
| Capacitor config | `frontend/capacitor.config.ts` | Agent Platform Integration |
| Specs | `specs/` | Tech Lead |
| ADRs | `docs/decisions/` | Tech Lead |
| Skills (font) | `.pathguard/skills/` | Tech Lead |
| Skills (índex opencode) | `.opencode/skills/` | Tech Lead |

---

## Tests baseline (no regressió)

| Capa | Baseline | Excepcions |
|---|---|---|
| Backend | 152/152 | 10 WS timing preexistents (ignorar) |
| Frontend | 108/108 | 6 skipped preexistents (ignorar) |
| Android | 0/0 | Deute tècnic (SPEC-120) |
| iOS | 0/0 | Deute tècnic (SPEC-120) |

---

## Referència ràpida

- Estat del projecte: `.pathguard/STATE.json` (llegit pel skill `pathguard-state`)
- Mapa d'agents i skills: `agents/INDEX.md`
- Catàleg de specs: `specs/000-index.md`
- Índex de documentació: `docs/INDEX.md`
- Fase actual: `docs/phases/phase-status.md`
- ADRs: `docs/decisions/`
- Roadmap beta: `ROADMAP/beta-readiness.md`
