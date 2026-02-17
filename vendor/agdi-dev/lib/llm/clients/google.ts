/**
 * Google (Gemini) Provider Client
 */

import type { CompletionOptions, CompletionResponse, ILLMClient, ProviderConfig } from '../types';
import { LLMProvider } from '../types';
import { getStoredAPIKey } from '../api-keys';

export class GoogleClient implements ILLMClient {
    provider = LLMProvider.GOOGLE;
    private apiKey: string;

    constructor(config?: Partial<ProviderConfig>) {
        this.apiKey = config?.apiKey || getStoredAPIKey('gemini');
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    async complete(options: CompletionOptions): Promise<CompletionResponse> {
        const { GoogleGenAI } = await import('@google/genai');
        const genAI = new GoogleGenAI({ apiKey: this.apiKey });

        const systemMessage = options.messages.find(m => m.role === 'system');
        const userMessage = options.messages.find(m => m.role === 'user');

        const response = await genAI.models.generateContent({
            model: options.model,
            contents: userMessage?.content || '',
            config: {
                systemInstruction: systemMessage?.content,
                temperature: options.temperature,
                maxOutputTokens: options.maxTokens,
                responseMimeType: options.responseFormat === 'json' ? 'application/json' : 'text/plain'
            }
        });

        return {
            content: response.text || '',
            model: options.model,
            usage: {
                promptTokens: response.usageMetadata?.promptTokenCount || 0,
                completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: response.usageMetadata?.totalTokenCount || 0
            },
            finishReason: 'stop'
        };
    }

    async *streamComplete(options: CompletionOptions): AsyncGenerator<string, void, unknown> {
        // Google Gemini streaming implementation
        const response = await this.complete(options);
        yield response.content;
    }
}
