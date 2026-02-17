/**
 * Core Types for Agdi
 */

export interface GeneratedFile {
    path: string;
    content: string;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    prompt: string;
    files: GeneratedFile[];
    dependencies: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface LLMConfig {
    apiKey: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export interface LLMResponse {
    text: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ILLMProvider {
    generate(prompt: string, systemPrompt?: string): Promise<LLMResponse>;
    /** Multi-turn conversation support */
    chat?(messages: ChatMessage[]): Promise<LLMResponse>;
}

export type LLMProviderType = 'puter' | 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'openrouter';

export interface AppPlan {
    name: string;
    description: string;
    files: { path: string; description: string }[];
    dependencies: string[];
    architecture: string;
}
