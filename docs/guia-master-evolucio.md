# GUIA MASTER — EVOLUCIÓ PATHGUARD POST-AUDITORIA

**Data:** 2026-06-04  
**Autor:** Principal Engineer  
**Font:** Fusió de 4 auditories (pipeline localització, recuperació cobertura, presència WS, GPS/mapa/qualitat)  
**Estat:** Guia d'implementació per a desenvolupadors

---

## 1. RESUM EXECUTIU

Les 4 auditories han identificat **52 troballes** (F1-F18, S1-S9, P1-P8, G1-G17). Després de deduplicar (6 dupes explícites) i agrupar per causa arrel, queden **42 accions úniques** organitzades en **6 causes sistèmiques**.

**Diagnòstic principal:** El sistema funciona en condicions ideals (pantalla encesa, bona cobertura, stock Android) però es degrada ràpidament en condicions reals (screen-off, urban canyons, offline intermitent, OEMs agressius). La causa no és un sol bug sinó una arquitectura que assumeix condicions òptimes a cada capa.

---

## 2. DUPES IDENTIFICADES (eliminades del roadmap)

| Troballa | Duplicada de | Motiu |
|---|---|---|
| G1 | F1 | Mateix problema: `setMinUpdateDistanceMeters(5)` |
| S6 | F2 | Mateix problema: plugin buffer en memòria, max 100 |
| P4 | F4 | Mateix problema: walkId no persistit |
| P2 | F13 | Mateix problema: 5 reconnect attempts insuficients |
| G14 | F18 | Mateix problema: zero suavitzat de ruta |
| P1 | F12 | Mateix problema: HTTP location no compta com keepalive |

---

## 3. CAUSES ARREL SISTÈMIQUES

### CS-1: Plugin Natiu Immadur (14 accions)

**Diagnòstic:** El `LocationSyncForegroundService.java` es va crear a Fase E però no té les garanties mínimes d'un GPS tracker de producció: sense persistència, sense filtratge, sense estat persistent.

**Impacte:** Pèrdua de >90% de punts en offline llarg, zigzags per jitter, salts impossibles, tracking perdut després de kill OEM.

| # | ID Original | Prioritat | Acció | Esforç |
|---|---|---|---|---|
| 1 | F2/S6 | **P0** | Persistir buffer a IndexedDB via Capacitor bridge (eliminar `ConcurrentLinkedQueue`) | Mitjà |
| 2 | F5 | **P0** | Ordenar buffer per timestamp abans de flush (`PriorityQueue` o sort pre-flush) | Baix |
| 3 | F1 | **P0** | Pujar `setMinUpdateDistanceMeters(15)` + Haversine 25m a `addToBuffer()` | Baix |
| 4 | G2 | **P0** | Filtre d'accuracy: `getAccuracy() > 50f` → descartar | Baix |
| 5 | G3 | **P0** | Detecció de teleportació: Haversine > 80m amb elapsed < 5s → descartar | Baix |
| 6 | F4/P4 | **P1** | Persistir `walkId` a `SharedPreferences`, recuperar en `onStartCommand(intent=null)` | Baix |
| 7 | F6 | **P1** | Trackejar estat de connexió: punts del buffer offline → `is_recovered=true` | Mitjà |
| 8 | G4 | **P1** | Filtre de speed: calcular speed = haversine/dt, descartar si > 5 m/s | Baix |
| 9 | G5 | **P1** | Filtre d'edat del fix: `currentTimeMillis() - getTime() > 10000` → descartar | Baix |
| 10 | G6 | **P1** | Filtre de heading: bearing diff > 90° → marcar `low_confidence` | Mitjà |
| 11 | G7 | **P2** | Kalman Filter 1D (lat + lng) integrat a `addToBuffer()` | Alt |
| 12 | G8 | **P2** | Mock gate: `isMock() == true` → descartar | Baix |
| 13 | F3 | **P2** | `client_id` determinístic: `SHA256(timestamp + lat + lng + walk_id)` | Mitjà |
| 14 | F7 | **P2** | Plugin consulta estat del walk o rep `STOP` explícit de l'app | Mitjà |

