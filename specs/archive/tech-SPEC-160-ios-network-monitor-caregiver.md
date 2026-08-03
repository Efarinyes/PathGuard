<!-- ARXIVAT: Implementada / mergejada; arxivada 2026-08-03 (higiene specs) -->
---
id: tech-SPEC-160
title: iOS network monitor must start globally, not only during tracking
type: tech
status: archived
priority: P0
created: 2026-07-06
author: tech-lead
agents_affected:
  - ios
  - platform-integration
  - frontend
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: 0004---

# Spec: iOS network monitor must start globally, not only during tracking

## 1. Objectiu

Garantir que el monitor de xarxa natiu (`NWPathMonitor`) estigui actiu per a **tots els rols** de l'app (cuidador i pacient), no només quan el pacient està fent tracking, i que el primer estat de connectivitat no es perdi per una race condition entre l'inici del monitor i el registre del listener JS.

## 2. Context

Sessió 2026-07-06 (camp a iPhone 8): la branca `fix/SPEC-140-native-ios-network-reachability-bridge` s'havia donat per funcional i validada a main. Però el cuidador continua veient "Passeig actiu - Sense cobertura" (punt groc) tot i que el pacient està transmetent. Només recupera si tanca i reobre l'app.

Auditoria del codi ha revelat **3 bugs** que combinats fan que R-P0-NEW-1 NO estigui resolt a iOS:

### Bug 1 — `networkMonitor.start()` lligat a `startTracking`

A `LocationSyncPlugin.swift:42-43`:
```swift
service.start(walkId: walkId, deviceToken: deviceToken, serverUrl: serverUrl)
networkMonitor.start()  // ⚠️ només quan el pacient inicia tracking
```

El cuidador (`/caregiver`) **NO crida mai `startTracking`**: ell només mira. Per tant:
1. `networkMonitor` mai s'inicia al cuidador.
2. L'event `networkStatusChange` mai s'emet al cuidador.
3. El `useWebSocket` del cuidador (que SÍ té el listener registrat, línia 156) mai rep cap event.
4. El WS queda mort quan la xarxa canvia.
5. Només el `visibilitychange` (tancar/reobrir) o el `healthPing` (cada 15s) poden reconnectar.

### Bug 2 — Race condition entre `load()`/`start()` del monitor i `addListener` JS

`NWPathMonitor.start(queue:)` és asíncron: el primer `pathUpdateHandler` arriba uns ms després. Si el listener JS es registra DESPRÉS que el monitor hagi emès el primer canvi de xarxa, l'event es perd. Això pot passar quan el cuidador obre l'app i el primer `pathUpdateHandler` arriba durant el muntatge del component.

### Bug 3 (potencial) — `is_recovered=true` massa agressiu al reAdd

A `LocationBuffer.swift:60-68`, `reAdd` posa `isRecovered = true` a **tots** els punts del batch quan un flush falla, sense discriminar entre els que ja estaven al buffer (veritables "recuperats") i els que s'han afegit durant el flush (punts nous que s'haurien d'enviar com a `false`).

S'ha observat a la BD: 782 (false), **783 (true)**, 784 (false), 785 (false). El 783 és l'únic punt marcat, i podria ser correcte (recuperació real) o incorrecte (reAdd massa agressiu). Cal validar-ho al camp un cop aplicat Bug 1+2.

## 3. Problema

- El cuidador no pot veure el canvi d'estat del pacient quan la xarxa es recupera — la UI queda bloquejada en "Sense cobertura" fins a una acció manual (tancar/reobrir).
- La PWA perd la funcionalitat reactiva que NWPathMonitor havia de proveir.
- L'error de Xcode `Invalid file descriptor: "4294967295"` (DBGLLDBLauncher) observat durant el build no és bloquejant: l'app arrenca i funciona, però el debugger no s'attacha.

## 4. Impacte arquitectònic

