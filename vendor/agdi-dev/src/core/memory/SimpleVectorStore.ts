/**
 * Agdi Simple Vector Store
 * 
 * A robust, zero-dependency vector store using JSON persistence.
 * Good for < 100k chunks. For larger scales, upgrade to SQLite/pgvector.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import type { VectorStore, MemoryChunk, MemorySearchResult } from './types';

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

interface StoreData {
    version: number;
    chunks: MemoryChunk[];
}

export class SimpleVectorStore implements VectorStore {
    private dbPath: string;
    private memory: MemoryChunk[] = [];
    private dirty: boolean = false;
    private saveTimer: NodeJS.Timeout | null = null;

    constructor(dbPath?: string) {
        this.dbPath = dbPath || path.join(homedir(), '.agdi', 'memory.json');
    }

    async init(): Promise<void> {
        try {
            await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
            const data = await fs.readFile(this.dbPath, 'utf-8');
            const parsed: StoreData = JSON.parse(data);
            this.memory = parsed.chunks;
            console.log(`[VectorStore] Loaded ${this.memory.length} chunks from ${this.dbPath}`);
        } catch (error) {
            // If file doesn't exist, start fresh
            this.memory = [];
            console.log(`[VectorStore] Initialized empty store at ${this.dbPath}`);
        }
    }

    async addChunks(chunks: MemoryChunk[]): Promise<void> {
        // Remove existing chunks for these files to avoid duplicates
        const filePaths = new Set(chunks.map(c => c.filePath));
        this.memory = this.memory.filter(c => !filePaths.has(c.filePath));

        // Add new chunks
        this.memory.push(...chunks);
        this.scheduleSave();
    }

    async removeChunks(filePath: string): Promise<void> {
        const initialLen = this.memory.length;
        this.memory = this.memory.filter(c => c.filePath !== filePath);
        if (this.memory.length !== initialLen) {
            this.scheduleSave();
        }
    }

    async search(queryEmbedding: number[], limit: number): Promise<MemorySearchResult[]> {
        const results = this.memory.map(chunk => {
            if (!chunk.embedding) return { chunk, score: -1, matchType: 'vector' as const };
            const score = cosineSimilarity(queryEmbedding, chunk.embedding);
            return { chunk, score, matchType: 'vector' as const };
        });

        return results
            .filter(r => r.score > 0.6) // Min score threshold
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    private scheduleSave() {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.save(), 5000); // Debounce saves
    }

    private async save() {
        const data: StoreData = {
            version: 1,
            chunks: this.memory
        };
        await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
    }

    async close(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            await this.save();
        }
    }
}
