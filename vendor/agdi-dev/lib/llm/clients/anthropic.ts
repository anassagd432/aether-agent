/**
 * Anthropic Provider Client
 */

import type { CompletionOptions, CompletionResponse, ILLMClient, ProviderConfig } from '../types';
import { LLMProvider } from '../types';
import { getStoredAPIKey } from '../api-keys';

export class AnthropicClient implements ILLMClient {
    provider = LLMProvider.ANTHROPIC;
    private apiKey: string;
    private baseUrl: string;

    constructor(config?: Partial<ProviderConfig>) {
        this.apiKey = config?.apiKey || getStoredAPIKey('anthropic');
        this.baseUrl = config?.baseUrl || 'https://api.anthropic.com/v1';
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    async complete(options: CompletionOptions): Promise<CompletionResponse> {
        const systemMessage = options.messages.find(m => m.role === 'system');
        const otherMessages = options.messages.filter(m => m.role !== 'system');

        const headers: Record<string, string> = {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2024-01-01'
        };

        // Enable prompt caching for Claude 4.5 models
        if (options.model.includes('claude-4-5')) {
            headers['anthropic-beta'] = 'prompt-caching-2024-07-31';
        }

        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: options.model,
                system: systemMessage?.content,
                messages: otherMessages,
                max_tokens: options.maxTokens || 4096,
                temperature: options.temperature ?? 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Anthropic API Error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return {
            content: data.content[0].text,
            model: data.model,
            usage: {
                promptTokens: data.usage.input_tokens,
                completionTokens: data.usage.output_tokens,
                totalTokens: data.usage.input_tokens + data.usage.output_tokens
            },
            finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length'
        };
    }

    async *streamComplete(options: CompletionOptions): AsyncGenerator<string, void, unknown> {
        const systemMessage = options.messages.find(m => m.role === 'system');
        const otherMessages = options.messages.filter(m => m.role !== 'system');

        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2024-01-01'
            },
            body: JSON.stringify({
                model: options.model,
                system: systemMessage?.content,
                messages: otherMessages,
                max_tokens: options.maxTokens || 4096,
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
                try {
                    const parsed = JSON.parse(line.slice(6));
                    if (parsed.type === 'content_block_delta') {
                        yield parsed.delta.text;
                    }
                } catch {
                    // Skip invalid JSON
                }
            }
        }
    }
}
