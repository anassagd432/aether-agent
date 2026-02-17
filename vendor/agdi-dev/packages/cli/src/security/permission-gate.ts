/**
 * Permission Gate - Single gatekeeper for all command execution
 * 
 * All commands MUST pass through this gate. Cannot be bypassed.
 */

import { resolve, relative, isAbsolute } from 'path';
import { getEnvironment, type ExecutionEnvironment } from './execution-env.js';
import { parseArgv, extractPaths, extractDomains, extractPorts, type PathExtraction } from './argv-parser.js';
import { evaluateRules, getAllRules, type RuleAction } from './rules-engine.js';
import { detectShellWrapper, isHighRiskWrapper, getMostRestrictiveTier } from './shell-wrapper-detector.js';

// ==================== TYPES ====================

export type RiskTier = 0 | 1 | 2 | 3;
export type ViolationSeverity = 'hard' | 'promptable';

export interface Violation {
    message: string;
    severity: ViolationSeverity;
}

export interface GateResult {
    decision: 'allow' | 'prompt' | 'deny';
    riskTier: RiskTier;
    command: string;
    cwd: string;
    parsedArgv: string[];
    paths: PathExtraction[];
    ports: number[];
    domains: string[];
    reason: string;
    violations: Violation[];
    matchedRuleId?: string;
    isShellWrapper?: boolean;
    subCommands?: string[];
}

// ==================== HARD VIOLATIONS ====================

/**
 * Patterns that ALWAYS result in hard deny
 */
