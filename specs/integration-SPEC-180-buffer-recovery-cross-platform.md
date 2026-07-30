---
id: integration-SPEC-180
title: Persistent location buffer and is_recovered correctness across app lifecycle
type: integration
status: draft
priority: P0
created: 2026-07-07
author: tech-lead
agents_affected:
  - platform-integration
  - ios
  - android
  - frontend
  - backend
  - qa
reviewer: tech-lead
blocked_by:
  - SPEC-150
  - SPEC-140
replaces: null
supersedes: null
adr: null
---

# Spec: Persistent location buffer and is_recovered correctness across app lifecycle

## 1. Objectiu

Garantir que els punts de localització capturats durant interrupcions d’una passejada (app en segon pla, app tancada temporalment, connexió intermitent) es persisteixin localment i s’enviïn al backend marcats com a `is_recovered = true`, amb comportament coherent a iOS i Android.

## 2. Context

### Problema observat a les proves de camp (2026-07-07)

- **Passeig 132 (iPhone, app sempre oberta):** 45 punts, tots `is_recovered = false`. Mapa i estat del cuidador correctes.
- **Passeig 133 (iPhone, app sortida i reoberta 2 cops):** 39 punts, **tots `is_recovered = false`**. S’esperava que els primers punts enviats després de cada reobertura fossin `is_recovered = true`.
- La UI del cuidador funciona correctament: taronja quan l’app del pacient està tancada, verd quan es reobre.
- Quan l’app era només PWA, el comportament de `is_recovered` amb IndexedDB funcionava correctament.
- Els problemes han començat després d’implementar les capes natives iOS i Android.

### Permisos actuals

- **iOS:** permís "mentre l’app estigui en ús" (when in use).
- Amb aquest permís, iOS no permet capturar ubicació quan l’app està tancada del tot (swipe-up). Permet uns segons de segon pla després de prémer el botó d’inici.
- Per capturar ubicació de forma fiable durant un passeig amb la pantalla apagada o amb altres apps obertes, cal el permís "sempre" (always).

### Resposta a la pregunta de l’usuari sobre permís "sempre"

> Si PathGuard passa a permís "sempre", vol dir que encara que no estigui passejant i no hi hagi un passeig actiu, s’enviaran dades al backend?

**No.** El permís "sempre" només autoritza el sistema operatiu a despertar l’app i lliurar-li actualitzacions d’ubicació quan no està en primer pla. PathGuard ha de començar a escoltar la ubicació només quan hi ha un passeig actiu (`startTracking`) i aturar-se quan el passeig acaba (`stopTracking`). Si no hi ha passeig actiu, no es captura ni s’envia res. El permís "sempre" és necessari perquè un passeig actiu pugui continuar quan l’usuari apaga la pantalla o canvia d’app.

## 3. Problema

Les capes natives no repliquen de forma fiable el comportament de la PWA:

1. **Android:** `LocationSyncForegroundService.onPointAccepted` sobreescriu `isRecovered` basant-se en l’estat de primer pla i en `lastFlushFailed`. Això és el mateix bug que SPEC-130 va corregir a iOS.
2. **Android:** `LocationBuffer.onFlushFailure` / `onFlushSuccess` tenen la lògica d’histeresi invertida (reseten el `recoveryStreak` en fallada i l’incrementen en èxit).
3. **iOS:** el codi sembla correcte després de SPEC-130, però les proves de camp mostren `is_recovered = false` en tots els punts. Cal validar si això es deu al permís "while in use" o a un altre bug no detectat.
4. **Frontend:** el mapa del cuidador no distingeix visualment els punts recuperats dels punts en temps real.

## 4. Impacte arquitectònic

Aquesta spec toca **6 agents** i requereix coordinació:

