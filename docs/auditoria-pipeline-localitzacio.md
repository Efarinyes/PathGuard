# AUDITORIA EXHAUSTIVA — PIPELINE DE LOCALITZACIO PATHGUARD

**Data:** 2026-06-04  
**Autor:** Staff Software Engineer (Geolocation + Distributed Systems)  
**Estat:** Document final per a revisió i implementació

---

## 1. ABAST

Pipeline auditat:

```
GPS → Android Foreground Service → IndexedDB → Sync Engine → HTTP API → Backend → Database → WebSocket Broadcast → Caregiver Frontend → Map Rendering
```

Objectiu: identificar defectes arquitectònics que puguin causar pèrdua de punts, duplicats, desordenació, corrupció de trajectòries, race conditions o retransmissions incorrectes.

---

## 2. DECISIONS D'ARQUITECTURA CONFIRMADES

Abans de llistar les troballes, es confirmen 3 decisions preses durant la revisió:

| # | Decisió | Justificació |
|---|---|---|
| 1 | **Guarda per evitar competència entre fonts de dades** | En mode natiu amb plugin, el layer JS està bypassed (`useLocationTracking.ts:130` early return). Afegir guarda explícita per prevenir activació dual en cas de bug futur. |
| 2 | **Persistència del plugin a IndexedDB del navegador /patient** | El plugin actual no té persistència (buffer en memòria). Si Android mata el servei, es perden tots els punts no enviats. IndexedDB del WebView /patient és la capa de persistència correcta — ja existeix (`offlineSyncService.ts`) i és accessible des del plugin via bridge natiu. |
| 3 | **Suavitzat de ruta al mapa** | Cada punt GPS crea un vertex a la polyline. Jitter de 10-15m crea zigzags visuals. Implementar algoritme de suavitzat (Ramer-Douglas-Peucker o moving average) al `MapRenderer.tsx`. |

---

## 3. TROBALLES PER ETAPA

### 3.1 GPS → Android Foreground Service

**Garanties esperades:** Captura precisa, filtrat de jitter (distància mínima), persistència fins a enviament.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **F1** | **P0** | `setMinUpdateDistanceMeters(5)` massa sensible. GPS `PRIORITY_HIGH_ACCURACY` té 10-15m jitter urbà. Cada fluctuació crea punt a la polyline. | Ruta amb zigzags falsos, punts on l'usuari no ha estat | **Alta** (sempre en zona urbana) | Afegir filtre Haversine a `addToBuffer()` comparant amb últim punt enviat (30m). `setMinUpdateDistanceMeters` es pot deixar a 5m com a mínim tècnic Android. | Baix |
| **F2** | **P0** | Buffer `ConcurrentLinkedQueue` max 100 punts. Si connectivitat perduda >500s (100×5s), `buffer.poll()` eviteix punts més antics permanentment. | **Pèrdua de dades** durant offline llarg | Mitjana (depèn de connectivitat) | Persistir buffer a IndexedDB del WebView /patient via bridge natiu. El plugin escriu a IndexedDB en lloc de memòria. `offlineSyncService` ja existeix. | Mitjà |
| **F3** | **P2** | `client_id` generat en memòria (`UUID.randomUUID()`). Si plugin mor i reinicia, nous UUIDs per mateixes ubicacions físiques. | Duplicats si plugin reinicia mid-walk | Baixa (restarts rars) | Persistir `client_id` a disk, o usar ID determinístic basat en timestamp+coordenades | Mitjà |
| **F4** | **P1** | Plugin no té persistència de `walkId`. Servei `START_STICKY` reinicia amb `intent=null`, `walkId=0`. Backend rebutja punts amb `walkId=0`. | **Pèrdua total de dades** després de kill d'app | Mitjana (Android pot matar serveis en background) | Persistir `walkId` a `SharedPreferences`, recuperar en `onStartCommand` amb `intent=null` | Baix |

**Escenari de corrupció real (F2):**
```
1. Usuario camina 10 minuts (120 punts GPS)
2. Connectivitat es perd (túnel, zona rural)
3. Buffer acumula punts, arriba a 100
4. buffer.poll() eviteix punts 1-20 (minuts 0-2)
5. Connectivitat torna
6. Punts 21-120 enviats, punts 1-20 perduts per sempre
7. Ruta al mapa comença al minut 2, no al 0
```

