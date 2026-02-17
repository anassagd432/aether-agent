/**
 * Privacy-First Telemetry Types
 * 
 * PRIVACY GUARANTEE: No source code, file paths, API keys, or PII are ever collected.
 * Only anonymous usage patterns for improving AGDI.
 */

/** Telemetry action categories */
export type TelemetryAction =
    | 'build:start'
    | 'build:success'
    | 'build:fail'
    | 'chat:message'
    | 'chat:response'
    | 'import:github'
    | 'deploy:start'
    | 'deploy:success'
    | 'deploy:fail'
    | 'model:failover'
    | 'feedback:positive'
    | 'feedback:negative'
    | 'session:start'
    | 'session:end';

/** Telemetry event payload - strictly privacy-safe */
export interface TelemetryEvent {
    /** UUID v4 - unique event identifier */
    eventId: string;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Action type (safe enum, no user data) */
    actionType: TelemetryAction;
    /** Whether the action succeeded */
    success: boolean;
    /** Safe error code (e.g., 'API_QUOTA_EXCEEDED') - no stack traces */
    errorCode?: string;
    /** User-provided feedback text (opt-in only) */
    feedback?: string;
    /** Anonymous metadata */
    metadata?: TelemetryMetadata;
}

/** Anonymous metadata - no PII */
export interface TelemetryMetadata {
    /** Duration in milliseconds */
    durationMs?: number;
    /** Anonymized model name (e.g., 'gpt-4', 'gemini-pro') */
    modelUsed?: string;
    /** Command sequence without arguments (e.g., ['build', 'chat']) */
    commandSequence?: string[];
    /** AGDI version */
    version?: string;
    /** Platform (e.g., 'win32', 'darwin', 'linux') */
    platform?: string;
}

/** Telemetry consent state */
export interface TelemetryConfig {
    /** Whether telemetry is enabled (opt-in) */
    enabled: boolean;
    /** Persistent anonymous ID (not tied to user identity) */
    anonymousId?: string;
    /** Whether consent prompt has been shown */
    consentAsked?: boolean;
}

/** RLHF feedback response */
export interface FeedbackResponse {
    /** Whether the task was successful from user perspective */
    success: boolean;
    /** Optional reason for failure */
    reason?: string;
}
