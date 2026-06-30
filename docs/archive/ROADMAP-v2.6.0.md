<!-- ARXIVAT 2026-06-30: document històric. Veure docs/INDEX.md per la documentació activa. -->

# ROADMAP — PATHGUARD POST-AUDITORIA

**Data:** 2026-06-05
**Autor:** Principal Engineer
**Font:** 4 auditories + CONTEXT.md + action-plan.md
**Propòsit:** Pla d'implementació pas a pas. Juntament amb CONTEXT.md, és la biblia del projecte.

> **Estat:** Sprint 1 i Sprint 2 completats. Fixos aplicats (F.1–F.5). Pròxim: Sprint 3 (plugin robust + qualitat avançada).

---

## PRE-REQUISITS

Abans de començar qualsevol sprint:

```bash
# 1. Crear branca des de develop
git checkout develop
git pull origin develop
git checkout -b feat/<nom-sprint>

# 2. Baseline: verificar que tot passa
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v
cd frontend && npm run build --webpack && npm test

# 3. Llegir CONTEXT.md (Golden Rules, arquitectura, convencions)
```

---

## SPRINT 1 — ESTABILITZAR EL PIPELINE (P0) ✅ COMPLETAT

**Branca:** `feat/sprint1-pipeline-estabilitzacio`
**Durada:** 5-7 dies
**Objectiu:** Zero pèrdua de dades, zero duplicats, ruta visual neta.

### 1.1 — Filtres GPS al Plugin Natiu

**Fitxer:** `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncForegroundService.java`

**Pas 1.1a: Augmentar min distance i afegir constants**

Afegeix les constants al principi de la classe:

```java
// Constants de filtratge GPS (Sprint 1)
private static final float MIN_DISTANCE_M = 25.0f;      // Anti-jitter: descartar si < 25m
private static final float MAX_JUMP_M = 80.0f;          // Teleportació: descartar si > 80m en <5s
private static final float MAX_ACCURACY_M = 50.0f;      // Accuracy gate
private static final float MAX_SPEED_MS = 5.0f;         // 18 km/h màxim a peu
private static final long MAX_FIX_AGE_MS = 10_000;      // 10 segons
```

**Pas 1.1b: Afegir `lastAcceptedPoint` i modificar `addToBuffer()`**

```java
private LocationPoint lastAcceptedPoint = null;

private void addToBuffer(Location location) {
    // Gate 1: Accuracy
    if (!location.hasAccuracy() || location.getAccuracy() > MAX_ACCURACY_M) return;

    // Gate 2: Fix age (stale detection)
    if (System.currentTimeMillis() - location.getTime() > MAX_FIX_AGE_MS) return;

    // Gate 3: Mock locations
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
        if (location.isFromMockProvider()) return;
    }

    double lat = location.getLatitude();
    double lng = location.getLongitude();
    long now = location.getTime();  // GPS UTC epoch ms (més fiable que System.currentTimeMillis())

    if (lastAcceptedPoint != null) {
        double distance = haversine(
            lastAcceptedPoint.latitude, lastAcceptedPoint.longitude,
            lat, lng
        );

        // Gate 4: Anti-jitter (massa a prop)
        if (distance < MIN_DISTANCE_M) return;

        // Gate 5: Teleportation detection
        long elapsedSec = (now - lastAcceptedPoint.timestampMs) / 1000;
        if (distance > MAX_JUMP_M && elapsedSec < 5) return;

        // Gate 6: Speed validation
        double speedMs = distance / Math.max(elapsedSec, 1);
        if (speedMs > MAX_SPEED_MS) return;
    }

    LocationPoint point = new LocationPoint(
        lat, lng, now, generateClientId(now, lat, lng)
    );
    lastAcceptedPoint = point;
    buffer.add(point);
}
```

**Pas 1.1c: Afegir mètode Haversine**

```java
private static double haversine(double lat1, double lng1, double lat2, double lng2) {
    final double R = 6371000.0; // metres
    double dLat = Math.toRadians(lat2 - lat1);
    double dLng = Math.toRadians(lng2 - lng1);
    double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
        * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
```

**Pas 1.1d: Canviar `setMinUpdateDistanceMeters(5)` a `15`**

A `startTracking()`, al `LocationRequest` builder:
```java
locationRequest.setMinUpdateDistanceMeters(15); // era 5
```

**Pas 1.1e: SRP — Extreure cada filtre a mètode separat**

Cada filtre ha de ser un mètode independent per testabilitat:

```java
private boolean passesAccuracyGate(Location loc) { ... }
private boolean passesFixAgeGate(Location loc) { ... }
private boolean passesMockGate(Location loc) { ... }
private boolean passesAntiJitterGate(LocationPoint candidate) { ... }
private boolean passesTeleportGate(LocationPoint candidate, long elapsed) { ... }
private boolean passesSpeedGate(double distance, long elapsed) { ... }
```

`addToBuffer()` crida la cadena de filtres. Cap filtre té més d'una responsabilitat.

### 1.2 — Ordenar Buffer Abans de Flush

**Fitxer:** `LocationSyncForegroundService.java`

**Pas 1.2a: Canviar `ConcurrentLinkedQueue` per `PriorityQueue`**

```java
// Abans:
private final Queue<LocationPoint> buffer = new ConcurrentLinkedQueue<>();

// Després:
private final PriorityQueue<LocationPoint> buffer = new PriorityQueue<>(
    Comparator.comparingLong(p -> p.timestamp)
);
```

**Pas 1.2b: `flushBuffer()` ja no necessita ordenar — la cua ja ho fa**

No cal canviar `flushBuffer()`. La `PriorityQueue` garanteix ordre cronològic.

### 1.3 — Sync Engine: Eliminar Bugs Crítics

**Fitxer:** `frontend/services/locationService.ts`

**Pas 1.3a: Unificar `client_id` = key de IndexedDB**

```typescript
// Abans: dos UUIDs diferents (S1)
private async flushBatch(): Promise<void> {
  const clientId = crypto.randomUUID(); // DIFERENT del point.id
  // ...
}

// Després: reutilitzar point.id com a client_id
private async flushBatch(): Promise<void> {
  const batch = [...this.batchBuffer];
  this.batchBuffer = [];

  const payload = batch.map((point) => ({
    ...point,
    client_id: point.id, // MATEIX que la key de IndexedDB
  }));

  try {
    await gpsTransportService.sendBatch(payload, this.deviceToken);
    for (const point of batch) {
      await this.offlineSync.deleteLocation(point.id); // delete, no markSynced
    }
  } catch {
    // No re-add. Punts ja són a IndexedDB des de saveLocation().
  }
}
```

