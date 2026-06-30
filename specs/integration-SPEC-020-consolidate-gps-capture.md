---
id: integration-SPEC-020
title: Consolidar captura GPS cross-platform
type: integration
status: draft
priority: P0
created: 2026-06-30
author: tech-lead
agents_affected:
  - platform-integration
  - ios
  - android
  - frontend
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: pending  # ADR-0004 a redactar
---

# Spec: Consolidar captura GPS cross-platform

## 1. Objectiu
Resoldre els 5 issues crítics identificats a `audit_native_layer.md` relacionats amb la captura GPS al frontend, plugin iOS, i coherència entre capes. Garantir zero pèrdua de punts, 1 sola font de GPS, i comportament uniforme Android/iOS.

## 2. Context
L'auditoria de 2026-06-16 ha identificat 5 issues P0-P1 que bloquegen la beta:

1. **R-P0-2 (Alta):** Pèrdua de punts GPS quan flush falla al plugin iOS — `LocationBuffer.onFlushResult(false)` no re-afageix el batch
2. **R-P0-3 (Alta):** Doble sistema GPS al frontend — `useLocationTracking` alterna entre `LocationSync.startTracking()` i `Geolocation.watchPosition()`
3. **R-P0-5 (Mitjana):** Permisos iOS — doble petició (plugin + `@capacitor/geolocation`)
4. **R-P1-1 (Baixa):** `useOfflineRecovery` no té guards d'estat
5. **R-P1-3 (Alta):** `LocationSyncService` iOS usa `Timer` (pausa en background)
6. **R-P1-4 (Alta):** `LocationBuffer` iOS té la lògica d'histeresi **invertida** respecte a Android

## 3. Problema
- Pèrdua de dades en condicions de xarxa dolenta (iOS)
- Duplicats potencials al backend (frontend amb doble sistema)
- Comportament inconsistent entre Android i iOS
- Permisos demanats dues vegades (UX pobra)
- Bridge cridat sense tracking actiu (soroll)

## 4. Impacte arquitectònic

Aquesta spec toca **4 agents** i requereix coordinació:

- **Platform Integration:** redefineix el contracte GPS (1 font, 1 mode)
- **iOS:** corregeix `LocationBuffer`, `LocationSyncService` (Timer → DispatchSourceTimer)
- **Frontend:** refactor `useLocationTracking` a 1 mode, `useOfflineRecovery` amb guards
- **Tech Lead:** valida cross-capa, redacta ADR-0004

### ADR pendent: ADR-0004
**Títol:** Única font de GPS (plugin natiu only, no Geolocation fallback)
**Conseqüències:**
- ✅ Zero duplicats
- ✅ Comportament uniforme
- ❌ Si el plugin falla, no hi ha fallback (cal gestionar-ho)

## 5. Subtasks

| ID | Títol | Agent | Severitat |
|---|---|---|---|
| 020.1 | iOS `LocationBuffer.onFlushResult(false)` re-add batch + isRecovered | ios | Alta |
| 020.2 | iOS `Timer` → `DispatchSourceTimer` per flush 2s | ios | Alta |
| 020.3 | iOS `LocationBuffer` histeresi invertida (corregir) | ios | Alta |
| 020.4 | Frontend `useLocationTracking` 1 mode (plugin if native, else browser) | frontend | Alta |
| 020.5 | Frontend `useOfflineRecovery` guards d'estat | frontend | Mitjana |
| 020.6 | Permisos iOS centralitzats (1 sol punt de petició) | platform + ios | Mitjana |
| 020.7 | Eliminar `@capacitor/geolocation` quan plugin madur | platform + frontend | Mitjana |

## 6. Criteris d'acceptació

### 020.1 — iOS LocationBuffer re-add
- [ ] AC-1: Quan `sendBatch` falla, els punts es re-afageixen al buffer
- [ ] AC-2: Els punts re-afegits tenen `isRecovered = true`
- [ ] AC-3: Cap punt es perd en un flush fallit
- [ ] AC-4: Tests XCTest per `onFlushResult(false)` re-add

### 020.2 — iOS DispatchSourceTimer
- [ ] AC-1: `flushTimer` usa `DispatchSourceTimer` en lloc de `Timer`
- [ ] AC-2: Flush funciona en background a iOS
- [ ] AC-3: Validad en field test amb screen-off 30 min

