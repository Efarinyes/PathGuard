# PathGuard — Catàleg de Specs

Catàleg viu de totes les specs del projecte. Cada spec viu al seu propi fitxer i es referencia aquí.

**Última higiene repo:** 2026-08-01 (Fase 1 PLA-POST-GPS) — branques mergejades esborrades; només `main` + `develop` (+ `archive/opencode-governance-2026-07-30` històric) actives.

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
| [SPEC-020](integration-SPEC-020-consolidate-gps-capture.md) | integration | Consolidar captura GPS cross-platform | platform-integration | approved | mergejat a `main` |
| [SPEC-030](feature-SPEC-030-device-token-revocation.md) | feature | Revocació de device_token (owner) | backend | draft | — |
| [SPEC-040](tech-SPEC-040-bridge-contract-v2.md) | tech | Bridge LocationSync v2 — 6 mètodes, contracte canònic | platform-integration | approved | mergejat a `main` |
| [SPEC-050](feature-SPEC-050-field-testing.md) | feature | Proves de camp amb dispositius reals | qa | draft | — |
| [SPEC-130](tech-SPEC-130-fix-presence-and-recovered.md) | tech | Fix presència WS i flag is_recovered al plugin iOS | frontend+ios | validated | mergejat a `main` |
| [SPEC-140](integration-SPEC-140-native-ios-network-reachability-bridge.md) | integration | iOS native network reachability bridge for WebSocket reconnect (NWPathMonitor) | platform-integration+ios+frontend | approved | mergejat a `main` (2026-07-06) |
| [SPEC-150](tech-SPEC-150-android-foreground-robustness.md) | tech | Android foreground service robustness for 2h walks (C-1..C-4) | android+frontend | implementing | mergejat a `main`; C-1 revisat 2026-07-31 (`4b1c9eb`); field test walk 144 parcial |
| [SPEC-160](tech-SPEC-160-ios-network-monitor-caregiver.md) | tech | iOS network monitor must start globally, not only during tracking (Bug 1+2 R-P0-NEW-1) | ios+platform-integration+frontend | approved | mergejat a `main` |
| [SPEC-170](tech-SPEC-170-caregiver-presence-http-broadcast.md) | tech | Caregiver presence updates from HTTP batch uploads | backend | approved | mergejat a `main` |
| [SPEC-180](integration-SPEC-180-buffer-recovery-cross-platform.md) | integration | Persistent location buffer and is_recovered correctness across app lifecycle | platform-integration+ios+android+frontend+backend+qa | draft | Android via 181+186; iOS (182) diferit |
| [SPEC-181](tech-SPEC-181-android-recovered-flag.md) | tech | Fix Android is_recovered override and buffer hysteresis | android | implementing | mergejat; AC-6 field exhaustiu pendent |
| [SPEC-182](tech-SPEC-182-ios-buffer-validation.md) | tech | Validate iOS persistent buffer and is_recovered on app restart | ios | draft | **DIFERIT** — sense iPhone ara; post Android field |
| [SPEC-183](tech-SPEC-183-android-walk-keepalive.md) | tech | Android FGS walk keepalive (flush + stale GPS probe) | android | implementing | mínim a branca fix/SPEC-186-187; field Metric A pendent |
| [SPEC-185](tech-SPEC-185-honest-http-presence.md) | tech | Honest HTTP presence when patient WebSocket dies | backend+frontend | implementing | fix backend; field AC-5 pendent |
| [SPEC-186](tech-SPEC-186-android-deferred-buffer.md) | tech | Android deferred buffer on rest/kill → is_recovered | android | implementing | branca fix/SPEC-186-187; field kill pendent |
| [SPEC-187](tech-SPEC-187-android-fgs-notification-visibility.md) | tech | Android FGS notification visible on lock screen | android | implementing | canal pathguard_walk_v2; field Redmi pendent |

### P1 — Beta readiness

| ID | Tipus | Títol | Owner | Status | Branca |
|---|---|---|---|---|---|
| [SPEC-060](devops-SPEC-060-cicd-pipeline.md) | devops | Pipeline CI/CD multi-plataforma | devops | draft | — |
| [SPEC-070](tech-SPEC-070-ios-armv7-fix.md) | tech | iOS Info.plist: armv7 → arm64 | ios | approved | mergejat a `main` |
| [SPEC-080](devops-SPEC-080-release-process.md) | devops | Tag-driven release + artifacts + secrets | devops | draft | — |

### P2 — Post-beta

| ID | Tipus | Títol | Owner | Status | Branca |
|---|---|---|---|---|---|
| [SPEC-100](feature-SPEC-100-i18n.md) | feature | i18n: CA/ES/EN | frontend | draft | — |
| [SPEC-110](tech-SPEC-110-native-unit-tests.md) | tech | Tests unitaris natius (XCTest + JUnit) | ios+android+qa | draft | — |
| [SPEC-120](tech-SPEC-120-presence-redis.md) | tech | WebSocket presence via Redis (post-beta) | backend+devops | draft | — |
| [SPEC-184](feature-SPEC-184-caregiver-force-location.md) | feature | Caregiver force location (push) | multi | draft | **APARCAT** — no implementar fins fallada OEM SPEC-183 |

---

## Specs arxivades

Cap encara.

---

## Com crear una nova spec

1. Carrega `.cursor/skills/pathguard-workflow-sdd-create-spec/SKILL.md`
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

- Workflow: `.cursor/skills/pathguard-workflow-sdd-create-spec/SKILL.md`
- Template: `.cursor/skills/pathguard-workflow-sdd-create-spec/SKILL.md` (secció Template)
- Review: `.cursor/skills/pathguard-workflow-sdd-review-spec/SKILL.md`