### CS-2: Sync Engine Trencat (7 accions)

**Diagnòstic:** `locationService.ts` té bugs crítics d'idempotència que causen duplicats massius a la base de dades. El flux `flushBatch() → catch → re-add` és la font principal de corrupció.

**Impacte:** Duplicats exponencials a IndexedDB i PostgreSQL, sync lent (1 request/punt), errors silenciosos.

| # | ID Original | Prioritat | Acció | Esforç |
|---|---|---|---|---|
| 15 | S1 | **P0** | Unificar `client_id` = key de IndexedDB. Eliminar doble UUID. | Baix |
| 16 | S2 | **P0** | Eliminar catch re-add. Si batch falla, punts ja són a IndexedDB. No re-afegir. | Baix |
| 17 | S7 | **P0** | `client_id` determinístic: `SHA256(timestamp + lat + lng + walk_id)` | Baix |
| 18 | S5 | **P2** | `syncQueuedPoints()` envia batches de 20, no 1 request/punt | Mitjà |
| 19 | S4 | **P2** | `getUnsynced()` amb cursor/paginació + límit 1000 rècords | Mitjà |
| 20 | S3 | **P2** | `markSynced()` loga warning si id no trobat (observabilitat) | Baix |
| 21 | S9 | **P3** | `clearSynced()` per punt individual (no al `finally` global) | Baix |

### CS-3: Model de Presència Monolític (5 accions)

**Diagnòstic:** El backend determina presència exclusivament per WebSocket. Quan Android Doze congela el JS del WebView, el WS mor però el Foreground Service continua enviant GPS per HTTP. El caregiver veu "offline" quan el pacient està caminant.

**Impacte:** 100% falsos offline quan la pantalla s'apaga. Caregiver perd confiança en el sistema.

