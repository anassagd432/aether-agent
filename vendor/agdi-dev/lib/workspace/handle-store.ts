/**
 * Handle Store
 * 
 * Persist FileSystemDirectoryHandle in IndexedDB.
 * Handles cannot be serialized to JSON, so we use IndexedDB directly.
 */

// ==================== TYPES ====================

export interface StoredHandle {
    id: string;
    name: string;
    trusted: boolean;
    addedAt: number;
    handle: FileSystemDirectoryHandle;
}

export interface HandlePermissionStatus {
    id: string;
    granted: boolean;
    needsReauth: boolean;
}

// ==================== CONSTANTS ====================

const DB_NAME = 'agdi_workspace';
const DB_VERSION = 1;
const STORE_NAME = 'handles';

// ==================== DATABASE ====================

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('IndexedDB not available'));
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });

    return dbPromise;
}

// ==================== CRUD OPERATIONS ====================

/**
 * Save a directory handle to IndexedDB
 */
export async function saveHandle(stored: StoredHandle): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(stored);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * Get all stored handles
 */
export async function getAllHandles(): Promise<StoredHandle[]> {
    if (typeof indexedDB === 'undefined') return [];
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
}

/**
 * Get a single handle by ID
 */
export async function getHandle(id: string): Promise<StoredHandle | null> {
    if (typeof indexedDB === 'undefined') return null;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
    });
}

/**
 * Delete a handle
 */
export async function deleteHandle(id: string): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * Update trust status
 */
export async function updateTrust(id: string, trusted: boolean): Promise<void> {
    const stored = await getHandle(id);
    if (stored) {
        stored.trusted = trusted;
        await saveHandle(stored);
    }
}

// ==================== PERMISSION MANAGEMENT ====================

/**
 * Query permission status for a handle
 */
export async function queryPermission(
    handle: FileSystemDirectoryHandle,
    mode: 'read' | 'readwrite' = 'readwrite'
): Promise<PermissionState> {
    try {
        const status = await (handle as any).queryPermission({ mode });
        return status;
    } catch {
        return 'denied';
    }
}

/**
 * Request permission for a handle (requires user gesture)
 */
export async function requestPermission(
    handle: FileSystemDirectoryHandle,
    mode: 'read' | 'readwrite' = 'readwrite'
): Promise<boolean> {
    try {
        const status = await (handle as any).requestPermission({ mode });
        return status === 'granted';
    } catch {
        return false;
    }
}

/**
 * Check permission status for all stored handles
 */
export async function checkAllPermissions(): Promise<HandlePermissionStatus[]> {
    const handles = await getAllHandles();
    const results: HandlePermissionStatus[] = [];

    for (const stored of handles) {
        const status = await queryPermission(stored.handle);
        results.push({
            id: stored.id,
            granted: status === 'granted',
            needsReauth: status === 'prompt' || status === 'denied',
        });
    }

    return results;
}

/**
 * Restore all handles with valid permissions
 */
export async function restoreHandles(): Promise<{
    restored: StoredHandle[];
    needsReauth: StoredHandle[];
}> {
    const handles = await getAllHandles();
    const restored: StoredHandle[] = [];
    const needsReauth: StoredHandle[] = [];

    for (const stored of handles) {
        const status = await queryPermission(stored.handle);
        if (status === 'granted') {
            restored.push(stored);
        } else {
            needsReauth.push(stored);
        }
    }

    return { restored, needsReauth };
}

/**
 * Clear all stored handles
 */
export async function clearAllHandles(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}
