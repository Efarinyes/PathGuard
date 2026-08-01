---
name: pathguard-agent-ios
description: >-
  Rol: Agent iOS Native. Propietari de la capa Swift/Xcode del plugin Capacitor per iOS. Carregar quan la tasca afecta LocationAcquirer, LocationBuffer, Package.swift o Info.plist. Use when: Qualsevol canvi a frontend/plugins/location-sync/ios/; Canvis a frontend/ios/; Xcode project, Info.plist, Capabilities; Tests XCTest nous o modificats.
---

# Agent iOS Native

## Prerequisites

Read these skills first:
- `pathguard-core-state`
- `pathguard-core-golden-rules`

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

## Arquitectura (SRP estricte)

```
ios/Plugin/
├── LocationSyncPlugin.swift      # Bridge CAPPlugin (orquestra)
├── LocationSyncService.swift      # Lifecycle (start/stop/status)
├── LocationAcquirer.swift         # CLLocationManager + gates
├── LocationBuffer.swift           # Cua en memòria
├── BufferStore.swift              # Persistència UserDefaults
├── LocationHttpClient.swift       # URLSession
└── LocationPoint.swift            # Model Codable
```

Cada classe té **una sola raó de canvi**.

## Flux de dades

```
LocationAcquirer (CLLocationManager)
    ↓ onLocationAccepted (delegate)
LocationSyncService.onPointAccepted
    ↓ buffer.add(point) [isRecovered = lastFlushFailed]
LocationBuffer
    ↓ scheduleFlush (2s)
LocationBuffer.drainAll() → LocationHttpClient.sendBatch()
    ↓ completion(success)
LocationBuffer.onFlushResult(success)
    ├─ success → clear() (persisteix buffer buit)
    └─ failure → save() (isRecovered=true per nous punts)
```

## LocationPoint model

```swift
struct LocationPoint: Codable {
    let latitude: Double
    let longitude: Double
    let timestampMs: Int64
    let clientId: String
    var isRecovered: Bool
}
```

**Comparable** per ordenar per `timestampMs`.

## Filtres GPS (LocationAcquirer)

```swift
private static let MAX_ACCURACY_M: Double = 50
private static let MAX_FIX_AGE_MS: Int64 = 10_000
private static let MIN_DISTANCE_M: Double = 15
private static let MAX_JUMP_M: Double = 80
private static let MAX_SPEED_MS: Double = 5  // 18 km/h

func passesAccuracyGate(_ loc: CLLocation) -> Bool { ... }
func passesFixAgeGate(_ loc: CLLocation) -> Bool { ... }
func passesMockGate(_ loc: CLLocation) -> Bool { 
    // iOS 15+
    !loc.isSimulatedBySoftware
}
func passesAntiJitterGate(_ candidate: LocationPoint) -> Bool { ... }
func passesTeleportGate(_ candidate: LocationPoint, _ elapsed: Int64) -> Bool { ... }
func passesSpeedGate(_ distance: Double, _ elapsed: Int64) -> Bool { ... }
```

Cada gate és **un mètode independent** per testabilitat.

## Configuració CLLocationManager

```swift
manager.desiredAccuracy = kCLLocationAccuracyBest
manager.distanceFilter = 15  // equivalent a MIN_DISTANCE_M
manager.activityType = .fitness
manager.allowsBackgroundLocationUpdates = true
manager.pausesLocationUpdatesAutomatically = false
manager.showsBackgroundLocationIndicator = true
```

**⚠️ `pausesLocationUpdatesAutomatically = false`** és crític. Si és `true`, iOS pausa en background.

## Intervals

| Constant | Valor | Motiu |
|---|---|---|
| `kCLLocationAccuracyBest` | — | Màxima precisió |
| `distanceFilter` | 15m | Equivalent a `MIN_DISTANCE_M` |
| `activityType` | `.fitness` | Optimitzat per caminar |
| `FLUSH_DELAY_SECONDS` | 2 | 2s post-punt |
| `IDLE_INTERVAL_SECONDS` | 30 | 30s safety net |

