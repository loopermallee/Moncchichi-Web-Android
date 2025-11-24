

export class StorageService {
  private dbName = 'MoncchichiDB';
  private dbVersion = 2; // Bump version for new store
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('StorageService: Failed to open DB');
        reject('Error opening DB');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Store for Books (Metadata + Content)
        if (!db.objectStoreNames.contains('library')) {
          db.createObjectStore('library', { keyPath: 'id' });
        }
        // Store for Offline Assets (Images/Blobs), key is URL or ID
        if (!db.objectStoreNames.contains('assets')) {
          db.createObjectStore('assets', { keyPath: 'id' });
        }
        // Store for API Responses / Metadata Cache
        if (!db.objectStoreNames.contains('api_cache')) {
          db.createObjectStore('api_cache', { keyPath: 'key' });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    await this.initDB();
    if (!this.db) throw new Error("Database not initialized");
    return this.db;
  }

  public async saveItem(storeName: 'library' | 'assets' | 'api_cache', item: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getItem<T>(storeName: 'library' | 'assets' | 'api_cache', id: string): Promise<T | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async getAllItems<T>(storeName: 'library' | 'assets' | 'api_cache'): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteItem(storeName: 'library' | 'assets' | 'api_cache', id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Caching Helpers ---

  public async setCache(key: string, data: any, ttlMinutes: number = 60): Promise<void> {
    const expiry = Date.now() + (ttlMinutes * 60 * 1000);
    await this.saveItem('api_cache', { key, data, expiry });
  }

  public async getCache<T>(key: string): Promise<T | null> {
    try {
      const item = await this.getItem<{ key: string, data: T, expiry: number }>('api_cache', key);
      if (!item) return null;
      
      if (Date.now() > item.expiry) {
        await this.deleteItem('api_cache', key);
        return null;
      }
      return item.data;
    } catch (e) {
      return null;
    }
  }

  // Helper to store blob from URL
  public async cacheImage(url: string): Promise<string> {
    try {
      // Fetch blob
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Convert to Base64 to store easily in IDB (or store blob directly)
      // Storing Blob directly is supported in modern IDB
      const id = url; // Use URL as ID
      await this.saveItem('assets', { id, blob, timestamp: Date.now() });
      return id;
    } catch (e) {
      console.error("Failed to cache image", url, e);
      return url; // Fallback to original URL
    }
  }
  
  public async getCachedImageUrl(url: string): Promise<string | null> {
      try {
          const item = await this.getItem<{id: string, blob: Blob}>('assets', url);
          if (item && item.blob) {
              return URL.createObjectURL(item.blob);
          }
          return null;
      } catch (e) {
          return null;
      }
  }
}

export const storageService = new StorageService();