- **Platform Integration:** aclareix la semàntica de `is_recovered` al contracte del bridge i garanteix que totes les capes la interpreten igual.
- **Android:** corregeix la sobreescriptura de `isRecovered` i la histèresi invertida (SPEC-181).
- **iOS:** valida el comportament actual i afegeix tests; corregeix qualsevol gap descobert (SPEC-182).
- **Frontend:** distingeix visualment els punts recuperats al mapa del cuidador.
- **Backend:** verifica que el camp `is_recovered` es desa correctament i que no hi ha transformacions que el perdin.
- **QA:** defineix i executa una matriu de proves de camp amb iPhone i Android.

**No es toquen:**
- La signatura del bridge TS (`frontend/plugins/location-sync/src/index.ts`) — es manté immutable segons SPEC-040.
- El format del payload HTTP a `/locations/batch` — ja inclou `is_recovered`.

## 5. Criteris d’acceptació

### AC-1 — Semàntica de `is_recovered`
- [ ] `is_recovered = true` només quan el punt ha estat **prèviament emmagatzemat al buffer local** per una fallada de xarxa o perquè l’app no estava en primer pla.
- [ ] `is_recovered = false` per a qualsevol punt nou generat per `LocationAcquirer` mentre l’app està connectada i en primer pla.

### AC-2 — Persistència del buffer
- [ ] Quan l’app es tanca amb punts pendents al buffer, aquests persisteixen al disc (UserDefaults a iOS, SharedPreferences a Android).
- [ ] Quan l’app es reobre, els punts persistits es carreguen i s’envien amb `is_recovered = true`.

### AC-3 — Android
- [ ] `LocationSyncForegroundService.onPointAccepted` no sobreescriu `isRecovered` basant-se en `appInForeground` ni `lastFlushFailed`.
- [ ] `LocationBuffer.onFlushFailure` incrementa `recoveryStreak` i només estableix `lastFlushFailed = true` quan `streak >= threshold`.
- [ ] `LocationBuffer.onFlushSuccess` reseteja `recoveryStreak = 0` i `lastFlushFailed = false`.
- [ ] Els punts re-afegits al buffer després d’un flush fallit tenen `isRecovered = true`.

### AC-4 — iOS
- [ ] `LocationSyncService.onPointAccepted` no sobreescriu `isRecovered` (ja és correcte; es valida amb test).
- [ ] `LocationBuffer.init` marca tots els punts carregats del `BufferStore` com a `isRecovered = true`.
- [ ] Els punts re-afegits per `LocationBuffer.onFlushFailure` tenen `isRecovered = true`.

### AC-5 — Frontend mapa
- [ ] El mapa del cuidador distingeix visualment els punts amb `is_recovered = true` (per exemple, opacitat menor, color diferent o segment discontinu).
- [ ] Els punts recuperats apareixen al mapa en l’ordre cronològic correcte.

### AC-6 — Proves de camp
- [ ] iPhone 8, permís "sempre": passeig amb app sortida/reoberta 2 cops → els primers punts després de cada reobertura tenen `is_recovered = true`.
- [ ] Android (Redmi), permís "sempre": mateix escenari → resultat equivalent.
- [ ] iPhone 8, permís "while in use": es documenta quin és el comportament esperat i les limitacions.

### AC-7 — Tests
- [ ] XCTest a iOS valida els 3 camins: init amb punts persistits, punt nou, re-add després de flush failure.
- [ ] JUnit a Android valida els mateixos 3 camins.
- [ ] Vitest al frontend valida que els punts recuperats es renderitzen amb l’estil diferenciat.

## 6. Riscos identificats

- **R1:** El permís "sempre" pot ser rebutjat per l’usuari.
  - **Mitigació:** explicar clarament a la UI que només s’usa durant passejos actius; permetre "sempre" com a requisit per a passejos llargs.
- **R2:** Amb permís "while in use", iOS/Android poden aturar la captura quan l’app està en segon pla.
  - **Mitigació:** documentar-ho com a limitació coneguda; recomanar "sempre" per a ús real.
