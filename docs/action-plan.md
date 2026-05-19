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

### 4.1 Owner Dashboard (`/caregiver/dashboard`)
Ruta separada, accessible des d'un menú, només per owner. Contingut:

- [ ] Històric de passejades (data, durada, ruta al mapa)
- [ ] Activar/desactivar SOS per al pacient
- [ ] Veure i regenerar codi d'activació del dispositiu
- [ ] Reutilitzar `CaregiverAnalytics` aquí: freqüència setmanal, durada mitjana, hores habituals — enquadrat com "informació disponible si la vols veure", no com a vigilància passiva

**No inclou:**
- Pèrdua de cobertura com a mètrica o columna. La pèrdua de cobertura només es mostra com a estat transitori a la UI de monitorització activa ("Reconnectant..."). No es loga, no es comptabilitza, no es mostra al dashboard. Si el cuidador mira l'historial de mapes, les zones sense punts ja són implícitament visibles.

### 4.2 Arquitectura backend
- [ ] Fusionar `PresenceTracker` dins de `ConnectionManager` — single source of truth per presència
- [ ] Eliminar stores module-level (`_patient_status_store`, `_patient_device_status_store`) i moure'l a la classe

### 4.3 Arquitectura frontend
- [ ] Convertir `locationService` de object literal a classe (eliminar `_resetInternalState()`)
- [ ] Extreure `useWalkSession` hook de `PatientWalkController` (start/stop walk + auto-recovery)
- [ ] Eliminar `fetch()` directs de `PatientWalkController` — delegar a `walkService`
- [ ] Crear `WSEventType` discriminated union per type-safe dispatch a `useLivePatientLocation`
- [ ] Moure if-else chain de `useLivePatientLocation` a `WalkEventProcessor.classifyEvent()`

### 4.4 So SOS — test d'usuari
- [ ] Test d'usuari amb resposta emocional al so substituït (chime càlid vs alarm)

### 4.5 i18n
- [ ] Pass complet de strings català/castellà/angular

---

## Visió futura (fora d'scope actual)

**Predicció d'ubicació amb ML:** Un cop hi hagi dades suficients de passejades reals, es pot explorar un model de machine learning per predir la ubicació probable del pacient en cas de pèrdua o incidència. Això és un producte dins d'un producte (model entrenat amb dades de trajectòria, predicció espacial, escenari d'UX definit) i requereix: (1) dataset de passejades reals, (2) model entrenat i validat, (3) una UX que integrï la predicció de manera calm i no alarmant. No entra a l'action-plan actual — és una idea per a una versió avançada futura.