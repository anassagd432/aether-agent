/**
 * Velocity Engine
 * 
 * Port of MoltBot's speed optimizations for Agdi.
 * Implements context compaction and deduplication caching.
 */

// ==================== CONSTANTS ====================

const BASE_CHUNK_RATIO = 0.4;          // 40% of context for history chunks
const MIN_CHUNK_RATIO = 0.15;          // Floor at 15%
const SAFETY_MARGIN = 1.2;             // 20% buffer for token estimation inaccuracy
const DEFAULT_SUMMARY_FALLBACK = "No prior history.";
const DEFAULT_PARTS = 2;
const CONTEXT_WINDOW_HARD_MIN = 16_000;
const CONTEXT_WINDOW_WARN_BELOW = 32_000;

// ==================== TYPES ====================

export interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp?: number;
    tokenEstimate?: number;
}

export interface DedupeCache {
    check: (key: string | null | undefined, now?: number) => boolean;
    clear: () => void;
    size: () => number;
}

export interface DedupeCacheOptions {
    ttlMs: number;
    maxSize: number;
}

export interface CompactionResult {
    summary: string;
    originalTokens: number;
    compactedTokens: number;
    messagesDropped: number;
}

export interface ContextWindowInfo {
    tokens: number;
    source: 'model' | 'config' | 'default';
    shouldWarn: boolean;
    shouldBlock: boolean;
}

// ==================== TOKEN ESTIMATION ====================

/**
 * Fast token estimation using character-based heuristic.
 * ~4 characters per token on average for English text.
 */
export function estimateTokens(content: string | Message): number {
    const text = typeof content === 'string' ? content : content.content;
    if (!text) return 0;

    // ~4 chars per token, with overhead for role/structure
    const baseTokens = Math.ceil(text.length / 4);
    const overhead = typeof content === 'object' ? 10 : 0; // Message structure overhead

    return baseTokens + overhead;
}

/**
 * Estimate total tokens for an array of messages.
 */
export function estimateMessagesTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
}

// ==================== DEDUPE CACHE ====================

/**
 * Create a TTL+LRU deduplication cache.
 * Ported from MoltBot's src/infra/dedupe.ts
 * 
 * @param options - Cache configuration
 * @returns DedupeCache with check(), clear(), size() methods
 */
export function createDedupeCache(options: DedupeCacheOptions): DedupeCache {
    const ttlMs = Math.max(0, options.ttlMs);
    const maxSize = Math.max(0, Math.floor(options.maxSize));
    const cache = new Map<string, number>();

    const touch = (key: string, now: number): void => {
        cache.delete(key);
        cache.set(key, now);
    };

    const prune = (now: number): void => {
        const cutoff = ttlMs > 0 ? now - ttlMs : undefined;
        if (cutoff !== undefined) {
            for (const [entryKey, entryTs] of cache) {
                if (entryTs < cutoff) {
                    cache.delete(entryKey);
                }
            }
        }
        if (maxSize <= 0) {
            cache.clear();
            return;
        }
        while (cache.size > maxSize) {
            const oldestKey = cache.keys().next().value as string | undefined;
            if (!oldestKey) break;
            cache.delete(oldestKey);
        }
    };

    return {
        check: (key, now = Date.now()) => {
            if (!key) return false;
            const existing = cache.get(key);
            if (existing !== undefined && (ttlMs <= 0 || now - existing < ttlMs)) {
                touch(key, now);
                return true; // Duplicate
            }
            touch(key, now);
            prune(now);
            return false; // New entry
        },
        clear: () => {
            cache.clear();
        },
        size: () => cache.size,
    };
}

// ==================== CONTEXT COMPACTION ====================

/**
 * Split messages into chunks by token share for parallel summarization.
 */
export function splitMessagesByTokenShare(
    messages: Message[],
    parts: number = DEFAULT_PARTS
): Message[][] {
    if (messages.length === 0) return [];

    const normalizedParts = Math.min(Math.max(1, Math.floor(parts)), messages.length);
    if (normalizedParts <= 1) return [messages];

    const totalTokens = estimateMessagesTokens(messages);
    const targetTokens = totalTokens / normalizedParts;
    const chunks: Message[][] = [];
    let current: Message[] = [];
    let currentTokens = 0;

    for (const message of messages) {
        const messageTokens = estimateTokens(message);
        if (
            chunks.length < normalizedParts - 1 &&
            current.length > 0 &&
            currentTokens + messageTokens > targetTokens
        ) {
            chunks.push(current);
            current = [];
            currentTokens = 0;
        }
        current.push(message);
        currentTokens += messageTokens;
    }

    if (current.length > 0) {
        chunks.push(current);
    }

    return chunks;
}

/**
 * Compute adaptive chunk ratio based on average message size.
 * When messages are large, we use smaller chunks to avoid exceeding model limits.
 */