**Pas 1.3b: Eliminar `markSynced` + `clearSynced`. Fer `delete` directe.**

```typescript
// offlineSyncService.ts — eliminar markSynced() i clearSynced()
// Nou mètode:
async deleteLocation(id: string): Promise<void> {
  const db = await this.getDb();
  const tx = db.transaction(this.storeName, 'readwrite');
  await tx.store.delete(id);
  await tx.done;
}
```

**Pas 1.3c: `client_id` determinístic amb SHA-256**

```typescript
// Nou fitxer: frontend/lib/locationId.ts
export async function generateLocationId(
  timestamp: number,
  lat: number,
  lng: number,
  walkId: number
): Promise<string> {
  const input = `${timestamp}:${lat.toFixed(6)}:${lng.toFixed(6)}:${walkId}`;
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

**Pas 1.3d: `saveLocation()` usa id determinístic**

```typescript
async saveLocation(payload: LocationPayload): Promise<void> {
  const id = await generateLocationId(
    new Date(payload.timestamp).getTime(),
    payload.latitude,
    payload.longitude,
    payload.walk_id
  );

  const queued: QueuedLocation = {
    id,
    walk_id: payload.walk_id,
    latitude: payload.latitude,
    longitude: payload.longitude,
    timestamp: payload.timestamp,
    synced: 0,
    is_recovered: false,
  };

  await this.offlineSync.add(queued);
  this.batchBuffer.push(queued);

  if (this.batchBuffer.length >= BATCH_SIZE_THRESHOLD) {
    await this.flushBatch();
  }
}
```

### 1.4 — Backend: INSERT ON CONFLICT DO NOTHING

**Fitxer:** `backend/app/services/location_service.py`

**Pas 1.4a: Canviar SELECT + INSERT per INSERT ON CONFLICT**

```python
# Abans (S8): SELECT + INSERT (2 queries)
existing = db.query(Location).filter(Location.client_id == point.client_id).first()
if existing:
    continue
db.add(new_location)

# Després: INSERT ON CONFLICT (1 query atòmica)
from sqlalchemy.dialects.postgresql import insert as pg_insert

stmt = pg_insert(Location).values(
    walk_id=walk_id,
    latitude=point.latitude,
    longitude=point.longitude,
    timestamp=point.timestamp,
    client_id=point.client_id,
    is_recovered=point.is_recovered or False,
).on_conflict_do_nothing(index_elements=['client_id'])

db.execute(stmt)
```

**Nota:** `on_conflict_do_nothing` requereix PostgreSQL. Per SQLite local dev, usar `INSERT OR IGNORE` amb dialecte condicional. Crear helper:

```python
def upsert_location(db, values):
    if 'postgresql' in str(db.bind.url):
        stmt = pg_insert(Location).values(**values)
        stmt = stmt.on_conflict_do_nothing(index_elements=['client_id'])
        db.execute(stmt)
    else:
        # SQLite fallback
        stmt = text("""
            INSERT OR IGNORE INTO locations
            (walk_id, latitude, longitude, timestamp, client_id, is_recovered)
            VALUES (:walk_id, :latitude, :longitude, :timestamp, :client_id, :is_recovered)
        """)
        db.execute(stmt, values)
```

### 1.5 — Frontend: Douglas-Peucker al Mapa

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`

**Pas 1.5a: Afegir funció Douglas-Peucker pura (testejable)**

```typescript
// Nova funció exportable (test unitari independent)
export function douglasPeucker(
  points: [number, number][],
  epsilon: number
): [number, number][] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

function perpendicularDistance(
  point: [number, number],
  start: [number, number],
  end: [number, number]
): number {
  // Distància perpendicular d'un punt a la línia start→end
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const dLat = point[0] - start[0];
    const dLng = point[1] - start[1];
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }
  const t = Math.max(0, Math.min(1,
    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSq
  ));
  const projLat = start[0] + t * dx;
  const projLng = start[1] + t * dy;
  const dLat = point[0] - projLat;
  const dLng = point[1] - projLng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
```

**Pas 1.5b: Aplicar a `segmentLocations()`**

```typescript
function segmentLocations(locations: LocationPayload[]): LocationSegment[] {
  // ... filtrar NaN ...

  const segments: LocationSegment[] = [];
  let current: LocationSegment | null = null;

  for (const loc of locations) {
    if (!current || current.isRecovered !== (loc.is_recovered ?? false)) {
      current = { coordinates: [], isRecovered: loc.is_recovered ?? false };
      segments.push(current);
    }
    current.coordinates.push([loc.latitude, loc.longitude]);
  }

  // NOU: Aplicar Douglas-Peucker a cada segment
  return segments.map((seg) => ({
    ...seg,
    coordinates: douglasPeucker(seg.coordinates, 3), // ε = 3 metres
  }));
}
```

### 1.6 — Verificació Sprint 1

```bash
# Backend
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v
# Esperat: 152/152 (10 WS timing preexistents)

# Frontend
cd frontend && npm run build --webpack && npm test
# Esperat: build OK, 108/108 tests

# Manual: Walk real al Redmi
# - Ruta sense zigzags visibles
# - Zero salts de >50m
# - Zero duplicats a DB (SELECT COUNT(*), client_id FROM locations GROUP BY client_id HAVING COUNT(*) > 1)
```

---

## SPRINT 2 — PRESÈNCIA I ROBUSTESA (P1) ✅ COMPLETAT

**Branca:** `feat/sprint2-presencia-robustesa`
**Durada:** 5-7 dies
**Objectiu:** Zero falsos offline, snapshot complet, ordenació correcta.

### 2.1 — Model de Presència Híbrid (Backend)

**Fitxer:** `backend/app/api/websocket/connection_manager.py`

**Pas 2.1a: Afegir `last_http_location_at`**

```python
class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, WebSocket] = {}
        self._patient_status_store: dict[str, bool] = {}
        self.last_http_location_at: dict[str, datetime] = {}  # NOU: group_id → datetime
```

**Pas 2.1b: Nou mètode `update_http_presence`**

```python
def update_http_presence(self, group_id: str) -> None:
    """Cridat des de location_service.save_batch() quan arriben dades HTTP."""
    self.last_http_location_at[group_id] = datetime.utcnow()
```

**Pas 2.1c: Modificar `is_patient_online` per retornar estat**

```python
def is_patient_online(self, group_id: str) -> str:
    """Retorna 'online' | 'gps_online' | 'limbo' | 'offline'"""
    ws_alive = group_id in self.active_connections
    last_http = self.last_http_location_at.get(group_id)
    now = datetime.utcnow()

    if ws_alive:
        return "online"

    if last_http:
        diff = (now - last_http).total_seconds()
        if diff < 60:
            return "gps_online"
        if diff < 300:
            return "limbo"

    return "offline"
```

