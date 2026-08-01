# AGENTS — Instruccions globals per a agents Cursor a PathGuard

Aquest fitxer és el **punt d'entrada obligatori** per a qualsevol agent que treballi sobre aquest repositori. Complementa (no substitueix) `CONTEXT.md` i la resta de la documentació de governança.

> **Històric OpenCode:** la configuració anterior (`.opencode/`) es conserva a la branca `archive/opencode-governance-2026-07-30`.

---

## Inicialització obligatòria dels agents

Abans d'iniciar qualsevol tasca, qualsevol agent ha de seguir aquest procés.

### Ordre de lectura

1. `docs/governance/ARCHITECT.md`
2. `docs/governance/MODEL_ROLES.md`
3. `docs/governance/ORCHESTRATOR.md`
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

Un cop completada la inicialització:

1. Llegeix `.pathguard/STATE.json`
2. Llegeix `.cursor/skills/pathguard-core-state/SKILL.md`
3. Valida la branca amb `git branch --show-current`

Retorna:

- Branca actual
- Fase del projecte
- Spec activa (`SPEC-NNN`) i el seu estat
- Agent actiu (quin dels 8 rols)
- Pròxim pas concret
- Bloquejos
- Pickup-point per continuar la propera sessió

**No escriure codi, obrir branques ni fer commits** sense haver carregat l'estat i validat el context.

---

## Skills

Els skills disponibles es troben a:

```
.cursor/skills/
```

Les rules de Cursor a `.cursor/rules/` activen automàticament el context per zona de fitxers. L'agent ha de llegir el skill complet quan treballi en aquell domini.

| Categoria | Prefix al nom | Què conté |
|---|---|---|
| `core` | `pathguard-core-*` | 3 skills: state, golden-rules, conventions |
| `agent` | `pathguard-agent-*` | 8 skills de rol |
| `domain` | `pathguard-domain-*` | 3 skills: bridge-contract, capacitor-config, field-testing |
| `workflow` | `pathguard-workflow-*` | 7 skills: SDD, branching, commit, **session-close** |

Mapeig complet: `agents/INDEX.md`.

---

## Convencions d'ús dels skills

1. **Carrega `pathguard-core-state` SEMPRE primer.**
2. **Carrega `pathguard-core-golden-rules` i `pathguard-core-conventions`** abans d'escriure codi o obrir branques.
3. **Carrega el skill del teu rol** (`pathguard-agent-<rol>`) quan la tasca afecta el teu domini.
4. **Carrega skills de domini** segons la zona tocada.
5. **Carrega skills de workflow** quan iniciïs un cicle SDD.

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
| Skills | `.cursor/skills/` | Tech Lead |

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

- Estat del projecte: `.pathguard/STATE.json`
- Mapa d'agents i skills: `agents/INDEX.md`
- Catàleg de specs: `specs/000-index.md`
- Índex de documentació: `docs/INDEX.md`
- Fase actual: `docs/phases/phase-status.md`
- ADRs: `docs/decisions/`
- Roadmap beta: `ROADMAP/beta-readiness.md`
- Governança del projecte: `docs/governance/`
- Migració OpenCode → Cursor: `docs/governance/MIGRATION-FROM-OPENCODE.md`