| # | ID Original | Prioritat | Acció | Esforç |
|---|---|---|---|---|
| 22 | P1/F12 | **P0** | `ConnectionManager`: `last_http_location_at[group_id]`. Si HTTP < 60s → `gps_online`. | Mitjà |
| 23 | P8 | **P2** | `update_http_presence(group_id)` cridat des de `save_batch()` | Baix |
| 24 | P7 | **P1** | 4 estats de presència: `online`, `gps_online`, `limbo`, `offline` | Mitjà |
| 25 | P3 | **P1** | Dual heartbeat: HTTP `/heartbeat` des del Foreground Service cada 30s | Mitjà |
| 26 | P5 | **P2** | Protecció OEM: `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, guies per fabricant | Alt |

### CS-4: Backend Passiu (7 accions)

**Diagnòstic:** El backend accepta qualsevol dada sense validar. No ordena abans de broadcast, no detecta anomalies, no calcula metadata de qualitat. La responsabilitat de qualitat recau exclusivament al client.

**Impacte:** Dades corruptes a DB, punts fora d'ordre al mapa, snapshot truncat, impossible auditar qualitat.

| # | ID Original | Prioritat | Acció | Esforç |
|---|---|---|---|---|
| 27 | F9 | **P1** | `save_batch()`: ordenar `broadcast_events` per `timestamp` abans de publish | Baix |
| 28 | F10 | **P1** | `walk_state_cache.update()`: guardar N últims punts, no només l'últim | Mitjà |
| 29 | F11 | **P1** | `MAX_LOCATION_HISTORY`: 50 → 200 | Baix |
| 30 | G9 | **P1** | Validar `-90 <= lat <= 90`, `-180 <= lng <= 180` a `save_batch()` | Baix |
| 31 | S8 | **P1** | Backend: `INSERT ... ON CONFLICT (client_id) DO NOTHING` (1 query atòmica) | Baix |
| 32 | G10 | **P2** | Teleportation check soft: Haversine > 100m → marcar `low_confidence` | Mitjà |
| 33 | G11 | **P2** | Columnes `speed_ms: Float` i `accuracy_m: Float` al model Location | Mitjà |

### CS-5: Frontend Sense Filtratge Geoespacial (6 accions)

**Diagnòstic:** `WalkEventProcessor` accepta qualsevol punt sense validar. `MapRenderer` connecta punts crus sense suavitzat. El caregiver veu exactament el que arriba, incloent errors.

**Impacte:** Rutes visualment incorrectes, zigzags, salts, mapa que "balla".

| # | ID Original | Prioritat | Acció | Esforç |
|---|---|---|---|---|
| 34 | G14/F18 | **P0** | Douglas-Peucker (ε=3m) abans de renderitzar polyline | Mitjà |
| 35 | G12 | **P1** | `WalkEventProcessor.validateLocation()`: speed check + distància màxima | Mitjà |
| 36 | F14 | **P2** | Inserció ordenada (binary search) en lloc de rebutjar punts fora d'ordre | Mitjà |
| 37 | G15 | **P1** | 4 segments visuals: live, recovered, low_confidence, stale | Mitjà |
| 38 | G13 | **P2** | Gap detection: dt > 120s → inserir gap marker a `routeHistory` | Baix |
| 39 | G17 | **P2** | Auto-pan intel·ligent: només si punt és fora del viewport | Baix |

### CS-6: WebSocket Fràgil (3 accions)

**Diagnòstic:** La connexió WebSocket es recupera malament després de Doze/background. 5 intents no són suficients per Render cold start. Meta-fields interns leaken als clients.

**Impacte:** WS mort permanent després de screen-off, duplicats en reconnect, brutícia arquitectural.

| # | ID Original | Prioritat | Acció | Esforç |
|---|---|---|---|---|
| 40 | F13/P2 | **P1** | Infinite WS retry: 5 intents ràpids (backoff 1-16s) + 30s indefinit | Baix |
| 41 | F16 | **P3** | Strip `_event_name`, `_event_id`, `_timestamp` abans de broadcast | Baix |
| 42 | F15 | **P3** | `processedEvents` cap: 200 → 500 o TTL | Baix |

---

## 4. ROADMAP D'IMPLEMENTACIÓ

### SPRINT 1 — Estabilitzar el Pipeline (P0) — 5-7 dies

**Objectiu:** Zero pèrdua de dades, zero duplicats, ruta visual neta.

```
feat/plugin-gps-filters (branca)
├── CS-1.1  Buffer → IndexedDB via bridge
├── CS-1.2  PriorityQueue per timestamp
├── CS-1.3  Haversine 25m + min distance 15m
├── CS-1.4  Accuracy gate (50m)
├── CS-1.5  Teleportation detection (80m)
├── CS-2.15 Unificar client_id = IndexedDB key
├── CS-2.16 Eliminar catch re-add
├── CS-2.17 client_id determinístic (SHA-256)
└── CS-5.34 Douglas-Peucker al mapa

feat/backend-sync-fixes (branca)
├── CS-4.31 INSERT ON CONFLICT DO NOTHING
└── Tests: 152/152 + nous tests d'idempotència
```

**Verificació:** Walk real al Redmi. Ruta sense zigzags, sense salts, sense duplicats a DB.

### SPRINT 2 — Presència i Robustesa (P1) — 5-7 dies

**Objectiu:** Zero falsos offline, snapshot complet, ordenació correcta.

```
feat/hybrid-presence (branca)
├── CS-3.22 ConnectionManager: last_http_location_at
├── CS-3.24 4 estats de presència
├── CS-3.25 Dual heartbeat (HTTP /heartbeat)
├── CS-6.40 Infinite WS retry
└── Indicator visual 4 colors al caregiver

feat/plugin-persistence (branca)
├── CS-1.6  walkId a SharedPreferences
├── CS-1.7  is_recovered flag
├── CS-1.8  Speed filter
├── CS-1.9  Fix age filter
└── CS-1.10 Heading filter

