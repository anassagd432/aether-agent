/**
 * Thought Stream
 * 
 * Real-time status streaming for Agdi.
 * Port of MoltBot's agent-events.ts with human-friendly formatting.
 * 
 * Enables "conversational" behavior where the agent talks while working:
 * "Checking file..." → "Found bug..." → "Fixing..."
 */

// ==================== TYPES ====================

export type AgentEventStream =
    | 'lifecycle'    // Agent start/end
    | 'tool'         // Tool execution
    | 'assistant'    // Text generation
    | 'thinking'     // Reasoning steps
    | 'error';       // Errors

export interface AgentEvent {
    runId: string;
    seq: number;
    stream: AgentEventStream;
    ts: number;
    data: {
        // Lifecycle events
        phase?: 'start' | 'end';
        // Tool events
        toolName?: string;
        toolInput?: string;
        toolOutput?: string;
        file?: string;
        line?: number;
        // Assistant events
        text?: string;
        chunk?: string;
        // Error events
        error?: string;
        code?: string;
        // Generic
        message?: string;
        [key: string]: unknown;
    };
    sessionKey?: string;
}

export type EventListener = (event: AgentEvent) => void;
export type Unsubscribe = () => void;

export interface ThoughtStreamOptions {
    maxHistorySize?: number;
    humanFormatEnabled?: boolean;
}

// ==================== HUMAN-FRIENDLY MESSAGES ====================

const TOOL_MESSAGES: Record<string, (data: AgentEvent['data']) => string> = {
    read_file: (d) => `📖 Reading ${d.file || 'file'}...`,
    write_file: (d) => `✏️ Writing to ${d.file || 'file'}...`,
    edit_file: (d) => `🔧 Editing ${d.file || 'file'}${d.line ? ` at line ${d.line}` : ''}...`,
    execute_command: (d) => `⚡ Running: ${d.toolInput?.slice(0, 50) || 'command'}...`,
    search_files: (d) => `🔍 Searching for ${d.toolInput || 'files'}...`,
    list_directory: (d) => `📁 Listing ${d.file || 'directory'}...`,
    create_file: (d) => `📝 Creating ${d.file || 'new file'}...`,
    delete_file: (d) => `🗑️ Deleting ${d.file || 'file'}...`,
    web_search: (d) => `🌐 Searching the web for: ${d.toolInput?.slice(0, 40) || 'query'}...`,
    browser_action: (d) => `🖥️ Interacting with browser...`,
};

const LIFECYCLE_MESSAGES: Record<string, string> = {
    start: '🚀 Starting task...',
    end: '✅ Task complete!',
};

/**
 * Format an event into a human-readable status message.
 */
function formatEventForHuman(event: AgentEvent): string | null {
    const { stream, data } = event;

    switch (stream) {
        case 'lifecycle':
            return LIFECYCLE_MESSAGES[data.phase || ''] || null;

        case 'tool': {
            const toolName = data.toolName?.toLowerCase() || '';
            const formatter = TOOL_MESSAGES[toolName];
            if (formatter) return formatter(data);
            // Generic tool message
            return `🔧 Using ${data.toolName || 'tool'}...`;
        }

        case 'assistant':
            // Don't spam with every text chunk
            return null;

        case 'thinking':
            return data.message ? `💭 ${data.message}` : null;

        case 'error':
            return `❌ Error: ${data.error || data.message || 'Unknown error'}`;

        default:
            return null;
    }
}

// ==================== THOUGHT STREAM CLASS ====================

export class ThoughtStream {
    private seqByRun = new Map<string, number>();
    private listeners = new Set<EventListener>();
    private streamListeners = new Map<AgentEventStream, Set<EventListener>>();
    private history: AgentEvent[] = [];
    private maxHistorySize: number;
    private humanFormatEnabled: boolean;

    constructor(options: ThoughtStreamOptions = {}) {
        this.maxHistorySize = options.maxHistorySize ?? 100;
        this.humanFormatEnabled = options.humanFormatEnabled ?? true;
    }

    /**
     * Emit an event to all subscribers.
     */
    emit(event: Omit<AgentEvent, 'seq' | 'ts'>): AgentEvent {
        const nextSeq = (this.seqByRun.get(event.runId) ?? 0) + 1;
        this.seqByRun.set(event.runId, nextSeq);

        const enrichedEvent: AgentEvent = {
            ...event,
            seq: nextSeq,
            ts: Date.now(),
        };

        // Store in history
        this.history.push(enrichedEvent);
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }

