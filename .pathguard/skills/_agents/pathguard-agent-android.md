---
name: pathguard-agent-android
description: |
  Rol: Agent Android Native. Propietari de la capa Java/Kotlin
  del plugin Capacitor per Android. Carregar quan la tasca
  afecta LocationAcquirer, BufferStore, ForegroundService o Gradle.
triggers:
  - Qualsevol canvi a frontend/plugins/location-sync/android/
  - Canvis a frontend/android/app/src/main/
  - Gradle, manifest, recursos Android
  - Tests JUnit natius nous o modificats
agent_owner: android
prerequisites:
  - pathguard-state
  - pathguard-golden-rules
---

# Agent Android Native

## Propietat (DOMINI)

Pots modificar lliurement:

```
frontend/plugins/location-sync/android/      (plugin LocationSync)
frontend/android/app/src/main/               (app nativa)
frontend/android/app/src/main/AndroidManifest.xml
frontend/android/app/src/main/res/           (recursos, icones, splash)
frontend/android/build.gradle
frontend/android/app/build.gradle
frontend/android/settings.gradle
frontend/android/variables.gradle
frontend/android/gradle.properties
frontend/android/capacitor.settings.gradle
```

## Propietat (READ-ONLY)

- `frontend/plugins/location-sync/src/index.ts` — **contracte TS**, no tocar
- `frontend/plugins/location-sync/Package.swift` — **iOS**, no tocar
- `frontend/capacitor.config.ts` — **Platform Integration**

## No tocar MAI

- Res de `frontend/app/`, `frontend/components/`, etc.
- Res de Swift / iOS
- `frontend/android/local.properties` (és de màquina, gitignored)
- `.gradle/`, `build/` (sempre gitignored)

## Contracte amb el bridge TS

Interfície implementada a `LocationSyncPlugin.java`:

```java
@PluginMethod startTracking(call: PluginCall)   // walkId, deviceToken, serverUrl
@PluginMethod stopTracking(call: PluginCall)
@PluginMethod updateWalkId(call: PluginCall)     // walkId
@PluginMethod getStatus(call: PluginCall)        // isTracking, pointsSent, lastSentAt
@PluginMethod markBackgrounded(call: PluginCall)
@PluginMethod markForegrounded(call: PluginCall)
```

**Regla:** la signatura és **IMMUTABLE** excepte canvis coordinats amb Platform Integration. Canvis d'implementació interna, sí.

## Arquitectura del plugin

| Fitxer | Responsabilitat |
|---|---|
| `LocationSyncPlugin.java` | Bridge Capacitor (Plugin) |
| `LocationSyncForegroundService.java` | Foreground service, orquestrador |
| `LocationAcquirer.java` | `FusedLocationProviderClient` + gates |
| `LocationBuffer.java` | Cua en memòria amb `PriorityQueue` |
| `BufferStore.java` | Persistència a `SharedPreferences` |
| `LocationHttpClient.java` | OkHttp, batch POST |
| `LocationPoint.java` | Model (lat, lng, ts, clientId, isRecovered) |
| `NotificationHelper.java` | Notificació foreground persistent |

**SRP estricte.** Cada classe té una sola raó de canvi.

## Filtres GPS (gates)

A `LocationAcquirer`:

| Gate | Funció | Valor |
|---|---|---|
| Accuracy | `location.getAccuracy() <= 50m` | `MAX_ACCURACY_M=50` |
| Fix age | `now - location.getTime() <= 10s` | `MAX_FIX_AGE_MS=10_000` |
| Mock | `!location.isFromMockProvider()` | (Android 18+) |
| Anti-jitter | `distance < 15m` | `MIN_DISTANCE_M=15` |
| Teleport | `distance > 80m && dt < 5s` | `MAX_JUMP_M=80` |
| Speed | `distance/dt <= 5 m/s` | `MAX_SPEED_MS=5` |

## Intervals

| Constant | Valor | Motiu |
|---|---|---|
| `LOCATION_INTERVAL_MS` | 15_000 | 15s base |
| `LOCATION_FASTEST_INTERVAL_MS` | 5_000 | 5s fastest |
| `FLUSH_DELAY_SECONDS` | 2 | 2s post-punt (on-demand) |
| `IDLE_INTERVAL_SECONDS` | 30 | 30s safety net |

**Important:** aliniat amb `frontend/lib/config.ts` (Phase F).

## Build

```bash
cd frontend/android
./gradlew assembleDebug           # APK debug
./gradlew assembleRelease         # APK release (cal signing)
./gradlew test                    # Tests JUnit
```

## Testing

**Actualment zero tests unitaris natius.** Es recomana XCTest + JUnit per gates i buffer (post-beta).

Per validar:
1. Compilació: `./gradlew assembleDebug` ha d'acabar sense errors
2. APK: instal·lar al dispositiu
3. Walk real: 15 min amb screen-off per validar Doze

## Permisos (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />  <!-- Android 13+ -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.INTERNET" />
```

## Riscos específics Android

1. **Doze mode** — Android pausa serveis en background. `WakeLock` + foreground service.
2. **OEM killing** — Xiaomi, Samsung, Huawei maten serveis agressivament. `START_STICKY` + `SharedPreferences` per recuperar estat.
3. **Mock locations** — gate explícit a `LocationAcquirer`.
4. **Android 14** — requereix `FOREGROUND_SERVICE_LOCATION` runtime.
5. **Mock provider attacks** — apps malicioses poden injectar punts falsos.

## Errors comuns

❌ Usar `print()` en lloc de `android.util.Log` (millor: `Logger` de Capacitor)
❌ State en memòria (cal persistir a `SharedPreferences` per kill app)
❌ Hardcoded intervals (usar constants de `lib/config.ts` via bridge)
❌ Hardcoded URLs (rebre del bridge)
❌ Permisos en manifest però no request runtime

## Recursos

- `.pathguard/skills/_domain/pathguard-android-plugin.md` (detall arquitectura)
- `.pathguard/skills/_domain/pathguard-android-build.md` (Gradle, signing)
- `.pathguard/skills/_domain/pathguard-bridge-contract.md` (contracte TS)
