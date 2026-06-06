# GPS / Map Quality Issues — Anàlisi i Pla per BETA 2

**Data:** 2026-06-06  
**Estat:** Document de referència per implementació futura (BETA 2)  
**Font:** Observació en prova real (06/06/2026) + auditories existents

---

## 1. Resum del problema observat

Durant el passeig de prova (06/06/2026), el mapa del caregiver (`/caregiver`) mostrava:

| Símptoma visual | Descripció |
|-----------------|------------|
| **Angles bruscos / zigzags** | La ruta blava (temps real) forma angles de 90° on l'usuari ha girat suau |
| **Segment aïllat** | Un fragment blau desconectat a prop de Carrer de les Set Partides |
| **Segments taronges dispersos** | Línies discontinues paral·leles, solapades o sense continuïtat amb la ruta principal |
| **Cap indicador de direcció** | Impossible saber cap on camina el familiar (fletxa/heading) |
| **Punts "orphan"** | Fragments curts sense connexió temporal/espacial clara |

---

## 2. Causes arrel identificades

### 2.1 Frontend / Rendering (Impacte visual immediat)

| Causa | Fitxer | Línies | Severitat |
|-------|--------|--------|-----------|
| Douglas-Peucker **només als segments `!is_recovered`** (blaus) | `MapRenderer.tsx` | 117-119 | **Alta** |
| Epsilon DP **fix (0.00003 ≈ 3.3m)** per tots els casos | `MapRenderer.tsx` | 129 | **Alta** |
| **Zero suavitzat** post-DP (Catmull-Rom / Chaikin) | `MapRenderer.tsx` | — | Mitjana |
| Jitter threshold web **4m** (Android natiu: 25m) | `trajectoryService.ts` | 14 | Mitjana |
| `segmentLocations` **no ordena per timestamp** dins segment | `MapRenderer.tsx` | 85-105 | Alta |

### 2.2 Pipeline GPS / Dades (Causa arrel dades)

| Causa | Ubicació | Severitat |
|-------|----------|-----------|
| **Doble tracking possible** (Android natiu + PWA simultanis) | `useLocationTracking.ts` | Alta |
| `client_id` **algorismes diferents** Android (SHA-256) vs Web (`generateLocationId`) | `LocationAcquirer.java` / `locationId.ts` | Alta |
| Android filtra jitter (25m), Web no (4m) → **duplicats amb coords diferents** | `LocationAcquirer.java` / `trajectoryService.ts` | Alta |
| `segmentLocations` agrupa per `is_recovered` consecutiu, **no per temps** | `MapRenderer.tsx` | Alta |

### 2.3 Backend / Sync (Contribueix a desordre)

| Causa | Fitxer | Severitat |
|-------|--------|-----------|
| `save_batch()` ordena per timestamp **abans de broadcast** ✅ (ja fixat) | `location_service.py` | — |
| `WalkEventProcessor` rebutja punts fora d'ordre en lloc d'inserir | `WalkEventProcessor.ts` | Mitjana |

---

## 3. Solucions proposades (Prioritzades)

### P0 — Crítics (Impacte visual immediat, esforç baix)

| # | Acció | Fitxer | Canvi |
|---|-------|--------|-------|
| 1 | **Aplicar DP a TOTS els segments** (eliminar `if isRecovered`) | `MapRenderer.tsx` | Línia 117-119: `coordinates: douglasPeucker(seg.coordinates, epsilon)` |
| 2 | **Epsilon DP adaptatiu** segons densitat de punts | `MapRenderer.tsx` | Línia 129: `epsilon = calculateAdaptiveEpsilon(points.length)` |
| 3 | **Ordenar per timestamp** dins `segmentLocations` abans d'agrupar | `MapRenderer.tsx` | Línies 85-105: `validLocations.sort((a,b) => time(a) - time(b))` |

### P1 — Qualitat dades (Neteja font, esforç mitjà)

| # | Acció | Fitxer | Canvi |
|---|-------|--------|-------|
| 4 | **Unificar `client_id`**: Android adopta algorisme Web | `LocationAcquirer.java` / `locationId.ts` | Canviar `generateClientId()` Android a SHA-256 `timestamp:lat:lng:walkId` |
| 5 | **Pujar jitter threshold web** 4m → 8-10m (paritat acceptabla) | `trajectoryService.ts` | Línia 14: `JITTER_THRESHOLD_M = 8` |
| 6 | **Guard anti-doble-tracking**: flag `isTrackingNative` a `useAppState` | `useLocationTracking.ts` / `useAppState.tsx` | Check abans de `LocationSync.startTracking()` |
| 7 | **Validar gaps temporals** > 5min = nou segment a `segmentLocations` | `MapRenderer.tsx` | Línies 85-105 |

