/**
 * Permission Manager
 * 
 * The single gatekeeper for all command execution.
 * Implements defense-in-depth permission checking.
 */

import type {
    SecurityConfig,
    PermissionSessionState,
    PermissionResult,
    PermissionDecision,
    CommandContext,
    RiskTier,
    PromptPayload,
    OnceApproval,
    DEFAULT_PROMPT_CHOICES,
} from './types';
import { DEFAULT_SECURITY_CONFIG } from './types';
import { parseCommand, extractPaths, extractDomains, hashCommand } from './command-parser';
import { classifyRisk, isForbiddenPattern, getRiskDescription } from './risk-classifier';
import { evaluateRules, loadRules, saveRules, createRule } from './rules-engine';
import { auditLogger } from './audit-logger';

// Import WorkspaceSession for shared workspace roots
let workspaceSession: { getWorkspaceRootsArray: () => string[] } | null = null;

// Dynamic import to avoid circular dependency / optional dependency.
void import('../workspace')
    .then(workspace => {
        workspaceSession = workspace.workspaceSession as typeof workspaceSession;
    })
    .catch(() => {
        // Workspace module not available
    });

// ==================== PERMISSION MANAGER ====================

class PermissionManager {
    private config: SecurityConfig;
    private session: PermissionSessionState;

    constructor(config: Partial<SecurityConfig> = {}) {
        this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
        this.session = {
            approvedToolsThisSession: new Set(),
            onceApprovals: new Map(),
            trustedWorkspaces: new Set(),
        };

        // Load persisted rules
        this.config.rules = loadRules();
    }

    // ==================== PUBLIC API ====================

    /**
     * Evaluate a command and return permission decision
     * This is the main entry point
     */
    evaluate(command: string, cwd: string): PermissionResult {
        // Step 1: Parse command into argv
        const parseResult = parseCommand(command);

        if (!parseResult.success) {
            auditLogger.logDecision(command, [], 'prompt', 'policy', 3);
            return {
                decision: 'prompt',
                reason: `Command parsing failed: ${parseResult.error}. Manual review required.`,
                riskTier: 3,
                argv: [],
                paths: [],
                domains: [],
                promptPayload: this.createPromptPayload(
                    command,
                    [],
                    3,
                    `Cannot parse command safely: ${parseResult.error}`
                ),
            };
        }

        const argv = parseResult.argv;

        // Step 2: Check for forbidden patterns (hard block)
        const forbidden = isForbiddenPattern(command);
        if (forbidden.forbidden) {
            auditLogger.logDecision(command, argv, 'deny', 'policy', 3);
            return {
                decision: 'deny',
                reason: `Command blocked by security policy: ${forbidden.reason}`,
                riskTier: 3,
                argv,
                paths: extractPaths(argv),
                domains: extractDomains(command),
            };
        }

        // Step 3: Classify risk tier
        const riskTier = classifyRisk(argv, command);

        // Step 4: Extract paths and validate workspace
        const paths = extractPaths(argv);
        const domains = extractDomains(command);

        // Step 5: Check workspace trust
        const pathValidation = this.validatePaths(paths, cwd);
        if (!pathValidation.valid) {
            auditLogger.logDecision(command, argv, 'prompt', 'policy', riskTier);
            return {
                decision: 'prompt',
                reason: pathValidation.reason,
                riskTier,
                argv,
                paths,
                domains,
                promptPayload: this.createPromptPayload(command, argv, riskTier, pathValidation.reason),
            };
        }

        // Step 6: Check network access
        if (domains.length > 0 && !this.config.networkAccess) {
            auditLogger.logDecision(command, argv, 'prompt', 'policy', riskTier);
            return {
                decision: 'prompt',
                reason: 'Command requires network access which is disabled by default',
                riskTier,
                argv,
                paths,
                domains,
                promptPayload: this.createPromptPayload(
                    command,
                    argv,
                    riskTier,
                    `Network access required: ${domains.join(', ')}`
                ),
            };
        }

        // Step 7: Check session approvals
        const commandHash = hashCommand(argv, cwd);
        if (this.hasSessionApproval(argv[0]) || this.hasOnceApproval(commandHash)) {
            auditLogger.logDecision(command, argv, 'allow', 'session', riskTier);
            return {
                decision: 'allow',
                reason: 'Approved for this session',
                riskTier,
                argv,
                paths,
                domains,
                commandHash,
            };
        }

        // Step 8: Apply rules
        const ruleResult = evaluateRules(argv, this.config.rules);

        if (ruleResult.matchedRules.length > 0) {
            const matchedRule = ruleResult.matchedRules[0];
            auditLogger.logDecision(
                command,
                argv,
                ruleResult.decision,
                'rule',
                riskTier,
                matchedRule.id
            );

            if (ruleResult.decision === 'allow') {
                return {
                    decision: 'allow',
                    reason: `Allowed by rule: ${matchedRule.name}`,
                    riskTier,
                    argv,
                    paths,
                    domains,
                    matchedRule,
                    commandHash,
                };
            }

            if (ruleResult.decision === 'deny') {
                return {
                    decision: 'deny',
                    reason: `Blocked by rule: ${matchedRule.name}`,
                    riskTier,
                    argv,
                    paths,
                    domains,
                    matchedRule,
                };
            }
        }

        // Step 9: Apply approval policy
        return this.applyApprovalPolicy(command, argv, cwd, riskTier, paths, domains, commandHash);
    }

