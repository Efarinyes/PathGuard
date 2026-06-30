---
name: pathguard-android-plugin
description: |
  Arquitectura i patrons del plugin LocationSync Android (Java).
  Carregar quan la tasca toca LocationAcquirer, LocationBuffer,
  BufferStore, ForegroundService o LocationHttpClient.
triggers:
  - Modificar frontend/plugins/location-sync/android/
  - Modificar frontend/android/
  - Validar proves de camp Android
agent_owner: android
prerequisites:
  - pathguard-agent-android
  - pathguard-bridge-contract
---

# Android Plugin — Detall tècnic

## Arquitectura (SRP estricte)

```
android/src/main/java/com/pathguard/app/plugin/
├── LocationSyncPlugin.java            # Bridge Capacitor
├── LocationSyncForegroundService.java # Orquestrador
├── LocationAcquirer.java              # FusedLocationProviderClient + gates
├── LocationBuffer.java                # PriorityQueue + persistència
├── BufferStore.java                   # SharedPreferences
├── LocationHttpClient.java            # OkHttp
├── LocationPoint.java                 # Model
└── NotificationHelper.java            # Foreground notification
```

Cada classe té **una sola raó de canvi**.

## Flux de dades

```
LocationAcquirer (FusedLocationProviderClient)
    ↓ onLocationAccepted
LocationSyncForegroundService.onPointAccepted
    ↓ buffer.add(point) [isRecovered = lastFlushFailed]
LocationBuffer (PriorityQueue)
    ↓ scheduleFlush (2s)
LocationBuffer.drainAll() → LocationHttpClient.sendBatch()
    ↓ onResult(success)
LocationBuffer.onFlushResult(success)
```

## LocationPoint model

```java
public class LocationPoint {
    final double latitude;
    final double longitude;
    final long timestampMs;
    final String clientId;
    boolean isRecovered;
}
```

**Comparable** per `timestampMs` (PriorityQueue).

## Filtres GPS (LocationAcquirer)

```java
private static final float MAX_ACCURACY_M = 50.0f;
private static final float MIN_DISTANCE_M = 15.0f;
private static final float MAX_JUMP_M = 80.0f;
private static final float MAX_SPEED_MS = 5.0f;
private static final long MAX_FIX_AGE_MS = 10_000;

private boolean passesAccuracyGate(Location loc) { ... }
private boolean passesFixAgeGate(Location loc) { ... }
private boolean passesMockGate(Location loc) { 
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
        return !loc.isFromMockProvider();
    }
    return true;
}
private boolean passesAntiJitterGate(LocationPoint candidate) { ... }
private boolean passesTeleportGate(LocationPoint candidate, long elapsed) { ... }
private boolean passesSpeedGate(double distance, long elapsed) { ... }
```

## Configuració LocationRequest

```java
LocationRequest locationRequest = new LocationRequest.Builder(
    Priority.PRIORITY_HIGH_ACCURACY,
    15_000  // 15s base
)
.setMinUpdateIntervalMillis(5_000)  // 5s fastest
.setMinUpdateDistanceMeters(15)
.setWaitForAccurateLocation(false)
.build();
```

## Foreground Service

```java
public class LocationSyncForegroundService extends Service {
    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            switch (action) {
                case "START": startTracking(...); break;
                case "STOP": stopTracking(); break;
                case "UPDATE_WALK_ID": updateWalkId(...); break;
                case "MARK_BACKGROUNDED": break;
                case "MARK_FOREGROUNDED": break;
            }
        }
        return START_STICKY;  // Sistema pot reiniciar
    }
}
```

**⚠️ START_STICKY** — el sistema pot reiniciar el servei amb `intent=null`. Cal recuperar `walkId` de `SharedPreferences`.

## Persistència (BufferStore)

SharedPreferences a `pathguard_tracking`:
- `active_walk_id` — Int
- `device_token` — String
- `server_url` — String
- `pending_buffer` — JSON array
- `last_flush_failed` — Boolean
- `recovery_streak` — Int

**Recuperació a `onCreate()`:**
```java
@Override
public void onCreate() {
    super.onCreate();
    prefs = getSharedPreferences("pathguard_tracking", MODE_PRIVATE);
    int walkId = prefs.getInt(PREF_WALK_ID, 0);
    if (walkId > 0) {
        // Recuperar sessió
        String deviceToken = prefs.getString(PREF_DEVICE_TOKEN, null);
        String serverUrl = prefs.getString(PREF_SERVER_URL, null);
        if (deviceToken != null && serverUrl != null) {
            startTracking(walkId, deviceToken, serverUrl);
        }
    }
}
```

