/**
 * Agdi Memory Engine Types
 */

export interface MemoryConfig {
    /** Workspace root to index */
    workspaceDir: string;
    /** Vector database path */
    dbPath?: string;
    /** Embedding model to use */
    embeddingModel?: 'text-embedding-3-small' | 'text-embedding-3-large';
    /** Chunk size in tokens */
    chunkTokens?: number;
    /** Chunk overlap in tokens */
    chunkOverlap?: number;
    /** OpenAI API Key */
    openaiApiKey?: string;
}

export interface MemoryChunk {
    id: string;
    filePath: string;
    content: string;
    startLine: number;
    endLine: number;
    tokens: number;
    embedding?: number[];
    mtime: number;
}

export interface MemorySearchResult {
    chunk: MemoryChunk;
    score: number;
    matchType: 'vector' | 'keyword' | 'hybrid';
}

export interface EmbeddingProvider {
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[]): Promise<number[][]>;
}

export interface VectorStore {
    init(): Promise<void>;
    addChunks(chunks: MemoryChunk[]): Promise<void>;
    removeChunks(filePath: string): Promise<void>;
    search(queryEmbedding: number[], limit: number): Promise<MemorySearchResult[]>;
    close(): Promise<void>;
}
