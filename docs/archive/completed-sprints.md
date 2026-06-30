<!-- ARXIVAT 2026-06-30: document històric. Veure docs/INDEX.md per la documentació activa. -->

# COMPLETED SPRINTS — PathGuard

**Data:** 2026-06-11
**Propòsit:** Històric de tot el que s'ha implementat. Per referència. El ROADMAP actiu només conté el pendent.

---

## SPRINT 1 — ESTABILITZAR EL PIPELINE (P0) ✅ COMPLETAT

**Branca:** `feat/sprint1-pipeline-estabilitzacio`
**Objectiu:** Zero pèrdua de dades, zero duplicats, ruta visual neta.

### 1.1 — Filtres GPS al Plugin Natiu

**Fitxer:** `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncForegroundService.java`

**Pas 1.1a: Augmentar min distance i afegir constants**

```java
private static final float MIN_DISTANCE_M = 25.0f;
private static final float MAX_JUMP_M = 80.0f;
private static final float MAX_ACCURACY_M = 50.0f;
private static final float MAX_SPEED_MS = 5.0f;
private static final long MAX_FIX_AGE_MS = 10_000;
```

**Pas 1.1b: Afegir `lastAcceptedPoint` i modificar `addToBuffer()`**

Gates: accuracy, fix age, mock, anti-jitter, teleportation, speed.

**Pas 1.1c: Afegir mètode Haversine**

**Pas 1.1d: `setMinUpdateDistanceMeters(5)` → `15`**

**Pas 1.1e: SRP — Extreure cada filtre a mètode separat**

### 1.2 — Ordenar Buffer Abans de Flush

`ConcurrentLinkedQueue` → `PriorityQueue` amb `Comparator.comparingLong(p -> p.timestamp)`.

### 1.3 — Sync Engine: Eliminar Bugs Crítics

- `client_id` unificat = key de IndexedDB
- `markSynced` + `clearSynced` eliminats → `delete` directe
- `client_id` determinístic SHA-256
- `saveLocation()` usa id determinístic

### 1.4 — Backend: INSERT ON CONFLICT DO NOTHING

Helper `upsert_location()` amb dialecte condicional (PostgreSQL / SQLite).

### 1.5 — Frontend: Douglas-Peucker al Mapa

Funció `douglasPeucker(points, epsilon=3)` aplicada a `segmentLocations()`.

### 1.6 — Verificació Sprint 1

Backend 152/152, Frontend 108/108, Manual: walk real al Redmi sense zigzags.

---

## SPRINT 2 — PRESÈNCIA I ROBUSTESA (P1) ✅ COMPLETAT

**Branca:** `feat/sprint2-presencia-robustesa`
**Objectiu:** Zero falsos offline, snapshot complet, ordenació correcta.

### 2.1 — Model de Presència Híbrid (Backend)

`ConnectionManager` amb `last_http_location_at`, `update_http_presence()`, `is_patient_online` amb 4 estats.

### 2.2 — 4 Estats de Presència (Backend → Frontend)

`patient_status` amb `"online" | "gps_online" | "limbo" | "offline"`. `STATUS_CONFIG` amb colors i texts amigables.

### 2.3 — Persistir `walkId` al Plugin

SharedPreferences per `walkId`, `deviceToken`, `serverUrl`. `START_STICKY` amb recuperació post-kill.

### 2.4 — Plugin: Marcar `is_recovered`

`lastFlushFailed` flag. Points acumulats durant offline → `isRecovered = true`.

### 2.5 — Backend: Ordenar Abans de Broadcast

`broadcast_events.sort(key=lambda e: e["timestamp"])` a `save_batch()`.

### 2.6 — Backend: Cache Snapshot Complet

`WalkStateCache` amb `deque(maxlen=200)` per història. `MAX_LOCATION_HISTORY = 200`.

### 2.7 — WalkEventProcessor: Validació de Punts

`validateLocation()` amb `MAX_SPEED_MS = 5`, `MAX_JUMP_M = 100`.

### 2.7b — Tolerància Cronològica (Safety Net)

Tolerància 30s al chronological check per evitar falsos rebutjos per desordre temporal.

### 2.8 — Validació Rang Coordenades (Backend)

`_validate_coordinates(lat, lng)` a `location_service.py`.

### 2.9 — WebSocket Infinite Retry

`MAX_FAST_ATTEMPTS = 5`, després backoff 30s fixe. Reset a 0 en reconnectar.

### 2.10 — Verificació Sprint 2

Backend 152/152, Frontend 108/108, tests manuals de screen-off i kill app.

---

## SPRINT 3 — ITEMS COMPLETATS

Dins del Sprint 3 (Plugin Robust + Qualitat Avançada), els següentsítems estan **completats**:

### 3.0 — Plugin SRP Refactor ✅

`LocationSyncForegroundService.java` (410 línies, 10 responsabilitats) refactoritzat a:
- `LocationAcquirer.java` — Captura GPS i filtratge (6 gates)
- `LocationBuffer.java` — Cua en memòria + persistència
- `LocationHttpClient.java` — HTTP batch sending
- `BufferStore.java` — SharedPreferences persistència
- `LocationPoint.java` — Model de dades
- Servei principal: ~80 línies, 1 responsabilitat

