/**
 * Telemetry Consent & Configuration Management
 * 
 * Handles opt-in consent, anonymous ID generation, and persistence.
 */

import { randomUUID } from 'crypto';
import { loadConfig, saveConfig } from '../../utils/config.js';
import type { TelemetryConfig } from './types.js';

const DEFAULT_CONFIG: TelemetryConfig = {
    enabled: false,
    consentAsked: false,
};

/**
 * Check if telemetry is enabled
 */
export function isTelemetryEnabled(): boolean {
    const config = loadConfig();
    return config.telemetry?.enabled ?? false;
}

/**
 * Check if consent prompt has been shown
 */
export function hasAskedForConsent(): boolean {
    const config = loadConfig();
    return config.telemetry?.consentAsked ?? false;
}

/**
 * Set telemetry consent
 */
export function setTelemetryConsent(enabled: boolean): void {
    const config = loadConfig();

    config.telemetry = {
        ...DEFAULT_CONFIG,
        ...config.telemetry,
        enabled,
        consentAsked: true,
        anonymousId: config.telemetry?.anonymousId ?? generateAnonymousId(),
    };

    saveConfig(config);
}

/**
 * Mark consent as asked (without enabling)
 */
export function markConsentAsked(): void {
    const config = loadConfig();

    config.telemetry = {
        ...DEFAULT_CONFIG,
        ...config.telemetry,
        consentAsked: true,
    };

    saveConfig(config);
}

/**
 * Get persistent anonymous ID (generated once)
 */
export function getAnonymousId(): string {
    const config = loadConfig();

    if (config.telemetry?.anonymousId) {
        return config.telemetry.anonymousId;
    }

    // Generate and persist new ID
    const anonymousId = generateAnonymousId();
    config.telemetry = {
        ...DEFAULT_CONFIG,
        ...config.telemetry,
        anonymousId,
    };
    saveConfig(config);

    return anonymousId;
}

/**
 * Get current telemetry config
 */
export function getTelemetryConfig(): TelemetryConfig {
    const config = loadConfig();
    return {
        ...DEFAULT_CONFIG,
        ...config.telemetry,
    };
}

/**
 * Generate anonymous ID (not tied to user identity)
 */
function generateAnonymousId(): string {
    return `anon_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
