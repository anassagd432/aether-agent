/**
 * LLM Provider — Model Registry
 */

import { type ModelConfig, LLMProvider, ModelRole } from './types';

export const MODEL_REGISTRY: ModelConfig[] = [
    // OpenAI (v5 Era - Codex)
    {
        id: 'gpt-5.2-codex',
        name: 'GPT-5.2 Codex',
        provider: LLMProvider.OPENAI,
        roles: [ModelRole.REASONING, ModelRole.AUTOCOMPLETE],
        contextWindow: 128000,
        description: 'OpenAI flagship coding model',
        isAvailable: true
    },
    {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        provider: LLMProvider.OPENAI,
        roles: [ModelRole.REASONING, ModelRole.AUTOCOMPLETE],
        contextWindow: 128000,
        description: 'Optimized for code generation',
        isAvailable: true
    },

    // Anthropic Claude
    {
        id: 'claude-sonnet-4-5-20250929',
        name: 'Claude 4.5 Sonnet',
        provider: LLMProvider.ANTHROPIC,
        roles: [ModelRole.REASONING, ModelRole.AUTOCOMPLETE],
        contextWindow: 200000,
        description: 'Best for coding agents',
        isAvailable: true
    },
    {
        id: 'claude-opus-4-5',
        name: 'Claude 4.5 Opus',
        provider: LLMProvider.ANTHROPIC,
        roles: [ModelRole.REASONING, ModelRole.LONG_CONTEXT],
        contextWindow: 200000,
        description: 'Most intelligent architect model',
        isAvailable: true
    },
    {
        id: 'claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: LLMProvider.ANTHROPIC,
        roles: [ModelRole.REASONING, ModelRole.AUTOCOMPLETE],
        contextWindow: 200000,
        description: 'Excellent for coding',
        isAvailable: true
    },

    // Google (v3 Era - Coding)
    {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3 Pro',
        provider: LLMProvider.GOOGLE,
        roles: [ModelRole.REASONING, ModelRole.LONG_CONTEXT],
        contextWindow: 2000000,
        description: 'Google\'s 2M context coding flagship',
        isAvailable: true
    },
    {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3 Flash',
        provider: LLMProvider.GOOGLE,
        roles: [ModelRole.AUTOCOMPLETE],
        contextWindow: 1000000,
        description: '1M context fast coding',
        isAvailable: true
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: LLMProvider.GOOGLE,
        roles: [ModelRole.AUTOCOMPLETE],
        contextWindow: 1000000,
        description: 'Fast and capable',
        isAvailable: true
    },

    // Meta
    {
        id: 'llama-4-maverick',
        name: 'Llama 4 Maverick',
        provider: LLMProvider.META,
        roles: [ModelRole.REASONING, ModelRole.AUTOCOMPLETE],
        contextWindow: 256000,
        description: 'Meta\'s flagship open-source',
        isAvailable: true
    },

    // Alibaba
    {
        id: 'qwen3-coder',
        name: 'Qwen3 Coder',
        provider: LLMProvider.ALIBABA,
        roles: [ModelRole.AUTOCOMPLETE, ModelRole.REASONING],
        contextWindow: 128000,
        description: 'Alibaba\'s specialized coding model',
        isAvailable: true
    },

    // DeepSeek
    {
        id: 'deepseek-r1',
        name: 'DeepSeek R1',
        provider: LLMProvider.DEEPSEEK,
        roles: [ModelRole.REASONING],
        contextWindow: 128000,
        description: 'Advanced reasoning with chain-of-thought',
        isAvailable: true
    },
    {
        id: 'deepseek-v3',
        name: 'DeepSeek V3',
        provider: LLMProvider.DEEPSEEK,
        roles: [ModelRole.AUTOCOMPLETE, ModelRole.LONG_CONTEXT],
        contextWindow: 128000,
        description: 'Fast and affordable',
        isAvailable: true
    },

    // Hugging Face
    {
        id: 'starcoder2',
        name: 'StarCoder2',
        provider: LLMProvider.HUGGINGFACE,
        roles: [ModelRole.AUTOCOMPLETE],
        contextWindow: 16000,
        description: 'Open-source code completion',
        isAvailable: true
    }
];
