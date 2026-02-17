/**
 * Risk Classifier
 * 
 * Classifies commands into risk tiers 0-3.
 */

import type { RiskTier } from './types';

// ==================== TIER 0: READ-ONLY ====================

const TIER_0_COMMANDS = new Set([
    'cat', 'head', 'tail', 'less', 'more', 'wc', 'file',
    'ls', 'dir', 'tree', 'pwd', 'find', 'which', 'whereis',
    'echo', 'printf', 'env', 'printenv',
    'date', 'cal', 'uptime', 'whoami', 'id', 'groups',
    'diff', 'cmp', 'md5sum', 'sha256sum',
]);

const TIER_0_GIT = new Set([
    'status', 'log', 'diff', 'show', 'branch', 'tag',
    'remote', 'fetch', 'ls-files', 'ls-tree', 'rev-parse',
]);

// ==================== TIER 1: WORKSPACE WRITE ====================

const TIER_1_COMMANDS = new Set([
    'touch', 'mkdir', 'cp', 'mv', 'ln',
    'tee', 'sort', 'uniq', 'cut', 'paste', 'tr', 'sed', 'awk',
    'tar', 'zip', 'unzip', 'gzip', 'gunzip',
]);

const TIER_1_GIT = new Set([
    'add', 'commit', 'stash', 'checkout', 'switch', 'restore',
    'merge', 'rebase', 'cherry-pick', 'revert', 'reset',
]);

// ==================== TIER 2: SYSTEM/PACKAGE ====================

const TIER_2_COMMANDS = new Set([
    'npm', 'npx', 'yarn', 'pnpm', 'bun',
    'pip', 'pip3', 'pipenv', 'poetry', 'conda',
    'cargo', 'go', 'gem', 'bundle',
    'docker', 'docker-compose', 'podman',
    'make', 'cmake', 'configure',
    'node', 'python', 'python3', 'ruby', 'perl',
    'systemctl', 'service', 'launchctl',
]);

// ==================== TIER 3: DANGEROUS PATTERNS ====================

const TIER_3_PATTERNS: RegExp[] = [
    // Privilege escalation
    /^sudo\b/,
    /^su\b/,
    /^doas\b/,
    /^pkexec\b/,

    // Destructive filesystem
    /\brm\s+(-[a-z]*)?-?r/i,  // rm with -r flag
    /\brm\s+(-[a-z]*)?-?f/i,  // rm with -f flag
    />\s*\/etc\//,
    />\s*\/usr\//,
    />\s*\/var\//,
    />\s*\/bin\//,
    />\s*\/sbin\//,
    />\s*~\//,
    />\s*\$HOME/,

    // Remote code execution
    /curl\s+.*\|\s*(bash|sh|zsh)/i,
    /wget\s+.*\|\s*(bash|sh|zsh)/i,
    /\|\s*(bash|sh|zsh)\s*$/,

    // Dangerous permissions
    /chmod\s+(-[a-z]*\s+)?[0-7]*7[0-7]*/,  // World writable
    /chmod\s+.*\+s/,  // Setuid
    /chown\s+root/,

    // Secrets exposure
    /\.ssh\//,
    /id_rsa/,
    /id_ed25519/,
    /\.gnupg\//,
    /\.aws\/credentials/,
    /\.env/,
    /password|secret|token|api[_-]?key/i,

    // System modification
    /\bdd\s+.*of=/,
    /mkfs\./,
    /fdisk/,
    /parted/,
    /\bkill\s+-9/,
    /killall/,
    /pkill/,
];

// ==================== CLASSIFIER ====================

/**
 * Classify a command into risk tier 0-3
 */
export function classifyRisk(argv: string[], command: string): RiskTier {
    if (argv.length === 0) return 3;

    const baseCommand = argv[0].toLowerCase();
    const fullCommand = command.toLowerCase();

    // Check Tier 3 patterns first (most dangerous)
    for (const pattern of TIER_3_PATTERNS) {
        if (pattern.test(fullCommand)) {
            return 3;
        }
    }

    // Check for rm command specifically
    if (baseCommand === 'rm') {
        // rm without -r/-f is tier 1, with them is tier 3 (caught above)
        return 1;
    }

    // Git commands
    if (baseCommand === 'git' && argv.length > 1) {
        const subCommand = argv[1].toLowerCase();
        if (TIER_0_GIT.has(subCommand)) return 0;
        if (TIER_1_GIT.has(subCommand)) return 1;
        if (subCommand === 'push' || subCommand === 'clone') return 2;
        return 1;
    }

    // Check tier 0
    if (TIER_0_COMMANDS.has(baseCommand)) return 0;

    // Check tier 1
    if (TIER_1_COMMANDS.has(baseCommand)) return 1;

    // Check tier 2
    if (TIER_2_COMMANDS.has(baseCommand)) return 2;

    // Default: tier 2 for unknown commands (conservative)
    return 2;
}

/**
 * Check if command matches any forbidden pattern
 */
export function isForbiddenPattern(command: string): { forbidden: boolean; reason?: string } {
    for (const pattern of TIER_3_PATTERNS) {
        if (pattern.test(command)) {
            return {
                forbidden: true,
                reason: `Matches dangerous pattern: ${pattern.source}`
            };
        }
    }
    return { forbidden: false };
}

/**
 * Get human-readable description of risk
 */
export function getRiskDescription(tier: RiskTier, argv: string[]): string {
    const cmd = argv[0] || 'unknown';

    switch (tier) {
        case 0:
            return `Read-only command (${cmd}) - safe to run`;
        case 1:
            return `Workspace modification (${cmd}) - may modify files in project`;
        case 2:
            return `System/package operation (${cmd}) - may install packages or change system state`;
        case 3:
            return `Potentially dangerous (${cmd}) - requires explicit approval`;
    }
}
