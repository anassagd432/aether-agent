/**
 * Agdi Thinking Engine
 * 
 * Implements the "Chain of Thought" parser from MoltBot's intelligence.
 * Parses <think>/<final> tags to separate internal reasoning from user output.
 * 
 * Features:
 * 1. Parse <think>...</think> tags - internal reasoning (hidden)
 * 2. Parse <final>...</final> tags - user-visible output
 * 3. CLI spinner while "thinking"
 * 4. Debug mode to show raw thinking
 */

import { EventEmitter } from 'events';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ThinkingState {
    isThinking: boolean;
    thinkingContent: string;
    finalContent: string;
    rawContent: string;
    parseComplete: boolean;
}

export interface ThinkingEngineConfig {
    showThinkingSpinner?: boolean;
    debugMode?: boolean;
    spinnerFrames?: string[];
    spinnerIntervalMs?: number;
    /** Enable Zero-Trust security scanning of think blocks */
    enableSecurityScan?: boolean;
}

/**
 * Zero-Trust Security Alert - emitted when dangerous keywords detected in thinking
 */
export interface SecurityAlert {
    level: 'low' | 'medium' | 'high' | 'critical';
    keywords: string[];
    thinkingContent: string;
    message: string;
    timestamp: number;
}

/**
 * Dangerous keywords that trigger Zero-Trust alerts
 */
export const DANGEROUS_KEYWORDS: Record<string, 'high' | 'critical'> = {
    // File destruction
    'delete': 'high',
    'destroy': 'high',
    'remove': 'high',
    'rm -rf': 'critical',
    'rmdir': 'high',
    'unlink': 'high',
    'truncate': 'high',

    // System commands
    'sudo': 'critical',
    'chmod 777': 'critical',
    'format': 'critical',
    ':(){:|:&};:': 'critical', // Fork bomb

    // Database
    'drop table': 'critical',
    'drop database': 'critical',
    'truncate table': 'critical',
    'delete from': 'high',

    // Secrets/credentials
    'password': 'high',
    'api_key': 'high',
    'api-key': 'high',
    'secret': 'high',
    'token': 'high',
    'private_key': 'critical',

    // Network
    'curl': 'high',
    'wget': 'high',
    'exfiltrate': 'critical',
    'upload': 'high',
};

export interface ParsedResponse {
    thinking: string[];
    final: string;
    raw: string;
    hasThinkingTags: boolean;
    hasFinalTags: boolean;
}

// =============================================================================
// SPINNER FRAMES
// =============================================================================

const DEFAULT_SPINNER_FRAMES = ['🧠', '🧠·', '🧠··', '🧠···', '🧠····', '🧠···', '🧠··', '🧠·'];
const BRAIN_PULSE_FRAMES = ['🧠', '💭', '💡', '💭'];

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_CONFIG: ThinkingEngineConfig = {
    showThinkingSpinner: true,
    debugMode: false,
    spinnerFrames: DEFAULT_SPINNER_FRAMES,
    spinnerIntervalMs: 200,
    enableSecurityScan: true, // Zero-Trust enabled by default
};

// =============================================================================
// THINKING ENGINE
// =============================================================================

export class ThinkingEngine extends EventEmitter {
    private config: ThinkingEngineConfig;
    private state: ThinkingState;
    private spinnerInterval: NodeJS.Timeout | null = null;
    private spinnerFrame: number = 0;
    private streamBuffer: string = '';

