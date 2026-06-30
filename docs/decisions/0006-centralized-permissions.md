# ADR-0006: Permisos centralitzats al plugin (no al frontend)

## Status

`proposed` — pendent sign-off Tech Lead (SPEC-020.6)

## Context

Actualment, els permisos de location es demanen en 2 llocs:

1. **Plugin `LocationSync`** (`LocationAcquirer.java/swift`):
   ```java
   if (!hasFine) call.reject("Permís d'ubicació no concedit");
   ```

2. **Frontend** (`useLocationTracking.ts`):
   ```typescript
   const permResult = await Geolocation.checkPermissions();
   if (permResult.location === "denied") {
     await Geolocation.requestPermissions();
   }
   ```

Això causa:
- **Doble petició** a l'usuari (UX pobra)
- **Inconsistència** (un pot permetre, l'altre no)
- **Acoblament** entre 2 sistemes

## Decision

Adoptem **1 sol punt de petició**:

- **Plugin `LocationSync`:** única font que demana permissions
- **Frontend:** NO demana permissions (delega al plugin)
- **Permisos centralitzats al `LocationAcquirer`**

```typescript
// Frontend: NO permissions
const isNative = Capacitor.isNativePlatform();
if (isNative) {
  // Plugin gestiona permisos internament
  await LocationSync.startTracking(...);
}
```

```swift
// iOS plugin: gestiona permisos
manager.requestWhenInUseAuthorization()
// → eventualment requestAlwaysAuthorization
```

## Alternatives considerades

### A. **Permisos al frontend** (status quo parcial)
- ✅ Control des del UI
- ❌ Doble petició
- ❌ Acoblament

### B. **Permisos al plugin only** (escollida)
- ✅ 1 sola petició
- ✅ Coherència
- ✅ Plugin és la font canònica
- ❌ UI no pot prevenir l'error abans

### C. Permisos compartits amb cache
- ✅ Flexibilitat
- ❌ Complexitat
- ❌ Risc d'inconsistència

## Consequences

### Positives
- **1 sola petició** a l'usuari
- **Coherència** entre capes
- **Més simple** — el plugin és l'únic responsable
- **Millor UX** — l'usuari no veu doble prompt

### Negatives
- UI no pot mostrar "anar a settings" si denegat
- Cal gestionar errors del plugin robustament

### Mitigacions
- `LocationSync.startTracking` retorna error amb codi (`permission_denied`)
- UI mostra error clar i enllaç a settings
- Documentació al skill `pathguard-domain-bridge-contract.md`

## Implementation

- `frontend/hooks/useLocationTracking.ts` — eliminar `Geolocation.requestPermissions`
- `frontend/plugins/location-sync/ios/Plugin/LocationAcquirer.swift` — gestionar permisos centralitzadament
- `frontend/plugins/location-sync/android/src/main/java/com/pathguard/app/plugin/LocationSyncPlugin.java` — igual

## References

- SPEC-020 (Consolidar captura GPS), subtask 020.6
- `audit_native_layer.md` secció 6 (R-P0-5)
- `.opencode/skills/pathguard-domain-bridge-contract/SKILL.md`
