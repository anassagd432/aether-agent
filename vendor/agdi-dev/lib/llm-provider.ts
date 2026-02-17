/**
 * LLM Provider — Re-export Module
 *
 * This file is kept for backward compatibility.
 * All implementations have been moved to lib/llm/.
 *
 * Import from './llm' directly in new code.
 */

export {
    // Enums
    LLMProvider,
    ModelRole,
    // Types
    type ModelConfig,
    type ProviderConfig,
    type LLMMessage,
    type CompletionOptions,
    type CompletionResponse,
    type ILLMClient,
    type TaskConfig,
    // Registry
    MODEL_REGISTRY,
    // Factory
    LLMClientFactory,
    // Service
    LLMService,
    llmService,
    // Helpers
    reasoningComplete,
    autocomplete,
    longContextComplete,
    // API Keys
    getStoredAPIKey,
} from './llm';