    constructor(config: Partial<ThinkingEngineConfig> = {}) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.state = this.createInitialState();
    }

    /**
     * Create initial state
     */
    private createInitialState(): ThinkingState {
        return {
            isThinking: false,
            thinkingContent: '',
            finalContent: '',
            rawContent: '',
            parseComplete: false,
        };
    }

    /**
     * Parse a complete response with <think> and <final> tags
     */
    parseResponse(response: string): ParsedResponse {
        const thinking: string[] = [];
        let final = '';

        // Extract all <think>...</think> blocks
        const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
        let match;
        while ((match = thinkRegex.exec(response)) !== null) {
            thinking.push(match[1].trim());
        }

        // Extract <final>...</final> block
        const finalRegex = /<final>([\s\S]*?)<\/final>/i;
        const finalMatch = response.match(finalRegex);
        if (finalMatch) {
            final = finalMatch[1].trim();
        } else {
            // If no <final> tags, use content after last </think> or entire response
            const lastThinkEnd = response.lastIndexOf('</think>');
            if (lastThinkEnd !== -1) {
                final = response.substring(lastThinkEnd + 8).trim();
            } else if (thinking.length === 0) {
                // No tags at all, entire response is "final"
                final = response;
            }
        }

        return {
            thinking,
            final,
            raw: response,
            hasThinkingTags: thinking.length > 0,
            hasFinalTags: !!finalMatch,
        };
    }

    /**
     * Process a streaming chunk and update state
     */
    processStreamChunk(chunk: string): {
        showToUser: string;
        isThinking: boolean;
        thinkingUpdate?: string;
    } {
        this.streamBuffer += chunk;
        this.state.rawContent = this.streamBuffer;

        let showToUser = '';
        let thinkingUpdate: string | undefined;

        // Check if we're inside <think> tags
        const lastThinkOpen = this.streamBuffer.lastIndexOf('<think>');
        const lastThinkClose = this.streamBuffer.lastIndexOf('</think>');

        const wasThinking = this.state.isThinking;
        this.state.isThinking = lastThinkOpen > lastThinkClose;

        // Started thinking
        if (!wasThinking && this.state.isThinking) {
            this.emit('thinking_start');
            this.startSpinner();
        }

        // Stopped thinking
        if (wasThinking && !this.state.isThinking) {
            this.emit('thinking_end');
            this.stopSpinner();

            // Extract the thinking content that just ended
            const thinkContent = this.extractLastThinkBlock();
            if (thinkContent) {
                thinkingUpdate = thinkContent;
                this.state.thinkingContent += thinkContent + '\n';
                this.emit('thinking_content', thinkContent);

                // Zero-Trust: Scan for dangerous keywords
                if (this.config.enableSecurityScan) {
                    const alert = this.scanForDangerousContent(thinkContent);
                    if (alert) {
                        this.emit('security_alert', alert);
                        console.warn(`\n⚠️ ZERO-TRUST ALERT [${alert.level.toUpperCase()}]: ${alert.message}`);
                        console.warn(`   Keywords detected: ${alert.keywords.join(', ')}\n`);
                    }
                }
            }
        }

        // Check for <final> content
        const finalRegex = /<final>([\s\S]*?)<\/final>/gi;
        const matches = [...this.streamBuffer.matchAll(finalRegex)];
        if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            const finalContent = lastMatch[1];

            // Only emit new content
            const newContent = finalContent.substring(this.state.finalContent.length);
            if (newContent) {
                showToUser = newContent;
                this.state.finalContent = finalContent;
            }
        } else if (!this.state.isThinking) {
            // No final tags, show content after last </think>
            const afterThinking = this.getContentAfterThinking();
            const newContent = afterThinking.substring(this.state.finalContent.length);
            if (newContent) {
                showToUser = newContent;
                this.state.finalContent = afterThinking;
            }
        }

        // Debug mode: show thinking content too
        if (this.config.debugMode && thinkingUpdate) {
            console.log(`\n[DEBUG THINKING]\n${thinkingUpdate}\n[/DEBUG THINKING]\n`);
        }

        return {
            showToUser,
            isThinking: this.state.isThinking,
            thinkingUpdate,
        };
    }

    /**
     * Extract the last complete <think> block from buffer
     */
    private extractLastThinkBlock(): string | null {
        const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
        const matches = [...this.streamBuffer.matchAll(thinkRegex)];

        if (matches.length > 0) {
            return matches[matches.length - 1][1].trim();
        }

        return null;
    }

    /**
     * Get content after the last </think> tag
     */
    private getContentAfterThinking(): string {
        const lastThinkEnd = this.streamBuffer.lastIndexOf('</think>');
        if (lastThinkEnd !== -1) {
            return this.streamBuffer.substring(lastThinkEnd + 8).trim();
        }

        // No think tags, return entire buffer (excluding any starting <think>)
        if (!this.streamBuffer.includes('<think>')) {
            return this.streamBuffer;
        }

        return '';
    }

    /**
     * Zero-Trust Security Scan
     * Scans thinking content for dangerous keywords and returns an alert if found
     */
    private scanForDangerousContent(content: string): SecurityAlert | null {
        const contentLower = content.toLowerCase();
        const foundKeywords: string[] = [];
        let maxLevel: 'high' | 'critical' = 'high';

        for (const [keyword, level] of Object.entries(DANGEROUS_KEYWORDS)) {
            if (contentLower.includes(keyword.toLowerCase())) {
                foundKeywords.push(keyword);
                if (level === 'critical') {
                    maxLevel = 'critical';
                }
            }
        }

        if (foundKeywords.length === 0) {
            return null;
        }

        return {
            level: maxLevel,
            keywords: foundKeywords,
            thinkingContent: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
            message: `AI is considering ${foundKeywords.length} potentially dangerous action(s)`,
            timestamp: Date.now(),
        };
    }

    /**
     * Start the thinking spinner
     */
    private startSpinner(): void {
        if (!this.config.showThinkingSpinner || this.spinnerInterval) {
            return;
        }

        this.spinnerFrame = 0;
        this.spinnerInterval = setInterval(() => {
            const frames = this.config.spinnerFrames || DEFAULT_SPINNER_FRAMES;
            this.spinnerFrame = (this.spinnerFrame + 1) % frames.length;
            const frame = frames[this.spinnerFrame];

            // Emit spinner frame for CLI rendering
            this.emit('spinner', frame);

            // Write to stdout with carriage return (overwrites previous)
            if (process.stdout.isTTY) {
                process.stdout.write(`\r${frame} Thinking...`);
            }
        }, this.config.spinnerIntervalMs);
    }

    /**
     * Stop the thinking spinner
     */
    private stopSpinner(): void {
        if (this.spinnerInterval) {
            clearInterval(this.spinnerInterval);
            this.spinnerInterval = null;

            // Clear the spinner line
            if (process.stdout.isTTY) {
                process.stdout.write('\r                    \r');
            }
        }
    }

    /**
     * Reset the engine state for a new response
     */
    reset(): void {
        this.stopSpinner();
        this.state = this.createInitialState();
        this.streamBuffer = '';
        this.spinnerFrame = 0;
    }

    /**
     * Get the current state
     */
    getState(): ThinkingState {
        return { ...this.state };
    }

    /**
     * Set debug mode
     */
    setDebugMode(enabled: boolean): void {
        this.config.debugMode = enabled;
    }

    /**
     * Check if currently thinking
     */
    isThinking(): boolean {
        return this.state.isThinking;
    }

    /**
     * Get final content only
     */
    getFinalContent(): string {
        return this.state.finalContent;
    }

    /**
     * Get thinking content (for debug/logging)
     */
    getThinkingContent(): string {
        return this.state.thinkingContent;
    }

    /**
     * Create a stream processor function for integration
     */
    createStreamProcessor(): (chunk: string) => string {
        return (chunk: string) => {
            const result = this.processStreamChunk(chunk);
            return result.showToUser;
        };
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        this.stopSpinner();
        this.removeAllListeners();
    }
}

