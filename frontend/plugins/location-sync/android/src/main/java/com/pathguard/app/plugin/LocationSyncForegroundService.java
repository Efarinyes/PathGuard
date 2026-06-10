package com.pathguard.app.plugin;

import android.app.ActivityManager;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.IBinder;

import androidx.annotation.Nullable;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class LocationSyncForegroundService extends Service {

    private static final int FLUSH_INTERVAL_SECONDS = 5;
    private static final String PREF_FILE = "pathguard_tracking";
    private static final String PREF_WALK_ID = "active_walk_id";
    private static final String PREF_DEVICE_TOKEN = "device_token";
    private static final String PREF_SERVER_URL = "server_url";

    private static boolean running = false;
    private static int pointsSent = 0;
    private static String lastSentAt = null;
    private static final AtomicBoolean appInForeground = new AtomicBoolean(true);

    private LocationAcquirer acquirer;
    private LocationBuffer locationBuffer;
    private LocationHttpClient httpClient;
    private ScheduledExecutorService scheduler;
    private String serverUrl;
    private String deviceToken;
    private int walkId;
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

        BufferStore bufferStore = new BufferStore(this);
        locationBuffer = new LocationBuffer(bufferStore);
        httpClient = new LocationHttpClient();
        acquirer = new LocationAcquirer(this);

        SharedPreferences prefs = getSharedPreferences(PREF_FILE, MODE_PRIVATE);
        walkId = prefs.getInt(PREF_WALK_ID, 0);
        deviceToken = prefs.getString(PREF_DEVICE_TOKEN, null);
        serverUrl = prefs.getString(PREF_SERVER_URL, null);

        if (!locationBuffer.isEmpty() && serverUrl != null && deviceToken != null) {
            scheduler = Executors.newSingleThreadScheduledExecutor();
            scheduler.schedule(this::flushBuffer, 1, TimeUnit.SECONDS);
        }
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            switch (intent.getAction()) {
                case "START":
                    serverUrl = intent.getStringExtra("serverUrl");
                    deviceToken = intent.getStringExtra("deviceToken");
                    int newWalkId = intent.getIntExtra("walkId", 0);
                    if (newWalkId != walkId) {
                        BufferStore bufferStore = new BufferStore(this);
                        locationBuffer = new LocationBuffer(bufferStore);
                        walkId = newWalkId;
                    }
                    acquirer.setWalkId(walkId);
                    getSharedPreferences(PREF_FILE, MODE_PRIVATE).edit()
                        .putInt(PREF_WALK_ID, walkId)
                        .putString(PREF_DEVICE_TOKEN, deviceToken)
                        .putString(PREF_SERVER_URL, serverUrl)
                        .apply();
                    startTracking();
                    break;

                case "STOP":
                    stopTracking();
                    getSharedPreferences(PREF_FILE, MODE_PRIVATE).edit()
                        .remove(PREF_WALK_ID)
                        .remove(PREF_DEVICE_TOKEN)
                        .remove(PREF_SERVER_URL)
                        .apply();
                    new BufferStore(this).clear();
                    stopSelf();
                    break;

                case "UPDATE_WALK_ID":
                    walkId = intent.getIntExtra("walkId", 0);
                    acquirer.setWalkId(walkId);
                    getSharedPreferences(PREF_FILE, MODE_PRIVATE).edit()
                        .putInt(PREF_WALK_ID, walkId).apply();
                    break;

                case "MARK_BACKGROUNDED":
                    appInForeground.set(false);
                    break;

                case "MARK_FOREGROUNDED":
                    appInForeground.set(true);
                    break;
            }
        } else {
            if (walkId > 0 && deviceToken != null && serverUrl != null) {
                acquirer.setWalkId(walkId);
                startTracking();
            }
        }

        return START_STICKY;
    }

    private void onPointAccepted(LocationPoint point) {
        point.isRecovered = locationBuffer.getLastFlushFailed() || !isAppInForeground();
        locationBuffer.add(point);
        scheduleFlush();
    }

    private boolean isAppInForeground() {
        if (appInForeground.get()) {
            return true;
        }
        ActivityManager.RunningAppProcessInfo processInfo = new ActivityManager.RunningAppProcessInfo();
        ActivityManager.getMyMemoryState(processInfo);
        return processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
            || processInfo.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
    }

    private void startTracking() {
        if (running) return;
        running = true;
        pointsSent = 0;
        lastSentAt = null;

        acquirer.start(this::onPointAccepted);
        if (!locationBuffer.isEmpty()) {
            flushBuffer();
        }

        scheduler = Executors.newSingleThreadScheduledExecutor();
        scheduler.scheduleAtFixedRate(this::flushBuffer, FLUSH_INTERVAL_SECONDS, FLUSH_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    private void stopTracking() {
        running = false;
        acquirer.stop();
        flushBuffer();
        if (scheduler != null && !scheduler.isShutdown()) {
            scheduler.shutdown();
            scheduler = null;
        }
    }

    private void scheduleFlush() {
        if (scheduler == null || scheduler.isShutdown()) return;
        scheduler.schedule(this::flushBuffer, 1, TimeUnit.SECONDS);
    }

    private void flushBuffer() {
        if (locationBuffer.isEmpty()) return;
        if (serverUrl == null || deviceToken == null) return;

        List<LocationPoint> batch = locationBuffer.drainAll();
        if (batch.isEmpty()) return;

        boolean success = httpClient.sendBatch(batch, walkId, deviceToken, serverUrl, isoFormatter);

        if (success) {
            pointsSent += batch.size();
            lastSentAt = isoFormatter.format(new Date());
            locationBuffer.onFlushSuccess();
        } else {
            locationBuffer.onFlushFailure(batch);
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
}