## Histeresi (recovery streak)

```java
private static final int RECOVERY_STREAK_THRESHOLD = 3;

public void onFlushResult(boolean success) {
    if (success) {
        recoveryStreak = 0;
        lastFlushFailed = false;
        clear();
    } else {
        recoveryStreak += 1;
        if (recoveryStreak >= RECOVERY_STREAK_THRESHOLD) {
            lastFlushFailed = true;
        }
        // Re-add batch (no perdre punts)
        for (LocationPoint p : batch) {
            p.isRecovered = true;
            buffer.add(p);
        }
        save();
    }
}
```

## HTTP Client (OkHttp)

```java
OkHttpClient client = new OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(15, TimeUnit.SECONDS)
    .build();

RequestBody body = RequestBody.create(
    MediaType.parse("application/json"),
    jsonPayload
);

Request request = new Request.Builder()
    .url(serverUrl + "/locations/batch")
    .addHeader("X-Patient-Token", deviceToken)
    .post(body)
    .build();
```

## Foreground Notification

```java
public class NotificationHelper {
    private static final int NOTIFICATION_ID = 1001;
    
    public static void showTrackingNotification(Context context, int walkId) {
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        
        Notification notification = new NotificationCompat.Builder(context, "pathguard_tracking")
            .setContentTitle("PathGuard")
            .setContentText("Seguiment del passeig actiu")
            .setSmallIcon(R.drawable.ic_pathguard)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
        
        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification);
    }
}
```

## Permisos (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />  <!-- API 33+ -->
```

**Runtime requests** (API 33+):
1. ACCESS_FINE_LOCATION (sempre)
2. POST_NOTIFICATIONS (API 33+)
3. FOREGROUND_SERVICE_LOCATION (API 34+)

## Riscos específics Android

1. **Doze mode** — pauses background services. `WakeLock` + foreground service.
2. **OEM killing** — Xiaomi, Samsung, Huawei maten serveis agressivament. `START_STICKY` + `SharedPreferences` recovery.
3. **Mock locations** — `isFromMockProvider()` gate.
4. **Android 14** — `FOREGROUND_SERVICE_LOCATION` runtime required.
5. **Background location limits** (API 29+) — requereix `ACCESS_BACKGROUND_LOCATION`.

## Build

```bash
cd frontend/android
./gradlew assembleDebug    # APK debug
./gradlew assembleRelease  # APK release (signing)
./gradlew test             # Tests JUnit (cap actualment)
```

## Testing (deute tècnic)

Caldria:

```java
// src/test/java/com/pathguard/app/plugin/
//   LocationAcquirerTest.java
//     test_passesAccuracyGate_above50m_fails()
//     test_passesFixAgeGate_above10s_fails()
//     test_passesMockGate_mockLocation_fails()
//     test_passesAntiJitterGate_below15m_fails()
//     test_passesTeleportGate_above80mIn5s_fails()
//     test_passesSpeedGate_above5ms_fails()
//   
//   LocationBufferTest.java
//     test_onFlushResult_false_reAddsBatch()
//     test_recoveryStreak_incrementsOnFailure()
//     test_isRecovered_true_forLoadedPoints()
//   
//   BufferStoreTest.java
//     test_saveAndLoad_buffer_persists()
//     test_saveAndLoad_lastFlushFailed_persists()
```

## Issues prioritzats (audit 2026-06-16)

| # | Severitat | Issue | SPEC |
|---|---|---|---|
| 1 | **Crítica** | 3 fitxers eliminats a `feat/ios-native-layer` (`BufferStore.java`, `LocationHttpClient.java`, `LocationSyncForegroundService.java`) | **SPEC-010** |
| 2 | Mitjana | (post-beta) | |

## Proves de camp

**Dispositiu:** Redmi (testat parcialment 2026-06-10)

**Escenaris:**
1. Walk 15 min
2. Mode avió 5 min
3. Screen-off 30 min
4. Kill app
5. Reobrir (recuperar walkId)

**Criteri d'èxit:** zero pèrdua, ruta coherent.
