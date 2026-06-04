/**
 * offlineSyncService.ts
 * Production-grade IndexedDB buffering for offline GPS tracking.
 * Ensures data persistence during network loss and chronological sync on restoration.
 */

const DB_NAME = 'PathGuardOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'locationQueue';

export interface QueuedLocation {
  id: string; // Deterministic SHA-256 (doubles as client_id for backend dedup)
  walk_id: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  synced: number; // 0 for unsynced, 1 for synced (kept for index, not for mark/clear)
  is_recovered?: boolean; // True if synced offline during recovery
}

class OfflineSyncService {
  private db: IDBDatabase | null = null;

  async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const target = event.target as IDBOpenDBRequest | null;
        if (!target?.result) return;
        const db = target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        if (!event.target) return;
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db!);
      };

      request.onerror = (event: Event) => {
        const target = event.target as IDBRequest | null;
        if (!target?.error) {
          reject('IndexedDB error: unknown');
          return;
        }
        reject('IndexedDB error: ' + target.error);
      };
    });
  }

  async add(location: Omit<QueuedLocation, 'synced'>): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ ...location, synced: 0 });

      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to enqueue location');
    });
  }

  async getUnsynced(): Promise<QueuedLocation[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(0));

      request.onsuccess = () => {
        const results = request.result as QueuedLocation[];
        // Ensure chronological order by timestamp
        results.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          if (timeA === timeB) {
            return a.id.localeCompare(b.id);
          }
          return timeA - timeB;
        });
        resolve(results);
      };
      request.onerror = () => reject('Failed to fetch unsynced locations');
    });
  }

  async deleteLocation(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const request = transaction.objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Failed to delete location');
    });
  }
}

export const offlineSyncService = new OfflineSyncService();