- **iOS (plugin LocationSync):** 1 fitxer modificat — `LocationSyncPlugin.swift`. Moure `networkMonitor.start()` de `startTracking` a `load()`. No aturar el monitor a `stopTracking` (és global).
- **Frontend (PWA):** 1 fitxer modificat — `useWebSocket.ts`. Després de registrar el listener, cridar `getNetworkStatus()` i reconnectar si està connectat.
- **Bridge TS:** cap canvi (el mètode `getNetworkStatus` ja existeix).
- **iOS UI / Info.plist / manifest Android / backend:** cap canvi.
- **ADR referenciat:** ADR-0004 (única font de canvis d'estat de xarxa des del nadiu).

## 5. Criteris d'acceptació

### Bug 1 — Monitor global

- [ ] **AC-1.1:** `LocationSyncPlugin.load()` crida `networkMonitor.start()`.
- [ ] **AC-1.2:** `LocationSyncPlugin.startTracking()` ja **no** crida `networkMonitor.start()`.
- [ ] **AC-1.3:** `LocationSyncPlugin.stopTracking()` ja **no** crida `networkMonitor.stop()`.
- [ ] **AC-1.4:** El monitor s'inicia quan el plugin es carrega (per defecte, quan s'obre l'app).
- [ ] **AC-1.5:** Validar al iPhone 8: cuidador obre app, perd la connexió 5 min, desactiva → el WS reconnecta en ≤ 30s **sense** tancar/reobrir l'app.

### Bug 2 — Race condition

- [ ] **AC-2.1:** `useWebSocket.ts` crida `LocationSync.getNetworkStatus()` immediatament després de registrar el listener.
- [ ] **AC-2.2:** Si `getNetworkStatus` retorna `connected: true`, el hook fa `connect()`.
- [ ] **AC-2.3:** Validar al iPhone 8: cuidador obre app amb la xarxa ja restablerta → el WS es connecta correctament encara que el primer `pathUpdateHandler` hagi arribat abans.

### Bug 3 (a investigar, fora d'abast immediat)

- [ ] **AC-3.1 (futur):** Auditar el `reAdd` de `LocationBuffer.swift` per discriminar entre punts nous i punts del batch original. Documentar a SPEC-170.

### General

- [ ] **AC-4:** tsc --noEmit: 0 errors.
- [ ] **AC-5:** Tests Vitest: 124/130 (baseline) → 0 regressions.
- [ ] **AC-6:** Tests XCTest: sense canvis (no s'ha tocat `LocationBuffer`).
- [ ] **AC-7:** Field test al iPhone 8: el cuidador veu canvis d'estat en ≤ 30s.
- [ ] **AC-8:** `npx cap sync ios` regenera correctament els fitxers.
- [ ] **AC-9:** Build APK no es veu afectat (entorn no té Java, però els canvis són iOS-only).

## 6. Riscos identificats

- **R1:** Si el monitor s'inicia sempre, hi ha un petit consum extra de bateria — **mitigat** perquè `NWPathMonitor` és molt eficient i el sistema el posa en pausa quan l'app és en background profund.
- **R2:** Eliminar `networkMonitor.stop()` pot deixar el monitor actiu quan l'app es tanca — **mitigat** perquè quan el procés es destrueix, tots els objectes es destrueixen (inclòs el monitor).
- **R3:** El `getNetworkStatus()` pot retornar `false` falsament si el monitor encara no ha processat el primer `pathUpdateHandler` — **mitigat** fent que `useWebSocket` no confiï exclusivament en això, sinó que mantingui el polling de salut com a fallback.
- **R4:** Conflicte amb la integració del pacient (qui té `startTracking` + tracking actiu) — **mitigat** perquè el monitor és idempotent: `start()` ja té `guard monitor == nil else { return }`.

## 7. Pla d'implementació

**Branca:** `fix/SPEC-160-ios-network-monitor-caregiver` (des de `develop`)

| Ordre | Fitxer | Canvi |
|---|---|---|
| 1 | `frontend/plugins/location-sync/ios/Plugin/LocationSyncPlugin.swift` | Moure `networkMonitor.start()` de `startTracking` a `load()`. Eliminar `networkMonitor.stop()` de `stopTracking`. |
| 2 | `frontend/hooks/useWebSocket.ts` | Després de registrar el listener, cridar `LocationSync.getNetworkStatus()` i reconnectar si cal. |

Ordre crític: 1 primer (perquè 2 depèn que el monitor estigui actiu quan es crida `getNetworkStatus`).

## 8. Pla de validació

- **Tests Gradle:** no aplica (canvis iOS-only).
- **Tests Vitest:** baseline 124/130 → 0 regressions.
- **tsc --noEmit:** 0 errors.
- **Field test (iPhone 8):**
  - Escenari A: cuidador obre app → perd la connexió 5 min → desactiva → estat canvia a "En línia" en ≤ 30s sense tancar/reobrir.
  - Escenari B: cuidador obre app amb xarxa ja restablerta → WS es connecta correctament.
  - Escenari C: pacient i cuidador ambdós a iPhone — es veuen punts en temps real durant tot el cicle.
- **Cross-capa:** el format JSON del payload iOS no canvia.
- **QA sign-off:** tots els AC verificats, field test documentat.

## 9. Out of scope

- **Bug 3** (is_recovered massa agressiu): auditoria addicional. Es cobrirà a SPEC-170 un cop validat Bug 1+2.
- **NWPathMonitor per Android:** post-beta (SPEC-150 ja cobreix el cas Android amb WakeLock + HandlerThread).
- **Tests XCTest addicionals:** SPEC-110 (deute tècnic).

## 10. Referències

- [Auditoria sessió 2026-07-06] — bugs 1, 2, 3 identificats al camp.
- [Apple — NWPathMonitor](https://developer.apple.com/documentation/network/nwpathmonitor) — referència canònica.
- [Apple — kqueue / dispatch_source_t](https://developer.apple.com/library/archive/documentation/General/Conceptual/ConcurrencyProgrammingGuide/OperationQueues/OperationQueues.html) — patrons de monitorització.
- [Capacitor — Custom Native iOS Code](https://capacitorjs.com/docs/ios/custom-code) — referència per a `load()`.
- `frontend/plugins/location-sync/ios/Plugin/LocationSyncPlugin.swift` — fitxer a modificar.
- `frontend/hooks/useWebSocket.ts` — fitxer a modificar.
- `frontend/plugins/location-sync/src/index.ts` — interfície (ja té `getNetworkStatus`).
- `docs/decisions/0004-single-gps-source.md` (ADR-0004) — font única de canvis d'estat.
- SPEC-140 (NWPathMonitor) — base sobre la qual es construeix aquesta correcció.

---

**Notes:**

- Aquesta spec NO toca backend, ni Android, ni la capa PWA més enllà del `useWebSocket`.
- L'ordre d'implementació és important: primer el plugin iOS (Bug 1), després el frontend (Bug 2).
- El field test al iPhone 8 és l'última línia de validació. Si falla, no es fusiona a main.
- L'error de Xcode `Invalid file descriptor: "4294967295"` queda registrat com a conegut però no bloquejant (l'app arrenca igual).
