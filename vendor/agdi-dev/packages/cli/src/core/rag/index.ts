/**
 * RAG Module - Codebase Retrieval Augmented Generation
 * 
 * Public API for RAG functionality.
 */

export { indexProject, loadIndex, isIndexStale, type CodebaseIndex, type CodeChunk } from './indexer.js';
export { searchCodebase, getRelevantContext, findFiles, type SearchResult, type SearchOptions } from './retriever.js';
