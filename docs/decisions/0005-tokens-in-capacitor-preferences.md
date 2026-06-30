# ADR-0005: Tokens a Capacitor Preferences (no localStorage)

## Status

`proposed` — pendent sign-off Tech Lead (SPEC-030)

## Context

`useAppState.tsx` emmagatzema tokens a `localStorage`:

```typescript
localStorage.setItem(STORAGE_KEYS.USER_TOKEN, userToken);
localStorage.setItem(STORAGE_KEYS.DEVICE_TOKEN, deviceToken);
```

En natiu (iOS/Android), `localStorage`:
- No és segur (pot ser llegit per altres apps amb jailbreak)
- No està sandboxed correctament
- No encripta

Per a una app de seguiment de persones, el `device_token` ha d'estar protegit.

## Decision

Adoptem **Capacitor Preferences** per emmagatzemar tokens en natiu:

- **Web (PWA):** `localStorage` (acceptable per web)
- **Natiu (iOS/Android):** `Capacitor Preferences` (backend: Keychain iOS / EncryptedSharedPreferences Android)

```typescript
import { Preferences } from '@capacitor/preferences';

const isNative = Capacitor.isNativePlatform();

if (isNative) {
  await Preferences.set({ key: 'device_token', value: token });
} else {
  localStorage.setItem('device_token', token);
}
```

## Alternatives considerades

### A. **localStorage sempre** (actual)
- ✅ Simple
- ❌ No segur en natiu
- ❌ No encriptat
- ❌ No sandboxed

### B. **Capacitor Preferences sempre** (escollida)
- ✅ Segur en natiu
- ✅ Encriptat (Keychain/EncryptedSharedPreferences)
- ✅ Sandboxed
- ⚠️ Cal gestionar web vs natiu

### C. Només Keychain (iOS) + EncryptedSharedPreferences (Android)
- ✅ Màxima seguretat
- ❌ Dues implementacions
- ❌ Sense cross-platform API

## Consequences

### Positives
- **Seguretat:** tokens encriptats en natiu
- **Sandbox:** no accessibles per altres apps
- **Cross-platform:** API unificada via Capacitor
- **Web backward compatible:** segueix usant `localStorage`

### Negatives
- Cal afegir `@capacitor/preferences` (nova dep)
- Codi lleugerament més complex (branch isNative)
- Si usuari canvia de web a natiu, cal re-autenticar (acceptable)

### Mitigacions
- Helper `tokenStore` amb API unificada
- Tests per ambdós camins
- Documentació clara

## Implementation

- `frontend/hooks/useAppState.tsx` — refactor a `tokenStore`
- `frontend/lib/tokenStore.ts` (nou) — abstracció cross-platform
- `frontend/package.json` — afegir `@capacitor/preferences`

## References

- SPEC-030 (Revocació de device_token)
- `audit_native_layer.md` secció 4 (R-P0-4)
- [Capacitor Preferences docs](https://capacitorjs.com/docs/apis/preferences)
