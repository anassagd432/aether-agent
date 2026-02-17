/**
 * Agdi Velocity Engine
 * 
 * Ported from MoltBot's speed optimizations with full rebrand.
 * This module provides context compression, caching, and streaming
 * status updates ("Micro-Updates") that make Agdi fast and responsive.
 * 
 * Components:
 * 1. Context Compaction - Reduces token usage while preserving meaning
 * 2. Dedupe Cache - Prevents duplicate processing
 * 3. Stream Emitter - Real-time status updates to UI
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface VelocityConfig {
    /** Maximum tokens for context window */
    maxContextTokens: number;
    /** Target compression ratio (0.0 - 1.0) */
    compressionTarget: number;
    /** Cache TTL in milliseconds */
    cacheTtlMs: number;
    /** Maximum cache entries */
    maxCacheEntries: number;
}

export interface CompactionResult {
    compacted: string;
    originalTokens: number;
    compactedTokens: number;
    compressionRatio: number;
}

export interface CacheEntry<T> {
    value: T;
    createdAt: number;
    accessedAt: number;
    hits: number;
}

export interface StreamEvent {
    type: 'lifecycle' | 'tool' | 'thinking' | 'progress' | 'error';
    message: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

export const DEFAULT_VELOCITY_CONFIG: VelocityConfig = {
    maxContextTokens: 128000,
    compressionTarget: 0.6, // Target 60% of original size
    cacheTtlMs: 60000, // 1 minute
    maxCacheEntries: 1000,
};

// =============================================================================
// CONTEXT COMPACTION ENGINE
// =============================================================================

/**
 * Context Compactor - Reduces token usage while preserving meaning
 * Ported from MoltBot's compaction.ts
 */
export class ContextCompactor {
    private config: VelocityConfig;

    constructor(config: Partial<VelocityConfig> = {}) {
        this.config = { ...DEFAULT_VELOCITY_CONFIG, ...config };
    }

    /**
     * Estimate token count (fast heuristic: ~4 chars per token)
     */
    estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /**
     * Compact a context string to reduce token usage
     */
    compact(context: string): CompactionResult {
        const originalTokens = this.estimateTokens(context);

        // If already within limits, return as-is
        if (originalTokens <= this.config.maxContextTokens * this.config.compressionTarget) {
            return {
                compacted: context,
                originalTokens,
                compactedTokens: originalTokens,
                compressionRatio: 1.0,
            };
        }

        let compacted = context;

        // Stage 1: Remove redundant whitespace
        compacted = this.removeRedundantWhitespace(compacted);

        // Stage 2: Truncate very long lines
        compacted = this.truncateLongLines(compacted, 500);

        // Stage 3: Summarize repetitive patterns
        compacted = this.summarizeRepetition(compacted);

        // Stage 4: Remove less important content (comments, empty lines)
        compacted = this.removeBoilerplate(compacted);

        // Stage 5: Smart truncation if still too large
        const compactedTokens = this.estimateTokens(compacted);
        const targetTokens = Math.floor(this.config.maxContextTokens * this.config.compressionTarget);

        if (compactedTokens > targetTokens) {
            compacted = this.smartTruncate(compacted, targetTokens);
        }

        const finalTokens = this.estimateTokens(compacted);

        return {
            compacted,
            originalTokens,
            compactedTokens: finalTokens,
            compressionRatio: finalTokens / originalTokens,
        };
    }

    /**
     * Remove redundant whitespace
     */
    private removeRedundantWhitespace(text: string): string {
        return text
            .replace(/[ \t]+/g, ' ')           // Multiple spaces/tabs to single space
            .replace(/\n{3,}/g, '\n\n')         // Multiple newlines to double
            .replace(/^\s+$/gm, '')             // Empty lines with whitespace
            .trim();
    }

    /**
     * Truncate very long lines
     */
    private truncateLongLines(text: string, maxLength: number): string {
        return text.split('\n').map(line => {
            if (line.length > maxLength) {
                return line.substring(0, maxLength - 3) + '...';
            }
            return line;
        }).join('\n');
    }

    /**
     * Summarize repetitive patterns (e.g., repeated log lines)
     */
    private summarizeRepetition(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];
        let repeatCount = 0;
        let lastLine = '';

        for (const line of lines) {
            const normalized = line.trim().replace(/\d+/g, 'N'); // Normalize numbers

            if (normalized === lastLine && repeatCount < 100) {
                repeatCount++;
            } else {
                if (repeatCount > 2) {
                    result.push(`... (${repeatCount - 1} similar lines omitted) ...`);
                } else if (repeatCount > 0) {
                    result.push(lastLine);
                }
                result.push(line);
                repeatCount = 1;
                lastLine = normalized;
            }
        }

