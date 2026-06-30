---
name: pathguard-bridge-contract
description: |
  Contracte TypeScript del bridge Capacitor LocationSync. La
  signatura és IMMUTABLE excepte canvis coordinats amb tots
  els agents nadius. Carregar abans de qualsevol canvi al
  bridge o als plugins nadius.
metadata:
  triggers:
    - Modificar frontend/plugins/location-sync/src/index.ts
    - Afegir mètode al plugin (iOS, Android)
    - Modificar capacitor.config
    - Resoldre conflicte de signatura
  agent_owner: platform-integration
  prerequisites:
    - pathguard-agent-platform
---

# Bridge Contract — LocationSync Plugin

## Signatura canònica (TS)

`frontend/plugins/location-sync/src/index.ts`:

```typescript
import { registerPlugin } from '@capacitor/core';

export interface StartTrackingOptions {
  serverUrl: string;
  deviceToken: string;
  walkId: number;
}

export interface TrackingStatus {
  isTracking: boolean;
  pointsSent: number;
  lastSentAt: string | null;
}

export interface LocationSyncPlugin {
  startTracking(options: StartTrackingOptions): Promise<void>;
  stopTracking(): Promise<void>;
  updateWalkId(options: { walkId: number }): Promise<void>;
  getStatus(): Promise<TrackingStatus>;
  markBackgrounded(): Promise<void>;
  markForegrounded(): Promise<void>;
}

const LocationSync = registerPlugin<LocationSyncPlugin>('LocationSync');
export default LocationSync;
export { LocationSync };
```

## Implementacions

| Plataforma | Fitxer | Llenguatge |
|---|---|---|
| TS (font) | `frontend/plugins/location-sync/src/index.ts` | TypeScript |
| Android | `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncPlugin.java` | Java |
| iOS | `frontend/plugins/location-sync/ios/Plugin/LocationSyncPlugin.swift` | Swift |

**Tots tres han de ser coherents.** Canvis d'implementació interna, sí. Canvis de signatura, requereixen PR coordinat.

## Models de dades compartits

### `LocationPoint` (natiu)

```typescript
// Serialitzat a JSON per HTTP
interface LocationPointJSON {
  latitude: number;
  longitude: number;
  timestamp: string;      // ISO8601 with timezone
  client_id: string;      // SHA-256 hex (64 chars)
  walk_id: number;
  is_recovered: boolean;
}
```

**Backend rep:** `points: LocationPointJSON[]` a `POST /locations/batch`

### Constants GPS (compartides via bridge)

```typescript
// frontend/lib/config.ts
export const GPS_MIN_DISTANCE_M = 15;
export const GPS_INTERVAL_NORMAL_MS = 15_000;
export const GPS_INTERVAL_FAST_MS = 5_000;
export const GPS_INTERVAL_IDLE_MS = 30 * 60 * 1_000;  // 30 min
export const GPS_TIMEOUT_MS = 30_000;
export const GPS_RETRY_DELAY_MS = 5_000;
export const GPS_SPEED_IDLE_THRESHOLD_M_MIN = 20;
```

**Els agents natius** reben aquestes constants via bridge arguments (no hardcoded).

## Errors

| Error | Quan | Tipus |
|---|---|---|
| Permís denegat | Location permission `denied` | `LocationPermissionError` |
| Servi ja iniciat | `startTracking` quan `isRunning` | No-op (no error) |
| Walk invàlid | `updateWalkId` amb `walkId=0` | `InvalidWalkIdError` |
| Network fail | HTTP `sendBatch` fails | `LocationSyncNetworkError` |

**Conventions:**
- `call.reject("message")` (Capacitor) → `Error` al TS
- Mai retornar codis numèrics d'error — sempre missatges

## Capacitor registration

`frontend/ios/App/App/capacitor.config.json`:

```json
{
  "packageClassList": [
    "GeolocationPlugin",
    "LocationSyncPlugin"
  ]
}
```

⚠️ **`GeolocationPlugin` és legacy.** Quan `LocationSyncPlugin` estigui madur, eliminar.

## Versioning

Si la signatura canvia, semver:

- **MAJOR** — canvis incompatibles (afegir paràmetre requerit, eliminar mètode)
- **MINOR** — afegir mètode opcional
- **PATCH** — correccions internes

Canvis majors requereixen coordinació entre 3+ agents (TS, Android, iOS).

## Tests del contracte

| Test | On | Què valida |
|---|---|---|
| TS types | `frontend/tests/integration/` | Signatura TypeScript |
| Capacitor mock | `frontend/tests/integration/location-sync.test.ts` | Comportament del bridge mock |
| Android JUnit | (pendent — deute tècnic) | Implementació Java |
| iOS XCTest | (pendent — deute tècnic) | Implementació Swift |

## Coordinació multi-capa

Quan un agent vol afegir/modificar el contracte:

1. **Redactar integration spec** a `specs/integration-SPEC-NNN-...md`
2. **Definir canvis** a la interfície TS
3. **Coordinar amb Android i iOS** per implementar
4. **Validar amb tests** (tipus + mock + integration)
5. **QA sign-off** abans de merge

Cap agent pot tocar el TS del bridge unilateralment. Sempre via Platform Integration.
