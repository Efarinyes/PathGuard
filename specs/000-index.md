# PathGuard — Catàleg de Specs

Catàleg viu de totes les specs del projecte. Cada spec viu al seu propi fitxer i es referencia aquí.

## Format

- **Path:** `specs/<type>-SPEC-NNN-kebab-case-titol.md`
- **Type:** `feature` | `tech` | `integration`
- **NNN:** 3 dígits correlatius (per tipus)
- **Status:** `draft` | `review` | `approved` | `implementing` | `validated` | `archived`

## Llegenda

| Status | Significat |
|---|---|
| `draft` | En redacció |
| `review` | Esperant revisió del Tech Lead |
| `approved` | Aprovada, pot implementar-se |
| `implementing` | En curs d'implementació |
| `validated` | Implementada, tests passats, sign-off |
| `archived` | Tancada, reemplaçada o cancel·lada |

---

## Specs actives

### P0 — Beta blockers

| ID | Tipus | Títol | Owner | Status | Branca |
|---|---|---|---|---|---|
| [SPEC-010](tech-SPEC-010-restore-android-plugin.md) | tech | Restore Android plugin (3 fitxers perduts) | android | draft | — |
| [SPEC-020](integration-SPEC-020-consolidate-gps-capture.md) | integration | Consolidar captura GPS cross-platform | platform-integration | approved | `fix/SPEC-020-ios-gps-fixes` (iOS) + `fix/SPEC-020-frontend-gps-refactor` (FE) |
| [SPEC-030](feature-SPEC-030-device-token-revocation.md) | feature | Revocació de device_token (owner) | backend | draft | — |
| [SPEC-040](tech-SPEC-040-bridge-contract-v2.md) | tech | Bridge LocationSync v2 — 6 mètodes, contracte canònic | platform-integration | approved | `refactor/SPEC-040-bridge-v2-ios` |
| [SPEC-050](feature-SPEC-050-field-testing.md) | feature | Proves de camp amb dispositius reals | qa | draft | — |
| [SPEC-130](tech-SPEC-130-fix-presence-and-recovered.md) | tech | Fix presència WS i flag is_recovered al plugin iOS | frontend+ios | draft | — |
| [SPEC-140](integration-SPEC-140-native-ios-network-reachability-bridge.md) | integration | iOS native network reachability bridge for WebSocket reconnect (NWPathMonitor) | platform-integration+ios+frontend | draft (fusionada a develop 2026-07-06) | `fix/SPEC-140-native-ios-network-reachability-bridge` (merged) |
| [SPEC-150](tech-SPEC-150-android-foreground-robustness.md) | tech | Android foreground service robustness for 2h walks (C-1..C-4) | android+frontend | draft | — |
| [SPEC-160](tech-SPEC-160-ios-network-monitor-caregiver.md) | tech | iOS network monitor must start globally, not only during tracking (Bug 1+2 R-P0-NEW-1) | ios+platform-integration+frontend | draft | — |
| [SPEC-170](tech-SPEC-170-caregiver-presence-http-broadcast.md) | tech | Caregiver presence updates from HTTP batch uploads | backend | draft | — |
| [SPEC-140](integration-SPEC-140-native-ios-network-reachability-bridge.md) | integration | Native iOS network reachability bridge for WebSocket reconnect | platform-integration+ios+frontend | approved | `fix/SPEC-140-native-ios-network-reachability-bridge` |

### P1 — Beta readiness

| ID | Tipus | Títol | Owner | Status | Branca |
|---|---|---|---|---|---|
| [SPEC-060](devops-SPEC-060-cicd-pipeline.md) | devops | Pipeline CI/CD multi-plataforma | devops | draft | — |
| [SPEC-070](tech-SPEC-070-ios-armv7-fix.md) | tech | iOS Info.plist: armv7 → arm64 | ios | approved | `fix/SPEC-070-ios-arm64` |
| [SPEC-080](devops-SPEC-080-release-process.md) | devops | Tag-driven release + artifacts + secrets | devops | draft | — |

### P2 — Post-beta

| ID | Tipus | Títol | Owner | Status | Branca |
|---|---|---|---|---|---|
| [SPEC-100](feature-SPEC-100-i18n.md) | feature | i18n: CA/ES/EN | frontend | draft | — |
| [SPEC-110](tech-SPEC-110-native-unit-tests.md) | tech | Tests unitaris natius (XCTest + JUnit) | ios+android+qa | draft | — |
| [SPEC-120](tech-SPEC-120-presence-redis.md) | tech | WebSocket presence via Redis (post-beta) | backend+devops | draft | — |

---

## Specs arxivades

Cap encara.

---

## Com crear una nova spec

1. Carrega `.opencode/skills/pathguard-workflow-sdd-create-spec/SKILL.md`
2. Segueix el template
3. Troba el següent NNN disponible per tipus
4. Crea `specs/<type>-SPEC-NNN-kebab-case-titol.md`
5. Afegeix entrada aquí (en ordre de priority)
6. Notifica al Tech Lead

## Convencions

- **ID:** `<type>-SPEC-NNN`
- **Path:** `specs/<type>-SPEC-NNN-kebab-case-titol.md`
- **Títol:** verb + objecte ("Restore Android plugin", no "Android fix")
- **Priority:** P0 (beta blocker) | P1 (beta ready) | P2 (post-beta)

## Referències

- Workflow: `.opencode/skills/pathguard-workflow-sdd-create-spec/SKILL.md`
- Template: `.opencode/skills/pathguard-workflow-sdd-create-spec/SKILL.md` (secció Template)
- Review: `.opencode/skills/pathguard-workflow-sdd-review-spec/SKILL.md`
