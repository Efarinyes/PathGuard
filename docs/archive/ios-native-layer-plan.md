<!-- ARXIVAT 2026-06-30: document històric. Veure docs/INDEX.md per la documentació activa. -->

# iOS Native Layer — Plan d'Implementació

**Data:** 2026-06-11
**Branca:** `feat/ios-native-layer`
**Propòsit:** Pla detallat per crear el plugin LocationSync natiu per iOS, equivalent al d'Android.

---

## 1. Objectiu

Portar la capa nativa de localització GPS a iOS, amb:
- Buffer offline amb persistència (equivalent a `BufferStore.java`)
- Marcatge `is_recovered` per punts recuperats post-offline
- Histeresi (RECOVERY_STREAK_THRESHOLD=3)
- Filtres GPS (accuracy, fix age, mock, anti-jitter, teleport, speed)
- Intervals de captura: 15s / 5s fastest
- Flush on-demand (2s després de cada punt) + idle safety (30s)
- Compatibilitat amb Capacitor bridge existent (`registerPlugin('LocationSync')`)

## 2. Arquitectura

Paral·lela a Android: 7 fitxers Swift, SRP estricte.

```
frontend/plugins/location-sync/ios/
├── Plugin/
│   ├── LocationSyncPlugin.swift      # Bridge Capacitor
│   ├── LocationSyncService.swift      # Orquestrador
│   ├── LocationAcquirer.swift         # CLLocationManager + gates
│   ├── LocationBuffer.swift           # Cua en memòria
│   ├── BufferStore.swift              # Persistència UserDefaults
│   ├── LocationHttpClient.swift       # HTTP client
│   └── LocationPoint.swift            # Model de dades
└── Plugin+LocationSync.xcframework    # Generat per Capacitor
```

## 3. Dependències

| Dependència | Tipus | Propòsit |
|---|---|---|
| `Foundation` | SDK nadiu | Codable, URLSession, Timer, UserDefaults |
| `CoreLocation` | SDK nadiu | CLLocationManager |
| `Capacitor` | npm | Bridge TS ↔ Swift |

**Zero dependències externes.** No Alamofire, no RxSwift, no PromiseKit.

## 4. Fitxers — Responsabilitats i Detalls

### 4.1 — `LocationPoint.swift`

```swift
struct LocationPoint: Codable {
    let latitude: Double
    let longitude: Double
    let timestampMs: Int64
    let clientId: String
    var isRecovered: Bool
}
```

- `Codable` per serialització JSON directa a `URLSession` i `UserDefaults`.
- `Comparable` per ordenar per `timestampMs`.

### 4.2 — `LocationAcquirer.swift`

```swift
class LocationAcquirer: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var lastAcceptedPoint: LocationPoint?
    var onPointAccepted: ((LocationPoint) -> Void)?

    func start() { /* requestAlwaysAuthorization + startUpdatingLocation */ }
    func stop() { manager.stopUpdatingLocation() }

    // Gates (equivalents a LocationAcquirer.java):
    // - accuracy >= 0 i <= MAX_ACCURACY_M (50)
    // - fix age <= MAX_FIX_AGE_MS (10s)
    // - isMock (iOS no exposa mock directament, però existeix isSimulatedBySoftware)
    // - anti-jitter (distance < MIN_DISTANCE_M=15)
    // - teleport (distance > MAX_JUMP_M=80 en <5s)
    // - speed (distance/dt > MAX_SPEED_MS=5)

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) { ... }
}
```

**Consideracions iOS:**
- `requestAlwaysAuthorization()` per background location.
- `allowsBackgroundLocationUpdates = true`
- `pausesLocationUpdatesAutomatically = false`
- `activityType = .fitness` (per optimitzar bateria en caminar)
- `distanceFilter = 15` (equival a `MIN_DISTANCE_M`)
- `desiredAccuracy = kCLLocationAccuracyBest` (per a walking)

### 4.3 — `LocationBuffer.swift`

```swift
class LocationBuffer {
    private var buffer: [LocationPoint] = []
    private let store: BufferStore
    private(set) var lastFlushFailed = false
    private var recoveryStreak = 0
    static let RECOVERY_STREAK_THRESHOLD = 3

    init(store: BufferStore) {
        self.store = store
        self.buffer = store.load()
        self.lastFlushFailed = store.getLastFlushFailed()
        // Punts carregats → isRecovered = true
        for i in 0..<buffer.count { buffer[i].isRecovered = true }
    }

    func add(_ point: LocationPoint) { buffer.append(point); buffer.sort { $0.timestampMs < $1.timestampMs } }
    func drainAll() -> [LocationPoint] { let copy = buffer; buffer.removeAll(); return copy }
    func save() { store.save(buffer, lastFlushFailed: lastFlushFailed, recoveryStreak: recoveryStreak) }
    func clear() { store.clear() }

    func onFlushResult(_ success: Bool) {
        if success { recoveryStreak = 0; lastFlushFailed = false; clear() }
        else { recoveryStreak += 1; lastFlushFailed = recoveryStreak >= Self.RECOVERY_STREAK_THRESHOLD; save() }
    }
}
```

