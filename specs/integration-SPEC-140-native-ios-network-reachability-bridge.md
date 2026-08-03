---
id: integration-SPEC-140
title: Native iOS network reachability bridge for WebSocket reconnect
type: integration
status: implementing
priority: P0
created: 2026-07-05
author: tech-lead
agents_affected:
  - platform-integration
  - ios
  - frontend
reviewer: tech-lead
blocked_by:
  - R-P0-NEW-1
replaces: null
supersedes:
  - tech-SPEC-130 # R-P0-NEW-1 scope only; R-P0-NEW-3 remains resolved by SPEC-130
adr: null
---

# Spec: Native iOS network reachability bridge for WebSocket reconnect

## 1. Objectiu

Desbloquejar **R-P0-NEW-1** fent que la capa nativa iOS detecti canvis reals de
connectivitat de xarxa (via `NWPathMonitor`) i notifiqui la PWA via el bridge
de Capacitor. El frontend rebrà un event natiu fiable que forçarà la
reconnexió del WebSocket quan la xarxa torni, independentment del comportament
erroni de `navigator.onLine` i dels timers de `WKWebView`.

## 2. Context

- **R-P0-NEW-1** persisteix després de `tech-SPEC-130`. El desplegament a
  `main` (commit `1cd95f1`) amb polling de salut JS cada 15s **no** ha
  resolt el problema a l'iPhone 8 real.
- `WKWebView` (Capacitor iOS) no dispara l'event `online` quan es desactiva el
  pèrdua de connexió. `navigator.onLine` també pot reportar `true` quan no hi ha
  connectivitat real.
- El polling `setInterval` dins del WebView no reconnecta quan el WS queda en
  un estat "mort" després de la pèrdua de xarxa; els timers del WebView es
  comporten de manera inconsistent quan la pantalla s'apaga o l'app passa a
  background.
- La solució anterior (SPEC-130) era purament JS. La solució definitiva requereix
  una font de veritat nativa que no depengui del cicle de vida del WebView.

## 3. Problema

Quan un pacient amb iOS activa i desactiva el pèrdua de connexió durant un passeig:

1. El WebSocket es tanca per falta de xarxa.
2. El cuidador veu `Passeig actiu - Sense cobertura` (taronja).
3. En desactivar el pèrdua de connexió, el WebSocket del pacient **no reconnecta**.
4. El cuidador continua veient `Sense cobertura` fins que l'app es tanca i
   reobre.

Això bloqueja el milestone `beta-ready`.

## 4. Impacte arquitectònic

| Capa | Canvi | Motiu |
|---|---|---|
| **Bridge TS** | Afegir events `networkStatusChange` i mètode `getNetworkStatus()` | Canal de notificació natiu → PWA |
| **iOS native** | Nova classe `NetworkReachabilityMonitor` amb `NWPathMonitor` | Font de veritat de connectivitat fora del WebView |
| **iOS plugin** | Integrar el monitor a `LocationSyncPlugin.swift` | Orquestrar inici/parada i notificar al bridge |
| **Frontend** | `useWebSocket.ts` escolta `networkStatusChange` i reconnecta | Acció de reconnexió ràpida i fiable |
| **Android** | Cap canvi | R-P0-NEW-1 és específic d'iOS; el contracte nou és compatible |
| **Backend** | Cap canvi | La lògica de presència ja és correcta |

## 5. Criteris d'acceptació

### Bridge i iOS
- [ ] **AC-1:** El plugin iOS exposa un mètode `getNetworkStatus()` que
  retorna `{ connected: boolean }` reflectint l'estat actual de `NWPathMonitor`.
- [ ] **AC-2:** Quan `NWPathMonitor` reporta `.satisfied`, el plugin emet
  l'event `networkStatusChange` amb `{ connected: true }` al WebView.
- [ ] **AC-3:** Quan `NWPathMonitor` reporta `.unsatisfied` o `.requiresConnection`,
  el plugin emet l'event amb `{ connected: false }`.
- [ ] **AC-4:** El monitor només s'activa quan hi ha una sessió de tracking
  activa (`startTracking`) i es para quan s'atura (`stopTracking`) o quan
  l'app es destrueix.
- [ ] **AC-5:** La latència entre el canvi real de xarxa i l'event al TS és
  ≤ 2s en condicions normals.

