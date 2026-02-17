/**
 * Rules Engine - Agdi Dev permission rules
 * 
 * Persistent rules with argv-prefix matching, union support,
 * and "most restrictive wins" policy.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ==================== TYPES ====================

export type RuleAction = 'allow' | 'prompt' | 'forbid';

/**
 * Rule pattern: string or union of strings at each position
 * Example: ["git", ["status", "diff", "log"]] matches git status, git diff, git log
 */
export type RulePattern = (string | string[])[];

export interface Rule {
    id: string;
    pattern: RulePattern;
    action: RuleAction;
    description?: string;
    createdAt: string;
    source: 'default' | 'user' | 'session';
}

export interface RuleEvaluation {
    decision: RuleAction;
    matchedRules: Rule[];
    mostRestrictive: Rule | null;
}

// ==================== DEFAULT RULES ====================

export const DEFAULT_RULES: Rule[] = [
    // Tier 0: Read-only (allow)
    { id: 'default-ls', pattern: ['ls'], action: 'allow', source: 'default', createdAt: '', description: 'List directory' },
    { id: 'default-dir', pattern: ['dir'], action: 'allow', source: 'default', createdAt: '', description: 'List directory (Windows)' },
    { id: 'default-cat', pattern: ['cat'], action: 'allow', source: 'default', createdAt: '', description: 'View file' },
    { id: 'default-type', pattern: ['type'], action: 'allow', source: 'default', createdAt: '', description: 'View file (Windows)' },
    { id: 'default-pwd', pattern: ['pwd'], action: 'allow', source: 'default', createdAt: '', description: 'Print working directory' },
    { id: 'default-echo', pattern: ['echo'], action: 'allow', source: 'default', createdAt: '', description: 'Print text' },
    { id: 'default-head', pattern: ['head'], action: 'allow', source: 'default', createdAt: '', description: 'View file head' },
    { id: 'default-tail', pattern: ['tail'], action: 'allow', source: 'default', createdAt: '', description: 'View file tail' },
    { id: 'default-find', pattern: ['find'], action: 'allow', source: 'default', createdAt: '', description: 'Find files' },
    { id: 'default-grep', pattern: ['grep'], action: 'allow', source: 'default', createdAt: '', description: 'Search in files' },
    { id: 'default-findstr', pattern: ['findstr'], action: 'allow', source: 'default', createdAt: '', description: 'Search in files (Windows)' },

    // Git read commands (allow)
    { id: 'default-git-status', pattern: ['git', 'status'], action: 'allow', source: 'default', createdAt: '', description: 'Git status' },
    { id: 'default-git-diff', pattern: ['git', 'diff'], action: 'allow', source: 'default', createdAt: '', description: 'Git diff' },
    { id: 'default-git-log', pattern: ['git', 'log'], action: 'allow', source: 'default', createdAt: '', description: 'Git log' },
    { id: 'default-git-branch', pattern: ['git', 'branch'], action: 'allow', source: 'default', createdAt: '', description: 'Git branch' },
    { id: 'default-git-show', pattern: ['git', 'show'], action: 'allow', source: 'default', createdAt: '', description: 'Git show' },

    // Tier 1: Workspace writes (prompt)
    { id: 'default-touch', pattern: ['touch'], action: 'prompt', source: 'default', createdAt: '', description: 'Create file' },
    { id: 'default-mkdir', pattern: ['mkdir'], action: 'prompt', source: 'default', createdAt: '', description: 'Create directory' },
    { id: 'default-git-add', pattern: ['git', 'add'], action: 'prompt', source: 'default', createdAt: '', description: 'Git add' },
    { id: 'default-git-commit', pattern: ['git', 'commit'], action: 'prompt', source: 'default', createdAt: '', description: 'Git commit' },

    // Tier 2: Package managers (prompt)
    { id: 'default-npm-install', pattern: ['npm', 'install'], action: 'prompt', source: 'default', createdAt: '', description: 'npm install' },
    { id: 'default-npm-i', pattern: ['npm', 'i'], action: 'prompt', source: 'default', createdAt: '', description: 'npm install (short)' },
    { id: 'default-yarn-add', pattern: ['yarn', 'add'], action: 'prompt', source: 'default', createdAt: '', description: 'yarn add' },
    { id: 'default-yarn-install', pattern: ['yarn', 'install'], action: 'prompt', source: 'default', createdAt: '', description: 'yarn install' },
    { id: 'default-pnpm-install', pattern: ['pnpm', 'install'], action: 'prompt', source: 'default', createdAt: '', description: 'pnpm install' },
    { id: 'default-pnpm-add', pattern: ['pnpm', 'add'], action: 'prompt', source: 'default', createdAt: '', description: 'pnpm add' },
    { id: 'default-pip-install', pattern: ['pip', 'install'], action: 'prompt', source: 'default', createdAt: '', description: 'pip install' },

    // Tier 3: Dangerous (forbid)
    { id: 'default-sudo', pattern: ['sudo'], action: 'forbid', source: 'default', createdAt: '', description: 'Elevated privileges' },
    { id: 'default-rm-rf', pattern: ['rm', '-rf'], action: 'forbid', source: 'default', createdAt: '', description: 'Recursive force delete' },
    { id: 'default-rm-fr', pattern: ['rm', '-fr'], action: 'forbid', source: 'default', createdAt: '', description: 'Recursive force delete' },
    { id: 'default-chmod-777', pattern: ['chmod', '777'], action: 'forbid', source: 'default', createdAt: '', description: 'World-writable permissions' },
    { id: 'default-curl-bash', pattern: ['curl'], action: 'prompt', source: 'default', createdAt: '', description: 'HTTP request' },
    { id: 'default-wget', pattern: ['wget'], action: 'prompt', source: 'default', createdAt: '', description: 'HTTP download' },
    { id: 'default-git-push-force', pattern: ['git', 'push', '--force'], action: 'forbid', source: 'default', createdAt: '', description: 'Force push' },
    { id: 'default-git-push-f', pattern: ['git', 'push', '-f'], action: 'forbid', source: 'default', createdAt: '', description: 'Force push' },
];

