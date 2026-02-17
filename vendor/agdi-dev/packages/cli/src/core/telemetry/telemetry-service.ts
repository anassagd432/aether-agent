/**
 * Telemetry Service - Main Orchestrator
 * 
 * Central service for tracking events throughout the CLI.
 * Singleton pattern for consistent event tracking across commands.
 * 
 * SOVEREIGN TELEMETRY GUARANTEE:
 * - All data passes through sanitizeData() before transmission
 * - API keys, file paths, and large payloads are stripped
 * - Users can verify with: agdi config telemetry --dry-run
 */

import { randomUUID } from 'crypto';
import os from 'os';
import { isTelemetryEnabled, getAnonymousId } from './config.js';
import { createTransport, NoOpTransport, type TelemetryTransport } from './transport.js';
import type { TelemetryEvent, TelemetryAction, TelemetryMetadata, FeedbackResponse } from './types.js';

// Package version (injected at build time or read from package.json)
const VERSION = (typeof process !== 'undefined' && process.env?.npm_package_version) || '2.7.0';

// Maximum payload size for any string field (prevent code leakage)
const MAX_STRING_LENGTH = 200;

// Patterns to detect and strip sensitive data
const SENSITIVE_PATTERNS = {
    // API keys (OpenAI, Anthropic, Google, DeepSeek, etc.)
    apiKeys: /\b(sk-[a-zA-Z0-9]{20,}|gsk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{35}|xai-[a-zA-Z0-9]{20,}|dsk-[a-zA-Z0-9]{20,}|ant-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16})\b/gi,
    // Absolute file paths (Unix and Windows)
    unixPaths: /\/(?:Users|home|root|var|tmp|opt)\/[^\s:*?"<>|]+/gi,
    windowsPaths: /[A-Za-z]:\\(?:Users|Documents|Projects|repos?|code|src|dev)[^\s:*?"<>|]*/gi,
    // Environment variables that might contain secrets
    envVars: /\b[A-Z_]+_(?:KEY|SECRET|TOKEN|PASSWORD|APIKEY)=[^\s]+/gi,
    // JWT tokens
    jwtTokens: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/gi,
    // Emails
    emails: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi,
};

/**
 * Sanitize any string to remove sensitive data
 * This is the "Sovereign Guarantee" - we strip before sending
 */
function sanitizeString(input: string | undefined): string | undefined {
    if (!input) return input;

    let sanitized = input;

    // Strip API keys
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.apiKeys, '[REDACTED_KEY]');

    // Anonymize file paths - replace with [ROOT]
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.unixPaths, (match) => {
        const parts = match.split('/');
        // Keep last 2 path segments for context
        const safe = parts.slice(-2).join('/');
        return `[ROOT]/${safe}`;
    });
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.windowsPaths, (match) => {
        const parts = match.split('\\');
        const safe = parts.slice(-2).join('/');
        return `[ROOT]/${safe}`;
    });

    // Strip env vars with secrets
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.envVars, '[REDACTED_ENV]');

    // Strip JWT tokens
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.jwtTokens, '[REDACTED_JWT]');

    // Strip emails
    sanitized = sanitized.replace(SENSITIVE_PATTERNS.emails, '[REDACTED_EMAIL]');

    // Enforce size limit (prevent accidental code leakage)
    if (sanitized.length > MAX_STRING_LENGTH) {
        sanitized = sanitized.slice(0, MAX_STRING_LENGTH) + '...[TRUNCATED]';
    }

    return sanitized;
}

/**
 * Sanitize an entire telemetry event
 */
function sanitizeEvent(event: TelemetryEvent): TelemetryEvent {
    return {
        ...event,
        errorCode: sanitizeString(event.errorCode),
        feedback: sanitizeString(event.feedback),
        metadata: event.metadata ? {
            ...event.metadata,
            modelUsed: sanitizeString(event.metadata.modelUsed),
            commandSequence: event.metadata.commandSequence?.map(cmd =>
                sanitizeString(cmd) || cmd
            ),
        } : undefined,
    };
}

/**
 * Generate a sample telemetry event for --dry-run transparency
 * This shows users exactly what we would collect
 */
export function generateSampleEvent(): TelemetryEvent {
    return sanitizeEvent({
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        actionType: 'build:fail',
        success: false,
        errorCode: 'API_RATE_LIMITED',
        feedback: undefined,
        metadata: {
            durationMs: 4523,
            modelUsed: 'gemini-2.5-flash',
            version: VERSION,
            platform: process.platform,
            commandSequence: ['build', 'chat'],
        },
    });
}

/**
 * Generate a sample event with intentionally "dangerous" data
 * to demonstrate sanitization working
 */
