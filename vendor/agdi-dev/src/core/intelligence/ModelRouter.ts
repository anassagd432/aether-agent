/**
 * Agdi Model Router
 * 
 * Implements intelligent model selection based on task type.
 * Routes to the optimal model for cost/speed/quality balance.
 * 
 * Routing Strategy:
 * - Planning/Complex: claude-3-opus (best reasoning)
 * - Coding/Syntax: claude-3-5-sonnet (fast, accurate)
 * - Chat/Summaries: groq/llama-3 (instant, cheap)
 * - Large Context: gemini-2.5-pro (1M+ tokens)
 * 
 * Config override: ~/.agdi/config.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type TaskType =
    | 'planning'
    | 'coding'
    | 'review'
    | 'chat'
    | 'summarization'
    | 'instant'
    | 'largeContext'
    | 'image'
    | 'unknown';

export interface ModelRef {
    provider: string;
    model: string;
}

export interface ModelRoute {
    task: TaskType;
    model: ModelRef;
    reason: string;
    thinkLevel: 'off' | 'low' | 'medium' | 'high';
    maxTokens?: number;
}

export interface ModelRouterConfig {
    defaultProvider: string;
    defaultModel: string;
    routes: Partial<Record<TaskType, ModelRef>>;
    aliases: Record<string, ModelRef>;
    contextThreshold: number; // Tokens above which to use large context model
    userConfigPath?: string;
}

// =============================================================================
// DEFAULT ROUTING TABLE
// =============================================================================

export const DEFAULT_ROUTES: Record<TaskType, ModelRoute> = {
    planning: {
        task: 'planning',
        model: { provider: 'anthropic', model: 'claude-4.5-opus' },
        reason: 'Best reasoning depth for complex planning',
        thinkLevel: 'medium',
    },
    coding: {
        task: 'coding',
        model: { provider: 'anthropic', model: 'claude-4.5-sonnet' },
        reason: 'Fast, accurate code generation',
        thinkLevel: 'low',
    },
    review: {
        task: 'review',
        model: { provider: 'anthropic', model: 'claude-4.5-sonnet' },
        reason: 'Good balance of speed and thoroughness',
        thinkLevel: 'low',
    },
    chat: {
        task: 'chat',
        model: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        reason: 'Fast responses for conversational tasks',
        thinkLevel: 'off',
    },
    summarization: {
        task: 'summarization',
        model: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        reason: 'Cheap and fast for extraction tasks',
        thinkLevel: 'off',
    },
    instant: {
        task: 'instant',
        model: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        reason: 'Sub-second inference',
        thinkLevel: 'off',
    },
    largeContext: {
        task: 'largeContext',
        model: { provider: 'google', model: 'gemini-2.5-pro' },
        reason: '1M+ token context window',
        thinkLevel: 'medium',
    },
    image: {
        task: 'image',
        model: { provider: 'anthropic', model: 'claude-4.5-sonnet' },
        reason: 'Strong vision capabilities',
        thinkLevel: 'low',
    },
    unknown: {
        task: 'unknown',
        model: { provider: 'anthropic', model: 'claude-4.5-sonnet' },
        reason: 'Default fallback',
        thinkLevel: 'low',
    },
};

export const DEFAULT_ALIASES: Record<string, ModelRef> = {
    'fast': { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    'smart': { provider: 'anthropic', model: 'claude-4.5-opus' },
    'balanced': { provider: 'anthropic', model: 'claude-4.5-sonnet' },
    'cheap': { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    'large': { provider: 'google', model: 'gemini-2.5-pro' },
    'vision': { provider: 'anthropic', model: 'claude-4.5-sonnet' },
    'gpt': { provider: 'openai', model: 'gpt-5.2' },
    'opus': { provider: 'anthropic', model: 'claude-4.5-opus' },
    'sonnet': { provider: 'anthropic', model: 'claude-4.5-sonnet' },
};

const DEFAULT_CONFIG: ModelRouterConfig = {
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-5-sonnet-20241022',
    routes: {},
    aliases: DEFAULT_ALIASES,
    contextThreshold: 100000, // 100k tokens triggers large context model
};

// =============================================================================
// TASK CLASSIFICATION
// =============================================================================

/**
 * Patterns for classifying user requests into task types
 */
