package com.pathguard.app.plugin;

import android.content.Context;
import android.location.Location;
import android.os.Build;
import android.os.Looper;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;

import java.security.MessageDigest;
import java.util.Locale;
import java.util.UUID;

public class LocationAcquirer {
    private static final float MIN_DISTANCE_M = 15.0f;
    private static final float MAX_ACCURACY_M = 50.0f;
    private static final float MAX_JUMP_M = 80.0f;
    private static final float MAX_SPEED_MS = 5.0f;
    private static final long MAX_FIX_AGE_MS = 10_000;

    private final FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;
    private LocationPoint lastAcceptedPoint;
    private AcceptorCallback callback;
    private int walkId;
    private boolean running;

    public interface AcceptorCallback {
        void onLocationAccepted(LocationPoint point);
    }

    public LocationAcquirer(Context context) {
        this.fusedLocationClient = LocationServices.getFusedLocationProviderClient(context);
    }

    public void setWalkId(int walkId) {
        this.walkId = walkId;
    }

    public boolean isRunning() {
        return running;
    }

    public void start(AcceptorCallback callback) {
        if (running) return;
        this.callback = callback;
        running = true;
        lastAcceptedPoint = null;

        LocationRequest locationRequest = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 22000)
                .setMinUpdateIntervalMillis(8000)
                .setMinUpdateDistanceMeters(30)
                .build();

        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                for (Location location : locationResult.getLocations()) {
                    processLocation(location);
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
        }
    }

    public void stop() {
        running = false;
        if (locationCallback != null && fusedLocationClient != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
            locationCallback = null;
        }
        lastAcceptedPoint = null;
    }

    private void processLocation(Location location) {
        if (!passesAccuracyGate(location)) return;
        if (!passesFixAgeGate(location)) return;

        double lat = location.getLatitude();
        double lng = location.getLongitude();
        long nowMs = location.getTime();

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
        lastAcceptedPoint = point;

        if (callback != null) {
            callback.onLocationAccepted(point);
        }
    }

    private boolean passesAccuracyGate(Location location) {
        return location.hasAccuracy() && location.getAccuracy() <= MAX_ACCURACY_M;
    }

    private boolean passesFixAgeGate(Location location) {
        return System.currentTimeMillis() - location.getTime() <= MAX_FIX_AGE_MS;
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
}