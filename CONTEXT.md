# PathGuard — Context

**Regla d'or:** Carrega `.pathguard/skills/_core/pathguard-state.md` a l'inici de TOTA sessió. Sense això, no escriuis codi.

---

## Golden Rules (no negociables)

1. **SOLID + CleanCode + SRP** — tot té una sola raó de canvi.
2. **Zero `fetch()` en components** — tot passa per `services/`.
3. **No `any` en TypeScript** — usa `unknown` + type guards.
4. **No `console.log` en producció** — usa `logger`.
5. **No mutable state a nivell de mòdul** — class instances o context.
6. **No `tailwind.config.js`** — tokens a `globals.css/@theme`.
7. **No hex hardcoded** — usa tokens semàntics (`primary`, `success`, etc.).
8. **No URLs hardcoded** — env vars.
9. **No magic** — tot explícit (imports, tipus, estats).
10. **Si la solució sembla un hack, està rebutjada.** Resol l'arrel.

Detall: `.pathguard/skills/_core/pathguard-golden-rules.md`

---

## Estructura del projecte

| Capa | Path | Propietari |
|---|---|---|
| **Backend** | `backend/` | Agent Backend |
| **Frontend PWA** | `frontend/app/`, `components/`, `hooks/`, `services/`, `lib/` | Agent Frontend |
| **Plugin Android** | `frontend/plugins/location-sync/android/` + `frontend/android/` | Agent Android |
| **Plugin iOS** | `frontend/plugins/location-sync/ios/` + `frontend/ios/` | Agent iOS |
| **Bridge TS** | `frontend/plugins/location-sync/src/index.ts` | Agent Platform Integration |
| **Capacitor config** | `frontend/capacitor.config.ts` | Agent Platform Integration |
| **Specs** | `specs/` | Tech Lead |
| **ADRs** | `docs/decisions/` | Tech Lead |
| **Agents i skills** | `.pathguard/` | Tech Lead |

---

## Com treballar

### 1. Carrega el skill del teu rol
Veure `agents/INDEX.md` per mapeig complet.

### 2. Si crees/modifiques/valides una spec, carrega el workflow
- `pathguard-sdd-create-spec`
- `pathguard-sdd-review-spec`
- `pathguard-sdd-implement`
- `pathguard-sdd-validate`

### 3. Si toques branques o commits, carrega
- `pathguard-branching`
- `pathguard-commit`

---

## Estat actual

- **Versió:** v2.6.0-beta.1 (veure `package.json`)
- **Fase:** Fase 0 — Estructura agents + skills (veure `docs/phases/phase-status.md`)
- **Branca actual:** veure `.pathguard/STATE.json`
- **Spec activa:** veure `.pathguard/STATE.json`
- **Pickup-point:** veure `.pathguard/STATE.json > next_session_pickup`

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
- **Documentació interna** (aquest, specs, ADRs): anglès
- **Comunicació amb l'usuari** (errors, README, missatges): català
- **Branques i commits**: anglès

---

## Referència ràpida

- **Mapa d'agents i skills:** `agents/INDEX.md`
- **Catàleg de specs:** `specs/000-index.md`
- **Índex de documentació:** `docs/INDEX.md`
- **Estat del projecte:** `.pathguard/STATE.json`
- **ADRs:** `docs/decisions/`
- **Fase actual:** `docs/phases/phase-status.md`
- **Roadmap beta:** `ROADMAP/beta-readiness.md`
