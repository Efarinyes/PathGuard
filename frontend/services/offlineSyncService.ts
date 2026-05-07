/**
 * offlineSyncService.ts
 * Production-grade IndexedDB buffering for offline GPS tracking.
 * Ensures data persistence during network loss and chronological sync on restoration.
 */

const DB_NAME = 'PathGuardOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'locationQueue';

export interface QueuedLocation {
  id: string; // Client-generated UUID
  walk_id: number;
  latitude: number;
  longitude: number;
  timestamp: string;
  synced: number; // 0 for unsynced, 1 for synced
  is_recovered?: boolean; // True if synced offline during recovery
  client_id?: string; // UUID for backend deduplication
}

class OfflineSyncService {
  private db: IDBDatabase | null = null;

  async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db!);
      };

      request.onerror = (event: Event) => {
        reject('IndexedDB error: ' + (event.target as IDBRequest).errorCode);
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

  async markSynced(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const data = getRequest.result;
        if (data) {
          data.synced = 1;
          store.put(data);
        }
        resolve();
      };
      getRequest.onerror = () => reject('Failed to mark as synced');
    });
  }

  async markSyncedBulk(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let completed = 0;
      let hasError = false;

      for (const id of ids) {
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const data = getRequest.result;
          if (data && !hasError) {
            data.synced = 1;
            store.put(data);
          }
          completed++;
          if (completed === ids.length) {
            resolve();
          }
        };

        getRequest.onerror = () => {
          if (!hasError) {
            hasError = true;
            reject('Failed to mark bulk as synced');
          }
        };
      }
    });
  }

  async clearSynced(): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('synced');

      const request = index.openCursor(IDBKeyRange.only(1));
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject('Failed to clear synced data');
    });
  }
}

export const offlineSyncService = new OfflineSyncService();
