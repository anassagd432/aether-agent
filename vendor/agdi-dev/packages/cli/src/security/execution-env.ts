/**
 * Execution Environment Detection
 * 
 * Detects the execution context: host OS, execution backend,
 * workspace root, and displays session header.
 */

import chalk from 'chalk';
import { platform, homedir } from 'os';
import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';

// ==================== TYPES ====================

export type ExecutionBackend = 'windows-host' | 'linux-host' | 'macos-host' | 'wsl' | 'container';
export type NetworkPolicy = 'off' | 'allowlist' | 'on';
export type TrustLevel = 'untrusted' | 'session' | 'persistent';

export interface ExecutionEnvironment {
    os: 'windows' | 'linux' | 'darwin';
    backend: ExecutionBackend;
    workspaceRoot: string;
    cwd: string;
    networkPolicy: NetworkPolicy;
    allowedDomains: string[];
    trustLevel: TrustLevel;
    isContainer: boolean;
    isWSL: boolean;
}

// ==================== DETECTION ====================

/**
 * Detect if running inside WSL
 */
function detectWSL(): boolean {
    if (platform() !== 'linux') return false;

    try {
        // WSL sets specific environment variables
        if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) {
            return true;
        }

        // Check /proc/version for Microsoft
        if (existsSync('/proc/version')) {
            const version = readFileSync('/proc/version', 'utf-8');
            return version.toLowerCase().includes('microsoft');
        }
    } catch {
        // Ignore errors
    }

    return false;
}

/**
 * Detect if running inside a container
 */
function detectContainer(): boolean {
    try {
        // Docker containers have /.dockerenv
        if (existsSync('/.dockerenv')) {
            return true;
        }

        // Check cgroup for container indicators
        if (existsSync('/proc/1/cgroup')) {
            const cgroup = readFileSync('/proc/1/cgroup', 'utf-8');
            if (cgroup.includes('docker') || cgroup.includes('lxc') || cgroup.includes('kubepods')) {
                return true;
            }
        }

        // Check for Kubernetes
        if (process.env.KUBERNETES_SERVICE_HOST) {
            return true;
        }
    } catch {
        // Ignore errors
    }

    return false;
}

/**
 * Detect execution backend
 */
function detectBackend(): ExecutionBackend {
    const os = platform();

    if (detectContainer()) {
        return 'container';
    }

    if (detectWSL()) {
        return 'wsl';
    }

    switch (os) {
        case 'win32':
            return 'windows-host';
        case 'linux':
            return 'linux-host';
        case 'darwin':
            return 'macos-host';
        default:
            return 'linux-host';
    }
}

/**
 * Get workspace root from launch directory
 */
function getWorkspaceRoot(): string {
    // Use current working directory as workspace root
    return process.cwd();
}

/**
 * Detect full execution environment
 */
export function detectEnvironment(overrides?: Partial<ExecutionEnvironment>): ExecutionEnvironment {
    const os = platform() === 'win32' ? 'windows' : platform() === 'darwin' ? 'darwin' : 'linux';
    const backend = detectBackend();
    const workspaceRoot = getWorkspaceRoot();

    return {
        os,
        backend,
        workspaceRoot,
        cwd: workspaceRoot, // Start cwd at workspace root
        networkPolicy: 'off', // Default: network off
        allowedDomains: [
            'registry.npmjs.org',
            'pypi.org',
            'github.com',
            'api.github.com',
        ],
        trustLevel: 'untrusted', // Default: untrusted
        isContainer: backend === 'container',
        isWSL: backend === 'wsl',
        ...overrides,
    };
}

// ==================== SESSION HEADER ====================

/**
 * Format backend for display
 */
function formatBackend(backend: ExecutionBackend): string {
    switch (backend) {
        case 'windows-host':
            return 'Windows host';
        case 'linux-host':
            return 'Linux host';
        case 'macos-host':
            return 'macOS host';
        case 'wsl':
            return 'WSL (Windows Subsystem for Linux)';
        case 'container':
            return 'Container sandbox';
    }
}

/**
 * Format network policy for display
 */
function formatNetwork(policy: NetworkPolicy, domains: string[]): string {
    switch (policy) {
        case 'off':
            return 'off';
        case 'allowlist':
            return `allowlist (${domains.slice(0, 2).join(', ')}${domains.length > 2 ? '...' : ''})`;
        case 'on':
            return 'unrestricted';
    }
}

/**
 * Format trust level for display
 */
function formatTrust(trust: TrustLevel): string {
    switch (trust) {
        case 'untrusted':
            return chalk.red('untrusted (read-only mode)');
        case 'session':
            return chalk.yellow('session trusted');
        case 'persistent':
            return chalk.green('trusted');
    }
}

/**
 * Display session header
 */
export function displaySessionHeader(env: ExecutionEnvironment): void {
    const boxWidth = 54;
    const topBorder = '╭─ Agdi Terminal Session ' + '─'.repeat(boxWidth - 25) + '╮';
    const bottomBorder = '╰' + '─'.repeat(boxWidth) + '╯';

    const lines = [
        `Exec env:  ${formatBackend(env.backend)}`,
        `Workspace: ${truncatePath(env.workspaceRoot, 40)}`,
        `cwd:       ${truncatePath(env.cwd, 40)}`,
        `Network:   ${formatNetwork(env.networkPolicy, env.allowedDomains)}`,
        `Trust:     ${formatTrust(env.trustLevel)}`,
    ];

    console.log(chalk.cyan(topBorder));
    for (const line of lines) {
        const padding = ' '.repeat(Math.max(0, boxWidth - stripAnsi(line).length - 2));
        console.log(chalk.cyan('│ ') + line + padding + chalk.cyan(' │'));
    }
    console.log(chalk.cyan(bottomBorder));
    console.log('');
}

/**
 * Truncate path for display
 */
function truncatePath(path: string, maxLen: number): string {
    if (path.length <= maxLen) return path;
    return '...' + path.slice(-(maxLen - 3));
}

/**
 * Strip ANSI codes for length calculation
 */
function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex -- ANSI escape codes intentionally include ESC
    return str.replace(/\u001b\[[0-9;]*m/g, '');
}

// ==================== SESSION STATE ====================

let currentEnvironment: ExecutionEnvironment | null = null;

/**
 * Initialize session with environment detection
 */
export function initSession(overrides?: Partial<ExecutionEnvironment>): ExecutionEnvironment {
    currentEnvironment = detectEnvironment(overrides);
    return currentEnvironment;
}

/**
 * Get current environment
 */
export function getEnvironment(): ExecutionEnvironment {
    if (!currentEnvironment) {
        return initSession();
    }
    return currentEnvironment;
}

/**
 * Update environment (e.g., after trust is granted)
 */
export function updateEnvironment(updates: Partial<ExecutionEnvironment>): ExecutionEnvironment {
    currentEnvironment = { ...getEnvironment(), ...updates };
    return currentEnvironment;
}

/**
 * Change current working directory
 */
export function changeCwd(newCwd: string): { success: boolean; error?: string } {
    const env = getEnvironment();
    const resolved = resolve(env.cwd, newCwd);

    // Validate within workspace
    if (!resolved.startsWith(env.workspaceRoot)) {
        return {
            success: false,
            error: `Cannot change to ${resolved}: outside workspace root`,
        };
    }

    // Check if directory exists
    if (!existsSync(resolved)) {
        return {
            success: false,
            error: `Cannot change to ${resolved}: directory does not exist`,
        };
    }

    updateEnvironment({ cwd: resolved });
    return { success: true };
}
