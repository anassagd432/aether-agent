/**
 * Agdi Intelligence Module Index
 * 
 * Central export point for all intelligence systems:
 * - SkillManager: Skills Matching Engine
 * - ThinkingEngine: Chain of Thought Parser
 * - ModelRouter: Cost/Speed Optimization
 */

// =============================================================================
// SKILL MANAGER
// =============================================================================

export {
    SkillManager,
    getSkillManager,
    resetSkillManager,
    type Skill,
    type SkillMatch,
    type SkillManagerConfig,
} from './SkillManager';

// =============================================================================
// THINKING ENGINE
// =============================================================================

export {
    ThinkingEngine,
    getThinkingEngine,
    resetThinkingEngine,
    wrapStreamWithThinking,
    stripThinkingTags,
    extractThinkingContent,
    DANGEROUS_KEYWORDS,
    type ThinkingState,
    type ThinkingEngineConfig,
    type ParsedResponse,
    type SecurityAlert,
} from './ThinkingEngine';

// =============================================================================
// MODEL ROUTER
// =============================================================================

export {
    ModelRouter,
    getModelRouter,
    resetModelRouter,
    DEFAULT_ROUTES,
    DEFAULT_ALIASES,
    type TaskType,
    type ModelRef,
    type ModelRoute,
    type ModelRouterConfig,
} from './ModelRouter';

// =============================================================================
// UNIFIED INTELLIGENCE INTERFACE
// =============================================================================

import { getSkillManager, type SkillMatch } from './SkillManager';
import { getThinkingEngine, wrapStreamWithThinking } from './ThinkingEngine';
import { getModelRouter, type ModelRoute } from './ModelRouter';

/**
 * Agdi Intelligence - unified interface for all smart features
 */
export class AgdiIntelligence {
    private skillManager = getSkillManager();
    private thinkingEngine = getThinkingEngine();
    private modelRouter = getModelRouter();

    /**
     * Process a user request through the full intelligence pipeline
     */
    async processRequest(request: string, context?: {
        hasImage?: boolean;
        contextTokens?: number;
        forceModel?: string;
        debugMode?: boolean;
    }): Promise<{
        skillMatch: SkillMatch | null;
        modelRoute: ModelRoute;
        systemPromptAddition: string;
        thinkingEnabled: boolean;
    }> {
        // 1. Match skills
        const skillMatch = await this.skillManager.matchSkill(request);

        // 2. Route to optimal model
        const modelRoute = this.modelRouter.route(request, context);

        // 3. Build skill prompt addition
        let systemPromptAddition = '';
        if (skillMatch) {
            const skillContent = await this.skillManager.loadSkillContent(skillMatch.skill);
            systemPromptAddition = `\n\n## Active Skill: ${skillMatch.skill.name}\n${skillContent}`;
        }

        // 4. Configure thinking engine
        const thinkingEnabled = modelRoute.thinkLevel !== 'off';
        this.thinkingEngine.setDebugMode(context?.debugMode || false);

        return {
            skillMatch,
            modelRoute,
            systemPromptAddition,
            thinkingEnabled,
        };
    }

    /**
     * Create a stream processor for removing thinking tags
     */
    createStreamProcessor() {
        return this.thinkingEngine.createStreamProcessor();
    }

    /**
     * Wrap a response stream with thinking tag processing
     */
    wrapStream(stream: AsyncIterable<string>) {
        return wrapStreamWithThinking(stream, this.thinkingEngine);
    }

    /**
     * Reset all engines
     */
    reset() {
        this.thinkingEngine.reset();
        this.skillManager.clearCache();
    }

    /**
     * Get current thinking state
     */
    getThinkingState() {
        return this.thinkingEngine.getState();
    }

    /**
     * Explain routing decision
     */
    explainRouting(request: string, context?: {
        hasImage?: boolean;
        contextTokens?: number;
    }) {
        return this.modelRouter.explainRouting(request, context);
    }
}

// =============================================================================
// SINGLETON
// =============================================================================

let intelligenceInstance: AgdiIntelligence | null = null;

export function getAgdiIntelligence(): AgdiIntelligence {
    if (!intelligenceInstance) {
        intelligenceInstance = new AgdiIntelligence();
    }
    return intelligenceInstance;
}

export function resetAgdiIntelligence(): void {
    if (intelligenceInstance) {
        intelligenceInstance.reset();
    }
    intelligenceInstance = null;
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
    AgdiIntelligence,
    getAgdiIntelligence,
    resetAgdiIntelligence,
};
