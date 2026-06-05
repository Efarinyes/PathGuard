# ROADMAP-TESTS — PathGuard Test Matrix & Safety Gates

**Data:** 2026-06-05
**Autor:** Principal Engineer
**Propòsit:** Especificació completa de tests per cada pas del ROADMAP.md, gates de seguretat per merge, i checklist de mantenibilitat.
**Llegeix-lo juntament amb:** ROADMAP.md, CONTEXT.md

---

## PRINCIPIS GENERALS

1. **Zero regressió:** Tots els tests existents han de passar abans i després de cada canvi.
2. **Testeja el contracte, no la implementació:** Tests d'integració sobre els endpoints/classes públiques. Tests unitaris sobre funcions pures.
3. **Cada filtre GPS és una funció pura:** Testejable sense mock de Android/plugin.
4. **Cada canvi al ROADMAP té un test associat** (unitari o d'integració).
5. **Els tests han de ser deterministes:** Sense dependència de timing real — usar `fakeTimers` / `asyncio` control·lat.

---

## 1. SAFETY BRANCH GATES

### 1.1 — Abans de Crear Branca

```bash
# 1. Partir de develop net
git checkout develop && git pull origin develop
git checkout -b feat/<nom-sprint>

# 2. Baseline: tot passa
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v
cd frontend && npm run build --webpack && npm test
```

### 1.2 — Pre-Merge Checklist (Per Cada PR a develop)

- [ ] `pytest` backend: 152/152 (10 WS timing failures permesos, cap més)
- [ ] `npm run build --webpack`: exit 0
- [ ] `npm test` frontend: 108/108
- [ ] Cap `console.log` en codi de producció (grep abans de commit)
- [ ] Cap `any` type nou (TypeScript strict check)
- [ ] Cap `fetch()` directe en components (només via services/)
- [ ] No hi ha fitxers nous sense test
- [ ] No hi ha imports orfes (dead code check)
- [ ] `git status` mostra NOMÉS els fitxers previstos
- [ ] `git diff --stat` mostra només els canvis planificats

### 1.3 — Merge Freeze Rules

| Situació | Acció |
|---|---|
| Test falla (no preexistent) | ❌ PR bloquejat. No mergejar fins que el test passi. |
| Build falla | ❌ PR bloquejat. |
| 1 fita P0 incompleta | ❌ No mergejar. Sprint ha de completar totes les P0. |
| P1 incompleta | ⚠️ Avaluar si bloqueja la següent fita. Decisió del Principal Engineer. |
| P2/P3 incompleta | ✅ Permès si no bloqueja el següent sprint. Crear issue de seguiment. |

### 1.4 — Rollback Steps (Si un Merge Trenca develop)

```bash
# 1. Identificar el commit
git log --oneline develop -10

# 2. Revertir (no reset, per preservar història)
git checkout develop
git revert -m 1 <commit-hash>
git push origin develop

# 3. Crear issue amb el hash revertit i el motiu
# 4. Tornar a la branca original, corregir, i re-PR
```

---

## 2. TEST MATRIX — SPRINT 1 (P0: Pipeline Estabilització)

### 2.1 — Filtres GPS al Plugin Natiu (1.1)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T1.1a**: `passesAccuracyGate()` descarta accuracy > 50m | Unitari | `KalmanFilterTest.java` / `LocationSyncServiceTest.java` | `passesAccuracyGate(accuracy=60f)` → `false` |
| **T1.1b**: `passesAccuracyGate()` accepta accuracy ≤ 50m | Unitari | mateix | `passesAccuracyGate(accuracy=50f)` → `true` |
| **T1.1c**: `passesFixAgeGate()` descarta fix > 10s | Unitari | mateix | fix de 15s → `false` |
| **T1.1d**: `passesAntiJitterGate()` descarta < 25m | Unitari | mateix | distància 10m → `false` |
| **T1.1e**: `passesAntiJitterGate()` accepta ≥ 25m | Unitari | mateix | distància 25m → `true` |
| **T1.1f**: `passesTeleportGate()` descarta > 80m en < 5s | Unitari | mateix | distància 100m, elapsed 3s → `false` |
| **T1.1g**: `passesSpeedGate()` descarta speed > 5 m/s | Unitari | mateix | distance 50m, elapsed 5s (10 m/s) → `false` |
| **T1.1h**: `passesMockGate()` descarta mock locations | Unitari | mateix | `isFromMockProvider()=true` → `false` |
| **T1.1i**: `haversine()` retorna 0 per mateix punt | Unitari | mateix | `haversine(41,2,41,2)` → `0.0` |
| **T1.1j**: `haversine()` retorna ~111km per 1° lat | Unitari | mateix | `haversine(41,2,42,2)` → `~111195` (error < 1%) |
| **T1.1k**: `addToBuffer()` amb tots els gates passant | Integració | mateix | punt vàlid → buffer.size() = 1 |
| **T1.1l**: `addToBuffer()` amb accuracy gate fallant | Integració | mateix | punt no vàlid → buffer.size() = 0 |

> **Nota:** Aquests tests van en un nou fitxer Java al plugin. Execució manual amb `./gradlew test` al module android. Si Gradlew no existeix, es fan com a tests d'integració des de `locationService.test.ts` simulant el comportament dels gates (T1.1i–T1.1l alternatius a TypeScript).

### 2.2 — Order Buffer Before Flush (1.2)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T1.2a**: PriorityQueue ordena per timestamp asc | Unitari | `LocationSyncServiceTest.java` | 3 punts desordenats → sortida cronològica |
| **T1.2b**: `flushBuffer()` respecta ordre PriorityQueue | Integració | mateix | flush envia punts en ordre de timestamp |

### 2.3 — Sync Engine: Eliminar Bugs Crítics (1.3)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T1.3a**: `client_id` = `point.id` (unificat) | Unitari | `locationService.test.ts` | `flushBatch()` envia `client_id` = `point.id` |
| **T1.3b**: No re-add en catch (S2 fix) | Unitari | `locationService.test.ts` | Simular error HTTP → IndexedDB no rep duplicats |
| **T1.3c**: `client_id` determinístic SHA-256 | Unitari | `lib/locationId.test.ts` (NOU) | Mateix input → mateix hash. Input diferent → hash diferent. |
| **T1.3d**: `saveLocation()` usa id determinístic | Integració | `locationService.test.ts` | `saveLocation(p)` → IndexedDB conté id = SHA-256(...) |
| **T1.3e**: `deleteLocation()` substitueix `markSynced()` | Integració | `offlineSyncService.test.ts` | `deleteLocation(id)` → registre no existeix |
| **T1.3f**: `getUnsynced()` retorna només `synced=0` | Integració | `offlineSyncService.test.ts` | `markSynced` eliminat — `getUnsynced()` usa IDBKeyRange.only(0) |

**Nou fitxer de test necessari:**
- `frontend/lib/locationId.test.ts`

### 2.4 — Backend: INSERT ON CONFLICT (1.4)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T1.4a**: INSERT ON CONFLICT idempotent | Integració | `test_location_idempotency.py` (MODIFICAR) | Mateix `client_id` → 1 fila, no error |
| **T1.4b**: `upsert_location()` funciona amb SQLite | Unitari | NOU: `test_location_service.py` | Helper `upsert_location()` amb SQLite → INSERT OR IGNORE |
| **T1.4c**: `upsert_location()` funciona amb PostgreSQL | Unitari | mateix | Mock de `postgresql` al URL → `pg_insert` + `on_conflict_do_nothing` |

### 2.5 — Douglas-Peucker al Mapa (1.5)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T1.5a**: `douglasPeucker()` amb 2 punts | Unitari | `MapRenderer.test.tsx` | 2 punts → retorna els mateixos |
| **T1.5b**: `douglasPeucker()` amb 3 punts en línia | Unitari | mateix | 3 punts col·lineals → 2 punts (punt mig eliminat) |
| **T1.5c**: `douglasPeucker()` amb 3 punts no col·lineals | Unitari | mateix | 3 punts en angle → 3 punts (punt mig important) |
| **T1.5d**: `perpendicularDistance()` amb punt sobre línia | Unitari | mateix | distància 0 |
| **T1.5e**: `segmentLocations()` aplica Douglas-Peucker | Unitari | mateix | Segment de 10 punts → simplificat (\(\epsilon\)=3) |
| **T1.5f**: `segmentLocations()` separa per `is_recovered` | Unitari | mateix | 2 segments: 1 live + 1 recovered |
| **T1.5g**: `segmentLocations()` filtra NaN | Unitari | mateix | Punts amb NaN → omitits |

### 2.6 — Verificació Final Sprint 1

```bash
# Backend
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v
# Esperat: 152/152 (+ nous tests d'idempotència)

# Frontend
cd frontend && npm run build --webpack && npm test
# Esperat: build OK, 108/108 + nous tests

# Manual (Redmi):
# 1. Walk 10 min amb pantalla encesa → ruta sense zigzags ni salts
# 2. Verificar a DB: SELECT client_id, COUNT(*) FROM locations GROUP BY client_id HAVING COUNT(*) > 1 → 0 rows
# 3. Verificar a DB: SELECT COUNT(*) FROM locations WHERE id NOT IN (...) → zero duplicats
```

---

## 3. TEST MATRIX — SPRINT 2 (P1: Presència i Robustesa)

### 3.1 — Model de Presència Híbrid (2.1)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T2.1a**: `is_patient_online()` amb WS viu → `online` | Unitari | `test_connection_manager.py` (NOU/MOD) | WS connectat → retorna `"online"` |
| **T2.1b**: `is_patient_online()` sense WS, HTTP < 60s → `gps_online` | Unitari | mateix | No WS, `last_http_location_at` = 30s → `"gps_online"` |
| **T2.1c**: `is_patient_online()` sense WS, HTTP 60-300s → `limbo` | Unitari | mateix | No WS, `last_http_location_at` = 120s → `"limbo"` |
| **T2.1d**: `is_patient_online()` sense res → `offline` | Unitari | mateix | No WS, no HTTP → `"offline"` |
| **T2.1e**: `update_http_presence()` actualitza timestamp | Unitari | mateix | Cridar → `last_http_location_at[group_id]` actualitzat |
| **T2.1f**: `save_batch()` crida `update_http_presence()` | Integració | `test_location_batching.py` | POST locations → `connection_manager.last_http_location_at` actualitzat |

### 3.2 — 4 Estats de Presència al Frontend (2.2)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T2.2a**: `PatientStatusEvent` tipus afegit | Unitari | `wsEventTypes.test.ts` (NOU) | `parseEvent({type:"patient_status",status:"gps_online"})` → tipus correcte |
| **T2.2b**: `useLivePatientLocation` processa `patient_status` | Unitari | `useLivePatientLocation.test.ts` | Event → `state.presenceStatus` = `"gps_online"` |
| **T2.2c**: STATUS_CONFIG té 4 entrades | Unitari | `PatientStatusCard.test.tsx` (NOU) | `STATUS_CONFIG.keys` = `["online","gps_online","limbo","offline"]` |

### 3.3 — Persistir walkId al Plugin (2.3)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T2.3a**: `walkId` guardat a SharedPreferences | Unitari | `LocationSyncServiceTest.java` | START → `prefs.getInt(walkId)` = valor enviat |
| **T2.3b**: walkId recuperat en `onStartCommand(null)` | Unitari | mateix | `onStartCommand(intent=null)` → `currentWalkId` = valor prefs |
| **T2.3c**: STOP elimina walkId de prefs | Unitari | mateix | STOP → `prefs.getInt(walkId, 0)` = 0 |

### 3.4 — is_recovered al Plugin (2.4)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T2.4a**: `lastFlushFailed=false` → `isRecovered=false` | Unitari | `LocationSyncServiceTest.java` | Flush OK → punt no marcat recovered |
| **T2.4b**: `lastFlushFailed=true` → `isRecovered=true` | Unitari | mateix | Flush error → punt marcat recovered |
| **T2.4c**: Alternança flush OK/error | Unitari | mateix | Error→OK→Error → marcatge correcte |

### 3.5 — Ordenar Abans de Broadcast (2.5)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T2.5a**: `save_batch()` ordena events per timestamp | Unitari | `test_location_batching.py` (MOD) | Punts desordenats → broadcast events en ordre cronològic |
| **T2.5b**: Timestamps iguals → ordre d'arribada | Unitari | mateix | 2 punts same timestamp → mateix ordre relatiu |

### 3.6 — Cache Snapshot Complet (2.6)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T2.6a**: `WalkStateCache.update()` afegeix a history | Unitari | `test_state.py` (NOU) | 5 updates → `history.len` = 5 |
| **T2.6b**: `WalkStateCache` max 200 entries | Unitari | mateix | 250 updates → `history.len` = 200 |
| **T2.6c**: `WalkStateCache.get()` retorna latest + history | Unitari | mateix | `get(walk_id)` → `{latest:{...}, history:[...]}` |
| **T2.6d**: `WalkStateCache.get()` walk_id inexistent → None | Unitari | mateix | `get(999)` → `None` |

### 3.7 — WalkEventProcessor Validació (2.7)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T2.7a**: `validateLocation()` sense lastPoint → true | Unitari | `WalkEventProcessor.test.ts` | `validateLocation(p, null)` → `true` |
| **T2.7b**: `validateLocation()` speed > 5 m/s → false | Unitari | mateix | distance 100m, dt 10s → `false` |
| **T2.7c**: `validateLocation()` jump > 100m → false | Unitari | mateix | distance 150m → `false` |
| **T2.7d**: `validateLocation()` dt ≤ 0 → false | Unitari | mateix | timestamp igual → `false` |
| **T2.7e**: `validateLocation()` punt vàlid → true | Unitari | mateix | distance 10m, dt 30s → `true` |

### 3.8 — Validació Coordenades (2.8)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T2.8a**: `_validate_coordinates()` lat fora de rang | Unitari | `test_location_service.py` (MOD) | `_validate_coordinates(91, 0)` → `ValueError` |
| **T2.8b**: `_validate_coordinates()` lng fora de rang | Unitari | mateix | `_validate_coordinates(0, 181)` → `ValueError` |
| **T2.8c**: `_validate_coordinates()` vàlid | Unitari | mateix | `_validate_coordinates(41.5, 2.5)` → no error |
| **T2.8d**: `save_batch()` rejecta coordenades invàlides | Integració | `test_post_locations.py` (MOD) | POST amb lat=999 → 422 |

### 3.9 — WebSocket Infinite Retry (2.9)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T2.9a**: Tancament normal (code 1000) no reconecta | Unitari | `useWebSocket.test.ts` | `ws.onclose({code:1000})` → no setTimeout |
| **T2.9b**: Primer intent ràpid (1s) | Unitari | mateix | attempt 1 → delay = 1.000ms |
| **T2.9c**: Backoff exponencial fins a 16s | Unitari | mateix | attempt 4 → delay = 8.000ms; attempt 5 → 16.000ms |
| **T2.9d**: Intent 6+ → 30s fix | Unitari | mateix | attempt 6 → delay = 30.000ms |
| **T2.9e**: Reset a 0 en reconnect | Unitari | mateix | `ws.onopen()` després de 3 intents → attempt = 0 |

### 3.10 — Verificació Final Sprint 2

```bash
# Backend
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v
# Esperat: 152/152 + nous tests

# Frontend
cd frontend && npm run build --webpack && npm test
# Esperat: build OK, 108/108 + nous tests

# Manual (Redmi):
# 1. Iniciar walk, apagar pantalla 30 min → caregiver veu "GPS actiu" (blau)
# 2. Encendre pantalla → WS reconnecta → "online" (verd)
# 3. Walk 1h: snapshot mostra ruta completa (no truncada)
# 4. Kill app → reobrir → walk reprès (walkId recuperat)
```

---

## 4. TEST MATRIX — SPRINT 3 (P2: Plugin Robust + Qualitat Avançada)

### 4.0 — Plugin SRP Refactor (3.0) ⭐ NOU

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.0a**: LocationAcquirer retorna punt filtrat | Unitari | `LocationAcquirerTest.java` (NOU) | Punt passa tots els gates → consumer rep punt |
| **T3.0b**: LocationAcquirer rebutja conegut | Unitari | mateix | Accuracy gate falla → consumer no rep res |
| **T3.0c**: LocationBuffer.add() incrementa size | Unitari | `LocationBufferTest.java` (NOU) | 3 punts → size = 3 |
| **T3.0d**: LocationBuffer.drainAll() buida buffer | Unitari | mateix | 3 punts → drain → size = 0 |
| **T3.0e**: BufferStore.save() + load() roundtrip | Unitari | `BufferStoreTest.java` (NOU) | 5 punts save → load retorna 5 punts |
| **T3.0f**: BufferStore.getLastFlushFailed() roundtrip | Unitari | mateix | set true → get retorna true |
| **T3.0g**: LocationHttpClient.sendBatch() POST correcte | Unitari | `LocationHttpClientTest.java` (NOU) | Mock server → POST amb cos JSON correcte |
| **T3.0h**: LocationHttpClient.sendBatch() error → false | Unitari | mateix | Server 500 → retorna false |
| **T3.0i**: LocationService orquestra 5 classes | Integració | `LocationSyncServiceTest.java` | START → acquirer actiu → buffer no buit → flush → HTTP |

### 4.1 — Kalman Filter (3.1)

Sense canvis respecte al ROADMAP-TESTS v1.0. `KalmanFilter` s'integra a `LocationAcquirer` en lloc de `LocationSyncForegroundService`.

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.1a**: `filter()` primera mesura = output | Unitari | `KalmanFilterTest.java` (NOU) | `filter(41.5)` → `41.5` (p=1 → k=1) |
| **T3.1b**: `filter()` suavitzat progressiu | Unitari | mateix | 3 mesures consecutives → convergència |
| **T3.1c**: `reset()` reinicia estat | Unitari | mateix | Després de `reset(42.0)` → `filter(41.0)` = 42.0 (no suavitzat) |
| **T3.1d**: `filter()` amb measurement sorollós | Unitari | mateix | Valor estable amb soroll aleatori ±0.1 |

### 4.2 — Columnes speed_ms i accuracy_m (3.2)

Sense canvis respecte al ROADMAP-TESTS v1.0.

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.2a**: speed_ms calculat correctament | Integració | `test_location_batching.py` (MOD) | POST 2 punts → DB té `speed_ms` calculat |
| **T3.2b**: accuracy_m guardat del payload | Integració | mateix | POST amb `accuracy_m` → DB conté el valor |
| **T3.2c**: low_confidence marcat si jump > 100m | Integració | mateix | 2 punts amb distància 150m → `low_confidence=True` |

### 4.3 — 4 Segments Visuals (3.3)

**Depèn de:** F.4 (sense `is_recovered` propagat, el segment `recovered` mai es veu).

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.3a**: `classifyConfidence()` live < 60s | Unitari | `MapRenderer.test.tsx` | `is_recovered=false`, age 30s → `"live"` |
| **T3.3b**: `classifyConfidence()` recovered | Unitari | mateix | `is_recovered=true` → `"recovered"` |
| **T3.3c**: `classifyConfidence()` low_confidence | Unitari | mateix | `low_confidence=true` → `"low_confidence"` |
| **T3.3d**: `classifyConfidence()` stale > 60s | Unitari | mateix | age 90s → `"stale"` |
| **T3.3e**: `segmentLocations()` genera 4 segments segons confiança | Unitari | mateix | Punts amb confiança alternant → 4 segments |
| **T3.3f**: SEGMENT_STYLES té 4 entrades | Unitari | mateix | 4 claus al dict |

### 4.4 — Gap Detection (3.4)

Sense canvis respecte al ROADMAP-TESTS v1.0.

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.4a**: `detectGap()` dt > 120s → true | Unitari | `WalkEventProcessor.test.ts` | dt 150s → `true` |
| **T3.4b**: `detectGap()` dt ≤ 120s → false | Unitari | mateix | dt 60s → `false` |
| **T3.4c**: Gap marker inserit a history | Unitari | mateix | gap detectat → `_isGap=true` al darrer punt |

### 4.5 — Auto-Pan Intel·ligent (3.5)

Sense canvis respecte al ROADMAP-TESTS v1.0.

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.5a**: No pan si punt és dins viewport | Unitari | `MapRenderer.test.tsx` | Mock bounds amb punt central → `flyTo` no cridat |
| **T3.5b**: Pan si punt és fora viewport | Unitari | mateix | Punt fora dels bounds → `flyTo` cridat |
| **T3.5c**: Pan amb padding del 10% | Unitari | mateix | Punt dins del 10% del límit → no pan |

### 4.6 — Batches de 20 (3.6)

Sense canvis respecte al ROADMAP-TESTS v1.0.

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.6a**: `syncQueuedPoints()` envia batches de 20 | Unitari | `locationService.test.ts` | 45 unsynced → 3 crides: 20+20+5 |
| **T3.6b**: Error al batch atura procés | Unitari | mateix | batch 2 falla → batch 3 no s'envia |

### 4.7 — Cursor-Based getUnsynced (3.7)

Sense canvis respecte al ROADMAP-TESTS v1.0.

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.7a**: `getUnsynced()` amb cursor | Integració | `offlineSyncService.test.ts` | 5 unsynced → retorna 5 items |
| **T3.7b**: `getUnsynced()` límit 200 | Integració | mateix | 300 items → retorna 200 |
| **T3.7c**: `getUnsynced()` només synced=0 | Integració | mateix | `synced=0` items → retornats. `synced=1` items → no retornats |

### 4.8 — Buffer Persistence al Plugin (3.8) ⭐ NOU

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.8a**: Buffer carregat de persistència → isRecovered=true | Unitari | `BufferStoreTest.java` (NOU) | 3 punts persistits → carregats amb isRecovered=true |
| **T3.8b**: lastFlushFailed persistit entre cicles | Unitari | mateix | set true → save → load → true |
| **T3.8c**: Kill test: buffer no perdut | Manual (Redmi) | — | Kill app → reobre → buffer conté punts anteriors |
| **T3.8d**: clear() elimina buffer i lastFlushFailed | Unitari | `BufferStoreTest.java` | clear → load retorna buit, lastFlushFailed = false |

### 4.9 — Interval Alignment Phase F (3.9) ⭐ NOU

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.9a**: LocationRequest interval 15s (no 5s) | Unitari | `LocationAcquirerTest.java` (NOU) | `request.intervalMillis` = 15000 |
| **T3.9b**: Flush on-demand (no timer fixe 5s) | Unitari | mateix | addToBuffer → scheduleFlush cridat en 2s |
| **T3.9c**: Idle timer flush cada 30s sense punts | Unitari | mateix | sense punts 30s → flushBuffer cridat |
| **T3.9d**: No flush duplicat si ja hi ha un programat | Unitari | mateix | 3 addToBuffer ràpids → 1 flush programat, no 3 |

### 4.10 — Heading Filter (3.10) ⭐ NOU

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T3.10a**: passesHeadingGate() amb bearing vàlid | Unitari | `LocationAcquirerTest.java` (NOU) | Direcció consistent → true |
| **T3.10b**: passesHeadingGate() amb gir > 90° | Unitari | mateix | Direcció oposada → false (soft: marca low_confidence) |

### 4.11 — Verificació Final Sprint 3

```bash
# Backend
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v
cd frontend && npm run build --webpack && npm test

# Manual (Redmi):
# - Ruta visualment suau (Douglas-Peucker)
# - 4 nivells de confiança visibles al mapa (live, recovered, low_confidence, stale)
# - Buffer persistent: kill app, punts no perduts
# - Flush on-demand (no cada 5s) — comprovar amb logs
# - GPS interval 15s (no 5s) — comprovar amb logs
# - speed_ms i accuracy_m calculats a DB
# - Walk reprès post-kill (walkId + buffer persistits a SharedPreferences)
# - Auto-pan només quan el punt surt del viewport
```

---

## 4.12 — FIX F.4: Propagació is_recovered ⭐ NOU

**Abans de Sprint 3.** Tests per verificar que `is_recovered` flueix per tota la cadena.

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T_F4a**: `walk_service.get_walk_locations_by_ids()` include `is_recovered` | Unitari | `test_walk_service.py` (MOD) | Ruta → dict conté clau `is_recovered` |
| **T_F4b**: `location_service.walk_state_cache.update()` rep `is_recovered` | Unitari | `test_state.py` (MOD) | `update()` cridat amb `is_recovered` → cache conté valor |
| **T_F4c**: WalkEventProcessor.classifyEvent() propaga `is_recovered` | Unitari | `WalkEventProcessor.test.ts` | WS event amb `is_recovered=true` → tipus `LocationUpdateEvent` amb camp |
| **T_F4d**: WalkEventProcessor.reduceState SNAPSHOT history propaga | Unitari | mateix | SNAPSHOT amb locations → cada location té `is_recovered` |
| **T_F4e**: WalkEventProcessor.reduceState SNAPSHOT latest propaga | Unitari | mateix | SNAPSHOT amb latest_point → `is_recovered` present |
| **T_F4f**: WalkEventProcessor.reduceState BATCH propaga | Unitari | mateix | BATCH amb locations → cada location té `is_recovered` |
| **T_F4g**: Segment recovered visible al mapa (integració) | Manual (local) | — | Iniciar walk, simular offline/online → polyline recovered (groc dashed) |

---

## 5. TEST MATRIX — SPRINT 4 (P3: Neteja)

| Test | Tipus | Fitxer | Verifica |
|---|---|---|---|
| **T4.1a**: Strip meta-fields del broadcast | Unitari | `test_event_publisher.py` (NOU) | `{"_event_name":"x","lat":1}` → broadcast `{"lat":1}` |
| **T4.1b**: `processedEvents` cap 500 | Unitari | `WalkEventProcessor.test.ts` | 600 events → `events.length` = 500 |
| **T4.1c**: Plugin 404 → stopTracking | Unitari | `LocationSyncServiceTest.java` | HTTP 404 → `stopTracking()` cridat |
| **T4.1d**: `clearSynced()` per punt individual | Unitari | `offlineSyncService.test.ts` | Ja verificat a T1.3e |

---

## 6. MANTENIBILITAT CHECKLIST

Per CADA fitxer modificat o creat, verificar:

### 6.1 — Naming & Structure
- [ ] Nom de funció/classe descriu UNA responsabilitat (SRP)
- [ ] Constants en majúscules amb `_` (ex: `MAX_ACCURACY_M`)
- [ ] Funcions exportables i testejables (no internals a menys que sigui estrictament necessari)
- [ ] Tipus explícits a TypeScript (zero `any`, zero `as any`)

### 6.2 — Dead Code Check
- [ ] `grep -r "oldFunctionName\|oldClassName"` — cap referència romanent
- [ ] Si s'elimina un mètode, eliminar les seves crides i imports
- [ ] Si es renombra un fitxer, actualitzar TOTS els imports

### 6.3 — SOLID Compliance
- [ ] **S**: Cada funció fa exactament UNA cosa
- [ ] **O**: Les noves funcionalitats no modifiquen codi existent (excepte refactors planificats)
- [ ] **L**: Les substitucions de classes no trenquen contractes
- [ ] **I**: Les interfícies són mínimes
- [ ] **D**: Les dependències són abstraccions, no concrecions

### 6.4 — File Size Limits

| Tipus | Límit | Acció si se supera |
|---|---|---|
| TypeScript component | 200 lines | Extreure sub-components |
| TypeScript hook | 150 lines | Extreure lògica a lib/ o services/ |
| Python service | 300 lines | Extreure mòduls auxiliars |
| Java class | 400 lines | Extreure classes filles |
| Test file | 200 lines | Dividir en múltiples fitxers per tema |

---

## 7. CROSS-CUTTING CONCERNS

### 7.1 — Tests de Plugin Android

Els tests del plugin Java requereixen entorn Android. Estratègia:

1. **Unit tests** (`test/` sota `LocationSyncForegroundService.java`): Si Gradle ho permet, crear test amb JUnit + Mockito.
2. **Fallback TypeScript**: Cada filtre GPS (accuracy, anti-jitter, teleport, speed, fix age, mock) es pot implementar com a funció puresa en TypeScript a `lib/gpsFilters.ts` i testejar amb Vitest. Això proporciona cobertura immediata sense entorn Android.
3. **Verificació manual al Redmi**: Imprescindible per a cada sprint.

**Decisió:** Per Sprint 1.1, implementar els 6 filtres com a funcions pures TypeScript a `lib/gpsFilters.ts` i testejar amb Vitest. El plugin Java crida la lògica equivalent (DRY no possible per barrera d'idioma, però testejable via script de verificació manual).

### 7.2 — Tests de Base de Dades (Backend)

- Tots els tests SQLite (`sqlite:///:memory:`)
- `INSERT ON CONFLICT` depèn de PostgreSQL vs SQLite
- Cobertura dual: (1) Unit test del helper `upsert_location()` amb SQLite, (2) Test d'integració amb behaviour esperat
- Per PostgreSQL real: només en staging, no en CI (sense accés a Supabase des de CI)

### 7.3 — Tests de WebSocket

- Usar `pytest-asyncio` amb `AsyncClient` de FastAPI
- `WebSocket.connect()` amb `pytest-timeout` per evitar tests penjats
- Les 10 failures preexistents (timing) es mantenen com a known issue

### 7.4 — Fake Timers

Tots els tests que involucren intervals/timers han d'usar `vi.useFakeTimers()` (Vitest) o `time_machine` / `freezegun` (pytest). Mai dependre de timing real.

---

## 8. RESUM DE NOUS FITXES DE TEST

| Fitxer | Sprint | Contingut |
|---|---|---|
| `frontend/lib/locationId.test.ts` | S1 | SHA-256 determinístic |
| `frontend/lib/gpsFilters.test.ts` | S1 | 6 GPS filter gates (fallback Java) |
| `backend/tests/integration/test_location_service.py` | S1 | `upsert_location()` helper |
| `backend/tests/integration/test_connection_manager.py` | S2 | Presència híbrida, 4 estats |
| `backend/tests/integration/test_state.py` | S2+S3+F4 | WalkStateCache + is_recovered propagation |
| `frontend/lib/wsEventTypes.test.ts` | S2 | PatientStatusEvent parse |
| `frontend/components/CaregiverDashboard/PatientStatusCard.test.tsx` | S2 | STATUS_CONFIG |
| `frontend/lib/WalkEventProcessor.test.ts` | F4+S3 | is_recovered propagation + gap detection |
| `backend/tests/integration/test_event_publisher.py` | S4 | Strip meta-fields |
| `LocationSyncForegroundServiceTest.java` | S1+S2+S3 | Plugin unit tests (si Gradle) |
| `LocationAcquirerTest.java` | S3 NOU | GPS gates + Kalman + heading |
| `LocationBufferTest.java` | S3 NOU | Buffer memòria + persistència |
| `BufferStoreTest.java` | S3 NOU | SharedPreferences roundtrip |
| `LocationHttpClientTest.java` | S3 NOU | HTTP client sendBatch |
| `KalmanFilterTest.java` | S3 NOU | Kalman filter matemàtic |

---

*ROADMAP-TESTS — Versió 2.0 — 2026-06-05*
*Document viu. Actualitzar després de cada sprint implementat o quan s'identifiquin nous casos de test.*