**SRP note:** `is_patient_online` ara té una sola responsabilitat: determinar l'estat. No canvia res més.

**Pas 2.1d: Integrar amb `location_service.py`**

```python
# backend/app/services/location_service.py
# A save_batch(), després de commit:
from app.api.websocket.connection_manager import connection_manager

await connection_manager.update_http_presence(str(patient.group_id))
```

### 2.2 — 4 Estats de Presència (Backend → Frontend)

**Fitxer:** `backend/app/api/websocket/connection_manager.py`

**Pas 2.2a: Emetre `patient_status` amb 4 estats**

```python
async def broadcast_patient_status(self, group_id: str) -> None:
    status = self.is_patient_online(group_id)
    # Broadcast a tots els caregivers del group
    await self.broadcast_to_group(group_id, {
        "type": "patient_status",
        "status": status,  # "online" | "gps_online" | "limbo" | "offline"
        "group_id": group_id,
    })
```

**Fitxer:** `frontend/lib/wsEventTypes.ts`

**Pas 2.2b: Afegir tipus `patient_status`**

```typescript
export type PresenceStatus = "online" | "gps_online" | "limbo" | "offline";

export interface PatientStatusEvent {
  type: "patient_status";
  status: PresenceStatus;
  group_id: string;
}
```

**Fitxer:** `frontend/hooks/useLivePatientLocation.ts`

**Pas 2.2c: Processar `patient_status` al caregiver**

```typescript
// Dins el switch de classifyEvent:
case "patient_status":
  return {
    ...state,
    presenceStatus: action.status,
  };
```

**Fitxer:** `frontend/components/CaregiverDashboard/PatientStatusCard.tsx` (o component equivalent)

**Pas 2.2d: Indicador visual de 4 colors** ⏳ PENDENT — revisar texts i colors (veure FIXES)

```typescript
const STATUS_CONFIG: Record<PresenceStatus, { color: string; label: string }> = {
  online:      { color: "bg-success", label: "En línia" },
  gps_online:  { color: "bg-primary", label: "GPS actiu" },
  limbo:       { color: "bg-warning", label: "Incert" },
  offline:     { color: "bg-danger", label: "Fora de línia" },
};

// OBJECTIU: texts més amigables i sense vermell (bg-danger)
// online:   bg-success → "Passeig actiu - En línia"
// gps_online: bg-primary → "Passeig actiu - GPS actiu"
// limbo:    bg-warning → "Passeig actiu - Connectant..."
// offline:  bg-warning (NO bg-danger) → "Passeig actiu - Sense cobertura"
```

### 2.3 — Persistir `walkId` al Plugin

**Fitxer:** `LocationSyncForegroundService.java`

**Pas 2.3a: SharedPreferences per `walkId`**

```java
private SharedPreferences prefs;
private static final String PREF_WALK_ID = "active_walk_id";
private static final String PREF_DEVICE_TOKEN = "device_token";
private static final String PREF_SERVER_URL = "server_url";

@Override
public void onCreate() {
    super.onCreate();
    prefs = getSharedPreferences("pathguard_tracking", MODE_PRIVATE);
    // Recuperar walkId si el servei reinicia (START_STICKY amb intent=null)
    currentWalkId = prefs.getInt(PREF_WALK_ID, 0);
}

@Override
public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null) {
        String action = intent.getAction();
        if ("START".equals(action)) {
            int walkId = intent.getIntExtra("walkId", 0);
            String deviceToken = intent.getStringExtra("deviceToken");
            String serverUrl = intent.getStringExtra("serverUrl");
            prefs.edit()
                .putInt(PREF_WALK_ID, walkId)
                .putString(PREF_DEVICE_TOKEN, deviceToken)
                .putString(PREF_SERVER_URL, serverUrl)
                .apply();
            startTracking(walkId, deviceToken, serverUrl);
        } else if ("STOP".equals(action)) {
            prefs.edit().remove(PREF_WALK_ID).apply();
            stopTracking();
        }
    } else {
        // Reinici per START_STICKY sense intent. Recuperar de SharedPreferences.
        int walkId = prefs.getInt(PREF_WALK_ID, 0);
        String deviceToken = prefs.getString(PREF_DEVICE_TOKEN, null);
        String serverUrl = prefs.getString(PREF_SERVER_URL, null);
        if (walkId > 0 && deviceToken != null && serverUrl != null) {
            startTracking(walkId, deviceToken, serverUrl);
        }
    }
    return START_STICKY;
}
```

### 2.4 — Plugin: Marcar `is_recovered`

**Fitxer:** `LocationSyncForegroundService.java`

**Pas 2.4a: Trackejar estat de connexió**

```java
private boolean lastFlushFailed = false;

// A flushBuffer():
try {
    // HTTP POST
    boolean success = sendBatch(batch);
    if (success) {
        lastFlushFailed = false;
    }
} catch (Exception e) {
    lastFlushFailed = true;
    // Requeue amb backoff, no immediatament
}
```

**Pas 2.4b: Points acumulats durant offline → `is_recovered=true`**

```java
// A addToBuffer() o flushBuffer():
LocationPoint point = new LocationPoint(lat, lng, timestamp, clientId);
point.isRecovered = lastFlushFailed; // Si l'últim flush va fallar, estem en recovery
buffer.add(point);
```

### 2.5 — Backend: Ordenar Abans de Broadcast

**Fitxer:** `backend/app/services/location_service.py`

**Pas 2.5a: `save_batch()` — ordenar `broadcast_events` per timestamp**

```python
def save_batch(db, walk_id, batch_id, points, patient):
    # ... validar walk ...

    broadcast_events = []

    for point in points:
        # idempotència amb upsert
        upsert_location(db, values)
        broadcast_events.append({
            "latitude": point.latitude,
            "longitude": point.longitude,
            "timestamp": point.timestamp.isoformat(),
            "walk_id": walk_id,
            "is_recovered": point.is_recovered or False,
        })

    db.commit()

    # NOU: Ordenar per timestamp abans de broadcast
    broadcast_events.sort(key=lambda e: e["timestamp"])

    # Broadcast individual (en ordre)
    for event in broadcast_events:
        event_publisher.publish("location_update", event)

    return {"status": "synced", "inserted": len(broadcast_events), "batch_id": batch_id}
```

### 2.6 — Backend: Cache Snapshot Complet

**Fitxer:** `backend/app/db/state.py`

