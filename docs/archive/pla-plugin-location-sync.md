<!-- ARXIVAT 2026-06-30: document històric. Veure docs/INDEX.md per la documentació activa. -->

# Pla d'Implementació: Custom Plugin `LocationSync` (Fase E)

**Data:** 2026-06-02  
**Objectiu:** Resoldre el fals offline en background a Android via un plugin Capacitor nadiu que envia coordenades GPS directament al backend, sense dependre del WebView JS.

---

## 1. Arquitectura General

```
┌─────────────────────────────────────┐     ┌─────────────────────┐
│  Dispositiu /patient (APK)          │     │  /caregiver (navegador)
│  Redmi Note 13 (Android)            │     │  Chrome / Safari     │
│                                     │     │                      │
│  ┌────────────┐  ┌───────────────┐  │     │  Vue des de Vercel   │
│  │ React App  │  │ LocationSync   │  │     │                      │
│  │ (WebView)  │◄►│ Plugin (Kotlin)│──┼─────┼──► Backend (Render) │
│  │            │  │               │  │     │  POST /locations/    │
│  │ foreground │  │ foreground sv  │  │     │  batch               │
│  │ només      │  │ GPS natiu     │  │     │                      │
│  └────────────┘  │ HTTP directe   │  │     │                      │
│                  └───────┬───────┘  │     └─────────────────────┘
│                          │          │
│                  ┌───────┴───────┐  │
│                  │FusedLocation  │  │
│                  │Client (Google)│  │
│                  └───────────────┘  │
└─────────────────────────────────────┘
```

**Important:** L'APK només cal instal·lar-lo al **dispositiu del /patient** (el que fa els passeigs). El **/caregiver** (cuidador) accedeix des del navegador a `https://path-guard-orpin.vercel.app/caregiver` — no necessita APK ni plugins nadius. Vegeu la secció [12. Distribució i Desplegament](#12-distribució-i-desplegament).

**Flux:**
1. L'usuari inicia passeig des de React → JS crida `LocationSync.startTracking()`
2. El plugin inicia el foreground service amb `FusedLocationProviderClient`
3. Cada cop que rep una coordenada, l'emmagatzema en un buffer en memòria
4. Cada 5 segons (o cada 10 punts), fa flush via `OkHttp → POST /api/v1/locations/batch`
5. Quan l'usuari atura el passeig → JS crida `LocationSync.stopTracking()`
6. El plugin atura el foreground service i neteja recursos

---

## 2. API TypeScript

Fitxer: `frontend/plugins/location-sync/src/index.ts`

```typescript
import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

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
}

const LocationSync = registerPlugin<LocationSyncPlugin>('LocationSync');
export default LocationSync;
```

---

## 3. Estructura de Fitxers

```
frontend/plugins/location-sync/
├── package.json
├── src/
│   └── index.ts                      # TypeScript definitions
├── android/
│   └── src/main/java/com/pathguard/app/plugin/
│       ├── LocationSyncPlugin.kt     # Plugin entry point (@CapacitorPlugin)
│       ├── LocationSyncForegroundService.kt  # Foreground service
│       ├── LocationSyncService.kt    # GPS + HTTP logic
│       └── NotificationHelper.kt     # Notificació discreta
├── ios/
│   └── Sources/LocationSyncPlugin/
│       ├── LocationSyncPlugin.swift  # Plugin entry point
│       └── LocationSyncService.swift # GPS + HTTP logic
└── README.md
```

---

## 4. Android — Implementació

### 4.1 LocationSyncPlugin.kt

- Anotació `@CapacitorPlugin(name = "LocationSync")`
- Mètodes: `startTracking()`, `stopTracking()`, `updateWalkId()`, `getStatus()`
- `startTracking()`: crea Intent per al foreground service, passa `serverUrl`, `deviceToken`, `walkId`
- `stopTracking()`: envia Intent d'stop al service, retorna estat final

### 4.2 LocationSyncForegroundService.kt

