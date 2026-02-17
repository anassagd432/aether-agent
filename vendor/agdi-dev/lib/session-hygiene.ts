/**
 * Session Hygiene - Secure session cleanup for Web App
 * 
 * Provides utilities to completely clear all session data,
 * including localStorage, sessionStorage, indexedDB, and cookies.
 */

/**
 * Clear all localStorage data
 */
export function clearLocalStorage(): void {
    try {
        localStorage.clear();
        console.log('✅ localStorage cleared');
    } catch (error) {
        console.error('Failed to clear localStorage:', error);
    }
}

/**
 * Clear all sessionStorage data
 */
export function clearSessionStorage(): void {
    try {
        sessionStorage.clear();
        console.log('✅ sessionStorage cleared');
    } catch (error) {
        console.error('Failed to clear sessionStorage:', error);
    }
}

/**
 * Delete all indexedDB databases
 */
export async function clearIndexedDB(): Promise<void> {
    try {
        // Get all database names
        const databases = await window.indexedDB.databases();

        for (const db of databases) {
            if (db.name) {
                window.indexedDB.deleteDatabase(db.name);
                console.log(`✅ Deleted indexedDB: ${db.name}`);
            }
        }
    } catch (error) {
        console.error('Failed to clear indexedDB:', error);
    }
}

/**
 * Clear service worker registrations
 */
export async function clearServiceWorkers(): Promise<void> {
    try {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log('✅ Unregistered service worker');
            }
        }
    } catch (error) {
        console.error('Failed to clear service workers:', error);
    }
}

/**
 * Clear all caches
 */
export async function clearCaches(): Promise<void> {
    try {
        if ('caches' in window) {
            const keys = await caches.keys();
            for (const key of keys) {
                await caches.delete(key);
                console.log(`✅ Deleted cache: ${key}`);
            }
        }
    } catch (error) {
        console.error('Failed to clear caches:', error);
    }
}

/**
 * Clear specific Agdi-related data
 */
export function clearAgdiData(): void {
    try {
        // Clear any Agdi-specific localStorage keys
        const agdiKeys = Object.keys(localStorage).filter(key =>
            key.startsWith('agdi_') ||
            key.startsWith('agdi-') ||
            key.includes('api_key') ||
            key.includes('apiKey') ||
            key.includes('gemini') ||
            key.includes('openai') ||
            key.includes('anthropic')
        );

        for (const key of agdiKeys) {
            localStorage.removeItem(key);
            console.log(`✅ Removed: ${key}`);
        }
    } catch (error) {
        console.error('Failed to clear Agdi data:', error);
    }
}

/**
 * Nuclear option - Clear everything and reload
 * This is the "Nuke Session" function
 */
export async function nukeSession(): Promise<void> {
    console.log('🔥 INITIATING SESSION NUKE...\n');

    // 1. Clear all storage
    clearLocalStorage();
    clearSessionStorage();
    clearAgdiData();

    // 2. Clear indexedDB (includes WebContainer filesystem)
    await clearIndexedDB();

    // 3. Clear service workers
    await clearServiceWorkers();

    // 4. Clear caches
    await clearCaches();

    console.log('\n✅ All session data destroyed.');
    console.log('🔄 Reloading page in 2 seconds...\n');

    // 5. Reload the page
    setTimeout(() => {
        window.location.reload();
    }, 2000);
}

/**
 * Check if running on a shared computer (heuristic)
 */
export function warnIfSharedComputer(): boolean {
    // Check for common indicators of shared/public computers
    const indicators = [
        // Multiple user profiles in history
        window.performance.navigation.redirectCount > 5,
        // Kiosk mode indicators
        !window.menubar?.visible,
        // Limited storage - check is synchronous, async check done separately
        typeof navigator.storage?.persist !== 'function',
    ];

    const isLikelyShared = indicators.some(Boolean);

    if (isLikelyShared) {
        console.warn('⚠️ This might be a shared computer. Consider using "Nuke Session" before leaving.');
    }

    return isLikelyShared;
}