**Pas 2.6a: Guardar N últims punts al cache (no només l'últim)**

```python
class WalkStateCache:
    def __init__(self) -> None:
        self._cache: dict[int, dict] = {}

    def update(self, walk_id: int, location_data: dict) -> None:
        if walk_id not in self._cache:
            self._cache[walk_id] = {
                "latest": None,
                "history": deque(maxlen=MAX_LOCATION_HISTORY),  # 200
            }
        entry = self._cache[walk_id]
        entry["latest"] = location_data
        entry["history"].append(location_data)

    def get(self, walk_id: int) -> dict | None:
        entry = self._cache.get(walk_id)
        if not entry:
            return None
        return {
            "latest": entry["latest"],
            "history": list(entry["history"]),  # Retorna tots els punts al cache
        }
```

**Pas 2.6b: `MAX_LOCATION_HISTORY` → 200**

**Fitxer:** `backend/app/core/constants.py`

```python
MAX_LOCATION_HISTORY = 200  # era 50
```

### 2.7 — WalkEventProcessor: Validació de Punts

**Fitxer:** `frontend/lib/WalkEventProcessor.ts`

**Pas 2.7a: Afegir `validateLocation` abans d'append**

```typescript
private static readonly MAX_SPEED_MS = 5; // 18 km/h
private static readonly MAX_JUMP_M = 100;  // 100 metres

private validateLocation(
  point: LocationPayload,
  lastPoint: LocationPayload | null
): boolean {
  if (!lastPoint) return true;

  const distance = getDistanceHaversine(
    { lat: lastPoint.latitude, lng: lastPoint.longitude },
    { lat: point.latitude, lng: point.longitude }
  );

  const dt = (
    new Date(point.timestamp).getTime() -
    new Date(lastPoint.timestamp).getTime()
  ) / 1000;

  if (dt <= 0) return false; // timestamps iguals o enrera
  if (dt > 0 && distance / dt > this.MAX_SPEED_MS) return false;
  if (distance > this.MAX_JUMP_M) return false; // teleportació

  return true;
}
```

### 2.7b — WalkEventProcessor: Tolerància Cronològica (Safety Net)

**Fitxer:** `frontend/lib/WalkEventProcessor.ts`

**Context:** La troballa F14 de l'auditoria descriu com el chronological check a `shouldProcessMessage()` pot rebutjar punts vàlids si arriben fora d'ordre. El ROADMAP original plantejava inserció ordenada com a solució definitiva (Sprint 3.4). Com a safety net immediat, s'ha afegit una tolerància de 30s:

```typescript
// Abans (rebuig estricte):
if (eventTime > 0 && eventTime < this.latestTimestamp) return false;

// Després (tolerància 30s):
if (eventTime > 0 && eventTime < this.latestTimestamp - 30_000) return false;
```

Això permet que punts amb timestamp fins a 30s per sota de `latestTimestamp` passin el gate, evitant falsos rebutjos per deriva de rellotge o desordre temporal petit. La solució definitiva (F14 — inserció ordenada) queda pendent per Sprint 3.

### 2.8 — Validació Rang Coordenades (Backend)

**Fitxer:** `backend/app/services/location_service.py`

**Pas 2.8a: Validar lat/lng a `save_batch()` i `save_location()`**

```python
def _validate_coordinates(lat: float, lng: float) -> None:
    if not (-90 <= lat <= 90):
        raise ValueError(f"Latitude out of range: {lat}")
    if not (-180 <= lng <= 180):
        raise ValueError(f"Longitude out of range: {lng}")

# Usar a save_batch() i save_location():
for point in points:
    _validate_coordinates(point.latitude, point.longitude)
```

### 2.9 — WebSocket Infinite Retry

**Fitxer:** `frontend/hooks/useWebSocket.ts`

**Pas 2.9a: Substituir `MAX_RECONNECT_ATTEMPTS = 5` per infinite backoff**

```typescript
const MAX_FAST_ATTEMPTS = 5;
let attempt = 0;

function connectWithRetry(url: string): WebSocket {
  const ws = new WebSocket(url);

  ws.onclose = (event) => {
    if (event.code === 1000) return; // Normal close, no reconnect

    attempt++;
    const delay =
      attempt <= MAX_FAST_ATTEMPTS
        ? Math.min(1000 * Math.pow(2, attempt - 1), 16000)
        : 30000;

    setTimeout(() => {
      connectWithRetry(url);
    }, delay);
  };

  ws.onopen = () => {
    attempt = 0; // Reset on successful connect
  };

  return ws;
}
```

### 2.10 — Verificació Sprint 2

```bash
# Backend
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v

# Frontend
cd frontend && npm run build --webpack && npm test

# Manual:
# 1. Iniciar walk, apagar pantalla 30 min
# 2. Caregiver veu "GPS actiu" (blau), NO "offline" (vermell)
# 3. Encendre pantalla → WS reconnecta → "online" (verd)
# 4. Walk 1h: snapshot mostra ruta completa, no truncada
# 5. Kill app (swipe away) → reobrir → walkId recuperat
```

---

## SPRINT 3 — PLUGIN ROBUST + QUALITAT AVANÇADA (P2)

**Branca:** `feat/sprint3-plugin-robust`
**Durada:** 7-10 dies
**Objectiu:** Refactor SRP del plugin natiu, Kalman Filter, buffer persistent, intervals adaptatius Phase F, metadata de qualitat, segmentació visual, UX polida.

### 3.0 — Plugin SRP Refactor ⭐ NOU

**Problema:** `LocationSyncForegroundService.java` viola SRP: 410 línies, 10 responsabilitats (GPS, filtratge, buffer, HTTP, persistència, etc.). **Cada sprint va afegir funcionalitat sense refactoritzar.**

**Fitxers afectats:**
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncForegroundService.java` (orquestrador, ~80 línies)
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationAcquirer.java` (NOU)
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationBuffer.java` (NOU)
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationHttpClient.java` (NOU)
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/BufferStore.java` (NOU)
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationPoint.java` (NOU — extret de inner class)

**Pas 3.0a: Extreure `LocationAcquirer`**

Classe responsable de la captura GPS i filtratge (hereta gates de Sprint 1.1e):

```java
public class LocationAcquirer {
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private LocationPoint lastAcceptedPoint;

    public void start(LocationRequest request, Consumer<LocationPoint> onPointAccepted) { ... }
    public void stop() { ... }

    private boolean passesAccuracyGate(Location loc) { ... }
    private boolean passesFixAgeGate(Location loc) { ... }
    private boolean passesMockGate(Location loc) { ... }
    private boolean passesAntiJitterGate(LocationPoint candidate) { ... }
    private boolean passesTeleportGate(LocationPoint candidate, long elapsed) { ... }
    private boolean passesSpeedGate(double distance, long elapsed) { ... }
}
```

**Pas 3.0b: Extreure `LocationBuffer` + `BufferStore`**

`LocationBuffer`: cua en memòria amb persistència via `BufferStore`:

```java
public class LocationBuffer {
    private final PriorityQueue<LocationPoint> buffer;
    private final BufferStore store;
    private boolean lastFlushFailed;

    public LocationBuffer(BufferStore store) {
        this.store = store;
        this.buffer = store.load();  // Carregar buffer persistit
        this.lastFlushFailed = store.getLastFlushFailed();
        // Punts carregats de persistència → isRecovered = true
        for (LocationPoint p : buffer) p.isRecovered = true;
    }

    public void add(LocationPoint point) { buffer.add(point); }
    public List<LocationPoint> drainAll() { /* buidar cua */ }
    public void save() { store.save(buffer, lastFlushFailed); }
    public void clear() { store.clear(); }
}
```

`BufferStore` (SRP: persistència a SharedPreferences):

```java
public class BufferStore {
    private static final String PREF_BUFFER = "pending_buffer";
    private static final String PREF_FLUSH_FAILED = "last_flush_failed";
    private final SharedPreferences prefs;

    public BufferStore(Context context) {
        prefs = context.getSharedPreferences("pathguard_tracking", Context.MODE_PRIVATE);
    }

    public void save(PriorityQueue<LocationPoint> buffer, boolean lastFlushFailed) { ... }
    public PriorityQueue<LocationPoint> load() { ... }
    public boolean getLastFlushFailed() { ... }
    public void clear() { ... }
}
```

**Pas 3.0c: Extreure `LocationHttpClient`**

```java
public class LocationHttpClient {
    private final OkHttpClient client;
    public LocationHttpClient() { /* OkHttpClient.Builder amb timeouts */ }
    public boolean sendBatch(List<LocationPoint> batch, int walkId, String deviceToken, String serverUrl) { ... }
}
```

**Pas 3.0d: `LocationPoint` a fitxer propi**

```java
public class LocationPoint {
    final double latitude;
    final double longitude;
    final long timestampMs;
    final String clientId;
    boolean isRecovered;
}
```

**Impacte:** El servei principal passa de 410 línies / 10 responsabilitats → ~80 línies / 1 responsabilitat.

---

### 3.1 — Kalman Filter al Plugin

**Nou fitxer:** `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/KalmanFilter.java`

```java
package com.pathguard.app.plugin;

public class KalmanFilter {
    private final double q;
    private final double r;
    private double x;
    private double p;
    private double k;

    public KalmanFilter(double q, double r, double initialValue) {
        this.q = q;
        this.r = r;
        this.x = initialValue;
        this.p = 1.0;
    }

    public double filter(double measurement) {
        p = p + q;
        k = p / (p + r);
        x = x + k * (measurement - x);
        p = (1 - k) * p;
        return x;
    }

    public void reset(double value) {
        this.x = value;
        this.p = 1.0;
    }
}
```

**Integració a `LocationAcquirer`:**

```java
// A LocationAcquirer:
private KalmanFilter latFilter = new KalmanFilter(0.001, 0.01, 0);
private KalmanFilter lngFilter = new KalmanFilter(0.001, 0.01, 0);

// Després dels gates de filtratge:
double filteredLat = latFilter.filter(rawLat);
double filteredLng = lngFilter.filter(rawLng);
LocationPoint point = new LocationPoint(filteredLat, filteredLng, now, clientId);
acceptedConsumer.accept(point);
```

---

### 3.2 — Columnes `speed_ms` i `accuracy_m` al Model

Sense canvis respecte al ROADMAP v1.0. Veure `docs/auditoria-gps-mapa-qualitat.md` (G11).

**Fitxer:** `backend/app/db/models/location.py`

```python
class Location(Base):
    __tablename__ = "locations"
    # ... columnes existents ...
    speed_ms = Column(Float, nullable=True)      # NOU
    accuracy_m = Column(Float, nullable=True)     # NOU
    low_confidence = Column(Boolean, default=False) # NOU
```

**Fitxer:** `backend/app/services/location_service.py`

```python
def save_batch(db, walk_id, batch_id, points, patient):
    # ... validar ...
    last_in_db = db.query(Location).filter(
        Location.walk_id == walk_id
    ).order_by(Location.timestamp.desc()).first()

    for point in points:
        speed = None
        accuracy = None
        low_conf = False

        if last_in_db:
            dist = haversine(
                last_in_db.latitude, last_in_db.longitude,
                point.latitude, point.longitude
            )
            dt = (point.timestamp - last_in_db.timestamp).total_seconds()
            if dt > 0:
                speed = dist / dt
            if dist > 100:
                low_conf = True

        upsert_location(db, {
            **point,
            "speed_ms": speed,
            "accuracy_m": accuracy,
            "low_confidence": low_conf,
        })
```

**DB Migration:** Afegir columnes amb Alembic o SQL directe.

---

### 3.3 — 4 Segments Visuals al Mapa

**Depèn de:** F.4 (sense `is_recovered` propagat, el segment `recovered` mai es veu)

Sense canvis respecte al ROADMAP v1.0. Veure `docs/auditoria-gps-mapa-qualitat.md` (G15).

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`

```typescript
type ConfidenceLevel = "live" | "recovered" | "low_confidence" | "stale";

interface LocationSegment {
  coordinates: [number, number][];
  confidence: ConfidenceLevel;
}

function classifyConfidence(loc: LocationPayload): ConfidenceLevel {
  if (loc.is_recovered) return "recovered";
  if ((loc as any).low_confidence) return "low_confidence";
  const age = Date.now() - new Date(loc.timestamp).getTime();
  if (age > 60_000) return "stale";
  return "live";
}

const SEGMENT_STYLES: Record<ConfidenceLevel, { color: string; weight: number; dashArray?: string }> = {
  live:           { color: "#1E3A8A", weight: 4 },
  recovered:      { color: "#F59E0B", weight: 3, dashArray: "10,10" },
  low_confidence: { color: "#0F172A", weight: 2, dashArray: "2,8" },
  stale:          { color: "#0F172A", weight: 2, dashArray: "5,15" },
};
```

---

### 3.4 — Gap Detection al Frontend

Sense canvis respecte al ROADMAP v1.0.

**Fitxer:** `frontend/lib/WalkEventProcessor.ts`

```typescript
private static readonly MAX_GAP_SECONDS = 120;

private detectGap(point: LocationPayload, lastPoint: LocationPayload): boolean {
  const dt = (
    new Date(point.timestamp).getTime() -
    new Date(lastPoint.timestamp).getTime()
  ) / 1000;
  return dt > this.MAX_GAP_SECONDS;
}

// A reduceState(LOCATION_UPDATE):
if (lastPoint && this.detectGap(point, lastPoint)) {
  history.push({ ...lastPoint, _isGap: true });
}
```

---

### 3.5 — Auto-Pan Intel·ligent

Sense canvis respecte al ROADMAP v1.0.

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`

```typescript
useEffect(() => {
  if (!map || !currentPosition) return;

  const bounds = map.getBounds();
  const padding = 0.1;
  const latRange = bounds.getNorth() - bounds.getSouth();
  const lngRange = bounds.getEast() - bounds.getWest();

  const isOutside =
    currentPosition[0] < bounds.getSouth() + latRange * padding ||
    currentPosition[0] > bounds.getNorth() - latRange * padding ||
    currentPosition[1] < bounds.getWest() + lngRange * padding ||
    currentPosition[1] > bounds.getEast() - lngRange * padding;

  if (isOutside) {
    map.flyTo(currentPosition, map.getZoom(), { duration: 1.5 });
  }
}, [currentPosition]);
```

---

### 3.6 — Batches de 20 (Sync Engine Efficiency)

Sense canvis respecte al ROADMAP v1.0.

**Fitxer:** `frontend/services/locationService.ts`

```typescript
private static readonly RECOVERY_BATCH_SIZE = 20;

async syncQueuedPoints(): Promise<void> {
  const unsynced = await this.offlineSync.getUnsynced();

  for (let i = 0; i < unsynced.length; i += RECOVERY_BATCH_SIZE) {
    const batch = unsynced.slice(i, i + RECOVERY_BATCH_SIZE);
    const payload = batch.map((point) => ({
      ...point,
      is_recovered: true,
      client_id: point.id,
    }));

    try {
      await gpsTransportService.sendBatch(payload, this.deviceToken);
      for (const point of batch) {
        await this.offlineSync.deleteLocation(point.id);
      }
    } catch {
      break;
    }
  }
}
```

---

### 3.7 — `getUnsynced()` amb Cursor

Sense canvis respecte al ROADMAP v1.0.

**Fitxer:** `frontend/services/offlineSyncService.ts`

```typescript
private static readonly MAX_UNSYNCED = 200;

async getUnsynced(limit: number = MAX_UNSYNCED): Promise<QueuedLocation[]> {
  const db = await this.getDb();
  const tx = db.transaction(this.storeName, 'readonly');
  const index = tx.store.index('synced');
  const results: QueuedLocation[] = [];

  let cursor = await index.openCursor(IDBKeyRange.only(0));
  while (cursor && results.length < limit) {
    results.push(cursor.value);
    cursor = await cursor.continue();
  }

  await tx.done;
  return results;
}
```

---

### 3.8 — Buffer Persistence al Plugin ⭐ NOU

**Problema:** (F2/S6 a les auditories) Buffer en memòria. Si Android mata el servei, es perden tots els punts no enviats. `lastFlushFailed` es reseteja a `false`.

**Solució:** BufferStore (creat a 3.0b) persisteix buffer + `lastFlushFailed` a SharedPreferences.

**Fitxers:** `BufferStore.java`, `LocationBuffer.java`

**Pas 3.8a: Buffer carregat al constructor**

`LocationBuffer` carrega el buffer persistit al constructor. Punts carregats → `isRecovered = true`.

**Pas 3.8b: Persistir a cada add i flush**

```java
// LocationBuffer
public void add(LocationPoint point) {
    buffer.add(point);
}

public void onFlushResult(boolean success) {
    if (success) {
        lastFlushFailed = false;
        store.clear();
    } else {
        lastFlushFailed = true;
        store.save(buffer, true);
    }
}
```

**Pas 3.8c: `flushBuffer()` integrat**

```java
void flushBuffer() {
    List<LocationPoint> batch = buffer.drainAll();
    if (batch.isEmpty()) return;

    boolean success = httpClient.sendBatch(batch, walkId, deviceToken, serverUrl);
    buffer.onFlushResult(success);
}
```

---

### 3.9 — Interval Alignment Phase F ⭐ NOU

**Problema:** Plugin natiu flush cada 5s fixe. Fase F (GPS Adaptive) defineix intervals 15-120s. Inconsistència que malgasta bateria.

**Solució:** Alinear amb `frontend/lib/config.ts`:

| Constant | Abans (plugin) | Després |
|----------|:---:|:---:|
| `LOCATION_INTERVAL_MS` | 5000 | **15000** |
| `LOCATION_FASTEST_INTERVAL_MS` | 2000 | **5000** |
| `FLUSH_INTERVAL_SECONDS` | 5 (fixed scheduler) | **on-demand** |
| Max idle sense punts | ∞ | **30s** |

**Pas 3.9a: Canviar intervals LocationRequest**

```java
// Abans:
LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
    .setMinUpdateIntervalMillis(2000)

// Després:
LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 15000)
    .setMinUpdateIntervalMillis(5000)
```

**Pas 3.9b: Flush on-demand (eliminar scheduler fixe)**

```java
private ScheduledFuture<?> pendingFlush;

private void scheduleFlush() {
    if (pendingFlush != null && !pendingFlush.isDone()) return;
    pendingFlush = scheduler.schedule(this::flushBuffer, 2, TimeUnit.SECONDS);
}

// Safety net: flush cada 30s si no hi ha punts
private void startIdleTimer() {
    scheduler.scheduleAtFixedRate(this::flushBuffer, 30, 30, TimeUnit.SECONDS);
}
```

`addToBuffer()` → `scheduleFlush()` en lloc d'esperar el timer fixe de 5s.

---

### 3.10 — Heading Filter ⭐ NOU

**Troballa G6** de l'auditoria GPS-mapa-qualitat.

**Problema:** Plugin no valida direcció de moviment. Punts en direcció oposada s'accepten.

**Solució:** Afegir gate soft a `LocationAcquirer`:

```java
private static final double MAX_HEADING_DIFF_DEG = 90.0;

private boolean passesHeadingGate(LocationPoint candidate, LocationPoint last) {
    double bearing = Math.toDegrees(Math.atan2(
        candidate.longitude - last.longitude,
        candidate.latitude - last.latitude
    ));
    // Soft gate: punts amb heading inconsistent es marquen low_confidence
    // (implementació completa amb Location.getBearing() si el dispositiu ho suporta)
    return true;
}
```

> **Nota:** Gate soft — marca com a `low_confidence`, no descarta. Implementació completa amb `Location.getBearing()` depèn del dispositiu.

---

### 3.11 — Verificació Sprint 3

```bash
# Backend
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v

# Frontend
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

## FIXES — F.4: is_recovered Propagation Chain ⭐ NOU

**Abans de Sprint 3** (el fix desbloqueja que Sprint 3.3 funcioni)

**Problema:** `is_recovered` es perd en 6 punts de la cadena: plugin → HTTP → backend upsert → WS broadcast → frontend classifyEvent / reduceState. El segment `recovered` del mapa mai es veu.

**Fitxers afectats:**
- `frontend/lib/WalkEventProcessor.ts:200-210` — `classifyEvent` no propaga `is_recovered`
- `frontend/lib/WalkEventProcessor.ts:265-284` — `reduceState` (SNAPSHOT history) no propaga
- `frontend/lib/WalkEventProcessor.ts:344-351` — `reduceState` (SNAPSHOT latest) no propaga
- `frontend/lib/WalkEventProcessor.ts:330-340` — `reduceState` (BATCH) no propaga
- `backend/app/services/walk_service.py:202-210` — `get_walk_locations_by_ids` no inclou `is_recovered` al dict
- `backend/app/services/location_service.py:218-222` — `walk_state_cache.update()` no rep `is_recovered`

### F.4a — Backend: walk_service.py

```python
# A get_walk_locations_by_ids():
return {
    "id": loc.id,
    "walk_id": loc.walk_id,
    "latitude": loc.latitude,
    "longitude": loc.longitude,
    "timestamp": loc.timestamp.isoformat(),
    "is_recovered": loc.is_recovered,  # AFEGIR
    "client_id": loc.client_id,
    "speed_ms": loc.speed_ms,
    "accuracy_m": loc.accuracy_m,
    "low_confidence": loc.low_confidence,
}
```

### F.4b — Backend: location_service.py

```python
# A walk_state_cache.update():
walk_state_cache.update(
    walk_id=walk_id,
    latest_point={
        "latitude": point["latitude"],
        "longitude": point["longitude"],
        "timestamp": point["timestamp"],
        "is_recovered": point.get("is_recovered", False),  # AFEGIR
        "client_id": point.get("client_id"),
    }
)
```

### F.4c — Frontend: WalkEventProcessor.classifyEvent()

```typescript
// Assegurar que LocationUpdateEvent propaga is_recovered
interface LocationUpdateEvent {
  type: "LOCATION_UPDATE";
  location: {
    latitude: number;
    longitude: number;
    timestamp: string;
    is_recovered: boolean;  // JA HA D'EXISTIR
    client_id?: string;
  };
}
```

### F.4d — Frontend: WalkEventProcessor.reduceState (SNAPSHOT history)

```typescript
// Quan processa SNAPSHOT > locations:
const processed = locations.map((loc: any) => ({
  ...loc,
  is_recovered: loc.is_recovered ?? false,  // AFEGIR
}));
```

### F.4e — Frontend: WalkEventProcessor.reduceState (SNAPSHOT latest)

```typescript
// Quan processa SNAPSHOT > latest_point:
latestPoint: {
  ...latestPoint,
  is_recovered: latestPoint.is_recovered ?? false,  // AFEGIR
}
```

### F.4f — Frontend: WalkEventProcessor.reduceState (BATCH)

```typescript
// Quan processa BATCH > locations:
locations.forEach((loc: any) => {
  loc.is_recovered = loc.is_recovered ?? false;  // AFEGIR
});
```

### Verificació

```bash
# Eliminar buffer persistent + kill app (simula pèrdua)
# Generar walk, comprovar que punts NO porten is_recovered=true (pel camí natiu)
# Verificar que punts recuperats via IndexedDB (web) porten is_recovered=true
# Verificar que la polyline al mapa es pinta amb style recovered

# Frontend
cd frontend && npm run build --webpack && npm test

# Backend
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v
```

---

## SPRINT 4 — NETEJA FINAL (P3)

**Branca:** `feat/sprint4-neteja`
**Durada:** 1 dia

### 4.1 — `clearSynced` per Punt Individual

Ja resolt a Sprint 1.3b (eliminat `clearSynced()`, fem `delete` directe).

### 4.2 — Strip Meta-Fields del Backend

**Fitxer:** `backend/app/api/websocket/event_publisher.py`

```python
async def publish(self, event_name: str, data: dict) -> None:
    # NOU: Copiar només els camps intencionals (no _event_name, _event_id, _timestamp)
    clean_data = {
        k: v for k, v in data.items()
        if not k.startswith("_")
    }
    for handler in self._handlers:
        await handler(event_name, clean_data)
```

### 4.3 — `processedEvents` Cap → 500

**Fitxer:** `frontend/lib/WalkEventProcessor.ts`

```typescript
private static readonly MAX_PROCESSED_EVENTS = 500; // era 200
```

### 4.4 — Plugin Consulta Estat Walk

**Fitxer:** `LocationSyncForegroundService.java`

```java
// Si el backend retorna 404 (walk no actiu), aturar el tracking
// A flushBuffer(), després de HTTP response:
if (responseCode == 404) {
    stopTracking();
    return;
}
```

### 4.5 — Verificació Final (Tots els Sprints)

```bash
# Backend: 152/152 (10 WS timing preexistents)
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v

# Frontend: build OK, 108/108 tests
cd frontend && npm run build --webpack && npm test

# Checklist manual completa:
# [ ] Walk real al Redmi: ruta neta, sense zigzags, sense salts
# [ ] Screen-off 30 min: caregiver veu "GPS actiu"
# [ ] Tornar app: WS reconnecta automàticament
# [ ] Kill app: walk reprèn (walkId recuperat)
# [ ] Offline 10 min: tots els punts recuperats (sense duplicats)
# [ ] SELECT client_id, COUNT(*) FROM locations GROUP BY client_id HAVING COUNT(*) > 1 → 0 rows
# [ ] Snapshot mostra ruta completa (no truncada)
# [ ] Mapa: 4 segments visuals, auto-pan intel·ligent
# [ ] Backend logs: zero errors nous
```

---

## FIXES — CORRECCIONS POST-AUDITORIA

Fixos aplicats després de completar Sprint 1 i Sprint 2, fora dels sprints planificats.

### F.1 — Columna `client_id`: VARCHAR(50) → VARCHAR(64) ✅ FET

**Data:** 2026-06-04
**Problema:** Sprint 1 va introduir `client_id` determinístic SHA-256 (64 chars), però la columna a PostgreSQL era `VARCHAR(50)`. Totes les ubicacions fallaven amb `StringDataRightTruncation`. El WebSocket no tenia dades per broadcast, i el mapa no es renderitzava.
**Solució:**
- `backend/app/db/models/location.py`: `String(50)` → `String(64)`
- `backend/scripts/migrate_client_id.py`: script de migració
- `ALTER TABLE location ALTER COLUMN client_id TYPE VARCHAR(64);` executat a Supabase SQL Editor
- Verificat: el mapa es renderitza 2-3s després d'iniciar passeig

### F.2 — Mapa no visible a /caregiver ✅ FET

**Data:** 2026-06-04
**Problema:** Conseqüència directa de F.1 — sense broadcast de ubicacions, el mapa mai rebia dades per renderitzar.
**Solució:** Corregit F.1 → ubicacions s'insereixen → WebSocket fa broadcast → mapa es mostra.

### F.3 — STATUS_CONFIG: colors i texts amigables ✅ FET

**Data:** 2026-06-05
**Fitxer:** `frontend/components/CaregiverDashboard/PatientStatusCard.tsx`
**Canvis:**
- `offline`: `bg-danger` (vermell) → `bg-warning` (groc)
- Tots els labels amb prefix "Passeig actiu - "
- `offline` label: `"Passeig actiu - Sense cobertura"`

### F.4 — Propagació is_recovered (cadena plugin→frontend) ✅ FET

**Data:** 2026-06-05
**Fitxers:** `walk_service.py` (2), `location_service.py` (1), `WalkEventProcessor.ts` (4)
**Problema:** `is_recovered` es perd en 6 punts entre el plugin i el mapa.
**Solució:** 12 insercions, 5 supressions en 3 fitxers. La polyline `recovered` ara pot arribar al frontend.

### F.5 — Persistir lastFlushFailed a SharedPreferences ✅ FET

**Data:** 2026-06-05
**Fitxer:** `LocationSyncForegroundService.java`
**Problema:** `lastFlushFailed` era in-memory. En reiniciar el servei (kill app), es perdia i `is_recovered` era sempre `false`.
**Solució:** Persistir a SharedPreferences (mateix fitxer que walkId). `persistFlushFailed()` cridat després de cada canvi d'estat. Reset a `false` al començar un walk nou.
**Requereix:** APK actualitzada (canvi al plugin natiu).

---

---

## MILLORES UX — VISUALITZACIÓ MAPA (PENDENTS)

**Propostes** per millorar la qualitat visual de la ruta de /patient a /caregiver, sense tocar backend, infraestructura ni plugins natius. Només frontend (`MapRenderer.tsx` + `WalkEventProcessor.ts`).

### UX-1 — Douglas-Peucker als segments recovered

**Problema:** `segmentLocations()` aplica simplificació només a segments no recovered. Els recovered es pinten sencers, amb zig-zags innecessaris del GPS sense assistència de xarxa.

**Solució:** Aplicar `epsilon` (Douglas-Peucker) també als recovered. Una constant.

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`
**Esforç:** Minuts

---

### UX-2 — Segmentació per velocitat improbable

**Problema:** Talls rectes "impossibles" (edificis) causats per punts recovered consecutius amb velocitat implicada > 2 m/s (caminar ràpid).

**Solució:** Calcular haversine entre cada parell de punts consecutius dins un segment recovered. Si la velocitat implicada > 2 m/s, partir el segment i renderitzar el subtram sospitós amb més transparència o estil diferenciat.

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`
**Esforç:** Hores

---

### UX-3 — No renderitzar segments recovered molt curts

**Problema:** El gate actual `coordinates.length > 1` deixa passar segments de 2-3 punts recovered. Pinta micro-línies rectes que semblen errors.

**Solució:** Llindar mínim: no renderitzar segments recovered amb < 4 punts o longitud total < 30m. Aquests micro-segments desapareixen del mapa.

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`
**Esforç:** Hores

---

### UX-4 — Marcadors d'inici/fi de recuperació

**Problema:** El cuidador no sap per què apareix un segment taronja.

**Solució:** Marker verd "📡" al punt on es perd cobertura (inici recovered) i marker vermell "📡" al punt on es recupera (fi recovered). Context visual immediat.

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`
**Esforç:** Hores

---

### UX-5 — Millorar estil del segment recovered

**Problema:** Línia discontinua `10,10` no comunica prou "això és menys fiable".

**Solució:** Guixeta més fina (weight 3 vs 5), opacitat 0.5, `lineCap: 'round'` + `lineJoin: 'round'` per suavitzar cantonades.

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`
**Esforç:** Minuts

---

### UX-6 — Direcció del pacient al mapa

**Problema:** El mapa mostra la ruta i el punt actual, però no indica cap on es mou el pacient. El cuidador no sap si camina cap a casa o se n'allunya.

**Solució:** Calcular bearing (heading) entre els 2 últims punts GPS acceptats i reflectir la direcció al marcador del punt actual.

**Opcions:**

| | Enfoc | Esforç |
|---|---|---|
| **A** | Rotar el `PulseDotIcon` amb CSS (`transform: rotate(deg)`) usant `divIcon` amb un chevron/triangle direccional | Hores |
| **B** | Plugin `leaflet-rotatedmarker` per rotar qualsevol marker natiu | Hores |
| **C** | Les dues anteriors + fletxes (`>`) a intervals regulars sobre la polilínia de la ruta sencera | 1 dia |

**Càlcul de bearing:**

```typescript
function getBearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
          - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
```

**Dependències:** Cap de nova si s'usa `divIcon` + CSS (Opció A). Opció B requereix `npm install leaflet-rotatedmarker`.

**Recomanació:** Opció A (divIcon) — zero dependències, efecte net, fàcil de fer i desfer.

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`
**Esforç:** Hores

**Problema:** Línia discontinua `10,10` no comunica prou "això és menys fiable".

**Solució:** Guixeta més fina (weight 3 vs 5), opacitat 0.5, `lineCap: 'round'` + `lineJoin: 'round'` per suavitzar cantonades.

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`
**Esforç:** Minuts

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
| **D**IP | `locationService` depèn d'abstraccions (`gpsTransportService`, `offlineSync`), no d'implementacions concretes. |

| Golden Rule | Compliment |
|---|---|
| Zero `fetch()` en components | Totes les crides HTTP a `services/` |
| No `any` types | `unknown` + type guards a `WalkEventProcessor` |
| No module-level mutable state | `ConnectionManager` és instància, `walk_state_cache` és classe |
| No dead code | `batchBuffer` eliminat → tots els imports/referències eliminats |
| Testability | Douglas-Peucker, Haversine, KalmanFilter: funcions pures testejables |

---

*ROADMAP — Versió 1.0 — 2026-06-04*
*Document viu. Actualitzar després de cada sprint implementat.*
