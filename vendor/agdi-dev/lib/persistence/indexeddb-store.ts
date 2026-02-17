/**
 * IndexedDB Store
 * 
 * Low-level wrapper for IndexedDB operations.
 * Provides typed CRUD operations with Promise-based API.
 */

import { DB_NAME, DB_VERSION, STORES, type StoreName } from './types';

// ==================== DATABASE INITIALIZATION ====================

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open/initialize the database
 */
export async function openDatabase(): Promise<IDBDatabase> {
    // Return existing connection if available
    if (dbInstance) {
        return dbInstance;
    }

    // Return in-progress connection
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open IndexedDB:', request.error);
            dbPromise = null;
            reject(request.error);
        };

        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
                const projectStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
                projectStore.createIndex('savedAt', 'savedAt', { unique: false });
                projectStore.createIndex('name', 'name', { unique: false });
            }

            if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
                db.createObjectStore(STORES.SNAPSHOTS, { keyPath: 'projectId' });
            }

            if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
            }
        };
    });

    return dbPromise;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
        dbPromise = null;
    }
}

// ==================== CRUD OPERATIONS ====================

/**
 * Put (insert or update) a record
 */
export async function put<T extends { id?: string }>(
    storeName: StoreName,
    item: T
): Promise<string> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => {
            resolve(request.result as string);
        };

        request.onerror = () => {
            console.error(`Failed to put item in ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

/**
 * Get a record by ID
 */
export async function get<T>(
    storeName: StoreName,
    id: string
): Promise<T | undefined> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result as T | undefined);
        };

        request.onerror = () => {
            console.error(`Failed to get item from ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

/**
 * Get all records from a store
 */
export async function getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result as T[]);
        };

        request.onerror = () => {
            console.error(`Failed to get all items from ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

/**
 * Delete a record by ID
 */
export async function del(storeName: StoreName, id: string): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error(`Failed to delete item from ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

/**
 * Clear all records from a store
 */
export async function clear(storeName: StoreName): Promise<void> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error(`Failed to clear ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

/**
 * Count records in a store
 */
export async function count(storeName: StoreName): Promise<number> {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.count();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            console.error(`Failed to count items in ${storeName}:`, request.error);
            reject(request.error);
        };
    });
}

// ==================== UTILITY ====================

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
    try {
        return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
        return false;
    }
}
