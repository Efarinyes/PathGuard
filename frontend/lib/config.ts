export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/v1/ws/';

export const STORAGE_KEYS = {
  USER_TOKEN: 'pg_user_token',
  DEVICE_TOKEN: 'pg_device_token',
  PATIENT_ID: 'pg_patient_id',
  ACTIVE_WALK_ID: 'pg_active_walk_id',
} as const;

// WebSocket constants
export const WS_HEARTBEAT_INTERVAL_MS = 5000;
export const WS_FAST_RECONNECT_ATTEMPTS = 5;
export const WS_RECONNECT_BASE_DELAY_MS = 1000;
export const WS_RECONNECT_MAX_DELAY_MS = 16000;
export const WS_INFINITE_RETRY_DELAY_MS = 30000;

// GPS / Location tracking constants
export const GPS_MIN_DISTANCE_M = 30;
export const GPS_SPEED_IDLE_THRESHOLD_M_MIN = 5;
export const GPS_INTERVAL_IDLE_MS = 120000;
export const GPS_INTERVAL_NORMAL_MS = 30000;
export const GPS_INTERVAL_FAST_MS = 15000;
export const GPS_TIMEOUT_MS = 15000;
export const GPS_RETRY_DELAY_MS = 5000;

// Batch / sync constants
export const BATCH_SIZE_THRESHOLD = 5;
export const BATCH_TIME_THRESHOLD_MS = 5000;

// Battery monitoring
export const BATTERY_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
export const BATTERY_SIGNIFICANT_CHANGE = 1;
export const BATTERY_PERIODIC_CHECK_MS = 30000;
export const BATTERY_INITIAL_DELAY_MS = 500;

// Analytics polling
export const ANALYTICS_POLL_INTERVAL_MS = 30000;

// Notification
export const NOTIFICATION_AUTO_DISMISS_MS = 4000;

export const CONFIG = {
  apiBaseUrl: API_BASE_URL,
  wsBaseUrl: WS_BASE_URL,
  storageKeys: STORAGE_KEYS,
} as const;

export default CONFIG;