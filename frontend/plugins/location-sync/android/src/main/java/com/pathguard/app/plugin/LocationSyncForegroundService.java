package com.pathguard.app.plugin;

import android.app.Service;
import android.content.Intent;
import android.location.Location;
import android.os.Handler;
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

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Queue;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
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

    private static boolean running = false;
    private static int pointsSent = 0;
    private static String lastSentAt = null;

    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private final Queue<LocationPoint> buffer = new ConcurrentLinkedQueue<>();
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
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            return START_STICKY;
        }

        switch (intent.getAction()) {
            case "START":
                serverUrl = intent.getStringExtra("serverUrl");
                deviceToken = intent.getStringExtra("deviceToken");
                walkId = intent.getIntExtra("walkId", 0);
                startTracking();
                break;

            case "STOP":
                stopTracking();
                stopSelf();
                break;

            case "UPDATE_WALK_ID":
                walkId = intent.getIntExtra("walkId", 0);
                break;
        }

        return START_STICKY;
    }

    private void startTracking() {
        if (running) return;
        running = true;
        pointsSent = 0;
        lastSentAt = null;

        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MS)
                .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL_MS)
                .setMinUpdateDistanceMeters(5)
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

    private void addToBuffer(Location location) {
        if (buffer.size() >= BUFFER_MAX_SIZE) {
            buffer.poll();
        }

        buffer.add(new LocationPoint(
                location.getLatitude(),
                location.getLongitude(),
                isoFormatter.format(new Date(location.getTime())),
                UUID.randomUUID().toString()
        ));
    }

    private void flushBuffer() {
        if (buffer.isEmpty()) return;
        if (serverUrl == null || deviceToken == null) return;

        final Queue<LocationPoint> batch = new ConcurrentLinkedQueue<>();
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
            obj.addProperty("timestamp", p.timestamp);
            obj.addProperty("client_id", p.clientId);
            obj.addProperty("walk_id", walkId);
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
            } else {
                for (LocationPoint p : batch) {
                    buffer.add(p);
                }
            }
            response.close();
        } catch (Exception e) {
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
        final String timestamp;
        final String clientId;

        LocationPoint(double latitude, double longitude, String timestamp, String clientId) {
            this.latitude = latitude;
            this.longitude = longitude;
            this.timestamp = timestamp;
            this.clientId = clientId;
        }
    }
}