---

### 3.2 Android Foreground Service → HTTP API

**Garanties esperades:** Enviament ordenat per timestamp, reintents amb backoff, idempotència.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **F5** | **P0** | Re-queue després de fallida HTTP: punts re-encuats s'afegeixen DESPRÉS de nous punts arribats durant el flush. Buffer: `[nous_punts..., vells_punts...]`. Timestamps fora d'ordre. | Punts rebutjats per `WalkEventProcessor` chronological check | **Alta** (qualsevol offline) | Ordenar buffer per timestamp abans de flush, o usar `PriorityQueue` ordenada per timestamp | Mitjà |
| **F6** | **P1** | Plugin no marca `is_recovered`. Tots els punts enviats sense flag. Backend tracta tot com a "live". | Mapa no mostra zones de cobertura perduda | **Alta** (sempre) | Plugin ha de trackejar estat de connexió. Punts del buffer acumulats durant offline → `is_recovered=true`. Punts enviats immediatament → `is_recovered=false`. | Mitjà |
| **F7** | **P2** | Plugin no sap quan acaba el walk. Si walk acaba i plugin segueix, punts rebutjats per `verify_walk()`. Plugin re-encua infinitament. | Loop infinit de reintents, bateria drenada | Baixa (walk lifecycle gestionat per app) | Plugin ha de consultar estat del walk periòdicament, o app ha d'enviar `STOP` explícit | Mitjà |
| **F8** | **P1** | Guarda per evitar competència entre fonts de dades. Si per bug, plugin i JS layer s'activen simultàniament, duplicats massius. | Duplicats a DB i mapa | Baixa (bug futur) | `useLocationTracking.ts`: quan `isNative && trackingConfig`, assegurar que `watchId.current` no s'usa per JS geolocation. Afegir flag `pluginActive` que bloqueja JS path. | Baix |

**Escenari de corrupció real (F5):**
```
1. Plugin envia batch cada 5s
2. HTTP falla (timeout, 503)
3. flushBuffer() catch: re-encua tots els punts al buffer
4. Mentrestant, GPS continua: nous punts arriben, s'afegeixen al buffer
5. Buffer ara: [punt_101, punt_102, punt_1, punt_2, ..., punt_100]
6. Connectivitat torna
7. flushBuffer() envia: punt_101 (timestamp recent), punt_102 (recent), punt_1 (antic), punt_2 (antic)...
8. Backend broadcasta en aquest ordre
9. Caregiver WalkEventProcessor: punt_101 OK, punt_102 OK, punt_1 REBUTJAT (timestamp < latestTimestamp)
10. Punts 1-100 perduts al mapa
```

---

### 3.3 HTTP API → Backend

**Garanties esperades:** Idempotència per `client_id`, ordenació per timestamp abans de broadcast, validació de walk actiu.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **F9** | **P1** | `save_batch()` no ordena per timestamp abans de broadcast. `broadcast_events` es construeix en l'ordre del array `points`. | Punts broadcastats fora d'ordre temporal | Mitjana (depèn de l'ordre d'arribada) | Ordenar `broadcast_events` per `timestamp` abans de loop de publish | Baix |
| **F10** | **P1** | `walk_state_cache.update()` només guarda l'ÚLTIM punt del batch. Snapshot només té punt més recent. | Caregiver que es connecta veu només 1 punt, no la ruta | **Alta** (cada reconnect) | Guardar N últims punts al cache, o fetch from DB on snapshot | Mitjà |
| **F11** | **P1** | `MAX_LOCATION_HISTORY = 50`. Snapshot limitat a 50 punts. Walks >50 punts perden història. | Ruta truncada per walks llargs | **Alta** (walks >25min a 30s interval) | Augmentar a 200, o fer dinàmic, o paginació | Baix |

