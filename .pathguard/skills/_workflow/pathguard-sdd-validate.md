---
name: pathguard-sdd-validate
description: |
  Procediment per validar una spec implementada. Carregar
  quan una spec està en estat `implementing` i es vol
  passar a `validated`.
metadata:
  triggers:
    - Spec implementada
    - Verificar AC abans de merge
    - QA sign-off
  agent_owner: qa
  prerequisites:
    - pathguard-sdd-implement
---

# SDD — Validar una Spec

## Pre-condicions

- [ ] Spec status = `implementing`
- [ ] Implementació completa
- [ ] PR obert
- [ ] Tests verds localment

## Validació per AC

Per cada criteri d'acceptació:

| Resultat | Significat |
|---|---|
| ✅ Pass | AC verificable, implementat correctament |
| ⚠️ Pass amb notes | Pass però amb observacions |
| ❌ Fail | AC no implementat o incorrecte |

## Validació tècnica

### Tests
- [ ] Backend: `pytest tests/ -v` — 152/152 (o més)
- [ ] Frontend: `npm test && npm run build --webpack` — 108/108 (o més)
- [ ] E2E: `npx playwright test` — pass
- [ ] Native (si aplica): build APK/IPA OK

### Lint
- [ ] ESLint frontend: 0 errors
- [ ] ruff/black backend: 0 errors
- [ ] No `any` nous en TypeScript
- [ ] No `console.log` nous

### Build
- [ ] `npm run build --webpack` OK
- [ ] `./gradlew assembleDebug` OK
- [ ] `xcodebuild ... -configuration Debug` OK

### Golden path
- [ ] Registre → login → walk → SOS end-to-end
- [ ] Sense regressions

## Validació de camp (si aplica)

Si la spec afecta UX, GPS, o comportament visible:

| Escenari | Dispositiu | Criteri |
|---|---|---|
| Walk normal | Pacient | Punts al mapa, ruta coherent |
| Pèrdua cobertura | Pacient | `is_recovered` correcte |
| Screen-off | Pacient | Punts seguits |
| Kill app | Pacient | Walk recuperat |
| SOS | Cuidador | So + modal < 2s |

Documentar a `docs/field-tests/<data>-<escenari>.md`.

## Validació cross-capa

Si la spec toca ≥2 capes:

1. **Verificar contracte** — signatura TS, API endpoint, etc.
2. **Verificar coherència** — Android i iOS implementen el mateix
3. **Verificar tests d'integració** — les parts funcionen juntes

## Sign-off

| Rol | Sign-off per |
|---|---|
| Reviewer (a spec) | Aprovació de revisió de codi |
| Tech Lead | Cross-capa i ADR (si aplica) |
| **QA** | **"Beta Ready" per release** |

QA és l'**única autoritat** per dir "Beta Ready" sobre un release.

## Output

```markdown
## Validació — SPEC-NNN

**Data:** YYYY-MM-DD
**Agent validador:** qa

### AC
- [x] AC-1: ✅
- [x] AC-2: ✅
- [ ] AC-3: ❌ — <motiu>

### Tests
- Backend: 152/152 ✅
- Frontend: 108/108 ✅
- E2E: 1/1 ✅

### Field
- Walk normal: ✅
- Pèrdua cobertura: ✅
- SOS: ✅

### Cross-capa
- Contracte verificat: ✅
- Android + iOS coherents: ✅

### Veredicte
- [x] **Validated** — pot mergejar
- [ ] **Revisions** — tornar a implementar
- [ ] **Rejected** — cancel·lar spec

**Sign-off QA:** @qa
```

## Quan sign-off falla

Si algun AC falla:

1. **NO aprovar** — retornar a `implementing`
2. **Documentar** els AC que fallen
3. **Coordinar** amb l'agent owner per fix
4. **Re-validar** quan estigui llest

## Recursos

- `pathguard-sdd-implement` (pas previ)
- `pathguard-test-pyramid` (tests)
- `pathguard-field-testing` (procediment camp)