        if (repeatCount > 2) {
            result.push(`... (${repeatCount - 1} similar lines omitted) ...`);
        }

        return result.join('\n');
    }

    /**
     * Remove boilerplate content
     */
    private removeBoilerplate(text: string): string {
        return text
            .replace(/\/\*[\s\S]*?\*\//g, '')           // Block comments
            .replace(/\/\/.*$/gm, '')                    // Line comments (be careful)
            .replace(/^\s*#.*$/gm, '')                   // Shell/Python comments
            .replace(/console\.(log|debug|info)\([^)]*\);?\n?/g, '') // Console logs
            .replace(/\n{3,}/g, '\n\n');                 // Clean up resulting empty lines
    }

    /**
     * Smart truncation - keeps beginning and end, removes middle
     */
    private smartTruncate(text: string, targetTokens: number): string {
        const targetChars = targetTokens * 4;

        if (text.length <= targetChars) {
            return text;
        }

        const keepRatio = 0.4; // Keep 40% from start, 40% from end
        const keepChars = Math.floor(targetChars * keepRatio);

        const start = text.substring(0, keepChars);
        const end = text.substring(text.length - keepChars);
        const omittedChars = text.length - (keepChars * 2);

        return `${start}\n\n... (${omittedChars} characters omitted for brevity) ...\n\n${end}`;
    }
}

// =============================================================================
// DEDUPE CACHE (LRU + TTL)
// =============================================================================

/**
 * Deduplication Cache - Prevents duplicate processing
 * Ported from MoltBot's dedupe.ts with LRU + TTL hybrid strategy
 */
export class DedupeCache<T> {
    private cache: Map<string, CacheEntry<T>>;
    private config: VelocityConfig;
    private cleanupTimer: NodeJS.Timeout | null = null;

    constructor(config: Partial<VelocityConfig> = {}) {
        this.config = { ...DEFAULT_VELOCITY_CONFIG, ...config };
        this.cache = new Map();
        this.startCleanupTimer();
    }

    /**
     * Get a value from the cache
     */
    get(key: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) return undefined;

        // Check TTL
        if (Date.now() - entry.createdAt > this.config.cacheTtlMs) {
            this.cache.delete(key);
            return undefined;
        }

        // Update access time and hits
        entry.accessedAt = Date.now();
        entry.hits++;

        return entry.value;
    }

    /**
     * Set a value in the cache
     */
    set(key: string, value: T): void {
        // Enforce max entries (LRU eviction)
        if (this.cache.size >= this.config.maxCacheEntries) {
            this.evictLRU();
        }

        this.cache.set(key, {
            value,
            createdAt: Date.now(),
            accessedAt: Date.now(),
            hits: 0,
        });
    }

    /**
     * Check if a key exists (and is not expired)
     */
    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    /**
     * Delete a key from the cache
     */
    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear the entire cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache size
     */
    get size(): number {
        return this.cache.size;
    }

    /**
     * Evict the least recently used entry
     */
    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.accessedAt < oldestTime) {
                oldestTime = entry.accessedAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Start periodic cleanup of expired entries
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.cache) {
                if (now - entry.createdAt > this.config.cacheTtlMs) {
                    this.cache.delete(key);
                }
            }
        }, this.config.cacheTtlMs / 2);
    }

    /**
     * Stop the cleanup timer
     */
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
}

// =============================================================================
// STREAM EMITTER (Micro-Updates)
// =============================================================================

/**
 * Stream Emitter - Real-time status updates ("Micro-Updates")
 * Provides the "talking while working" experience
 */
export class StreamEmitter extends EventEmitter {
    private history: StreamEvent[] = [];
    private maxHistory = 100;

    /**
     * Emit a lifecycle event (start, end, pause, resume)
     */
    lifecycle(message: string, metadata?: Record<string, unknown>): void {
        this.emit('stream', this.createEvent('lifecycle', message, metadata));
    }

