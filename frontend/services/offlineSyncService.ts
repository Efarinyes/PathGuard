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
}

class OfflineSyncService {
  private db: IDBDatabase | null = null;

  async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve(this.db!);
      };

      request.onerror = (event: any) => {
        reject('IndexedDB error: ' + event.target.errorCode);
      };
    });
  }

  async add(location: Omit<QueuedLocation, 'synced'>): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add({ ...location, synced: 0 });

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
        // Ensure chronological order
        results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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

  async clearSynced(): Promise<void> {
    const db = await this.initDB();
    const unsynced = await this.getUnsynced();
    // We only keep unsynced in memory briefly to delete synced ones
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      // Realistically we'd use a cursor to delete where synced == 1
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          if (cursor.value.synced === 1) {
            cursor.delete();
          }
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