// ==================== RULE MATCHING ====================

/**
 * Check if argv matches a pattern position
 */
function matchesPosition(argvItem: string, patternItem: string | string[]): boolean {
    const argLower = argvItem.toLowerCase();

    if (Array.isArray(patternItem)) {
        // Union: match any
        return patternItem.some(p => p.toLowerCase() === argLower);
    }

    return patternItem.toLowerCase() === argLower;
}

/**
 * Check if argv matches a full pattern (prefix match)
 */
export function matchesPattern(argv: string[], pattern: RulePattern): boolean {
    if (argv.length < pattern.length) {
        return false;
    }

    for (let i = 0; i < pattern.length; i++) {
        if (!matchesPosition(argv[i], pattern[i])) {
            return false;
        }
    }

    return true;
}

/**
 * Get restriction level (for "most restrictive wins")
 */
function getRestrictionLevel(action: RuleAction): number {
    switch (action) {
        case 'forbid': return 2;
        case 'prompt': return 1;
        case 'allow': return 0;
    }
}

/**
 * Evaluate rules against argv
 */
export function evaluateRules(argv: string[], rules: Rule[]): RuleEvaluation {
    const matchedRules: Rule[] = [];

    for (const rule of rules) {
        if (matchesPattern(argv, rule.pattern)) {
            matchedRules.push(rule);
        }
    }

    if (matchedRules.length === 0) {
        return {
            decision: 'prompt', // Default: prompt for unknown
            matchedRules: [],
            mostRestrictive: null,
        };
    }

    // Find most restrictive
    let mostRestrictive = matchedRules[0];
    for (const rule of matchedRules) {
        if (getRestrictionLevel(rule.action) > getRestrictionLevel(mostRestrictive.action)) {
            mostRestrictive = rule;
        }
    }

    return {
        decision: mostRestrictive.action,
        matchedRules,
        mostRestrictive,
    };
}

// ==================== PERSISTENCE ====================

const RULES_DIR = join(homedir(), '.agdi');
const RULES_FILE = join(RULES_DIR, 'rules.json');

/**
 * Load user rules from disk
 */
export function loadUserRules(): Rule[] {
    try {
        if (existsSync(RULES_FILE)) {
            const data = readFileSync(RULES_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            return parsed.rules || [];
        }
    } catch {
        // Ignore errors, return empty
    }
    return [];
}

/**
 * Save user rules to disk
 */
export function saveUserRules(rules: Rule[]): void {
    try {
        if (!existsSync(RULES_DIR)) {
            mkdirSync(RULES_DIR, { recursive: true });
        }
        writeFileSync(RULES_FILE, JSON.stringify({ rules }, null, 2));
    } catch (error) {
        console.error('Failed to save rules:', error);
    }
}

/**
 * Add a new user rule
 */
export function addRule(pattern: RulePattern, action: RuleAction, description?: string): Rule {
    const rules = loadUserRules();
    const rule: Rule = {
        id: `user-${Date.now()}`,
        pattern,
        action,
        description,
        createdAt: new Date().toISOString(),
        source: 'user',
    };
    rules.push(rule);
    saveUserRules(rules);
    return rule;
}

/**
 * Remove a user rule by ID
 */
export function removeRule(ruleId: string): boolean {
    const rules = loadUserRules();
    const index = rules.findIndex(r => r.id === ruleId);
    if (index === -1) return false;
    rules.splice(index, 1);
    saveUserRules(rules);
    return true;
}

// ==================== SESSION RULES ====================

let sessionRules: Rule[] = [];

/**
 * Add a session-scoped rule (not persisted)
 */
export function addSessionRule(pattern: RulePattern, action: RuleAction, description?: string): Rule {
    const rule: Rule = {
        id: `session-${Date.now()}`,
        pattern,
        action,
        description,
        createdAt: new Date().toISOString(),
        source: 'session',
    };
    sessionRules.push(rule);
    return rule;
}

/**
 * Get all active rules (default + user + session)
 */
export function getAllRules(): Rule[] {
    return [...DEFAULT_RULES, ...loadUserRules(), ...sessionRules];
}

/**
 * Clear session rules
 */
export function clearSessionRules(): void {
    sessionRules = [];
}
