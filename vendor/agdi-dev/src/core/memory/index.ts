/**
 * Agdi Memory Engine Exports
 */

export * from './types';
export * from './embeddings';
export * from './SimpleVectorStore';

// Factory to create standard store
import { SimpleVectorStore } from './SimpleVectorStore';
import { EmbeddingService } from './embeddings';

export function createMemoryEngine(apiKey: string) {
    const store = new SimpleVectorStore();
    const embedder = new EmbeddingService(apiKey);

    return {
        store,
        embedder,
        async init() {
            await store.init();
        }
    };
}
