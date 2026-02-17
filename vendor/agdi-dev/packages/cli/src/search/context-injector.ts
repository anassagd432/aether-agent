/**
 * Context Injector
 * Formats search results and injects them into AI conversation context
 */

import type { SearchResult, SearchMetadata } from './search-provider.js';

export class ContextInjector {
    /**
     * Format search results for AI context
     */
    formatForContext(results: SearchResult[], metadata: SearchMetadata): string {
        if (results.length === 0) {
            return '';
        }

        const header = this.formatHeader(metadata);
        const formattedResults = results.map((result, index) =>
            this.formatSingleResult(result, index + 1)
        ).join('\n\n');

        return `${header}\n\n${formattedResults}\n\n---\n\nUse the above search results to provide accurate, up-to-date information. Cite sources when possible.`;
    }

    /**
     * Format search metadata header
     */
    private formatHeader(metadata: SearchMetadata): string {
        return [
            '# Real-Time Search Results',
            '',
            `Query: "${metadata.query}"`,
            `Found: ${metadata.totalResults} results`,
            `Search time: ${metadata.searchTime}ms`,
            `Provider: ${metadata.provider}`,
            '',
            '---',
        ].join('\n');
    }

    /**
     * Format single search result
     */
    private formatSingleResult(result: SearchResult, index: number): string {
        const lines = [
            `## Source ${index}: ${result.title}`,
            '',
            `**URL**: ${result.url}`,
            `**Type**: ${result.contentType || 'general'}`,
        ];

        if (result.publishedDate) {
            lines.push(`**Published**: ${result.publishedDate}`);
        }

        lines.push('', '**Summary**:', result.snippet);

        return lines.join('\n');
    }

    /**
     * Format search results for terminal display
     */
    formatForDisplay(results: SearchResult[]): string {
        if (results.length === 0) {
            return 'No results found.';
        }

        return results.map((result, index) => {
            return [
                `${index + 1}. ${result.title}`,
                `   ${result.url}`,
                `   ${result.snippet.substring(0, 100)}...`,
            ].join('\n');
        }).join('\n\n');
    }

    /**
     * Create compact summary for UI
     */
    createSummary(results: SearchResult[], metadata: SearchMetadata): string {
        const sources = results
            .map(r => new URL(r.url).hostname.replace('www.', ''))
            .filter((v, i, a) => a.indexOf(v) === i) // unique
            .slice(0, 3);

        return `Found ${results.length} docs from ${sources.join(', ')}`;
    }
}
