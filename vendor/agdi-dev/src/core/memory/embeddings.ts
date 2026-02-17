/**
 * Agdi Embedding Service
 * Simple wrapper around OpenAI Embeddings
 */

import { EventEmitter } from 'events';
import type { EmbeddingProvider } from './types';

export class EmbeddingService extends EventEmitter implements EmbeddingProvider {
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'text-embedding-3-small') {
        super();
        this.apiKey = apiKey;
        this.model = model;
    }

    async embed(text: string): Promise<number[]> {
        const batch = await this.embedBatch([text]);
        return batch[0];
    }

    async embedBatch(texts: string[]): Promise<number[][]> {
        try {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input: texts,
                    model: this.model,
                    encoding_format: 'float'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI Embedding Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            // Data is [{ embedding: [...], index: 0, object: 'embedding' }]

            // Sort by index to ensure order matches input
            const embeddings = data.data
                .sort((a: any, b: any) => a.index - b.index)
                .map((item: any) => item.embedding);

            return embeddings;

        } catch (error) {
            console.error('[EmbeddingService] Failed to generate embeddings:', error);
            throw error;
        }
    }
}