- Extén `Service()` (o `LifecycleService`)
- Tipus: `FOREGROUND_SERVICE_LOCATION`
- Inicia notificació al `onCreate()`
- Delega gestió GPS a `LocationSyncService`
- S'atura al rebre Intent d'stop

### 4.3 LocationSyncService.kt

- `FusedLocationProviderClient` amb `LocationRequest`:
  - `PRIORITY_HIGH_ACCURACY`
  - `intervalMillis: 5000` (5s entre updates)
  - `fastestIntervalMillis: 2000`
  - `smallestDisplacement: 5` (5 metres)
- Buffer thread-safe (`ConcurrentLinkedQueue`)
- `HandlerThread` per flush periòdic cada 5s
- HTTP amb OkHttp:
  ```kotlin
  POST {serverUrl}/api/v1/locations/batch
  Headers:
    Content-Type: application/json
    X-Patient-Token: {deviceToken}
  Body:
    {
      "walk_id": 123,
      "batch_id": "uuid",
      "points": [{ "latitude": ..., "longitude": ..., "timestamp": "...", "client_id": "uuid" }]
    }
  ```
- Batch ID i client_id es generen com a UUIDs
- En cas d'error HTTP, re-intenta al següent flush (buffer retingut)
- `updateWalkId()`: canvia el walk_id per al següent batch

### 4.4 NotificationHelper.kt

```kotlin
object NotificationHelper {
    private const val CHANNEL_ID = "location_tracking"
    private const val NOTIFICATION_ID = 1

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "PathGuard",                    // nom del canal (visible a Settings)
                NotificationManager.IMPORTANCE_MIN  // MÉS DISCRET POSSIBLE
            ).apply {
                description = "Notificació del servei de localització"
                setSound(null, null)            // sense so
                enableVibration(false)          // sense vibració
                enableLights(false)             // sense llum LED
                setShowBadge(false)             // sense badge
                lockscreenVisibility = NotificationCompat.VISIBILITY_SECRET  // no visible a lock screen
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    fun buildNotification(context: Context): Notification {
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("Passeig actiu")
            .setContentText(null)           // sense descripció
            .setSmallIcon(R.drawable.ic_notification)  // icona petita (cal crear-la)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setSilent(true)
            .build()
    }
}
```

---

## 5. iOS — Implementació

### 5.1 LocationSyncPlugin.swift

- Extén `CAPPlugin`, anotat `@objc(LocationSyncPlugin)`
- Mètodes exportats: `startTracking()`, `stopTracking()`, `updateWalkId()`, `getStatus()`

### 5.2 LocationSyncService.swift

- `CLLocationManager` amb:
  - `desiredAccuracy = kCLLocationAccuracyBest`
  - `distanceFilter = 5`
  - `allowsBackgroundLocationUpdates = true`
  - `pausesLocationUpdatesAutomatically = false`
  - `activityType = .fitness`
- Buffer en memòria, flush cada 5s amb `URLSession`
- **No cal foreground service** (iOS ho gestiona diferent)
- Límit d'Apple: ~10 minuts d'execució en background per a location updates

---

## 6. Registre del Plugin

### Android

1. `frontend/android/capacitor.settings.gradle`:
```gradle
include ':location-sync'
project(':location-sync').projectDir = new File('../plugins/location-sync/android')
```

2. `frontend/android/app/capacitor.build.gradle`:
```gradle
dependencies {
    implementation project(':location-sync')
}
```

### iOS

1. `frontend/ios/App/CapApp-SPM/Package.swift`:
```swift
.package(name: "LocationSync", path: "../../plugins/location-sync/ios/Sources/LocationSyncPlugin")
```

2. Afegir al target:
```swift
.product(name: "LocationSync", package: "LocationSync")
```

3. `frontend/ios/App/App/capacitor.config.json`:
```json
"packageClassList": ["GeolocationPlugin", "LocationSyncPlugin"]
```

---

## 7. Integració amb React

### Modificacions a `useLocationTracking.ts`

