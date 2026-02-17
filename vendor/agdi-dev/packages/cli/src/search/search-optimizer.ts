/**
 * Search Query Optimizer
 * Converts user prompts into optimized search queries
 * Filters and ranks search results for relevance
 */

import type { SearchResult } from './search-provider.js';

export interface CodeSample {
    code: string;
    language: string;
    source: string;
}

export class SearchOptimizer {
    /**
     * Generate optimized search query from user prompt
     */
    generateSearchQuery(userPrompt: string): string {
        const prompt = userPrompt.toLowerCase();

        // Extract library/framework mentions
        const libraries = this.extractLibraries(prompt);

        // Extract version mentions
        const versions = this.extractVersions(prompt);

        // Detect intent
        const intent = this.detectIntent(prompt);

        // Build optimized query
        let query = '';

        if (libraries.length > 0) {
            query += libraries[0];

            if (versions.length > 0) {
                query += ` ${versions[0]}`;
            }
        }

        // Add intent keywords
        if (intent === 'tutorial') {
            query += ' tutorial example';
        } else if (intent === 'docs') {
            query += ' documentation official';
        } else if (intent === 'api') {
            query += ' API reference';
        } else {
            query += ' documentation npm';
        }

        // Add "latest" if prompt indicates newness
        if (this.isLatestRequest(prompt)) {
            query += ' latest 2026';
        }

        return query.trim() || userPrompt.substring(0, 100);
    }

    /**
     * Extract library/framework names from prompt
     */
    private extractLibraries(prompt: string): string[] {
        const libraries: string[] = [];

        // Common patterns
        const patterns = [
            /(?:using|with|for)\s+([a-z0-9-]+)/gi,
            /([a-z0-9-]+)\s+(?:library|framework|package)/gi,
            /@([a-z0-9-/]+)/gi, // npm packages
        ];

        for (const pattern of patterns) {
            const matches = prompt.matchAll(pattern);
            for (const match of matches) {
                if (match[1]) {
                    libraries.push(match[1]);
                }
            }
        }

        return [...new Set(libraries)];
    }

    /**
     * Extract version numbers
     */
    private extractVersions(prompt: string): string[] {
        const versionPattern = /v?(\d+(?:\.\d+)*)/gi;
        const matches = Array.from(prompt.matchAll(versionPattern));
        return matches.map(m => 'v' + m[1]);
    }

    /**
     * Detect user intent
     */
    private detectIntent(prompt: string): 'tutorial' | 'docs' | 'api' | 'general' {
        if (prompt.includes('tutorial') || prompt.includes('example') || prompt.includes('how to')) {
            return 'tutorial';
        }
        if (prompt.includes('api') || prompt.includes('reference')) {
            return 'api';
        }
        if (prompt.includes('documentation') || prompt.includes('docs')) {
            return 'docs';
        }
        return 'general';
    }

    /**
     * Check if prompt is requesting latest information
     */
    private isLatestRequest(prompt: string): boolean {
        const keywords = ['latest', 'new', 'recent', 'updated', '2026', 'current'];
        return keywords.some(keyword => prompt.includes(keyword));
    }

    /**
     * Filter search results for relevance
     */
    filterResults(results: SearchResult[], maxResults: number = 3): SearchResult[] {
        // Filter out low-quality sources
        const filtered = results.filter(result => {
            const url = result.url.toLowerCase();

            // Exclude ads and low-quality sites
            if (url.includes('/ad/') || url.includes('?ad=')) {
                return false;
            }

            // Prefer official docs, npm, GitHub
            return true;
        });

        // Sort by relevance score and content type
        const sorted = filtered.sort((a, b) => {
            // Prioritize documentation
            const aScore = this.getContentTypeScore(a.contentType || 'blog');
            const bScore = this.getContentTypeScore(b.contentType || 'blog');

            if (aScore !== bScore) {
                return bScore - aScore;
            }

            return b.relevanceScore - a.relevanceScore;
        });

        return sorted.slice(0, maxResults);
    }

    /**
     * Score content types by quality
     */
    private getContentTypeScore(type: string): number {
        const scores: Record<string, number> = {
            documentation: 10,
            code: 8,
            tutorial: 6,
            forum: 4,
            blog: 3,
        };
        return scores[type] || 1;
    }

    /**
     * Extract code samples from search results (simulated for snippets)
     */
    extractCodeSamples(results: SearchResult[]): CodeSample[] {
        const samples: CodeSample[] = [];

        for (const result of results) {
            // 1. Check for markdown code blocks in snippet
            const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
            let match;
            while ((match = codeBlockRegex.exec(result.snippet)) !== null) {
                samples.push({
                    language: match[1] || 'text',
                    code: match[2].trim(),
                    source: result.url
                });
            }

            // 2. Check for inline code blocks
            const inlineCodeRegex = /`([^`]+)`/g;
            while ((match = inlineCodeRegex.exec(result.snippet)) !== null) {
                // Only consider if it looks like code (e.g. contains symbols)
                if (/[=(){}<>;]/.test(match[1]) || match[1].startsWith('npm') || match[1].startsWith('git')) {
                    samples.push({
                        language: 'text',
                        code: match[1].trim(),
                        source: result.url
                    });
                }
            }

            // 3. Heuristic: Lines ending with semicolon or braces
            const lines = result.snippet.split('\n');
            for (const line of lines) {
                if (/^\s*(import|export|const|let|function|class)\s+/.test(line) || /;\s*$/.test(line)) {
                    samples.push({
                        language: 'javascript', // Assumption
                        code: line.trim(),
                        source: result.url
                    });
                }
            }
        }

        return samples;
    }
}
