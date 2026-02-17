/**
 * Security Module Exports
 */

// Execution environment
export {
    detectEnvironment,
    initSession,
    getEnvironment,
    updateEnvironment,
    changeCwd,
    displaySessionHeader,
    type ExecutionEnvironment,
    type ExecutionBackend,
    type NetworkPolicy,
    type TrustLevel,
} from './execution-env.js';

// Argv parsing
export {
    parseArgv,
    isWindowsFlag,
    isLikelyPath,
    extractPaths,
    extractDomains,
    extractPorts,
    type ParsedCommand,
    type PathExtraction,
} from './argv-parser.js';

// Rules engine
export {
    matchesPattern,
    evaluateRules,
    loadUserRules,
    saveUserRules,
    addRule,
    removeRule,
    addSessionRule,
    getAllRules,
    clearSessionRules,
    DEFAULT_RULES,
    type Rule,
    type RuleAction,
    type RulePattern,
    type RuleEvaluation,
} from './rules-engine.js';

// Workspace trust
export {
    isWorkspaceTrusted,
    getTrustLevel,
    trustWorkspace,
    untrustWorkspace,
    listTrustedWorkspaces,
    promptWorkspaceTrust,
    handleTrustFlow,
    ensureTrusted,
    type TrustChoice,
} from './workspace-trust.js';

// Permission gate
export {
    evaluateCommand,
    classifyCommandRisk,
    type GateResult,
    type RiskTier,
} from './permission-gate.js';

// Command execution
export {
    safeExecute,
    type ExecutionResult,
} from './command-guard.js';

// Audit logging
export {
    logEvent,
    logSessionStart,
    logSessionEnd,
    logGateEvaluation,
    logApprovalRequest,
    logApprovalDecision,
    logCommandResult,
    readAuditLog,
    readCurrentSessionEvents,
    exportAuditLogJSON,
    exportAuditLogCSV,
    clearAuditLog,
    getSessionId,
    type AuditEvent,
    type AuditEventType,
    type ApprovalChoice,
} from './audit-logger.js';

// Code firewall (legacy)
export { scanCode, shouldBlockCode, validateCodeBeforeWrite } from './code-firewall.js';

// Shell wrapper detection
export {
    detectShellWrapper,
    isHighRiskWrapper,
    getMostRestrictiveTier,
    type ShellWrapperResult,
} from './shell-wrapper-detector.js';
