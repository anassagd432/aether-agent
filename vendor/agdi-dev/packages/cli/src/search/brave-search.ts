/**
 * Brave Search Provider
 * Implementation using Brave Search API
 * Free tier: 2,000 queries/month
 */

import {
    SearchProvider,
    SearchOptions,
    SearchResponse,
    SearchResult,
    SearchError,
} from './search-provider.js';

interface BraveSearchApiResponse {
    web?: {
        results: Array<{
            title: string;
            url: string;
            description: string;
            age?: string;
        }>;
    };
}

export class BraveSearchProvider extends SearchProvider {
    constructor(apiKey: string) {
        super(apiKey);
        this.baseUrl = 'https://api.search.brave.com/res/v1/web/search';
    }

    async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
        const startTime = Date.now();

        try {
            const params = new URLSearchParams({
                q: query,
                count: String(options.maxResults || 5),
            });

            // Add freshness filter if specified
            if (options.freshness) {
                params.append('freshness', options.freshness);
            }

            const response = await fetch(`${this.baseUrl}?${params}`, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'X-Subscription-Token': this.apiKey,
                },
            });

            if (response.status === 429) {
                throw new SearchError('Rate limit exceeded', 'RATE_LIMIT');
            }

            if (response.status === 401) {
                throw new SearchError('Invalid API key', 'INVALID_KEY');
            }

            if (!response.ok) {
                throw new SearchError(
                    `API error: ${response.statusText}`,
                    'API_ERROR'
                );
            }

            const data = (await response.json()) as BraveSearchApiResponse;
            const results = this.formatResults(data);
            const searchTime = Date.now() - startTime;

            return {
                results,
                metadata: {
                    query,
                    totalResults: results.length,
                    searchTime,
                    provider: 'brave',
                },
            };
        } catch (error) {
            if (error instanceof SearchError) {
                throw error;
            }
            throw new SearchError(
                `Network error: ${(error as Error).message}`,
                'NETWORK_ERROR'
            );
        }
    }

    private formatResults(data: BraveSearchApiResponse): SearchResult[] {
        if (!data.web?.results) {
            return [];
        }

        return data.web.results.map((result, index) => ({
            title: result.title,
            url: result.url,
            snippet: result.description,
            relevanceScore: 1 - index * 0.1, // Simple scoring based on position
            publishedDate: result.age,
            contentType: this.detectContentType(result.url),
        }));
    }

    private detectContentType(url: string): SearchResult['contentType'] {
        if (url.includes('npmjs.com') || url.includes('github.com')) {
            return 'documentation';
        }
        if (url.includes('stackoverflow.com')) {
            return 'forum';
        }
        if (url.includes('dev.to') || url.includes('medium.com')) {
            return 'blog';
        }
        return 'documentation';
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.search('test query', { maxResults: 1 });
            return true;
        } catch (error) {
            return false;
        }
    }

    getProviderName(): string {
        return 'Brave Search';
    }
}