### 020.3 — iOS histeresi invertida
- [ ] AC-1: `recoveryStreak` incrementa en fail, no en success
- [ ] AC-2: `lastFlushFailed = true` només quan `streak >= threshold`
- [ ] AC-3: Coherent amb Android (recovery streak parallel)
- [ ] AC-4: Tests XCTest per la lògica

### 020.4 — Frontend 1 mode
- [ ] AC-1: `useLocationTracking` té 1 sol mode (no 2)
- [ ] AC-2: Si `isNative && pluginAvailable` → usa `LocationSync`
- [ ] AC-3: Si no → usa `navigator.geolocation`
- [ ] AC-4: Mai amb `Geolocation.watchPosition()` quan hi ha plugin
- [ ] AC-5: Tests Vitest per cada mode

### 020.5 — useOfflineRecovery guards
- [ ] AC-1: `markBackgrounded/markForegrounded` només cridats si `isTracking`
- [ ] AC-2: Tests Vitest per la guarda

### 020.6 — Permisos centralitzats
- [ ] AC-1: Només 1 punt demana location permission (plugin)
- [ ] AC-2: Frontend no demana permission (delega al plugin)
- [ ] AC-3: iOS: `requestWhenInUse` primer, `requestAlways` després
- [ ] AC-4: Validat en field test

### 020.7 — Eliminar Geolocation
- [ ] AC-1: `@capacitor/geolocation` no s'usa quan hi ha plugin
- [ ] AC-2: Documentat al skill `pathguard-domain-bridge-contract.md`

## 7. Riscos identificats
- **R1:** Regressió en captura GPS (menys punts, més errors)
  - **Mitigació:** tests integration + field test 7 escenaris
- **R2:** Conflicte de timings entre Android i iOS
  - **Mitigació:** la spec ja no toca timings; només coherència
- **R3:** `useLocationTracking` refactor trenca funcionalitat existent
  - **Mitigació:** tests Vitest + e2e + field test
- **R4:** Permisos denegats per Apple si es demanen malament
  - **Mitigació:** seguir guidelines Apple (always després d'un temps d'ús)

## 8. Pla d'implementació

**Branca:** `fix/SPEC-020-consolidate-gps-capture`

**Ordre:**
1. **Tech Lead:** redacta ADR-0004 (1 font GPS)
2. **Platform Integration:** actualitza skill `pathguard-domain-bridge-contract.md` amb el contracte v2
3. **iOS (020.1, 020.2, 020.3):** branca `fix/SPEC-020-ios-gps-fixes` (pot ser paral·lel)
4. **Frontend (020.4, 020.5):** branca `fix/SPEC-020-frontend-gps-refactor`
5. **iOS (020.6):** permisos centralitzats
6. **Platform (020.7):** eliminar Geolocation
7. **QA:** field test 7 escenaris
8. **PRs** ordenats a develop

## 9. Pla de validació
- **Tests unit (iOS):** XCTest per gates, buffer, timer
- **Tests unit (FE):** Vitest per hooks refactoritzats
- **Tests integration:** e2e flow GPS
- **Field test:** 7 escenaris amb iPhone 8 i Redmi
- **Cross-capa:** verificació que Android + iOS envien el mateix format

## 10. Out of scope
- Nous intervals GPS (ja alineats a Phase F)
- Tests unitaris XCTest per a tot el plugin (a SPEC-110)
- Foreground notification iOS (post-beta)

## 11. Referències
- `audit_native_layer.md` (5 issues)
- `.opencode/skills/pathguard-domain-ios-plugin/SKILL.md`
- `.opencode/skills/pathguard-domain-android-plugin/SKILL.md`
- `.opencode/skills/pathguard-domain-bridge-contract/SKILL.md`
- `.opencode/skills/pathguard-domain-frontend-stack/SKILL.md`

---

**Notes:**
- Aquesta spec és un "umbrella" de 7 subtasks. Es pot拆分 en specs separades si cal.
- L'ADR-0004 és bloquejant — cal sign-off del Tech Lead abans d'implementar.
- El field test és l'última línia de validació.
