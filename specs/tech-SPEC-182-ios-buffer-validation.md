---
id: tech-SPEC-182
title: Validate iOS persistent buffer and is_recovered on app restart
type: tech
status: draft
priority: P0
created: 2026-07-07
author: tech-lead
agents_affected:
  - ios
reviewer: tech-lead
blocked_by:
  - integration-SPEC-180
replaces: null
supersedes: null
adr: null
---

# Spec: Validate iOS persistent buffer and is_recovered on app restart

## 1. Objectiu

Validar que el plugin iOS de PathGuard persisteixi correctament els punts pendents quan l’app es tanca i els enviï amb `is_recovered = true` quan es reobre, i afegir tests XCTest que ho garanteixin.

## 2. Context

Aquesta spec és una subtasca d’`integration-SPEC-180`. El problema es va observar a les proves de camp del 7 de juliol de 2026:

- Passeig 132 (iPhone, app sempre oberta): 45 punts, tots `is_recovered = false`. Correcte.
- Passeig 133 (iPhone, app sortida i reoberta 2 cops): 39 punts, **tots `is_recovered = false`**. S’esperava que els primers punts enviats després de cada reobertura fossin `is_recovered = true`.

La revisió de codi actual mostra que el plugin iOS ja incorpora la correcció de SPEC-130:

- `LocationSyncService.onPointAccepted` no sobreescriu `isRecovered`.
- `LocationBuffer.init` marca tots els punts carregats de `BufferStore` com a `isRecovered = true`.
- `LocationBuffer.onFlushFailure` re-afageix el batch amb `isRecovered = true`.

No obstant això, les proves de camp no reflecteixen el comportament esperat. Cal determinar si la causa és:
1. El permís "while in use", que impedeix capturar punts quan l’app està tancada del tot.
2. Un bug no detectat a la serialització, la persistència o el flush.
3. Una interpretació diferent de què significa "sortir de l’app".

## 3. Problema

Les dades de la base de dades no mostren cap punt `is_recovered = true` després de sortir i reobrir l’app, tot i que el codi del plugin sembla preparat per això.

## 4. Impacte arquitectònic

Aquesta spec només toca la capa iOS:

- `frontend/plugins/location-sync/ios/Plugin/LocationBuffer.swift`
- `frontend/plugins/location-sync/ios/Plugin/BufferStore.swift`
- `frontend/plugins/location-sync/ios/Plugin/LocationSyncService.swift`
- Nou fitxer de tests XCTest: `LocationBufferTests.swift`

**No es toquen:**
- El contracte del bridge TS.
- La capa Android.
- El backend.
- El frontend.

## 5. Criteris d’acceptació

### AC-1 — Tests XCTest existents
- [ ] `test_initWithStoredPoints_marksAllRecovered`: simular `BufferStore` amb punts → tots els punts carregats tenen `isRecovered = true`.
- [ ] `test_addNewPoint_isNotRecovered`: afegir punt nou → `isRecovered = false`.
- [ ] `test_onFlushFailure_reAddsBatchAsRecovered`: flush fallit → punts re-afegits amb `isRecovered = true`.
- [ ] `test_onFlushSuccess_clearsBuffer`: flush amb èxit → buffer buit, `lastFlushFailed = false`, `recoveryStreak = 0`.
- [ ] `test_recoveryStreak_incrementsOnFailure`: 3 failures consecutius → `lastFlushFailed = true`.

### AC-2 — Validació de la persistència
- [ ] Confirmar que `BufferStore.save` persisteix el buffer quan l’app es tanca (per exemple, quan el sistema crida `applicationWillTerminate` o quan el servei és destruït).
- [ ] Confirmar que `LocationSyncService.init` recupera la sessió (`walkId`, `deviceToken`, `serverUrl`) i programa un flush si hi ha punts pendents.

### AC-3 — Proves de camp amb permís "sempre"
- [ ] iPhone 8, permís d’ubicació "sempre", sortir i reobrir l’app 2 cops durant un passeig.
- [ ] Els primers punts enviats després de cada reobertura han de tenir `is_recovered = true`.
- [ ] Els punts capturats mentre l’app està oberta han de tenir `is_recovered = false`.

### AC-4 — Proves de camp amb permís "while in use"
- [ ] iPhone 8, permís "while in use", mateix escenari.
- [ ] Documentar el comportament real: si no hi ha punts recuperats, explicar que és per la limitació del permís.

### AC-5 — Cap regressió
- [ ] Build d’iOS (`xcodebuild`) sense errors.
- [ ] Tests existents del frontend (108/108) segueixen passant.

## 6. Riscos identificats

- **R1:** Si el bug és al permís "while in use", caldrà demanar "sempre" als usuaris.
  - **Mitigació:** documentar-ho com a requisit; no és un bug de codi.
- **R2:** Si el bug és a la serialització del `LocationPoint`, caldrà revisar el model.
  - **Mitigació:** els tests XCTest ho detectaran.
- **R3:** `UserDefaults` pot no persistir si l’app és matada bruscament pel sistema.
  - **Mitigació:** assegurar que `save()` es crida en els callbacks de lifecycle adequats.
- **R4:** Tests XCTest requereixen estructura de target de test a Xcode.
  - **Mitigació:** crear el target si no existeix; si no es pot, documentar-ho.

## 7. Pla d’implementació

**Branca:** `fix/SPEC-182-ios-buffer-validation` (des de `develop`)

**Ordre:**

1. **Agent iOS:** crear o completar `frontend/ios/Tests/LocationBufferTests.swift` amb els 5 tests de l’AC-1.
2. **Agent iOS:** revisar `LocationSyncService.swift` per assegurar que:
   - `saveSession()` i `buffer.save()` es criden quan l’app passa a background o és destruïda.
   - `loadSession()` recupera correctament la sessió després d’un kill app.
3. **Agent iOS:** si es descobreix un bug durant la revisió, corregir-lo.
4. **Agent iOS:** executar build i tests.
5. **QA:** fer proves de camp amb iPhone 8, ambdós permisos.
6. **Tech Lead:** revisa el PR i autoritza merge a `develop`.

## 8. Pla de validació

- **Tests XCTest:** 5 nous tests passant.
- **Build iOS:** `xcodebuild -workspace App/App.xcworkspace -scheme App -configuration Debug CODE_SIGNING_ALLOWED=NO build` sense errors.
- **Field test:** iPhone 8, escenari de sortida/reobertura amb permís "sempre" i "while in use".
- **QA sign-off:** AC-1 a AC-5 verificats.

## 9. Out of scope

- Canvis al frontend (mapa) — cobert per `integration-SPEC-180`.
- Canvis a Android — coberts per `tech-SPEC-181`.
- Permisos runtime (UX) — coberts per `integration-SPEC-180`.
- Foreground notification iOS (post-beta).
- Retry HTTP amb backoff (post-beta).

## 10. Referències

- `integration-SPEC-180-buffer-recovery-cross-platform.md`
- `specs/tech-SPEC-130-fix-presence-and-recovered.md`
- `specs/tech-SPEC-140-native-ios-network-reachability-bridge.md`
- `.cursor/skills/pathguard-agent-ios/SKILL.md`
- `frontend/plugins/location-sync/ios/Plugin/LocationBuffer.swift`
- `frontend/plugins/location-sync/ios/Plugin/BufferStore.swift`
- `frontend/plugins/location-sync/ios/Plugin/LocationSyncService.swift`