        // Notify all listeners
        for (const listener of this.listeners) {
            try {
                listener(enrichedEvent);
            } catch {
                // Ignore listener errors
            }
        }

        // Notify stream-specific listeners
        const streamSet = this.streamListeners.get(event.stream);
        if (streamSet) {
            for (const listener of streamSet) {
                try {
                    listener(enrichedEvent);
                } catch {
                    // Ignore listener errors
                }
            }
        }

        return enrichedEvent;
    }

    /**
     * Subscribe to all events.
     */
    on(listener: EventListener): Unsubscribe {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Subscribe to events of a specific stream type.
     */
    onStream(stream: AgentEventStream, listener: EventListener): Unsubscribe {
        if (!this.streamListeners.has(stream)) {
            this.streamListeners.set(stream, new Set());
        }
        this.streamListeners.get(stream)!.add(listener);
        return () => this.streamListeners.get(stream)?.delete(listener);
    }

    /**
     * Get human-readable status for an event.
     */
    formatForHuman(event: AgentEvent): string | null {
        if (!this.humanFormatEnabled) return null;
        return formatEventForHuman(event);
    }

    /**
     * Get recent event history.
     */
    getHistory(limit?: number): AgentEvent[] {
        const count = limit ?? this.maxHistorySize;
        return this.history.slice(-count);
    }

    /**
     * Get recent human-readable status messages.
     */
    getRecentStatuses(limit: number = 5): string[] {
        return this.history
            .slice(-limit * 2) // Get more to filter nulls
            .map(e => formatEventForHuman(e))
            .filter((s): s is string => s !== null)
            .slice(-limit);
    }

    /**
     * Clear all state.
     */
    clear(): void {
        this.seqByRun.clear();
        this.history = [];
    }

    /**
     * Clear state for a specific run.
     */
    clearRun(runId: string): void {
        this.seqByRun.delete(runId);
        this.history = this.history.filter(e => e.runId !== runId);
    }
}

// ==================== HELPER FACTORIES ====================

/**
 * Create events for common tool operations.
 */
export const createToolEvent = {
    readFile: (runId: string, file: string): Omit<AgentEvent, 'seq' | 'ts'> => ({
        runId,
        stream: 'tool',
        data: { toolName: 'read_file', file },
    }),

    writeFile: (runId: string, file: string): Omit<AgentEvent, 'seq' | 'ts'> => ({
        runId,
        stream: 'tool',
        data: { toolName: 'write_file', file },
    }),

    editFile: (runId: string, file: string, line?: number): Omit<AgentEvent, 'seq' | 'ts'> => ({
        runId,
        stream: 'tool',
        data: { toolName: 'edit_file', file, line },
    }),

    executeCommand: (runId: string, command: string): Omit<AgentEvent, 'seq' | 'ts'> => ({
        runId,
        stream: 'tool',
        data: { toolName: 'execute_command', toolInput: command },
    }),

    search: (runId: string, query: string): Omit<AgentEvent, 'seq' | 'ts'> => ({
        runId,
        stream: 'tool',
        data: { toolName: 'search_files', toolInput: query },
    }),
};

/**
 * Create lifecycle events.
 */
export const createLifecycleEvent = {
    start: (runId: string, sessionKey?: string): Omit<AgentEvent, 'seq' | 'ts'> => ({
        runId,
        stream: 'lifecycle',
        data: { phase: 'start' },
        sessionKey,
    }),

    end: (runId: string, sessionKey?: string): Omit<AgentEvent, 'seq' | 'ts'> => ({
        runId,
        stream: 'lifecycle',
        data: { phase: 'end' },
        sessionKey,
    }),
};

/**
 * Create thinking/reasoning events.
 */
export const createThinkingEvent = (
    runId: string,
    message: string
): Omit<AgentEvent, 'seq' | 'ts'> => ({
    runId,
    stream: 'thinking',
    data: { message },
});

// ==================== SINGLETON ====================

export const thoughtStream = new ThoughtStream();

// ==================== EXPORTS ====================

export { formatEventForHuman };
