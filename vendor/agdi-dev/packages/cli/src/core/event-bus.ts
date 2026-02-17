
// ==================== EVENT BUS FOR TUI COMMUNICATION (HARDENED) ====================

import { EventEmitter } from 'events';
import type { SquadRole } from '../agents/core/base-agent.js';

export type AgentEventType = 'thought' | 'file_change' | 'handoff' | 'task_start' | 'task_complete' | 'log';

export interface AgentEvent {
    type: AgentEventType;
    agentName: string;
    role: SquadRole;
    message: string;
    metadata?: Record<string, unknown>; // Use unknown instead of any for type safety
    timestamp: number;
}

// Global singleton event bus
export const agentEventBus = new EventEmitter();

// SECURITY: Prevent memory leaks by setting a reasonable limit
// TUI apps with many components might subscribe, so we boost it slightly but keep it capped.
agentEventBus.setMaxListeners(50);

// Debouncing state
let thoughtFlushTimeout: NodeJS.Timeout | null = null;
let pendingThought: AgentEvent | null = null;

// Helper to emit events with debouncing for high-frequency events
export function emitAgentEvent(event: Omit<AgentEvent, 'timestamp'>) {
    const fullEvent = {
        ...event,
        timestamp: Date.now()
    };

    // Debounce 'thought' events to prevent flooding the TUI/logs
    if (event.type === 'thought') {
        pendingThought = fullEvent;
        if (!thoughtFlushTimeout) {
            thoughtFlushTimeout = setTimeout(() => {
                if (pendingThought) {
                    agentEventBus.emit('agent_event', pendingThought);
                    pendingThought = null;
                }
                thoughtFlushTimeout = null;
            }, 100); // 100ms debounce
        }
    } else {
        // Emit other events immediately
        agentEventBus.emit('agent_event', fullEvent);
    }
}

// Cleanup helper for TUI shutdown
export function cleanupEventBus() {
    agentEventBus.removeAllListeners();
    if (thoughtFlushTimeout) {
        clearTimeout(thoughtFlushTimeout);
    }
}

// Ensure cleanup on process exit to prevent hanging handles
process.on('exit', cleanupEventBus);
process.on('SIGINT', cleanupEventBus);
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    cleanupEventBus();
    process.exit(1);
});
