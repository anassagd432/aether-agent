/**
 * Security Utilities — Input sanitization and validation
 *
 * Used across the application to prevent injection attacks,
 * sanitize user inputs before API calls, and validate data.
 */

// ==================== INPUT SANITIZATION ====================

/**
 * Sanitize user prompt input before sending to AI APIs.
 * Strips script tags, HTML entities, and potential injection patterns.
 */
export function sanitizePrompt(input: string): string {
    return input
        // Remove HTML tags
        .replace(/<[^>]*>/g, '')
        // Remove script-like patterns
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        // Remove null bytes
        .replace(/\0/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Sanitize a generic text input (names, descriptions, etc.)
 */
export function sanitizeText(input: string): string {
    return input
        .replace(/<[^>]*>/g, '')
        .replace(/[<>"'&]/g, (char) => {
            const escapeMap: Record<string, string> = {
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#x27;',
                '&': '&amp;',
            };
            return escapeMap[char] || char;
        })
        .trim();
}

/**
 * Validate and sanitize a URL.
 * Returns null if the URL is invalid or potentially dangerous.
 */
export function sanitizeUrl(url: string): string | null {
    try {
        const parsed = new URL(url);
        // Only allow http/https protocols
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

// ==================== VALIDATION ====================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; reason?: string } {
    if (password.length < 8) {
        return { valid: false, reason: 'Password must be at least 8 characters' };
    }
    if (password.length > 128) {
        return { valid: false, reason: 'Password must be less than 128 characters' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, reason: 'Password must contain a lowercase letter' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, reason: 'Password must contain an uppercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, reason: 'Password must contain a number' };
    }
    return { valid: true };
}

// ==================== API KEY HANDLING ====================

/**
 * Mask an API key for display (show first 4 and last 4 chars).
 */
export function maskApiKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}${'•'.repeat(Math.min(key.length - 8, 20))}${key.slice(-4)}`;
}

/**
 * Validate API key format (basic check — not empty, reasonable length).
 */
export function isValidApiKey(key: string): boolean {
    const trimmed = key.trim();
    return trimmed.length >= 10 && trimmed.length <= 256 && !/\s/.test(trimmed);
}

// ==================== RATE LIMITING (CLIENT-SIDE) ====================

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Simple client-side rate limiter to prevent UI spam clicks.
 */
export function checkClientRateLimit(
    action: string,
    maxPerMinute: number = 10
): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const entry = rateLimitStore.get(action);

    if (!entry || now >= entry.resetAt) {
        rateLimitStore.set(action, { count: 1, resetAt: now + 60_000 });
        return { allowed: true };
    }

    if (entry.count >= maxPerMinute) {
        return { allowed: false, retryAfterMs: entry.resetAt - now };
    }

    entry.count++;
    return { allowed: true };
}

// ==================== CSP NONCE ====================

/**
 * Generate a random nonce for inline scripts (if needed).
 */
export function generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
}
