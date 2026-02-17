/**
 * Context Retriever
 * Intelligently retrieves relevant code context for AI
 */

import type { DependencyGraph } from './dependency-graph.js';
import type { VectorStore } from './vector-store.js';
import type { EmbeddingGenerator } from './embeddings.js';
import type { ParsedFile, Symbol } from './types.js';

export interface RetrievedContext {
    files: string[];
    symbols: Symbol[];
    dependencies: string[];
    totalTokens: number;
}

export class ContextRetriever {
    private graph: DependencyGraph;
    private store: VectorStore;
    private embeddings: EmbeddingGenerator;
    private parsedFiles: Map<string, ParsedFile>;

    constructor(
        graph: DependencyGraph,
        store: VectorStore,
        embeddings: EmbeddingGenerator,
        parsedFiles: Map<string, ParsedFile>
    ) {
        this.graph = graph;
        this.store = store;
        this.embeddings = embeddings;
        this.parsedFiles = parsedFiles;
    }

    /**
     * Get relevant context for user prompt
     */
    async getRelevantContext(
        prompt: string,
        currentFile?: string,
        maxTokens: number = 4000
    ): Promise<RetrievedContext> {
        const relevantFiles = new Set<string>();
        const symbols: Symbol[] = [];

        // Strategy 1: Semantic similarity search
        const semanticFiles = await this.selectBySemanticSimilarity(prompt);
        semanticFiles.forEach(f => relevantFiles.add(f));

        // Strategy 2: Dependencies of current file
        if (currentFile) {
            const deps = this.selectByDependencies(currentFile);
            deps.forEach(f => relevantFiles.add(f));
        }

        // Strategy 3: Recently modified files
        const recentFiles = this.selectByRecentlyModified();
        recentFiles.slice(0, 3).forEach(f => relevantFiles.add(f));

        // Extract symbols from relevant files
        for (const file of Array.from(relevantFiles).slice(0, 10)) {
            const parsed = this.parsedFiles.get(file);
            if (parsed) {
                symbols.push(...parsed.symbols);
            }
        }

        // Estimate tokens (rough: 1 token ≈ 4 characters)
        const totalTokens = this.estimateTokens(Array.from(relevantFiles));

        return {
            files: Array.from(relevantFiles).slice(0, 10),
            symbols: symbols.slice(0, 50),
            dependencies: currentFile ? this.graph.getDependencies(currentFile, 2) : [],
            totalTokens,
        };
    }

    /**
     * Select files by semantic similarity
     */
    private async selectBySemanticSimilarity(prompt: string): Promise<string[]> {
        try {
            // Generate embedding for prompt
            const queryVector = await this.embeddings.generateEmbedding(prompt);

            // Search vector store
            const results = await this.store.search(queryVector, 5);

            return results.map(r => r.metadata.file);
        } catch (error) {
            console.warn('Semantic search failed:', error);
            return [];
        }
    }

    /**
     * Select files by dependencies
     */
    private selectByDependencies(file: string): string[] {
        return this.graph.getDependencies(file, 2);
    }

    /**
     * Select recently modified files
     */
    private selectByRecentlyModified(): string[] {
        const files = Array.from(this.parsedFiles.values());

        return files
            .sort((a, b) => b.lastModified - a.lastModified)
            .slice(0, 5)
            .map(f => f.path);
    }

    /**
     * Estimate token count
     */
    private estimateTokens(files: string[]): number {
        let totalChars = 0;

        for (const file of files) {
            const parsed = this.parsedFiles.get(file);
            if (parsed) {
                totalChars += parsed.symbols.reduce((sum, s) =>
                    sum + s.signature.length + (s.docstring?.length || 0), 0
                );
            }
        }

        return Math.ceil(totalChars / 4); // Rough estimate
    }

    /**
     * Format context for AI injection
     */
    formatContext(context: RetrievedContext): string {
        const lines: string[] = [
            '# Repository Context',
            '',
            '## Relevant Files',
            ...context.files.map(f => `- ${f}`),
            '',
            '## Key Symbols',
            ...context.symbols.slice(0, 20).map(s =>
                `- ${s.signature} (${s.type} in ${s.name})`
            ),
        ];

        if (context.dependencies.length > 0) {
            lines.push('', '## Dependencies', ...context.dependencies.map(d => `- ${d}`));
        }

        return lines.join('\n');
    }
}