### 4.4 — `BufferStore.swift`

```swift
class BufferStore {
    private let defaults = UserDefaults.standard
    private let bufferKey = "pathguard_buffer"
    private let flushFailedKey = "pathguard_flush_failed"
    private let streakKey = "pathguard_recovery_streak"
    
    // Persistència de sessió (NOU)
    private let walkIdKey = "pathguard_walk_id"
    private let deviceTokenKey = "pathguard_device_token"
    private let serverUrlKey = "pathguard_server_url"
    
    func save(_ buffer: [LocationPoint], lastFlushFailed: Bool, recoveryStreak: Int) {
        if let data = try? JSONEncoder().encode(buffer) { defaults.set(data, forKey: bufferKey) }
        defaults.set(lastFlushFailed, forKey: flushFailedKey)
        defaults.set(recoveryStreak, forKey: streakKey)
    }
    
    func load() -> [LocationPoint] {
        guard let data = defaults.data(forKey: bufferKey),
              let buffer = try? JSONDecoder().decode([LocationPoint].self, from: data) else { return [] }
        return buffer
    }
    
    func getLastFlushFailed() -> Bool { defaults.bool(forKey: flushFailedKey) }
    func getRecoveryStreak() -> Int { defaults.integer(forKey: streakKey) }
    func clear() {
        defaults.removeObject(forKey: bufferKey)
        defaults.removeObject(forKey: flushFailedKey)
        defaults.removeObject(forKey: streakKey)
    }
    
    // Persistència de sessió (NOU)
    func saveSession(walkId: Int, deviceToken: String, serverUrl: String) {
        defaults.set(walkId, forKey: walkIdKey)
        defaults.set(deviceToken, forKey: deviceTokenKey)
        defaults.set(serverUrl, forKey: serverUrlKey)
    }
    
    func loadSession() -> (walkId: Int, deviceToken: String, serverUrl: String)? {
        let walkId = defaults.integer(forKey: walkIdKey)
        guard let deviceToken = defaults.string(forKey: deviceTokenKey),
              let serverUrl = defaults.string(forKey: serverUrlKey),
              walkId > 0 else { return nil }
        return (walkId, deviceToken, serverUrl)
    }
    
    func clearSession() {
        defaults.removeObject(forKey: walkIdKey)
        defaults.removeObject(forKey: deviceTokenKey)
        defaults.removeObject(forKey: serverUrlKey)
    }
}
```

### 4.5 — `LocationHttpClient.swift`

```swift
class LocationHttpClient {
    private let session: URLSession
    private let timeout: TimeInterval = 15
    private let isoFormatter: ISO8601DateFormatter
    
    init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout
        self.session = URLSession(configuration: config)
        self.isoFormatter = ISO8601DateFormatter()
        self.isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }
    
    func sendBatch(
        _ batch: [LocationPoint],
        walkId: Int,
        deviceToken: String,
        serverUrl: String,
        completion: @escaping (Bool) -> Void
    ) {
        // Construir payload JSON
        var pointsArray: [[String: Any]] = []
        for p in batch {
            let date = Date(timeIntervalSince1970: TimeInterval(p.timestampMs) / 1000.0)
            let point: [String: Any] = [
                "latitude": p.latitude,
                "longitude": p.longitude,
                "timestamp": isoFormatter.string(from: date),
                "client_id": p.clientId,
                "walk_id": walkId,
                "is_recovered": p.isRecovered
            ]
            pointsArray.append(point)
        }
        
        let body: [String: Any] = [
            "walk_id": walkId,
            "batch_id": UUID().uuidString,
            "points": pointsArray
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else {
            completion(false); return
        }
        
        let cleanedUrl = serverUrl.hasSuffix("/") ? String(serverUrl.dropLast()) : serverUrl
        guard let url = URL(string: "\(cleanedUrl)/locations/batch") else {
            completion(false); return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(deviceToken, forHTTPHeaderField: "X-Patient-Token")
        request.httpBody = jsonData
        
        let task = session.dataTask(with: request) { _, response, _ in
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(false); return
            }
            let success = (200...299).contains(httpResponse.statusCode)
            completion(success)
        }
        task.resume()
    }
}
```