- Mantenir el fallback de navegador per a dev
- Quan `Capacitor.isNativePlatform()`, usar `LocationSync.startTracking()` en lloc de `Geolocation.watchPosition()`
- `stopTracking()` també crida `LocationSync.stopTracking()`
- El `currentPosition` es pot seguir actualitzant via polling a `LocationSync.getStatus()` (opcional)

### Flux complet

```
1. User press "Començar passeig"
2. handleStartWalk() → walkService.startWalk() → obté walkId
3. startTracking() (React) detecta Capacitor nadiu
4. LocationSync.startTracking({ serverUrl, deviceToken, walkId })
5. Plugin inicia foreground service + GPS natiu + HTTP directe
6. User posa el mòbil a background
7. Plugin continua enviant coordenades via HTTP nadiu (OkHttp)
8. Backend rep coordenades → NO marca offline
9. User torna a foreground
10. User press "Aturar passeig"
11. handleStopWalk() → walkService.stopWalk()
12. LocationSync.stopTracking()
13. Plugin atura foreground service i GPS
```

---

## 8. Gestió d'Errors i Casos Límit

| Cas | Comportament |
|---|---|
| Sense xarxa | El plugin reté el buffer. HTTP falla → reintenta al següent flush. Si el buffer creix massa (>100 punts), es descarten els més vells (FIFO). |
| Permís GPS denegat | `startTracking()` retorna error. React mostra missatge a l'usuari. |
| Walk aturada des del backend | El plugin no ho sap. Quan el backend rep coordenades amb walk_id aturat, les ignora (404 walk not found). El JS ho detectarà via `useWalkSession` i cridarà `stopTracking()`. |
| App exterminada per l'OS | El foreground service es mata. No es poden enviar coordenades. En obrir l'app de nou, React pot detectar walk actiu via backend i reiniciar tracking. |
| Canvi de walk_id | `updateWalkId()` es crida des de JS si es necessita. |
| Múltiples startTracking() sense stop | El plugin ignora el segon start si ja està tracking. |

---

## 9. Límit d'iOS (~10 minuts)

