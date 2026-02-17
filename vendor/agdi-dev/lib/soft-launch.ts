/**
 * Soft Launch Lock - "Coming Soon" Mode
 * 
 * This module controls public access to the Builder.
 * - When locked: Public users see "Coming Soon" overlay
 * - Owner bypass: Add ?unlock=agdi2026 to URL to access Builder
 * - To make public: Set VITE_PUBLIC_ACCESS=true in .env
 */

const UNLOCK_KEY = 'agdi_unlocked';
const SECRET_CODE = 'agdi2026';  // Change this to your own secret!

/**
 * Check if the app is in "Coming Soon" mode
 * Returns true if LOCKED (show coming soon)
 */
export function isComingSoonMode(): boolean {
    return false; // Always unlocked for development/production
}

/**
 * Manually unlock the app (for console use)
 */
export function unlockApp(): void {
    localStorage.setItem(UNLOCK_KEY, 'true');
    console.log('🔓 App unlocked! Refresh to access Builder.');
}

/**
 * Re-lock the app (for testing)
 */
export function lockApp(): void {
    localStorage.removeItem(UNLOCK_KEY);
    console.log('🔒 App locked. Refresh to see Coming Soon mode.');
}

// Expose to window for console access
if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).agdiUnlock = unlockApp;
    (window as unknown as Record<string, unknown>).agdiLock = lockApp;
}