### P2 — Millora visual (Suavitzat estètic, esforç mitjà)

| # | Acció | Fitxer | Notes |
|---|-------|--------|-------|
| 8 | **Catmull-Rom smoothing** opcional post-DP (només visual) | Nou `trajectoryService.smoothTrajectory()` | Zero dependències, ~50 línies |
| 9 | **Marcador direccional** (fletxa rotativa bearing darrers 2 punts) | `CustomIcons.ts` | Nou `DirectionalPulseDotIcon` |
| 10 | **4 segments visuals**: live / recovered / low_confidence / stale | `MapRenderer.tsx` | Requereix `low_confidence` flag al backend |

### P3 — Arquitectura (Prevenció futures)

| # | Acció | Fitxer | Notes |
|---|-------|--------|-------|
| 11 | Log structured punts rebudes (origen, is_recovered, client_id) | `locationService.ts` / backend | Per debugging futur |
| 12 | Migrar backend a `INSERT ON CONFLICT DO NOTHING` (idempotència real) | `location_service.py` | Ja proposat a `auditoria-recuperacio-cobertura.md` |

---

## 4. Implementació immediata (NOMÉS per BETA actual)

**Objectiu:** Només el que cal per provar demà — **Indicador de direcció (P2.9)**

```typescript
// CustomIcons.ts - Nou DirectionalPulseDotIcon
export const DirectionalPulseDotIcon = (bearing: number) => L.divIcon({
  className: 'custom-map-icon',
  html: `
    <div style="transform: rotate(${bearing}deg); ...">
      <!-- fletxa + cercle pulse -->
    </div>
  `,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// MapRenderer.tsx - Calcular bearing
const bearing = allCoordinates.length >= 2
  ? calculateBearing(allCoordinates[allCoordinates.length - 2], currentPosition)
  : 0;

// Renderitzar
<Marker position={currentPosition} icon={DirectionalPulseDotIcon(bearing)} />
```

**Cost:** ~30 min. **Zero canvis a pipeline de dades.**

---

## 5. Referències a documents existents

| Document | Què aporta |
|----------|------------|
| `docs/auditoria-gps-mapa-qualitat.md` | Anàlisi exhaustiva 17 troballes (G1-G17), pipeline 5 capes, codi Java/TS llest |
| `docs/auditoria-pipeline-localitzacio.md` | 18 troballes pipeline (F1-F18), fases P0-P3, dependències |
| `docs/auditoria-recuperacio-cobertura.md` | 9 defectes sync (S1-S9), arquitectura WAL proposada |
| `docs/action-plan.md` | Pla mestre, fases completades/pendents, criteris èxit |

---

## 6. Decisions pendents (per discutir abans de BETA 2)

| # | Decisió | Opcions | Recomanació |
|---|---------|---------|-------------|
| 1 | Epsilon DP | Adaptatiu automàtic vs per mode (idle/normal/fast) | **Adaptatiu** (zero manteniment) |
| 2 | Suavitzat Catmull-Rom | Sí (estètic) vs No (DP+epsilon suficient) | **Primer adaptatiu, després decideix** |
| 3 | `client_id` unificat | Android → Web (sense migració BD) vs Web → Android (més robust) | **Android adopta Web** (pràctic, avui) |
| 4 | Doble tracking | Flag `isTrackingNative` a `useAppState` | **Sí, 10 línies, prevenció total** |

---

## 7. Mètriques d'èxit BETA 2 (post-implementació)

| Mètrica | Actual | Objectiu BETA 2 |
|---------|--------|-----------------|
| Zigzags visuals (jitter) | 100% punts | <5% (DP adaptatiu + Haversine) |
| Salts >50m (teleportació) | Freqüents | 0% (detecció 80m/5s) |
| Segments aïllats / orphans | Varis | 0% (ordenació temporal + gap detection) |
| Duplicats taronges/blaus | Freqüents | 0% (`client_id` unificat + jitter aligned) |
| Direcció visible | No | Sí (fletxa rotativa) |
| Segmentació per confiança | 2 nivells | 4 nivells (live/recovered/low/stale) |

---

*Document generat per planificació BETA 2. Basat en observació real 06/06/2026 + auditories 04/06/2026.*
