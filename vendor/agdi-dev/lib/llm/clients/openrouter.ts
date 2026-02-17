/**
 * OpenRouter Provider Client
 * Used for Meta, Alibaba, DeepSeek, and HuggingFace models
 */

import type { CompletionOptions, CompletionResponse, ILLMClient, ProviderConfig } from '../types';
import { LLMProvider } from '../types';
import { getStoredAPIKey } from '../api-keys';

export class OpenRouterClient implements ILLMClient {
    provider: LLMProvider;
    private apiKey: string;
    private baseUrl = 'https://openrouter.ai/api/v1';

    constructor(provider: LLMProvider, config?: Partial<ProviderConfig>) {
        this.provider = provider;
        this.apiKey = config?.apiKey || getStoredAPIKey('openrouter');
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    private getOpenRouterModelId(modelId: string): string {
        const mapping: Record<string, string> = {
            'llama-4': 'meta-llama/llama-4-maverick',
            'llama-4-maverick': 'meta-llama/llama-4-maverick',
            'qwen3-coder': 'qwen/qwen-2.5-coder-32b-instruct',
            'deepseek-r1': 'deepseek/deepseek-r1',
            'deepseek-v3': 'deepseek/deepseek-chat',
            'starcoder2': 'bigcode/starcoder2-15b'
        };
        return mapping[modelId] || modelId;
    }

    async complete(options: CompletionOptions): Promise<CompletionResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://agdi-dev.vercel.app',
                'X-Title': 'Agdi AI App Builder'
            },
            body: JSON.stringify({
                model: this.getOpenRouterModelId(options.model),
                messages: options.messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens,
                response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenRouter API Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            model: data.model,
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                totalTokens: data.usage?.total_tokens || 0
            },
            finishReason: data.choices[0].finish_reason
        };
    }

    async *streamComplete(options: CompletionOptions): AsyncGenerator<string, void, unknown> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://agdi-dev.vercel.app',
                'X-Title': 'Agdi AI App Builder'
            },
            body: JSON.stringify({
                model: this.getOpenRouterModelId(options.model),
                messages: options.messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens,
                stream: true
            })
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No response body');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') return;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) yield content;
                } catch {
                    // Skip invalid JSON
                }
            }
        }
    }
}
