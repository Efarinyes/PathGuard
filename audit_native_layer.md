# AUDITORIA INICIAL — Capa Nativa i Arquitectura Híbrida PathGuard

**Data:** 2026-06-16  
**Branca analitzada:** `feat/ios-native-layer`  
**Àmbit:** Plugins Capacitor natius iOS/Android, PWA, backend, seguretat i geolocalització  
**Estat:** Només anàlisi. Cap fitxer modificat.

---

## Resum executiu

L'arquitectura general de PathGuard és sòlida i ben separada per capes. El backend FastAPI té bona cobertura de tests, el frontend Next.js segueix SRP i els plugins natius (després del refactor Sprint 3) tenen responsabilitats clares.

Els problemes més greus que he detectat són:

1. **El plugin Android està trencat** — tres fitxers essencials han estat esborrats i el codi actual fa referència a classes inexistents.
2. **La implementació iOS és molt recent i no ha passat proves de camp** — i hi ha una incoherència greu: si un flush falla, els punts no es reintenteixen (es perden).
3. **La capa PWA fa servir dos sistemes de GPS simultanis** (`LocationSync` natiu + `@capacitor/geolocation`), cosa que pot provocar duplicats o inconsistències.
4. **El `device_token` és permanent i no es pot revocar** — un risc de seguretat important per a una app de seguiment de persones.
5. **La presència WebSocket viu en memòria** — funciona per a la beta, però no escala a múltiples workers.

---

## Punts forts detectats

- Separació de responsabilitats clara als plugins natius iOS: `LocationAcquirer`, `LocationBuffer`, `BufferStore`, `LocationHttpClient`, `LocationSyncService`, `LocationSyncPlugin`.
- Persistència offline del buffer amb `lastFlushFailed` i recuperació per histeresi.
- `client_id` determinista SHA-256 per evitar duplicats a la base de dades.
- Backend robust: validació de coordenades, upsert per `client_id`, presència híbrida HTTP/WebSocket.
- Configuració de permisos iOS presenta: `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationWhenInUseUsageDescription`, `UIBackgroundModes: location`.
- Filosofia de producte coherent: UI calmada, simple i no invasiva.

---

## Riscos i punts febles

### 1. Plugin Android trencat per fitxers esborrats

**Localització:** `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/`

**Severitat:** Crítica

**Problema:**
Els fitxers `BufferStore.java`, `LocationHttpClient.java` i `LocationSyncForegroundService.java` han estat esborrats. Ara mateix `LocationSyncPlugin.java` fa referència a `LocationSyncForegroundService`, que ja no existeix. El plugin no pot compilar-se.

**Impacte:**
Cap build futur d'Android funcionarà. Si el desplegament de producció inclou Android, aquesta branca és inusable.

**Per què és un problema:**
És una regressió directa. El codi font i les dependències no coincideixen.

**Solució recomanada:**
- Opció A: Restaurar els fitxers esborrats des de git (`git checkout` de la darrera versió vàlida).
- Opció B: Si s'ha fet un refactor equivalent al d'iOS, cal completar-lo a Android i actualitzar `LocationSyncPlugin.java` perquè no referenciï el servei esborrat.

**Tests necessaris:**
- Compilació Gradle del mòdul Android.
- `npx cap sync android` + build.
- Test end-to-end d'iniciar i aturar un passeig a Android.

**Esforç estimat:** Mitjà (1-2 dies si es recuperen del git; més si cal reimplementar).

**Prioritat:** Crítica.

---

### 2. Implementació iOS no validada a camp i incoherències amb el pla

**Localització:** `frontend/plugins/location-sync/ios/Plugin/`

**Severitat:** Alta

**Problema:**
El codi iOS difereix del pla `docs/ios-native-layer-plan.md` i del comportament d'Android en diversos punts:

