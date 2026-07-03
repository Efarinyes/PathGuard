# PathGuard — Estat per fase

**Última actualització:** 2026-06-30

## Convencions

- ✅ **Completed** — fase entregada i mergejada
- ⏳ **Pending** — fase planificada, no iniciada
- 🔄 **In progress** — fase en curs
- ❌ **Cancelled** — fase cancel·lada (no es farà)

## Estat actual: Fase 0 — Estructura agents + skills

| # | Fase | Estat | Última branca |
|---|---|---|---|
| 0 | Estructura agents + skills | 🔄 In progress | `feat/ios-native-layer` (pendent tancar) |
| 1 | Beta Blockers | ✅ Completed | `fix/phase1-beta-blockers` |
| 2 | Registration/Activation | ✅ Completed | `fix/phase1-beta-blockers` |
| 3 | Pre-beta Polish | ✅ Completed | `fix/phase3-poliment` |
| 4.1 | Owner Dashboard | ✅ Completed | `feat/phase4-owner-dashboard` |
| 4.2 | Backend Architecture | ✅ Completed | `refactor/phase4-architecture` |
| 4.3 | Frontend Architecture | ✅ Completed | `refactor/phase4-frontend-architecture` |
| CSS | Design System | ✅ Completed | `refactor/css-design-system` |
| F | GPS Adaptive Logic | ✅ Completed | `feat/gps-adaptive-logic` |
| C+D | Dashboard Reorganization | ✅ Completed | `feat/dashboard-reorganization` |
| G | PostgreSQL Migration | ✅ Completed | `feat/postgresql-migration` |
| E | Capacitor /patient (Android) | ⏳ Provisional | `main` (testat al camp, audit pendent) |
| B | Walk distance | ❌ Cancelled | — |
| 4.4 | SOS User Test | ⏳ Pending | — |
| 4.5 | i18n | ⏳ Pending | — |
| 5 | Beta Deploy | ⏳ Pending | — |

## Fases planificades (post Fase 0)

### Fase 1 — Restaurar Android plugin (P0)
- SPEC-010 — restaurar 3 fitxers perduts
- Branca: `fix/SPEC-010-restore-android-plugin`
- Owner: Agent Android
- Reviewer: Platform Integration

### Fase 2 — Consolidar GPS cross-platform (P0)
- SPEC-020 — 1 mode GPS, 1 font de permisos
- Subtasks: iOS LocationBuffer fix, Timer→DispatchSourceTimer, histeresi, useLocationTracking 1 mode, useOfflineRecovery guards
- Branca: `fix/SPEC-020-consolidate-gps-capture`
- Owner: Platform Integration
- Reviewer: Tech Lead

### Fase 3 — Revocació device_token (P0)
- SPEC-030 — owner pot revocar
- Branca: `feat/SPEC-030-device-token-revocation`
- Owner: Agent Backend
- Reviewer: Platform Integration

### Fase 4 — CI/CD (P1)
- SPEC-040 — GitHub Actions pipelines
- Owner: Agent DevOps

### Fase 5 — Proves de camp reals (P0)
- SPEC-130 — iPhone 8 + Redmi
- Owner: Agent QA

### Fase 6 — Validació Beta end-to-end (P0)
- SPEC-140 — checklist 5.4 action-plan
- Owner: Tech Lead + QA

## Versions

| Versió | Data | Notes |
|---|---|---|
| v1.0.0 | 2025-XX-XX | Release inicial |
| v2.0.0-beta.1 | 2026-05-08 | PWA estable, post-Phase B |
| v2.6.0-beta.1 | 2026-05-31 | Post-Phase G (PostgreSQL) |
| v2.6.0-pwa-stable.0 | 2026-XX-XX | Snapshot pre-Capacitor |
| **v2.7.0-beta.1** | (target) | Post-Fase 0 + 1 + 2 + 3 + 4 + 5 |

## Tags

- `v1.0.0` — release inicial
- `v2.0.0-beta.1` — primera PWA beta
- `v2.6.0-beta.1` — post-Phase G
- `v2.6.0-pwa-stable.0` — snapshot pre-Capacitor
- `v2.7.0-beta.1` — target beta amb capes natives (per release)

## Mètriques d'èxit (per release)

| Mètrica | Objectiu |
|---|---|
| Pèrdua de punts en offline | 0% |
| Duplicats a DB | 0 |
| Falsos offline screen-off | 0% |
| Tests backend | 152/152+ |
| Tests frontend | 108/108+ |
| Field tests | 7/7 escenaris ✅ |

## Riscos coneguts (post-audit)

| ID | Severitat | Títol |
|---|---|---|
| R-P0-1 | Crítica | Android plugin trencat a `feat/ios-native-layer` |
| R-P0-2 | Alta | Pèrdua de punts GPS quan flush falla al plugin iOS |
| R-P0-3 | Alta | Doble sistema GPS al frontend |
| R-P0-4 | Alta | `device_token` permanent sense revocació |
| R-P0-5 | Mitjana | Permisos iOS: doble petició |

Veure `audit_native_layer.md` per detalls.

## Decissions actives

- (pendent) SPEC-020 — 1 font GPS
- (pendent) SPEC-030 — revocació device_token
- (pendent) ADR per a tokens a Capacitor Preferences
- (pendent) ADR per a permisos centralitzats

## Referències

- [`../architecture/overview.md`](../architecture/overview.md)
- [`../../specs/000-index.md`](../../specs/000-index.md)
- [`../../ROADMAP/beta-readiness.md`](../../ROADMAP/beta-readiness.md)
- `audit_native_layer.md` (15 troballes)
