package com.pathguard.app.plugin;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.PriorityQueue;

public class BufferStore {
    private static final String PREF_FILE = "pathguard_tracking";
    private static final String PREF_BUFFER = "pending_buffer";
    private static final String PREF_LAST_FLUSH_FAILED = "last_flush_failed";
    private final SharedPreferences prefs;
    private final Gson gson = new Gson();

    public BufferStore(Context context) {
        this.prefs = context.getSharedPreferences(PREF_FILE, Context.MODE_PRIVATE);
    }

    public void save(PriorityQueue<LocationPoint> buffer, boolean lastFlushFailed) {
        JsonArray array = new JsonArray();
        for (LocationPoint p : buffer) {
            array.add(p.toJson());
        }
        prefs.edit()
            .putString(PREF_BUFFER, gson.toJson(array))
            .putBoolean(PREF_LAST_FLUSH_FAILED, lastFlushFailed)
            .apply();
    }

    public PriorityQueue<LocationPoint> load() {
        String json = prefs.getString(PREF_BUFFER, null);
        if (json == null) return new PriorityQueue<>();

        JsonArray array = gson.fromJson(json, JsonArray.class);
        PriorityQueue<LocationPoint> buffer = new PriorityQueue<>();
        for (int i = 0; i < array.size(); i++) {
            buffer.add(LocationPoint.fromJson(array.get(i).getAsJsonObject()));
        }
        return buffer;
    }

    public boolean getLastFlushFailed() {
        return prefs.getBoolean(PREF_LAST_FLUSH_FAILED, false);
    }

    public void clear() {
        prefs.edit()
            .remove(PREF_BUFFER)
            .remove(PREF_LAST_FLUSH_FAILED)
            .apply();
    }
}
