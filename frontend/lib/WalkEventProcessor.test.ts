import { describe, it, expect, beforeEach } from 'vitest';
import { WalkEventProcessor, WalkState, WalkAction } from './WalkEventProcessor';

describe('WalkEventProcessor - BATCH_LOCATION_UPDATE', () => {
  let processor: WalkEventProcessor;
  let initialState: WalkState;

  beforeEach(() => {
    processor = new WalkEventProcessor();
    initialState = {
      currentLocation: null,
      routeHistory: [],
      isActive: true
    };
  });

  it('should add multiple locations from batch to route history', () => {
    const batchPayload = {
      locations: [
        { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-05-07T10:00:00Z', walk_id: 1 },
        { latitude: 41.3852, longitude: 2.1735, timestamp: '2026-05-07T10:01:00Z', walk_id: 1 },
        { latitude: 41.3853, longitude: 2.1736, timestamp: '2026-05-07T10:02:00Z', walk_id: 1 },
      ],
      walk_id: 1
    };

    const action: WalkAction = {
      type: 'BATCH_LOCATION_UPDATE',
      payload: batchPayload
    };

    const newState = processor.reduceState(initialState, action);

    expect(newState.routeHistory).toHaveLength(3);
    expect(newState.currentLocation?.latitude).toBe(41.3853);
    expect(newState.isActive).toBe(true);
  });

  it('should merge batch locations with existing route history', () => {
    const existingHistory = [
      { latitude: 41.3850, longitude: 2.1730, timestamp: '2026-05-07T09:59:00Z', walk_id: 1 }
    ];

    const stateWithHistory: WalkState = {
      ...initialState,
      routeHistory: existingHistory,
      currentLocation: existingHistory[0]
    };

    const batchPayload = {
      locations: [
        { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-05-07T10:00:00Z', walk_id: 1 },
        { latitude: 41.3852, longitude: 2.1735, timestamp: '2026-05-07T10:01:00Z', walk_id: 1 },
      ],
      walk_id: 1
    };

    const action: WalkAction = {
      type: 'BATCH_LOCATION_UPDATE',
      payload: batchPayload
    };

    const newState = processor.reduceState(stateWithHistory, action);

    expect(newState.routeHistory).toHaveLength(3);
    expect(newState.routeHistory[0].timestamp).toBe('2026-05-07T09:59:00Z');
    expect(newState.routeHistory[2].timestamp).toBe('2026-05-07T10:01:00Z');
  });

  it('should use walk_id from payload when location lacks walk_id', () => {
    const batchPayload = {
      locations: [
        { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-05-07T10:00:00Z' },
      ],
      walk_id: 5
    };

    const action: WalkAction = {
      type: 'BATCH_LOCATION_UPDATE',
      payload: batchPayload
    };

    const newState = processor.reduceState(initialState, action);

    expect(newState.routeHistory[0].walk_id).toBe(5);
  });

  it('should preserve walk_id from location when provided', () => {
    const batchPayload = {
      locations: [
        { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-05-07T10:00:00Z', walk_id: 10 },
      ],
      walk_id: 5
    };

    const action: WalkAction = {
      type: 'BATCH_LOCATION_UPDATE',
      payload: batchPayload
    };

    const newState = processor.reduceState(initialState, action);

    expect(newState.routeHistory[0].walk_id).toBe(10);
  });

  it('should return unchanged state for empty batch', () => {
    const batchPayload = {
      locations: [],
      walk_id: 1
    };

    const action: WalkAction = {
      type: 'BATCH_LOCATION_UPDATE',
      payload: batchPayload
    };

    const newState = processor.reduceState(initialState, action);

    expect(newState).toBe(initialState);
  });

  it('should return unchanged state for null locations', () => {
    const batchPayload = {
      locations: null as any,
      walk_id: 1
    };

    const action: WalkAction = {
      type: 'BATCH_LOCATION_UPDATE',
      payload: batchPayload
    };

    const newState = processor.reduceState(initialState, action);

    expect(newState).toBe(initialState);
  });

  it('should maintain chronological order after batch update', () => {
    const batchPayload = {
      locations: [
        { latitude: 41.3853, longitude: 2.1736, timestamp: '2026-05-07T10:02:00Z', walk_id: 1 },
        { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-05-07T10:00:00Z', walk_id: 1 },
        { latitude: 41.3852, longitude: 2.1735, timestamp: '2026-05-07T10:01:00Z', walk_id: 1 },
      ],
      walk_id: 1
    };

    const action: WalkAction = {
      type: 'BATCH_LOCATION_UPDATE',
      payload: batchPayload
    };

    const newState = processor.reduceState(initialState, action);

    expect(newState.routeHistory[0].timestamp).toBe('2026-05-07T10:00:00Z');
    expect(newState.routeHistory[1].timestamp).toBe('2026-05-07T10:01:00Z');
    expect(newState.routeHistory[2].timestamp).toBe('2026-05-07T10:02:00Z');
  });

  it('should deduplicate by timestamp when batch contains duplicates', () => {
    const batchPayload = {
      locations: [
        { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-05-07T10:00:00Z', walk_id: 1 },
        { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-05-07T10:00:00Z', walk_id: 1 },
        { latitude: 41.3852, longitude: 2.1735, timestamp: '2026-05-07T10:01:00Z', walk_id: 1 },
      ],
      walk_id: 1
    };

    const action: WalkAction = {
      type: 'BATCH_LOCATION_UPDATE',
      payload: batchPayload
    };

    const newState = processor.reduceState(initialState, action);

    expect(newState.routeHistory).toHaveLength(2);
  });
});

describe('WalkEventProcessor - classifyEvent', () => {
  let processor: WalkEventProcessor;

  beforeEach(() => {
    processor = new WalkEventProcessor();
  });

  it('classifies snapshot messages', () => {
    const raw = { type: 'snapshot', watchers_count: 2, active_walk: { id: 1, history: [] } };
    const event = processor.classifyEvent(raw);
    expect(event).toEqual({ type: 'snapshot', payload: raw });
  });

  it('classifies walk_started messages', () => {
    const raw = { type: 'walk_started', timestamp: '2026-05-07T10:00:00Z' };
    const event = processor.classifyEvent(raw);
    expect(event?.type).toBe('walk_started');
    expect((event as Extract<typeof event, { type: 'walk_started' }>)?.timestamp).toBeGreaterThan(0);
  });

  it('classifies walk_stopped messages', () => {
    const event = processor.classifyEvent({ type: 'walk_stopped' });
    expect(event).toEqual({ type: 'walk_stopped' });
  });

  it('classifies patient_online messages', () => {
    const event = processor.classifyEvent({ type: 'patient_online' });
    expect(event).toEqual({ type: 'patient_online' });
  });

  it('classifies patient_offline messages', () => {
    const event = processor.classifyEvent({ type: 'patient_offline' });
    expect(event).toEqual({ type: 'patient_offline' });
  });

  it('classifies watchers_update messages', () => {
    const event = processor.classifyEvent({ type: 'watchers_update', count: 3 });
    expect(event).toEqual({ type: 'watchers_update', count: 3 });
  });

  it('classifies sos_alert messages', () => {
    const raw = { type: 'sos_alert', patient_id: 1, walk_id: 42, sos_count: 2, timestamp: '2026-05-07T10:00:00Z' };
    const event = processor.classifyEvent(raw);
    expect(event).toEqual({ type: 'sos_alert', patient_id: 1, walk_id: 42, sos_count: 2, timestamp: '2026-05-07T10:00:00Z' });
  });

  it('classifies explicit location messages', () => {
    const raw = { type: 'location', latitude: 41.3851, longitude: 2.1734, timestamp: '2026-05-07T10:00:00Z', walk_id: 1 };
    const event = processor.classifyEvent(raw);
    expect(event?.type).toBe('location_update');
    expect((event as Extract<typeof event, { type: 'location_update' }>)?.payload.latitude).toBe(41.3851);
  });

  it('classifies typeless location messages (implicit)', () => {
    const raw = { latitude: 41.3851, longitude: 2.1734, timestamp: '2026-05-07T10:00:00Z' };
    const event = processor.classifyEvent(raw);
    expect(event?.type).toBe('location_update');
  });

  it('returns null for unrecognised message types', () => {
    const event = processor.classifyEvent({ type: 'unknown_event' });
    expect(event).toBeNull();
  });

  it('returns null for null input', () => {
    const event = processor.classifyEvent(null);
    expect(event).toBeNull();
  });

  it('returns null for string input', () => {
    const event = processor.classifyEvent('not-an-object');
    expect(event).toBeNull();
  });

  it('returns null for malformed sos_alert (missing fields)', () => {
    const event = processor.classifyEvent({ type: 'sos_alert', patient_id: 1 });
    expect(event).toBeNull();
  });

  it('defaults watchers_update count to 0 when missing', () => {
    const event = processor.classifyEvent({ type: 'watchers_update' });
    expect(event).toEqual({ type: 'watchers_update', count: 0 });
  });
});