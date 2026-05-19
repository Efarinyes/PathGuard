# PathGuard — Fase 4: Pla Detallat Post-Beta

**Data:** 2026-05-19  
**Estat:** Planificació  
**Branca suggerida:** `feat/phase4-owner-dashboard` (4.1), `refactor/phase4-architecture` (4.2, 4.3)

---

## Resum executiu

La Fase 4 té **5 sub-tasques** amb complexitats molt diferents. L'ordre d'execució importa perquè 4.1 (Owner Dashboard) és la que aporta més valor de producte immediat, mentre que 4.2 i 4.3 són reforma estructural que facilita futures millores.

| Sub-tasca | Complexitat | Temps estimat | Prioritat | Risc |
|-----------|-------------|---------------|-----------|------|
| 4.1 Owner Dashboard | Mitjana | 12-16h | **Alta** (valor de producte) | Baix |
| 4.2 Arquitectura backend | Alta | 6-8h | Mitjana | Mitjà (7 dicts globals acoblats) |
| 4.3 Arquitectura frontend | Mitjana-Alta | 10-14h | Mitjana | Baix-Mitjà |
| 4.4 Test d'usuari SOS | Baixa | 2-3h | Baixa | Baix |
| 4.5 i18n | Mitjana (voluminosa) | 27-38h | Baixa (post-beta) | Baix |

**Recomanació d'ordre:** 4.1 → 4.2 → 4.3 → 4.4 → 4.5

Raó: 4.1 és la funcionalitat visible per l'usuari. 4.2 i 4.3 són refactoritzacions que es beneficien de tenir el dashboard funcionant abans de tocar l'arquitectura.

---

## 4.1 Owner Dashboard (`/caregiver/dashboard`)

### Estat actual

- **No existeix** la ruta `/caregiver/dashboard`. El caregiver és una sola pàgina a `/caregiver`.
- **CaregiverHeader** no té menú — és una barra plana amb títol + botó d'invitació (només owner) + logout.
- **CaregiverAnalytics** ja existeix però està comentat/amagat del dashboard actiu (Fase 1).
- L'endpoint **`GET /auth/patient/activation-code`** ja existeix i funciona (owner-only).
- L'endpoint **SOS toggle NO existeix** — `sos_enabled` només es seteja al registre.
- L'endpoint **walk history** (`GET /walks/`) ja existeix i retorna llista de passejades.
- L'endpoint **walk detail** (`GET /walks/{id}/locations`) ja existeix però no està scoped per owner.

### Sub-tasques

#### 4.1.1 Ruta i layout del Owner Dashboard

**Nova ruta:** `frontend/app/caregiver/dashboard/page.tsx`

- Cal `RoleGuard` que permeti accés només si `isOwner === true`
- Layout consistent amb `/caregiver` però sense la vista de monitorització en temps real
- Navegació des de `CaregiverHeader`: afegir icona de menú/gear que només es mostra si `isOwner`
  - Opcions del menú: "Dashboard" (propi), "Convidar cuidador", "Codi d'activació", "Tancar sessió"

**Temps:** 4-5h  
**Fitxers nous:** 1 pàgina, 1 layout  
**Fitxers modificats:** `CaregiverHeader.tsx`, `RoleGuard.tsx`

#### 4.1.2 Històric de passejades amb mapa

- Reutilitzar `CaregiverWalkHistory` + `CaregiverMap`
- Afegir vista de detall: clic en un passeig → mostra ruta al mapa amb punts
- Endpoint existent: `GET /walks/{id}/locations` (cal verificar owner scope al backend)