**IMPORTANT:** Usem `URLSession.dataTask` amb completion handlers (NO `async/await`) per major fiabilitat en background a iOS 15-16.

### 4.6 — `LocationSyncService.swift`

```swift
class LocationSyncService {
    private let store: BufferStore
    private let buffer: LocationBuffer
    private let httpClient: LocationHttpClient
    private let acquirer: LocationAcquirer
    
    private var walkId = 0
    private var deviceToken = ""
    private var serverUrl = ""
    
    private var flushTimer: Timer?
    private var idleTimer: DispatchSourceTimer?  // NO Timer (pausa en background)
    
    private static let FLUSH_DELAY: TimeInterval = 2
    private static let IDLE_INTERVAL: TimeInterval = 30
    
    private(set) var isRunning = false
    private(set) var pointsSent = 0
    private(set) var lastSentAt: String?
    
    init() {
        store = BufferStore()
        buffer = LocationBuffer(store: store)
        httpClient = LocationHttpClient()
        acquirer = LocationAcquirer()
        
        acquirer.onPointAccepted = { [weak self] point in
            self?.onPointAccepted(point)
        }
        
        // Recuperar sessió persistida (NOU)
        if let session = store.loadSession() {
            walkId = session.walkId
            deviceToken = session.deviceToken
            serverUrl = session.serverUrl
        }
        
        // Flush inicial si hi ha punts pendents
        if !buffer.isEmpty && !serverUrl.isEmpty && !deviceToken.isEmpty {
            DispatchQueue.global().asyncAfter(deadline: .now() + 1.0) { [weak self] in
                self?.flushBuffer()
            }
        }
        
        // Observadors app lifecycle
        NotificationCenter.default.addObserver(
            self, selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification, object: nil
        )
        NotificationCenter.default.addObserver(
            self, selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification, object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        flushTimer?.invalidate()
        idleTimer?.cancel()
    }
    
    // MARK: - 6 mètodes públics (NO 3)
    
    func start(walkId: Int, deviceToken: String, serverUrl: String) {
        self.walkId = walkId
        self.deviceToken = deviceToken
        self.serverUrl = serverUrl
        store.saveSession(walkId: walkId, deviceToken: deviceToken, serverUrl: serverUrl)
        
        guard !isRunning else { return }
        isRunning = true
        pointsSent = 0
        lastSentAt = nil
        
        acquirer.setWalkId(walkId)
        acquirer.start()
        
        if !buffer.isEmpty {
            flushBuffer()
        }
        
        startIdleTimer()
    }
    
    func stop() {
        isRunning = false
        acquirer.stop()
        flushTimer?.invalidate()
        idleTimer?.cancel()
        flushBuffer()
        store.clear()
        store.clearSession()
    }
    
    func updateWalkId(_ walkId: Int) {
        self.walkId = walkId
        acquirer.setWalkId(walkId)
        store.saveSession(walkId: walkId, deviceToken: deviceToken, serverUrl: serverUrl)
    }
    
    func getStatus() -> (isTracking: Bool, pointsSent: Int, lastSentAt: String?) {
        return (isRunning, pointsSent, lastSentAt)
    }
    
    func markBackgrounded() { /* iOS gestiona background automàticament */ }
    func markForegrounded() { /* iOS gestiona foreground automàticament */ }
    
    // MARK: - Intern
    
    private func onPointAccepted(_ point: LocationPoint) {
        var p = point
        p.isRecovered = buffer.isLastFlushFailed
        buffer.add(p)
        buffer.save()
        scheduleFlush()
    }
    
    private func scheduleFlush() {
        flushTimer?.invalidate()
        flushTimer = Timer.scheduledTimer(withTimeInterval: Self.FLUSH_DELAY, repeats: false) { [weak self] _ in
            self?.flushBuffer()
        }
    }
    
    private func startIdleTimer() {
        let timer = DispatchSource.makeTimerSource(queue: .global())
        timer.schedule(deadline: .now() + Self.IDLE_INTERVAL, repeating: Self.IDLE_INTERVAL, leeway: .seconds(5))
        timer.setEventHandler { [weak self] in self?.flushBuffer() }
        timer.resume()
        idleTimer = timer
    }
    
    private func flushBuffer() {
        guard !buffer.isEmpty, walkId > 0, !deviceToken.isEmpty, !serverUrl.isEmpty else { return }
        
        let batch = buffer.drainAll()
        httpClient.sendBatch(batch, walkId: walkId, deviceToken: deviceToken, serverUrl: serverUrl) { [weak self] success in
            guard let self = self else { return }
            if success {
                self.pointsSent += batch.count
                self.lastSentAt = self.isoFormatter.string(from: Date())
            }
            self.buffer.onFlushResult(success)
        }
    }
    
    @objc private func appDidEnterBackground() { /* iOS continua amb allowsBackgroundLocationUpdates */ }
    @objc private func appWillEnterForeground() { /* no cal fer res especial */ }
}
```

