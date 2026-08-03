---
id: tech-SPEC-130
title: Fix presència WS i flag is_recovered al plugin iOS
type: tech
status: draft
priority: P0
created: 2026-07-03
author: tech-lead
agents_affected:
  - frontend
  - ios
reviewer: tech-lead
blocked_by: []
replaces: null
supersedes: null
adr: null
---

# Spec: Fix presència WS i flag is_recovered al plugin iOS

## 1. Objectiu
Tancar dos bugs P0 descoberts durant el field test de Fase 1 al iPhone 8:
- **R-P0-NEW-1:** Quan el pacient entra/recupera la connexió, l'estat al
  cuidador queda persistent en "Sense cobertura" tot i que el WebSocket
  del pacient podria reconnectar.
- **R-P0-NEW-3:** La columna `is_recovered` de la taula `location` no
  reflecteix correctament la definició acordada: només ha de ser `true`
  quan el punt estava prèviament emmagatzemat al buffer per una
  fallada de xarxa anterior.

## 2. Context
- Plugin iOS (`LocationSyncService.swift`) implementat al commit 23b6536.
- Validat al iPhone 8 que: mapa, pèrdua de connexió, kill app, `is_recovered`
  (parcial, amb el bug descobert).
- Audit `docs/archive/audit_native_layer.md` actualitzat amb R-P0-NEW-1,
  R-P0-NEW-2, R-P0-NEW-3.
- Pendent Fase 1: validació Android i desbloqueig del R-P0-NEW-2
  (fora de l'abast d'aquesta spec).

## 3. Problema

### 3.1 R-P0-NEW-1 — Presència queda "offline" després de pèrdua de connexió

**Reproducció (validada al iPhone 8, sessió 2026-07-03):**
1. Iniciar passeig des de PWA iOS → cuidador veu `Passeig actiu - En línia` (verd).
2. Perdre la connexió al iPhone → cuidador veu `Passeig actiu - Sense cobertura` (taronja).
3. Recuperar la connexió → cuidador **continua veient** `Sense cobertura`.
4. Tancar i reobrir la PWA → cuidador veu `En línia` (verd, es recupera).

**Causa arrel:**
- `useWebSocket.ts:130-138` ja escolta `window.addEventListener('online', ...)`
  per reconnectar quan la xarxa torna.
- En WKWebView (Capacitor iOS), `navigator.onLine` queda `true` i l'event
  `online` **no es dispara** quan es recupera la connexió. És un
  bug conegut dels WebViews mòbils.
- El reconnect només es reactiva quan es desmunta i remunta el hook
  (`useWebSocket.ts:140-163` cleanup) — la qual cosa passa en tancar/reobrir.

### 3.2 R-P0-NEW-3 — `is_recovered` sempre `true` en alguns casos

**Reproducció (validada amb query a `location`, sessió 2026-07-03):**
- Iniciar passeig amb l'app en background (telèfon a la butxaca, pantalla
  apagada) → tots els punts inserits tenen `is_recovered = true`.
- Reobrir l'app i iniciar un passeig nou previ → el primer
  punt pot arribar amb `is_recovered = true` heretat de `lastFlushFailed`
  (que pot estar `true` per una sessió anterior via `UserDefaults`).
- Exemple d'inserció a la BD: `{"idx":52,"id":737,"walk_id":104,...,"is_recovered":true}`
  en el primer punt d'un passeig sense pèrdua de cobertura.

**Causa arrel:**
`frontend/plugins/location-sync/ios/Plugin/LocationSyncService.swift:133-139`:
```swift
private func onPointAccepted(_ point: LocationPoint) {
    var point = point
    point.isRecovered = buffer.isLastFlushFailed || !appInForeground
    buffer.add(point)
    scheduleFlush()
}
```

`is_recovered` s'està sobreescrivint a `true` quan:
- L'últim flush va fallar (`lastFlushFailed`), **o**
- L'app no està en foreground (condició normal durant un passeig!).

