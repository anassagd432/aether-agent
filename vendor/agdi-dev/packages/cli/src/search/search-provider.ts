/**
 * Search Provider Interface
 * Abstraction for different search APIs (Brave, Perplexity, Tavily)
 */

export interface SearchOptions {
    maxResults?: number;
    language?: 'en' | 'auto';
    freshness?: 'day' | 'week' | 'month' | 'year';
    contentType?: 'code' | 'docs' | 'all';
}

export interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    relevanceScore: number;
    publishedDate?: string;
    contentType?: 'documentation' | 'code' | 'tutorial' | 'forum' | 'blog';
}

export interface SearchMetadata {
    query: string;
    totalResults: number;
    searchTime: number;
    provider: string;
}

export interface SearchResponse {
    results: SearchResult[];
    metadata: SearchMetadata;
}

/**
 * Abstract search provider interface
 */
export abstract class SearchProvider {
    protected apiKey: string;
    protected baseUrl: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.baseUrl = '';
    }

    /**
     * Execute search query
     */
    abstract search(query: string, options?: SearchOptions): Promise<SearchResponse>;

    /**
     * Test API connection
     */
    abstract testConnection(): Promise<boolean>;

    /**
     * Get provider name
     */
    abstract getProviderName(): string;
}

/**
 * Search error types
 */
export class SearchError extends Error {
    constructor(
        message: string,
        public code: 'API_ERROR' | 'RATE_LIMIT' | 'INVALID_KEY' | 'NETWORK_ERROR'
    ) {
        super(message);
        this.name = 'SearchError';
    }
}
