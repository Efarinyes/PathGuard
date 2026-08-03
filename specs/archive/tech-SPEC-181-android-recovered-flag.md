<!-- ARXIVAT: Implementada / mergejada; arxivada 2026-08-03 (higiene specs) -->
---
id: tech-SPEC-181
title: Fix Android is_recovered override and buffer hysteresis
type: tech
status: archived
priority: P0
created: 2026-07-07
author: tech-lead
agents_affected:
  - android
reviewer: tech-lead
blocked_by:
  - integration-SPEC-180
replaces: null
supersedes: null
adr: null---

# Spec: Fix Android is_recovered override and buffer hysteresis

## 1. Objectiu

Corregir el plugin Android de PathGuard perquè el flag `is_recovered` només sigui `true` quan un punt ha estat prèviament emmagatzemat al buffer per una fallada de xarxa, i perquè la histèresi de recuperació (`recoveryStreak`) coincideixi amb la lògica d’iOS.

## 2. Context

Aquesta spec és una subtasca d’`integration-SPEC-180`. El problema es va detectar a les proves de camp del 7 de juliol de 2026:

- Passeig 133 (iPhone) va mostrar tots els punts amb `is_recovered = false` després de sortir i reobrir l’app dues vegades.
- Tot i que la prova es va fer amb iPhone, la revisió de codi del plugin Android ha trobat dos bugs idèntics o pitjors als que SPEC-130 va corregir a iOS:
  1. `LocationSyncForegroundService.onPointAccepted` sobreescriu `isRecovered` amb `locationBuffer.getLastFlushFailed() || !isAppInForeground()`.
  2. `LocationBuffer.onFlushFailure` reseteja `recoveryStreak` i estableix `lastFlushFailed = true` immediatament.
  3. `LocationBuffer.onFlushSuccess` incrementa `recoveryStreak` i només allibera `lastFlushFailed` després del threshold.

Aquests bugs produeixen `is_recovered = true` per a punts nous quan l’app està en segon pla o quan hi ha hagut un flush fallit anterior, confonent les dades de la base de dades.

## 3. Problema

### 3.1 Sobreescriptura de `isRecovered` a `onPointAccepted`

Fitxer: `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncForegroundService.java` (línies 159-162):

```java
private void onPointAccepted(LocationPoint point) {
    point.isRecovered = locationBuffer.getLastFlushFailed() || !isAppInForeground();
    locationBuffer.add(point, walkId);
}
```

Això marca com a recuperats punts que acaben de ser generats per `LocationAcquirer`, violant la definició acordada.

### 3.2 Histèresi invertida a `LocationBuffer`

Fitxer: `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationBuffer.java` (línies 47-60):

```java
public void onFlushFailure(List<LocationPoint> batch) {
    recoveryStreak = 0;
    lastFlushFailed = true;
    buffer.addAll(batch);
    store.save(buffer, true, recoveryStreak);
}

public void onFlushSuccess() {
    recoveryStreak++;
    if (recoveryStreak >= RECOVERY_STREAK_THRESHOLD) {
        lastFlushFailed = false;
    }
    store.clear();
}
```

La lògica correcta és:
- En flush fallit: incrementar `recoveryStreak`; si arriba al threshold, `lastFlushFailed = true`.
- En flush amb èxit: resetejar `recoveryStreak = 0` i `lastFlushFailed = false`.

### 3.3 Punts re-afegits no marcats com a recuperats

`LocationBuffer.onFlushFailure` fa `buffer.addAll(batch)` sense establir `isRecovered = true` als punts del batch. Encara que molts punts ja portin `isRecovered = true` per la sobreescriptura de `onPointAccepted`, això no està garantit per a tots els camins.

## 4. Impacte arquitectònic

Aquesta spec només toca la capa Android:

- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncForegroundService.java`
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationBuffer.java`
- Nou fitxer de tests JUnit: `LocationBufferTest.java`

**No es toquen:**
- El contracte del bridge TS.
- La capa iOS.
- El backend.
- El frontend.

## 5. Criteris d’acceptació

### AC-1 — Eliminar sobreescriptura de `isRecovered`
- [x] `LocationSyncForegroundService.onPointAccepted` només crida `locationBuffer.add(point, walkId)`.
- [x] No hi ha cap assignació a `point.isRecovered` a `LocationSyncForegroundService`.

### AC-2 — `LocationBuffer` marca punts persistits com a recuperats
- [x] Al constructor de `LocationBuffer`, després de `store.load()`, tots els punts carregats tenen `isRecovered = true`.

### AC-3 — Histèresi correcta
- [x] `onFlushFailure(List<LocationPoint> batch)`:
  - Incrementa `recoveryStreak`.
  - Estableix `lastFlushFailed = true` només si `recoveryStreak >= RECOVERY_STREAK_THRESHOLD`.
  - Re-afageix el batch al buffer amb `isRecovered = true`.
  - Persisteix el buffer.
- [x] `onFlushSuccess()`:
  - Estableix `recoveryStreak = 0`.
  - Estableix `lastFlushFailed = false`.
  - Neteja el buffer persistit.

### AC-4 — Tests JUnit
- [x] `test_initWithStoredPoints_marksAllRecovered`: carregar buffer amb punts → tots `isRecovered = true`.
- [x] `test_addNewPoint_isNotRecovered`: afegir punt nou → `isRecovered = false`.
- [x] `test_onFlushFailure_reAddsBatchAsRecovered`: flush fallit → punts re-afegits `isRecovered = true`.
- [x] `test_recoveryStreak_incrementsOnFailure`: 3 failures consecutius → `lastFlushFailed = true`.
- [x] `test_recoveryStreak_resetsOnSuccess`: 2 failures + 1 success → `lastFlushFailed = false`, `recoveryStreak = 0`.

