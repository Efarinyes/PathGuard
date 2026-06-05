package com.pathguard.app.plugin;

import com.google.gson.JsonObject;

public class LocationPoint implements Comparable<LocationPoint> {
    public double latitude;
    public double longitude;
    public long timestampMs;
    public String clientId;
    public boolean isRecovered;

    public LocationPoint() {}

    public LocationPoint(double latitude, double longitude, long timestampMs, String clientId) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.timestampMs = timestampMs;
        this.clientId = clientId;
        this.isRecovered = false;
    }

    @Override
    public int compareTo(LocationPoint other) {
        return Long.compare(this.timestampMs, other.timestampMs);
    }

    public JsonObject toJson() {
        JsonObject obj = new JsonObject();
        obj.addProperty("lat", latitude);
        obj.addProperty("lng", longitude);
        obj.addProperty("ts", timestampMs);
        obj.addProperty("cid", clientId);
        obj.addProperty("rec", isRecovered);
        return obj;
    }

    public static LocationPoint fromJson(JsonObject obj) {
        LocationPoint p = new LocationPoint();
        p.latitude = obj.get("lat").getAsDouble();
        p.longitude = obj.get("lng").getAsDouble();
        p.timestampMs = obj.get("ts").getAsLong();
        p.clientId = obj.get("cid").getAsString();
        p.isRecovered = obj.has("rec") && obj.get("rec").getAsBoolean();
        return p;
    }
}
