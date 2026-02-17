/**
 * LLM Provider — Barrel Export
 *
 * Unified interface for multiple LLM providers.
 * Import everything from here: `import { llmService, ModelRole } from '../llm'`
 */

import { createLogger } from '../logger';
import type { CompletionOptions, CompletionResponse, ILLMClient, LLMMessage, ProviderConfig, TaskConfig } from './types';
import { LLMProvider, ModelRole } from './types';
import { MODEL_REGISTRY } from './registry';
import type { ModelConfig } from './types';
import { OpenAIClient } from './clients/openai';
import { AnthropicClient } from './clients/anthropic';
import { GoogleClient } from './clients/google';
import { OpenRouterClient } from './clients/openrouter';

const log = createLogger('LLM');

// Re-export everything
export * from './types';
export { MODEL_REGISTRY } from './registry';
export { getStoredAPIKey } from './api-keys';

// ==================== CLIENT FACTORY ====================

export class LLMClientFactory {
    private static clients: Map<LLMProvider, ILLMClient> = new Map();

    static getClient(provider: LLMProvider, config?: Partial<ProviderConfig>): ILLMClient {
        if (!config && this.clients.has(provider)) {
            return this.clients.get(provider)!;
        }

        let client: ILLMClient;

        switch (provider) {
            case LLMProvider.OPENAI:
                client = new OpenAIClient(config);
                break;
            case LLMProvider.ANTHROPIC:
                client = new AnthropicClient(config);
                break;
            case LLMProvider.GOOGLE:
                client = new GoogleClient(config);
                break;
            case LLMProvider.META:
            case LLMProvider.ALIBABA:
            case LLMProvider.DEEPSEEK:
            case LLMProvider.HUGGINGFACE:
                client = new OpenRouterClient(provider, config);
                break;
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }

        if (!config) {
            this.clients.set(provider, client);
        }

        return client;
    }

    static getClientForModel(modelId: string): ILLMClient {
        const model = MODEL_REGISTRY.find(m => m.id === modelId);
        if (!model) throw new Error(`Unknown model: ${modelId}`);
        return this.getClient(model.provider);
    }
}

// ==================== UNIFIED SERVICE ====================

export class LLMService {
    private defaultModels: Record<ModelRole, string> = {
        [ModelRole.REASONING]: 'claude-sonnet-4-5-20250929',
        [ModelRole.AUTOCOMPLETE]: 'gpt-5.2-codex',
        [ModelRole.LONG_CONTEXT]: 'gemini-3-pro-preview'
    };

    setDefaultModel(role: ModelRole, modelId: string): void {
        const model = MODEL_REGISTRY.find(m => m.id === modelId);
        if (!model) throw new Error(`Unknown model: ${modelId}`);
        if (!model.roles.includes(role)) {
            console.warn(`Model ${modelId} is not optimized for role ${role}`);
        }
        this.defaultModels[role] = modelId;
    }

    getModelsForRole(role: ModelRole): ModelConfig[] {
        return MODEL_REGISTRY.filter(m => m.roles.includes(role) && m.isAvailable);
    }

    getBestModelForTask(config: TaskConfig): ModelConfig {
        if (config.preferredModel) {
            const preferred = MODEL_REGISTRY.find(m => m.id === config.preferredModel);
            if (preferred?.isAvailable) return preferred;
        }

        if (config.fallbackModels) {
            for (const fallbackId of config.fallbackModels) {
                const fallback = MODEL_REGISTRY.find(m => m.id === fallbackId);
                if (fallback?.isAvailable) return fallback;
            }
        }

        const defaultId = this.defaultModels[config.role];
        const defaultModel = MODEL_REGISTRY.find(m => m.id === defaultId);
        if (defaultModel?.isAvailable) return defaultModel;

        const anyModel = MODEL_REGISTRY.find(m => m.roles.includes(config.role) && m.isAvailable);
        if (!anyModel) throw new Error(`No available model for role: ${config.role}`);
        return anyModel;
    }