    /**
     * Record user approval
     */
    approveOnce(commandHash: string): void {
        this.session.onceApprovals.set(commandHash, {
            commandHash,
            approvedAt: Date.now(),
            expiresAt: Date.now() + 3600000, // 1 hour
        });
    }

    /**
     * Approve tool for session
     */
    approveForSession(toolType: string): void {
        this.session.approvedToolsThisSession.add(toolType);
        auditLogger.logSessionApproval(toolType);
    }

    /**
     * Add a new rule
     */
    addRule(
        name: string,
        argv: string[],
        decision: PermissionDecision
    ): void {
        const id = `rule-${Date.now()}`;
        const rule = createRule(id, name, argv, decision);
        this.config.rules.push(rule);
        saveRules(this.config.rules);
        auditLogger.logRuleAdded(id, argv, decision);
    }

    /**
     * Trust a workspace
     */
    trustWorkspace(path: string): void {
        this.session.trustedWorkspaces.add(path);
        if (!this.config.workspaceRoots.includes(path)) {
            this.config.workspaceRoots.push(path);
        }
    }

    /**
     * Clear session state
     */
    clearSession(): void {
        this.session.approvedToolsThisSession.clear();
        this.session.onceApprovals.clear();
    }

    /**
     * Get current config
     */
    getConfig(): SecurityConfig {
        return { ...this.config };
    }

    /**
     * Update config
     */
    updateConfig(updates: Partial<SecurityConfig>): void {
        this.config = { ...this.config, ...updates };
    }

    // ==================== PRIVATE METHODS ====================

    private hasSessionApproval(toolType: string): boolean {
        return this.session.approvedToolsThisSession.has(toolType);
    }

    private hasOnceApproval(commandHash: string): boolean {
        const approval = this.session.onceApprovals.get(commandHash);
        if (!approval) return false;

        // Check expiry
        if (Date.now() > approval.expiresAt) {
            this.session.onceApprovals.delete(commandHash);
            return false;
        }

        return true;
    }

    private validatePaths(paths: string[], cwd: string): { valid: boolean; reason: string } {
        // Get workspace roots from config or WorkspaceSession
        let roots = this.config.workspaceRoots;
        if (roots.length === 0 && workspaceSession) {
            roots = workspaceSession.getWorkspaceRootsArray();
        }

        // If no workspace roots configured, require prompt for any path
        if (roots.length === 0) {
            if (paths.length > 0) {
                return {
                    valid: false,
                    reason: 'No trusted workspace configured. Please trust a workspace first.'
                };
            }
            return { valid: true, reason: '' };
        }

        // Check each path is within workspace
        for (const path of paths) {
            const fullPath = path.startsWith('/') || path.startsWith('C:')
                ? path
                : `${cwd}/${path}`;

            const normalizedPath = fullPath.replace(/\\/g, '/').toLowerCase();
            const isInWorkspace = roots.some(root => {
                const normalizedRoot = root.replace(/\\/g, '/').toLowerCase();
                return normalizedPath.startsWith(normalizedRoot);
            });

            if (!isInWorkspace) {
                return {
                    valid: false,
                    reason: `Path "${path}" is outside trusted workspace`
                };
            }
        }

        return { valid: true, reason: '' };
    }