feat/backend-ordering (branca)
├── CS-4.27 Ordenar broadcast per timestamp
├── CS-4.28 Cache snapshot complet (N punts)
├── CS-4.29 MAX_LOCATION_HISTORY → 200
├── CS-4.30 Validació rang coordenades
└── CS-5.35 WalkEventProcessor.validateLocation()
```

**Verificació:** Screen-off 30 min → caregiver veu "GPS actiu" (no offline). Walk 1h → ruta completa.

### SPRINT 3 — Qualitat Avançada (P2) — 5-7 dies

**Objectiu:** Kalman Filter, metadata de qualitat, segmentació visual, UX polida.

```
feat/kalman-quality (branca)
├── CS-1.11 Kalman Filter
├── CS-1.12 Mock gate
├── CS-4.32 Backend teleportation soft
├── CS-4.33 Columnes speed_ms, accuracy_m
├── CS-5.37 4 segments visuals
├── CS-5.38 Gap detection
├── CS-5.39 Auto-pan intel·ligent
└── CS-3.23 update_http_presence()

feat/sync-efficiency (branca)
├── CS-2.18 Batches de 20
├── CS-2.19 Cursor-based getUnsynced()
└── CS-2.20 markSynced observability
```

### SPRINT 4 — Neteja (P3) — 1 dia

```
├── CS-2.21 clearSynced per punt
├── CS-6.41 Strip meta-fields
├── CS-6.42 processedEvents cap → 500
├── CS-1.13 client_id determinístic (si no fet a Sprint 1)
├── CS-1.14 Plugin consulta estat walk
├── CS-3.26 Protecció OEM
└── CS-5.36 Inserció ordenada (binary search)
```

---

## 5. PRINCIPIS D'IMPLEMENTACIÓ

Totes les implementacions han de seguir les Golden Rules del projecte:

| Principi | Aplicació |
|---|---|
| **SRP** | Cada filtre GPS és una funció/mètode separat. `addToBuffer()` coordina, no filtra. |
| **Open/Closed** | Nous filtres s'afegeixen com a funcions, no modificant existents. Chain of Responsibility pattern. |
| **Zero fetch() en components** | Totes les crides HTTP van per `services/`. El plugin natiu fa HTTP directament (Java). |
| **No module-level mutable state** | `ConnectionManager` és singleton d'instància. `walk_state_cache` ja és classe. |
| **No `any` types** | TypeScript strict. `unknown` amb type guards al `WalkEventProcessor`. |
| **No dead code** | Si s'elimina `batchBuffer`, s'eliminen tots els imports i referències. |
| **Testability** | Cada filtre GPS és una funció pura testejable. Kalman Filter amb tests unitaris. |
| **Explicit over implicit** | Constants amb noms clars: `MAX_ACCURACY_M = 50.0`, `MAX_JUMP_M = 80.0`. |

---

## 6. MÈTRIQUES D'ÈXIT GLOBALS

| Mètrica | Actual | Objectiu Post-Roadmap |
|---|---|---|
| Pèrdua de punts en offline llarg | >90% (plugin) | **0%** (IndexedDB) |
| Duplicats a DB | Molts (S1+S2+S7) | **0** (id determinístic + ON CONFLICT) |
| Falsos offline en screen-off | 100% | **0%** (model híbrid) |
| Zigzags per jitter | Sempre | **<5%** (Haversine + Douglas-Peucker) |
| Salts >50m a la ruta | Freqüents | **0** (teleportation detection) |
| Ruta visualment suau | No | **Sí** (Catmull-Rom) |
| WS recupera després de Doze | Mai | **Sempre** (infinite retry) |
| Snapshot mostra ruta completa | No (1 punt) | **Sí** (N punts, MAX=200) |
| Walk reprès després de kill OEM | Mai | **Sempre** (SharedPreferences walkId) |

---

## 7. DEPENDENCIES CRÍTIQUES

```
Sprint 1 (P0)
  ├── CS-2.15-17 (Sync engine) → prerequisit per CS-1.13 (client_id determinístic)
  ├── CS-1.1-5 (Plugin filters) → independent
  └── CS-5.34 (Douglas-Peucker) → independent