const TASK_PATTERNS: Record<TaskType, RegExp[]> = {
    planning: [
        /\b(plan|design|architect|outline|strategy|approach)\b/i,
        /\b(how should (i|we)|what's the best way)\b/i,
        /\b(break down|decompose|structure)\b/i,
    ],
    coding: [
        /\b(write|code|implement|create|build|add|fix)\b.*\b(function|class|component|module|file)\b/i,
        /\b(refactor|optimize|debug)\b/i,
        /\b(typescript|javascript|python|react|node)\b/i,
    ],
    review: [
        /\b(review|analyze|check|audit|evaluate)\b.*\b(code|implementation|pr|pull request)\b/i,
        /\b(security|performance|best practices)\b/i,
        /\bwhat('s| is) wrong with\b/i,
    ],
    chat: [
        /^(hi|hello|hey|thanks|thank you|ok|okay|sure|got it)\b/i,
        /\?$/,
        /\b(explain|what is|tell me about)\b/i,
    ],
    summarization: [
        /\b(summarize|summary|tldr|highlights|key points)\b/i,
        /\b(condense|shorten|brief)\b/i,
    ],
    instant: [
        /^(yes|no|ok|thanks|👍|✓|done)$/i,
        /^.{0,20}$/,
    ],
    largeContext: [
        /\b(entire|whole|all of|full)\b.*\b(codebase|project|repository|repo)\b/i,
        /\b(analyze|scan|search)\b.*\b(files|directory|folder)\b/i,
    ],
    image: [
        /\b(image|picture|screenshot|diagram|mockup|ui|design)\b/i,
        /\b(look at|see|view|analyze)\b.*\b(this|attached|image)\b/i,
    ],
    unknown: [],
};

// =============================================================================
// MODEL ROUTER
// =============================================================================

export class ModelRouter {
    private config: ModelRouterConfig;
    private routes: Map<TaskType, ModelRoute>;
    private userConfig: Partial<ModelRouterConfig> | null = null;

    constructor(config: Partial<ModelRouterConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.routes = new Map(Object.entries(DEFAULT_ROUTES) as [TaskType, ModelRoute][]);
        this.loadUserConfig();
    }

    /**
     * Load user configuration from ~/.agdi/config.json
     */
    private loadUserConfig(): void {
        const configPath = this.config.userConfigPath ||
            path.join(homedir(), '.agdi', 'config.json');

        try {
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf-8');
                const parsed = JSON.parse(content);
                this.userConfig = parsed.modelRouter || {};

                // Apply user overrides
                if (this.userConfig?.routes) {
                    for (const [task, modelRef] of Object.entries(this.userConfig.routes)) {
                        const existing = this.routes.get(task as TaskType);
                        if (existing && modelRef) {
                            this.routes.set(task as TaskType, {
                                ...existing,
                                model: modelRef as ModelRef,
                                reason: 'User configured',
                            });
                        }
                    }
                }

                if (this.userConfig?.aliases) {
                    this.config.aliases = { ...this.config.aliases, ...this.userConfig.aliases };
                }

                if (this.userConfig?.defaultModel) {
                    this.config.defaultModel = this.userConfig.defaultModel;
                }

                if (this.userConfig?.defaultProvider) {
                    this.config.defaultProvider = this.userConfig.defaultProvider;
                }
            }
        } catch (error) {
            console.debug('[ModelRouter] Could not load user config:', error);
        }
    }

    /**
     * Classify a user request into a task type
     */
    classifyTask(request: string, context?: {
        hasImage?: boolean;
        contextTokens?: number;
    }): TaskType {
        // Check for image analysis
        if (context?.hasImage) {
            return 'image';
        }

        // Check for large context
        if (context?.contextTokens && context.contextTokens > this.config.contextThreshold) {
            return 'largeContext';
        }

        // Check patterns
        for (const [task, patterns] of Object.entries(TASK_PATTERNS)) {
            if (task === 'unknown') continue;

            for (const pattern of patterns) {
                if (pattern.test(request)) {
                    return task as TaskType;
                }
            }
        }

        return 'unknown';
    }

    /**
     * Get the optimal model for a task type
     */
    getModelForTask(task: TaskType): ModelRoute {
        return this.routes.get(task) || DEFAULT_ROUTES.unknown;
    }

    /**
     * Route a request to the optimal model
     */
    route(request: string, context?: {
        hasImage?: boolean;
        contextTokens?: number;
        forceModel?: string;
    }): ModelRoute {
        // Check for forced model
        if (context?.forceModel) {
            const resolved = this.resolveAlias(context.forceModel);
            if (resolved) {
                return {
                    task: 'unknown',
                    model: resolved,
                    reason: 'User forced',
                    thinkLevel: 'low',
                };
            }
        }

        const task = this.classifyTask(request, context);
        return this.getModelForTask(task);
    }

    /**
     * Resolve a model alias to a ModelRef
     */
    resolveAlias(alias: string): ModelRef | null {
        const normalized = alias.toLowerCase().trim();

        // Check aliases
        if (this.config.aliases[normalized]) {
            return this.config.aliases[normalized];
        }

        // Check if it's a provider/model format
        if (alias.includes('/')) {
            const [provider, model] = alias.split('/', 2);
            return { provider, model };
        }

        return null;
    }

    /**
     * Get all available aliases
     */
    getAliases(): Record<string, ModelRef> {
        return { ...this.config.aliases };
    }

    /**
     * Get the default model
     */
    getDefaultModel(): ModelRef {
        return {
            provider: this.config.defaultProvider,
            model: this.config.defaultModel,
        };
    }

    /**
     * Update a route (runtime configuration)
     */
    setRoute(task: TaskType, model: ModelRef, reason?: string): void {
        const existing = this.routes.get(task) || DEFAULT_ROUTES[task];
        this.routes.set(task, {
            ...existing,
            model,
            reason: reason || 'Runtime configured',
        });
    }

    /**
     * Add or update an alias
     */
    setAlias(alias: string, model: ModelRef): void {
        this.config.aliases[alias.toLowerCase()] = model;
    }

    /**
     * Estimate tokens in a string (rough heuristic)
     */
    estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /**
     * Check if context size exceeds threshold for large context model
     */
    needsLargeContextModel(contextTokens: number): boolean {
        return contextTokens > this.config.contextThreshold;
    }

    /**
     * Get routing decision with explanation
     */
    explainRouting(request: string, context?: {
        hasImage?: boolean;
        contextTokens?: number;
    }): {
        task: TaskType;
        route: ModelRoute;
        explanation: string;
    } {
        const task = this.classifyTask(request, context);
        const route = this.getModelForTask(task);

        let explanation = `Task classified as "${task}". `;
        explanation += `Routing to ${route.model.provider}/${route.model.model}. `;
        explanation += `Reason: ${route.reason}. `;
        explanation += `Think level: ${route.thinkLevel}.`;

        return { task, route, explanation };
    }

    /**
     * Export current configuration for saving
     */
    exportConfig(): ModelRouterConfig {
        return {
            ...this.config,
            routes: Object.fromEntries(
                Array.from(this.routes.entries()).map(([task, route]) => [task, route.model])
            ),
        };
    }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let modelRouterInstance: ModelRouter | null = null;

export function getModelRouter(config?: Partial<ModelRouterConfig>): ModelRouter {
    if (!modelRouterInstance) {
        modelRouterInstance = new ModelRouter(config);
    }
    return modelRouterInstance;
}

export function resetModelRouter(): void {
    modelRouterInstance = null;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    ModelRouter,
    getModelRouter,
    resetModelRouter,
    DEFAULT_ROUTES,
    DEFAULT_ALIASES,
};
