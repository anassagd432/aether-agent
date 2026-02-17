/**
 * SwarmOrchestrator Integration for Intelligence Systems
 * 
 * This file shows how to integrate the SkillManager, ThinkingEngine,
 * and ModelRouter into the main SwarmOrchestrator execution loop.
 * 
 * Copy this into your existing SwarmOrchestrator or use as reference.
 */

import {
    getAgdiIntelligence,
    type ModelRoute,
    type SkillMatch,
} from './index';

import {
    buildAgdiSystemPrompt,
    SILENT_REPLY_TOKEN,
} from '../prompts/agdi-system';

// =============================================================================
// INTEGRATION EXAMPLE
// =============================================================================

/**
 * Enhanced SwarmOrchestrator with intelligence features
 */
export class IntelligentSwarmOrchestrator {
    private intelligence = getAgdiIntelligence();
    private debugMode = false;

    constructor(options?: { debugMode?: boolean }) {
        this.debugMode = options?.debugMode ?? false;
    }

    /**
     * Main execution loop with intelligence features
     */
    async execute(request: string, context: {
        workspaceDir: string;
        hasImage?: boolean;
        contextTokens?: number;
        forceModel?: string;
        toolNames?: string[];
    }): Promise<{
        response: string;
        model: ModelRoute;
        skill?: SkillMatch;
    }> {
        // STEP 1: Intelligence Pipeline
        // ─────────────────────────────────────────────────────────────────
        console.log('[Orchestrator] Processing through intelligence pipeline...');

        const pipeline = await this.intelligence.processRequest(request, {
            hasImage: context.hasImage,
            contextTokens: context.contextTokens,
            forceModel: context.forceModel,
            debugMode: this.debugMode,
        });

        // STEP 2: Build System Prompt with Skill Addition
        // ─────────────────────────────────────────────────────────────────
        const systemPrompt = buildAgdiSystemPrompt({
            workspaceDir: context.workspaceDir,
            toolNames: context.toolNames,
            enableReasoning: pipeline.thinkingEnabled,
        }) + pipeline.systemPromptAddition;

        // Log routing decision
        console.log(`[Orchestrator] Routed to: ${pipeline.modelRoute.model.provider}/${pipeline.modelRoute.model.model}`);
        console.log(`[Orchestrator] Reason: ${pipeline.modelRoute.reason}`);
        if (pipeline.skillMatch) {
            console.log(`[Orchestrator] Skill matched: ${pipeline.skillMatch.skill.name}`);
        }

        // STEP 3: Call LLM (placeholder - integrate with your LLM provider)
        // ─────────────────────────────────────────────────────────────────
        const rawResponse = await this.callLLM({
            systemPrompt,
            userMessage: request,
            model: pipeline.modelRoute.model,
        });

        // STEP 4: Process Response Through Thinking Engine
        // ─────────────────────────────────────────────────────────────────
        const processor = this.intelligence.createStreamProcessor();
        const cleanResponse = processor(rawResponse);

        // Handle silent reply token
        if (cleanResponse.trim() === SILENT_REPLY_TOKEN) {
            return {
                response: '', // Nothing to show user
                model: pipeline.modelRoute,
                skill: pipeline.skillMatch ?? undefined,
            };
        }

        return {
            response: cleanResponse,
            model: pipeline.modelRoute,
            skill: pipeline.skillMatch ?? undefined,
        };
    }

    /**
     * Execute with streaming response
     */
    async *executeStream(request: string, context: {
        workspaceDir: string;
        hasImage?: boolean;
        contextTokens?: number;
        forceModel?: string;
        toolNames?: string[];
    }): AsyncGenerator<string> {
        // Intelligence pipeline
        const pipeline = await this.intelligence.processRequest(request, {
            hasImage: context.hasImage,
            contextTokens: context.contextTokens,
            forceModel: context.forceModel,
            debugMode: this.debugMode,
        });

        // Build system prompt
        const systemPrompt = buildAgdiSystemPrompt({
            workspaceDir: context.workspaceDir,
            toolNames: context.toolNames,
            enableReasoning: pipeline.thinkingEnabled,
        }) + pipeline.systemPromptAddition;

        // Get streaming response from LLM
        const stream = this.callLLMStream({
            systemPrompt,
            userMessage: request,
            model: pipeline.modelRoute.model,
        });

        // Wrap with thinking engine to strip <think> tags
        const processedStream = this.intelligence.wrapStream(stream);

        // Yield processed chunks
        for await (const chunk of processedStream) {
            yield chunk;
        }
    }

    /**
     * Placeholder for LLM call - integrate with your provider
     */
    private async callLLM(params: {
        systemPrompt: string;
        userMessage: string;
        model: { provider: string; model: string };
    }): Promise<string> {
        // TODO: Integrate with your LLM provider
        // Example with Anthropic:
        //
        // const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        // const response = await client.messages.create({
        //   model: params.model.model,
        //   max_tokens: 4096,
        //   system: params.systemPrompt,
        //   messages: [{ role: 'user', content: params.userMessage }],
        // });
        // return response.content[0].text;

        console.log('[Orchestrator] LLM call (placeholder)');
        return `<think>Processing request...</think><final>Response to: ${params.userMessage}</final>`;
    }

    /**
     * Placeholder for streaming LLM call
     */
    private async *callLLMStream(params: {
        systemPrompt: string;
        userMessage: string;
        model: { provider: string; model: string };
    }): AsyncGenerator<string> {
        // TODO: Integrate with your LLM provider's streaming API
        // Example with Anthropic:
        //
        // const stream = await client.messages.stream({
        //   model: params.model.model,
        //   max_tokens: 4096,
        //   system: params.systemPrompt,
        //   messages: [{ role: 'user', content: params.userMessage }],
        // });
        // for await (const event of stream) {
        //   if (event.type === 'content_block_delta') {
        //     yield event.delta.text;
        //   }
        // }

        // Placeholder streaming simulation
        const response = `<think>Processing...</think><final>Streaming response to: ${params.userMessage}</final>`;
        for (const chunk of response.split('')) {
            yield chunk;
            await new Promise(r => setTimeout(r, 10));
        }
    }

    /**
     * Set debug mode
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    /**
     * Explain how a request would be routed
     */
    explainRouting(request: string, context?: {
        hasImage?: boolean;
        contextTokens?: number;
    }) {
        return this.intelligence.explainRouting(request, context);
    }
}

// =============================================================================
// CLI INTEGRATION EXAMPLE
// =============================================================================

/**
 * Example CLI integration with thinking spinner
 */
export async function runWithCLI(request: string, options: {
    workspaceDir: string;
    debug?: boolean;
}) {
    const orchestrator = new IntelligentSwarmOrchestrator({
        debugMode: options.debug,
    });

    console.log('\n🚀 Agdi Intelligence Active\n');

    // Show routing decision
    const routing = orchestrator.explainRouting(request);
    console.log(`📋 Task: ${routing.task}`);
    console.log(`🎯 Model: ${routing.route.model.provider}/${routing.route.model.model}`);
    console.log(`💭 Think Level: ${routing.route.thinkLevel}\n`);

    // Stream response with thinking spinner handled automatically
    process.stdout.write('Response: ');

    for await (const chunk of orchestrator.executeStream(request, {
        workspaceDir: options.workspaceDir,
    })) {
        process.stdout.write(chunk);
    }

    console.log('\n');
}

// =============================================================================
// EXPORTS
// =============================================================================

export default IntelligentSwarmOrchestrator;
