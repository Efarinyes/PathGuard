export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export const STORAGE_KEYS = {
  DEVICE_TOKEN: 'pg_device_token',
  ACTIVE_WALK_ID: 'pg_active_walk_id',
} as const;

export const CONFIG = {
  apiBaseUrl: API_BASE_URL,
  wsBaseUrl: WS_BASE_URL,
  storageKeys: STORAGE_KEYS,
} as const;

export default CONFIG;