/**
 * Token Optimizer - Reduce LLM API costs by 30-60%
 * 
 * Implements TOON (Token Optimized Notation) format and context management.
 * Based on patterns from awesome-llm-apps/toonify_token_optimization
 */

// ==================== TYPES ====================

export interface TokenStats {
    original: number;
    optimized: number;
    savings: number;
    savingsPercent: number;
}

export interface OptimizationResult {
    text: string;
    stats: TokenStats;
}

// ==================== TOKEN COUNTING ====================

/**
 * Estimate token count (GPT-style tokenization approximation)
 * ~4 characters per token on average for English text
 * ~3.5 for code (more symbols)
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;

    // Count code blocks separately (denser tokenization)
    const codeBlockMatches = text.match(/```[\s\S]*?```/g) || [];
    let codeTokens = 0;
    let nonCodeText = text;

    for (const block of codeBlockMatches) {
        codeTokens += Math.ceil(block.length / 3.5);
        nonCodeText = nonCodeText.replace(block, '');
    }

    // Regular text
    const textTokens = Math.ceil(nonCodeText.length / 4);

    return textTokens + codeTokens;
}

// ==================== TOON COMPRESSION ====================

/**
 * TOON Format Compression Rules:
 * 1. Remove unnecessary whitespace
 * 2. Abbreviate common phrases
 * 3. Use symbols for common patterns
 * 4. Compress JSON/code structure
 */

const TOON_REPLACEMENTS: [RegExp, string][] = [
    // Common phrases → abbreviations
    [/\bfor example\b/gi, 'eg'],
    [/\bin other words\b/gi, 'ie'],
    [/\bplease\s+/gi, ''],
    [/\bkindly\s+/gi, ''],
    [/\bcould you\s+/gi, ''],
    [/\bwould you\s+/gi, ''],
    [/\bcan you\s+/gi, ''],
    [/\bI would like you to\b/gi, ''],
    [/\bI want you to\b/gi, ''],
    [/\bI need you to\b/gi, ''],

    // Verbose → concise
    [/\bin order to\b/gi, 'to'],
    [/\bdue to the fact that\b/gi, 'because'],
    [/\bat this point in time\b/gi, 'now'],
    [/\bin the event that\b/gi, 'if'],
    [/\bwith regard to\b/gi, 're:'],
    [/\bwith respect to\b/gi, 're:'],
    [/\bin terms of\b/gi, 're:'],
    [/\bas a result of\b/gi, 'due to'],
    [/\bfor the purpose of\b/gi, 'for'],
    [/\bin the process of\b/gi, 'while'],
    [/\bhas the ability to\b/gi, 'can'],
    [/\bis able to\b/gi, 'can'],
    [/\bmake sure\b/gi, 'ensure'],

    // Programming terms
    [/\bfunction\s+that\s+/gi, 'fn '],
    [/\breturn value\b/gi, 'ret'],
    [/\bparameter\b/gi, 'param'],
    [/\bargument\b/gi, 'arg'],
    [/\bimplementation\b/gi, 'impl'],
    [/\bconfiguration\b/gi, 'config'],
    [/\bdocumentation\b/gi, 'docs'],
    [/\brepository\b/gi, 'repo'],
    [/\bdirectory\b/gi, 'dir'],
    [/\bapplication\b/gi, 'app'],
    [/\bdevelopment\b/gi, 'dev'],
    [/\bproduction\b/gi, 'prod'],
    [/\benvironment\b/gi, 'env'],

    // Whitespace compression
    [/\n{3,}/g, '\n\n'],
    [/[ \t]+/g, ' '],
    [/\n +/g, '\n'],
    [/ +\n/g, '\n'],
];

/**
 * Apply TOON compression to text
 */
export function compressToTOON(text: string): OptimizationResult {
    const originalTokens = estimateTokens(text);
    let compressed = text;

    // Apply all replacements
    for (const [pattern, replacement] of TOON_REPLACEMENTS) {
        compressed = compressed.replace(pattern, replacement);
    }

    // Trim
    compressed = compressed.trim();

    const optimizedTokens = estimateTokens(compressed);
    const savings = originalTokens - optimizedTokens;

    return {
        text: compressed,
        stats: {
            original: originalTokens,
            optimized: optimizedTokens,
            savings,
            savingsPercent: originalTokens > 0 ? Math.round((savings / originalTokens) * 100) : 0,
        },
    };
}

