---
name: pathguard-capacitor-config
description: |
  Configuració Capacitor (capacitor.config.ts, capacitor.config.json).
  Carregar quan es modifica la config nativa, URLs, plugins
  o webDir.
metadata:
  triggers:
    - Modificar capacitor.config.ts
    - Modificar frontend/ios/App/App/capacitor.config.json
    - Afegir plugin
    - Canviar appId o appName
  agent_owner: platform-integration
  prerequisites:
    - pathguard-agent-platform
---

# Capacitor Config

## Fitxers de configuració

| Fitxer | Plataforma | Font |
|---|---|---|
| `frontend/capacitor.config.ts` | Totes | **Font única (TS)** |
| `frontend/ios/App/App/capacitor.config.json` | iOS | Generat per `npx cap sync` |
| `frontend/android/app/src/main/assets/capacitor.config.json` | Android | Generat per `npx cap sync` |

**Regla:** editar sempre `capacitor.config.ts`. Els altres es regeneren.

## Configuració actual

```typescript
// frontend/capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pathguard.app',
  appName: 'PathGuard',
  webDir: 'public',                    // ⚠️ 'public' no 'out' (Next.js)
  server: {
    url: 'https://path-guard-orpin.vercel.app',
    cleartext: false,                  // HTTPS only
  },
};

export default config;
```

## Regles

### 1. **Mai** URLs hardcoded per entorn
La URL del servidor ha de ser parametritzable:

```typescript
const config: CapacitorConfig = {
  appId: 'com.pathguard.app',
  appName: 'PathGuard',
  webDir: 'public',
  server: {
    url: process.env.NEXT_PUBLIC_API_URL || 'https://path-guard-orpin.vercel.app',
    cleartext: false,
  },
};
```

### 2. `webDir: 'public'` (no `out`)
Next.js exporta a `public/` quan es fa `next build` amb PWA. **No canviar.**

### 3. `cleartext: false` en producció
HTTP només en dev. Si cal testing local, crear config dev.

### 4. `appId: 'com.pathguard.app'`
Ha de coincidir amb:
- Bundle ID iOS (`frontend/ios/App/App.xcodeproj/...`)
- Package name Android (`frontend/android/app/build.gradle`)

Canvis triguen: rebuild app + re-submit a stores.

### 5. Plugin registration

```json
// frontend/ios/App/App/capacitor.config.json
{
  "packageClassList": [
    "GeolocationPlugin",
    "LocationSyncPlugin"
  ]
}
```

⚠️ **`GeolocationPlugin` legacy** — eliminar quan `LocationSyncPlugin` sigui estable.

## Permisos (iOS Info.plist)

```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>PathGuard necessita el teu permís per compartir la teva ubicació amb el cuidador, fins i tot quan l'app està en segon pla.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>PathGuard necessita accés a la ubicació per mostrar la ruta del passeig.</string>
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
</array>
```

**Coordinat per:** Agent iOS. **Validat per:** Tech Lead.

## Permisos (Android AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

**Coordinat per:** Agent Android. **Validat per:** Tech Lead.

## Build & Sync

```bash
# Després de canvis a capacitor.config.ts
npx cap sync ios      # Genera capacitor.config.json per iOS
npx cap sync android  # Genera per Android

# Obrir projectes
npx cap open ios      # Xcode
npx cap open android  # Android Studio
```

## Cap config que NO s'ha de tocar

- Bundle ID (`com.pathguard.app`) — canviar trenca App Store / Play Store
- Versió mínima iOS (15) — testat a iPhone 8
- Versió mínima Android (24, API level) — testat a Redmi

## Errors comuns

❌ Hardcoded URL de servidor
❌ `webDir: 'out'` (Next.js prod build)
❌ `cleartext: true` en producció
❌ Permís string buit a Info.plist
❌ Permís string que no explica l'ús (Apple rebutja)

## Decissions documentades (ADRs)

| ADR | Tema |
|---|---|
| 0002 | Capacitor sobre React Native |
| 0003 | Capacitor Swift PM (no CocoaPods) |
| (pendent) | Un sol `capacitor.config.ts` (no duplicar a iOS) |
| (pendent) | URL parametritzable per env |
