/**
 * Telemetry Transport Layer
 * 
 * Backend-agnostic event sender with silent failure handling.
 * Never throws - telemetry should never break the user's workflow.
 */

import type { TelemetryEvent } from './types.js';

/** Transport interface for sending telemetry events */
export interface TelemetryTransport {
    send(event: TelemetryEvent): Promise<void>;
    sendBatch(events: TelemetryEvent[]): Promise<void>;
}

/** Default endpoint (can be overridden via env) */
const TELEMETRY_ENDPOINT = process.env.AGDI_TELEMETRY_URL || 'https://telemetry.agdi-dev.vercel.app/v1/events';

/**
 * HTTP Transport - sends events to AGDI telemetry backend
 */
export class HttpTransport implements TelemetryTransport {
    private endpoint: string;
    private timeout: number;

    constructor(endpoint?: string, timeout = 5000) {
        this.endpoint = endpoint || TELEMETRY_ENDPOINT;
        this.timeout = timeout;
    }

    async send(event: TelemetryEvent): Promise<void> {
        await this.sendBatch([event]);
    }

    async sendBatch(events: TelemetryEvent[]): Promise<void> {
        if (events.length === 0) return;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-AGDI-Client': 'cli',
                },
                body: JSON.stringify({ events }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
        } catch (error) {
            // Silent failure - telemetry should never break user workflow
            // Events are lost, but that's acceptable for privacy-first telemetry
            if (process.env.AGDI_TELEMETRY_DEBUG === 'true') {
                console.warn('[Telemetry] sendBatch failed:', (error as Error)?.message || error);
            }
        }
    }
}

/**
 * No-Op Transport - used when telemetry is disabled
 */
export class NoOpTransport implements TelemetryTransport {
    async send(_event: TelemetryEvent): Promise<void> {
        // Intentionally empty
    }

    async sendBatch(_events: TelemetryEvent[]): Promise<void> {
        // Intentionally empty
    }
}

/**
 * Console Transport - for debugging (development only)
 */
export class ConsoleTransport implements TelemetryTransport {
    async send(event: TelemetryEvent): Promise<void> {
        console.log('[Telemetry]', JSON.stringify(event, null, 2));
    }

    async sendBatch(events: TelemetryEvent[]): Promise<void> {
        console.log('[Telemetry Batch]', JSON.stringify(events, null, 2));
    }
}

/**
 * Create transport based on current configuration
 */
export function createTransport(): TelemetryTransport {
    if (process.env.AGDI_TELEMETRY_DEBUG === 'true') {
        return new ConsoleTransport();
    }

    return new HttpTransport();
}
