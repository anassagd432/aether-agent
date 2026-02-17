/**
 * Embedding Generator
 * Creates semantic embeddings for code using local transformers
 */

export interface Embedding {
    vector: number[]; // 384 dimensions (all-MiniLM-L6-v2)
    metadata: {
        file: string;
        symbol?: string;
        text: string;
        type: 'file' | 'symbol' | 'chunk';
    };
}

export class EmbeddingGenerator {
    private model: any; // Will be transformers pipeline
    private initialized: boolean = false;

    constructor() {
        // Model will be lazy-loaded on first use
    }

    /**
     * Initialize the embedding model (lazy loading)
     */
    private async initialize(): Promise<void> {
        if (this.initialized) return;

        // Opt-in: embeddings can be heavy (model downloads + RAM). Keep disabled by default.
        // Enable via config.semanticSearchEnabled=true or AGDI_SEMANTIC_SEARCH=true.
        try {
            const { loadConfig } = await import('../utils/config.js');
            const cfg = loadConfig();
            const enabled =
                cfg.semanticSearchEnabled === true ||
                process.env.AGDI_SEMANTIC_SEARCH === 'true' ||
                process.env.AGDI_SEMANTIC_SEARCH === '1';

            if (!enabled) {
                this.model = null;
                this.initialized = true;
                return;
            }

            const { pipeline } = await import('@xenova/transformers');
            this.model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            this.initialized = true;
        } catch (error) {
            console.error('Failed to initialize embedding model:', error);
            console.warn('EmbeddingGenerator: semantic embeddings unavailable. Using mock embeddings.');
            this.model = null;
            this.initialized = true;
        }
    }

    /**
     * Generate embedding for a single text
     */
    async generateEmbedding(text: string): Promise<number[]> {
        await this.initialize();

        if (!this.model) {
            // Fallback: simple hash-based mock embedding
            return this.mockEmbedding(text);
        }

        try {
            const output = await this.model(text, { pooling: 'mean', normalize: true });
            return Array.from(output.data);
        } catch (error) {
            console.error('Embedding generation failed:', error);
            return this.mockEmbedding(text);
        }
    }

    /**
     * Generate embeddings for multiple texts (batched for efficiency)
     */
    async generateBatch(texts: string[], metadata: Embedding['metadata'][]): Promise<Embedding[]> {
        await this.initialize();

        const embeddings: Embedding[] = [];

        // Process in batches of 10 for memory efficiency
        const batchSize = 10;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchMetadata = metadata.slice(i, i + batchSize);

            const vectors = await Promise.all(
                batch.map(text => this.generateEmbedding(text))
            );

            for (let j = 0; j < vectors.length; j++) {
                embeddings.push({
                    vector: vectors[j],
                    metadata: batchMetadata[j],
                });
            }
        }

        return embeddings;
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vectors must be same length');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        if (!denom) return 0;
        return dotProduct / denom;
    }

    /**
     * Find most similar embeddings from a list
     */
    findSimilar(
        query: Embedding,
        candidates: Embedding[],
        topK: number = 5
    ): Embedding[] {
        const scored = candidates.map(candidate => ({
            embedding: candidate,
            score: this.cosineSimilarity(query.vector, candidate.vector),
        }));

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, topK)
            .map(item => item.embedding);
    }

    /**
     * Mock embedding for fallback (deterministic hash-based)
     */
    private mockEmbedding(text: string): number[] {
        // Simple deterministic embedding based on text hash
        const dimension = 384;
        const embedding = new Array(dimension).fill(0);

        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            const index = (i * charCode) % dimension;
            embedding[index] += (charCode / 255) - 0.5;
        }

        // Normalize
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / (norm || 1));
    }

    /**
     * Get embedding dimension
     */
    getDimension(): number {
        return 384; // all-MiniLM-L6-v2 dimension
    }
}
