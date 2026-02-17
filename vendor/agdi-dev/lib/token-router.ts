/**
 * Token Arbitrage Engine
 * 
 * Intelligently routes tasks to the optimal model based on complexity.
 * Goal: 60% cost reduction by using cheap models for simple tasks.
 */

// ==================== TYPES ====================

export type TaskComplexity = 'simple' | 'medium' | 'complex';

export interface ModelConfig {
    provider: 'gemini' | 'openrouter' | 'openai' | 'anthropic' | 'deepseek';
    model: string;
    costPerMillion: number;  // USD per million tokens
    maxTokens: number;
    description: string;
}

export interface RoutingDecision {
    complexity: TaskComplexity;
    selectedModel: ModelConfig;
    reason: string;
    estimatedCost: number;  // For a typical request
}

export interface CostTracker {
    totalTokens: number;
    totalCost: number;
    savedCost: number;  // Compared to always using premium
    requests: number;
}

// ==================== MODEL TIERS ====================

export const MODEL_TIERS: Record<TaskComplexity, ModelConfig[]> = {
    simple: [
        {
            provider: 'deepseek',
            model: 'deepseek-chat',
            costPerMillion: 0.14,
            maxTokens: 8192,
            description: 'DeepSeek V3 - Fast & cheap for syntax fixes',
        },
        {
            provider: 'gemini',
            model: 'gemini-2.0-flash',
            costPerMillion: 0.075,
            maxTokens: 8192,
            description: 'Gemini Flash - Ultra fast for simple edits',
        },
    ],
    medium: [
        {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            costPerMillion: 0.15,
            maxTokens: 16384,
            description: 'Gemini 2.5 Flash - Balanced quality/cost',
        },
        {
            provider: 'anthropic',
            model: 'claude-3-5-haiku-20241022',
            costPerMillion: 0.25,
            maxTokens: 8192,
            description: 'Claude Haiku - Fast reasoning',
        },
    ],
    complex: [
        {
            provider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            costPerMillion: 3.0,
            maxTokens: 16384,
            description: 'Claude Sonnet - Best code quality',
        },
        {
            provider: 'gemini',
            model: 'gemini-2.5-pro',
            costPerMillion: 1.25,
            maxTokens: 32768,
            description: 'Gemini Pro - Deep reasoning',
        },
    ],
};

// Premium model for comparison (always using best)
const PREMIUM_MODEL = MODEL_TIERS.complex[0];

// ==================== COMPLEXITY ANALYZER ====================

const SIMPLE_PATTERNS = [
    /fix\s*(the\s*)?(typo|syntax|semicolon|comma|bracket|import)/i,
    /add\s*(a\s*)?(semicolon|comma|bracket|import)/i,
    /remove\s*(the\s*)?(unused|extra|duplicate)/i,
    /format\s*(the\s*)?(code|file)/i,
    /rename\s/i,
    /change\s*(the\s*)?(color|text|label|title)/i,
    /update\s*(the\s*)?(version|dependency)/i,
];

const COMPLEX_PATTERNS = [
    /architect|design|implement|build\s+a\s+(full|complete)/i,
    /refactor.*entire|whole|complete/i,
    /create\s+(a\s+)?(new\s+)?(app|application|project|system)/i,
    /database\s+(schema|design|migration)/i,
    /authentication|authorization|security/i,
    /api\s+(design|architecture)/i,
    /optimize.*performance/i,
    /migrate.*from.*to/i,
    /integrate.*with/i,
];

/**
 * Analyze prompt complexity to determine routing
 */
export function analyzeComplexity(prompt: string): TaskComplexity {
    const lowerPrompt = prompt.toLowerCase();
    const wordCount = prompt.split(/\s+/).length;

    // Check for simple patterns
    for (const pattern of SIMPLE_PATTERNS) {
        if (pattern.test(prompt)) {
            return 'simple';
        }
    }

    // Check for complex patterns
    for (const pattern of COMPLEX_PATTERNS) {
        if (pattern.test(prompt)) {
            return 'complex';
        }
    }

    // Heuristics based on length and keywords
    if (wordCount < 10) {
        return 'simple';
    }

    if (wordCount > 50 || lowerPrompt.includes('full') || lowerPrompt.includes('complete')) {
        return 'complex';
    }

    return 'medium';
}