- **R3:** Android OEM (Xiaomi, Samsung, Huawei) pot matar el servei malgrat el foreground service.
  - **Mitigació:** `START_STICKY` + `SharedPreferences` per recuperar estat; documentar a l’usuari que afegeixi PathGuard a les excepcions de bateria.
- **R4:** Canvis al mapa poden afectar altres visualitzacions.
  - **Mitigació:** fer el nou estil opt-in per als punts recuperats i validar amb QA.

## 7. Pla d’implementació

**Branca:** `fix/SPEC-180-buffer-recovery-cross-platform` (des de `develop`)

**Ordre:**

1. **Tech Lead:** actualitza aquesta spec i les specs filles SPEC-181 i SPEC-182 a `review`.
2. **Platform Integration:** actualitza `pathguard-domain-bridge-contract` amb una nota sobre la semàntica de `is_recovered`.
3. **Android (SPEC-181):** corregeix `LocationSyncForegroundService` i `LocationBuffer`; afegeix JUnit tests.
4. **iOS (SPEC-182):** valida amb XCTest; corregeix qualsevol gap.
5. **Frontend:** afegeix estil diferenciat al mapa per a punts recuperats.
6. **Backend:** verifica que `is_recovered` es desa sense transformar.
7. **QA:** executa matriu de proves de camp.
8. **PRs** ordenats a `develop`:
   - `fix/SPEC-181-android-recovered-flag` → `develop`
   - `fix/SPEC-182-ios-buffer-validation` → `develop`
   - `fix/SPEC-180-buffer-recovery-cross-platform` → `develop` (conté frontend + docs)

## 8. Pla de validació

- **Tests unitaris:**
  - iOS XCTest: 3 nous tests a `LocationBufferTests.swift`.
  - Android JUnit: 3 nous tests a `LocationBufferTest.java`.
  - Frontend Vitest: 1 nou test de renderitzat de punts recuperats.
- **Tests d’integració:**
  - Simular flush fallit i reobertura d’app al plugin mock.
- **Proves de camp:**
  - iPhone 8 + Android Redmi.
  - Escenari: passeig de 20 min, sortir de l’app als 5 min i als 12 min, reobrir als 7 min i als 15 min.
  - Criteri: els primers punts enviats després de cada reobertura tenen `is_recovered = true`; la resta `false`; el mapa mostra els trams diferenciats.
- **QA sign-off:** tots els AC verificats, tests passen, proves de camp documentades.

## 9. Out of scope

- Mode avió (l’usuari ha explicitat que no és un escenari prioritari ni habitual).
- Nou mètode al bridge (el contracte actual ja suporta `is_recovered`).
- Canvis al protocol WebSocket de presència (ja cobert per SPEC-130, SPEC-140, SPEC-160).
- Foreground notification iOS (post-beta).
- Retry policy HTTP amb exponential backoff (post-beta).

## 10. Referències

- `specs/integration-SPEC-020-consolidate-gps-capture.md`
- `specs/tech-SPEC-130-fix-presence-and-recovered.md`
- `specs/tech-SPEC-150-android-foreground-robustness.md`
- `specs/tech-SPEC-040-bridge-contract-v2.md`
- `.cursor/skills/pathguard-domain-bridge-contract/SKILL.md`
- `.cursor/skills/pathguard-agent-ios/SKILL.md`
- `.cursor/skills/pathguard-agent-android/SKILL.md`
- `frontend/plugins/location-sync/ios/Plugin/LocationBuffer.swift`
- `frontend/plugins/location-sync/ios/Plugin/LocationSyncService.swift`
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationBuffer.java`
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncForegroundService.java`

---

**Notes:**

- Aquesta spec és l’"umbrella" que coordina SPEC-181 (Android) i SPEC-182 (iOS).
- L’objectiu mínim és que els registres a la base de dades siguin corrects; la visualització al mapa és un plus important però secundari.
- El permís "sempre" és necessari per a un comportament robust; la implementació ha de respectar la privacitat i només rastrejar durant passeigs actius.