export function computeAdaptiveChunkRatio(
    messages: Message[],
    contextWindow: number
): number {
    if (messages.length === 0) return BASE_CHUNK_RATIO;

    const totalTokens = estimateMessagesTokens(messages);
    const avgTokens = totalTokens / messages.length;
    const safeAvgTokens = avgTokens * SAFETY_MARGIN;
    const avgRatio = safeAvgTokens / contextWindow;

    // If average message is > 10% of context, reduce chunk ratio
    if (avgRatio > 0.1) {
        const reduction = Math.min(avgRatio * 2, BASE_CHUNK_RATIO - MIN_CHUNK_RATIO);
        return Math.max(MIN_CHUNK_RATIO, BASE_CHUNK_RATIO - reduction);
    }

    return BASE_CHUNK_RATIO;
}

/**
 * Check if a single message is too large to summarize safely.
 * If single message > 50% of context, it can't be summarized safely.
 */
export function isOversizedForSummary(
    message: Message,
    contextWindow: number
): boolean {
    const tokens = estimateTokens(message) * SAFETY_MARGIN;
    return tokens > contextWindow * 0.5;
}

/**
 * Prune history to fit within a token budget.
 * Drops oldest messages first, keeping most recent context.
 */
export function pruneHistoryForContextShare(params: {
    messages: Message[];
    maxContextTokens: number;
    maxHistoryShare?: number;
}): {
    messages: Message[];
    droppedMessages: number;
    droppedTokens: number;
    keptTokens: number;
} {
    const maxHistoryShare = params.maxHistoryShare ?? 0.5;
    const budgetTokens = Math.max(1, Math.floor(params.maxContextTokens * maxHistoryShare));

    const keptMessages = [...params.messages];
    let droppedMessages = 0;
    let droppedTokens = 0;

    while (keptMessages.length > 0 && estimateMessagesTokens(keptMessages) > budgetTokens) {
        const dropped = keptMessages.shift()!;
        droppedMessages += 1;
        droppedTokens += estimateTokens(dropped);
    }

    return {
        messages: keptMessages,
        droppedMessages,
        droppedTokens,
        keptTokens: estimateMessagesTokens(keptMessages),
    };
}

/**
 * Generate a summary of messages using an LLM.
 * This is the interface - actual LLM call must be provided externally.
 */
export async function compactContext(params: {
    messages: Message[];
    contextWindow: number;
    summarize: (messages: Message[]) => Promise<string>;
    maxHistoryShare?: number;
}): Promise<CompactionResult> {
    const { messages, contextWindow, summarize, maxHistoryShare = 0.5 } = params;

    if (messages.length === 0) {
        return {
            summary: DEFAULT_SUMMARY_FALLBACK,
            originalTokens: 0,
            compactedTokens: estimateTokens(DEFAULT_SUMMARY_FALLBACK),
            messagesDropped: 0,
        };
    }

    const originalTokens = estimateMessagesTokens(messages);
    const budgetTokens = Math.floor(contextWindow * maxHistoryShare);

    // If already within budget, no compaction needed
    if (originalTokens <= budgetTokens) {
        return {
            summary: messages.map(m => `[${m.role}]: ${m.content}`).join('\n'),
            originalTokens,
            compactedTokens: originalTokens,
            messagesDropped: 0,
        };
    }

    // Split large messages for parallel summarization
    const chunkRatio = computeAdaptiveChunkRatio(messages, contextWindow);
    const maxChunkTokens = Math.floor(contextWindow * chunkRatio);
    const chunks = splitMessagesByTokenShare(messages, DEFAULT_PARTS);

    try {
        // Summarize each chunk
        const summaries: string[] = [];
        for (const chunk of chunks) {
            const chunkSummary = await summarize(chunk);
            summaries.push(chunkSummary);
        }

        const finalSummary = summaries.join('\n\n---\n\n');
        const compactedTokens = estimateTokens(finalSummary);

        return {
            summary: finalSummary,
            originalTokens,
            compactedTokens,
            messagesDropped: messages.length,
        };
    } catch (error) {
        // Fallback: just return structural note
        const fallback = `[Compaction failed: ${messages.length} messages, ~${Math.round(originalTokens / 1000)}K tokens]`;
        return {
            summary: fallback,
            originalTokens,
            compactedTokens: estimateTokens(fallback),
            messagesDropped: messages.length,
        };
    }
}

// ==================== CONTEXT WINDOW GUARD ====================

/**
 * Evaluate context window health and provide warnings.
 * Ported from MoltBot's src/agents/context-window-guard.ts
 */
export function evaluateContextWindow(
    tokens: number,
    source: 'model' | 'config' | 'default' = 'default'
): ContextWindowInfo {
    const normalizedTokens = Math.max(0, Math.floor(tokens));

    return {
        tokens: normalizedTokens,
        source,
        shouldWarn: normalizedTokens > 0 && normalizedTokens < CONTEXT_WINDOW_WARN_BELOW,
        shouldBlock: normalizedTokens > 0 && normalizedTokens < CONTEXT_WINDOW_HARD_MIN,
    };
}

// ==================== EXPORTS ====================

export const VELOCITY_CONSTANTS = {
    BASE_CHUNK_RATIO,
    MIN_CHUNK_RATIO,
    SAFETY_MARGIN,
    CONTEXT_WINDOW_HARD_MIN,
    CONTEXT_WINDOW_WARN_BELOW,
} as const;
