package com.pathguard.app.plugin;

import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Comparator;
import java.util.Date;
import java.util.Locale;
import java.util.PriorityQueue;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;

public class LocationSyncForegroundService extends Service {

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private static final int FLUSH_INTERVAL_SECONDS = 5;
    private static final int BUFFER_MAX_SIZE = 100;
    private static final int LOCATION_INTERVAL_MS = 5000;
    private static final int LOCATION_FASTEST_INTERVAL_MS = 2000;

    // Sprint 2.3 — SharedPreferences keys
    private static final String PREF_FILE = "pathguard_tracking";
    private static final String PREF_WALK_ID = "active_walk_id";
    private static final String PREF_DEVICE_TOKEN = "device_token";
    private static final String PREF_SERVER_URL = "server_url";

    // Sprint 1.1 — GPS Filter constants
    private static final float MIN_DISTANCE_M = 25.0f;
    private static final float MAX_JUMP_M = 80.0f;
    private static final float MAX_ACCURACY_M = 50.0f;
    private static final float MAX_SPEED_MS = 5.0f;
    private static final long MAX_FIX_AGE_MS = 10_000;

    private static boolean running = false;
    private static int pointsSent = 0;
    private boolean lastFlushFailed = false;
    private static String lastSentAt = null;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private SharedPreferences prefs;
    private LocationPoint lastAcceptedPoint = null;
    private final PriorityQueue<LocationPoint> buffer = new PriorityQueue<>(
            Comparator.comparingLong(p -> p.timestampMs)
    );
    private ScheduledExecutorService scheduler;
    private OkHttpClient httpClient;
    private String serverUrl;
    private String deviceToken;
    private int walkId;
    private final Gson gson = new Gson();
    private final SimpleDateFormat isoFormatter;

    public LocationSyncForegroundService() {
        isoFormatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        isoFormatter.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    public static boolean isRunning() {
        return running;
    }

    public static int getPointsSent() {
        return pointsSent;
    }

    public static String getLastSentAt() {
        return lastSentAt;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationHelper.createChannel(this);
        startForeground(NotificationHelper.NOTIFICATION_ID, NotificationHelper.buildNotification(this));
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .writeTimeout(10, TimeUnit.SECONDS)
                .readTimeout(10, TimeUnit.SECONDS)
                .build();
        prefs = getSharedPreferences(PREF_FILE, MODE_PRIVATE);
        walkId = prefs.getInt(PREF_WALK_ID, 0);
        deviceToken = prefs.getString(PREF_DEVICE_TOKEN, null);
        serverUrl = prefs.getString(PREF_SERVER_URL, null);
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            switch (intent.getAction()) {
                case "START":
                    serverUrl = intent.getStringExtra("serverUrl");
                    deviceToken = intent.getStringExtra("deviceToken");
                    walkId = intent.getIntExtra("walkId", 0);
                    prefs.edit()
                        .putInt(PREF_WALK_ID, walkId)
                        .putString(PREF_DEVICE_TOKEN, deviceToken)
                        .putString(PREF_SERVER_URL, serverUrl)
                        .apply();
                    startTracking();
                    break;

                case "STOP":
                    stopTracking();
                    prefs.edit()
                        .remove(PREF_WALK_ID)
                        .remove(PREF_DEVICE_TOKEN)
                        .remove(PREF_SERVER_URL)
                        .apply();
                    stopSelf();
                    break;

                case "UPDATE_WALK_ID":
                    walkId = intent.getIntExtra("walkId", 0);
                    prefs.edit().putInt(PREF_WALK_ID, walkId).apply();
                    break;
            }
        } else {
            // START_STICKY restart without intent — recover from prefs (already restored in onCreate)
            if (walkId > 0 && deviceToken != null && serverUrl != null) {
                startTracking();
            }
        }

        return START_STICKY;
    }

