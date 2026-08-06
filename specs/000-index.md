# PathGuard — Catàleg de Specs

Catàleg viu de les specs **operatives**. Les tancades / backlog / superseded viuen a [`archive/`](archive/).

**Última higiene:** 2026-08-05 — +SPEC-189 (silenci de passeig / darrera posició); PD-WALK-CLOSED-IS-EXCEPTION.

## Format

- **Path (activa):** `specs/<type>-SPEC-NNN-kebab-case-titol.md`
- **Path (arxivada):** `specs/archive/<type>-SPEC-NNN-kebab-case-titol.md`
- **Type:** `feature` | `tech` | `integration` | `devops`
- **Status:** `draft` | `review` | `approved` | `implementing` | `validated` | `archived` | `superseded`

## Llegenda

| Status | Significat |
|---|---|
| `draft` | En redacció (o diferida explícita) |
| `review` | Esperant revisió del Tech Lead |
| `approved` | Aprovada, pot implementar-se |
| `implementing` | En curs / mergejada amb AC de camp pendent |
| `validated` | Implementada, tests + sign-off |
| `archived` | Tancada, backlog o cancel·lada (`archive/`) |
| `superseded` | Reemplaçada per una altra spec |

---

## Specs actives

| ID | Tipus | Títol | Owner | Status | Nota |
|---|---|---|---|---|---|
| [SPEC-180](integration-SPEC-180-buffer-recovery-cross-platform.md) | integration | Persistent location buffer / `is_recovered` | platform+ios+android+qa | draft | Umbrella; semàntica via 188; iOS via 182 |
| [SPEC-182](tech-SPEC-182-ios-buffer-validation.md) | tech | Validate iOS buffer + `is_recovered` on restart | ios | draft | **DIFERIT** — sense iPhone ara |
| [SPEC-183](tech-SPEC-183-android-walk-keepalive.md) | tech | Android FGS walk keepalive | android | implementing | Mínim mergejat; revisió post-188 |
| [SPEC-185](tech-SPEC-185-honest-http-presence.md) | tech | Honest HTTP presence when patient WS dies | backend+frontend | implementing | Field AC-5 pendent |
| [SPEC-187](tech-SPEC-187-android-fgs-notification-visibility.md) | tech | Android FGS notification on lock screen | android | implementing | Canal `pathguard_walk_v2`; smoke OK |
| [SPEC-188](tech-SPEC-188-recovered-only-from-buffer.md) | tech | `is_recovered` només des del buffer real | android+qa | implementing | Mergejat; AC-6 = butxaca (kill → 189) |
| [SPEC-189](feature-SPEC-189-caregiver-walk-silence-last-known.md) | feature | Silenci de passeig: missatge calm + darrera posició | frontend+qa | implementing | MVP PWA a main (`7f4d4d5`); AC-7 field diferit |

---

## Specs arxivades

Veure carpeta [`archive/`](archive/). Capçalera `<!-- ARXIVAT: … -->` a cada fitxer.

| ID | Motiu (resum) |
|---|---|
| [SPEC-010](archive/tech-SPEC-010-restore-android-plugin.md) | Fet / mergejat |
| [SPEC-020](archive/integration-SPEC-020-consolidate-gps-capture.md) | Fet / mergejat |
| [SPEC-030](archive/feature-SPEC-030-device-token-revocation.md) | Backlog |
| [SPEC-040](archive/tech-SPEC-040-bridge-contract-v2.md) | Fet / mergejat |
| [SPEC-050](archive/feature-SPEC-050-field-testing.md) | Cobert per skill field-testing |
| [SPEC-060](archive/devops-SPEC-060-cicd-pipeline.md) | Backlog P1 |
| [SPEC-070](archive/tech-SPEC-070-ios-armv7-fix.md) | Fet / mergejat |
| [SPEC-080](archive/devops-SPEC-080-release-process.md) | Backlog devops |
| [SPEC-100](archive/feature-SPEC-100-i18n.md) | Post-beta |
| [SPEC-110](archive/tech-SPEC-110-native-unit-tests.md) | Deute / backlog |
| [SPEC-120](archive/tech-SPEC-120-presence-redis.md) | Post-beta |
| [SPEC-130](archive/tech-SPEC-130-fix-presence-and-recovered.md) | Fet / mergejat |
| [SPEC-140](archive/integration-SPEC-140-native-ios-network-reachability-bridge.md) | Fet / mergejat |
| [SPEC-150](archive/tech-SPEC-150-android-foreground-robustness.md) | Fet; residual → 183/188 |
| [SPEC-160](archive/tech-SPEC-160-ios-network-monitor-caregiver.md) | Fet / mergejat |
| [SPEC-170](archive/tech-SPEC-170-caregiver-presence-http-broadcast.md) | Fet / mergejat |
| [SPEC-181](archive/tech-SPEC-181-android-recovered-flag.md) | Fet; residual → 188 |
| [SPEC-184](archive/feature-SPEC-184-caregiver-force-location.md) | Aparcada |
| [SPEC-186](archive/tech-SPEC-186-android-deferred-buffer.md) | **Superseded** per SPEC-188 |

---

## Com crear una nova spec

1. Carrega `.cursor/skills/pathguard-workflow-sdd-create-spec/SKILL.md`
2. Segueix el template
3. Troba el següent NNN disponible
4. Crea `specs/<type>-SPEC-NNN-kebab-case-titol.md`
5. Afegeix entrada a la taula **Specs actives**
6. Notifica al Tech Lead

## Convencions

- **ID:** `<type>-SPEC-NNN`
- **Títol:** verb + objecte
- **Priority (si cal):** P0 | P1 | P2 — només a la spec, no cal inflar aquest índex

## Referències

- Workflow create: `.cursor/skills/pathguard-workflow-sdd-create-spec/SKILL.md`
- Workflow review: `.cursor/skills/pathguard-workflow-sdd-review-spec/SKILL.md`
- Arxivament docs: `docs/archive/` (documentació general; specs usen `specs/archive/`)
