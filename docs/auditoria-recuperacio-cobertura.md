# AUDITORIA — SISTEMA DE RECUPERACIÓ DE COBERTURA

**Data:** 2026-06-04  
**Autor:** Staff Software Engineer (Offline-First Systems, Mobile Sync, Distributed Consistency)  
**Àmbit:** Exclusivament el pipeline de recuperació de cobertura: IndexedDB, sync engine, retry logic, markSynced, client_id, buffer management.

---

## 1. ABAST

Anàlisi del flux complet de recuperació de cobertura:

```
GPS fix
  → saveLocation()
    → IndexedDB.add()
    → batchBuffer (memòria)
      → flushBatch()
        → sendBatch() → HTTP POST /locations/batch
          → markSynced() / catch re-add
  → offlineSyncService.syncQueuedPoints()
    → sendPoint() → HTTP POST /locations
      → markSynced()
  → clearSynced()
```

Objectiu: detectar pèrdua de dades, reenviaments, duplicats, reordenacions, inconsistència temporal, errors d'idempotència, corrupció del buffer. Simulació mental de 5 casos d'ús.

---

## 2. ARQUITECTURA ACTUAL DEL SYNC

```
saveLocation()                    syncQueuedPoints()
     │                                  │
     ▼                                  ▼
IndexedDB (id=uuid1)          IndexedDB (id=uuid1)
     │                              synced=0
     ▼                                  │
batchBuffer (memòria)                   ▼
     │                          sendPoint()
     ▼                              client_id = point.id
flushBatch()                       is_recovered = true
     │                              │
     ▼                              ▼
sendBatch()                      POST /locations (single)
  client_id = crypto.randomUUID()  │
  (DIFERENT del id)                ▼
     │                          markSynced(point.id) ✅
     ▼                          (correcte: point.id == client_id)
markSynced(point.client_id) ❌
(usa client_id ≠ point.id → clau incorrecta → no marca mai)
```

---

## 3. DEFECTES ARQUITECTÒNICS

| ID | Defecte | Fitxer | Línies | Impacte |
|---|---|---|---|---|
| **S1** | `flushBatch()` genera `client_id` DIFERENT de l'`id` de IndexedDB. `markSynced()` rep `point.client_id` (el diferent). IndexedDB té clau `point.id` (l'original). No troba mai el record. | `locationService.ts` | 78-93 | Tots els punts enviats per batch queden `synced=0` a IndexedDB. Mai s'esborren. `getUnsynced()` els retorna infinitament. |
| **S2** | `flushBatch()` en catch re-afegeix punts a IndexedDB amb `crypto.randomUUID()` NOU. El punt ORIGINAL (amb id=uuid1) ja és a IndexedDB des de `saveLocation()`. | `locationService.ts` | 97-111 | Cada fallida de xarxa dobla la mida de la cua. 10 minuts offline = milers de rècords duplicats. |
| **S3** | `markSynced()` llegeix per `store.get(id)`. Si `id` no existeix (per S1), el `if (data)` és fals → no fa res, no llança error. | `offlineSyncService.ts` | 101-109 | Error silenciós. No hi ha logs ni traces. |
| **S4** | IndexedDB sense límit de mida. `getUnsynced()` carrega TOTS els rècords a memòria. | `offlineSyncService.ts` | 71-93 | Memòria exhausta en dispositius low-end amb cues grans. |
| **S5** | `syncQueuedPoints()` envia UN punt per request HTTP. Cap rate limiting. | `locationService.ts` | 136-143 | 500 punts = 500 requests. Lent, ineficient, bateria malgastada. |
| **S6** | Plugin natiu NO utilitza IndexedDB. Buffer `ConcurrentLinkedQueue` en memòria Java, màxim 100 punts. | `LocationSyncForegroundService.java` | 53, 172-176 | Si Android mata el servei, pèrdua total del buffer. Buffer overflow eviteix punts antics. |
| **S7** | `client_id` = `crypto.randomUUID()` → impredictible. Un retry del mateix punt genera un `client_id` diferent. Backend no pot deduplicar per `client_id`. | `locationService.ts` | 83 | Timeout del backend = punt acceptat + resposta perduda = punt reenviat amb nou client_id = duplicat a DB. |
| **S8** | No hi ha mecanisme per saber si una request HTTP va ser processada o no. Timeout = incertesa. | `gpsTransportService.ts` | 23-42 | Impossible distingir entre "no va arribar" i "va arribar però resposta perduda". |
| **S9** | `clearSynced()` al `finally` de `syncQueuedPoints()` requereix que TOT el sync hagi acabat. Si app mor durant sync, records synced=1 no s'esborren → queden permanentment. | `locationService.ts` | 152-154 | Garbage accumulation a IndexedDB. |

