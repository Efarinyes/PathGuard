# ADR-0004: Única font de GPS (plugin natiu only)

## Status

`proposed` — pendent sign-off Tech Lead (SPEC-020)

## Context

Actualment `useLocationTracking` té 2 modes:

```typescript
if (isNative && trackingConfig) {
  await LocationSync.startTracking(...);  // Plugin
} else {
  // Fallback: Geolocation.watchPosition() o navigator.geolocation
}
```

Això causa:
- **Duplicats potencials** (si ambdós s'activen per error)
- **Comportament inconsistent** (Android/iOS vs web)
- **Crides `clearWatch` amb ID invàlid** (`"location-sync"` no és un ID real)

`@capacitor/geolocation` està instal·lat però no és la font canònica.

## Decision

Adoptem **1 sola font de GPS**:

- **Si natiu:** `LocationSync` plugin (única font)
- **Si web:** `navigator.geolocation` (browser API directa)
- **Mai** `@capacitor/geolocation` quan hi ha plugin

```typescript
const isNative = Capacitor.isNativePlatform();

if (isNative) {
  // ONLY: LocationSync plugin
  await LocationSync.startTracking(...);
} else {
  // ONLY: navigator.geolocation
  const id = navigator.geolocation.watchPosition(...);
}
```

A més, **centralitzar permisos** al plugin (no al frontend).

## Alternatives considerades

### A. **Doble sistema amb fallback** (actual)
- ✅ Flexibilitat
- ❌ Duplicats
- ❌ Inconsistència
- ❌ Complexitat

### B. **1 sola font, plugin only** (escollida)
- ✅ Zero duplicats
- ✅ Comportament uniforme
- ✅ Codi simple
- ❌ Si el plugin falla, no hi ha fallback
- ⚠️ Cal gestionar errors de plugin

### C. Plugin + web, però coordinar
- ✅ Flexibilitat
- ❌ Complexitat de coordinació
- ❌ Mateixos riscos que A

## Consequences

### Positives
- **Zero duplicats** — 1 font, 1 watcher
- **Comportament uniforme** Android/iOS
- **Codi simple** — 1 mode, no 2
- **Permisos centralitzats** — 1 sol punt de petició
- **Tests simples** — 1 mode a testejar

### Negatives
- Si el plugin falla, no hi ha fallback
- Cal gestionar errors de plugin robustament

### Mitigacions
- Tests XCTest + JUnit per detectar falles de plugin
- Fallback UI: si plugin falla, mostrar error clar
- Telemetria per monitoritzar falles
- SPEC-020 inclou subtask 020.7 (eliminar `@capacitor/geolocation`)

## Implementation

- `frontend/hooks/useLocationTracking.ts` — refactor a 1 mode
- `frontend/hooks/useOfflineRecovery.ts` — guards d'estat
- `frontend/plugins/location-sync/src/index.ts` — contracte estable
- `frontend/capacitor.config.ts` — config centralitzada

## References

- SPEC-020 (Consolidar captura GPS)
- `audit_native_layer.md` secció 3 (R-P0-3)
- `.pathguard/skills/_domain/pathguard-bridge-contract.md`
