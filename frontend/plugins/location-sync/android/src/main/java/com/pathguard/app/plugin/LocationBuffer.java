package com.pathguard.app.plugin;

import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;

public class LocationBuffer {
    private static final int BUFFER_MAX_SIZE = 200;
    private static final int RECOVERY_STREAK_THRESHOLD = 3;
    private final PriorityQueue<LocationPoint> buffer;
    private final BufferStore store;
    private boolean lastFlushFailed;
    private int recoveryStreak;

    public LocationBuffer(BufferStore store) {
        this.store = store;
        this.buffer = store.load();
        this.lastFlushFailed = store.getLastFlushFailed();
        this.recoveryStreak = store.getRecoveryStreak();
        for (LocationPoint p : buffer) {
            p.isRecovered = true;
        }
    }

    public synchronized void add(LocationPoint point) {
        buffer.add(point);
        if (buffer.size() > BUFFER_MAX_SIZE) {
            buffer.poll();
        }
    }

    public synchronized List<LocationPoint> drainAll() {
        List<LocationPoint> batch = new ArrayList<>();
        while (!buffer.isEmpty()) {
            batch.add(buffer.poll());
        }
        return batch;
    }

    public void onFlushFailure(List<LocationPoint> batch) {
        recoveryStreak = 0;
        lastFlushFailed = true;
        buffer.addAll(batch);
        store.save(buffer, true, recoveryStreak);
    }

    public void onFlushSuccess() {
        recoveryStreak++;
        if (recoveryStreak >= RECOVERY_STREAK_THRESHOLD) {
            lastFlushFailed = false;
        }
        store.clear();
    }

    public synchronized boolean isEmpty() {
        return buffer.isEmpty();
    }

    public boolean getLastFlushFailed() {
        return lastFlushFailed;
    }

    public void setLastFlushFailed(boolean failed) {
        this.lastFlushFailed = failed;
    }
}