⚠️ **Usar `DispatchSourceTimer` per flush 2s**, NO `Timer` (es pausa en background).

## Timers

⚠️ **CRÍTIC:** Usar `DispatchSourceTimer`, NO `Timer`. `Timer` es pausa en background iOS.

```swift
// ✅ Correcte
private var idleTimer: DispatchSourceTimer?

private func startIdleTimer() {
    let timer = DispatchSource.makeTimerSource(queue: .global())
    timer.schedule(deadline: .now() + 30, repeating: 30, leeway: .seconds(5))
    timer.setEventHandler { [weak self] in 
        self?.flushBuffer() 
    }
    timer.resume()
    idleTimer = timer
}

// ❌ Incorrecte
private var flushTimer: Timer?
flushTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: false) { ... }
```

## Permission flow

```swift
// Primer pas
manager.requestWhenInUseAuthorization()

// Després d'un temps d'ús (quan l'usuari ja ha caminat)
manager.requestAlwaysAuthorization()
```

**Mai** demanar `always` directament. Apple rebutja.

## Persistència (BufferStore)

UserDefaults amb claus:
- `pathguard_buffer` — JSON array de LocationPoint
- `pathguard_flush_failed` — Bool
- `pathguard_recovery_streak` — Int
- `pg_walk_id`, `pg_device_token`, `pg_server_url` — sessió

**Recuperació a `init()`:**
```swift
init(store: BufferStore) {
    self.store = store
    self.buffer = store.load()  // Carrega punts pendents
    self.lastFlushFailed = store.getLastFlushFailed()
    self.recoveryStreak = store.getRecoveryStreak()
    
    // Punts recuperats → isRecovered = true
    for i in 0..<buffer.count {
        buffer[i].isRecovered = true
    }
}
```

## Histeresi (recovery streak)

```swift
private static let RECOVERY_STREAK_THRESHOLD = 3

func onFlushResult(_ success: Bool) {
    if success {
        recoveryStreak += 1
        if recoveryStreak >= Self.RECOVERY_STREAK_THRESHOLD {
            lastFlushFailed = false
        }
        clear()
    } else {
        recoveryStreak = 0
        lastFlushFailed = true
        save()
    }
}
```

**⚠️ BUG CONEGUT (audit 2026-06-16):** la lògica actual té la histeresi **invertida**. Hauria de ser:

```swift
if success {
    recoveryStreak = 0  // ✅ Reset en èxit
    lastFlushFailed = false
    clear()
} else {
    recoveryStreak += 1  // ✅ Increment en fail
    if recoveryStreak >= Self.RECOVERY_STREAK_THRESHOLD {
        lastFlushFailed = true
    }
    save()
}
```

**A més:** quan el flush falla, els punts s'han de re-afegir al buffer (no perdre's):

```swift
if !success {
    // Re-add the batch (failed to send)
    for point in batch {
        var p = point
        p.isRecovered = true
        buffer.add(p)
    }
    save()
}
```

## HTTP Client

```swift
let config = URLSessionConfiguration.default
config.timeoutIntervalForRequest = 15
config.timeoutIntervalForResource = 15

let session = URLSession(configuration: config)

func sendBatch(
    _ batch: [LocationPoint],
    walkId: Int,
    deviceToken: String,
    serverUrl: String,
    completion: @escaping (Bool) -> Void
) {
    // Build JSON payload
    // POST /locations/batch
    // Header: X-Patient-Token
    // Return success (200-299) or failure
}
```

**⚠️ DEUTE TÈCNIC:** No hi ha retry policy. Caldria exponential backoff (3 intents).

## Foreground notification

⚠️ **DEUTE TÈCNIC (audit 2026-06-16):** no hi ha notificació foreground persistent. Android en té. Per paritat:

