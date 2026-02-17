/**
 * Rules Engine
 * 
 * Matches commands against user-defined and default rules.
 * "Most restrictive wins" policy.
 */

import type { PermissionRule, PermissionDecision } from './types';

// ==================== DEFAULT RULES ====================

export const DEFAULT_RULES: PermissionRule[] = [
    // Always allow read-only commands
    {
        id: 'allow-ls',
        name: 'Allow ls',
        pattern: ['ls'],
        decision: 'allow',
        createdAt: 0,
        createdBy: 'default',
    },
    {
        id: 'allow-cat',
        name: 'Allow cat',
        pattern: ['cat'],
        decision: 'allow',
        createdAt: 0,
        createdBy: 'default',
    },
    {
        id: 'allow-pwd',
        name: 'Allow pwd',
        pattern: ['pwd'],
        decision: 'allow',
        createdAt: 0,
        createdBy: 'default',
    },
    {
        id: 'allow-echo',
        name: 'Allow echo',
        pattern: ['echo'],
        decision: 'allow',
        createdAt: 0,
        createdBy: 'default',
    },
    {
        id: 'allow-git-status',
        name: 'Allow git status',
        pattern: ['git', 'status'],
        decision: 'allow',
        createdAt: 0,
        createdBy: 'default',
    },
    {
        id: 'allow-git-diff',
        name: 'Allow git diff',
        pattern: ['git', 'diff'],
        decision: 'allow',
        createdAt: 0,
        createdBy: 'default',
    },
    {
        id: 'allow-git-log',
        name: 'Allow git log',
        pattern: ['git', 'log'],
        decision: 'allow',
        createdAt: 0,
        createdBy: 'default',
    },
    // Prompt for npm commands
    {
        id: 'prompt-npm-install',
        name: 'Prompt npm install',
        pattern: ['npm', 'install'],
        decision: 'prompt',
        createdAt: 0,
        createdBy: 'default',
    },
    {
        id: 'prompt-npm-run',
        name: 'Prompt npm run',
        pattern: ['npm', 'run'],
        decision: 'prompt',
        createdAt: 0,
        createdBy: 'default',
    },
    // Forbid dangerous patterns
    {
        id: 'forbid-sudo',
        name: 'Forbid sudo',
        pattern: ['sudo'],
        decision: 'deny',
        createdAt: 0,
        createdBy: 'default',
    },
    {
        id: 'forbid-rm-rf',
        name: 'Forbid rm -rf',
        pattern: ['rm', ['-rf', '-fr', '-r', '-f']],
        decision: 'deny',
        createdAt: 0,
        createdBy: 'default',
    },
];

// ==================== RULE MATCHING ====================

/**
 * Check if argv matches a pattern
 * Pattern can have unions at positions: ['git', ['status', 'diff']]
 */
export function matchesPattern(argv: string[], pattern: (string | string[])[]): boolean {
    if (argv.length < pattern.length) {
        return false;
    }

    for (let i = 0; i < pattern.length; i++) {
        const patternPart = pattern[i];
        const argvPart = argv[i].toLowerCase();

        if (Array.isArray(patternPart)) {
            // Union: any of these match
            const matches = patternPart.some(p => argvPart === p.toLowerCase());
            if (!matches) return false;
        } else {
            // Single string match
            if (argvPart !== patternPart.toLowerCase()) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Find all matching rules for a command
 */
export function findMatchingRules(argv: string[], rules: PermissionRule[]): PermissionRule[] {
    return rules.filter(rule => matchesPattern(argv, rule.pattern));
}

/**
 * Apply "most restrictive wins" policy
 */
function getMostRestrictive(decisions: PermissionDecision[]): PermissionDecision {
    // Order: deny > prompt > allow
    if (decisions.includes('deny')) return 'deny';
    if (decisions.includes('prompt')) return 'prompt';
    return 'allow';
}

/**
 * Evaluate rules and return final decision
 */
export function evaluateRules(
    argv: string[],
    rules: PermissionRule[]
): { decision: PermissionDecision; matchedRules: PermissionRule[] } {
    const matchedRules = findMatchingRules(argv, rules);

    if (matchedRules.length === 0) {
        return { decision: 'prompt', matchedRules: [] };
    }

    const decisions = matchedRules.map(r => r.decision);
    const decision = getMostRestrictive(decisions);

    return { decision, matchedRules };
}

// ==================== RULE MANAGEMENT ====================

/**
 * Create a new rule from argv pattern
 */
export function createRule(
    id: string,
    name: string,
    argv: string[],
    decision: PermissionDecision
): PermissionRule {
    return {
        id,
        name,
        pattern: argv.slice(0, 3),  // Max 3 prefix tokens
        decision,
        createdAt: Date.now(),
        createdBy: 'user',
    };
}

/**
 * Serialize rules to JSON for persistence
 */
export function serializeRules(rules: PermissionRule[]): string {
    return JSON.stringify(rules, null, 2);
}

/**
 * Deserialize rules from JSON
 */
export function deserializeRules(json: string): PermissionRule[] {
    try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(r =>
            r.id && r.pattern && Array.isArray(r.pattern) && r.decision
        );
    } catch {
        return [];
    }
}

/**
 * Load rules from localStorage
 */
export function loadRules(): PermissionRule[] {
    try {
        if (typeof localStorage === 'undefined') {
            return [...DEFAULT_RULES];
        }
        const stored = localStorage.getItem('agdi_permission_rules');
        if (!stored) return [...DEFAULT_RULES];

        const userRules = deserializeRules(stored);
        return [...DEFAULT_RULES, ...userRules];
    } catch {
        return [...DEFAULT_RULES];
    }
}

/**
 * Save rules to localStorage
 */
export function saveRules(rules: PermissionRule[]): void {
    try {
        if (typeof localStorage === 'undefined') return;
        // Only save user rules, not defaults
        const userRules = rules.filter(r => r.createdBy === 'user');
        localStorage.setItem('agdi_permission_rules', serializeRules(userRules));
    } catch (e) {
        console.error('Failed to save rules:', e);
    }
}
