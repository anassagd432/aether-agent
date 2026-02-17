/**
 * Security Types
 * 
 * Type definitions for the permission-gated command execution system.
 */

// ==================== RISK TIERS ====================

export type RiskTier = 0 | 1 | 2 | 3;

export const RISK_TIER_LABELS: Record<RiskTier, string> = {
    0: 'Read-only',
    1: 'Workspace Write',
    2: 'System/Package',
    3: 'Destructive/Privileged',
};

export const RISK_TIER_COLORS: Record<RiskTier, string> = {
    0: 'text-green-400',
    1: 'text-yellow-400',
    2: 'text-orange-400',
    3: 'text-red-400',
};

// ==================== DECISION TYPES ====================

export type PermissionDecision = 'allow' | 'prompt' | 'deny';

export type ApprovalPolicy =
    | 'never'      // Never prompt (but still enforce sandbox/rules)
    | 'on-request' // Prompt only when crossing boundaries
    | 'untrusted'  // Prompt for any command not explicitly allowed
    | 'on-failure'; // Run in sandbox first; if blocked, prompt

// ==================== RULE TYPES ====================

export interface PermissionRule {
    id: string;
    name: string;
    description?: string;
    pattern: (string | string[])[];  // Argv prefix with unions at positions
    decision: PermissionDecision;
    createdAt: number;
    createdBy: 'user' | 'default';
}

// ==================== COMMAND CONTEXT ====================

export interface CommandContext {
    command: string;
    argv: string[];
    cwd: string;
    paths: string[];          // Extracted filesystem paths
    domains: string[];        // Extracted network domains
    env?: Record<string, string>;
}

// ==================== PERMISSION RESULT ====================

export interface PromptPayload {
    uiText: string;
    expectedSideEffects: string[];
    networkAccess: string[];
    choices: PromptChoice[];
    defaultChoice: string;
}

export interface PromptChoice {
    id: string;
    label: string;
    description?: string;
    icon?: string;
}

export interface PermissionResult {
    decision: PermissionDecision;
    reason: string;
    riskTier: RiskTier;
    argv: string[];
    paths: string[];
    domains: string[];
    matchedRule?: PermissionRule;
    promptPayload?: PromptPayload;
    commandHash?: string;
}

// ==================== SESSION STATE ====================

export interface SessionApproval {
    toolType: string;
    approvedAt: number;
}

export interface OnceApproval {
    commandHash: string;
    approvedAt: number;
    expiresAt: number;
}

export interface PermissionSessionState {
    approvedToolsThisSession: Set<string>;
    onceApprovals: Map<string, OnceApproval>;
    trustedWorkspaces: Set<string>;
}

// ==================== SECURITY CONFIG ====================

export interface SecurityConfig {
    approvalPolicy: ApprovalPolicy;
    networkAccess: boolean;
    workspaceRoots: string[];
    sandboxWrites: boolean;
    maxOutputLength: number;
    rules: PermissionRule[];
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
    approvalPolicy: 'on-request',
    networkAccess: false,
    workspaceRoots: [],
    sandboxWrites: true,
    maxOutputLength: 10000,
    rules: [],
};

// ==================== AUDIT TYPES ====================

export type AuditEventType =
    | 'tool_proposed'
    | 'tool_decision'
    | 'tool_approved'
    | 'tool_denied'
    | 'tool_executed'
    | 'tool_result'
    | 'rule_added'
    | 'rule_removed'
    | 'session_approval'
    | 'config_changed';

export interface AuditEvent {
    id: string;
    type: AuditEventType;
    timestamp: number;
    command?: string;
    argv?: string[];
    cwd?: string;
    decision?: PermissionDecision;
    decisionSource?: 'rule' | 'policy' | 'user' | 'session';
    riskTier?: RiskTier;
    matchedRule?: string;
    approverIdentity?: string;
    success?: boolean;
    duration?: number;
    output?: string;  // Truncated
    error?: string;
    metadata?: Record<string, unknown>;
}

// ==================== DEFAULT PROMPT CHOICES ====================

export const DEFAULT_PROMPT_CHOICES: PromptChoice[] = [
    { id: 'approve_once', label: 'Approve once', icon: '✓' },
    { id: 'approve_session', label: 'Approve for session', icon: '🔄' },
    { id: 'always_allow', label: 'Always allow (add rule)', icon: '✅' },
    { id: 'always_prompt', label: 'Always prompt (add rule)', icon: '❓' },
    { id: 'always_forbid', label: 'Always forbid (add rule)', icon: '🚫' },
    { id: 'deny', label: 'Deny', icon: '✗' },
];
