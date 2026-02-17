/**
 * RAG Retriever - Semantic search for code chunks
 * 
 * Searches indexed codebase using keyword and fuzzy matching.
 * No external embeddings needed - uses TF-IDF-style scoring.
 */

import { loadIndex, indexProject, isIndexStale, type CodebaseIndex, type CodeChunk } from './indexer.js';

// ==================== TYPES ====================

export interface SearchResult {
    chunk: CodeChunk;
    score: number;
    highlights: string[];
}

export interface SearchOptions {
    limit?: number;
    fileTypes?: string[];
    chunkTypes?: CodeChunk['type'][];
    minScore?: number;
}

// ==================== TOKENIZATION ====================

/**
 * Tokenize text for search
 */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2);
}

/**
 * Calculate TF (term frequency) for a document
 */
function calculateTF(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
    }
    // Normalize
    const max = Math.max(...tf.values());
    for (const [token, count] of tf) {
        tf.set(token, count / max);
    }
    return tf;
}

// ==================== SCORING ====================

/**
 * Score a chunk against query tokens
 */
function scoreChunk(
    chunk: CodeChunk,
    queryTokens: string[],
    queryTF: Map<string, number>
): number {
    const chunkTokens = tokenize(chunk.content);
    const chunkTF = calculateTF(chunkTokens);

    let score = 0;
    const matchedTokens = new Set<string>();

    for (const queryToken of queryTokens) {
        // Exact match
        if (chunkTF.has(queryToken)) {
            score += chunkTF.get(queryToken)! * (queryTF.get(queryToken) || 1);
            matchedTokens.add(queryToken);
        }

        // Partial match (prefix)
        for (const chunkToken of chunkTokens) {
            if (chunkToken.startsWith(queryToken) || queryToken.startsWith(chunkToken)) {
                if (!matchedTokens.has(queryToken)) {
                    score += 0.5 * (queryTF.get(queryToken) || 1);
                    matchedTokens.add(queryToken);
                }
            }
        }
    }

    // Boost for file path matches
    const pathTokens = tokenize(chunk.relativePath);
    for (const queryToken of queryTokens) {
        if (pathTokens.includes(queryToken)) {
            score += 0.5;
        }
    }

    // Boost for function/class definitions
    if (chunk.type === 'function' || chunk.type === 'class') {
        score *= 1.2;
    }

    // Normalize by query length
    score = score / Math.sqrt(queryTokens.length || 1);

    return score;
}

/**
 * Extract highlight snippets
 */
function extractHighlights(chunk: CodeChunk, queryTokens: string[]): string[] {
    const lines = chunk.content.split('\n');
    const highlights: string[] = [];

    for (const line of lines) {
        const lineLower = line.toLowerCase();
        for (const token of queryTokens) {
            if (lineLower.includes(token)) {
                const trimmed = line.trim();
                if (trimmed.length > 0 && !highlights.includes(trimmed)) {
                    highlights.push(trimmed.slice(0, 100));
                    break;
                }
            }
        }
        if (highlights.length >= 3) break;
    }

    return highlights;
}

// ==================== SEARCH ====================

/**
 * Search the indexed codebase
 */
export function searchCodebase(
    projectPath: string,
    query: string,
    options: SearchOptions = {}
): SearchResult[] {
    const limit = options.limit ?? 10;
    const minScore = options.minScore ?? 0.1;

    // Load or build index
    let index = loadIndex(projectPath);
    if (!index || isIndexStale(index)) {
        try {
            index = indexProject(projectPath);
        } catch (error) {
            if (process.env.AGDI_DEBUG === 'true') {
                console.warn('[RAG] Failed to build index:', (error as Error)?.message || error);
            }
            if (!index) {
                console.warn('No index found. Run /index first.');
                return [];
            }
        }
    }

    // Tokenize query
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
        return [];
    }
    const queryTF = calculateTF(queryTokens);

    // Score all chunks
    const results: SearchResult[] = [];

    for (const chunk of index.chunks) {
        // Apply filters
        if (options.fileTypes && !options.fileTypes.includes(chunk.language)) {
            continue;
        }
        if (options.chunkTypes && !options.chunkTypes.includes(chunk.type)) {
            continue;
        }

        const score = scoreChunk(chunk, queryTokens, queryTF);

        if (score >= minScore) {
            results.push({
                chunk,
                score,
                highlights: extractHighlights(chunk, queryTokens),
            });
        }
    }

    // Sort by score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
}

/**
 * Get relevant context for a prompt
 */
export function getRelevantContext(
    projectPath: string,
    prompt: string,
    maxChunks: number = 5
): string {
    const results = searchCodebase(projectPath, prompt, { limit: maxChunks });

    if (results.length === 0) {
        return '';
    }

    const parts: string[] = ['[Relevant Code Context]'];

    for (const result of results) {
        parts.push(`\n// ${result.chunk.relativePath}:${result.chunk.startLine}-${result.chunk.endLine}`);
        parts.push('```' + result.chunk.language);
        parts.push(result.chunk.content.slice(0, 500));
        if (result.chunk.content.length > 500) {
            parts.push('// ... (truncated)');
        }
        parts.push('```');
    }

    parts.push('[/Relevant Code Context]\n');

    return parts.join('\n');
}

/**
 * Search for specific file patterns
 */
export function findFiles(
    projectPath: string,
    pattern: string
): CodeChunk[] {
    let index = loadIndex(projectPath);
    if (!index || isIndexStale(index)) {
        try {
            index = indexProject(projectPath);
        } catch (error) {
            if (process.env.AGDI_DEBUG === 'true') {
                console.warn('[RAG] Failed to build index:', (error as Error)?.message || error);
            }
            if (!index) return [];
        }
    }

    const patternLower = pattern.toLowerCase();
    const seen = new Set<string>();
    const results: CodeChunk[] = [];

    for (const chunk of index.chunks) {
        if (seen.has(chunk.filePath)) continue;

        if (chunk.relativePath.toLowerCase().includes(patternLower)) {
            seen.add(chunk.filePath);
            results.push(chunk);
        }
    }

    return results;
}