**Definició correcta** (validada amb l'usuari 2026-07-03):
> `is_recovered = true` només quan el punt **estava prèviament
> emmagatzemat al buffer** per una fallada de xarxa anterior.

La lògica correcta ja existeix en dos llocs que sí funcionen:
- `LocationBuffer.swift:18-20` (init carregant de `UserDefaults`) — marca
  tots els punts del buffer persistent com a recuperats. **Correcte.**
- `LocationBuffer.swift:60-63` (`reAdd` després d'un flush failure) —
  re-afegeix punts del batch fallit marcats com a recuperats. **Correcte.**

El bug és l'**sobreescriptura innecessària** a `onPointAccepted`.

## 4. Impacte arquitectònic
- **Frontend:** canvi aïllat a `useWebSocket.ts` (hook compartit). Afecta
  tots els consumidors del hook (PWA pacient, PWA cuidador, futur).
- **iOS:** canvi d'1 línia efectiva a `LocationSyncService.swift`. **No
  toca el bridge contract** (SPEC-040 immutable). No toca el contracte
  HTTP de `LocationHttpClient`.
- **Backend:** sense canvis. La lògica de `patient_online` /
  `patient_offline` ja és correcta — emet l'estat correcte quan arriba
  un nou WS.
- **Android:** no afectat directament, però els tests unitaris Swift
  seran un precedent per a la implementació Android equivalent
  (veure SPEC-110).

## 5. Criteris d'acceptació

### Frontend (presència)
- [ ] AC-1: `useWebSocket` reconnecta quan el WS està tancat i
  `navigator.onLine === true` durant ≥ 5s, encara que l'event `online`
  no s'hagi disparat (polling de salut).
- [ ] AC-2: El polling de salut **NO** s'activa quan
  `navigator.onLine === false` (evita loops infinits en pèrdua de connexió).
- [ ] AC-3: L'interval del polling és configurable via `lib/config.ts`
  amb la constant `WS_HEALTH_PING_INTERVAL_MS` (proposta: 15000 ms).
- [ ] AC-4: Tests Vitest cobreixen: reconnect periòdic quan WS tancat i
  online; no reconnect quan offline; reset d'attempts en reconnect
  exitós; neteja de timers en unmount.
- [ ] AC-5: Comportament observable al cuidador canvia: després de
  sortir de pèrdua de connexió (sense tancar/reobrir), l'estat passa a
  `En línia` en ≤ 30s.

### iOS (is_recovered)
- [ ] AC-6: `LocationPoint.isRecovered` queda al seu valor per defecte
  (`false`) per a punts nous generats per `LocationAcquirer` i
  processats per `onPointAccepted`.
- [ ] AC-7: Només els punts carregats del `BufferStore` (init) o
  re-afegeits per `LocationBuffer.reAdd()` tenen `is_recovered = true`.
- [ ] AC-8: Test XCTest a `LocationBufferTests.swift` valida els 3
  camins: init carregant del store, add d'un punt nou, reAdd després
  d'un flush failure.
- [ ] AC-9: Field test al iPhone 8: passeig net →
  tots els punts a `location.is_recovered = false`. Passeig amb mode
  connexió intermitent → només els punts emmagatzemats al buffer tenen
  `is_recovered = true`, els nous generats un cop recuperada la xarxa
  tenen `false`.

### General
- [ ] AC-10: Cap regressió a tests existents (Vitest 108/108, XCTest
  baseline).
- [ ] AC-11: `docs/archive/audit_native_layer.md` actualitzat:
  R-P0-NEW-1 marcat com a `resolved`, R-P0-NEW-3 afegit i marcat com
  a `resolved`. R-P0-NEW-2 queda obert amb nota que va a spec
  independent.
- [ ] AC-12: `.pathguard/STATE.json` actualitzat: spec activa canvia
  a `tech-SPEC-130`, bloquejos R-P0-NEW-1 i R-P0-NEW-3 marcats com a
  resolts un cop validats.

## 6. Riscos identificats
- **R1:** Polling de salut massa agressiu consumeix bateria — mitigat
  amb interval configurable (15s) i només actiu quan el WS està
  tancat (no pas quan està obert correctament).
- **R2:** El polling pot col·lisionar amb el backoff exponencial
  existent (`scheduleReconnect` a `useWebSocket.ts:104-119`) — cal
  coordinar: si el polling dispara, resetejar `reconnectAttempt` per
  evitar que dos timers competeixin.
- **R3:** Tests XCTest requereixen setup addicional al projecte iOS —
  a verificar si ja existeix estructura a `frontend/ios/Tests/`. Si no,
  és una subtasca prèvia.
- **R4:** `is_recovered` canviat pot afectar dashboards/consumidors
  existents al backend o al frontend — cal cercar usos i validar
  visualitzacions.
- **R5:** False positive de reconnect quan el backend està down (no
  pas el client) — el polling reconnectarà igual. Cal distingir "xarxa
  torna" de "servidor torna" amb un ping HTTP a `/health` abans de
  reconnectar (subtasca 130.3).

## 7. Pla d'implementació
**Branca:** `fix/SPEC-130-presence-and-recovered` (des de `develop`)

1. **Frontend** (agent `frontend`):
   - 130.1: Afegir constant `WS_HEALTH_PING_INTERVAL_MS = 15000` a
     `frontend/lib/config.ts`.
   - 130.2: Afegir polling de salut a `useWebSocket.ts`:
     - `useEffect` addicional amb `setInterval`.
     - Condició: `ws.current?.readyState !== OPEN && navigator.onLine === true`.
     - Acció: `reconnectAttempt.current = 0; connect();`
     - Neteja de timer en unmount.
     - Coordinació amb `scheduleReconnect` (veure R2).
   - 130.3: Validació prèvia amb ping HTTP a `/health` (veure R5):
     - Si WS tancat + `navigator.onLine === true` → fer `fetch('/health')`.
     - Si `fetch` falla → no reconnectar (servidor down).
     - Si `fetch` té èxit → reconnectar.
   - 130.4: Tests Vitest a `useWebSocket.test.ts`:
     - Escenari A: WS tancat + online → reconnecta en ≤ 15s.
     - Escenari B: WS tancat + offline → no reconnecta.
     - Escenari C: WS obert → no reconnecta.
     - Escenari D: Unmount → timer netejat, no leak.
   - 130.5: Validar que tests existents (108/108) segueixen passant.

2. **iOS** (agent `ios`):
   - 130.6: Editar `LocationSyncService.swift` línia 133-139:
     - Eliminar la sobreescriptura de `isRecovered` a `onPointAccepted`.
     - El valor per defecte de `LocationPoint.isRecovered` (false) ja
       és correcte per a punts nous.
   - 130.7: Verificar que `LocationBuffer.swift:18-20` (init) i
     `LocationBuffer.swift:60-63` (reAdd) ja implementen correctament
     la lògia de recuperació. No cal canvi.
   - 130.8: Tests XCTest a `frontend/ios/Tests/LocationBufferTests.swift`:
     - Test init: carregar del `BufferStore` mock → punts tenen
       `isRecovered = true`.
     - Test add: afegir punt nou → `isRecovered = false`.
     - Test reAdd: re-afegir batch després de flush failure → tots
       `isRecovered = true`.
     - Test onFlushSuccess: `recoveryStreak = 0`, `lastFlushFailed = false`.

3. **Docs** (agent `tech-lead`):
   - 130.9: Actualitzar `docs/archive/audit_native_layer.md`:
     - Marcar R-P0-NEW-1 com a `resolved` (amb link a aquesta spec).
     - Afegir R-P0-NEW-3 (que ja estava identificat però no documentat)
       i marcar-lo com a `resolved`.
     - Deixar R-P0-NEW-2 obert amb nota "spec independent pendent".

4. **PR + merge:**
   - 130.10: Crear PR `fix/SPEC-130-presence-and-recovered` → `develop`.
   - 130.11: Validar CI (frontend tests + iOS build).
   - 130.12: Merge després d'aprovació del reviewer (`tech-lead`).
   - 130.13: Field test al iPhone 8 per validar AC-5 i AC-9.

## 8. Pla de validació
- **Tests unitaris (Vitest):** 4 nous escenaris a `useWebSocket.test.ts`
  (veure 130.4). Baseline: 108/108 → objectiu: 112/112.
- **Tests unitaris (XCTest):** 4 nous tests a `LocationBufferTests.swift`
  (veure 130.8). Baseline: 0/0 → objectiu: 4/4.
- **Tests E2E (Playwright):** nou test a
  `frontend/tests/e2e/presence-recovery.spec.ts`:
  - Login cuidador + pacient (mateix grup).
  - Iniciar passeig.
  - Verificar `En línia` verd.
  - Simular offline al context del navegador amb
    `page.context().setOffline(true)`.
  - Esperar 60s.
  - Verificar `Sense cobertura` taronja.
  - Simular online amb `page.context().setOffline(false)`.
  - Esperar 30s.
  - Verificar `En línia` verd.
- **Validació de camp:** iPhone 8 amb 2 escenaris:
  - Escenari A: passeig net de 15 min sense perdre cobertura → tots els
    punts a `location.is_recovered = false`.
  - Escenari B: passeig amb 2 intervals de pèrdua de connexió (3 min cadascun) →
    els punts emmagatzemats al buffer durant el pèrdua de connexió tenen
    `is_recovered = true`, la resta `false`. L'estat al cuidador passa
    a `En línia` ≤ 30s després de desactivar el pèrdua de connexió (sense
    tancar/reobrir).
- **QA sign-off:** tots els AC verificats, tests passen, field test
  documentat amb captures/evidència.

## 9. Out of scope
- **R-P0-NEW-2** (mapa Android no es renderitza quan el pacient és
  Android) — queda obert. Cal una spec independent
  (`tech-SPEC-140-...` o similar) per investigar i fixar.
- **NWPathMonitor listener nadiu** al plugin iOS — solució llarg
  termini robusta, però no urgent. Es pot afegir a SPEC-040 v3 o a
  una spec futura.
- **Migració a SPEC-120 (presence-redis)** — post-beta. No bloqueja.
- **Tests XCTest per a LocationAcquirer/LocationHttpClient** — scope
  de SPEC-110 (tests unitaris natius). Aquí només cobrim
  `LocationBuffer`.

## 10. Referències
- `docs/archive/audit_native_layer.md` — R-P0-NEW-1, R-P0-NEW-2,
  R-P0-NEW-3.
- `.pathguard/STATE.json` secció `open_issues_from_audit`.
- `frontend/hooks/useWebSocket.ts:130-138` — listener online actual
  (insuficient en WKWebView).
- `frontend/plugins/location-sync/ios/Plugin/LocationSyncService.swift:133-139`
  — bug `is_recovered`.
- `frontend/plugins/location-sync/ios/Plugin/LocationBuffer.swift:18-20,60-63`
  — lògica correcta de recuperació (referència).
- `backend/app/api/websocket/websocket_endpoint.py:40-92` — backend WS,
  lògica de presència correcta (referència, sense canvis).
- SPEC-040 (bridge contract v2) — confirma que no es toca el bridge.
- SPEC-110 (native unit tests) — referència per estructura XCTest.
