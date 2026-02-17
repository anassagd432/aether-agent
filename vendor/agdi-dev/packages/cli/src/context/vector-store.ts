/**
 * Vector Store
 * Persistent storage for embeddings using SQLite
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { Embedding } from './embeddings.js';

export interface VectorStoreConfig {
    dbPath: string;
    dimension: number;
}

export class VectorStore {
    private db: Database.Database | null = null;
    private config: VectorStoreConfig;

    constructor(config: VectorStoreConfig) {
        this.config = config;
    }

    /**
     * Initialize database and create tables
     */
    async initialize(): Promise<void> {
        if (this.db) return; // Already initialized

        try {
            // Ensure directory exists
            const dir = path.dirname(this.config.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Initialize SQLite database
            try {
                this.db = new Database(this.config.dbPath);

                // Create tables
                this.db.exec(`
                    CREATE TABLE IF NOT EXISTS embeddings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        file TEXT NOT NULL,
                        symbol TEXT,
                        text TEXT NOT NULL,
                        type TEXT NOT NULL,
                        vector BLOB NOT NULL,
                        created_at INTEGER NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_file ON embeddings(file);
                    CREATE INDEX IF NOT EXISTS idx_type ON embeddings(type);

                    CREATE TABLE IF NOT EXISTS indexed_files (
                        path TEXT PRIMARY KEY,
                        hash TEXT NOT NULL,
                        last_indexed INTEGER NOT NULL
                    );
                `);
            } catch (dbError) {
                console.warn('VectorStore: better-sqlite3 initialization failed. Using mock mode.', dbError);
                this.db = null;
            }
        } catch (error) {
            console.error('Failed to initialize vector store:', error);
            this.db = null;
        }
    }

    /**
     * Get stored hash for a file
     */
    async getFileHash(path: string): Promise<string | null> {
        await this.initialize();
        if (!this.db) return null;

        const row = this.db.prepare('SELECT hash FROM indexed_files WHERE path = ?').get(path) as { hash: string } | undefined;
        return row ? row.hash : null;
    }

    /**
     * Set/Update hash for a file
     */
    async setFileHash(path: string, hash: string): Promise<void> {
        await this.initialize();
        if (!this.db) return;

        this.db.prepare(`
            INSERT OR REPLACE INTO indexed_files (path, hash, last_indexed)
            VALUES (?, ?, ?)
        `).run(path, hash, Date.now());
    }

    /**
     * Add embeddings to store
     */
    async addVectors(embeddings: Embedding[]): Promise<void> {
        await this.initialize();

        if (!this.db) {
            console.warn('VectorStore: Skipping add (mock mode)');
            return;
        }

        const insert = this.db.prepare(`
            INSERT INTO embeddings (file, symbol, text, type, vector, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const transaction = this.db.transaction((items: Embedding[]) => {
            for (const item of items) {
                const vectorBlob = Buffer.from(new Float32Array(item.vector).buffer);
                insert.run(
                    item.metadata.file,
                    item.metadata.symbol || null,
                    item.metadata.text,
                    item.metadata.type,
                    vectorBlob,
                    Date.now()
                );
            }
        });

        transaction(embeddings);
    }

    /**
     * Search for similar vectors
     */
    async search(queryVector: number[], topK: number = 5): Promise<Embedding[]> {
        await this.initialize();

        if (!this.db) {
            console.warn('VectorStore: Returning empty results (mock mode)');
            return [];
        }

        // Get all vectors (for small datasets)
        // For large datasets, we'd need a proper vector index (HNSW, IVF, etc.)
        const rows = this.db.prepare('SELECT * FROM embeddings').all() as any[];

        // Calculate similarity for each
        const scored = rows.map(row => {
            const vector = Array.from(new Float32Array(
                row.vector.buffer,
                row.vector.byteOffset,
                row.vector.byteLength / Float32Array.BYTES_PER_ELEMENT
            ));
            const similarity = this.cosineSimilarity(queryVector, vector);

            return {
                embedding: {
                    vector,
                    metadata: {
                        file: row.file,
                        symbol: row.symbol,
                        text: row.text,
                        type: row.type,
                    },
                } as Embedding,
                similarity,
            };
        });

        // Sort by similarity and return top K
        return scored
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK)
            .map(item => item.embedding);
    }

    /**
     * Update embeddings for a specific file
     */
    async updateFile(file: string, embeddings: Embedding[]): Promise<void> {
        await this.initialize();

        if (!this.db) {
            console.warn('VectorStore: Skipping update (mock mode)');
            return;
        }

        const transaction = this.db.transaction(() => {
            // Delete existing
            this.db!.prepare('DELETE FROM embeddings WHERE file = ?').run(file);

            // Add new
            const insert = this.db!.prepare(`
                INSERT INTO embeddings (file, symbol, text, type, vector, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `);

            for (const item of embeddings) {
                const vectorBlob = Buffer.from(new Float32Array(item.vector).buffer);
                insert.run(
                    item.metadata.file,
                    item.metadata.symbol || null,
                    item.metadata.text,
                    item.metadata.type,
                    vectorBlob,
                    Date.now()
                );
            }
        });

        transaction();
    }

    /**
     * Delete embeddings for a file
     */
    async deleteFile(file: string): Promise<void> {
        await this.initialize();

        if (!this.db) return;

        this.db.transaction(() => {
            this.db!.prepare('DELETE FROM embeddings WHERE file = ?').run(file);
            this.db!.prepare('DELETE FROM indexed_files WHERE path = ?').run(file);
        })();
    }

    /**
     * Get statistics
     */
    async getStats(): Promise<{ totalVectors: number; totalFiles: number; dbSize: number }> {
        await this.initialize();

        if (!this.db) {
            return { totalVectors: 0, totalFiles: 0, dbSize: 0 };
        }

        const totalVectors = (this.db.prepare('SELECT COUNT(*) as count FROM embeddings').get() as any).count;
        const totalFiles = (this.db.prepare('SELECT COUNT(DISTINCT file) as count FROM embeddings').get() as any).count;

        let dbSize = 0;
        try {
            const stats = fs.statSync(this.config.dbPath);
            dbSize = stats.size;
        } catch {
            // File doesn't exist yet
        }

        return { totalVectors, totalFiles, dbSize };
    }

    /**
     * Close database connection
     */
    async close(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Cosine similarity helper
     */
    private cosineSimilarity(a: number[], b: number[]): number {
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
}