    private applyApprovalPolicy(
        command: string,
        argv: string[],
        cwd: string,
        riskTier: RiskTier,
        paths: string[],
        domains: string[],
        commandHash: string
    ): PermissionResult {
        const policy = this.config.approvalPolicy;

        switch (policy) {
            case 'never':
                // Allow everything (but still enforce hard blocks)
                auditLogger.logDecision(command, argv, 'allow', 'policy', riskTier);
                return {
                    decision: 'allow',
                    reason: 'Approval policy: never prompt',
                    riskTier,
                    argv,
                    paths,
                    domains,
                    commandHash,
                };

            case 'on-request':
                // Prompt only for tier >= 2 or ambiguous
                if (riskTier >= 2) {
                    auditLogger.logDecision(command, argv, 'prompt', 'policy', riskTier);
                    return {
                        decision: 'prompt',
                        reason: getRiskDescription(riskTier, argv),
                        riskTier,
                        argv,
                        paths,
                        domains,
                        promptPayload: this.createPromptPayload(command, argv, riskTier),
                        commandHash,
                    };
                }
                auditLogger.logDecision(command, argv, 'allow', 'policy', riskTier);
                return {
                    decision: 'allow',
                    reason: `Low-risk command (tier ${riskTier})`,
                    riskTier,
                    argv,
                    paths,
                    domains,
                    commandHash,
                };

            case 'untrusted':
                // Prompt for everything except explicitly allowed
                auditLogger.logDecision(command, argv, 'prompt', 'policy', riskTier);
                return {
                    decision: 'prompt',
                    reason: 'Untrusted mode: all commands require approval',
                    riskTier,
                    argv,
                    paths,
                    domains,
                    promptPayload: this.createPromptPayload(command, argv, riskTier),
                    commandHash,
                };

            case 'on-failure':
                // Allow but re-prompt if sandbox blocks
                auditLogger.logDecision(command, argv, 'allow', 'policy', riskTier);
                return {
                    decision: 'allow',
                    reason: 'Will re-prompt if sandbox blocks execution',
                    riskTier,
                    argv,
                    paths,
                    domains,
                    commandHash,
                };

            default:
                // Default to prompt
                auditLogger.logDecision(command, argv, 'prompt', 'policy', riskTier);
                return {
                    decision: 'prompt',
                    reason: 'Unknown approval policy',
                    riskTier,
                    argv,
                    paths,
                    domains,
                    promptPayload: this.createPromptPayload(command, argv, riskTier),
                    commandHash,
                };
        }
    }

    private createPromptPayload(
        command: string,
        argv: string[],
        riskTier: RiskTier,
        customReason?: string
    ): PromptPayload {
        const sideEffects = this.predictSideEffects(argv);
        const domains = extractDomains(command);

        return {
            uiText: customReason || getRiskDescription(riskTier, argv),
            expectedSideEffects: sideEffects,
            networkAccess: domains,
            choices: [
                { id: 'approve_once', label: 'Approve once', icon: '✓' },
                { id: 'approve_session', label: 'Approve for session', icon: '🔄' },
                { id: 'always_allow', label: 'Always allow (add rule)', icon: '✅' },
                { id: 'always_prompt', label: 'Always prompt (add rule)', icon: '❓' },
                { id: 'always_forbid', label: 'Always forbid (add rule)', icon: '🚫' },
                { id: 'deny', label: 'Deny', icon: '✗' },
            ],
            defaultChoice: 'approve_once',
        };
    }

    private predictSideEffects(argv: string[]): string[] {
        const effects: string[] = [];
        const cmd = argv[0]?.toLowerCase();

        if (!cmd) return effects;

        // File modifications
        if (['touch', 'mkdir', 'cp', 'mv', 'rm', 'echo'].includes(cmd)) {
            effects.push('May modify files in workspace');
        }

        // Package installations
        if (['npm', 'npx', 'yarn', 'pnpm', 'pip'].includes(cmd)) {
            effects.push('May install packages');
            if (argv.includes('install') || argv.includes('add')) {
                effects.push('Network access required');
            }
        }

        // Git operations
        if (cmd === 'git') {
            const subCmd = argv[1]?.toLowerCase();
            if (['push', 'clone', 'fetch', 'pull'].includes(subCmd)) {
                effects.push('Network access required');
            }
            if (['commit', 'merge', 'rebase'].includes(subCmd)) {
                effects.push('May modify git history');
            }
        }

        // Process management
        if (['node', 'python', 'npm'].includes(cmd)) {
            effects.push('May start long-running process');
        }

        return effects;
    }
}

// ==================== SINGLETON ====================

export const permissionManager = new PermissionManager();

// ==================== EXPORTS ====================

export { PermissionManager };
