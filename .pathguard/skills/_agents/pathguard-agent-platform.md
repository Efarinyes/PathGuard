---
name: pathguard-agent-platform
description: |
  Rol: Agent Platform Integration. Propietari transversal de la
  coherència entre PWA, Android i iOS. L'única excepció a la
  regla "1 domini per agent". Carregar quan una tasca afecta
  el bridge TS, capacitor.config, o múltiples capes natives.
triggers:
  - Canvis a frontend/plugins/location-sync/src/index.ts
  - Canvis a capacitor.config.ts / capacitor.config.json
  - Constants compartides (GPS intervals, URLs, ports)
  - Refactor de useLocationTracking, useOfflineRecovery
  - Coordinació cross-platform
agent_owner: platform-integration
prerequisites:
  - pathguard-state
  - pathguard-golden-rules
---

# Agent Platform Integration (transversal)

## Propietat (EXCEPCIONAL — toca 2 dominis)

Aquest agent és l'**única excepció** a la regla d'1 domini per agent. Pot tocar:

```
frontend/plugins/location-sync/src/index.ts   (contracte TS del bridge)
frontend/capacitor.config.ts                   (config Capacitor)
frontend/ios/App/App/capacitor.config.json     (config iOS)
frontend/lib/config.ts                         (constants compartides)
frontend/hooks/useLocationTracking.ts          (refactor 1 mode)
frontend/hooks/useOfflineRecovery.ts           (guards d'estat)
```

## Propietat (READ-ONLY — pot consultar per coordinar)

- `frontend/plugins/location-sync/android/` (el Agent Android implementa)
- `frontend/plugins/location-sync/ios/` (l'Agent iOS implementa)
- `backend/app/api/routers/locations.py` (l'Agent Backend proveeix)
- `frontend/hooks/useAppState.tsx` (l'Agent Frontend manté)

## Responsabilitats

### 1. Contracte del bridge (TS)
Defineix la signatura TypeScript:

```typescript
// frontend/plugins/location-sync/src/index.ts
export interface LocationSyncPlugin {
  startTracking(options: StartTrackingOptions): Promise<void>;
  stopTracking(): Promise<void>;
  updateWalkId(options: { walkId: number }): Promise<void>;
  getStatus(): Promise<TrackingStatus>;
  markBackgrounded(): Promise<void>;
  markForegrounded(): Promise<void>;
}
```

Aquesta signatura és **IMMUTABLE** excepte canvis coordinats amb tots dos agents nadius.

### 2. Constants compartides
Tots els intervals, ports, URLs compartits viuen a `frontend/lib/config.ts`:

```typescript
export const GPS_MIN_DISTANCE_M = 15;
export const GPS_INTERVAL_NORMAL_MS = 15_000;
export const GPS_INTERVAL_FAST_MS = 5_000;
export const GPS_INTERVAL_IDLE_MS = 30 * 60 * 1_000;  // 30 min
export const GPS_SPEED_IDLE_THRESHOLD_M_MIN = 20;
export const GPS_TIMEOUT_MS = 30_000;
export const GPS_RETRY_DELAY_MS = 5_000;
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
```

**Els agents natius** (Android/iOS) han d'obtenir aquestes constants via bridge, NO hardcoded.

### 3. Configuració Capacitor
- `capacitor.config.ts` (TS, font única)
- `capacitor.config.json` (iOS, generat per `npx cap sync`)
- **Cap hardcoded URL** — env vars + capacitor config
- `webDir: 'public'` (no `out`)

### 4. Permisos (coordinació)
**Decisió d'auditoria:** un sol lloc demana permisos. Per defecte: **plugin natiu** (LocationSync). Frontend NO demana location permission (ja ho fa el plugin).

Llevat `@capacitor/geolocation` (que NO s'ha d'usar quan hi ha plugin).

### 5. Patrons d'integració
- `useLocationTracking` → **1 mode** (plugin si natiu, browser si no)
- `useOfflineRecovery` → **guards d'estat** (no cridar si no hi ha tracking)
- Persistència de tokens → `Capacitor Preferences` (no `localStorage` en natiu)

## Coordinació

Quan una tasca toca múltiples capes:

1. **Tu redactes l'espec** d'integració a `specs/integration-SPEC-NNN-...md`
2. **Tu proposes la interfície** (signatura TS, constants, config)
3. **Tu lliures el contracte** als agents natius (Android, iOS) i al Frontend
4. **Cada agent implementa la seva part** seguint el contracte
5. **QA valida** que totes les parts funcionen juntes

## Errors comuns

❌ Modificar el contracte TS sense coordinar amb agents nadius
❌ Permetre que cada agent natiu tingui constants GPS hardcoded
❌ Permetre doble font de GPS (plugin + Geolocation)
❌ Hardcoded URLs a capacitor.config
❌ Deixar `@capacitor/geolocation` com a fallback "per si de cas"

## Decisions documentades (ADRs)

| ADR | Tema |
|---|---|
| 0002 | Capacitor over React Native (PWA + nadiu) |
| 0003 | Capacitor Swift PM (no CocoaPods) |
| (pendent) | 1 font de GPS (plugin only) |
| (pendent) | Permisos centralitzats al plugin |
| (pendent) | Tokens a Capacitor Preferences |

## Recursos

- `.pathguard/skills/_domain/pathguard-bridge-contract.md` (detall TS bridge)
- `.pathguard/skills/_domain/pathguard-capacitor-config.md` (config patterns)
- `.pathguard/skills/_agents/pathguard-agent-android.md` (coordinació Android)
- `.pathguard/skills/_agents/pathguard-agent-ios.md` (coordinació iOS)
- `.pathguard/skills/_agents/pathguard-agent-frontend.md` (coordinació PWA)