// ==================== TOKEN ROUTER ====================

export class TokenRouter {
    private costTracker: CostTracker = {
        totalTokens: 0,
        totalCost: 0,
        savedCost: 0,
        requests: 0,
    };

    private preferredProvider?: string;

    constructor(preferredProvider?: string) {
        this.preferredProvider = preferredProvider;
    }

    /**
     * Select the optimal model for a given prompt
     */
    selectModel(prompt: string, budget: 'economy' | 'balanced' | 'premium' = 'balanced'): RoutingDecision {
        const complexity = analyzeComplexity(prompt);

        // Override for premium budget
        if (budget === 'premium') {
            return {
                complexity,
                selectedModel: PREMIUM_MODEL,
                reason: 'Premium budget requested - using best model',
                estimatedCost: this.estimateCost(PREMIUM_MODEL, prompt),
            };
        }

        // Get models for this complexity tier
        let models = MODEL_TIERS[complexity];

        // Filter by preferred provider if set
        if (this.preferredProvider) {
            const filtered = models.filter(m => m.provider === this.preferredProvider);
            if (filtered.length > 0) {
                models = filtered;
            }
        }

        // For economy, always pick cheapest
        if (budget === 'economy') {
            models = [...models].sort((a, b) => a.costPerMillion - b.costPerMillion);
        }

        const selectedModel = models[0];

        return {
            complexity,
            selectedModel,
            reason: this.generateReason(complexity, selectedModel),
            estimatedCost: this.estimateCost(selectedModel, prompt),
        };
    }

    /**
     * Record usage for cost tracking
     */
    recordUsage(model: ModelConfig, tokensUsed: number): void {
        const cost = (tokensUsed / 1_000_000) * model.costPerMillion;
        const premiumCost = (tokensUsed / 1_000_000) * PREMIUM_MODEL.costPerMillion;

        this.costTracker.totalTokens += tokensUsed;
        this.costTracker.totalCost += cost;
        this.costTracker.savedCost += premiumCost - cost;
        this.costTracker.requests++;
    }

    /**
     * Get cost tracking stats
     */
    getStats(): CostTracker & { savingsPercent: number } {
        const premiumEquivalent = this.costTracker.totalCost + this.costTracker.savedCost;
        const savingsPercent = premiumEquivalent > 0
            ? (this.costTracker.savedCost / premiumEquivalent) * 100
            : 0;

        return {
            ...this.costTracker,
            savingsPercent,
        };
    }

    /**
     * Reset cost tracking
     */
    resetStats(): void {
        this.costTracker = {
            totalTokens: 0,
            totalCost: 0,
            savedCost: 0,
            requests: 0,
        };
    }

    private estimateCost(model: ModelConfig, prompt: string): number {
        // Rough estimate: prompt tokens + estimated response tokens
        const promptTokens = Math.ceil(prompt.length / 4);
        const estimatedResponseTokens = 2000;  // Typical code response
        return ((promptTokens + estimatedResponseTokens) / 1_000_000) * model.costPerMillion;
    }

    private generateReason(complexity: TaskComplexity, model: ModelConfig): string {
        switch (complexity) {
            case 'simple':
                return `Quick task detected → Using ${model.description}`;
            case 'medium':
                return `Standard task → Using ${model.description}`;
            case 'complex':
                return `Complex architecture task → Using ${model.description}`;
        }
    }
}

// ==================== SINGLETON ====================

let globalRouter: TokenRouter | null = null;

export function getTokenRouter(preferredProvider?: string): TokenRouter {
    if (!globalRouter) {
        globalRouter = new TokenRouter(preferredProvider);
    }
    return globalRouter;
}

// ==================== REACT HOOK HELPER ====================

export function useTokenRouter(preferredProvider?: string) {
    const router = getTokenRouter(preferredProvider);
    return {
        selectModel: router.selectModel.bind(router),
        recordUsage: router.recordUsage.bind(router),
        getStats: router.getStats.bind(router),
        resetStats: router.resetStats.bind(router),
    };
}
