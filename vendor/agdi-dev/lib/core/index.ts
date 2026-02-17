/**
 * Core Module Exports
 * 
 * Velocity Engine and Thought Stream for Agdi.
 * Ported from MoltBot's speed and streaming patterns.
 */

// Velocity Engine - Context compaction, dedupe, token estimation
export {
    // Types
    type Message,
    type DedupeCache,
    type DedupeCacheOptions,
    type CompactionResult,
    type ContextWindowInfo,

    // Functions
    estimateTokens,
    estimateMessagesTokens,
    createDedupeCache,
    splitMessagesByTokenShare,
    computeAdaptiveChunkRatio,
    isOversizedForSummary,
    pruneHistoryForContextShare,
    compactContext,
    evaluateContextWindow,

    // Constants
    VELOCITY_CONSTANTS,
} from './velocity-engine';

// Thought Stream - Real-time status updates
export {
    // Types
    type AgentEventStream,
    type AgentEvent,
    type EventListener,
    type Unsubscribe,
    type ThoughtStreamOptions,

    // Class
    ThoughtStream,

    // Helpers
    createToolEvent,
    createLifecycleEvent,
    createThinkingEvent,
    formatEventForHuman,

    // Singleton
    thoughtStream,
} from './thought-stream';