    /**
     * Emit a tool execution event
     */
    tool(toolName: string, action: 'start' | 'end' | 'error', details?: string): void {
        const messages: Record<string, Record<string, string>> = {
            read: { start: '📖 Reading file...', end: '✓ File read', error: '✗ Read failed' },
            write: { start: '✍️ Writing file...', end: '✓ File saved', error: '✗ Write failed' },
            edit: { start: '✏️ Editing file...', end: '✓ Edit applied', error: '✗ Edit failed' },
            exec: { start: '⚡ Running command...', end: '✓ Command complete', error: '✗ Command failed' },
            grep: { start: '🔍 Searching...', end: '✓ Search complete', error: '✗ Search failed' },
            find: { start: '📁 Finding files...', end: '✓ Files found', error: '✗ Find failed' },
            ls: { start: '📂 Listing directory...', end: '✓ Listed', error: '✗ List failed' },
        };

        const toolMessages = messages[toolName.toLowerCase()] || {
            start: `⚙️ Running ${toolName}...`,
            end: `✓ ${toolName} complete`,
            error: `✗ ${toolName} failed`,
        };

        const message = details
            ? `${toolMessages[action]} - ${details}`
            : toolMessages[action];

        this.emit('stream', this.createEvent('tool', message, { toolName, action }));
    }

    /**
     * Emit a thinking/reasoning event
     */
    thinking(message: string): void {
        this.emit('stream', this.createEvent('thinking', `💭 ${message}`));
    }

    /**
     * Emit a progress update
     */
    progress(message: string, percent?: number): void {
        const formatted = percent !== undefined
            ? `📊 ${message} (${percent}%)`
            : `📊 ${message}`;
        this.emit('stream', this.createEvent('progress', formatted, { percent }));
    }

    /**
     * Emit an error event
     */
    error(message: string, details?: string): void {
        const formatted = details ? `❌ ${message}: ${details}` : `❌ ${message}`;
        this.emit('stream', this.createEvent('error', formatted));
    }

    /**
     * Create an event object
     */
    private createEvent(
        type: StreamEvent['type'],
        message: string,
        metadata?: Record<string, unknown>
    ): StreamEvent {
        const event: StreamEvent = {
            type,
            message,
            timestamp: Date.now(),
            metadata,
        };

        // Add to history
        this.history.push(event);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        return event;
    }

    /**
     * Get event history
     */
    getHistory(): StreamEvent[] {
        return [...this.history];
    }

    /**
     * Clear history
     */
    clearHistory(): void {
        this.history = [];
    }
}

// =============================================================================
// VELOCITY ENGINE (Combined Interface)
// =============================================================================

/**
 * Velocity Engine - Unified interface for all speed optimizations
 */
export class VelocityEngine {
    public readonly compactor: ContextCompactor;
    public readonly cache: DedupeCache<any>;
    public readonly stream: StreamEmitter;
    private config: VelocityConfig;

    constructor(config: Partial<VelocityConfig> = {}) {
        this.config = { ...DEFAULT_VELOCITY_CONFIG, ...config };
        this.compactor = new ContextCompactor(this.config);
        this.cache = new DedupeCache(this.config);
        this.stream = new StreamEmitter();
    }

    /**
     * Process context with caching and compaction
     */
    processContext(key: string, context: string): CompactionResult {
        // Check cache first
        const cached = this.cache.get(key);
        if (cached) {
            this.stream.progress('Using cached context');
            return cached;
        }

        // Compact the context
        this.stream.progress('Compacting context...');
        const result = this.compactor.compact(context);

        // Cache the result
        this.cache.set(key, result);

        this.stream.progress(
            `Context compacted: ${result.originalTokens} → ${result.compactedTokens} tokens ` +
            `(${Math.round(result.compressionRatio * 100)}%)`
        );

        return result;
    }

    /**
     * Check if context needs compaction
     */
    needsCompaction(context: string): boolean {
        const tokens = this.compactor.estimateTokens(context);
        const threshold = this.config.maxContextTokens * this.config.compressionTarget;
        return tokens > threshold;
    }

    /**
     * Get cache stats
     */
    getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
        return {
            size: this.cache.size,
            maxSize: this.config.maxCacheEntries,
            ttlMs: this.config.cacheTtlMs,
        };
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.cache.destroy();
        this.stream.removeAllListeners();
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let velocityInstance: VelocityEngine | null = null;

/**
 * Get the global velocity engine instance
 */
export function getVelocityEngine(config?: Partial<VelocityConfig>): VelocityEngine {
    if (!velocityInstance) {
        velocityInstance = new VelocityEngine(config);
    }
    return velocityInstance;
}

/**
 * Reset the global velocity engine instance
 */
export function resetVelocityEngine(): void {
    if (velocityInstance) {
        velocityInstance.destroy();
        velocityInstance = null;
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    VelocityEngine,
    ContextCompactor,
    DedupeCache,
    StreamEmitter,
    getVelocityEngine,
    resetVelocityEngine,
    DEFAULT_VELOCITY_CONFIG,
};