**Escenari de corrupció real (F9):**
```
1. Plugin envia batch de 10 punts (ordenats per timestamp)
2. Backend save_batch() processa en ordre
3. broadcast_events = [punt_1, punt_2, ..., punt_10]
4. event_publisher.publish() per cada punt (async)
5. Per raons de scheduling, punt_5 es broadcasta abans que punt_4
6. Caregiver rep: punt_1, punt_2, punt_3, punt_5, punt_4, punt_6...
7. WalkEventProcessor: punt_5 OK, punt_4 REBUTJAT (timestamp < latestTimestamp)
8. Punt 4 perdut
```

---

### 3.4 Backend → WebSocket Broadcast

**Garanties esperades:** Entrega ordenada de missatges, heartbeat per mantenir connexió, reconnexió automàtica.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **F12** | **P1** | `ConnectionManager` només comprova WS per presència. HTTP location recent no compta com a keepalive. WebView JS pausa en background → WS mor → `patient_offline`. | **Fals offline** quan pantalla apagada | **Alta** (sempre en background) | Backend: si HTTP location rebut <30s, tractar com a online. Modificar `ConnectionManager.is_patient_online()` per comprovar DB si no hi ha WS. | Mitjà |
| **F13** | **P2** | `WS_MAX_RECONNECT_ATTEMPTS = 5` (25s total). Render cold start ~60s. WS mai recupera. | Connexió permanentment morta després de cold start | Mitjana (depèn de inactivitat) | Infinite retry amb backoff lent (30s) després de 5 intents ràpids | Baix |

---

### 3.5 WebSocket → Caregiver Frontend

**Garanties esperades:** Deduplicació per `event_id`, ordenació cronològica, rendering correcte de ruta.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **F14** | **P2** | `WalkEventProcessor.shouldProcessMessage()` rebutja punts amb `timestamp < latestTimestamp`. Si punts arriben fora d'ordre (per F5, F9), es perden. | Punts vàlids descartats | Mitjana (depèn de F5, F9) | En lloc de rebutjar, inserir en posició correcta a `routeHistory` (binary search per timestamp) | Mitjà |
| **F15** | **P3** | `processedEvents` set capped a 200. Si walk té >200 punts, events antics esborrats. Reconnexió podria reprocessar events ja vistos. | Duplicats visuals en reconnect | Baixa (walks curts) | Augmentar cap o usar TTL | Baix |
| **F16** | **P3** | Meta-fields `_event_name`, `_event_id`, `_timestamp` leakats a WS clients. | Brutícia arquitectural | Sempre | Strip before broadcast | Baix |

---

### 3.6 Caregiver Frontend → Map Rendering

**Garanties esperades:** Ruta precisa sense jitter, diferenciació visual de zones recovered, auto-center en posició actual.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **F17** | **P1** | `MapRenderer.segmentLocations()` separa per `is_recovered`, però plugin mai envia flag. Tots els punts són "live" (blau). | Mapa no mostra zones de cobertura perduda | **Alta** (sempre) | Veure F6 | - |
| **F18** | **P2** | No hi ha suavitzat de ruta. Cada punt GPS crea un vertex a la polyline. Jitter crea zigzags. | Ruta visualment inexacta | **Alta** (GPS sempre té jitter) | Algoritme de suavitzat (Ramer-Douglas-Peucker, o moving average) al `MapRenderer.tsx` | Mitjà |

---

## 4. TAULA RESUM DE TROBALLES

