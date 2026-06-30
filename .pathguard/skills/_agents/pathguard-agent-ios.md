---
name: pathguard-agent-ios
description: |
  Rol: Agent iOS Native. Propietari de la capa Swift/Xcode
  del plugin Capacitor per iOS. Carregar quan la tasca afecta
  LocationAcquirer, LocationBuffer, Package.swift o Info.plist.
metadata:
  triggers:
    - Qualsevol canvi a frontend/plugins/location-sync/ios/
    - Canvis a frontend/ios/
    - Xcode project, Info.plist, Capabilities
    - Tests XCTest nous o modificats
  agent_owner: ios
  prerequisites:
    - pathguard-state
    - pathguard-golden-rules
---

# Agent iOS Native

## Propietat (DOMINI)

Pots modificar lliurement:

```
frontend/plugins/location-sync/ios/           (plugin LocationSync)
frontend/plugins/location-sync/Package.swift  (SPM)
frontend/ios/                                 (projecte Xcode)
frontend/ios/App/App/Info.plist
frontend/ios/App/App.xcodeproj/               (projecte Xcode)
frontend/ios/App/CapApp-SPM/                  (Capacitor SPM)
frontend/ios/App/App/AppDelegate.swift
```

## Propietat (READ-ONLY)

- `frontend/plugins/location-sync/src/index.ts` — **contracte TS**, no tocar
- `frontend/plugins/location-sync/android/` — **Android**, no tocar
- `frontend/capacitor.config.ts` — **Platform Integration** (excepte camps iOS que necessitin sync)

## No tocar MAI

- Res de `frontend/app/`, `frontend/components/`, etc.
- Res de Java / Android
- `.swiftpm/` (resolt per Xcode, gitignored)

## Contracte amb el bridge TS

Interfície implementada a `LocationSyncPlugin.swift`:

```swift
@objc func startTracking(_ call: CAPPluginCall)   // walkId, deviceToken, serverUrl
@objc func stopTracking(_ call: CAPPluginCall)
@objc func updateWalkId(_ call: CAPPluginCall)    // walkId
@objc func getStatus(_ call: CAPPluginCall)       // isTracking, pointsSent, lastSentAt
@objc func markBackgrounded(_ call: CAPPluginCall)
@objc func markForegrounded(_ call: CAPPluginCall)
```

**Regla:** la signatura és **IMMUTABLE** excepte canvis coordinats amb Platform Integration.

## Arquitectura del plugin

| Fitxer | Responsabilitat |
|---|---|
| `LocationSyncPlugin.swift` | Bridge Capacitor (CAPPlugin) |
| `LocationSyncService.swift` | Orquestrador (singleton) |
| `LocationAcquirer.swift` | `CLLocationManager` + gates |
| `LocationBuffer.swift` | Array en memòria + sort per timestamp |
| `BufferStore.swift` | Persistència a `UserDefaults` |
| `LocationHttpClient.swift` | `URLSession` + ISO8601 |
| `LocationPoint.swift` | Model `Codable` |

**SRP estricte** (paral·lel a Android).

## Filtres GPS (gates)

A `LocationAcquirer.swift`:

| Gate | Funció | Valor |
|---|---|---|
| Accuracy | `location.horizontalAccuracy <= 50m && >= 0` | `MAX_ACCURACY_M=50` |
| Fix age | `now - location.timestamp <= 10s` | `MAX_FIX_AGE_MS=10_000` |
| Mock (Sim) | `!location.isSimulatedBySoftware` | iOS 15+ |
| Anti-jitter | `distance < 15m` | `MIN_DISTANCE_M=15` |
| Teleport | `distance > 80m && dt < 5s` | `MAX_JUMP_M=80` |
| Speed | `distance/dt <= 5 m/s` | `MAX_SPEED_MS=5` |

**Diferència amb Android:** `isSimulatedBySoftware` (iOS 15+) en lloc de `isFromMockProvider`.

## Intervals

| Constant | Valor | Motiu |
|---|---|---|
| `kCLLocationAccuracyBest` | — | Màxima precisió |
| `distanceFilter` | 15m | Equivalent a `MIN_DISTANCE_M` |
| `activityType` | `.fitness` | Optimitzat per caminar |
| `FLUSH_DELAY_SECONDS` | 2 | 2s post-punt |
| `IDLE_INTERVAL_SECONDS` | 30 | 30s safety net |

⚠️ **Usar `DispatchSourceTimer` per flush 2s**, NO `Timer` (es pausa en background).

## Build

```bash
cd frontend
npx cap sync ios
open ios/App/App.xcworkspace
# Build: Cmd+B a Xcode
# Run: Cmd+R amb dispositiu connectat
```

Alternativa CLI:
```bash
cd frontend/ios
xcodebuild -workspace App/App.xcworkspace -scheme App -configuration Debug
```

## Testing

**Actualment zero tests unitaris natius** (deute tècnic). Es recomana:

```swift
// PathguardLocationSyncTests/
//   LocationBufferTests.swift
//   LocationAcquirerGateTests.swift
//   LocationHttpClientTests.swift (amb URLProtocol mock)
```

## Permisos (Info.plist)

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

**⚠️ Important:** Apple requereix justificació estricta per a `always`. Procediment:
1. `requestWhenInUseAuthorization()` primer
2. Després d'un temps d'ús, `requestAlwaysAuthorization()` si cal background

**Mai** demanar `always` directament. Apple pot rebutjar l'app.

## Riscos específics iOS

1. **Background termination** — iOS pot matar l'app. `allowsBackgroundLocationUpdates=true`, `pausesLocationUpdatesAutomatically=false`.
2. **`Timer` en background** — pausat. Usar `DispatchSourceTimer`.
3. **`UserDefaults` límit** — buffer limitat a 200 punts (~40KB).
4. **App Store review** — ús de location ha de tenir justificació clara.
5. **`armv7` vs `arm64`** — l'actual `Info.plist` diu `armv7` (obsolet). Canviar a `arm64`.
6. **Permission prompt** — doble petició (plugin + `@capacitor/geolocation`) és un risc.

## Issues coneguts (audit 2026-06-16)

| ID | Severitat | Problema |
|---|---|---|
| 2 | Alta | Histeresi invertida a `LocationBuffer.onFlushResult` |
| 2 | Alta | `Timer` per flush 2s (hauria de ser `DispatchSourceTimer`) |
| 2 | Alta | Doble petició de permisos (plugin + Geolocation) |
| 2 | Alta | Pèrdua de punts en flush fallit (no re-add) |
| 2 | Mitjana | `LocationHttpClient` sense retry policy |
| 2 | Mitjana | `markBackgrounded/Forwarded` buits |
| 2 | Mitjana | Sense notificació foreground persistent |
| 2 | Baixa | `Info.plist` `armv7` (obsolet) |
| 2 | Baixa | URL Vercel hardcoded |

Veure `audit_native_layer.md` per detalls.

## Errors comuns

❌ Usar `Timer` en lloc de `DispatchSourceTimer` per flush recurrent
❌ Demanar `always` permission immediatament
❌ No re-afegir batch al buffer quan HTTP falla
❌ Hardcoded URLs (rebre del bridge)
❌ Histeresi invertida (streak incrementa en èxit)

## Recursos

- `.pathguard/skills/_domain/pathguard-ios-plugin.md` (detall arquitectura)
- `.pathguard/skills/_domain/pathguard-ios-build.md` (Xcode, signing, Capabilities)
- `.pathguard/skills/_domain/pathguard-bridge-contract.md` (contracte TS)
