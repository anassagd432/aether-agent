/**
 * Privacy-First Telemetry Module
 * 
 * @module telemetry
 * 
 * SOVEREIGN TELEMETRY GUARANTEE:
 * - Opt-in only (disabled by default)
 * - No source code, file paths, or API keys collected
 * - All data sanitized before transmission
 * - User can verify with: agdi config telemetry --dry-run
 * - User can disable at any time via: agdi config telemetry --disable
 */

export {
    telemetry,
    generateSampleEvent,
    generateSanitizationDemo
} from './telemetry-service.js';

export {
    isTelemetryEnabled,
    hasAskedForConsent,
    setTelemetryConsent,
    markConsentAsked,
    getAnonymousId,
    getTelemetryConfig,
} from './config.js';

export { requestFeedback, showFeedbackHint } from './feedback.js';

export type {
    TelemetryEvent,
    TelemetryAction,
    TelemetryMetadata,
    TelemetryConfig,
    FeedbackResponse,
} from './types.js';
