# PathGuard — Beta Readiness Roadmap

## Objectiu

Aconseguir una **beta testable en entorn real** amb:
- PWA funcional
- Capa Android funcional
- Capa iOS funcional
- Backend estable
- Documentació completa
- Procediments de camp validats

## Cronograma

| Setmana | Fase | Espec principal | Entregable |
|---|---|---|---|
| 1 | Fase 0 — Estructura | (ja fet en aquesta PR) | Skills, agents, specs, docs |
| 1 | Fase 1 — Restaurar Android | SPEC-010 | Android torna a compilar |
| 2 | Fase 2 — Consolidar GPS | SPEC-020 | 1 mode GPS, 0 pèrdua |
| 3 | Fase 3 — Revocació token | SPEC-030 | Owner pot revocar |
| 3 | Fase 4 — Bridge contract v2 | SPEC-040 | Contracte canònic |
| 4 | Fase 5 — Proves de camp | SPEC-050 | 7 reports |
| 4 | Fase 6 — CI/CD | SPEC-060 | Pipelines |
| 4 | Fase 7 — Release beta | — | `v2.7.0-beta.1` |

**Total estimat:** 4-5 setmanes des de l'inici de Fase 1.

## Checklist Beta Ready

### Funcionalitat
- [ ] PWA registra, activa, monitoritza, SOS
- [ ] Android: build APK debug + release
- [ ] iOS: build IPA debug + release
- [ ] Backend: tests 152/152 (o més)
- [ ] Frontend: tests 108/108 (o més)
- [ ] Field tests 7/7 escenaris

### Seguretat
- [ ] `device_token` revocable (SPEC-030)
- [ ] Permisos OS correctes (iOS WhenInUse → Always)
- [ ] CORS correcte (orígens explícits)
- [ ] Secrets a env vars (no al codi)

### Operacions
- [ ] CI pipeline (PR validation)
- [ ] CD pipeline (auto-deploy)
- [ ] Release process (tag → artifacts)
- [ ] Observabilitat (logs, errors)
- [ ] Cold start acceptable

### Documentació
- [ ] CONTEXT.md slim
- [ ] agents/INDEX.md complet
- [ ] Skills operatius
- [ ] Specs SDD vives
- [ ] ADRs per decisions clau
- [ ] docs/archive/ immutable

### Cross-platform
- [ ] Bridge contract canònic (SPEC-040)
- [ ] 1 font GPS (SPEC-020)
- [ ] Permisos centralitzats
- [ ] Tokens a Capacitor Preferences
- [ ] Format de dades coherent (TS ↔ iOS ↔ Android ↔ Backend)

## Riscos residuals

| Risc | Probabilitat | Impacte | Mitigació |
|---|---|---|---|
| Field tests troben issues nous | Alta | Mitjà | Buffer de 2 setmanes al cronograma |
| Apple rebutja app per permisos | Baixa | Alt | Seguir guidelines Apple (WhenInUse primer) |
| Android OEM killing | Mitjana | Mitjà | WakeLock + foreground service |
| Render cold start | Mitjana | Baix | Cron ping cada 10 min |

## Mètriques d'èxit

| Mètrica | Objectiu | Mesurat |
|---|---|---|
| Pèrdua de punts en offline | 0% | ⏳ |
| Duplicats a DB | 0 | ⏳ |
| Falsos offline screen-off | 0% | ⏳ |
| Tests backend | ≥152 | 152 ✅ |
| Tests frontend | ≥108 | 108 ✅ |
| Field tests | 7/7 ✅ | ⏳ |
| Build APK debug | exit | ⏳ |
| Build IPA debug | exit | ⏳ |

## Sign-off

| Rol | Sign-off per |
|---|---|
| **QA** | "Beta Ready" (única autoritat) |
| Tech Lead | Validació cross-capa i ADRs |
| Owner del projecte | Acceptació per release pública |

## Decissions pendents (ADRs)

- ADR-0004 — Única font de GPS (pendent per SPEC-020)
- ADR-0005 — Tokens a Capacitor Preferences (pendent per SPEC-030)
- ADR-0006 — Permisos centralitzats al plugin (pendent per SPEC-020.6)

## Referències

- [`../specs/000-index.md`](../specs/000-index.md) — Catàleg de specs
- [`../docs/phases/phase-status.md`](../docs/phases/phase-status.md) — Estat per fase
- [`../docs/architecture/overview.md`](../docs/architecture/overview.md) — Visió arquitectònica
- `audit_native_layer.md` — 15 issues identificats