    private void startTracking() {
        if (running) return;
        running = true;
        pointsSent = 0;
        lastSentAt = null;
        lastAcceptedPoint = null;

        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MS)
                .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL_MS)
                .setMinUpdateDistanceMeters(15)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    addToBuffer(location);
                }
            }
        };

        try {
            fusedLocationClient.requestLocationUpdates(
                    locationRequest,
                    locationCallback,
                    Looper.getMainLooper()
            );
        } catch (SecurityException e) {
            running = false;
            stopSelf();
            return;
        }

        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(this::flushBuffer, FLUSH_INTERVAL_SECONDS, FLUSH_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    private void stopTracking() {
        running = false;

        if (locationCallback != null && fusedLocationClient != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
        }

        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdown();
            scheduler = null;
        }

        flushBuffer();
    }

    // --- GPS Filter Gates (Sprint 1.1 — SRP: one method per gate) ---

    private boolean passesAccuracyGate(Location location) {
        return location.hasAccuracy() && location.getAccuracy() <= MAX_ACCURACY_M;
    }

    private boolean passesFixAgeGate(Location location) {
        return System.currentTimeMillis() - location.getTime() <= MAX_FIX_AGE_MS;
    }

    private boolean passesMockGate(Location location) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR2) {
            return !location.isFromMockProvider();
        }
        return true;
    }

    private boolean passesAntiJitterGate(LocationPoint candidate) {
        if (lastAcceptedPoint == null) return true;
        double distance = haversine(
                lastAcceptedPoint.latitude, lastAcceptedPoint.longitude,
                candidate.latitude, candidate.longitude
        );
        return distance >= MIN_DISTANCE_M;
    }

    private boolean passesTeleportGate(LocationPoint candidate, long elapsedMs) {
        if (lastAcceptedPoint == null || elapsedMs > 5000) return true;
        double distance = haversine(
                lastAcceptedPoint.latitude, lastAcceptedPoint.longitude,
                candidate.latitude, candidate.longitude
        );
        return distance <= MAX_JUMP_M;
    }

    private boolean passesSpeedGate(double distance, long elapsedMs) {
        if (elapsedMs <= 0) return false;
        double speedMs = distance / (elapsedMs / 1000.0);
        return speedMs <= MAX_SPEED_MS;
    }

    // --- Haversine distance (metres) ---

    private static double haversine(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6371000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // --- Deterministic client_id (SHA-256) ---

    private String generateClientId(long timestampMs, double lat, double lng) {
        try {
            String input = timestampMs + ":"
                    + String.format(Locale.US, "%.6f", lat) + ":"
                    + String.format(Locale.US, "%.6f", lng) + ":"
                    + walkId;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return UUID.randomUUID().toString();
        }
    }

    // --- Buffer management (Sprint 1.1 + 1.2) ---

    private void addToBuffer(Location location) {
        if (!passesAccuracyGate(location)) return;
        if (!passesFixAgeGate(location)) return;
        if (!passesMockGate(location)) return;

        double lat = location.getLatitude();
        double lng = location.getLongitude();
        long nowMs = System.currentTimeMillis();

        LocationPoint candidate = new LocationPoint(lat, lng, nowMs, "");

        if (!passesAntiJitterGate(candidate)) return;

        long elapsedMs = lastAcceptedPoint != null ? nowMs - lastAcceptedPoint.timestampMs : 0;
        if (!passesTeleportGate(candidate, elapsedMs)) return;

        if (lastAcceptedPoint != null) {
            double distance = haversine(
                    lastAcceptedPoint.latitude, lastAcceptedPoint.longitude,
                    lat, lng
            );
            if (!passesSpeedGate(distance, elapsedMs)) return;
        }

        String clientId = generateClientId(nowMs, lat, lng);
        LocationPoint point = new LocationPoint(lat, lng, nowMs, clientId);
        point.isRecovered = lastFlushFailed;
        lastAcceptedPoint = point;

        if (buffer.size() >= BUFFER_MAX_SIZE) {
            buffer.poll();
        }
        buffer.add(point);
    }

    private void flushBuffer() {
        if (buffer.isEmpty()) return;
        if (serverUrl == null || deviceToken == null) return;

        PriorityQueue<LocationPoint> batch = new PriorityQueue<>(Comparator.comparingLong(p -> p.timestampMs));
        LocationPoint point;
        while ((point = buffer.poll()) != null) {
            batch.add(point);
        }

        if (batch.isEmpty()) return;

        JsonArray pointsArray = new JsonArray();
        for (LocationPoint p : batch) {
            JsonObject obj = new JsonObject();
            obj.addProperty("latitude", p.latitude);
            obj.addProperty("longitude", p.longitude);
            obj.addProperty("timestamp", isoFormatter.format(new Date(p.timestampMs)));
            obj.addProperty("client_id", p.clientId);
            obj.addProperty("walk_id", walkId);
            obj.addProperty("is_recovered", p.isRecovered);
            pointsArray.add(obj);
        }

        JsonObject body = new JsonObject();
        body.addProperty("walk_id", walkId);
        body.addProperty("batch_id", UUID.randomUUID().toString());
        body.add("points", pointsArray);

        String url = serverUrl.replaceAll("/$", "") + "/locations/batch";

        Request request = new Request.Builder()
                .url(url)
                .header("Content-Type", "application/json")
                .header("X-Patient-Token", deviceToken)
                .post(RequestBody.create(body.toString(), JSON))
                .build();

        try {
            okhttp3.Response response = httpClient.newCall(request).execute();
            if (response.isSuccessful() || response.code() == 409) {
                pointsSent += batch.size();
                lastSentAt = isoFormatter.format(new Date());
                lastFlushFailed = false;
            } else {
                lastFlushFailed = true;
                for (LocationPoint p : batch) {
                    buffer.add(p);
                }
            }
            response.close();
        } catch (Exception e) {
            lastFlushFailed = true;
            for (LocationPoint p : batch) {
                buffer.add(p);
            }
        }
    }

    @Override
    public void onDestroy() {
        stopTracking();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private static class LocationPoint {
        final double latitude;
        final double longitude;
        final long timestampMs;
        final String clientId;
        boolean isRecovered;

        LocationPoint(double latitude, double longitude, long timestampMs, String clientId) {
            this.latitude = latitude;
            this.longitude = longitude;
            this.timestampMs = timestampMs;
            this.clientId = clientId;
            this.isRecovered = false;
        }
    }
}
