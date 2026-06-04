# ROADMAP — PATHGUARD POST-AUDITORIA

**Data:** 2026-06-04
**Autor:** Principal Engineer
**Font:** 4 auditories + CONTEXT.md + action-plan.md
**Propòsit:** Pla d'implementació pas a pas. Juntament amb CONTEXT.md, és la biblia del projecte.

> **Estat:** Sprint 1 i Sprint 2 completats. Pròxim: Sprint 3.

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

**Pas 2.2d: Indicador visual de 4 colors**

```typescript
const STATUS_CONFIG: Record<PresenceStatus, { color: string; label: string }> = {
  online:      { color: "bg-success", label: "En línia" },
  gps_online:  { color: "bg-primary", label: "GPS actiu" },
  limbo:       { color: "bg-warning", label: "Incert" },
  offline:     { color: "bg-danger", label: "Fora de línia" },
};
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

## SPRINT 3 — QUALITAT AVANÇADA (P2)

**Branca:** `feat/sprint3-qualitat-avancada`
**Durada:** 5-7 dies
**Objectiu:** Kalman Filter, metadata de qualitat, segmentació visual, UX polida.

### 3.1 — Kalman Filter al Plugin

**Nou fitxer:** `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/KalmanFilter.java`

```java
package com.pathguard.app.plugin;

public class KalmanFilter {
    private final double q; // process noise
    private final double r; // measurement noise
    private double x;       // estimated value
    private double p;       // estimation error
    private double k;       // Kalman gain

    public KalmanFilter(double q, double r, double initialValue) {
        this.q = q;
        this.r = r;
        this.x = initialValue;
        this.p = 1.0;
    }

    public double filter(double measurement) {
        p = p + q;          // prediction
        k = p / (p + r);    // update
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

**Integració a `LocationSyncForegroundService.java`:**

```java
private KalmanFilter latFilter;
private KalmanFilter lngFilter;

// A startTracking():
latFilter = new KalmanFilter(0.001, 0.01, 0);
lngFilter = new KalmanFilter(0.001, 0.01, 0);

// A addToBuffer(), després que el punt passi tots els filtres:
double filteredLat = latFilter.filter(lat);
double filteredLng = lngFilter.filter(lng);
LocationPoint point = new LocationPoint(filteredLat, filteredLng, timestamp, clientId);
```

### 3.2 — Columnes `speed_ms` i `accuracy_m` al Model

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
            if dist > 100:  # >100m jump
                low_conf = True

        upsert_location(db, {
            "walk_id": walk_id,
            "latitude": point.latitude,
            "longitude": point.longitude,
            "timestamp": point.timestamp,
            "client_id": point.client_id,
            "is_recovered": point.is_recovered or False,
            "speed_ms": speed,
            "accuracy_m": accuracy,
            "low_confidence": low_conf,
        })
```

**DB Migration:** Afegir columnes amb Alembic o SQL directe (segons el que ja faci servir el projecte).

### 3.3 — 4 Segments Visuals al Mapa

**Fitxer:** `frontend/components/CaregiverMap/MapRenderer.tsx`

**Pas 3.3a: Nova funció `classifyConfidence`**

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
```

**Pas 3.3b: `segmentLocations()` usa `classifyConfidence`**

```typescript
function segmentLocations(locations: LocationPayload[]): LocationSegment[] {
  const segments: LocationSegment[] = [];
  let current: LocationSegment | null = null;

  for (const loc of locations) {
    if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') continue;

    const confidence = classifyConfidence(loc);

    if (!current || current.confidence !== confidence) {
      current = { coordinates: [], confidence };
      segments.push(current);
    }
    current.coordinates.push([loc.latitude, loc.longitude]);
  }

  // Douglas-Peucker a cada segment
  return segments.map((seg) => ({
    ...seg,
    coordinates: douglasPeucker(seg.coordinates, 3),
  }));
}
```

**Pas 3.3c: Estils de polyline per confiança**

```typescript
const SEGMENT_STYLES: Record<ConfidenceLevel, { color: string; weight: number; dashArray?: string }> = {
  live:           { color: "#1E3A8A", weight: 4 },                    // primary
  recovered:      { color: "#F59E0B", weight: 3, dashArray: "10,10" }, // warning, dashed
  low_confidence: { color: "#0F172A", weight: 2, dashArray: "2,8" },   // foreground + dotted
  stale:          { color: "#0F172A", weight: 2, dashArray: "5,15" },  // foreground + faded dashed
};
```

### 3.4 — Gap Detection al Frontend

**Fitxer:** `frontend/lib/WalkEventProcessor.ts`

```typescript
private static readonly MAX_GAP_SECONDS = 120;

private detectGap(
  point: LocationPayload,
  lastPoint: LocationPayload
): boolean {
  const dt = (
    new Date(point.timestamp).getTime() -
    new Date(lastPoint.timestamp).getTime()
  ) / 1000;

  return dt > this.MAX_GAP_SECONDS;
}

// A reduceState(LOCATION_UPDATE):
if (lastPoint && this.detectGap(point, lastPoint)) {
  // Inserir gap marker (punt especial amb _isGap=true)
  history.push({ ...lastPoint, _isGap: true });
}
```

### 3.5 — Auto-Pan Intel·ligent

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

### 3.6 — Batches de 20 (Sync Engine Efficiency)

**Fitxer:** `frontend/services/locationService.ts`

```typescript
private static readonly RECOVERY_BATCH_SIZE = 20;

async syncQueuedPoints(): Promise<void> {
  const unsynced = await this.offlineSync.getUnsynced(/* cursor, limit */);

  // Processar en batches de 20
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
      break; // Stop on first failure, resume next sync cycle
    }
  }
}
```

### 3.7 — `getUnsynced()` amb Cursor

**Fitxer:** `frontend/services/offlineSyncService.ts`

```typescript
private static readonly MAX_UNSYNCED = 200; // Límit per evitar OOM

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

### 3.8 — Verificació Sprint 3

```bash
# Backend
cd backend && micromamba activate tracker-env && python -m pytest tests/ -v

# Frontend
cd frontend && npm run build --webpack && npm test

# Manual:
# - Ruta visualment suau (Catmull-Rom, si s'implementa) o simplificada (Douglas-Peucker)
# - 4 nivells de confiança visibles al mapa
# - Auto-pan només quan el punt surt del viewport
# - speed_ms i accuracy_m calculats a DB
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