---

## 4. SIMULACIÓ DELS 5 CASOS

### CAS 1: 10 minuts offline

**Escenari:** Usuari camina, pèrdua de senyal (túnel, soterrani), 10 minuts sense Internet. Interval GPS ~5-30s.

**Què passa:**

1. GPS captura ~20-120 punts
2. `saveLocation()` → IndexedDB `synced=0` + `batchBuffer`
3. `flushBatch()` als 5s → `sendBatch()` → error → catch (S2)
4. Catch: re-afegeix punts amb NOUS UUIDs
5. Cada 5s es repeteix: buffer buidat, punts re-afegits amb IDs nous
6. 10 minuts = ~120 intents de batch fallits = `120 × batch_size` rècords duplicats

**En recuperar:**

1. `online` event → `syncQueuedPoints()`
2. Carrega TOTS els rècords unsynced a memòria (S4)
3. Envia UN per UN via `POST /locations` (S5)
4. `markSynced(point.id)` aquí funciona (id = client_id correcte)
5. Però: S2 ha creat rècords duplicats amb IDs diferents
6. Backend INSEREIX els duplicats (client_id ≠ mai vist)

| Què va malament | Probabilitat | Severitat |
|---|---|---|
| Duplicats a la DB (S2 + S7) | **Alta** | P0 |
| Memòria alta per `getUnsynced()` massiu (S4) | **Mitjana** | P2 |
| Sync lent (S5, 1 request/punt) | **Alta** | P2 |

**Pèrdua de dades:** 0% (tots els punts eventualment arriben al backend)

**Duplicats:** Molts. Cada punt original pot tenir 2-20 còpies.

---

### CAS 2: 2 hores offline

**Escenari:** Usuari en zona remota sense cobertura.