| ID | Etapa | Classificació | Problema | Impacte | Probabilitat | Esforç |
|---|---|---|---|---|---|---|
| **F1** | GPS→Plugin | **P0** | 5m min distance massa sensible, no Haversine | Ruta amb zigzags | Alta | Baix |
| **F2** | GPS→Plugin | **P0** | Buffer max 100, sense persistència | Pèrdua de dades | Mitjana | Mitjà |
| **F5** | Plugin→HTTP | **P0** | Re-queue desordenat després de fallida | Punts rebutjats | Alta | Mitjà |
| **F4** | Plugin | **P1** | `walkId` no persistit, perd en restart | Pèrdua total de dades | Mitjana | Baix |
| **F6** | Plugin→HTTP | **P1** | `is_recovered` mai enviat | Mapa no mostra coverage gaps | Alta | Mitjà |
| **F8** | Plugin→HTTP | **P1** | Sense guarda per evitar competència de fonts | Duplicats en cas de bug | Baixa | Baix |
| **F9** | Backend | **P1** | `save_batch()` no ordena abans de broadcast | Punts fora d'ordre | Mitjana | Baix |
| **F10** | Backend | **P1** | Cache només últim punt, snapshot incomplet | Ruta truncada en connect | Alta | Mitjà |
| **F11** | Backend | **P1** | `MAX_LOCATION_HISTORY=50` | Ruta truncada | Alta | Baix |
| **F12** | Backend WS | **P1** | HTTP location no compta com a keepalive | Fals offline | Alta | Mitjà |
| **F3** | Plugin | **P2** | `client_id` no persistit | Duplicats en restart | Baixa | Mitjà |
| **F7** | Plugin | **P2** | Plugin no sap quan acaba walk | Loop infinit reintents | Baixa | Mitjà |
| **F13** | Frontend WS | **P2** | 5 reconnect attempts (25s) < Render cold start (60s) | WS mort permanent | Mitjana | Baix |
| **F14** | Frontend WS | **P2** | Chronological check rebutja en lloc d'inserir | Punts perduts | Mitjana | Mitjà |
| **F18** | Map | **P2** | No suavitzat de ruta | Zigzags visuals | Alta | Mitjà |
| **F15** | Frontend WS | **P3** | `processedEvents` cap 200 | Duplicats en reconnect | Baixa | Baix |
| **F16** | Backend WS | **P3** | Meta-fields leakats | Brutícia | Sempre | Baix |

---

## 5. PLA D'IMPLEMENTACIO PRIORITZAT

### FASE 1 — P0 (Crítics, resoldre immediatament)

**Objectiu:** Eliminar pèrdua de dades i corrupció de trajectòries.

| # | Troballa | Acció | Fitxers afectats |
|---|---|---|---|
| 1.1 | **F1** — Filtre Haversine | Afegir a `LocationSyncForegroundService.java:172-183` (`addToBuffer()`). Comparar amb últim punt enviat, saltar si <30m. | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 1.2 | **F2** — Persistència a IndexedDB | Plugin escriu punts a IndexedDB del WebView /patient via bridge natiu, en lloc de `ConcurrentLinkedQueue` en memòria. `offlineSyncService` ja existeix. | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java`, `frontend/services/offlineSyncService.ts` |
| 1.3 | **F5** — Ordenació abans de flush | Canviar `ConcurrentLinkedQueue` per `PriorityQueue` ordenada per timestamp. O ordenar buffer abans de flush. | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |

### FASE 2 — P1 (Alts, resoldre en proper sprint)

**Objectiu:** Corregir presència falsa, snapshot truncat, i manca de `is_recovered`.

| # | Troballa | Acció | Fitxers afectats |
|---|---|---|---|
| 2.1 | **F4** — Persistir `walkId` | Guardar a `SharedPreferences`, recuperar en `onStartCommand` amb `intent=null`. | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 2.2 | **F6** — Marcar `is_recovered` | Plugin trackeja estat de connexió. Punts del buffer acumulats durant offline → `is_recovered=true`. | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 2.3 | **F8** — Guarda competència fonts | `useLocationTracking.ts`: flag `pluginActive` que bloqueja JS path quan plugin actiu. | `frontend/hooks/useLocationTracking.ts` |
| 2.4 | **F9** — Ordenar abans de broadcast | `location_service.py:175-180`: ordenar `broadcast_events` per `timestamp` abans de loop de publish. | `backend/app/services/location_service.py` |
| 2.5 | **F10** — Cache snapshot complet | `walk_state_cache.update()`: guardar N últims punts, o fetch from DB on snapshot. | `backend/app/db/state.py`, `backend/app/api/websocket/snapshot_service.py` |
| 2.6 | **F11** — `MAX_LOCATION_HISTORY` | Augmentar de 50 a 200. | `backend/app/core/constants.py` |
| 2.7 | **F12** — HTTP location com a keepalive | `ConnectionManager`: si HTTP location rebut <30s, tractar com a online. | `backend/app/api/websocket/connection_manager.py` |
| 2.8 | **F17** — `is_recovered` al mapa | Ja resolt per F6. `MapRenderer.segmentLocations()` funcionarà correctament. | `frontend/components/CaregiverMap/MapRenderer.tsx` |

### FASE 3 — P2 (Mitjans, planificar)

**Objectiu:** Millorar robustesa i qualitat visual.

| # | Troballa | Acció | Fitxers afectats |
|---|---|---|---|
| 3.1 | **F3** — Persistir `client_id` | Usar ID determinístic basat en timestamp+coordenades, o persistir a disk. | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 3.2 | **F7** — Plugin consulta estat walk | Plugin consulta `GET /walks/active` periòdicament, o app envia `STOP` explícit. | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 3.3 | **F13** — Infinite WS retry | `useWebSocket.ts`: després de 5 intents ràpids, backoff lent (30s) indefinit. | `frontend/hooks/useWebSocket.ts` |
| 3.4 | **F14** — Inserció ordenada | `WalkEventProcessor.ts`: en lloc de rebutjar, inserir en posició correcta a `routeHistory` (binary search). | `frontend/lib/WalkEventProcessor.ts` |
| 3.5 | **F18** — Suavitzat de ruta | `MapRenderer.tsx`: algoritme Ramer-Douglas-Peucker o moving average sobre `routeHistory` abans de renderitzar polyline. | `frontend/components/CaregiverMap/MapRenderer.tsx` |

### FASE 4 — P3 (Baixos, backlog)

**Objectiu:** Neteja arquitectural.

| # | Troballa | Acció | Fitxers afectats |
|---|---|---|---|
| 4.1 | **F15** — Cap `processedEvents` | Augmentar de 200 a 500, o usar TTL. | `frontend/lib/WalkEventProcessor.ts` |
| 4.2 | **F16** — Strip meta-fields | `broadcast_handlers.py`: copiar només camps intencionals abans de broadcast. | `backend/app/api/websocket/broadcast_handlers.py` |

---

## 6. DEPENDENCIES ENTRE FASES

```
Fase 1 (P0)
  └── F1 (Haversine) → independent
  └── F2 (IndexedDB) → independent, però habilita F6
  └── F5 (Ordenació) → independent

