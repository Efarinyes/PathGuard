# AGENTS — Instruccions globals per a agents opencode a PathGuard

Aquest fitxer és el **punt d'entrada obligatori** per a qualsevol agent opencode que treballi sobre aquest repositori. Complementa (no substitueix) `CONTEXT.md` i la resta de la documentació de governança.

---

## Inicialització obligatòria dels agents

Abans d'iniciar qualsevol tasca, qualsevol agent (independentment del model utilitzat) ha de seguir aquest procés.

### Ordre de lectura

1. `.opencode/governance/ARCHITECT.md`
2. `.opencode/governance/MODEL_ROLES.md`
3. `.opencode/governance/ORCHESTRATOR.md`
4. `CONTEXT.md`
5. La SPEC relacionada amb la tasca
6. La documentació tècnica relacionada

### Procés obligatori

Abans de començar qualsevol implementació l'agent ha de:

- comprendre el context
- identificar els skills implicats
- reutilitzar abans de crear
- verificar si existeix una SPEC
- crear o ampliar la SPEC si és necessari
- planificar les tasques
- decidir la seqüència d'execució
- validar els resultats abans de considerar la tasca finalitzada

Cap implementació hauria de començar sense haver completat aquest procés.

---

## Primera acció de cada sessió

Un cop completada la inicialització, la primera crida de tool ha de ser:

```
skill({ name: "pathguard-core-state" })
```

Aquest skill llegeix `.pathguard/STATE.json` i retorna:

- Branca actual
- Fase del projecte
- Spec activa (`SPEC-NNN`) i el seu estat
- Agent actiu (quin dels 8 rols)
- Pròxim pas concret
- Bloquejos
- Pickup-point per continuar la propera sessió

**No escriure codi, obrir branques ni fer commits** sense haver carregat aquest skill i validat l'estat.

---

## Skills

Els skills disponibles es troben a:

```
.opencode/skills/
```

L'orquestrador és responsable d'identificar quin o quins skills són els adequats per a cada tasca.

No s'han d'invocar skills sense haver analitzat prèviament el context i les especificacions.

Els 20 skills actius de PathGuard viuen a `.opencode/skills/<nom>/SKILL.md` com a fitxers plans (un directori per skill, format natiu opencode). Cap symlink, cap duplicació. La categoria es dedueix pel prefix del nom: `pathguard-core-*` (3), `pathguard-agent-*` (8), `pathguard-domain-*` (3), `pathguard-workflow-*` (6).

| Categoria | Prefix al nom | Què conté |
|---|---|---|
| `core` | `pathguard-core-*` | 3 skills: `pathguard-core-state`, `pathguard-core-golden-rules`, `pathguard-core-conventions` |
| `agent` | `pathguard-agent-*` | 8 skills de rol: frontend, backend, android, ios, platform, qa, devops, tech-lead (els skills d'agent frontend/backend/android/ios/qa/devops integren també el domini de stack/plugin/CI/testing) |
| `domain` | `pathguard-domain-*` | 3 skills de domini pur: bridge-contract, capacitor-config, field-testing |
| `workflow` | `pathguard-workflow-*` | 6 skills de workflow: SDD, branching, commit |

Mapeig complet amb descripcions i prerequisits: `agents/INDEX.md`.

---

## Convencions d'ús dels skills

1. **Carrega `pathguard-core-state` SEMPRE primer.**
2. **Carrega `pathguard-core-golden-rules` i `pathguard-core-conventions`** abans d'escriure codi o obrir branques.
3. **Carrega el skill del teu rol** (`pathguard-agent-<rol>`) quan la tasca afecta el teu domini.
4. **Carrega skills de domini** segons la zona tocada (ex: `pathguard-agent-ios` si toques Swift/CLLocationManager, o `pathguard-domain-bridge-contract` si toques el bridge TS).
5. **Carrega skills de workflow** quan iniciïs un cicle SDD (`pathguard-workflow-sdd-create-spec`, etc.).
6. **No carreguis `customize-opencode`** — és un skill built-in d'opencode per configurar la pròpia eina, no per treballar al projecte.

---

## Regles d'or (resum; detall a `pathguard-core-golden-rules`)

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
| Skills | `.opencode/skills/` | Tech Lead |

---

## Tests baseline (no regressió)

| Capa | Baseline | Excepcions |
|---|---|---|
| Backend | 152/152 | 10 WS timing preexistents (ignorar) |
| Frontend | 108/108 | 6 skipped preexistents (ignorar) |
| Android | 0/0 | Deute tècnic (SPEC-120) |
| iOS | 0/0 | Deute tècnic (SPEC-120) |

---

## Idioma

- **Codi** (identificadors, comentaris): anglès
- **UI strings (català)**: hardcoded actualment, i18n post-beta
- **Documentació interna** (specs, ADRs, aquest fitxer): anglès permès, català acceptable
- **Comunicació amb l'usuari** (errors, missatges al xat): català
- **Branques i commits**: anglès

---

## Referència ràpida

- Estat del projecte: `.pathguard/STATE.json` (llegit pel skill `pathguard-core-state`)
- Mapa d'agents i skills: `agents/INDEX.md`
- Catàleg de specs: `specs/000-index.md`
- Índex de documentació: `docs/INDEX.md`
- Fase actual: `docs/phases/phase-status.md`
- ADRs: `docs/decisions/`
- Roadmap beta: `ROADMAP/beta-readiness.md`
- Governança del projecte: `.opencode/governance/`