### Frontend
- [ ] **AC-6:** `useWebSocket.ts` registra un listener per a
  `networkStatusChange` quan s'executa dins d'un entorn Capacitor iOS.
- [ ] **AC-7:** En rebre `networkStatusChange` amb `connected: true`, si el
  WebSocket està tancat (`CLOSED` o `CONNECTING`), es força una reconnexió
  immediata (resetejant `reconnectAttempt`).
- [ ] **AC-8:** En rebre `connected: false`, `useWebSocket.ts` **no** intenta
  reconnectar i cancel·la qualsevol `reconnectTimeout` pendent.
- [ ] **AC-9:** Si l'entorn no és Capacitor iOS (web pura, Android), el codi
  no falla i manté el comportament anterior (event `online` + polling JS).
- [ ] **AC-10:** S'afegeixen tests Vitest per verificar la reconnexió ràpida
  en rebre l'event natiu i la no-reconnexió en `connected: false`.

### Validació
- [ ] **AC-11:** Build iOS (`xcodebuild`) passa sense errors ni warnings
  rellevants.
- [ ] **AC-12:** Tests frontend baseline 108/108 passen (6 skipped
  preexistents) i s'afegeixen ≥ 2 tests nous sense regressions.
- [ ] **AC-13:** Field test a iPhone 8: desactivar pèrdua de connexió → esperar
  `Sense cobertura` al cuidador → desactivar pèrdua de connexió → l'estat passa a
  `En línia` en ≤ 15s sense tancar/reobrir l'app.

## 6. Riscos identificats

- **R1:** `NWPathMonitor` pot reportar `.satisfied` per una xarxa local sense
  accés a internet (p. ex. Wi-Fi sense sortida). **Mitigació:** l'event només
  força `connect()`; el WebSocket encara fallarà si no hi ha backend, i el
  backoff existent s'aplicarà. No es canvia la lògica de backoff.
- **R2:** Els events natius poden arribar quan el WebView està en estat
  inconsistent. **Mitigació:** comprovar `isMounted` i l'estat `readyState`
  abans de reconnectar; netejar listeners al cleanup de `useEffect`.
- **R3:** El canvi de contracte del bridge pot trencar la build d'Android si
  no hi ha implementació equivalent. **Mitigació:** el contracte TS defineix
  els events com a opcionals; Android no els implementa però no falla perquè
  Capacitor ignora listeners sense emissor. No s'elimina cap mètode existent.
- **R4:** `NWPathMonitor` requereix iOS 12+; el projecte té mínim iOS 15.
  **Mitigació:** cap problema de compatibilitat.
- **R5:** Background: quan l'app passa a background, `WKWebView` pausa els
  timers, però `NWPathMonitor` continua. **Mitigació:** només es notifica
  quan l'app torna a foreground o quan el WebView està actiu; no es forcen
  reconnects en background per no despertar el WebView innecessàriament.

## 7. Pla d'implementació

**Branca:** `fix/SPEC-140-native-ios-network-reachability-bridge` (des de
`develop`)

### 7.1 Platform Integration — contracte bridge

1. **140.1:** Modificar `frontend/plugins/location-sync/src/index.ts`:
   - Importar `Plugin`, `PluginListenerHandle` de `@capacitor/core`.
   - Afegir interfície `NetworkStatusChangeEvent { connected: boolean }`.
   - Estendre `LocationSyncPlugin extends Plugin` amb:
     - `getNetworkStatus(): Promise<NetworkStatus>` on `NetworkStatus = { connected: boolean }`.
     - `addListener(eventName: 'networkStatusChange', listenerFunc: (event: NetworkStatusChangeEvent) => void): Promise<PluginListenerHandle>`.
   - Mantenir tots els mètodes existents (`startTracking`, `stopTracking`, ...).

### 7.2 iOS native — `NetworkReachabilityMonitor`

2. **140.2:** Crear `frontend/plugins/location-sync/ios/Plugin/NetworkReachabilityMonitor.swift`:
   - Usar `NWPathMonitor` (import `Network`).
   - Propietat pública `isConnected: Bool` (thread-safe via serial queue).
   - Mètodes `start()` i `stop()`.
   - Closures `onConnected` i `onDisconnected` per notificar al plugin.
   - Manejar canvis de path a `.satisfied` / `.unsatisfied`.

