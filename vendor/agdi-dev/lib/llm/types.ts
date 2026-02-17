/**
 * LLM Provider — Shared Types & Interfaces
 */

// ==================== ENUMS ====================

/**
 * Supported model roles for different coding tasks
 */
export enum ModelRole {
    REASONING = 'reasoning',
    AUTOCOMPLETE = 'autocomplete',
    LONG_CONTEXT = 'long_context'
}

/**
 * Supported LLM providers
 */
export enum LLMProvider {
    OPENAI = 'openai',
    ANTHROPIC = 'anthropic',
    GOOGLE = 'google',
    META = 'meta',
    ALIBABA = 'alibaba',
    DEEPSEEK = 'deepseek',
    HUGGINGFACE = 'huggingface'
}

// ==================== INTERFACES ====================

export interface ModelConfig {
    id: string;
    name: string;
    provider: LLMProvider;
    roles: ModelRole[];
    contextWindow: number;
    description: string;
    isAvailable: boolean;
}

export interface ProviderConfig {
    provider: LLMProvider;
    apiKey: string;
    baseUrl?: string;
    organizationId?: string;
}

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface CompletionOptions {
    model: string;
    messages: LLMMessage[];
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    responseFormat?: 'text' | 'json';
}

export interface CompletionResponse {
    content: string;
    model: string;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason: 'stop' | 'length' | 'error';
}

export interface ILLMClient {
    provider: LLMProvider;
    isConfigured(): boolean;
    complete(options: CompletionOptions): Promise<CompletionResponse>;
    streamComplete(options: CompletionOptions): AsyncGenerator<string, void, unknown>;
}

export interface TaskConfig {
    role: ModelRole;
    preferredModel?: string;
    fallbackModels?: string[];
}
