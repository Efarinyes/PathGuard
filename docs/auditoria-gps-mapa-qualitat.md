# AUDITORIA — GPS, MAPA I QUALITAT DE RUTA

**Data:** 2026-06-04  
**Autor:** Staff Software Engineer (GPS Tracking, GIS Systems, Route Reconstruction, Geospatial Algorithms)  
**Estat:** Document final per a revisió i implementació

---

## 1. ABAST

Pipeline auditat:

```
Satèl·lits GPS
  → FusedLocationProviderClient (Android)
    → LocationSyncForegroundService (plugin natiu)
      → ConcurrentLinkedQueue (buffer en memòria)
        → HTTP POST /locations/batch
          → Backend location_service.save_batch()
            → PostgreSQL (taula locations)
              → WebSocket broadcast
                → WalkEventProcessor (frontend caregiver)
                  → MapRenderer.tsx (Leaflet polyline)
```

Objectiu: identificar causes de rutes visualment incorrectes (girs impossibles, zones on l'usuari no ha passat, salts de 50-100m), i proposar una pipeline geoespacial robusta per a seguiment de persones en producció.

---

## 2. DECISIONS D'ARQUITECTURA CONFIRMADES

Abans de llistar les troballes, es confirmen 4 decisions preses durant la revisió:

| # | Decisió | Justificació |
|---|---|---|
| 1 | **Filtrat multi-capa: plugin + backend + frontend** | Cap capa sola pot garantir qualitat. El plugin filtra soroll local (jitter). El backend valida consistència (teleportacions). El frontend suavitza visualment. |
| 2 | **Kalman Filter al plugin natiu** | El Kalman Filter és l'estàndard de la indústria per a GPS tracking en temps real. Corregeix jitter sense introduir latència. Més precís que Haversine simple. |
| 3 | **Rendering amb Douglas-Peucker + smoothing** | El mapa no ha de renderitzar tots els punts crus. Simplificació + interpolació = ruta visualment neta sense perdre precisió geogràfica. |
| 4 | **Segmentació visual per confiança** | No només `is_recovered` vs `live`. Calen 4 nivells: live, recovered, low-confidence, stale. |

---

## 3. ANÀLISI DE CAUSES: PER QUÈ LA RUTA ÉS INCORRECTA

### 3.1 GPS Jitter i Urban Canyon Effect

**Fenomen físic:** El senyal GPS en zones urbanes es reflecteix als edificis (multipath). El receptor calcula posicions amb error de 10-30m, fins i tot amb `PRIORITY_HIGH_ACCURACY`.

**Impacte al codi actual:**

| Problema | Fitxer | Impacte |
|---|---|---|
| `setMinUpdateDistanceMeters(5)` al plugin natiu | `LocationSyncForegroundService.java` | El FusedLocationProvider envia punts amb 5m de canvi. Amb jitter de 10-30m, cada fluctuació crea un punt nou. **5m és massa sensible per a zona urbana.** |
| Sense filtre Haversine al plugin | `LocationSyncForegroundService.java: addToBuffer()` | El plugin accepta TOTS els punts del FusedLocationProvider. No compara amb l'últim punt acceptat. |
| Sense filtre d'accuracy | `LocationSyncForegroundService.java: onLocationResult()` | `Location.getAccuracy()` retorna l'error estimat del fix (en metres). Mai es llegeix ni es filtra. Punts amb accuracy > 50m s'accepten igual que accuracy < 5m. |
| Sense filtre de speed | `LocationSyncForegroundService.java: addToBuffer()` | `Location.getSpeed()` retorna la velocitat estimada pel GPS. Mai es valida. Un punt amb speed = 200 km/h (impossible a peu) s'accepta. |

**Resultat visual:** Zigzags de 10-30m al voltant de la posició real. La polyline sembla un cable elèctric tremolant.

### 3.2 Urban Canyon: Salts de 50-100m

**Fenomen físic:** En carrers estrets amb edificis alts, el GPS pot perdre 3-4 satèl·lits. La posició calculada salta 50-100m en un sol fix.

**Impacte al codi actual:**

| Problema | Fitxer | Impacte |
|---|---|---|
| Sense detecció de teleportació | Cap fitxer | No hi ha cap check a cap capa que detecti un salt impossible. Un punt a 100m del anterior s'accepta sense qüestionar. |
| Sense heading validation | Cap fitxer | `Location.getBearing()` indica la direcció de moviment. Mai es compara amb la direcció esperada. Un punt que va en direcció oposada al moviment s'accepta. |
| `WalkEventProcessor` accepta qualsevol timestamp | `WalkEventProcessor.ts` | `appendLocation()` només deduplica per timestamp i ordena. No valida distància, speed, ni heading. |

**Resultat visual:** La polyline fa un salt brusc de 50-100m cap a un edifici, després torna. Sembla que l'usuari ha entrat a un edifici i ha sortit instantàniament.

### 3.3 Punts Duplicats i Desordenats

Problemes ja documentats a `auditoria-pipeline-localitzacio.md`:

| ID | Problema | Impacte al mapa |
|---|---|---|
| **F5** | Re-queue desordenat després de fallida HTTP | Punts arriben fora d'ordre → polyline connecta punts en ordre incorrecte → girs impossibles |
| **F9** | `save_batch()` no ordena abans de broadcast | Punts broadcastats fora d'ordre → caregiver rep punts desordenats |
| **F14** | `WalkEventProcessor` rebutja en lloc d'inserir | Punts vàlids descartats → forats a la ruta |

### 3.4 Punts Stale i Low Accuracy

**Fenomen:** El GPS pot retornar un fix "vell" (stale) quan no pot obtenir un de nou. El fix pot tenir accuracy molt alta (>100m).

**Impacte al codi actual:**

| Problema | Fitxer | Impacte |
|---|---|---|
| Sense check d'edat del fix | `LocationSyncForegroundService.java` | `Location.getTime()` retorna el timestamp del fix GPS. Si és >30s vell, hauria de descartar-se. No es fa. |
| Sense check de `isMock()` | `LocationSyncForegroundService.java` | `Location.isMock()` indica si el fix ve d'una app de mock location. No es valida. |
| Backend accepta qualsevol float | `location_service.py` | `latitude: float`, `longitude: float` — sense validació de rang (-90/90, -180/180). |

---

## 4. TROBALLES PER ETAPA

### 4.1 GPS → Plugin Natiu

**Garanties esperades:** Captura precisa, filtrat de soroll (jitter, accuracy, speed, heading), persistència fins a enviament.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **G1** | **P0** | `setMinUpdateDistanceMeters(5)` massa sensible. Jitter urbà de 10-30m genera punts espuris cada 5m de fluctuació. | Ruta amb zigzags constants | **Alta** (sempre en zona urbana) | Pujar a 15m com a mínim tècnic Android. Afegir filtre Haversine 25m a `addToBuffer()` com a segona capa. | Baix |
| **G2** | **P0** | Sense filtre d'accuracy. `Location.getAccuracy()` mai es llegeix. Punts amb accuracy >50m s'accepten. | Punts de baixa qualitat al mapa | **Alta** (sempre) | Descartar punts amb `getAccuracy() > MAX_ACCURACY_M` (50m). Configurable. | Baix |
| **G3** | **P0** | Sense detecció de teleportació. Cap check de distància entre punts consecutius. | Salts de 50-100m al mapa | **Alta** (urban canyons) | Comparar Haversine amb últim punt acceptat. Si >MAX_JUMP_M (80m) i elapsed <5s, descartar. | Baix |
| **G4** | **P1** | Sense filtre de speed. `Location.getSpeed()` mai es valida. Punts amb speed impossible s'accepten. | Punts que impliquen velocitat sobrehumana | **Mitjana** | Si `getSpeed() > MAX_SPEED_MS` (5 m/s = 18 km/h), descartar. Alternativament, calcular speed des de Haversine/dt. | Baix |
| **G5** | **P1** | Sense filtre d'edat del fix. `Location.getTime()` mai es compara amb `System.currentTimeMillis()`. | Punts stale (vells) barrejats amb punts nous | **Mitjana** | Si `System.currentTimeMillis() - location.getTime() > MAX_FIX_AGE_MS` (10000ms), descartar. | Baix |
| **G6** | **P1** | Sense filtre de heading. `Location.getBearing()` mai es valida contra direcció de moviment. | Punts en direcció oposada al moviment | **Mitjana** | Comparar bearing del nou punt amb bearing calculat (últim punt → nou punt). Si diferència >MAX_HEADING_DIFF (90°), marcar `low_confidence`. | Mitjà |
| **G7** | **P2** | Sense Kalman Filter. El jitter es filtra amb Haversine simple (threshold binari: passa/no passa). | Filtratge subòptim: o es perden punts bons o es deixen passar punts dolents | **Alta** | Implementar Kalman Filter simple (1D lat + 1D lng) al plugin. Corregeix jitter sense llindars arbitraris. | Alt |
| **G8** | **P2** | `Location.isMock()` no es valida. Si una app de mock location està activa, tots els punts són falsos. | Ruta completament falsa si mock location actiu | **Baixa** | Si `isMock() == true`, descartar. | Baix |

**Escenari de corrupció real (G3 — Teleportació):**
```
1. Usuari camina per carrer estret (urban canyon)
2. GPS perd 3 satèl·lits momentàniament
3. FusedLocationProvider retorna fix amb error de 80m
4. Plugin l'accepta sense qüestionar (no hi ha teleportation check)
5. Punt enviat al backend → inserit a DB
6. Caregiver veu: ruta salta 80m cap a un edifici, després torna
7. Sembla que l'usuari ha teleportat
```

**Escenari de corrupció real (G2 — Accuracy):**
```
1. Usuari entra sota una marquesina metàl·lica
2. GPS accuracy puja a 120m (senyal molt degradat)
3. Plugin accepta el punt igual (no llegeix accuracy)
4. Punt amb coordenades molt imprecises arriba al mapa
5. Caregiver veu un punt allunyat de la ruta real
6. Sembla que l'usuari ha canviat de carrer
```

---

### 4.2 Plugin → Backend

**Garanties esperades:** Validació de coordenades, detecció de punts sospitosos, metadata de qualitat.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **G9** | **P1** | Backend no valida rang de coordenades. Accepta `latitude: 999.0`. | Dades corruptes a DB | **Baixa** (només amb bug client) | Backend: validar `-90 <= lat <= 90` i `-180 <= lng <= 180`. | Baix |
| **G10** | **P2** | Backend no detecta teleportacions. Accepta qualsevol punt sense validar distància amb l'anterior. | Punts impossibles arriben a DB | **Mitjana** | Backend: calcular Haversine amb últim punt del walk. Si >MAX_JUMP_M, marcar com `low_confidence`. | Mitjà |
| **G11** | **P2** | Backend no calcula speed entre punts. No hi ha cap mètrica de qualitat del punt a DB. | Impossible auditar qualitat de ruta post-mortem | **Mitjana** | Afegir columna `speed_ms: Float` i `accuracy_m: Float` al model Location. Calcular a `save_batch()`. | Mitjà |

**Escenari de corrupció real (G9):**
```
1. Bug al plugin: coordenada mal calculada (ex: lat = 0.0, lng = 0.0)
2. Backend accepta sense validació
3. Punt (0, 0) s'insereix a DB → apareix a l'oceà Atlàntic
4. Caregiver veu un salt de 4000km i després torna
5. Ruta completament trencada
```

---

### 4.3 Backend → WebSocket → Frontend

**Garanties esperades:** Validació de consistència, detecció de gaps, inserció ordenada.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **G12** | **P1** | `WalkEventProcessor` no filtra punts sospitosos. Accepta qualsevol `location_update` sense validar distància/speed. | Punts impossibles arriben al mapa | **Mitjana** | Afegir `validateLocation()` a `WalkEventProcessor` abans d'`appendLocation()`. Rebutjar si speed >MAX o distància >MAX. | Mitjà |
| **G13** | **P2** | `appendLocation()` ordena per timestamp però no detecta gaps temporals. | No es pot segmentar correctament trams offline | **Mitjana** | Detectar gaps >60s entre punts consecutius. Marcar com a "gap" per a segmentació visual. | Baix |

---

### 4.4 Frontend → Map Rendering

**Garanties esperades:** Ruta precisa sense jitter, diferenciació visual de zones per confiança, auto-center intel·ligent.

| ID | Classificació | Problema | Impacte | Probabilitat | Solució | Esforç |
|---|---|---|---|---|---|---|
| **G14** | **P0** | Zero suavitzat de ruta. `segmentLocations()` connecta punts crus amb línies rectes. Jitter = zigzags visuals. | Ruta visualment incorrecta | **Alta** (sempre) | Aplicar Douglas-Peucker (ε=3m) per simplificar, després Catmull-Rom spline per suavitzar corbes. | Mitjà |
| **G15** | **P1** | Només 2 segments visuals: `is_recovered=true` (dashed amber) vs `false` (solid blue). No diferencia low-confidence ni stale. | Caregiver no sap quins punts són fiables | **Alta** (sempre) | 4 segments: live (solid blue), recovered (dashed amber), low-confidence (dotted gray), stale (faded). | Mitjà |
| **G16** | **P2** | No hi ha decimació de punts per rendiment. Walks llargs (>500 punts) renderitzen tots els vèrtexs. | Map slow amb walks llargs | **Baixa** (walks curts actualment) | Douglas-Peucker redueix punts. A més, Leaflet ja optimitza polylines internament. | Baix |
| **G17** | **P2** | Auto-pan massa agressiu. Cada punt nou centra el mapa amb animació de 1.5s. | Mapa "balla" constantment | **Mitjana** | Auto-pan només si el punt nou és fora del viewport actual (bounds check). | Baix |

---

## 5. TAULA RESUM DE TROBALLES

| ID | Etapa | Classificació | Problema | Impacte | Probabilitat | Esforç |
|---|---|---|---|---|---|---|
| **G1** | GPS→Plugin | **P0** | `setMinUpdateDistanceMeters(5)` massa sensible | Zigzags constants | Alta | Baix |
| **G2** | GPS→Plugin | **P0** | Sense filtre d'accuracy | Punts baixa qualitat | Alta | Baix |
| **G3** | GPS→Plugin | **P0** | Sense detecció de teleportació | Salts 50-100m | Alta | Baix |
| **G14** | Map | **P0** | Zero suavitzat de ruta | Zigzags visuals | Alta | Mitjà |
| **G4** | GPS→Plugin | **P1** | Sense filtre de speed | Velocitat impossible | Mitjana | Baix |
| **G5** | GPS→Plugin | **P1** | Sense filtre d'edat del fix | Punts stale | Mitjana | Baix |
| **G6** | GPS→Plugin | **P1** | Sense filtre de heading | Direcció oposada | Mitjana | Mitjà |
| **G9** | Backend | **P1** | Sense validació de rang coordenades | Dades corruptes | Baixa | Baix |
| **G12** | Frontend WS | **P1** | `WalkEventProcessor` sense validació | Punts impossibles al mapa | Mitjana | Mitjà |
| **G15** | Map | **P1** | Només 2 segments visuals | Sense context de confiança | Alta | Mitjà |
| **G7** | GPS→Plugin | **P2** | Sense Kalman Filter | Filtratge subòptim | Alta | Alt |
| **G8** | GPS→Plugin | **P2** | `isMock()` no validat | Ruta falsa amb mock | Baixa | Baix |
| **G10** | Backend | **P2** | Backend sense detecció teleportació | Punts impossibles a DB | Mitjana | Mitjà |
| **G11** | Backend | **P2** | Sense `speed_ms` ni `accuracy_m` a DB | Sense auditoria qualitat | Mitjana | Mitjà |
| **G13** | Frontend WS | **P2** | Sense detecció de gaps temporals | Segmentació incorrecta | Mitjana | Baix |
| **G16** | Map | **P2** | Sense decimació de punts | Map slow amb walks llargs | Baixa | Baix |
| **G17** | Map | **P2** | Auto-pan massa agressiu | Mapa "balla" | Mitjana | Baix |

---

## 6. PROPOSTA: PIPELINE GEOESPACIAL ROBUSTA

### 6.1 Arquitectura de 5 Capes de Filtratge

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA 1: HARDWARE GPS                       │
│  FusedLocationProviderClient                                  │
│  - PRIORITY_HIGH_ACCURACY                                     │
│  - Interval: 5000ms                                           │
│  - Min distance: 15m (pujat de 5m)                            │
│  → Entrega Location objects al plugin                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                CAPA 2: PLUGIN NATIU (Java)                    │
│  LocationSyncForegroundService.addToBuffer()                  │
│                                                               │
│  Filtre 1: Accuracy gate                                      │
│    if (location.getAccuracy() > 50m) → DESCARTAR              │
│                                                               │
│  Filtre 2: Fix age gate                                       │
│    if (now - location.getTime() > 10s) → DESCARTAR            │
│                                                               │
│  Filtre 3: Mock gate                                          │
│    if (location.isMock()) → DESCARTAR                         │
│                                                               │
│  Filtre 4: Haversine distance (anti-jitter)                   │
│    if (haversine(location, lastAccepted) < 25m) → DESCARTAR   │
│                                                               │
│  Filtre 5: Teleportation detection                            │
│    if (haversine(location, lastAccepted) > 80m)               │
│      AND (elapsed < 5s) → DESCARTAR                           │
│                                                               │
│  Filtre 6: Speed validation                                   │
│    calculatedSpeed = haversine / elapsed                       │
│    if (calculatedSpeed > 5 m/s = 18 km/h) → DESCARTAR        │
│                                                               │
│  Filtre 7: Heading validation (opcional, Fase 3)              │
│    if (bearing_diff > 90°) → MARCAR low_confidence            │
│                                                               │
│  → LocationPoint acceptat → buffer → HTTP                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              CAPA 3: BACKEND (Python)                         │
│  location_service.save_batch()                                │
│                                                               │
│  Validació 1: Rang de coordenades                             │
│    assert -90 <= lat <= 90, -180 <= lng <= 180               │
│                                                               │
│  Validació 2: Teleportation check (soft)                      │
│    if (haversine(point, lastInDB) > 100m)                     │
│      → marcar low_confidence = true                           │
│                                                               │
│  Càlcul: speed_ms, accuracy_m                                 │
│    Guardar a DB per auditoria                                  │
│                                                               │
│  → INSERT a PostgreSQL amb metadata de qualitat               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│        CAPA 4: FRONTEND WS PROCESSING (TypeScript)            │
│  WalkEventProcessor.reduceState(LOCATION_UPDATE)              │
│                                                               │
│  Validació 1: Speed check                                     │
│    if (haversine(newPoint, lastPoint) / dt > 5 m/s)           │
│      → REBUTJAR                                               │
│                                                               │
│  Validació 2: Gap detection                                   │
│    if (dt > 120s) → inserir "gap marker" a routeHistory       │
│                                                               │
│  → routeHistory actualitzat amb punts validats                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          CAPA 5: MAP RENDERING (Leaflet/React)               │
│  MapRenderer.tsx                                              │
│                                                               │
│  Pas 1: Douglas-Peucker simplification (ε = 3m)              │
│    Redueix 200 punts → ~50-80 punts representatius            │
│                                                               │
│  Pas 2: Segmentació per confiança                             │
│    4 segments: live, recovered, low_confidence, stale         │
│                                                               │
│  Pas 3: Smoothing (Catmull-Rom spline)                        │
│    Interpola punts entre vèrtexs per corbes suaus             │
│                                                               │
│  Pas 4: Rendering                                             │
│    Live: solid blue (weight 4)                                │
│    Recovered: dashed amber (weight 3, dashArray 10,10)        │
│    Low-confidence: dotted gray (weight 2, dashArray 2,8)      │
│    Gap: no line (espai buit)                                  │
│                                                               │
│  Pas 5: Auto-pan intel·ligent                                 │
│    Només si nou punt és fora del viewport                     │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Algorismes Detalats

#### 6.2.1 Filtre Haversine + Teleportation (Plugin Java)

```java
private static final double MIN_DISTANCE_M = 25.0;
private static final double MAX_JUMP_M = 80.0;
private static final double MAX_SPEED_MS = 5.0;
private static final float MAX_ACCURACY_M = 50.0f;
private static final long MAX_FIX_AGE_MS = 10_000;

private LocationPoint lastAcceptedPoint = null;

private void addToBuffer(Location location) {
    if (location.getAccuracy() > MAX_ACCURACY_M) return;
    if (System.currentTimeMillis() - location.getTime() > MAX_FIX_AGE_MS) return;
    if (location.isMock()) return;

    double lat = location.getLatitude();
    double lng = location.getLongitude();

    if (lastAcceptedPoint != null) {
        double distance = haversine(
            lastAcceptedPoint.latitude, lastAcceptedPoint.longitude,
            lat, lng
        );
        long elapsed = /* timestamp diff in seconds */;

        if (distance < MIN_DISTANCE_M) return;
        if (distance > MAX_JUMP_M && elapsed < 5) return;

        double speed = distance / Math.max(elapsed, 1);
        if (speed > MAX_SPEED_MS) return;
    }

    LocationPoint point = new LocationPoint(lat, lng, timestamp, clientId);
    lastAcceptedPoint = point;
    buffer.add(point);
}
```

#### 6.2.2 Douglas-Peucker Simplification (Frontend TS)

```typescript
function douglasPeucker(
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
```

#### 6.2.3 Catmull-Rom Smoothing (Frontend TS)

```typescript
function catmullRomSpline(
  points: [number, number][],
  segments: number = 4
): [number, number][] {
  if (points.length < 2) return points;
  const result: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let t = 0; t < segments; t++) {
      const f = t / segments;
      const f2 = f * f;
      const f3 = f2 * f;

      const lat = 0.5 * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * f +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f3
      );
      const lng = 0.5 * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * f +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f3
      );
      result.push([lat, lng]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}
```

#### 6.2.4 Kalman Filter 1D (Plugin Java)

```java
public class KalmanFilter {
    private double q;
    private double r;
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
}

// Ús al plugin:
private KalmanFilter latFilter = new KalmanFilter(0.001, 0.01, 0);
private KalmanFilter lngFilter = new KalmanFilter(0.001, 0.01, 0);

// A addToBuffer(), després dels filtres:
double filteredLat = latFilter.filter(lat);
double filteredLng = lngFilter.filter(lng);
```

### 6.3 Segmentació Visual de 4 Nivells

```typescript
type ConfidenceLevel = "live" | "recovered" | "low_confidence" | "stale";

interface LocationSegment {
  coordinates: [number, number][];
  confidence: ConfidenceLevel;
}

function classifyConfidence(loc: LocationPayload): ConfidenceLevel {
  if (loc.is_recovered) return "recovered";
  if (loc.low_confidence) return "low_confidence";
  const age = Date.now() - new Date(loc.timestamp).getTime();
  if (age > 60_000) return "stale";
  return "live";
}
```

**Rendering per segment:**

| Confidence | Color | Pes | Estil | DashArray |
|---|---|---|---|---|
| `live` | `primary` (#1E3A8A) | 4 | Solid | — |
| `recovered` | `warning` (#F59E0B) | 3 | Dashed | `10, 10` |
| `low_confidence` | `foreground` + opacity 0.3 | 2 | Dotted | `2, 8` |
| `stale` | `foreground` + opacity 0.15 | 2 | Dashed | `5, 15` |

### 6.4 Auto-Pan Intel·ligent

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

## 7. PLA D'IMPLEMENTACIÓ PRIORITZAT

### FASE 1 — P0 (Crítics, qualitat visual immediata)

**Objectiu:** Eliminar zigzags, salts impossibles i punts de baixa qualitat.

| # | Troballa | Acció | Fitxers afectats |
|---|---|---|---|
| 1.1 | **G1** — Pujar min distance a 15m + Haversine 25m | `setMinUpdateDistanceMeters(15)`, afegir Haversine 25m a `addToBuffer()` | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 1.2 | **G2** — Filtre d'accuracy (50m) | `addToBuffer()`: `if (location.getAccuracy() > 50f) return;` | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 1.3 | **G3** — Detecció de teleportació (80m) | `addToBuffer()`: Haversine > 80m amb elapsed < 5s → descartar | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 1.4 | **G14** — Douglas-Peucker al mapa | Aplicar DP (ε=3m) abans de crear polyline | `frontend/components/CaregiverMap/MapRenderer.tsx` |

### FASE 2 — P1 (Validació i segmentació)

**Objectiu:** Validar speed, heading, fix age. Segmentar visualment per confiança.

| # | Troballa | Acció | Fitxers afectats |
|---|---|---|---|
| 2.1 | **G4** — Filtre de speed (5 m/s) | `addToBuffer()`: calcular speed = haversine/dt, descartar si >5 m/s | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 2.2 | **G5** — Filtre d'edat del fix (10s) | `addToBuffer()`: `System.currentTimeMillis() - getTime() > 10000` → descartar | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 2.3 | **G6** — Filtre de heading (90°) | `addToBuffer()`: comparar bearing amb direcció de moviment | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 2.4 | **G9** — Validació rang coordenades | `location_service.py`: validar `-90 <= lat <= 90` | `backend/app/services/location_service.py` |
| 2.5 | **G12** — WalkEventProcessor validació | Speed check abans d'`appendLocation()` | `frontend/lib/WalkEventProcessor.ts` |
| 2.6 | **G15** — 4 segments visuals | `classifyConfidence()` + 4 estils de polyline | `frontend/components/CaregiverMap/MapRenderer.tsx` |

### FASE 3 — P2 (Qualitat avançada)

**Objectiu:** Kalman Filter, metadata de qualitat a DB, smoothing visual, auto-pan intel·ligent.

| # | Troballa | Acció | Fitxers afectats |
|---|---|---|---|
| 3.1 | **G7** — Kalman Filter | Nova classe `KalmanFilter.java`, integrar a `addToBuffer()` | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java`, nova classe `KalmanFilter.java` |
| 3.2 | **G8** — Mock location gate | `addToBuffer()`: `if (location.isMock()) return;` | `frontend/plugins/location-sync/android/.../LocationSyncForegroundService.java` |
| 3.3 | **G10** — Backend teleportation check (soft) | `save_batch()`: si haversine > 100m, marcar `low_confidence` | `backend/app/services/location_service.py` |
| 3.4 | **G11** — Columnes `speed_ms` i `accuracy_m` | Model `Location`: afegir columnes, calcular a `save_batch()` | `backend/app/db/models/location.py`, `backend/app/services/location_service.py`, DB migration |
| 3.5 | **G13** — Gap detection al frontend | Si dt > 120s, inserir gap marker | `frontend/lib/WalkEventProcessor.ts` |
| 3.6 | **G16** — Catmull-Rom smoothing | Interpolació de punts per corbes suaus després de Douglas-Peucker | `frontend/components/CaregiverMap/MapRenderer.tsx` |
| 3.7 | **G17** — Auto-pan intel·ligent | Bounds check abans de `flyTo()` | `frontend/components/CaregiverMap/MapRenderer.tsx` |

---

## 8. DEPENDENCIES ENTRE FASES

```
Fase 1 (P0)
  └── G1 (Min distance + Haversine) → independent
  └── G2 (Accuracy filter) → independent
  └── G3 (Teleportation detection) → independent
  └── G14 (Douglas-Peucker) → independent

Fase 2 (P1)
  └── G4 (Speed filter) → dependent de G3 (usa haversine/dt)
  └── G5 (Fix age filter) → independent
  └── G6 (Heading filter) → dependent de G3 (usa direcció)
  └── G9 (Backend range validation) → independent
  └── G12 (WalkEventProcessor validation) → independent
  └── G15 (4 segments visuals) → dependent de G10 (low_confidence flag)

Fase 3 (P2)
  └── G7 (Kalman Filter) → dependent de G1-G3 (filtra després de gates)
  └── G8 (Mock gate) → independent
  └── G10 (Backend teleportation soft) → independent
  └── G11 (speed_ms, accuracy_m columns) → dependent de G4 (calcula speed)
  └── G13 (Gap detection) → independent
  └── G16 (Catmull-Rom smoothing) → dependent de G14 (Douglas-Peucker primer)
  └── G17 (Auto-pan intel·ligent) → independent
```

---

## 9. ESTIMACIÓ D'ESFORÇ TOTAL

| Fase | Troballes | Esforç estimat |
|---|---|---|
| Fase 1 (P0) | 4 | 2-3 dies |
| Fase 2 (P1) | 6 | 3-4 dies |
| Fase 3 (P2) | 7 | 4-5 dies |
| **Total** | **17** | **9-12 dies** |

---

## 10. MÈTRIQUES D'ÈXIT

Després d'implementar totes les fases:

| Mètrica | Actual | Objectiu |
|---|---|---|
| Zigzags per jitter (visual) | **Sempre** (100% de punts) | **<5%** (Douglas-Peucker + Haversine) |
| Salts de >50m a la ruta | **Freqüents** (urban canyons) | **0%** (teleportation detection) |
| Punts amb accuracy >50m al mapa | **Tots** (sense filtre) | **0%** (accuracy gate) |
| Ruta visualment suau | **No** (línies rectes) | **Sí** (Catmull-Rom spline) |
| Segmentació per confiança | 2 nivells (live/recovered) | 4 nivells (live/recovered/low_confidence/stale) |
| Punts duplicats/desordenats al mapa | **Freqüents** (F5, F9) | **0%** (ordenació + deduplicació) |
| Auto-pan innecessari | **Sempre** (cada punt) | **Només fora viewport** |
| Velocitat màxima entre punts | Sense límit | **<5 m/s** (18 km/h) |
| Temps de renderitzat (200 punts) | ~100ms | <50ms (Douglas-Peucker redueix a ~60 vèrtexs) |

---

## 11. COM RECONSTRUIR UNA RUTA FIABLE (RESUM EXECUTIU)

### Pas 1: Captura neta (Plugin)
- FusedLocationProvider amb min distance 15m
- 7 filtres successius: accuracy, fix age, mock, Haversine, teleportation, speed, heading
- Cada punt acceptat té confiança alta

### Pas 2: Emmagatzematge amb metadata (Backend)
- Validació de rang de coordenades
- Càlcul de speed_ms i accuracy_m
- Detecció soft de teleportació (marca `low_confidence`)
- Ordenació per timestamp abans de broadcast

### Pas 3: Processament al frontend (WalkEventProcessor)
- Validació de speed entre punts consecutius
- Detecció de gaps temporals (>120s)
- Inserció ordenada (no rebutjar punts vàlids)

### Pas 4: Rendering intel·ligent (MapRenderer)
- Douglas-Peucker per simplificar (ε=3m)
- Segmentació per 4 nivells de confiança
- Catmull-Rom per suavitzar corbes
- Auto-pan només quan el punt surt del viewport

### Resultat:
Una ruta que **reflecteix el recorregut real**, sense zigzags, sense salts, amb indicació visual de quins trams són fiables i quins no.

---

*Document generat per auditoria de GPS, mapa i qualitat de ruta PathGuard. Versió 1.0 — 2026-06-04.*
