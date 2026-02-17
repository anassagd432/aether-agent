/**
 * Repository Indexer
 * Orchestrates full repository indexing and incremental updates
 */

import fs from 'fs/promises';
import path from 'path';
import { TypeScriptParser } from './typescript-parser.js';
import { DependencyGraph } from './dependency-graph.js';
import { EmbeddingGenerator } from './embeddings.js';
import { VectorStore } from './vector-store.js';
import { ContextRetriever } from './context-retriever.js';
import type { ParsedFile } from './types.js';

export interface IndexStats {
    totalFiles: number;
    indexedFiles: number;
    totalSymbols: number;
    lastIndexed: Date;
    indexSize: number; // bytes
}

export class RepositoryIndexer {
    private parser: TypeScriptParser;
    private graph: DependencyGraph;
    private embeddings: EmbeddingGenerator;
    private store: VectorStore;
    private parsedFiles: Map<string, ParsedFile>;

    constructor(dbPath: string) {
        this.parser = new TypeScriptParser();
        this.graph = new DependencyGraph();
        this.embeddings = new EmbeddingGenerator();
        this.store = new VectorStore({ dbPath, dimension: 384 });
        this.parsedFiles = new Map();
    }

    getParsedFiles(): Map<string, ParsedFile> {
        return this.parsedFiles;
    }

    getGraph(): DependencyGraph {
        return this.graph;
    }

    getStore(): VectorStore {
        return this.store;
    }

    getEmbeddings(): EmbeddingGenerator {
        return this.embeddings;
    }

    createContextRetriever(): ContextRetriever {
        return new ContextRetriever(this.graph, this.store, this.embeddings, this.parsedFiles);
    }

    /**
     * Index entire repository
     */
    async indexRepository(rootPath: string): Promise<IndexStats> {
        const startTime = Date.now();

        // Find all code files
        const files = await this.findCodeFiles(rootPath);

        // Parse all files
        const parsed: ParsedFile[] = [];
        let skipped = 0;

        for (const file of files) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                // Use parser to get hash without full parse if possible, or parse and check hash
                // The current parser calculates hash during parse.
                // Ideally we'd calculate hash first.
                const crypto = await import('crypto');
                const hash = crypto.createHash('md5').update(content).digest('hex');

                const existingHash = await this.store.getFileHash(file);

                if (existingHash === hash) {
                    // File unchanged, skip re-indexing
                    skipped++;
                    // Still need to add to parsedFiles for dependency graph (light parse or load from DB?)
                    // For now, we must parse to build the graph, but we skip embedding generation.
                    const parsedFile = this.parser.parse(content, file);
                    this.parsedFiles.set(file, parsedFile);
                    continue; 
                }

                const parsedFile = this.parser.parse(content, file);
                parsed.push(parsedFile);
                this.parsedFiles.set(file, parsedFile);
                
                // Update hash in store
                await this.store.setFileHash(file, hash);
                
            } catch (error) {
                console.warn(`Failed to parse ${file}:`, error);
            }
        }

        // Build dependency graph (needs all files parsed)
        this.graph.buildGraph(Array.from(this.parsedFiles.values()));

        // Generate embeddings and store ONLY for changed files
        if (parsed.length > 0) {
            await this.indexParsedFiles(parsed);
        }

        const stats: IndexStats = {
            totalFiles: files.length,
            indexedFiles: parsed.length, // Only newly indexed
            totalSymbols: Array.from(this.parsedFiles.values()).reduce((sum, f) => sum + f.symbols.length, 0),
            lastIndexed: new Date(),
            indexSize: 0,
        };
        
        if (skipped > 0) {
            console.log(`ℹ️  Skipped ${skipped} unchanged files`);
        }

        return stats;
    }

    /**
     * Incremental update for changed files
     */
    async incrementalUpdate(changedFiles: string[]): Promise<void> {
        const parsed: ParsedFile[] = [];

        for (const file of changedFiles) {
            try {
                const content = await fs.readFile(file, 'utf-8');
                const parsedFile = this.parser.parse(content, file);
                parsed.push(parsedFile);
                this.parsedFiles.set(file, parsedFile);

                // Update vector store
                await this.store.deleteFile(file);
            } catch (error) {
                console.warn(`Failed to update ${file}:`, error);
            }
        }

        // Rebuild graph with updated files
        const allFiles = Array.from(this.parsedFiles.values());
        this.graph.buildGraph(allFiles);

        // Re-index changed files
        await this.indexParsedFiles(parsed);
    }

    /**
     * Check if index is stale
     */
    async isStale(): Promise<boolean> {
        // Prefer checking persisted vector DB rather than in-memory parsedFiles.
        const vectorStats = await this.store.getStats();
        return vectorStats.totalVectors === 0;
    }

    /**
     * Get index statistics
     */
    async getStats(): Promise<IndexStats> {
        const vectorStats = await this.store.getStats();

        return {
            totalFiles: this.parsedFiles.size,
            indexedFiles: this.parsedFiles.size,
            totalSymbols: Array.from(this.parsedFiles.values())
                .reduce((sum, f) => sum + f.symbols.length, 0),
            lastIndexed: new Date(),
            indexSize: vectorStats.dbSize,
        };
    }

    // (duplicate getGraph removed)

    /**
     * Find all code files in directory
     */
    private async findCodeFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const extensions = this.parser.getSupportedExtensions();

        async function walk(currentDir: string) {
            try {
                const entries = await fs.readdir(currentDir, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);

                    // Skip node_modules, .git, etc.
                    if (entry.isDirectory()) {
                        const dirName = entry.name;
                        if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(dirName)) {
                            await walk(fullPath);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).slice(1);
                        if (extensions.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                // Skip directories we can't read
            }
        }

        await walk(dir);
        return files;
    }

    /**
     * Generate and store embeddings for parsed files
     */
    private async indexParsedFiles(files: ParsedFile[]): Promise<void> {
        for (const file of files) {
            const texts: string[] = [];
            const metadata: any[] = [];

            // Create embedding for entire file
            texts.push(`File: ${file.path}\n${file.symbols.map(s => s.signature).join('\n')}`);
            metadata.push({
                file: file.path,
                text: file.path,
                type: 'file',
            });

            // Create embeddings for each symbol
            for (const symbol of file.symbols) {
                texts.push(`${symbol.signature}\n${symbol.docstring || ''}`);
                metadata.push({
                    file: file.path,
                    symbol: symbol.name,
                    text: symbol.signature,
                    type: 'symbol',
                });
            }

            // Generate embeddings in batch
            const embeddings = await this.embeddings.generateBatch(texts, metadata);

            // Store in vector database
            await this.store.addVectors(embeddings);
        }
    }
}
