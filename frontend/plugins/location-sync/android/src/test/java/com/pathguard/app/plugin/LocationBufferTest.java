package com.pathguard.app.plugin;

import org.junit.Before;
import org.junit.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.PriorityQueue;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class LocationBufferTest {

    private FakeBufferPersistence store;

    @Before
    public void setUp() {
        store = new FakeBufferPersistence();
    }

    @Test
    public void test_initWithStoredPoints_marksAllRecovered() {
        LocationPoint stored = new LocationPoint(41.5, 2.4, 1_000L, "cid-1");
        stored.isRecovered = false;
        store.seed(stored);

        LocationBuffer buffer = new LocationBuffer(store);
        List<LocationPoint> drained = buffer.drainAll();

        assertEquals(1, drained.size());
        assertTrue(drained.get(0).isRecovered);
    }

    @Test
    public void test_addNewPoint_isNotRecovered() {
        LocationBuffer buffer = new LocationBuffer(store);
        LocationPoint point = new LocationPoint(41.5, 2.4, 2_000L, "cid-2");

        buffer.add(point);
        List<LocationPoint> drained = buffer.drainAll();

        assertEquals(1, drained.size());
        assertFalse(drained.get(0).isRecovered);
    }

    @Test
    public void test_onFlushFailure_reAddsBatchAsRecovered() {
        LocationBuffer buffer = new LocationBuffer(store);
        LocationPoint point = new LocationPoint(41.5, 2.4, 3_000L, "cid-3");
        List<LocationPoint> batch = new ArrayList<>();
        batch.add(point);

        buffer.onFlushFailure(batch);
        List<LocationPoint> drained = buffer.drainAll();

        assertEquals(1, drained.size());
        assertTrue(drained.get(0).isRecovered);
    }

    @Test
    public void test_recoveryStreak_incrementsOnFailure() {
        LocationBuffer buffer = new LocationBuffer(store);
        LocationPoint point = new LocationPoint(41.5, 2.4, 4_000L, "cid-4");
        List<LocationPoint> batch = new ArrayList<>();
        batch.add(point);

        buffer.onFlushFailure(batch);
        assertFalse(buffer.getLastFlushFailed());
        assertEquals(1, buffer.getRecoveryStreak());

        buffer.onFlushFailure(batch);
        assertFalse(buffer.getLastFlushFailed());
        assertEquals(2, buffer.getRecoveryStreak());

        buffer.onFlushFailure(batch);
        assertTrue(buffer.getLastFlushFailed());
        assertEquals(3, buffer.getRecoveryStreak());
    }

    @Test
    public void test_recoveryStreak_resetsOnSuccess() {
        LocationBuffer buffer = new LocationBuffer(store);
        LocationPoint point = new LocationPoint(41.5, 2.4, 5_000L, "cid-5");
        List<LocationPoint> batch = new ArrayList<>();
        batch.add(point);

        buffer.onFlushFailure(batch);
        buffer.onFlushFailure(batch);
        assertFalse(buffer.getLastFlushFailed());
        assertEquals(2, buffer.getRecoveryStreak());

        buffer.onFlushSuccess();
        assertFalse(buffer.getLastFlushFailed());
        assertEquals(0, buffer.getRecoveryStreak());
        assertTrue(store.cleared);
    }

    /** In-memory BufferPersistence for JVM unit tests (no Android Context). */
    private static final class FakeBufferPersistence implements BufferPersistence {
        private final PriorityQueue<LocationPoint> seeded = new PriorityQueue<>();
        private boolean lastFlushFailed;
        private int recoveryStreak;
        boolean cleared;

        void seed(LocationPoint point) {
            seeded.add(point);
        }

        @Override
        public void save(PriorityQueue<LocationPoint> buffer, boolean lastFlushFailed, int recoveryStreak) {
            this.lastFlushFailed = lastFlushFailed;
            this.recoveryStreak = recoveryStreak;
            cleared = false;
        }

        @Override
        public PriorityQueue<LocationPoint> load() {
            return new PriorityQueue<>(seeded);
        }

        @Override
        public boolean getLastFlushFailed() {
            return lastFlushFailed;
        }

        @Override
        public int getRecoveryStreak() {
            return recoveryStreak;
        }

        @Override
        public void clear() {
            seeded.clear();
            lastFlushFailed = false;
            recoveryStreak = 0;
            cleared = true;
        }
    }
}
