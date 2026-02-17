/**
 * Agdi Core Module Index
 * 
 * Central export point for all Agdi core modules.
 * This is the main entry point for importing Agdi's "Super-Agent" capabilities.
 */

// =============================================================================
// SKILLS (The Brain)
// =============================================================================

export {
    buildAgdiSystemPrompt,
    createAgdiCodingTools,
    analyzeError,
    createExecutionPlan,
    executeNextStep,
    type AgdiTool,
    type ToolContext,
    type ToolResult,
    type PermissionGate as ToolPermissionGate,
    type ErrorContext,
    type PlanStep,
    type ExecutionPlan,
} from './skills/agdi-coder';

// =============================================================================
// INTERFACES (The Ear)
// =============================================================================

export {
    AgdiWhatsAppSession,
    AgdiVoiceProcessor,
    AgdiVoicePlanner,
    createDeepgramProvider,
    createWhisperProvider,
    type WhatsAppConfig,
    type InboundMessage,
    type TranscriptionResult,
    type TranscriptionProvider,
    type VoiceCommandResult,
} from './interfaces/agdi-whatsapp';

// =============================================================================
// OPTIMIZATION (The Speed)
// =============================================================================

export {
    VelocityEngine,
    ContextCompactor,
    DedupeCache,
    StreamEmitter,
    getVelocityEngine,
    resetVelocityEngine,
    DEFAULT_VELOCITY_CONFIG,
    type VelocityConfig,
    type CompactionResult,
    type CacheEntry,
    type StreamEvent,
} from './optimization/velocity';

// =============================================================================
// SECURITY (The Firewall)
// =============================================================================

export {
    PermissionGate,
    getPermissionGate,
    resetPermissionGate,
    classifyRisk,
    DEFAULT_PERMISSION_POLICY,
    type RiskLevel,
    type PermissionRequest,
    type PermissionResult,
    type AuditEntry,
    type PermissionPolicy,
} from './security/permission-gate';

// =============================================================================
// CONVENIENCE FACTORY
// =============================================================================

import { getVelocityEngine } from './optimization/velocity';
import { getPermissionGate, resetPermissionGate } from './security/permission-gate';
import { createAgdiCodingTools, buildAgdiSystemPrompt } from './skills/agdi-coder';

/**
 * Initialize the complete Agdi Super-Agent stack
 */
export function initializeAgdi(options: {
    workspaceDir: string;
    enabledTools?: string[];
    velocityConfig?: {
        maxContextTokens?: number;
        compressionTarget?: number;
        cacheTtlMs?: number;
    };
}) {
    // Initialize velocity engine
    const velocity = getVelocityEngine(options.velocityConfig);

    // Initialize permission gate
    const permissionGate = getPermissionGate();

    // Create coding tools with security integration
    const tools = createAgdiCodingTools({
        workspaceDir: options.workspaceDir,
        permissionGate,
        enabledTools: options.enabledTools,
    });

    // Build system prompt
    const systemPrompt = buildAgdiSystemPrompt({
        workspaceDir: options.workspaceDir,
        toolNames: tools.map(t => t.name),
    });

    // Connect velocity streaming to permission gate for audit
    velocity.stream.on('stream', (event) => {
        if (event.type === 'tool') {
            permissionGate.emit('tool_activity', event);
        }
    });

    return {
        velocity,
        permissionGate,
        tools,
        systemPrompt,

        // Convenience methods
        processContext: (key: string, context: string) => velocity.processContext(key, context),
        checkPermission: (action: string, target: string) => permissionGate.check(action, target),
        getAuditLog: () => permissionGate.getAuditLog(),

        // Cleanup
        destroy: () => {
            velocity.destroy();
            resetPermissionGate();
        },
    };
}

// =============================================================================
// VERSION INFO
// =============================================================================

export const AGDI_CORE_VERSION = '1.0.0';
export const AGDI_CODENAME = 'SuperAgent';