**IMPORTANT:** Usem `DispatchSourceTimer` per l'idle timer (NO `Timer`) perquè `Timer` es pausa en background a iOS.

### 4.7 — `LocationSyncPlugin.swift`

```swift
@objc(LocationSyncPlugin)
class LocationSyncPlugin: CAPPlugin {
    private let service = LocationSyncService()
    
    @objc func startTracking(_ call: CAPPluginCall) {
        guard let walkId = call.getInt("walkId"),
              let deviceToken = call.getString("deviceToken"),
              let serverUrl = call.getString("serverUrl") else {
            call.reject("Missing required parameters: serverUrl, deviceToken, walkId")
            return
        }
        service.start(walkId: walkId, deviceToken: deviceToken, serverUrl: serverUrl)
        call.resolve()
    }
    
    @objc func stopTracking(_ call: CAPPluginCall) {
        service.stop()
        call.resolve()
    }
    
    @objc func updateWalkId(_ call: CAPPluginCall) {
        guard let walkId = call.getInt("walkId") else {
            call.reject("Missing required parameter: walkId")
            return
        }
        service.updateWalkId(walkId)
        call.resolve()
    }
    
    @objc func getStatus(_ call: CAPPluginCall) {
        let status = service.getStatus()
        call.resolve([
            "isTracking": status.isTracking,
            "pointsSent": status.pointsSent,
            "lastSentAt": status.lastSentAt as Any
        ])
    }
    
    @objc func markBackgrounded(_ call: CAPPluginCall) {
        service.markBackgrounded()
        call.resolve()
    }
    
    @objc func markForegrounded(_ call: CAPPluginCall) {
        service.markForegrounded()
        call.resolve()
    }
}
```

**IMPORTANT:** Implementem els 6 mètodes del bridge TypeScript (NO només 3).

## 5. Flux de Dades

```
LocationAcquirer (GPS)
    ↓ onPointAccepted
LocationBuffer.add(point) → BufferStore.save()
    ↓ scheduleFlush (2s)
LocationBuffer.drainAll() → LocationHttpClient.sendBatch()
    ↓ onFlushResult(success)
BufferStore.clear() (OK) / BufferStore.save() (FAIL → isRecovered=true)
```

## 6. Bridge TypeScript (No canvia)

```typescript
// frontend/plugins/location-sync/src/index.ts — JA EXISTEIX, NO TOCAR
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

**IMPORTANT:** El bridge TypeScript ja defineix els 6 mètodes. La implementació iOS ha de coincidir exactament.

## 7. Configuració iOS

### Info.plist (Alerts de permís)

```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>PathGuard necessita el teu permís per compartir la teva ubicació amb el cuidador.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>PathGuard necessita accés a la ubicació per mostrar la ruta del passeig.</string>
<key>UIBackgroundModes</key>
<array><string>location</string></array>
```

### Capacitor Config

```json
// frontend/capacitor.config.json
{
    "plugins": {
        "LocationSync": {
            "ios": {
                "locationAuthorization": "always"
            }
        }
    }
}
```

## 8. Test

| Nivell | Com |
|---|---|
| Compilació | `npx cap sync ios` + build a Xcode |
| Unitari | No previst (funció pura haversine testejable a part) |
| Manual (camp) | iPhone 8, caminar 15 min, verificar backend |
| Offline | Mode avió 10 min, reactivar, verificar `is_recovered=true` |

## 9. Riscos i Mitigacions

| Risc | Probabilitat | Mitigació |
|---|---|---|
| iOS mata el servei per background | Mitjana | `allowsBackgroundLocationUpdates=true`, `pausesLocationUpdatesAutomatically=false` |
| UserDefaults límit de mida | Baixa | Buffer limitat a 200 punts (~40KB serialitzat) |
| Diferències de comportament GPS entre Android/iOS | Mitjana | Test de camp a l'iPhone 8 abans de producció |
| iPhone 8 bateria | Alta | Intervals 15s igual que Android, `activityType = .fitness` |

## 10. Estructura de Branques

```
develop
  └── feat/ios-native-layer ← AQUÍ (documentació + codi)
```

Quan el codi iOS estigui llest, PR a `develop`, després merge a `main` per a release.

---

*Pla iOS — Versió 1.0 — 2026-06-11. Executar després de completar UX-1 a UX-6.*
