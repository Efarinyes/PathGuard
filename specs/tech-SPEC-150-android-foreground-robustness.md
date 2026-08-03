---
id: tech-SPEC-150
title: Android foreground service robustness for 2h walks
type: tech
status: draft
priority: P0
created: 2026-07-06
author: tech-lead
agents_affected:
  - android
  - frontend
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: 0006
---

# Spec: Android Foreground Service robustness for 2h walks

## 1. Objectiu

Garantir que la capa Android del plugin `LocationSync` continuï capturant i enviant posicions GPS durant passejos de fins a 2 hores amb la pantalla apagada, igual que la capa iOS, resolent els 4 punts crítics identificats a l'auditoria tècnica del 2026-07-06 (C-1, C-2, C-3, C-4).

## 2. Context

L'auditoria tècnica completa del codi natiu d'ambdues plataformes ha identificat 4 punts crítics que impedeixen a Android funcionar com iOS en el mateix escenari:

- **C-1 (Crítica):** `AndroidManifest.xml` no declara `ACCESS_BACKGROUND_LOCATION`, permís obligatori des d'Android 10 (API 29) per rebre posicions quan l'app està en segon pla.
- **C-2 (Crítica):** El Foreground Service no utilitza `PowerManager.WAKE_LOCK` ni un `HandlerThread` propi per al `LocationCallback`, per la qual cosa Doze mode pot suspendre l'entrega de posicions. Tampoc inicialitza correctament el flag `appInForeground`.
- **C-3 (Crítica):** La PWA `useLocationTracking.ts` continua usant `Geolocation.watchPosition` del package `@capacitor/geolocation` com a fallback quan ja existeix el plugin natiu `LocationSync`. Això duplica consum, pot generar duplicats al backend i viola ADR-0004.
- **C-4 (Crítica):** `walkId` no s'emmagatzema dins de `LocationPoint`; només s'envia al payload HTTP. Si el service és recreat per `START_STICKY` i s'actualitza el `walkId`, els punts antics del buffer s'envien sota el walkId actual, creant punts fantasma al backend.

Això provoca que en dispositius Android reals (Xiaomi, Samsung, Huawei), la transmissió de posicions s'aturi molt abans que en iOS, mentre que iOS aguanta 2 hores gràcies a `UIBackgroundModes: location` + `allowsBackgroundLocationUpdates = true` + `pausesLocationUpdatesAutomatically = false`.

## 3. Problema

**Comportament actual (Android 10+ amb pantalla apagada 5-30 min):**
- El sistema deixa de lliurar posicions al callback de `FusedLocationProviderClient` sense error explícit.
- Fabricants agressius (MIUI, One UI, EMUI) maten el FGS completament en 5-20 min.
- Si el service es reinicia per `START_STICKY` enmig d'un canvi de `walkId`, es poden barrejar punts de walks diferents.

**Comportament desitjat (Android 10+ amb pantalla apagada ≥ 2h):**
- Continuïtat de captura GPS amb 0 pèrdua.
- 0 duplicats al backend.
- Recuperació estable després de kill del SO.

## 4. Impacte arquitectònic

Aquesta spec toca 2 agents:

- **Android:** canvis al `AndroidManifest.xml`, `LocationSyncForegroundService.java`, `LocationSyncPlugin.java`, `LocationPoint.java`, `LocationBuffer.java`, `LocationAcquirer.java`, `LocationHttpClient.java`.
- **Frontend:** refactor de `useLocationTracking.ts` per adherir-se a ADR-0004 i ADR-0006.

**No es toquen**:
- El contracte del bridge TS (`frontend/plugins/location-sync/src/index.ts`) — immutable segons SPEC-040.
- La capa iOS — funciona correctament.
- El backend — ja rep i valida correctament.

**ADR referenciat**: ADR-0006 (centralized-permissions, `proposed` — es proposa sign-off simultani a aquesta spec).

## 5. Criteris d'acceptació

### C-1: Permisos al manifest Android