**Mètriques:**
- Punts GPS originals: ~240-1440 (depèn de l'interval)
- Intents de batch: ~1440 (un cada 5s)
- Rècords IndexedDB després de 2h: **milers** (originals + S2 duplicats)

**Què passa:**

1. IndexedDB pot contenir 3000-10000+ rècords
2. `getUnsynced()` intenta carregar tots a memòria → risc de `OutOfMemory` en Android WebView
3. `syncQueuedPoints()` envia 1 request/punt → 3000+ requests → bateria i dades mòbils massive
4. Si app mor durant sync → alguns punts enviats, altres no → al reiniciar, torna a començar

**Plugin natiu:**

1. Buffer `ConcurrentLinkedQueue` max 100 punts
2. 2h = ~1440 punts GPS, només caben 100 al buffer
3. `buffer.poll()` eviteix els més antics periòdicament
4. Després de 2h: **només sobreviuen els últims ~100 punts (últims ~8 minuts)**
5. **Pèrdua de >90% de la ruta**

| Què va malament | Probabilitat | Severitat |
|---|---|---|
| Plugin eviteix >90% punts (S6) | **Alta** | P0 |
| IndexedDB massiu pot matar el WebView (S4) | **Baixa** | P1 |
| Sync lent consumint bateria (S5) | **Alta** | P2 |

**Pèrdua de dades (plugin):** >90%

**Pèrdua de dades (web mode):** 0% (tots eventualment enviats)

**Duplicats (web mode):** Molts

---

### CAS 3: offline → online → offline

**Escenari:** Alternança ràpida de connectivitat (túnel curt, zona urbana amb mala cobertura).

**Què passa:**

1. Offline: punts acumulats a IndexedDB + duplicats (S2)
2. Online breu (30s): `online` event → `syncQueuedPoints()` comença
3. `sendPoint()` per punt 1 → ✅ → `markSynced(uuid1)` ✅
4. `sendPoint()` per punt 2 → ✅ → `markSynced(uuid2)` ✅
5. `sendPoint()` per punt 3 → torna offline → `break`
6. Punts 1-2 enviats i marcats synced. Punt 3...N no enviats.
7. `finally { clearSynced() }` esborra records synced=1
8. Torna offline: punts 3...N queden a IndexedDB

**Nou online:**
1. `syncQueuedPoints()` → punts amb `synced=0` (3...N)
2. Punts 1-2 NO es reenvien ✅

**Però S2 hi intervé:**
1. `flushBatch()` intenta cada 5s
2. Online breu (30s) → potser 1 batch té èxit
3. `sendBatch()` → backend accepta punts A, B, C
4. Però `markSynced(client_id)` falla (S1) → punts queden `synced=0`
5. `syncQueuedPoints()` reenvia A, B, C com a singles → backend INSEREIX duplicats (client_id different)

| Què va malament | Probabilitat | Severitat |
|---|---|---|
| `flushBatch()` exitós + S1 = punts no marcats = reenviats | **Alta** | P0 |
| `syncQueuedPoints()` correcte en cas pur | **Alta** | ✅ |
| S2 crea duplicats en cada offline | **Alta** | P0 |

---

### CAS 4: App reiniciada durant sincronització

**Escenari:** Usuari tanca l'app mentre `syncQueuedPoints()` s'executa.

**Què passa:**

1. IndexedDB té 50 punts unsynced (originals + S2 duplicats)
2. `syncQueuedPoints()` processa punts 1-10:
   - `sendPoint()` → ✅
   - `markSynced(id)` → ✅
3. App es tanca (crash / swipe away)
4. `finally { clearSynced() }` NO s'ha executat

**En reiniciar:**
1. IndexedDB: punts 1-10 `synced=1`, punts 11-50 `synced=0`, punts duplicats `synced=0`
2. `batchBuffer` = [] (en memòria, perdut)
3. Plugin buffer = perdut (en memòria Java)
4. `AppStateProvider` hidrata des de localStorage: `deviceToken`, `activeWalkId`
5. `useOfflineRecovery` → `syncQueuedPoints()`
6. `getUnsynced()` retorna `synced=0` → punts 11-50 + duplicats
7. Punts 1-10 NO es reenvien ✅

**Plugin natiu en reinici:**
1. Servei `START_STICKY` reinicia amb `intent=null`
2. `onStartCommand`: `if (intent == null) return START_STICKY;`
3. **Plugin NO reprèn tracking** → walk actiu però sense GPS
4. Enviament de dades aturat fins que usuari interactui

| Què va malament | Probabilitat | Severitat |
|---|---|---|
| Plugin perd walkId → no envia GPS | **Alta** | P0 |
| `clearSynced()` no executat → garbage (S9) | **Alta** | P2 |
| Punts 1-10 no es dupliquen (ids determinístics a syncQueuedPoints) | ✅ | - |

---

### CAS 5: Backend disponible parcialment

**Escenari:** Backend Render free-tier amb cold starts, 503, timeouts.

**flushBatch() — escenari crític:**

1. Batch de 5 punts enviat
2. Backend processa i COMMITA els 5 punts a DB (INSERT amb client_id=uuidA)
3. Resposta HTTP perduda (timeout del cold start, >60s)
4. `gpsTransportService.sendBatch()` → fetch timeout → throw
5. `flushBatch()` catch (S2): re-afegeix 5 punts amb NOUS UUIDs (uuidB1..uuidB5)
6. `syncQueuedPoints()` envia uuidB1..uuidB5 → backend INSEREIX (client_id uuidB ≠ uuidA)
7. **MATEIXOS PUNTS, DUES VEGADES A DB**

**syncQueuedPoints() — menys risc:**

1. `sendPoint()` → backend commit → timeout → excepció atrapada per `gpsTransportService.sendPoint()` catch → retorna `false`
2. `syncQueuedPoints()` veu `false` → `break`
3. Punt NO marcat synced → es reenviarà al proper intent
4. **Però el punt JA és a DB** (backend va commit abans del timeout)
5. Al reenviar: `client_id = point.id` (determinístic) → backend 409 Conflict → `sendPoint()` retorna `true` → marcat synced ✅

**Problema:** El backend actual fa `SELECT * FROM locations WHERE client_id = ?` (2 queries: SELECT + INSERT). No hi ha `ON CONFLICT DO NOTHING`. El backend pot trigar el doble → més timeouts.

| Què va malament | Probabilitat | Severitat |
|---|---|---|
| Timeout + S2 + S7 = **duplicats massius** | **Alta** (Render cold start és lent) | P0 |
| `syncQueuedPoints()` eventualment consistent | **Alta** (gràcies a id determinístic) | ✅ |
| Backend 2 queries per punt (SELECT + INSERT) = lent | **Alta** | P2 |

---

## 5. TAULA RESUM DE TROBALLES

| ID | Tipus | Classificació | Problema | Impacte | Probabilitat | Esforç |
|---|---|---|---|---|---|---|
| **S1** | Idempotència | **P0** | `markSynced(client_id)` amb clau diferent de l'ID de IndexedDB | Punts mai marcats synced → reenviats infinitament | **Alta** | Baix |
| **S2** | Duplicació | **P0** | `flushBatch()` catch re-afegeix punts amb nou UUID | Cua IndexedDB creix exponencialment | **Alta** | Baix |
| **S6** | Persistència | **P0** | Plugin natiu buffer en memòria, max 100 punts, sense IndexedDB | Pèrdua >90% punts en offline llarg, pèrdua total en restart | **Alta** | Mitjà |
| **S7** | Idempotència | **P0** | `client_id` = randomUUID() → no determinístic | Retry del mateix punt = client_id diferent → backend no pot deduplicar | **Alta** | Baix |
| **S8** | Consistència | **P1** | No hi ha manera de distingir "no va arribar" de "va arribar però resposta perduda" | Timeout del backend = duplicats inevitables | **Alta** | Mitjà |
| **S5** | Eficiència | **P2** | `syncQueuedPoints()` 1 request/punt | Sync de 500 punts = 500 requests HTTP | **Alta** | Mitjà |
| **S4** | Memòria | **P2** | `getUnsynced()` carrega TOTS els rècords a memòria | Risc OutOfMemory amb cues grans | **Mitjana** | Mitjà |
| **S3** | Observabilitat | **P2** | `markSynced()` falla silenciosament (no troba clau) | Errors invisibles, impossible debuggar | **Alta** | Baix |
| **S9** | Garbage | **P3** | `clearSynced()` al `finally` no s'executa si app mor durant sync | Records synced=1 s'acumulen a IndexedDB | **Mitjana** | Baix |

---

## 6. PROPOSTA D'ARQUITECTURA OFFLINE-FIRST ROBUSTA

### 6.1 Principis

| Principi | Justificació |
|---|---|
| **Write-Ahead Log (WAL)** | Tot punt va primer a IndexedDB. Mai s'envia res que no estigui persistit. |
| **ID determinístic** | `SHA256(timestamp + lat + lng + walk_id)`. Mateix punt = mateix ID sempre. Fins i tot entre reinicis. |
| **Client_id ≡ key de IndexedDB** | Un sol UUID per punt. Usat com a clau primària de la cua I com a `client_id` del backend. Mai generem dos IDs pel mateix punt. |
| **Batch des de la cua** | El batch es forma llegint de IndexedDB, no d'un buffer en memòria. |
| **Cursor-based processing** | Processar en blocs de 20 punts. No tot de cop. |
| **Retry amb backoff** | 1s → 2s → 4s → 8s → 30s (max). No reintentar immediatament. |
| **Límit de cua** | 1000 punts màxim. Purgar els més antics (FIFO). |
| **INSERT ON CONFLICT DO NOTHING** | Backend: una sola query, atòmica. No SELECT + INSERT. |

### 6.2 Pipeline proposat

```
GPS fix
  │
  ▼
1. Generar client_id determinístic
   client_id = SHA256(timestamp + lat + lng + walk_id)
  │
  ▼
2. IndexedDB.add({ id: client_id, ... })  ← sempre el mateix ID
   Si ja existeix (mateix punt GPS): fer put = overwrite (no duplicar)
  │
  ▼
3. Formar batch des de IndexedDB
   Llegir primers 20 punts unsynced, en ordre cronològic
   Enviar batch amb client_id = id de cada punt
  │
  ▼
4. Backend: INSERT INTO locations (...) VALUES (...)
   ON CONFLICT (client_id) DO NOTHING
   (Atòmic, 1 query, idempotent)
  │
  ▼
5. Si 2xx/409: IndexedDB.delete(id) per cada punt del batch
   Si error: retry amb backoff (no re-afegir, ja és a la cua)
  │
  ▼
6. Cursor: processar següents 20 punts
   Fins que la cua estigui buida o el dispositiu torni offline
```

### 6.3 Diferències amb l'actual

| Aspecte | Actual | Proposat | Per què |
|---|---|---|---|
| `client_id` | `crypto.randomUUID()` | `SHA256(timestamp + lat + lng + walk_id)` | Determinista → mateix punt = mateix ID sempre |
| Queue key | `crypto.randomUUID()` (= `point.id`) | = `client_id` (un sol UUID) | Elimina S1 (clau incorrecta) i S2 (duplicats) |
| `markSynced()` | `store.get(id)` + `store.put()` | `store.delete(id)` | Més senzill, atòmic, sense risc de clau incorrecta |
| Batch error recovery | Re-afegeix amb nou UUID | No re-afegeix (ja és a la cua) | Elimina S2 (duplicació massiva) |
| Batch source | buffer en memòria (`batchBuffer`) | IndexedDB directament | No cal buffer en memòria, resistent a reinicis |
| Sync mode | 1 request per punt | Batch de 20 | Menys requests, menys bateria, menys temps |
| Límit de cua | Infinit | 1000 punts | Evita memòria exhausta |
| Plugin buffer | `ConcurrentLinkedQueue` en memòria | IndexedDB via Capacitor bridge | Persistència real, resistent a kills |
| Backend dedup | `SELECT * FROM locations WHERE client_id = ?` | `INSERT ... ON CONFLICT DO NOTHING` | Atòmic, 1 query, més ràpid, sense race conditions |
| Retry | Immediat (cada 5s) | Backoff exponencial (1-30s) | Menys pressió al backend, menys bateria |

### 6.4 Impacte als fitxers

| Fitxer | Canvi principal | Esforç |
|---|---|---|
| `offlineSyncService.ts` | `add()` accepta id extern. `getUnsynced()` amb cursor/paginació. `markSynced()` → `delete()`. Límit 1000. | Mitjà |
| `locationService.ts` | `flushBatch()` forma batch des de IndexedDB. Eliminar `batchBuffer`. Eliminar catch re-add. `syncQueuedPoints()` envia batches de 20. | Mitjà |
| `gpsTransportService.ts` | `sendBatch()` pot acceptar arrays de 20 punts. | Baix |
| `LocationSyncForegroundService.java` | Buffer via Capacitor bridge a IndexedDB, no `ConcurrentLinkedQueue` en memòria. Hook de connectivity listener. | Mitjà-Alt |
| `backend/app/services/location_service.py` | `save_batch()`: canviar a `INSERT ... ON CONFLICT (client_id) DO NOTHING` en lloc de SELECT + INSERT. | Baix |
| `backend/app/db/models/location.py` | Assegurar `client_id` unique constraint. | Baix |

---

## 7. MATRIU DE CASOS VS TROBALLES

| Cas | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---|---|---|---|---|---|---|---|---|---|
| **CAS 1** — 10min offline | ✅ | 🔴 | ✅ | ⚠️ | 🔴 | - | - | - | - |
| **CAS 2** — 2h offline | ✅ | 🔴 | ✅ | 🔴 | 🔴 | 🔴 | - | - | - |
| **CAS 3** — offline→online→offline | 🔴 | 🔴 | ✅ | ⚠️ | - | - | - | - | - |
| **CAS 4** — app reiniciada durant sync | - | - | - | - | - | 🔴 | - | - | ⚠️ |
| **CAS 5** — backend parcial | 🔴 | 🔴 | ✅ | - | - | - | 🔴 | 🔴 | - |

🔴 = impacte directe   ⚠️ = impacte indirecte   ✅ = afectat però no crític   - = no aplica

---

## 8. METRIQUES D'EXIT POST-FIX

| Mètrica | Actual | Objectiu |
|---|---|---|
| Duplicats a DB per timeout | Molts (S1+S2+S7) | 0 (id determinístic + ON CONFLICT) |
| Punts perduts en offline llarg (plugin) | >90% (S6) | 0% (IndexedDB) |
| Rècords IndexedDB després de 10min offline | Milers (S2) | = punts reals (sense duplicats) |
| Requests per sync de 100 punts | 100 (S5) | 5 (batches de 20) |
| `markSynced()` falla silenciosament | Sempre (S1) | Mai (id unificat) |
| Backend queries per punt | SELECT + INSERT (2) | INSERT ON CONFLICT (1) |

---

*Document generat per auditoria de recuperació de cobertura PathGuard. Versió 1.0 — 2026-06-04.*
