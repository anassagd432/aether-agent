/**
 * OpenAI Provider Client
 */

import type { CompletionOptions, CompletionResponse, ILLMClient, ProviderConfig } from '../types';
import { LLMProvider } from '../types';
import { getStoredAPIKey } from '../api-keys';

export class OpenAIClient implements ILLMClient {
    provider = LLMProvider.OPENAI;
    private apiKey: string;
    private baseUrl: string;

    constructor(config?: Partial<ProviderConfig>) {
        this.apiKey = config?.apiKey || getStoredAPIKey('openai');
        this.baseUrl = config?.baseUrl || 'https://api.openai.com/v1';
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    async complete(options: CompletionOptions): Promise<CompletionResponse> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: options.model,
                messages: options.messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.maxTokens,
                top_p: options.topP,
                response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return {
            content: data.choices[0].message.content,
            model: data.model,
            usage: {
                promptTokens: data.usage.prompt_tokens,
                completionTokens: data.usage.completion_tokens,
                totalTokens: data.usage.total_tokens
            },
            finishReason: data.choices[0].finish_reason
        };
    }

    async *streamComplete(options: CompletionOptions): AsyncGenerator<string, void, unknown> {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: options.model,
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