- [ ] **AC-1.1:** `AndroidManifest.xml` declara `<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />`.
- [ ] **AC-1.2:** `AndroidManifest.xml` declara `<uses-permission android:name="android.permission.WAKE_LOCK" />`.
- [ ] **AC-1.3:** `LocationSyncPlugin.startTracking` valida el permís `ACCESS_BACKGROUND_LOCATION` en runtime (API 29+).
- [ ] **AC-1.4:** Si el permís no està concedit, `startTracking` retorna error amb codi `permission_denied` (alineat amb ADR-0006).
- [ ] **AC-1.5:** El flow de petició segueix la recomanació oficial Android: 1) demanar `ACCESS_FINE_LOCATION` primer, 2) mostrar rationale, 3) enviar l'usuari a Configuració per concedir "Permetre tot el temps".

### C-2: WakeLock + HandlerThread

- [ ] **AC-2.1:** `LocationSyncForegroundService.onCreate` adquireix `PowerManager.PARTIAL_WAKE_LOCK` i l'allibera a `onDestroy` (amb `try/finally`).
- [ ] **AC-2.2:** `LocationAcquirer.start` usa un `HandlerThread` propi (no `Looper.getMainLooper()`) per al `LocationCallback`.
- [ ] **AC-2.3:** `appInForeground` a `LocationSyncForegroundService` s'inicialitza amb `ActivityManager.RunningAppProcessInfo`, no pas a `true` per defecte.
- [ ] **AC-2.4:** El `HandlerThread` s'atura correctament a `LocationAcquirer.stop` (no leak).

### C-3: PWA 1 sola font GPS

- [ ] **AC-3.1:** `useLocationTracking.ts` NO crida `Geolocation.watchPosition` quan `isNative === true` i el plugin `LocationSync` està disponible.
- [ ] **AC-3.2:** `useLocationTracking.ts` delega la petició de permisos al plugin (no al `@capacitor/geolocation`), segons ADR-0006.
- [ ] **AC-3.3:** Tests Vitest cobreixen el path natiu: 1 watcher (`LocationSync`), 0 watch (`Geolocation`).
- [ ] **AC-3.4:** Tests Vitest cobreixen el path web: `navigator.geolocation.watchPosition` quan `!isNative`.

### C-4: walkId dins de LocationPoint

- [ ] **AC-4.1:** `LocationPoint.java` té camp `walkId` (int).
- [ ] **AC-4.2:** `LocationBuffer.add(point, walkId)` assigna el walkId actual al punt abans d'afegir-lo.
- [ ] **AC-4.3:** `LocationHttpClient.sendBatch` envia cada punt amb el seu propi `walkId` (no pas el del paràmetre).
- [ ] **AC-4.4:** `clientId` SHA-256 continua determinant (inclou `walkId` en el hash) — la idempotència es manté.
- [ ] **AC-4.5:** `LocationPoint.toJson/fromJson` inclou `walkId` per persistència (SharedPreferences).

## 6. Riscos identificats

- **R1:** Regressió en captura GPS per canvis de looper — **mitigat** amb els gates existents a `LocationAcquirer` (accuracy, anti-jitter, teleport, speed, fix-age) i validació de camp.
- **R2:** WakeLock mal alliberat → consum extra de bateria — **mitigat** amb `try/finally` i alliberament garantit a `onDestroy`.
- **R3:** Conflicte de merge amb `develop` — **mitigat** obrint la branca des de develop i fent rebase si cal.
- **R4:** OEM killing (Xiaomi/Samsung/Huawei) no es pot resoldre 100% per codi — **mitigat** amb WakeLock + foreground service type correcte, i documentat al README per a l'usuari (afegir app a "Bateria → Sense restriccions").
- **R5:** La petició en 2 passos de `ACCESS_BACKGROUND_LOCATION` pot confondre l'usuari — **mitigat** amb missatges clars en català i enllaç directe a Configuració.
- **R6:** El canvi a `HandlerThread` pot afectar timings de flush — **mitigat** validant que el `ScheduledExecutorService` continua executant-se al seu propi thread independent.

