package com.pathguard.app.plugin;

import java.util.PriorityQueue;

/**
 * Persistence seam for LocationBuffer. Keeps buffer logic unit-testable
 * without Android SharedPreferences / Context.
 */
public interface BufferPersistence {
    void save(PriorityQueue<LocationPoint> buffer, boolean lastFlushFailed, int recoveryStreak);

    PriorityQueue<LocationPoint> load();

    boolean getLastFlushFailed();

    int getRecoveryStreak();

    void clear();
}
