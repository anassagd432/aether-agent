/**
 * LLM Provider Abstraction
 * Works in both Node.js and browser environments
 */

import type { ILLMProvider, LLMConfig, LLMResponse, LLMProviderType } from '../types/index.js';

export { ILLMProvider, LLMConfig, LLMResponse, LLMProviderType };

/**
 * Puter API Response types
 */
interface PuterMessageContent {
    text?: string;
}

interface PuterResponse {
    message?: {
        content: string | PuterMessageContent[];
    };
    choices?: Array<{
        message: {
            content: string;
        };
    }>;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

/**
 * Puter AI Provider - FREE 400+ models, no API key required
 * Supports: GPT-4.1, Claude Sonnet 4, Gemini, Llama, DeepSeek, Mistral, etc.
 */
export class PuterProvider implements ILLMProvider {
    private model: string;

    constructor(config: LLMConfig) {
        // Puter doesn't need API key - it's free
        this.model = config.model || 'gpt-4.1-nano';
    }

    async generate(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
        // Puter AI API endpoint
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await fetch('https://api.puter.com/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: prompt }
                ],
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Puter API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as PuterResponse | string;

        // Handle different response formats
        let text = '';
        if (typeof data === 'string') {
            text = data;
        } else if (data.message?.content) {
            // Claude-style response
            if (Array.isArray(data.message.content)) {
                text = data.message.content.map((c) => c.text || '').join('');
            } else {
                text = data.message.content;
            }
        } else if (data.choices?.[0]?.message?.content) {
            // OpenAI-style response
            text = data.choices[0].message.content;
        }

        return {
            text,
            usage: typeof data !== 'string' ? data.usage : undefined,
        };
    }
}

/**
 * Gemini LLM Provider
 */
export class GeminiProvider implements ILLMProvider {
    private config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    async generate(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
        const { GoogleGenAI } = await import('@google/genai');
        if (!this.config.apiKey) {
            throw new Error('Gemini API key is required');
        }
        const ai = new GoogleGenAI({ apiKey: this.config.apiKey });

        const contents = [];
        if (systemPrompt) {
            contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
            contents.push({ role: 'model', parts: [{ text: 'Understood. I will follow these instructions.' }] });
        }
        contents.push({ role: 'user', parts: [{ text: prompt }] });

        const response = await ai.models.generateContent({
            model: this.config.model || 'gemini-2.5-flash',
            contents,
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            text,
            usage: undefined,
        };
    }
}

/**
 * Available Puter models (subset of 400+ available)
 * Updated January 2026 with verified model identifiers
 */
export const PUTER_MODELS = {
    // OpenAI Models
    'gpt-5': 'GPT-5 (Aug 2025)',
    'gpt-5-mini': 'GPT-5 Mini',
    'gpt-4o': 'GPT-4o',
    'o3-mini': 'o3 Mini (Jan 2025)',
    'o1': 'o1 (Reasoning)',
    // Claude Models
    'claude-opus-4-5': 'Claude 4.5 Opus (Nov 2025)',
    'claude-sonnet-4-5': 'Claude 4.5 Sonnet (Sep 2025)',
    'claude-sonnet-4': 'Claude Sonnet 4',
    'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
    // Google Models  
    'gemini-3-pro-preview': 'Gemini 3 Pro (Preview)',
    'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
    'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
    // Meta Llama
    'meta/llama-4-maverick': 'Llama 4 Maverick (Apr 2025)',
    'meta/llama-4-scout': 'Llama 4 Scout',
    'meta/llama-3.3-70b': 'Llama 3.3 70B',
    // DeepSeek
    'deepseek/deepseek-v3.2': 'DeepSeek V3.2 (Dec 2025)',
    'deepseek/deepseek-reasoner': 'DeepSeek R1',
    // xAI
    'x-ai/grok-3': 'Grok 3',
    // Mistral
    'mistral/mistral-large': 'Mistral Large',
} as const;

/**
 * Factory function to create LLM provider
 */
export function createLLMProvider(
    provider: LLMProviderType,
    config: LLMConfig
): ILLMProvider {
    switch (provider) {
        case 'puter':
            return new PuterProvider(config);
        case 'gemini':
            return new GeminiProvider(config);
        default:
            throw new Error(`Unsupported LLM provider: ${provider}`);
    }
}