### AC-5 — Cap regressió
- [x] `./gradlew :pathguard-location-sync:testDebugUnitTest` — 5/5 OK (JDK Android Studio a `/Volumes/Extern_Idoia/...`).
- [x] No es canvien constants GPS, permisos, ni el format JSON del payload.

### AC-6 — Prova de camp
- [~] Smoke 2026-08-01 (Redmi, APK post-`0f9d71d`, **sense moviment**): kill app → caregiver «Passeig actiu - Sense cobertura» (taronja, amb latència); reobrir → «En línia» (verd). Presència OK. `is_recovered` **no validable** sense punts GPS nous.
- [ ] Pendent: passeig amb moviment + butxaca i/o kill/reopen → verificar flags `is_recovered` a BD.

## 6. Riscos identificats

- **R1:** Canviar la histèresi pot fer que un únic flush fallit no marqui punts com a recuperats fins al tercer intent.
  - **Mitigació:** això és el comportament desitjat; evita falsos positius. Els AC especifiquen el threshold.
- **R2:** Eliminar la sobreescriptura de `isRecovered` pot fer que punts capturats en segon pla no es marquin fins al flush failure.
  - **Mitigació:** és correcte. Els punts en segon pla que s’envien amb èxit no són "recuperats". Només ho són si es van haver d’emmagatzemar per falta de connexió.
- **R3:** JUnit tests poden no executar-se si l’entorn de build Android no està disponible.
  - **Mitigació:** escriure els tests igualment; documentar si no es poden executar.

## 7. Pla d’implementació

**Branca:** `fix/SPEC-181-android-recovered-flag` (des de `develop`)

**Ordre:**

1. **Agent Android:** modifica `LocationSyncForegroundService.java`:
   - Elimina `point.isRecovered = ...` a `onPointAccepted`.
   - Manté `locationBuffer.add(point, walkId)`.

2. **Agent Android:** modifica `LocationBuffer.java`:
   - Corregir `onFlushFailure` per incrementar `recoveryStreak` i aplicar threshold.
   - Corregir `onFlushSuccess` per resetejar `recoveryStreak` i `lastFlushFailed`.
   - Assegurar que els punts re-afegits tinguin `isRecovered = true`.

3. **Agent Android:** crea `frontend/plugins/location-sync/android/src/test/java/com/pathguard/app/plugin/LocationBufferTest.java` amb els 5 tests de l’AC-4.

4. **Agent Android:** executa `./gradlew test` si és possible; si no, documenta el motiu.

5. **Tech Lead:** revisa el PR i autoritza merge a `develop`.

## 8. Pla de validació

- **Tests JUnit:** 5 nous tests passant.
- **Build:** `./gradlew assembleDebug` sense errors de compilació.
- **Field test:** Redmi, passeig 20 min amb sortida/reobertura de l’app.
- **QA sign-off:** AC-1 a AC-6 verificats.

## 9. Out of scope

- Canvis al frontend (mapa) — cobert per `integration-SPEC-180`.
- Canvis a iOS — coberts per `tech-SPEC-182`.
- Permisos runtime (ja implementats a SPEC-150).
- Foreground notification (post-beta).
- Retry HTTP amb backoff (post-beta).

## 10. Referències

- `integration-SPEC-180-buffer-recovery-cross-platform.md`
- `tech-SPEC-130-fix-presence-and-recovered.md` (fix equivalent a iOS)
- `tech-SPEC-150-android-foreground-robustness.md`
- `.cursor/skills/pathguard-agent-android/SKILL.md`
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncForegroundService.java`
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationBuffer.java`
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/BufferStore.java`

## 11. Field test notes (2026-08-01)

**Walk 144** — 9/19 punts amb `is_recovered=true` (942–950) durant repòs del telèfon.

### Semàntica acordada (no implementar encara)

La revisió de producte del 2026-08-01 clarifica que **aquests punts no són necessàriament «mal etiquetats»**:

- `true` = punt que ha passat pel **buffer local** (repòs, flush fallit, persistència) abans d'arribar al backend.
- `false` = transmissió **en viu** amb app en primer pla i xarxa OK.

El mapa del cuidador (blau sòlid vs taronja discontinu) reflecteix correctament el flag emmagatzemat.

### Què ha de corregir SPEC-181 (quan s'implementi)

No eliminar el flag `true` en repòs; **canviar com s'estableix**:

1. **Eliminar** `point.isRecovered = getLastFlushFailed() || !isAppInForeground()` a `onPointAccepted`.
2. Marcar `isRecovered = true` només quan el punt **entra al buffer per persistència/flush fallit** o es **carrega des de disc** (constructor `LocationBuffer`).
3. Corregir histèresi invertida a `onFlushFailure` / `onFlushSuccess` (AC-3).

Això alinea el mecanisme amb iOS (SPEC-130) i amb `integration-SPEC-180` AC-1, sense contradir l'expectativa del cuidador en repòs.

### Estat de planificació

- **2026-08-01 (matí):** implementació aparcada per prioritat Fase 1 (higiene repo).
- **2026-08-01 (tarda):** Fase 2 implementada a `fix/SPEC-181-android-recovered-flag`. AC-1..AC-5 OK. Pendent AC-6 field test + merge `main` + APK nou.