### 3.8 — Buffer Persistence al Plugin ✅

BufferStore persisteix buffer + `lastFlushFailed` a SharedPreferences. Buffer carregat al constructor. Punts carregats → `isRecovered = true`.

### 3.9 — Interval Alignment Phase F ✅

Intervals: `LOCATION_INTERVAL_MS = 15000`, `LOCATION_FASTEST_INTERVAL_MS = 5000`. Flush on-demand (2s) + idle timer 30s. Scheduler fixe de 5s eliminat.

---

## FIXES — CORRECCIONS POST-AUDITORIA

### F.1 — Columna `client_id`: VARCHAR(50) → VARCHAR(64) ✅ FET

**Data:** 2026-06-04
**Problema:** Sprint 1 va introduir `client_id` determinístic SHA-256 (64 chars), columna era `VARCHAR(50)`. Totes les ubicacions fallaven amb `StringDataRightTruncation`.
**Solució:** `String(50)` → `String(64)`, script de migració, `ALTER TABLE` a Supabase.

### F.2 — Mapa no visible a /caregiver ✅ FET

**Data:** 2026-06-04
**Problema:** Conseqüència directa de F.1 — sense broadcast d'ubicacions, el mapa mai rebia dades.
**Solució:** Corregit F.1 → ubicacions s'insereixen → WebSocket broadcast → mapa es mostra.

### F.3 — STATUS_CONFIG: colors i texts amigables ✅ FET

**Data:** 2026-06-05
**Canvis:** `offline`: `bg-danger` → `bg-warning`. Labels amb prefix "Passeig actiu - ".

### F.4 — Propagació is_recovered (cadena plugin→frontend) ✅ FET

**Data:** 2026-06-05
**Fitxers:** `walk_service.py` (2), `location_service.py` (1), `WalkEventProcessor.ts` (4)
**Problema:** `is_recovered` es perd en 6 punts entre el plugin i el mapa.
**Solució:** 12 insercions, 5 supressions en 3 fitxers.

### F.5 — Persistir lastFlushFailed a SharedPreferences ✅ FET

**Data:** 2026-06-05
**Fitxer:** `LocationSyncForegroundService.java`
**Problema:** `lastFlushFailed` era in-memory. En reiniciar servei, es perdia.
**Solució:** Persistir a SharedPreferences amb `persistFlushFailed()`.

---

## SPRINT 4 — NETEJA FINAL (P3) ✅ COMPLETAT

### 4.1 — `clearSynced` per Punt Individual
Resolt a Sprint 1.3b.

### 4.2 — Strip Meta-Fields del Backend
`event_publisher.py` copia només camps intencionals.

### 4.3 — `processedEvents` Cap → 500

### 4.4 — Plugin Consulta Estat Walk
Si backend retorna 404 (walk no actiu), aturar tracking.

### 4.5 — Verificació Final

---

## MILLORES ADDICIONALS (POST-SPRINT)

### Histeresi (RECOVERY_STREAK_THRESHOLD=3)

`LocationBuffer.java`: `recoveryStreak` counter amb streak=3 per evitar toggle ràpid de `lastFlushFailed`.

### MIN_DISTANCE_M 25 → 15

`LocationAcquirer.java`: reduït a 15m per evitar que el gate anti-jitter descarti massa punts en walking lent.

### Tag v2.6.0-beta.3 (2026-06-10)

Inclou: histeresi, MIN_DISTANCE_M=15, tot Sprint 3 SRP + buffer persistència + intervals Phase F.

---

## MÈTRIQUES D'ÈXIT

| Mètrica | Abans | Després |
|---|---|---|
| Pèrdua de punts en offline | >90% | **0%** |
| Duplicats a DB | Molts | **0** |
| Falsos offline screen-off | 100% | **0%** |
| Zigzags per jitter | Sempre | **<5%** |
| Salts >50m | Freqüents | **0** |
| WS recupera post-Doze | Mai | **Sempre** |
| Walk reprès post-kill OEM | Mai | **Sempre** |
| Tests backend | 152/152 | 152/152 |
| Tests frontend | 108/108 | 108/108 |

---

## PRINCIPIS SOLID APLICATS

| Principi | Com s'aplica |
|---|---|
| **S**RP | Cada filtre GPS = un mètode. `addToBuffer()` coordina, no filtra. |
| **O**CP | Nous filtres s'afegeixen com a mètodes. Chain of Responsibility. |
| **L**SP | `ConnectionManager` substitueix `PresenceTracker` sense trencar res. |
| **I**SP | `offlineSyncService`: interfície mínima (`add`, `getUnsynced`, `delete`). |
| **D**IP | `locationService` depèn d'abstraccions, no d'implementacions concretes. |

| Golden Rule | Compliment |
|---|---|
| Zero `fetch()` en components | Totes les crides HTTP a `services/` |
| No `any` types | `unknown` + type guards a `WalkEventProcessor` |
| No module-level mutable state | `ConnectionManager` és instància, `walk_state_cache` és classe |
| No dead code | `batchBuffer` eliminat → tots imports/referències eliminats |
| Testability | Douglas-Peucker, Haversine, KalmanFilter: funcions pures |

---

*Document actualitzat el 2026-06-11. Conté tot el que està fet fins a v2.6.0-beta.3.*