## 7. Pla d'implementació

**Branca:** `fix/SPEC-150-android-foreground-robustness` (des de `develop`)

### 7.1 Agent Android (canvis natius)

| Ordre | Fitxer | Canvi |
|---|---|---|
| 1 | `frontend/android/app/src/main/AndroidManifest.xml` | Afegir `ACCESS_BACKGROUND_LOCATION` i `WAKE_LOCK` (AC-1.1, AC-1.2) |
| 2 | `frontend/plugins/location-sync/android/.../LocationSyncPlugin.java` | Flow de petició de permís en 2 passos; validar runtime (AC-1.3, AC-1.4, AC-1.5) |
| 3 | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` | Adquirir `PARTIAL_WAKE_LOCK`; inicialitzar `appInForeground` correctament (AC-2.1, AC-2.3) |
| 4 | `frontend/plugins/location-sync/android/.../LocationAcquirer.java` | Usar `HandlerThread` propi; alliberar-lo a `stop` (AC-2.2, AC-2.4) |
| 5 | `frontend/plugins/location-sync/android/.../LocationPoint.java` | Afegir camp `walkId`; incloure a `toJson/fromJson` (AC-4.1, AC-4.5) |
| 6 | `frontend/plugins/location-sync/android/.../LocationBuffer.java` | `add(point, walkId)` assigna walkId; persistir-lo correctament (AC-4.2) |
| 7 | `frontend/plugins/location-sync/android/.../LocationHttpClient.java` | Derivar `walkId` per punt al payload (AC-4.3, AC-4.4) |

### 7.2 Agent Frontend (canvis PWA)

| Ordre | Fitxer | Canvi |
|---|---|---|
| 1 | `frontend/hooks/useLocationTracking.ts` | Eliminar `Geolocation.watchPosition` quan `isNative === true`; delegar permisos al plugin (AC-3.1, AC-3.2) |
| 2 | `frontend/hooks/useLocationTracking.test.ts` | Tests per al path natiu (1 watcher = 1 font) i path web (AC-3.3, AC-3.4) |

### 7.3 Validació i merge

1. Tests: `tsc --noEmit`, `npm test`, `pytest`.
2. Build: `./gradlew assembleDebug` (intentar; el disc extern pot bloquejar).
3. Commit per subtask amb Conventional Commits.
4. PR a `develop` quan tots els AC estiguin verificats.
5. Merge a `develop` quan l'usuari doni el vistiplau.
6. Merge a `main` per desplegar (Vercel + Render) — autorització explícita de l'usuari.

## 8. Pla de validació

- **Tests Gradle:** `./gradlew assembleDebug` exit (intentar; pot fallar per permisos de disc extern documentats a STATE.json).
- **Tests Vitest:** baseline 108/108 → objectiu 110/110 (2 nous escenaris a C-3).
- **Tests JUnit:** no existeixen al plugin (deute tècnic SPEC-110) — fora d'abast.
- **Tests backend:** 152/152 sense canvis (no s'ha tocat el backend).
- **Field test (Redmi) — target producte ~45–60 min(no 2h):**
  - Screen-off / butxaca des dels primers minuts (escenari crític)
  - 1 kill app + reobrir a mitja passejada
  - Criteri d'èxit: densitat de punts acceptable a la butxaca; 0 pèrdua massiva; mapa cuidador coherent.
- **Cross-capa:** format JSON del payload Android idèntic al d'iOS.
- **QA sign-off:** tots els AC verificats, tests passen, field test documentat.

## 9. Out of scope

- Tests JUnit al plugin Android (deute tècnic, cobert per SPEC-110).
- NWPathMonitor equivalent a Android (`ConnectivityManager.NetworkCallback` és post-beta).
- RECEIVE_BOOT_COMPLETED per sobreviure a un reboot (post-beta; la PWA ja té `walkId` persistent).
- Drawable propi per a la notificació (I-1, post-beta).
- iOS — funciona correctament, no es toca.

## 10. Referències

- [Auditoria tècnica 2026-07-06] (sessió actual) — C-1, C-2, C-3, C-4.
- [Android Developers — Background location](https://developer.android.com/develop/sensors-and-location/location/background-location) — referència per a ACCESS_BACKGROUND_LOCATION.
- [Android Developers — Foreground services](https://developer.android.com/develop/background-work/services/fgs) — referència per a FGS amb `location` type.
- [Android Developers — Power management (WakeLock)](https://developer.android.com/reference/android/os/PowerManager) — referència per a `PARTIAL_WAKE_LOCK`.
- [Android Developers — Doze](https://developer.android.com/develop/background-work/background-tasks/doze-standby) — referència per a Doze.
- [Android Developers — FusedLocationProviderClient](https://developer.android.com/develop/sensors-and-location/location/retrieve-current) — referència per a location updates.
- `docs/decisions/0004-single-gps-source.md` (ADR-0004) — 1 sola font GPS.
- `docs/decisions/0006-centralized-permissions.md` (ADR-0006) — permisos centralitzats al plugin.
- `specs/integration-SPEC-020-consolidate-gps-capture.md` (SPEC-020) — C-3 ja previst a 020.4, però no implementat.
- `specs/tech-SPEC-040-bridge-contract-v2.md` (SPEC-040) — contracte immutable, no es toca.
- `.cursor/skills/pathguard-agent-android/SKILL.md` — guia del plugin Android.
- `.cursor/skills/pathguard-agent-frontend/SKILL.md` — guia del frontend.
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncForegroundService.java` — fitxer a modificar.
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationAcquirer.java` — fitxer a modificar.
- `frontend/hooks/useLocationTracking.ts` — fitxer a modificar.

---

**Notes:**

- Aquesta spec no toca iOS. Si després calen canvis iOS, seran specs separades.
- L'ordre d'implementació és important: C-1 (manifest) primer, després C-2 (WakeLock), després C-4 (walkId), finalment C-3 (PWA). C-3 depèn conceptualment de C-1+C-2 perquè el plugin ha de ser robust perquè la PWA no necessiti fallback.
- El field test al Redmi és l'última línia de validació. Si el test falla, no es fusiona a main.
- ADR-0006 està `proposed`; aquesta spec proposa el sign-off simultani.

## 11. Field test notes (2026-08-01)

**Walk 144** — passeig real ~35 min (Android Redmi, permís «mentre s'utilitza», post-fix `4b1c9eb` / merge `f96ae5c`).

| Criteri | Resultat |
|---|---|
| GPS transmet / mapa / BD | **OK** — 19 punts, mapa cuidador estable |
| C-1 gate background | **REVISAT OK** — `startTracking` no bloqueja amb while-in-use |
| Continuïtat GPS en repòs | **Sospita KO** — forats llargs (950→951 ~7 min, 951→952 ~8 min) |
| Passeig 2h screen-off | **Pendent** — no tancat |

**Observació de camp:** el sistema Android sembla reduir la freqüència o aturar l'adquisició GPS quan el mòbil entra en repòs, encara amb l'app oberta i FGS actiu. Cal prova controlada Fase 3 (30–60 min + 15–30 min pantalla apagada) abans de marcar SPEC-150 com `validated`.

**Relació amb SPEC-181:** els blocs `is_recovered=true` durant repòs són coherents amb la semàntica de producte (veure SPEC-180 §11); el problema obert aquí és la **densitat de punts**, no el flag.

### Prioritat producte (2026-08-01)

- Target: passejos curts ≤ ~1h; telèfon a la butxaca.
- Backlog candidat (no implementat): keep-alive periòdic no invasiva durant passeig actiu; opcionalment **caregiver → force location** (wake + flush buffer sota demanda). Veure pla post-GPS.