Sprint 2 (P1)
  ├── CS-3.22-25 (Presència) → dependent de CS-4.27 (broadcast ordering)
  ├── CS-1.6-10 (Plugin persistence) → dependent de CS-1.1 (IndexedDB bridge)
  └── CS-4.27-30 (Backend ordering) → independent

Sprint 3 (P2)
  ├── CS-1.11 (Kalman) → dependent de CS-1.3-5 (filters bàsics)
  ├── CS-5.37 (4 segments) → dependent de CS-1.7 (is_recovered) + CS-4.32 (low_confidence)
  └── CS-2.18-19 (Sync efficiency) → dependent de CS-2.15-17 (sync fixes)

Sprint 4 (P3)
  └── Tot → independent (neteja)
```

---

## 8. FITXERS AFECTATS (resum)

| Fitxer | Sprints | Canvis principals |
|---|---|---|
| `LocationSyncForegroundService.java` | 1, 2, 3 | IndexedDB bridge, 7 filtres GPS, walkId persistent, Kalman |
| `locationService.ts` | 1, 3 | Unificar client_id, eliminar re-add, batches de 20 |
| `offlineSyncService.ts` | 1, 3 | add() amb id extern, cursor pagination, límit 1000 |
| `connection_manager.py` | 2 | last_http_location_at, 4 estats, update_http_presence() |
| `location_service.py` (backend) | 2, 3 | Ordenar broadcast, ON CONFLICT, validació rang, speed_ms |
| `WalkEventProcessor.ts` | 2, 3 | validateLocation(), binary search insertion, gap detection |
| `MapRenderer.tsx` | 1, 3 | Douglas-Peucker, 4 segments, Catmull-Rom, auto-pan |
| `constants.py` | 2 | MAX_LOCATION_HISTORY → 200 |
| `state.py` | 2 | Cache N punts |
| `useWebSocket.ts` | 2 | Infinite retry |
| `Location` model | 3 | speed_ms, accuracy_m columns |

---

## 9. RISCOS I MITIGACIONS

| Risc | Probabilitat | Mitigació |
|---|---|---|
| IndexedDB bridge Capacitor→Java complex | Mitjana | Implementar primer amb mock, testar al Redmi abans de producció |
| Kalman Filter massa agressiu (over-smoothing) | Mitjana | Paràmetres Q/R ajustables. Testar amb dades reals de walks. |
| OEMs maten Foreground Service malgrat tot | Alta (Xiaomi) | Acceptable: walkId persistent + infinite WS retry minimitzen impacte |
| ON CONFLICT no funciona amb SQLite local | Baixa | SQLite suporta UPSERT des de 3.24.0. Verificar versió. |
| 4 estats de presència confonen l'usuari | Baixa | Disseny UI clar: verd/blau/gris/vermell amb labels en català |

---

## 10. RELACIÓ AMB ACTION-PLAN

| Fase action-plan | Estat | Impacte d'aquesta guia |
|---|---|---|
| E — Capacitor /patient | In progress | **Aquesta guia completa Fase E** amb filtres GPS, persistència, presència |
| 4.4 — SOS User Test | Pending | Independent |
| 4.5 — i18n | Pending | Independent |
| 5 — Beta Deploy | Pending | **Sprint 1-2 haurien d'anar abans de Beta** per estabilitat |

**Recomanació:** Executar Sprint 1 i 2 abans de Beta Deploy. Sprint 3-4 poden anar després.

---

*Document generat per fusió de 4 auditories. Versió 1.0 — 2026-06-04.*  
*Auditories font: `auditoria-pipeline-localitzacio.md`, `auditoria-recuperacio-cobertura.md`, `auditoria-presencia-ws.md`, `auditoria-gps-mapa-qualitat.md`*