Fase 2 (P1)
  └── F4 (walkId persistit) → dependent de F2 (IndexedDB)
  └── F6 (is_recovered) → dependent de F2 (IndexedDB)
  ── F8 (Guarda competència) → independent
  └── F9 (Ordenar broadcast) → independent
  └── F10 (Cache snapshot) → independent
  └── F11 (MAX_LOCATION_HISTORY) → independent
  └── F12 (HTTP keepalive) → independent

Fase 3 (P2)
  └── F3 (client_id persistit) → dependent de F2 (IndexedDB)
  ─ F7 (Plugin consulta walk) → independent
  └── F13 (WS retry) → independent
  └── F14 (Inserció ordenada) → dependent de F5 (Ordenació)
  └── F18 (Suavitzat ruta) → dependent de F1 (Haversine)

Fase 4 (P3)
  └── F15 (Cap processedEvents) → independent
  ── F16 (Strip meta-fields) → independent
```

---

## 7. ESTIMACIO D'ESFORC TOTAL

| Fase | Troballes | Esforç estimat |
|---|---|---|
| Fase 1 (P0) | 3 | 2-3 dies |
| Fase 2 (P1) | 8 | 5-7 dies |
| Fase 3 (P2) | 5 | 3-4 dies |
| Fase 4 (P3) | 2 | 1 dia |
| **Total** | **18** | **11-15 dies** |

---

## 8. METRIQUES D'EXIT

Després d'implementar totes les fases:

| Mètrica | Objectiu |
|---|---|
| Pèrdua de punts durant offline | 0% (tots els punts persistits a IndexedDB) |
| Duplicats a DB | 0% (idempotència per `client_id`) |
| Punts fora d'ordre al mapa | 0% (ordenació abans de broadcast + inserció ordenada) |
| Falsos offline | 0% (HTTP location com a keepalive) |
| Ruta truncada | 0% (cache complet + `MAX_LOCATION_HISTORY=200`) |
| Zigzags per jitter | <5% de punts filtrats per Haversine |
| Zones de coverage no diferenciades | 0% (`is_recovered` propagat correctament) |

---

*Document generat per auditoria de pipeline de localització PathGuard. Versió 1.0 — 2026-06-04.*