- `LocationBuffer.onFlushResult(_ success: Bool)` té la lògica d'histeresi invertida respecte al pla.
- `LocationSyncService` usa `Timer` per al flush de 2s en lloc de `DispatchSourceTimer`. El pla advertia que `Timer` es pausa en background.
- `LocationAcquirer` demana `requestAlwaysAuthorization()` directament, però `@capacitor/geolocation` també demana permisos des del frontend, creant una doble petició.
- `markBackgrounded()` i `markForegrounded()` estan buits.
- No hi ha notificació foreground persistent a iOS (a Android sí que n'hi ha).

**Impacte:**
Possible pèrdua de punts en background, comportament diferent d'Android, i experiència inconsistent.

**Per què és un problema:**
"Funciona" en un test ràpid no garanteix fiabilitat en un passeig real de 30 minuts amb background, offline i canvis de cobertura.

**Solució recomanada:**
- Corregir la lògica d'histeresi perquè coincideixi amb Android.
- Avaluar si cal canviar el `Timer` de 2s per `DispatchSourceTimer` per garantir flush en background.
- Centralitzar la gestió de permisos: que el plugin o el frontend demanin permisos, però no tots dos.
- Considerar afegir una notificació local persistent mentre el tracking estigui actiu.

**Tests necessaris:**
- Unit tests Swift per a `LocationBuffer`, `LocationAcquirer` gates.
- Build Xcode + crides des de JavaScript.
- Tests de permisos amb cada estat possible.
- Proves de camp: passeig real de 15-30 min amb mode avió i background.

**Esforç estimat:** Alt (2-4 dies).

**Prioritat:** Alta.

---

### 3. Doble sistema de GPS a `useLocationTracking.ts`

**Localització:** `frontend/hooks/useLocationTracking.ts`

**Severitat:** Alta

**Problema:**
El hook utilitza dos sistemes diferents segons el context:

- Si `isNative && trackingConfig`: utilitza `LocationSync.startTracking()`.
- Si no: utilitza `@capacitor/geolocation.watchPosition()` o `navigator.geolocation.watchPosition()`.

A més, quan es para el tracking natiu, intenta fer `clearWatch` amb `watchId = "location-sync"`, que no és un ID real de `Geolocation`.

**Impacte:**
Risc de doble captura, doble enviament de punts, o crides a `clearWatch` amb un ID invàlid.

**Per què és un problema:**
Violació de SRP. Un hook amb tres modes diferents és difícil de testejar i propens a errors.

**Solució recomanada:**
Refactoritzar `useLocationTracking` perquè utilitzi una sola font de veritat:

- Si estem en natiu i el plugin `LocationSync` està disponible: tot passa pel plugin.
- Si no: fallback al navegador.

No barrejar `Geolocation` natiu com a fallback.

**Tests necessaris:**
- Unit tests amb mock del plugin `LocationSync`.
- Unit tests per al fallback del navegador.
- Test d'integració per verificar que no es criden dos watchers simultanis.

**Esforç estimat:** Mitjà (1-2 dies).

**Prioritat:** Alta.

---

### 4. `device_token` permanent i sense revocació

**Localització:** `backend/app/db/models/patient.py`, `frontend/hooks/useAppState.tsx`

**Severitat:** Alta

**Problema:**
El `device_token` és un UUID generat un cop i utilitzat per sempre com a credencial del dispositiu. No expira, no es pot revocar des del dashboard, i es guarda a `localStorage`. Si un dispositiu es perd o es compromet, no hi ha manera d'invalidar-lo.

**Impacte:**
Risc de seguretat i privacitat. Accés no autoritzat permanent si el token filtra.

**Per què és un problema:**
Per a una app de seguiment de persones vulnerables, la revocació de dispositius és essencial.

**Solució recomanada:**
- Afegir una columna `device_token_revoked_at` o `is_active` al model `Patient`.
- Crear endpoint owner per regenerar/revocar el token.
- Validar que el `device_token` estigui actiu a `get_patient_from_device_token`.
- Considerar emmagatzemar el token a `Capacitor Preferences` en lloc de `localStorage` per a natiu.

**Tests necessaris:**
- Unit test: token revocat retorna 401.
- Integration test: regeneració de token des del dashboard owner.
- End-to-end: login amb token antic falla després de revocar.

**Esforç estimat:** Mitjà (2-3 dies).

**Prioritat:** Alta.

---

### 5. WebSocket presence en memòria

**Localització:** `backend/app/api/websocket/connection_manager.py`

**Severitat:** Mitjana

**Problema:**
`ConnectionManager` manté connexions, estats de presència i `last_http_location_at` en memòria dins d'un sol procés. Si el backend escala a més d'un worker, cada instància tindrà el seu propi estat i els broadcasts no arribaran a tots els usuaris.

**Impacte:**
Amb un sol procés Render funciona. En creixement, fallarà.

**Per què és un problema:**
Limita l'escalabilitat horitzontal i fa el sistema menys resilient.

**Solució recomanada:**
Post-beta, migrar la presència i els `group_rooms` a Redis amb Pub/Sub.

**Tests necessaris:**
- Integration tests amb múltiples workers.
- Load tests amb connexions concurrents.

**Esforç estimat:** Alt (1-2 setmanes).

**Prioritat:** Mitjana.

---

### 6. Permisos iOS: doble petició i `always` immediat

**Localització:** `frontend/plugins/location-sync/ios/Plugin/LocationAcquirer.swift`, `frontend/hooks/useLocationTracking.ts`

**Severitat:** Mitjana

**Problema:**
Apple requereix justificació estricta per a `always`. Si es demana immediatament, l'usuari pot escollir "When In Use", i llavors el tracking en background pot fallar. A més, hi ha una doble petició: el plugin demana `always` i `@capacitor/geolocation` també demana permisos.

**Impacte:**
En proves de camp, si l'usuari escull "When In Use", el tracking en background pot aturar-se.

**Per què és un problema:**
El background és essencial per a un passeig real.

**Solució recomanada:**
- Separar la petició: primer `requestWhenInUseAuthorization()`, i només després `requestAlwaysAuthorization()` quan sigui necessari.
- Gestionar `locationManagerDidChangeAuthorization` per informar el JS de l'estat real.
- Centralitzar qui demana permisos (plugin o frontend, però no tots dos).

**Tests necessaris:**
- Tests de permisos amb cada estat possible.
- Proves de camp amb "When In Use" seleccionat.

**Esforç estimat:** Baix (1 dia).

**Prioritat:** Mitjana.

---

### 7. `LocationHttpClient` no gestiona retries

**Localització:** `frontend/plugins/location-sync/ios/Plugin/LocationHttpClient.swift`

**Severitat:** Mitjana

**Problema:**
Utilitza `URLSessionConfiguration.default` sense política de retries. En una xarxa dolenta, un sol `dataTask` pot fallar i marcar tot el batch com a fallit.

**Impacte:**
Pèrdua ocasional de punts en condicions de xarxa marginal.

**Per què és un problema:**
El buffer hauria de recuperar-se, però sense retry explícit depèn de l'idle timer.

**Solució recomanada:**
Afegir un retry exponencial simple (màxim 3 intents) abans de donar el batch per fallit.

**Tests necessaris:**
- Unit tests amb `URLProtocol` mock per simular errors.
- Integration tests: mode avió + reconnect.

**Esforç estimat:** Baix (1 dia).

**Prioritat:** Mitjana.

---

### 8. Pèrdua de punts en flush fallit a iOS

**Localització:** `frontend/plugins/location-sync/ios/Plugin/LocationSyncService.swift` i `LocationBuffer.swift`

**Severitat:** Alta

**Problema:**
`flushBuffer()` fa `drainAll()` i després crida `buffer.onFlushResult(false)`. A `LocationBuffer.onFlushResult(false)` només es fa `lastFlushFailed = true` i `save()`. NO es re-afageix el batch al buffer. Per tant, els punts que fallen no es guarden per a reintents posteriors.

**Impacte:**
En cas d'error de xarxa durant un flush, els punts poden perdre's.

**Per què és un problema:**
Això contradueix la filosofia "zero pèrdua de dades" i el comportament d'Android (`LocationBuffer.java` re-afageix el batch en cas de fallada).

**Solució recomanada:**
Modificar `LocationBuffer.onFlushResult(false)` per re-afegir el batch al buffer, marcant els punts com a `isRecovered = true`, i limitar-lo a 200 punts.

**Tests necessaris:**
- Unit test: flush fallit → batch es re-afageix i `isRecovered = true`.
- Integration test: mode avió → punts persisteixen i es reenvien.

**Esforç estimat:** Baix (1-2 hores).

**Prioritat:** Alta.

---

### 9. Primer punt incondicional a `LocationAcquirer`

**Localització:** `frontend/plugins/location-sync/ios/Plugin/LocationAcquirer.swift`

**Severitat:** Baixa

**Problema:**
L'`antiJitterGate` requereix 15m de distància des de l'últim punt acceptat. En proves estàtiques o interiors, pot semblar que "no funciona" perquè rebutja els primers punts.

**Impacte:**
Frustració en proves curtes o estàtiques.

**Per què és un problema:**
No és un bug de disseny, però cal tenir-ho en compte per interpretar els resultats de camp.

**Solució recomanada:**
Cap canvi necessari si es fa servir a camp. Opcionalment, acceptar el primer punt després d'un `start()` incondicionalment per a tests interiors.

**Tests necessaris:**
- Proves de camp.

**Esforç estimat:** Mínim.

**Prioritat:** Baixa.

---

### 10. `useOfflineRecovery.ts` crida mètodes del bridge sense verificar si hi ha tracking actiu

**Localització:** `frontend/hooks/useOfflineRecovery.ts`

**Severitat:** Baixa

**Problema:**
Aquest hook es munta a tota l'app i crida `LocationSync.markBackgrounded()` / `markForegrounded()` en cada canvi de visibilitat, encara que no hi hagi cap walk actiu. A iOS aquests mètodes estan buits, però generen trànsit innecessari al bridge.

**Impacte:**
Soroll al bridge, logs confusos, possible impacte mínim de bateria.

**Per què és un problema:**
Falten guardes d'estat.

**Solució recomanada:**
Verificar si hi ha tracking actiu abans de cridar `markBackgrounded`/`markForegrounded`, o moure aquesta lògica dins `useLocationTracking`.

**Tests necessaris:**
- Unit test: no es criden els mètodes si no hi ha tracking actiu.

**Esforç estimat:** Mínim.

**Prioritat:** Baixa.

---

### 11. Estat mutable a `locationService.ts`

**Localització:** `frontend/services/locationService.ts`

**Severitat:** Baixa

**Problema:**
`LocationService` manté `batchBuffer`, `batchTimer` i `isSyncing` com a propietats de classe. Això fa que els tests necessitin `_resetInternalState()`.

**Impacte:**
Risc de contaminació entre tests, però controlat.

**Per què és un problema:**
Deute tècnic menor.

**Solució recomanada:**
Considerar instanciar `LocationService` per test, o acceptar el backdoor `_resetInternalState()` i documentar-ho.

**Tests necessaris:**
- Ja hi ha tests que ho cobreixen.

**Esforç estimat:** Mínim.

**Prioritat:** Baixa.

---

### 12. URL de Vercel hardcoded a `capacitor.config.json`

**Localització:** `frontend/ios/App/App/capacitor.config.json`

**Severitat:** Baixa

**Problema:**
`"url": "https://path-guard-orpin.vercel.app"` està hardcoded. Si es desplega a un altre entorn o preview, l'app iOS carregarà la versió de producció.

**Impacte:**
Dificulta tests en entorns de staging/preview.

**Per què és un problema:**
Configuració d'entorn no parametritzada.

**Solució recomanada:**
Generar `capacitor.config.json` via script de build segons l'entorn.

**Tests necessaris:**
- Test de build per staging.

**Esforç estimat:** Baix.

**Prioritat:** Baixa.

---

### 13. `Info.plist` requereix `armv7` però iPhone 8 és `arm64`

**Localització:** `frontend/ios/App/App/Info.plist`

**Severitat:** Baixa

**Problema:**
`UIRequiredDeviceCapabilities` inclou `armv7`. L'iPhone 8 utilitza `arm64`. Podria generar advertències d'App Store.

**Impacte:**
Possible advertència o rebuig a l'App Store si s'envia com a app universal.

**Per què és un problema:**
Configuració obsoleta.

**Solució recomanada:**
Canviar `armv7` per `arm64` o eliminar la clau si no hi ha restriccions d'hardware.

**Tests necessaris:**
- Build per a dispositiu físic iPhone 8.
- Validació d'App Store Connect.

**Esforç estimat:** Mínim.

**Prioritat:** Baixa.

---

### 14. Falta de tests unitaris als plugins natius

**Localització:** `frontend/plugins/location-sync/ios/` i `frontend/plugins/location-sync/android/`

**Severitat:** Mitjana

**Problema:**
No hi ha cap test unitari ni d'integració per als plugins natius. Tot depèn de tests manuals de camp.

**Impacte:**
Regressions difícils de detectar; cost alt de verificació.

**Per què és un problema:**
Les capes natives són crítiques i propenses a diferències entre dispositius.

**Solució recomanada:**
- iOS: target de test XCTest amb mocks de `CLLocationManager` i `URLProtocol`.
- Android: tests JUnit per a `LocationAcquirer`, `LocationBuffer` i `BufferStore`.

**Tests necessaris:**
- Unit tests pels gates GPS.
- Unit tests per persistència i histeresi del buffer.
- Unit tests per serialització del batch HTTP.

**Esforç estimat:** Alt (3-5 dies).

**Prioritat:** Mitjana.

---

### 15. Selectors de `NotificationCenter` poc clars

**Localització:** `frontend/plugins/location-sync/ios/Plugin/LocationSyncService.swift`

**Severitat:** Baixa

**Problema:**
Els selectors `applicationDidBecomeActive` i `applicationWillResignActive` estan definits sense paràmetre. `NotificationCenter` passa l'objecte `Notification`, però no és visible a la signatura.

**Impacte:**
Cap funcional, però fa el codi menys comprensible.

**Per què és un problema:**
Neteja de codi.

**Solució recomanada:**
Definir els selectors amb `@objc private func applicationDidBecomeActive(_ notification: Notification)` o eliminar-los si no fan res.

**Tests necessaris:**
- Cap test funcional addicional.

**Esforç estimat:** Mínim.

**Prioritat:** Baixa.

---

## Preguntes pendents

1. **Android és intencionadament trencat en aquesta branca?** Els fitxers `BufferStore.java`, `LocationHttpClient.java` i `LocationSyncForegroundService.java` apareixen esborrats a git. És un error o forma part d'un refactor en curs?
2. **Quin és el pla de proves de camp per a iOS?** Es farà un passeig controlat amb l'iPhone 8? Es provarà mode avió, background i kill app?
3. **Es desplegarà Android i iOS simultàniament a beta, o només un d'ells?** Això afecta la prioritat de restaurar Android.
4. **Existeix algun mecanisme de revocació de `device_token` previst al roadmap?** És un requisit de seguretat important.
5. **S'ha considerat l'ús de `Capacitor Preferences` en lloc de `localStorage` per als tokens en natiu?**
6. **El backend té previst escalar a múltiples workers a curt termini?** Això determina si cal abordar la presència en memòria ara o post-beta.

---

## Matís important

Tant el frontend com el backend estan desplegats a Vercel i Render respectivament. Això significa que:

- Les proves de camp utilitzaran els entorns reals de producció.
- Qualsevol canvi a `capacitor.config.json` o a l'URL del servidor requereix redeploy de l'app nativa.
- Els tests de camp són crítics per validar el comportament real del plugin iOS, especialment en background i amb canvis de cobertura.
