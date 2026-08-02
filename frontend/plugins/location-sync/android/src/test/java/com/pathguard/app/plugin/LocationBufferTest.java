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
    public void test_addDeferred_marksRecoveredAndPersists() {
        LocationBuffer buffer = new LocationBuffer(store);
        LocationPoint point = new LocationPoint(41.5, 2.4, 2_500L, "cid-2b");

        buffer.addDeferred(point, 42);

        assertEquals(1, store.savedSize());
        assertTrue(store.lastSavedWasRecovered());
        assertEquals(42, store.lastSavedWalkId());

        List<LocationPoint> drained = buffer.drainAll();
        assertEquals(1, drained.size());
        assertTrue(drained.get(0).isRecovered);
        assertEquals(42, drained.get(0).walkId);
    }

    @Test
    public void test_markPendingRecoveredAndPersist_flagsQueue() {
        LocationBuffer buffer = new LocationBuffer(store);
        LocationPoint live = new LocationPoint(41.5, 2.4, 2_600L, "cid-2c");
        buffer.add(live, 7);
        assertFalse(live.isRecovered);

        buffer.markPendingRecoveredAndPersist();

        assertEquals(1, store.savedSize());
        assertTrue(store.lastSavedWasRecovered());

        LocationBuffer reloaded = new LocationBuffer(store);
        List<LocationPoint> drained = reloaded.drainAll();
        assertEquals(1, drained.size());
        assertTrue(drained.get(0).isRecovered);
    }

    @Test
    public void test_persist_survivesReloadAsRecovered() {
        LocationBuffer buffer = new LocationBuffer(store);
        LocationPoint point = new LocationPoint(41.5, 2.4, 2_700L, "cid-2d");
        point.isRecovered = true;
        buffer.add(point, 9);
        buffer.persist();

        LocationBuffer reloaded = new LocationBuffer(store);
        assertEquals(1, reloaded.size());
        List<LocationPoint> drained = reloaded.drainAll();
        assertTrue(drained.get(0).isRecovered);
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

    @Test
    public void test_staleGpsPolicy_thresholds() {
        assertTrue(LocationAcquirer.shouldRequestFreshFix(90_000L, 90_000L));
        assertTrue(LocationAcquirer.shouldRequestFreshFix(120_000L, 90_000L));
        assertFalse(LocationAcquirer.shouldRequestFreshFix(89_999L, 90_000L));
        assertTrue(LocationAcquirer.shouldRequestFreshFix(Long.MAX_VALUE, 90_000L));
    }

    /** In-memory BufferPersistence for JVM unit tests (no Android Context). */
    private static final class FakeBufferPersistence implements BufferPersistence {
        private PriorityQueue<LocationPoint> seeded = new PriorityQueue<>();
        private boolean lastFlushFailed;
        private int recoveryStreak;
        boolean cleared;

        void seed(LocationPoint point) {
            seeded.add(point);
        }

        int savedSize() {
            return seeded.size();
        }

        boolean lastSavedWasRecovered() {
            if (seeded.isEmpty()) return false;
            for (LocationPoint p : seeded) {
                if (!p.isRecovered) return false;
            }
            return true;
        }

        int lastSavedWalkId() {
            if (seeded.isEmpty()) return 0;
            return seeded.peek().walkId;
        }

        @Override
        public void save(PriorityQueue<LocationPoint> buffer, boolean lastFlushFailed, int recoveryStreak) {
            this.lastFlushFailed = lastFlushFailed;
            this.recoveryStreak = recoveryStreak;
            this.seeded = new PriorityQueue<>();
            for (LocationPoint p : buffer) {
                this.seeded.add(copyPoint(p));
            }
            cleared = false;
        }

        @Override
        public PriorityQueue<LocationPoint> load() {
            PriorityQueue<LocationPoint> copy = new PriorityQueue<>();
            for (LocationPoint p : seeded) {
                copy.add(copyPoint(p));
            }
            return copy;
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

        private static LocationPoint copyPoint(LocationPoint src) {
            LocationPoint copy = new LocationPoint(
                    src.latitude, src.longitude, src.timestampMs, src.clientId);
            copy.walkId = src.walkId;
            copy.isRecovered = src.isRecovered;
            return copy;
        }
    }
}