3. **140.3:** Modificar `frontend/plugins/location-sync/ios/Plugin/LocationSyncPlugin.swift`:
   - Afegir `NetworkReachabilityMonitor` com a propietat.
   - Registrar mètodes `getNetworkStatus` al `pluginMethods`.
   - Al `startTracking`, iniciar el monitor i, si ja hi ha connectivitat,
     emetre immediatament `networkStatusChange`.
   - Al `stopTracking`, aturar el monitor.
   - Implementar `getNetworkStatus(_ call:)` retornant `connected`.
   - En canvis del monitor, cridar `notifyListeners("networkStatusChange", data:)`.

### 7.3 Frontend — `useWebSocket.ts`

4. **140.4:** Modificar `frontend/hooks/useWebSocket.ts`:
   - Importar `LocationSync` i detectar Capacitor iOS (p. ex. via
     `Capacitor.getPlatform() === 'ios'`).
   - Al `useEffect`, si la plataforma és iOS nativa, registrar listener
     `LocationSync.addListener('networkStatusChange', handler)`.
   - Handler: si `connected === true`, `reconnectAttempt.current = 0; connect();`.
     Si `connected === false`, netejar `reconnectTimeout`.
   - Al cleanup, eliminar el listener.
   - Mantenir el polling JS com a fallback per a web/Android.

### 7.4 Tests

5. **140.5:** Crear/actualitzar `frontend/tests/integration/useWebSocket.network.test.ts`:
   - Mock de `LocationSync` que emeti events.
   - Test: event `connected: true` amb WS tancat → `connect()` es crida.
   - Test: event `connected: false` → no es crida `connect()`.
   - Test: cleanup elimina el listener.

### 7.5 Build i validació

6. **140.6:** Executar `cd frontend && npm test && npm run build --webpack`.
7. **140.7:** Executar build iOS:
   ```bash
   cd frontend && npx cap sync ios
   cd frontend/ios && xcodebuild -project App/App.xcodeproj -scheme App -configuration Debug CODE_SIGNING_ALLOWED=NO build
   ```
8. **140.8:** Field test a iPhone 8 per AC-13.

## 8. Pla de validació

### Tests automatitzats
- **Vitest:** 2+ tests nous a `frontend/tests/integration/useWebSocket.network.test.ts`.
  Baseline: 108/108 → objectiu: 110/110 (mínim; no coverage loss).
- **XCTest:** No s'afegeixen en aquesta spec (deute tècnic SPEC-110). Es
  valida amb build iOS.

### Build gates
- [ ] `npm run build --webpack` OK.
- [ ] `npm test` OK (108/108 baseline + nous tests).
- [ ] `xcodebuild` iOS OK.

### Field test
- **Dispositiu:** iPhone 8 (iOS 15+).
- **Escenari:**
  1. Pacient inicia passeig; cuidador veu `En línia`.
  2. Pacient perd la connexió; cuidador veu `Sense cobertura`.
  3. Pacient desperd la connexió; **sense tancar l'app**, cuidador passa a
     `En línia` en ≤ 15s.
- **Evidència:** captures de pantalla + logs de `LocationSyncPlugin` si és
  possible.

## 9. Out of scope

- **Android equivalent:** no es toca Android en aquesta spec. R-P0-NEW-2
  (mapa Android) requereix una spec independent.
- **Migració a presència via Redis (SPEC-120):** post-beta.
- **Tests XCTest natius:** scope de SPEC-110.
- **Canvis a backend:** la lògica WS presence ja és correcta.
- **Eliminació del polling JS:** es manté com a fallback per a entorns no iOS.

## 10. Referències

- `.pathguard/STATE.json` — `open_issues_from_audit.R-P0-NEW-1`.
- `specs/tech-SPEC-130-fix-presence-and-recovered.md` — intent anterior de
  R-P0-NEW-1 (polling JS). SPEC-140 en substitueix l'abast de R-P0-NEW-1;
  R-P0-NEW-3 roman resolt per SPEC-130.
- `specs/tech-SPEC-040-bridge-contract-v2.md` — contracte base del bridge.
- `frontend/hooks/useWebSocket.ts` — hook afectat.
- `frontend/plugins/location-sync/src/index.ts` — contracte TS del bridge.
- `frontend/plugins/location-sync/ios/Plugin/LocationSyncPlugin.swift` — plugin iOS.
- `docs/archive/audit_native_layer.md` — quan existeixi, actualitzar amb
  R-P0-NEW-1 marcat com a resolt per SPEC-140.