```swift
// LocationSyncService.start()
let content = UNMutableNotificationContent()
content.title = "PathGuard"
content.body = "Seguiment actiu"
content.subtitle = walkId > 0 ? "Passeig #\(walkId)" : nil

let request = UNNotificationRequest(
    identifier: "pathguard_tracking",
    content: content,
    trigger: nil
)
UNUserNotificationCenter.current().add(request)
```

## Lifecycle observers

```swift
NotificationCenter.default.addObserver(
    self,
    selector: #selector(appDidEnterBackground),
    name: UIApplication.didEnterBackgroundNotification,
    object: nil
)
```

Selectors han de tenir la signatura correcta:
```swift
@objc private func appDidEnterBackground(_ notification: Notification) { ... }
```

## Package.swift (SPM)

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PathguardLocationSync",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "PathguardLocationSync", targets: ["LocationSyncPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "LocationSyncPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin"
        )
    ]
)
```

## Riscos específics iOS

1. **Background termination** — iOS pot matar l'app. `allowsBackgroundLocationUpdates=true`, `pausesLocationUpdatesAutomatically=false`.
2. **`Timer` en background** — pausat. Usar `DispatchSourceTimer`.
3. **`UserDefaults` límit** — buffer limitat a 200 punts (~40KB).
4. **App Store review** — ús de location ha de tenir justificació clara.
5. **`armv7` vs `arm64`** — l'actual `Info.plist` diu `armv7` (obsolet). Canviar a `arm64`.
6. **Permission prompt** — doble petició (plugin + `@capacitor/geolocation`) és un risc.

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

## Testing (deute tècnic)

**Actualment zero tests.** Caldria:

```swift
// PathguardLocationSyncTests/
//   LocationBufferTests.swift
//     test_onFlushResult_false_reAddsBatch()
//     test_onFlushResult_true_clearsBuffer()
//     test_recoveryStreak_incrementsOnFailure()
//     test_isRecovered_true_forLoadedPoints()
//   
//   LocationAcquirerTests.swift
//     test_passesAccuracyGate_above50m_fails()
//     test_passesFixAgeGate_above10s_fails()
//     test_passesMockGate_simulatedLocation_fails()
//     test_passesAntiJitterGate_below15m_fails()
//     test_passesTeleportGate_above80mIn5s_fails()
//     test_passesSpeedGate_above5ms_fails()
//   
//   LocationHttpClientTests.swift
//     test_sendBatch_2xx_returnsSuccess()
//     test_sendBatch_timeout_returnsFailure()
//     (URLProtocol mock)
```

## Issues prioritzats (audit 2026-06-16)

| # | Severitat | Issue | SPEC |
|---|---|---|---|
| 1 | Alta | Histeresi invertida | SPEC-020.3 |
| 2 | Alta | `Timer` en lloc de `DispatchSourceTimer` | SPEC-020.2 |
| 3 | Alta | Pèrdua de punts en flush fallit | SPEC-020.1 |
| 4 | Mitjana | Sense retry HTTP | (post-beta) |
| 5 | Mitjana | Sense foreground notification | (post-beta) |
| 6 | Baixa | `armv7` a `Info.plist` | SPEC-080 |

## Proves de camp

**Dispositiu:** iPhone 8 (iOS 15+) + iPhone recent (iOS 17+)

**Escenaris (beta — sense mode avió):**
1. Walk 15 min en zona urbana
2. Butxaca / screen-off 15–30 min
3. Kill app (swipe away) → reobrir + estat en línia
4. SOS (mantenir 3s)

**Criteri d'èxit:** densitat de punts acceptable; mapa coherent; `is_recovered` coherent amb buffer.

## Errors comuns

❌ Usar `Timer` en lloc de `DispatchSourceTimer` per flush recurrent
❌ Demanar `always` permission immediatament
❌ No re-afegir batch al buffer quan HTTP falla
❌ Hardcoded URLs (rebre del bridge)
❌ Histeresi invertida (streak incrementa en èxit)

## Recursos

- `.cursor/skills/pathguard-domain-bridge-contract/SKILL.md` (contracte TS)