// ==================== CONTEXT BUDGET ====================

export interface ContextBudget {
    maxTokens: number;
    systemPromptBudget: number;
    conversationBudget: number;
    userPromptBudget: number;
}

const DEFAULT_BUDGETS: Record<string, ContextBudget> = {
    'gemini-2.5-flash': { maxTokens: 1000000, systemPromptBudget: 4000, conversationBudget: 28000, userPromptBudget: 8000 },
    'gemini-2.5-pro': { maxTokens: 2000000, systemPromptBudget: 8000, conversationBudget: 56000, userPromptBudget: 16000 },
    'gpt-4o': { maxTokens: 128000, systemPromptBudget: 4000, conversationBudget: 24000, userPromptBudget: 8000 },
    'claude-3.5-sonnet': { maxTokens: 200000, systemPromptBudget: 4000, conversationBudget: 32000, userPromptBudget: 8000 },
    'default': { maxTokens: 32000, systemPromptBudget: 2000, conversationBudget: 12000, userPromptBudget: 4000 },
};

/**
 * Get context budget for a model
 */
export function getContextBudget(model?: string): ContextBudget {
    if (!model) return DEFAULT_BUDGETS['default'];

    // Find matching budget
    for (const [key, budget] of Object.entries(DEFAULT_BUDGETS)) {
        if (model.toLowerCase().includes(key.toLowerCase())) {
            return budget;
        }
    }

    return DEFAULT_BUDGETS['default'];
}

// ==================== SMART TRUNCATION ====================

/**
 * Truncate text to fit within token budget while preserving important parts
 */
export function smartTruncate(text: string, maxTokens: number): string {
    const currentTokens = estimateTokens(text);

    if (currentTokens <= maxTokens) {
        return text;
    }

    // Try compression first
    const compressed = compressToTOON(text);
    if (compressed.stats.optimized <= maxTokens) {
        return compressed.text;
    }

    // Hard truncate with ellipsis indicator
    const ratio = maxTokens / compressed.stats.optimized;
    const targetLength = Math.floor(compressed.text.length * ratio * 0.95); // 5% safety margin

    // Try to truncate at a natural boundary
    const truncated = compressed.text.slice(0, targetLength);
    const lastNewline = truncated.lastIndexOf('\n');
    const lastPeriod = truncated.lastIndexOf('. ');

    const cutPoint = Math.max(lastNewline, lastPeriod);

    if (cutPoint > targetLength * 0.7) {
        return truncated.slice(0, cutPoint + 1) + '\n[...truncated]';
    }

    return truncated + '...[truncated]';
}

// ==================== PROMPT OPTIMIZER ====================

export interface OptimizedPrompt {
    systemPrompt: string;
    userPrompt: string;
    stats: {
        systemTokens: number;
        userTokens: number;
        totalTokens: number;
        savingsPercent: number;
    };
}

/**
 * Optimize a full prompt (system + user) for a model
 */
export function optimizePrompt(
    systemPrompt: string,
    userPrompt: string,
    model?: string
): OptimizedPrompt {
    const budget = getContextBudget(model);

    // Calculate original tokens
    const originalSystem = estimateTokens(systemPrompt);
    const originalUser = estimateTokens(userPrompt);
    const originalTotal = originalSystem + originalUser;

    // Compress both
    const compressedSystem = compressToTOON(systemPrompt);
    const compressedUser = compressToTOON(userPrompt);

    // Truncate if needed
    const finalSystem = smartTruncate(compressedSystem.text, budget.systemPromptBudget);
    const finalUser = smartTruncate(compressedUser.text, budget.userPromptBudget);

    const finalSystemTokens = estimateTokens(finalSystem);
    const finalUserTokens = estimateTokens(finalUser);
    const finalTotal = finalSystemTokens + finalUserTokens;

    return {
        systemPrompt: finalSystem,
        userPrompt: finalUser,
        stats: {
            systemTokens: finalSystemTokens,
            userTokens: finalUserTokens,
            totalTokens: finalTotal,
            savingsPercent: originalTotal > 0
                ? Math.round(((originalTotal - finalTotal) / originalTotal) * 100)
                : 0,
        },
    };
}

// ==================== EXPORTS ====================

export const TokenOptimizer = {
    estimateTokens,
    compressToTOON,
    getContextBudget,
    smartTruncate,
    optimizePrompt,
};