    async complete(
        messages: LLMMessage[],
        taskConfig: TaskConfig,
        options?: Partial<CompletionOptions>
    ): Promise<CompletionResponse> {
        const model = this.getBestModelForTask(taskConfig);
        const client = LLMClientFactory.getClientForModel(model.id);
        if (!client.isConfigured()) {
            throw new Error(`Provider ${model.provider} is not configured. Please set the API key.`);
        }
        return client.complete({ model: model.id, messages, ...options });
    }

    async *streamComplete(
        messages: LLMMessage[],
        taskConfig: TaskConfig,
        options?: Partial<CompletionOptions>
    ): AsyncGenerator<string, void, unknown> {
        const model = this.getBestModelForTask(taskConfig);
        const client = LLMClientFactory.getClientForModel(model.id);
        if (!client.isConfigured()) {
            throw new Error(`Provider ${model.provider} is not configured. Please set the API key.`);
        }
        yield* client.streamComplete({ model: model.id, messages, ...options });
    }

    async completeWithFailover(
        messages: LLMMessage[],
        taskConfig: TaskConfig,
        options?: Partial<CompletionOptions>
    ): Promise<CompletionResponse> {
        const fallbackChain = [
            taskConfig.preferredModel,
            'deepseek-r1',
            'deepseek-v3',
            'gemini-2.5-flash',
            'gemini-3-flash-preview',
        ].filter(Boolean) as string[];

        let lastError: Error | null = null;
        const maxRetries = 2;

        for (const modelId of fallbackChain) {
            const model = MODEL_REGISTRY.find(m => m.id === modelId);
            if (!model?.isAvailable) continue;

            const client = LLMClientFactory.getClient(model.provider);
            if (!client.isConfigured()) {
                log.debug(`Skipping ${modelId}: provider not configured`);
                continue;
            }

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    log.info(`Trying ${modelId} (attempt ${attempt + 1}/${maxRetries + 1})`);
                    const response = await client.complete({ model: modelId, messages, ...options });
                    if (modelId !== taskConfig.preferredModel) {
                        log.info(`Success with fallback model: ${modelId}`);
                    }
                    return response;
                } catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    const errorMsg = lastError.message.toLowerCase();

                    const isRetryable = errorMsg.includes('429') ||
                        errorMsg.includes('rate limit') ||
                        errorMsg.includes('timeout') ||
                        errorMsg.includes('network') ||
                        errorMsg.includes('fetch');

                    const isAuthError = errorMsg.includes('401') ||
                        errorMsg.includes('403') ||
                        errorMsg.includes('invalid api key');

                    if (isAuthError) {
                        log.warn(`Auth error with ${modelId}, trying next provider`);
                        break;
                    }

                    if (isRetryable && attempt < maxRetries) {
                        const delay = Math.pow(2, attempt) * 1000;
                        log.info(`Retrying ${modelId} in ${delay}ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }

                    log.warn(`Failed with ${modelId}: ${lastError.message}`);
                    break;
                }
            }
        }

        throw new Error(`All providers failed. Last error: ${lastError?.message || 'Unknown error'}`);
    }
}

// ==================== SINGLETON & HELPERS ====================

export const llmService = new LLMService();

export async function reasoningComplete(
    systemPrompt: string,
    userPrompt: string,
    preferredModel?: string
): Promise<string> {
    const response = await llmService.complete(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        { role: ModelRole.REASONING, preferredModel }
    );
    return response.content;
}

export async function autocomplete(
    context: string,
    preferredModel?: string
): Promise<string> {
    const response = await llmService.complete(
        [
            { role: 'system', content: 'You are a code completion assistant. Complete the following code.' },
            { role: 'user', content: context }
        ],
        { role: ModelRole.AUTOCOMPLETE, preferredModel },
        { maxTokens: 500, temperature: 0.3 }
    );
    return response.content;
}

export async function longContextComplete(
    systemPrompt: string,
    longDocument: string,
    query: string,
    preferredModel?: string
): Promise<string> {
    const response = await llmService.complete(
        [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Document:\n${longDocument}\n\nQuery: ${query}` }
        ],
        { role: ModelRole.LONG_CONTEXT, preferredModel }
    );
    return response.content;
}