// =============================================================================
// CLI INTEGRATION HELPERS
// =============================================================================

/**
 * Wrap an async generator to parse thinking tags
 */
export async function* wrapStreamWithThinking(
    stream: AsyncIterable<string>,
    engine: ThinkingEngine
): AsyncGenerator<string> {
    engine.reset();

    for await (const chunk of stream) {
        const result = engine.processStreamChunk(chunk);
        if (result.showToUser) {
            yield result.showToUser;
        }
    }

    // Emit final state
    engine.emit('stream_end', engine.getState());
}

/**
 * Simple function to strip thinking tags from response
 */
export function stripThinkingTags(response: string): string {
    const engine = new ThinkingEngine();
    const parsed = engine.parseResponse(response);
    return parsed.final;
}

/**
 * Extract thinking content for logging/analysis
 */
export function extractThinkingContent(response: string): string[] {
    const engine = new ThinkingEngine();
    const parsed = engine.parseResponse(response);
    return parsed.thinking;
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let thinkingEngineInstance: ThinkingEngine | null = null;

export function getThinkingEngine(config?: Partial<ThinkingEngineConfig>): ThinkingEngine {
    if (!thinkingEngineInstance) {
        thinkingEngineInstance = new ThinkingEngine(config);
    }
    return thinkingEngineInstance;
}

export function resetThinkingEngine(): void {
    if (thinkingEngineInstance) {
        thinkingEngineInstance.destroy();
        thinkingEngineInstance = null;
    }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    ThinkingEngine,
    getThinkingEngine,
    resetThinkingEngine,
    wrapStreamWithThinking,
    stripThinkingTags,
    extractThinkingContent,
};