**Temps:** 4-5h (major part UI)  
**Fitxers nous:** 1 component `WalkDetailModal` o similar  
**Fitxers modificats:** `walkService.ts` (afegir mètode per obtenir locations d'un passeig)

#### 4.1.3 Activar/desactivar SOS

- **Backend:** Nou endpoint `PATCH /groups/{group_id}/sos-toggle` (owner-only)
  - Modifica `Group.sos_enabled` (columna que ja existeix)
  - Retorna `{ sos_enabled: bool }`
- **Frontend:** Toggle switch al dashboard del owner
  - Estat actual obtingut de `GET /auth/me` (ja retorna `sos_enabled` via group info)

**Temps:** 2-3h  
**Fitxers nous:** 1 endpoint al backend, 1 component `SOSToggle` al frontend  
**Fitxers modificats:** `routers.py` o nou router, `walkService.ts` o nou service

#### 4.1.4 Veure i regenerar codi d'activació

- L'endpoint `GET /auth/patient/activation-code` ja existeix i funciona
- **Frontend:** Component que mostri el codi (gran, llegible) amb botó "Regenerar"
  - Regenerar = cridar `GET /auth/patient/activation-code` (l'endpoint regenera si està usat)
  - Consideració: mostrar estat del codi (usado/no usat)

**Temps:** 2-3h  
**Fitxers nous:** 1 component `ActivationCodeDisplay`  
**Fitxers modificats:** `walkService.ts` o `patientService.ts` (afegir mètode)

#### 4.1.5 Reutilitzar CaregiverAnalytics

- Moure `CaregiverAnalytics` del dashboard actiu (on està comentat) al nou Owner Dashboard
- Enquadrar com "Informació disponible si la vols veure" — botó/accordion desplegable, no visible per defecte
- El component ja rep `analytics` i `walks` com a props — només cal muntar-lo

**Temps:** 1-2h  
**Fitxers modificats:** Nou `CaregiverDashboardLayout.tsx` o `OwnerDashboard.tsx`

### Punts d'atenció 4.1

- **Owner scope:** Cal verificar que tots els endpoints nous verifiquin `is_owner`. L'endpoint d'activation code ja ho fa, però walk detail (`GET /walks/{id}/locations`) cal scrolled per owner.
- **Menú responsive:** `CaregiverHeader` és molt simple ara (3 elements horitzontals). Afegir un menú desplegable requereix pensament d'UX per mòbil vs desktop.
- **No afegir pèrdua de cobertura com a mètrica** — explícitament prohibit per l'auditoria de producte (PD-7).

### Checklist de verificació 4.1

- [ ] Ruta `/caregiver/dashboard` accessible només per owner
- [ ] Menú a CaregiverHeader amb accés al dashboard
- [ ] Històric de passejades amb data, durada, ruta al mapa
- [ ] Toggle SOS que modifica `Group.sos_enabled`
- [ ] Visualització i regeneració de codi d'activació
- [ ] CaregiverAnalytics visible com a secció opt-in
- [ ] Zero mètriques de pèrdua de cobertura
- [ ] `pytest` i `npm run build` sense errors

---

## 4.2 Arquitectura backend

### Estat actual

**7 diccionaris globals mutables** amb acoblament implícit:

| Store | Fitxer | Línies | Problema |
|-------|--------|--------|----------|
| `_patient_status_store` | `connection_manager.py:93` | Dict global | Importat per `presence_tracker.py` — acoblament directe |
| `group_rooms` | `connection_manager.py:14` | Instància | |
| `patient_connections` | `connection_manager.py:15` | Instància | |
| `caregivers` | `connection_manager.py:16` | Instància | |
| `websocket_to_user` | `connection_manager.py:17` | Instància | |
| `websocket_to_group` | `connection_manager.py:18` | Instància | |
| `walk_state_cache._cache` | `state.py:7` | Instància | |

**`PresenceTracker`** és una classe estàtica que importa `_patient_status_store` directament — viola SRP i crea acoblament creuat entre mòduls.

### Sub-tasques

#### 4.2.1 Fusionar PresenceTracker dins ConnectionManager

- Moure els 3 mètodes de `PresenceTracker` a `ConnectionManager`
- Afegir `set_patient_online(group_id)`, `set_patient_offline(group_id)`, `get_patient_status(group_id)` com a mètodes d'instància
- Eliminar `_patient_status_store` com a variable module-level → moure a `self._patient_status_store` dins `ConnectionManager`
- Actualitzar `websocket_endpoint.py` per cridar `connection_manager.set_patient_online()` en lloc de `PresenceTracker.set_patient_online()`
- Eliminar `presence_tracker.py` completament

**Temps:** 2-3h  
**Fitxers eliminats:** `presence_tracker.py`  
**Fitxers modificats:** `connection_manager.py`, `websocket_endpoint.py`, `snapshot_service.py`

#### 4.2.2 Eliminar stores module-level

- Convertir `_patient_status_store` a `ConnectionManager._patient_status_store` (propietat d'instància)
- La propietat `patient_status` ja existeix — simplement canviar la font de dades
- `walk_state_cache` ja és una classe (`WalkStateCache`) — no cal canviar, només assegurar que es pot injectar

**Temps:** 2-3h  
**Risc:** Mitjà — cal verificar que tots els imports de `_patient_status_store` s'actualitzen. La llista és petita: `connection_manager.py`, `presence_tracker.py` (que s'elimina), `websocket_endpoint.py`.

### Punts d'atenció 4.2

- **No és una refactorització gran** — l'abast és limitat (3 fitxers principals, ~299 línies afectades). Però hi ha acoblament implícit que cal trencar amb cura.
- **Tests:** Els 10 tests de WebSocket que fallen per timing (no relacionats amb aquest canvi) poden complicar la verificació. Cal arreglar-los o saltar-los abans.
- **Zero impacte en producte** — l'usuari no nota res. És reforma interna que facilita futures millores (Redis per escalat, testabilitat).

### Checklist de verificació 4.2

- [ ] `PresenceTracker` eliminat, mètodes moguts a `ConnectionManager`
- [ ] `_patient_status_store` és propietat d'instància, no module-level
- [ ] Zero imports de `presence_tracker` en tot el codi
- [ ] `pytest` passa (152/152)

---

## 4.3 Arquitectura frontend

### Estat actual

#### 4.3.1 locationService — Objecte literal amb estat module-level

```typescript
// Línia 18-20: estat global
let batchBuffer: LocationPayload[] = [];
let batchTimer: NodeJS.Timeout | null = null;
let _isSyncing = false;

// Línia 22-175: objecte literal
export const locationService = { ... _resetInternalState() ... };
```

**Problema:** `_resetInternalState` no reseteja `_isSyncing`. Les variables `let` module-level són compartides entre tests. El patró és hostil a testejar.

**Solució:** Convertir a classe amb estat privat. Per compatibilitat, exportar una instància singleton.

```typescript
class LocationService {
  private batchBuffer: LocationPayload[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  // ... mètodes
}
export const locationService = new LocationService();
```

**Temps:** 2-3h  
**Fitxers modificats:** `locationService.ts`, `locationService.test.ts` (si existeix)

#### 4.3.2 Extreure useWalkSession de PatientWalkController

Actualment `PatientWalkController` barreja 6 responsabilitats:
1. Walk lifecycle (start/stop) — **3 fetch() directes** (línies 83, 102, 134)
2. Location tracking sync (`useLocationTracking`)
3. WebSocket heartbeat (`useWebSocket`)
4. SOS enablement state
5. Notification state
6. Render UI

**Solució:** Crear `useWalkSession` que encapsuli:
- `startWalk()` — delegar a `walkService.startWalk()`
- `stopWalk()` — delegar a `walkService.stopWalk()` + `locationService.flushFinal()`
- Auto-recovery (walk stuck handling)
- `isWalking`, `isLoading`, `activeWalkId` state

**Temps:** 3-4h  
**Fitxers nous:** `hooks/useWalkSession.ts`  
**Fitxers modificats:** `PatientWalkController/index.tsx`, `walkService.ts` (afegir `startWalk`/`stopWalk`)

#### 4.3.3 Eliminar fetch() directs de PatientWalkController

Eliminar les 3 crides `fetch()` i delegar-les a `walkService`:
- `walkService.startWalk(deviceToken)` — nou mètode
- `walkService.stopWalk(deviceToken)` — nou mètode (ja existeix parcialment)

**Temps:** 1-2h (sub-tasca de 4.3.2, fer conjuntament)

#### 4.3.4 Crear WSEventType discriminated union

Actualment `useLivePatientLocation.ts` té 8 branques if-else per tipus de missatge WS. Crear:

```typescript
type WSEventType =
  | { type: 'snapshot'; payload: WalkSnapshotMessage }
  | { type: 'walk_started'; timestamp: number }
  | { type: 'walk_stopped' }
  | { type: 'patient_online' }
  | { type: 'patient_offline' }
  | { type: 'watchers_update'; count: number }
  | { type: 'sos_alert'; patient_id: number; walk_id: number | null; sos_count: number; timestamp: string }
  | { type: 'location_update'; payload: LocationPayload };
```

**Temps:** 1-2h  
**Fitxers nous:** `lib/wsEventTypes.ts` o integrat a `WalkEventProcessor.ts`  
**Fitxers modificats:** `useLivePatientLocation.ts`

#### 4.3.5 Moure if-else chain a WalkEventProcessor.classifyEvent()

Crear mètode `classifyEvent(rawMessage: unknown): WSEventType | null` dins `WalkEventProcessor` per extreure la lògica de classificació de `useLivePatientLocation`.

**Temps:** 2-3h (fer conjuntament amb 4.3.4)

### Punts d'atenció 4.3

- **4.3.1 té risc baix** — és mecànic. Però cal verificar que `_resetInternalState` ja no es faci servir enlloc (tests?).
- **4.3.2-4.3.3 tenen risc mitjà** — l'auto-recovery (retry de start walk si hi ha stuck walk) és la part més delicada. Cal testejar bé.
- **4.3.4-4.3.5 tenen risc baix** — refactorització de tipus, zero canvi de comportament.
- **Ordre recomanat:** 4.3.1 → 4.3.4+4.3.5 → 4.3.2+4.3.3. Per què? Primer netejar els tipus, després extreure el hook, així el hook ja treballa amb tipus nets.

### Checklist de verificació 4.3

- [ ] `locationService` és una classe, no un objecte literal
- [ ] `_resetInternalState()` eliminat
- [ ] Zero `fetch()` directes a `PatientWalkController`
- [ ] `useWalkSession` hook extret i funcionant
- [ ] `WSEventType` discriminated union creat
- [ ] `WalkEventProcessor.classifyEvent()` extret
- [ ] `npm run build` sense errors

---

## 4.4 So SOS — test d'usuari

### Estat actual

El so SOS ja és un chime càlid (440-523-660Hz, implementat a la Fase 1). Aquesta sub-tasca és **només verificació amb usuaris reals**, no canvi de codi.

### Planificació

- Trobar 3-5 usuaris de test (familiars, amics)
- Demanar-los que escoltin el so en context (durant un passeig simulat)
- Avaluar: se senten alarmats? tranquil·litza? és perceptible però no agressiu?
- Documentar feedback qualitatiau

**Temps:** 2-3h (coordinació + documentació, no codi)

### Checklist de verificació 4.4

- [ ] 3+ usuaris han escoltat el so en context
- [ ] Feedback documentat: percepció emocional, volum, claredat

---

## 4.5 i18n

Aquesta és la tasca més voluminosa però menys urgent. Es deixa per post-beta com indica l'action-plan.

### Estat actual

- **134 strings catalans** al frontend (JSX, components, manifest, meta)
- **3 strings catalans** al backend (fallbacks)
- **25 strings anglesos** al backend (errors que poden filtrar-se)
- **0 infraestructura i18n** — cap llibreria, cap context, cap fitxer de traduccions

### Estimació detallada

| Pas | Temps |
|-----|-------|
| Instal·lar `next-intl`, configurar middleware i layout per locale | 4-6h |
| Extreure 134 strings catalans a `ca.json` | 4-5h |
| Crear `es.json` i `en.json` (traducció) | 3-4h |
| Substituir hardcoded strings per `t('key')` en 25+ fitxers | 5-7h |
| Format de dates/numbers dinàmics | 2-3h |
| Backend error mapping (frontend-side) | 2-3h |
| Selector d'idioma al CaregiverHeader | 2-3h |
| Tests i verificació de regressió | 3-4h |
| **Total** | **25-35h** |

### Decisions de disseny pendents

- **Biblioteca:** `next-intl` (recomanat per App Router)
- **Detecció d'idioma:** `Accept-Language` header + cookie guardada des del dashboard de l'owner
- **Idiomes inicials:** ca (català), es (castellà), en (anglès)
- **Backend errors:** Mapa `errorCode → translatedString` al frontend. El backend queda en anglès.
- **manifest.json:** Un sol idioma (català per defecte). Es pot fer dinàmic en una fase posterior.

**No implementar fins que la funcionalitat estigui estabilitzada post-beta.**

### Checklist de verificació 4.5

- [ ] Zero strings hardcoded en català al frontend (tot a `ca.json`)
- [ ] `es.json` i `en.json` complets i verificats
- [ ] Selector d'idioma al CaregiverHeader (owner)
- [ ] `npm run build` sense errors amb locale per defecte

---

## Dependències entre sub-tasques

```
4.1.1 Ruta i layout ─────────────────────────┐
4.1.2 Històric passejades ────────────────────┤ (independent entre elles, però 4.1.1 primer)
4.1.3 SOS toggle (backend) ──────────────────┤
4.1.4 Codi d'activació ──────────────────────┤
4.1.5 CaregiverAnalytics ────────────────────┘

4.2.1 PresenceTracker → ConnectionManager ─── (4.2.2 depèn de 4.2.1)
4.2.2 Eliminar module-level stores ────────────┘

4.3.1 locationService → classe ─────────────── (independent)
4.3.4+4.3.5 WSEventType + classifyEvent ─────── (independent, fer juntes)
4.3.2+4.3.3 useWalkSession + fetch elimination ─ (depèn de 4.3.4 per tipus nets)

4.4 SOS test d'usuari ──────────────────────── (independent, qualsevol moment)

4.5 i18n ────────────────────────────────────── (post-beta, independent)
```

---

## Riscos i mitigacions

| Risc | Sub-tasca | Mitigació |
|------|-----------|-----------|
| Owner scope no verificat als endpoints existents | 4.1.2, 4.1.3 | Afegir `is_owner` check als endpoints de walk detail i SOS toggle |
| Menú responsive trencat per mòbil | 4.1.1 | Prototipar primer amb Tailwind, testejar en viewport estret |
| `_patient_status_store` importat des de més llocs dels esperats | 4.2 | `grep` global abans de començar, verificar zero imports després |
| locationService `_isSyncing` no es reseteja als tests | 4.3.1 | Convertir a propietat privada de classe, `_resetInternalState()` reseteja tot |
| Auto-recovery de stuck walk trencat | 4.3.2 | Testejar amb escenaris: walk stuck al backend → start → auto-stop → start |
| i18n trencar strings existents | 4.5 | Fer-ho amb `next-intl` que permet claus fallback — si falta una clau, mostra l'anglès |