export function generateSanitizationDemo(): { before: object; after: TelemetryEvent } {
    const unsafeEvent: TelemetryEvent = {
        eventId: randomUUID(),
        timestamp: new Date().toISOString(),
        actionType: 'build:fail',
        success: false,
        errorCode: `Error in C:\\Users\\${typeof os.userInfo === 'function' ? os.userInfo().username : 'user'}\\secret-project\\api.ts: API key sk-abc123xyz789secret failed`,
        feedback: 'Build failed with OPENAI_API_KEY=sk-mysecretkey123',
        metadata: {
            durationMs: 3200,
            modelUsed: 'gpt-4o',
            version: VERSION,
            platform: typeof process !== 'undefined' ? process.platform : 'unknown',
            commandSequence: ['build'],
        },
    };

    return {
        before: unsafeEvent,
        after: sanitizeEvent(unsafeEvent),
    };
}

class TelemetryService {
    private transport: TelemetryTransport;
    private sessionId: string;
    private eventQueue: TelemetryEvent[] = [];
    private flushInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        this.transport = new NoOpTransport();
        this.sessionId = randomUUID();
    }

    /**
     * Initialize telemetry service
     * Call this once at CLI startup
     */
    init(): void {
        if (!isTelemetryEnabled()) {
            this.transport = new NoOpTransport();
            return;
        }

        this.transport = createTransport();
        this.trackSessionStart();

        // Flush queue every 30 seconds
        if (typeof setInterval !== 'undefined') {
            this.flushInterval = setInterval(() => {
                this.flush();
            }, 30000);
        }

        // Flush on exit (Node only)
        if (typeof process !== 'undefined') {
            process.on('beforeExit', () => {
                this.trackSessionEnd();
                this.flush();
            });
        }
    }

    /**
     * Track an event (always sanitized before queuing)
     */
    track(
        actionType: TelemetryAction,
        success: boolean,
        options?: {
            errorCode?: string;
            feedback?: string;
            metadata?: Partial<TelemetryMetadata>;
        }
    ): void {
        if (!isTelemetryEnabled()) return;

        const rawEvent: TelemetryEvent = {
            eventId: randomUUID(),
            timestamp: new Date().toISOString(),
            actionType,
            success,
            errorCode: options?.errorCode,
            feedback: options?.feedback,
            metadata: {
                version: VERSION,
                platform: typeof process !== 'undefined' ? process.platform : 'unknown',
                ...options?.metadata,
            },
        };

        // SOVEREIGN GUARANTEE: Sanitize before queuing
        const sanitizedEvent = sanitizeEvent(rawEvent);
        this.eventQueue.push(sanitizedEvent);

        // Immediate send for critical events
        if (actionType.includes('fail') || actionType.includes('feedback')) {
            this.flush();
        }
    }

    /**
     * Track build event with timing
     */
    trackBuild(success: boolean, durationMs: number, modelUsed?: string, errorCode?: string): void {
        this.track(success ? 'build:success' : 'build:fail', success, {
            errorCode,
            metadata: { durationMs, modelUsed },
        });
    }

    /**
     * Track chat interaction
     */
    trackChat(modelUsed?: string): void {
        this.track('chat:message', true, {
            metadata: { modelUsed },
        });
    }

    /**
     * Track GitHub import
     */
    trackImport(success: boolean, errorCode?: string): void {
        this.track('import:github', success, { errorCode });
    }

    /**
     * Track model failover
     */
    trackFailover(fromModel: string, toModel: string): void {
        this.track('model:failover', true, {
            metadata: { modelUsed: `${fromModel}->${toModel}` },
        });
    }

    /**
     * Track user feedback (RLHF)
     */
    trackFeedback(feedback: FeedbackResponse): void {
        this.track(feedback.success ? 'feedback:positive' : 'feedback:negative', true, {
            feedback: feedback.reason,
        });
    }

    /**
     * Track session start
     */
    private trackSessionStart(): void {
        this.track('session:start', true);
    }

    /**
     * Track session end
     */
    private trackSessionEnd(): void {
        this.track('session:end', true);
    }

    /**
     * Flush queued events
     */
    async flush(): Promise<void> {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        // Add anonymous ID to batch
        const anonymousId = getAnonymousId();
        const eventsWithId = events.map((e) => ({
            ...e,
            metadata: { ...e.metadata, anonymousId },
        }));

        await this.transport.sendBatch(eventsWithId);
    }

    /**
     * Shutdown service
     */
    shutdown(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        this.flush();
    }
}

// Singleton instance
export const telemetry = new TelemetryService();

