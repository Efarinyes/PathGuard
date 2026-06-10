package com.pathguard.app.plugin;

import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;

public class LocationBuffer {
    private static final int BUFFER_MAX_SIZE = 200;
    private final PriorityQueue<LocationPoint> buffer;
    private final BufferStore store;
    private boolean lastFlushFailed;

    public LocationBuffer(BufferStore store) {
        this.store = store;
        this.buffer = store.load();
        this.lastFlushFailed = store.getLastFlushFailed();
        for (LocationPoint p : buffer) {
            p.isRecovered = true;
        }
    }

    public void add(LocationPoint point) {
        buffer.add(point);
        if (buffer.size() > BUFFER_MAX_SIZE) {
            buffer.poll();
        }
    }

    public List<LocationPoint> drainAll() {
        List<LocationPoint> batch = new ArrayList<>();
        while (!buffer.isEmpty()) {
            batch.add(buffer.poll());
        }
        return batch;
    }

    public void onFlushFailure(List<LocationPoint> batch) {
        lastFlushFailed = true;
        buffer.addAll(batch);
        store.save(buffer, true);
    }

    public void onFlushSuccess() {
        lastFlushFailed = false;
        store.clear();
    }

    public boolean isEmpty() {
        return buffer.isEmpty();
    }

    public boolean getLastFlushFailed() {
        return lastFlushFailed;
    }

    public void setLastFlushFailed(boolean failed) {
        this.lastFlushFailed = failed;
    }
}