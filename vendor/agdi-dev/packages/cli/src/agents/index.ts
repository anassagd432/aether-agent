/**
 * Agents Module - Multi-agent system for better code generation
 */

// Legacy single-agent pipeline
export {
    runMultiAgentPipeline,
    runSingleAgent,
    getAgentPrompt,
    type AgentRole,
    type AgentMessage,
    type AgentContext,
    type AgentResult,
} from './orchestrator.js';

// New multi-agent squad system
export * from './core/index.js';