const HARD_DENY_PATTERNS = [
    { pattern: /\.ssh\/.*(?:id_rsa|id_ed25519|authorized_keys)/i, msg: 'SSH key access' },
    { pattern: /\/etc\/shadow/i, msg: 'Shadow file access' },
    { pattern: /\/etc\/passwd/i, msg: 'Passwd file access' },
    { pattern: /\brm\s+(-[rf]+\s+)*[/\\]$/i, msg: 'Root filesystem deletion' },
    { pattern: /\brm\s+(-[rf]+\s+)*~$/i, msg: 'Home directory deletion' },
    { pattern: /\bcurl\s+[^|]*\|\s*(bash|sh|zsh)/i, msg: 'Piped script execution' },
    { pattern: /\bwget\s+[^|]*\|\s*(bash|sh|zsh)/i, msg: 'Piped script execution' },
    { pattern: /\bchmod\s+777\s+\//i, msg: 'World-writable root' },
    { pattern: /\b(sudo|su|runas|doas)\b/i, msg: 'Privilege escalation' },
    { pattern: /\bformat\s+[a-z]:/i, msg: 'Drive format' },
    { pattern: /\bmkfs\b/i, msg: 'Filesystem creation' },
    { pattern: /\bdd\s+.*of=\/dev/i, msg: 'Raw device write' },
];

// ==================== RISK CLASSIFICATION ====================

/**
 * Tier 0: Read-only inspection
 */
const TIER_0_COMMANDS = new Set([
    'ls', 'dir', 'cat', 'type', 'head', 'tail', 'less', 'more',
    'pwd', 'echo', 'find', 'grep', 'findstr', 'which', 'where',
    'wc', 'sort', 'uniq', 'diff', 'cmp', 'file', 'stat',
]);

const TIER_0_GIT = new Set([
    'status', 'diff', 'log', 'show', 'branch', 'remote', 'tag',
    'stash', 'describe', 'rev-parse', 'config',
]);

/**
 * Tier 1: Safe workspace writes
 */
const TIER_1_COMMANDS = new Set([
    'touch', 'mkdir', 'cp', 'mv', 'rm', 'rmdir', 'ln',
]);

const TIER_1_GIT = new Set([
    'add', 'commit', 'checkout', 'switch', 'merge', 'rebase',
    'reset', 'stash', 'clean', 'restore',
]);

/**
 * Tier 2: Installs, builds, servers
 */
const TIER_2_COMMANDS = new Set([
    'npm', 'yarn', 'pnpm', 'pip', 'pip3', 'poetry', 'cargo',
    'node', 'python', 'python3', 'ruby', 'go', 'java',
    'make', 'cmake', 'gcc', 'g++', 'clang',
    'docker', 'docker-compose',
    'chmod', 'chown',
]);

/**
 * Classify risk tier for a command
 */
export function classifyRisk(argv: string[], rawCommand: string): RiskTier {
    if (argv.length === 0) return 3;

    const cmd = argv[0].toLowerCase();

    // Check shell wrappers
    const wrapperResult = detectShellWrapper(argv);
    if (wrapperResult.isWrapper) {
        if (isHighRiskWrapper(wrapperResult)) {
            return 3;
        }
        // For simple wrappers, evaluate sub-commands
        if (wrapperResult.subCommands && wrapperResult.subCommands.length > 0) {
            const subTiers = wrapperResult.subCommands.map(sc => {
                const parsed = parseArgv(sc);
                return classifyRisk(parsed.argv, sc);
            });
            return getMostRestrictiveTier(subTiers) as RiskTier;
        }
    }

    // Check hard deny patterns (Tier 3)
    for (const { pattern } of HARD_DENY_PATTERNS) {
        if (pattern.test(rawCommand)) {
            return 3;
        }
    }

    // Git commands
    if (cmd === 'git' && argv.length > 1) {
        const subCmd = argv[1].toLowerCase();
        if (TIER_0_GIT.has(subCmd)) return 0;
        if (TIER_1_GIT.has(subCmd)) return 1;
        if (subCmd === 'push' || subCmd === 'pull' || subCmd === 'fetch' || subCmd === 'clone') {
            return 2; // Network operations
        }
        return 2;
    }

    // Standard commands
    if (TIER_0_COMMANDS.has(cmd)) return 0;
    if (TIER_1_COMMANDS.has(cmd)) return 1;
    if (TIER_2_COMMANDS.has(cmd)) return 2;

    // Unknown commands are Tier 2 by default
    return 2;
}

// ==================== PATH VALIDATION (FIXED) ====================

/**
 * Check if a path is within workspace root
 * FIXED: Uses relative() instead of startsWith() to prevent bypass
 */
function isWithinWorkspace(p: string, workspaceRoot: string, cwd: string): boolean {
    const resolved = resolve(cwd, p);
    const root = resolve(workspaceRoot);
    const rel = relative(root, resolved);

    // Path is within workspace if:
    // 1. rel is empty (same as root)
    // 2. rel doesn't start with '..' and isn't absolute
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Validate all paths in command are within workspace
 */
function validatePaths(
    paths: PathExtraction[],
    workspaceRoot: string,
    cwd: string
): Violation[] {
    const violations: Violation[] = [];

    for (const p of paths) {
        if (p.operation === 'write' && !isWithinWorkspace(p.path, workspaceRoot, cwd)) {
            violations.push({
                message: `Write to path outside workspace: ${p.path}`,
                severity: 'promptable', // User might intentionally allow
            });
        }
    }

    return violations;
}

// ==================== NETWORK VALIDATION ====================

/**
 * Validate network access against policy
 */
function validateNetwork(
    domains: string[],
    policy: 'off' | 'allowlist' | 'on',
    allowedDomains: string[]
): Violation[] {
    if (policy === 'on' || domains.length === 0) {
        return [];
    }

    const violations: Violation[] = [];

    if (policy === 'off' && domains.length > 0) {
        violations.push({
            message: `Network access requested: ${domains.join(', ')}`,
            severity: 'promptable', // User can approve network
        });
        return violations;
    }

    // Allowlist mode
    for (const domain of domains) {
        const isAllowed = allowedDomains.some(allowed =>
            domain === allowed || domain.endsWith('.' + allowed)
        );
        if (!isAllowed) {
            violations.push({
                message: `Domain not in allowlist: ${domain}`,
                severity: 'promptable',
            });
        }
    }

    return violations;
}

/**
 * Check for hard violations in command
 */
function checkHardViolations(command: string): Violation[] {
    const violations: Violation[] = [];

    for (const { pattern, msg } of HARD_DENY_PATTERNS) {
        if (pattern.test(command)) {
            violations.push({
                message: msg,
                severity: 'hard',
            });
        }
    }

    return violations;
}

// ==================== THE GATE ====================

/**
 * Evaluate a command through the permission gate
 * This is the SINGLE GATEKEEPER - all commands must pass through here
 */
export function evaluateCommand(command: string, cwd?: string): GateResult {
    const env = getEnvironment();
    const effectiveCwd = cwd || env.cwd;

    // Parse command
    const parsed = parseArgv(command);
    const paths = extractPaths(parsed);
    const domains = extractDomains(command);
    const ports = extractPorts(command);

    // Detect shell wrapper
    const wrapperResult = detectShellWrapper(parsed.argv);

    // Classify risk
    const riskTier = classifyRisk(parsed.argv, command);

    // Collect violations
    const violations: Violation[] = [];

    // Check hard violations first
    violations.push(...checkHardViolations(command));

    // Check trust level - FIXED: prompt instead of deny
    if (env.trustLevel === 'untrusted' && riskTier > 0) {
        return {
            decision: 'prompt',
            riskTier,
            command,
            cwd: effectiveCwd,
            parsedArgv: parsed.argv,
            paths,
            ports,
            domains,
            reason: 'Workspace is untrusted. Trust this folder to allow file writes and command execution.',
            violations: [{ message: 'Workspace not trusted', severity: 'promptable' }],
            isShellWrapper: wrapperResult.isWrapper,
            subCommands: wrapperResult.subCommands,
        };
    }

    // Validate paths
    violations.push(...validatePaths(paths, env.workspaceRoot, effectiveCwd));

    // Validate network
    violations.push(...validateNetwork(domains, env.networkPolicy, env.allowedDomains));

    // Apply rules engine
    const rules = getAllRules();
    const ruleResult = evaluateRules(parsed.argv, rules);

    // Determine final decision based on violation severity
    const hasHardViolation = violations.some(v => v.severity === 'hard');
    const hasPromptableViolation = violations.some(v => v.severity === 'promptable');

    let decision: 'allow' | 'prompt' | 'deny';
    let reason: string;

    if (hasHardViolation) {
        decision = 'deny';
        reason = violations.find(v => v.severity === 'hard')?.message || 'Security violation';
    } else if (ruleResult.decision === 'forbid') {
        decision = 'deny';
        reason = ruleResult.mostRestrictive?.description || 'Forbidden by rule';
    } else if (hasPromptableViolation) {
        decision = 'prompt';
        reason = violations.find(v => v.severity === 'promptable')?.message || 'Approval required';
    } else if (ruleResult.decision === 'allow' && riskTier <= 1) {
        decision = 'allow';
        reason = ruleResult.mostRestrictive?.description || 'Allowed by rule';
    } else {
        decision = 'prompt';
        reason = getRiskDescription(riskTier, parsed.argv);
    }

    return {
        decision,
        riskTier,
        command,
        cwd: effectiveCwd,
        parsedArgv: parsed.argv,
        paths,
        ports,
        domains,
        reason,
        violations,
        matchedRuleId: ruleResult.mostRestrictive?.id,
        isShellWrapper: wrapperResult.isWrapper,
        subCommands: wrapperResult.subCommands,
    };
}

/**
 * Get human-readable risk description
 */
function getRiskDescription(tier: RiskTier, argv: string[]): string {
    const cmd = argv[0] || 'unknown';
    switch (tier) {
        case 0:
            return `Read-only: ${cmd}`;
        case 1:
            return `Workspace modification: ${cmd}`;
        case 2:
            return `System/package operation: ${cmd}`;
        case 3:
            return `Potentially dangerous: ${cmd}`;
    }
}

// ==================== EXPORTS ====================

export { classifyRisk as classifyCommandRisk };
