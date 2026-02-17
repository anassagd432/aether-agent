/**
 * Search Module
 * Central export for all search-related functionality
 */

export type { SearchOptions, SearchResult, SearchResponse, SearchMetadata } from './search-provider.js';
export { SearchProvider, SearchError } from './search-provider.js';
export { BraveSearchProvider } from './brave-search.js';
export { SearchOptimizer } from './search-optimizer.js';
export type { CodeSample } from './search-optimizer.js';
export { ContextInjector } from './context-injector.js';
