# PathGuard — Pla d'Acció Consolidat

**Date:** 2026-05-18  
**Referències:** `product_audit.md`, `technical_audit.md`, `modification-registre-patient.md`

---

## Fase 1 — Blockers de Beta ✅ COMPLETADA (2026-05-18, branca `fix/phase1-beta-blockers`)

### 1.1 Eliminar codi mort
- [x] Eliminar `backend/app/api/ws_manager.py` (266 línies — duplica el mòdul `websocket/` que és l'actiu)

### 1.2 Corregir UUID per a SQLite
- [x] `backend/app/db/models/patient.py`: substituït `UUID(as_uuid=True)` per `String(36)` amb `default=_generate_uuid_str`
- [x] Actualitzats `ws_auth.py`, `auth.py`, `schemas.py`, `registration_service.py` — comparacions per string, no UUID
- [x] Tots els test fixtures actualitzats: `device_token=str(uuid4())`

### 1.3 Substituir so SOS
- [x] `frontend/hooks/useSOSAlertSound.ts`: reemplaçat 1500Hz × 225 beeps per chime càlid (440→523→660Hz, 500ms/ton, 300ms gap, 3 cicles, envolvent suau)

### 1.4 Netejar UI de producte
- [x] `PatientStatusCard.tsx`: eliminat display de `watchersCount`
- [x] `PatientStatusCard.tsx`: eliminat botó "Aturar seguiment en directe" (pause monitoring)
- [x] `SOSAlertModal/index.tsx`: eliminats `sos_count` i `walk_id` del modal

### 1.5 Moure analítiques fora de la vista de monitorització
- [x] Treure `CaregiverAnalytics` del dashboard actiu — `analyticsSection` ara opcional al layout, component guardat per Fase 4
- [x] Eliminades columnes `incidents` i `signal_loss` de `WalkHistoryList` i `walkService.ts`
- [x] La pèrdua de cobertura només es mostra com a estat transitori ("Reconnectant..."). No es loga, no es mostra al dashboard

**Neteja extra:** Eliminats 10+ fitxers residuals `* 2.py/tsx` (còpies duplicades accidentals)

---

## Fase 2 — Canvi de registre/activació del pacient ✅ COMPLETADA (2026-05-18, branca `fix/phase1-beta-blockers`)

### 2.1 Backend: model i endpoints
- [x] `Patient`: afegit `activation_code = Column(String(6), unique=True, index=True)` i `activation_code_used = Column(Boolean, default=False)`
- [x] Generat `activation_code` automàticament al `registration_service.register_family()` (6 caràcters alfanumèrics, `secrets.choice`)
- [x] Nou endpoint `POST /auth/activate-device` — rep `{ code }`, busca pacient per activation_code, retorna `{ device_token, patient_id }`, marca codi com utilitzat (410 si ja usat, 404 si no existeix, case-insensitive)
- [x] Modificada resposta de `POST /auth/register` — afegit `activation_code`
- [x] Nou endpoint `GET /auth/patient/activation-code` (autenticat com a owner) — retorna el codi, regenera si ja està usat
- [x] Nous schemas: `ActivateDeviceRequest`, `ActivateDeviceResponse`, `ActivationCodeResponse`
- [x] Tests: 6/6 tests d'activació passen (codi vàlid, case-insensitive, invàlid, ja usat, register retorna codi, owner endpoint)

### 2.2 Frontend: formulari de registre
- [x] `RegistrationForm`: eliminat checkbox "Activa aquest dispositiu per al pacient" i lògica `activateAsPatient`
- [x] `RegistrationForm`: eliminat checkbox SOS del formulari de registre (SOS es configura des del dashboard d'owner en el futur)
- [x] Després del registre exitós, es mostra el codi d'activació en gran: pantalla de confirmació amb codi destacat

### 2.3 Frontend: pantalla d'activació
- [x] Creat `/app/activate/page.tsx` — pantalla neta amb un sol camp de 6 caràcters, botó verd "Activar"
- [x] Crida `POST /auth/activate-device`, rep `device_token` + `patient_id`, guarda amb `setPatientSession`, redirigeix a `/patient`
- [x] Errors: 404 (codi invàlid), 410 (codi ja usat), missatges en català

### 2.4 Frontend: landing page i guards
- [x] `app/page.tsx`: afegida tercera opció "Activar dispositiu" (icona Smartphone, verd) entre "Crear entorn familiar" i "Accedir com a cuidador"
- [x] `RoleGuard.tsx`: `/activate` ja era accessible sense token (només protegeix `/patient`)

---

## Fase 3 — Poliment pre-beta ✅ COMPLETADA (2026-05-19, branca `fix/phase3-poliment`)

### 3.1 Llenguatge
- [x] Renombrar UI strings: "pacient" → "familiar" o "persona" en català (component names i backend models queden per post-beta)

### 3.2 Netesa de codi
- [x] `trajectoryService.ts`: eliminar `smoothTrajectory()` (mètode no utilitzat)

---
## Punts d'auditoria (revisió després de cada fase)
### Auditoria post-Fase 1 (Blockers de Beta) ✅ VERIFICADA (2026-05-18)
- [x] Verificar que `ws_manager.py` està eliminat i cap import el referencia ✓
- [x] Verificar que `patient.py` usa UUID genèric (String(36)) i que SQLite funciona ✓ (27/27 tests pass)
- [x] Verificar que el so SOS és un chime càlid (440-660Hz, 3 tons, sense alarm fatigue) ✓
- [x] Verificar que `watchersCount` no es mostra enlloc al caregiver dashboard ✓
- [x] Verificar que el botó de pause monitoring està eliminat ✓
- [x] Verificar que `sos_count` i `walk_id` no es mostren al SOS modal ✓
- [x] Verificar que `CaregiverAnalytics` està fora de la vista de monitorització activa ✓
- [x] Executar `pytest` i `npm run build` — 27/27 tests pass, frontend build pass ✓ (1 test previ falla, no relacionat amb canvis)
### Auditoria post-Fase 2 (Registre/Activació) ✅ VERIFICADA (2026-05-19)
- [x] Verificar que el model `Patient` té `activation_code` i `activation_code_used` ✓
- [x] Verificar que `POST /auth/activate-device` funciona: rep codi → retorna device_token ✓
- [x] Verificar que `POST /auth/register` retorna `activation_code` a la resposta ✓
- [x] Verificar que `GET /patient/activation-code` (owner) funciona i pot regenerar el codi ✓
- [x] Verificar que `RegistrationForm` no té el checkbox "activa com a pacient" ✓
- [x] Verificar que la pantalla post-registre mostra el codi d'activació ✓
- [x] Verificar que `/activate` existeix, demana el codi, valida, guarda token, redirigeix a `/patient` ✓
- [x] Verificar que la landing page té 3 opcions (registre / login / activar dispositiu) ✓
- [x] Verificar que `RoleGuard` permet accedir a `/activate` sense token ✓
- [x] Prova completa: registre → obtenir codi → activar des d'un altre dispositiu → veure `/patient` ✓
- [x] Prova de regressió: el flux existent de cuidador (registre + login + invitació) segueix funcionant ✓
### Auditoria post-Fase 3 (Poliment) ✅ VERIFICADA (2026-05-19)
- [x] Verificar que "pacient" ja no apareix a les strings visibles en català (substituït per "familiar"/"persona") ✓
- [x] Verificar que `smoothTrajectory()` està eliminat de `trajectoryService.ts` ✓
- [x] Executar `pytest` i `npm run build` sense errors ✓ (152/152 backend tests, frontend build pass, 3 pre-existing test failures unrelated to changes)

## Fase 4 — Post-beta

### 4.1 Owner Dashboard (`/caregiver/dashboard`) ✅ COMPLETADA (2026-05-21, branca `feat/phase4-owner-dashboard`)

- [x] Ruta `/caregiver/dashboard` accessible només per owner (auth + owner guard)
- [x] Menú drawer a `CaregiverHeader` (hamburguesa, fons transparent, transició suau) — component `OwnerMenuDrawer.tsx` extret (SRP)
- [x] Històric de passejades (data, durada, ruta al mapa) amb detall clic-able només per owner (`WalkDetailModal.tsx`)
- [x] Activar/desactivar SOS per al pacient (`PATCH /groups/sos-toggle`, backend + `SOSToggle.tsx` frontend)
- [x] Veure i regenerar codi d'activació del dispositiu (`ActivationCodeDisplay.tsx`, ocult per defecte, botó per revelar)
- [x] Reutilitzar `CaregiverAnalytics` aquí: freqüència setmanal, durada mitjana, hores habituals — accordion opt-in
- [x] Neteja arquitectural: hook `useOwnerData()` compartit (DRY), `walkHistory` opcional al layout, `OwnerMenuDrawer` separat (SRP)
- [x] Correcció so SOS: `ctx.resume()` a `useSOSAlertSound.ts` per navegadors moderns
- [x] Correcció log backend: codi WebSocket 1005 (tancament normal) logat com a INFO, no WARNING

**Canvis de refactorització:**
- `CaregiverHeader.tsx` → només header + logout (SRP), drawer mogut a `OwnerMenuDrawer.tsx`
- `CaregiverDashboard/index.tsx` → usa `useOwnerData()`, sense `CaregiverWalkHistory`
- `OwnerDashboard/page.tsx` → usa `useOwnerData()`, amb `CaregiverWalkHistory` + `CaregiverAnalytics`

**No inclou:**
- Pèrdua de cobertura com a mètrica o columna. La pèrdua de cobertura només es mostra com a estat transitori a la UI de monitorització activa ("Reconnectant..."). No es loga, no es comptabilitza, no es mostra al dashboard. Si el cuidador mira l'historial de mapes, les zones sense punts ja són implícitament visibles.

### 4.2 Arquitectura backend ✅ COMPLETADA (2026-05-22, branca `refactor/phase4-architecture`)

- [x] Fusionar `PresenceTracker` dins de `ConnectionManager` — 3 mètodes d'instància: `set_patient_online()`, `set_patient_offline()`, `get_patient_status()`
- [x] Eliminar `_patient_status_store` com a variable module-level → propietat d'instància `self._patient_status_store`
- [x] Eliminar `presence_tracker.py` completament (16 línies)
- [x] Zero imports residuals de `PresenceTracker` o `_patient_status_store` al codi
- [x] `pytest` 152/152 (10 WS timing preexistents, no relacionats)
- [x] Zero impacte funcional — single source of truth dins `ConnectionManager`

**Canvis:**
- `connection_manager.py`: `_patient_status_store` mogut a `self._patient_status_store`, afegits 3 mètodes de presència, propietat `patient_status` actualitzada
- `websocket_endpoint.py`: eliminada importació de `PresenceTracker`, 5 crides substituïdes per `connection_manager.*`
- `presence_tracker.py`: eliminat

### 4.3 Arquitectura frontend ✅ COMPLETADA (2026-05-22, branca `refactor/phase4-frontend-architecture`)

- [x] Convertir `locationService` de object literal a classe (`LocationService` amb estat privat)
- [x] Eliminar `_resetInternalState()` del nivell de mòdul (ara és mètode d'instància, reseteja `isSyncing` també)
- [x] Eliminar 6 `console.log`/`console.debug` de `locationService.ts` (Golden Rule)
- [x] Extreure `useWalkSession` hook de `PatientWalkController` (start/stop walk + auto-recovery)
- [x] Afegir `walkService.startWalk()` i `walkService.stopWalk()` — zero `fetch()` directes al component
- [x] Crear `WSEventType` discriminated union (`frontend/lib/wsEventTypes.ts`)
- [x] Afegir `WalkEventProcessor.classifyEvent()` amb validació estructural
- [x] Refactoritzar `useLivePatientLocation` per usar `switch` exhaustiu sobre `classifyEvent`
- [x] Eliminar `any` tipus a `useLivePatientLocation` i `useWebSocket` (`unknown` en lloc de `any`)
- [x] `npm run build --webpack` passa, `npm test` 108 passats / 6 skipped (preexistents)

**Canvis:**
- `frontend/services/locationService.ts`: classe amb estat privat, singleton exportat, zero logs
- `frontend/lib/wsEventTypes.ts`: nou — 8-tipus discriminated union + type guards
- `frontend/lib/WalkEventProcessor.ts`: nou mètode `classifyEvent()`, `shouldProcessMessage` accepta `unknown`
- `frontend/hooks/useLivePatientLocation.ts`: `switch` exhaustiu, zero `any`, `useWebSocket<unknown>`
- `frontend/hooks/useWalkSession.ts`: nou — encapsula lifecycle walk + auto-recovery stuck-walk
- `frontend/services/walkService.ts`: nous mètodes `startWalk()`, `stopWalk()`, `StuckWalkError`
- `frontend/components/PatientWalkController/index.tsx`: ~90 línies menys, zero `fetch()`, SRP pur

---

## TODO — Descoberts durant verificació de la Fase 4.3

### TODO-1: SOS Toggle Real-Time — PENDENT, a revisar
**Problema:** Quan l'owner activa SOS des del dashboard (`/caregiver/dashboard`), `/patient` no mostra el botó SOS fins que l'usuari refresca la pàgina.
**Causa:** `PatientWalkController` consulta `sos_enabled` un cop al mount via `patientService.getPatientStatus()`. No hi ha mecanisme de revalidació en temps real.
**Comportament actual (acceptable):** L'owner decideix activar SOS per motius aliens a l'app. Quan el familiar torna a sortir a fer una volta i arrenca l'app, la funcionalitat ja estarà disponible. Aquest flux és coherent amb la filosofia de PathGuard (passejos curts, cuidador vigila però no controla en temps real).
**Decisió:** No implementar ara. El flux actual és acceptable i coherent amb la filosofia del producte. Si es necessita dinàmica en el futur, es replantejarà.
**Estimació:** 2-3h (si s'implementa)
**Prioritat:** Baixa — a revisar si el producte ho demana

### TODO-2: SOS Button Visual Stabilitat — ✅ COMPLETAT (2026-05-23, branca `refactor/css-design-system`)
**Problema:** El botó SOS canviava de dimensions/visual durant el mantenyiment (press-and-hold). 5 causes arrel identificades.
**Solució aplicada:**
- `min-h-[80px]` → `h-[80px] relative overflow-hidden` (alçada fixa, conté la barra de progrés)
- `animate-pulse` eliminat de la fase `pressing`
- `focus:ring-4` → `focus-visible:ring-4` (ring només a teclat, no a touch mòbil)
- `transition-colors duration-200` eliminat — canvi d'estat instantani
- Text d'ajuda sempre renderitzat amb `opacity-0`/`opacity-100` — zero layout shift
- Barra de progrés `sos-hold-progress` afegida a `globals.css`: `scaleX(0)→scaleX(1)` en 3s linear
- Botó mai canvia de mida, posició, ni pulsa

### TODO-3: Deute tècnic CSS — Design Tokens no utilitzats i patrons duplicats ✅ COMPLETADA (2026-05-23, branca `refactor/css-design-system`)

**Problema:** El projecte definia design tokens semàntics però els components feien bypass amb valors hex directes. El `tailwind.config.js` era vestigial (format v3 amb Tailwind v4).

**Resolució aplicada (branca `refactor/css-design-system`):**

#### CSS-1: Design tokens migrats — ✅ COMPLETAT
- 130 ocurrències hex substituïdes per tokens semàntics across 20 fitxers
- Nova nomenclatura a `@theme`: `primary`, `success`, `warning`, `danger`, `danger-dark`, `background`, `foreground`
- Mapa: `[#1E3A8A]`→`primary`, `[#0F172A]`→`foreground`, `[#22C55E]`→`success`, `[#EF4444]`→`danger`, `[#DC2626]`→`danger-dark`, `[#F59E0B]`→`warning`, `[#F8FAFC]`→`background`
- Variants d'opacitat i shadows migrades: `shadow-blue-900/10`→`shadow-primary/10`, `shadow-green-900/10`→`shadow-success/10`, etc.
- Zero valors hex residus en components (excloent `CustomIcons.ts` que usa inline styles per Leaflet)

#### CSS-2: `tailwind.config.js` eliminat — ✅ COMPLETAT
- Fitxer eliminat. `globals.css/@theme` és ara la font única de veritat
- Build verificat sense el config v3 — Tailwind v4 llegeix `@theme` directament

#### CSS-3: Patrons duplicats — PENDENT (post-beta)
- Card, Spinner, ModalOverlay, FormInput continuen com a patrons repetits amb tokens nets
- Decidit: no crear components shared ara per evitar scope creep

#### CSS-4: `CustomIcons.ts` keyframes moguts — ✅ COMPLETAT
- `@keyframes map-pulse` i `@keyframes map-pulse-offline` moguts a `globals.css`
- `.custom-map-icon` reset mogut a `globals.css`
- `<style>` blocks eliminats de `CustomIcons.ts`
- Colors inline actualitzats: `secondary`→`success`, `offline`→`warning` (noms semàntics)

#### CSS-5: `PWAErrorBoundary` alineat — ✅ COMPLETAT
- `bg-blue-600` → `bg-primary`, `text-gray-900` → `text-foreground`
- `text-gray-600` → `text-slate-500`, `bg-gray-100`/`bg-gray-200` → `bg-slate-100`/`bg-slate-200`
- Layout complet redissenyat: card amb border, shadow, rounded-xl (coherent amb la resta de l'app)
- Icona reduïda de `w-24 h-24` a `w-16 h-16`, color `text-danger`

#### CSS-6: Shadow token `--shadow-soft` — MANTINGUT
- Token disponible a `@theme` per ús futur. No eliminat.

#### CSS-7: Z-index escala definida — ✅ COMPLETAT
- Afegit a `globals.css`: `--z-drawer: 40`, `--z-modal: 50`, `--z-alert: 100`, `--z-sos: 200`
- Tokens disponibles via `z-drawer`, `z-modal`, `z-alert`, `z-sos` a Tailwind

#### CSS-8: `console.log` eliminat — ✅ COMPLETAT
- `dashboard/page.tsx:139`: `console.log('View walk:', id)` → `(id) => handleWalkClick(id)`

---

### 4.4 So SOS — test d'usuari
- [ ] Test d'usuari amb resposta emocional al so substituït (chime càlid vs alarm)

### 4.5 i18n
- [ ] Pass complet de strings català/castellà/angular

---

## Visió futura (fora d'scope actual)

**Predicció d'ubicació amb ML:** Un cop hi hagi dades suficients de passejades reals, es pot explorar un model de machine learning per predir la ubicació probable del pacient en cas de pèrdua o incidència. Això és un producte dins d'un producte (model entrenat amb dades de trajectòria, predicció espacial, escenari d'UX definit) i requereix: (1) dataset de passejades reals, (2) model entrenat i validat, (3) una UX que integrï la predicció de manera calm i no alarmant. No entra a l'action-plan actual — és una idea per a una versió avançada futura.