**Què significa realment:**
- Quan un iPhone va a background (pantalla apagada o canvia d'app), iOS permet que l'app rebi actualitzacions de localització durant un temps limitat (~10 minuts).
- Després d'aquest període, iOS suspèn l'app completament.
- No es pot evitar. No és un problema de pantalla — és una política d'iOS.

**Impacte a PathGuard:**
- Passeigs curts (<10 min) a iOS: funcionen perfectament en background.
- Passeigs llargs (>10 min) a iOS: al cap de 10 minuts en background, el backend deixa de rebre coordenades → marca offline.
- Per a passeigs llargs, caldrà una solució complementària (push notifications per despertar l'app, o app en foreground).

**Decisió per a aquesta fase:** Acceptar la limitació per a iOS. Prioritzar Android (Redmi Note 13) que no té aquesta restricció.

---

## 10. Passos d'Implementació (Ordre)

| # | Tasca | Duració estimada | Dependències |
|---|---|---|---|
| 1 | Crear estructura `frontend/plugins/location-sync/` | 30 min | — |
| 2 | Implementar Android `LocationSyncPlugin.kt` | 1 h | 1 |
| 3 | Implementar Android `LocationSyncForegroundService.kt` | 1 h | 1 |
| 4 | Implementar Android `LocationSyncService.kt` (GPS + HTTP) | 2 h | 1 |
| 5 | Implementar Android `NotificationHelper.kt` | 30 min | 1 |
| 6 | Crear icona de notificació (`ic_notification`) | 30 min | — |
| 7 | Registrar plugin a `capacitor.settings.gradle` + `capacitor.build.gradle` | 15 min | 1 |
| 8 | `npx cap sync android` + compilar i verificar | 15 min | 2–7 |
| 9 | Implementar iOS `LocationSyncPlugin.swift` + `LocationSyncService.swift` | 2 h | 1 |
| 10 | Registrar plugin a iOS (Package.swift + capacitor.config.json) | 15 min | 9 |
| 11 | `npx cap sync ios` + compilar | 15 min | 9–10 |
| 12 | Migrar `useLocationTracking.ts` per usar el plugin en mode nadiu | 1 h | 8 |
| 13 | Prova al Redmi: passeig de 5 min en background | 30 min | 12 |
| 14 | Prova al Redmi: passeig de 20 min en background | 30 min | 12 |
| 15 | Prova al Redmi: aturar i reprendre passeig | 30 min | 12 |

**Total estimat:** ~10 hores (Android: ~6 h, iOS: ~4 h, React: ~1 h, proves: ~2 h)

---

## 11. Verificació

### Criteris d'acceptació (Android)
- [ ] En iniciar un passeig, apareix la notificació "Passeig actiu" (discreta, sense so)
- [ ] En background (pantalla apagada >5 min), el backend rep coordenades contínuament
- [ ] El dashboard del cuidador NO mostra offline durante el passeig en background
- [ ] En aturar el passeig, la notificació desapareix
- [ ] Si es reinicia l'app (sense tancar-la), el passeig continua correctament
- [ ] Si l'app és exterminada, en obrir-la de nou detecta que hi ha un walk actiu

### Criteris d'acceptació (iOS — limitat)
- [ ] En iniciar passeig, el GPS funciona en foreground
- [ ] En background, les coordenades s'envien durant ~10 min
- [ ] Passats els 10 min, iOS atura l'enviament (comportament esperat)

---

## 12. Distribució i Desplegament

### Qui necessita l'APK?

| Rol | Dispositiu | Necessita APK? | Com accedeix |
|---|---|---|---|
| **Patient** | Android (Redmi) amb app nativa | ✅ Sí | APK instal·lat al mòbil. La UI es carrega des de Vercel automàticament. |
| **Caregiver** | Qualsevol (mòbil, tauleta, PC) | ❌ No | Navegador → `https://path-guard-orpin.vercel.app/caregiver` |

L'APK només proporciona la "capesa nativa" (plugins Capacitor). **Tota la UI** (tant /patient com /caregiver) es serveix des de Vercel.

### Quan cal desplegar a Vercel vs. generar APK nou

| Canvi | Acció |
|---|---|
| Canvi a la UI del patient (React) | ✅ Desplegar a Vercel. Tots els dispositius ho reben automàticament. |
| Canvi al plugin nadiu (LocationSync) | ✅ Generar APK nou + distribuir-lo als testers. |
| Canvi a la UI del caregiver | ✅ Desplegar a Vercel. Al navegador es veu directament sense instal·lar res. |
| Canvi al backend | ✅ Desplegar a Render. Tothom ho rep. |

### Com distribuir l'APK a testers remots

Per a testers que no poden connectar el dispositiu per USB:

1. Al Mac, genera l'APK:
   ```bash
   cd frontend/android
   ./gradlew assembleDebug
   # L'APK es genera a:
   # frontend/android/app/build/outputs/apk/debug/app-debug.apk
   ```
2. Puja l'APK a **Google Drive**.
3. Comparteix l'enllaç amb el tester.
4. El tester descarrega l'APK al seu mòbil.
5. **Requisit al dispositiu tester:** Activar "Instal·lar apps d'origen desconegut" (a MIUI: *Configuració → Seguretat → Instal·lar apps desconegudes → Permetre al navegador/gestor de fitxers*).
6. Obre l'APK → s'instal·la → l'app es carrega des de Vercel.

### Provar múltiples grups simultàniament

El mateix APK serveix per a tots els grups:

1. **Dispositiu A** → s'activa amb codi del **Grup 1** → fa passeigs
2. **Dispositiu B** → s'activa amb codi del **Grup 2** → fa passeigs
3. Cada cuidador va al seu `/caregiver/dashboard` amb les seves credencials
4. Les dades estan aïllades per `group_id` al backend — no es barregen

---

*Document generat com a pla d'implementació per a Fase E (Capacitor /patient). A discutir amb l'equip abans de començar a codificar.*
