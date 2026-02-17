/**
 * Workspace Trust - Trust management for workspaces
 * 
 * Implements startup trust prompt and persistent trust storage.
 */

import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { homedir } from 'os';
import { updateEnvironment, type TrustLevel } from './execution-env.js';

// ==================== TYPES ====================

interface TrustedWorkspace {
    path: string;
    trustedAt: string;
    normalizedPath: string;
}

interface TrustConfig {
    trustedWorkspaces: TrustedWorkspace[];
}

// ==================== PERSISTENCE ====================

const CONFIG_DIR = join(homedir(), '.agdi');
const TRUST_FILE = join(CONFIG_DIR, 'trusted-workspaces.json');

/**
 * Load trusted workspaces from disk
 */
function loadTrustConfig(): TrustConfig {
    try {
        if (existsSync(TRUST_FILE)) {
            const data = readFileSync(TRUST_FILE, 'utf-8');
            return JSON.parse(data);
        }
    } catch {
        // Ignore errors
    }
    return { trustedWorkspaces: [] };
}

/**
 * Save trusted workspaces to disk
 */
function saveTrustConfig(config: TrustConfig): void {
    try {
        if (!existsSync(CONFIG_DIR)) {
            mkdirSync(CONFIG_DIR, { recursive: true });
        }
        writeFileSync(TRUST_FILE, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('Failed to save trust config:', error);
    }
}

/**
 * Normalize path for comparison
 */
function normalizePath(path: string): string {
    return resolve(path).toLowerCase().replace(/\\/g, '/');
}

// ==================== TRUST CHECKS ====================

/**
 * Check if a workspace is persistently trusted
 */
export function isWorkspaceTrusted(workspacePath: string): boolean {
    const config = loadTrustConfig();
    const normalized = normalizePath(workspacePath);
    return config.trustedWorkspaces.some(w => w.normalizedPath === normalized);
}

/**
 * Get current trust level for a workspace
 */
export function getTrustLevel(workspacePath: string): TrustLevel {
    if (isWorkspaceTrusted(workspacePath)) {
        return 'persistent';
    }
    return 'untrusted';
}

// ==================== TRUST MANAGEMENT ====================

/**
 * Add a workspace to persistent trust
 */
export function trustWorkspace(workspacePath: string): void {
    const config = loadTrustConfig();
    const normalized = normalizePath(workspacePath);

    // Don't add duplicates
    if (config.trustedWorkspaces.some(w => w.normalizedPath === normalized)) {
        return;
    }

    config.trustedWorkspaces.push({
        path: workspacePath,
        normalizedPath: normalized,
        trustedAt: new Date().toISOString(),
    });

    saveTrustConfig(config);
}

/**
 * Remove a workspace from persistent trust
 */
export function untrustWorkspace(workspacePath: string): void {
    const config = loadTrustConfig();
    const normalized = normalizePath(workspacePath);

    config.trustedWorkspaces = config.trustedWorkspaces.filter(
        w => w.normalizedPath !== normalized
    );

    saveTrustConfig(config);
}

/**
 * List all trusted workspaces
 */
export function listTrustedWorkspaces(): TrustedWorkspace[] {
    return loadTrustConfig().trustedWorkspaces;
}

// ==================== TRUST PROMPT ====================

export type TrustChoice = 'session' | 'persistent' | 'exit';

/**
 * Display trust prompt and return user choice
 */
export async function promptWorkspaceTrust(workspacePath: string): Promise<TrustChoice> {
    // Check if already trusted
    if (isWorkspaceTrusted(workspacePath)) {
        console.log(chalk.green('✓ Workspace is trusted\n'));
        return 'persistent';
    }

    console.log(chalk.yellow('\n⚠️  Untrusted Workspace'));
    console.log(chalk.gray(`   ${workspacePath}\n`));
    console.log(chalk.gray('Agdi can run commands in this workspace.'));
    console.log(chalk.gray('Do you trust the contents of this folder?\n'));

    const choice = await select({
        message: 'Trust this workspace?',
        choices: [
            {
                name: 'Trust for this session only',
                value: 'session' as TrustChoice,
                description: 'Allow commands for this session, ask again next time',
            },
            {
                name: 'Trust and remember',
                value: 'persistent' as TrustChoice,
                description: 'Always trust this workspace',
            },
            {
                name: 'Exit (don\'t trust)',
                value: 'exit' as TrustChoice,
                description: 'Exit without granting trust',
            },
        ],
    });

    return choice;
}

/**
 * Handle trust flow and update environment
 */
export async function handleTrustFlow(workspacePath: string): Promise<TrustLevel | null> {
    const choice = await promptWorkspaceTrust(workspacePath);

    switch (choice) {
        case 'session':
            updateEnvironment({ trustLevel: 'session' });
            console.log(chalk.green('✓ Trusted for this session\n'));
            return 'session';

        case 'persistent':
            trustWorkspace(workspacePath);
            updateEnvironment({ trustLevel: 'persistent' });
            console.log(chalk.green('✓ Workspace trusted and remembered\n'));
            return 'persistent';

        case 'exit':
            console.log(chalk.yellow('\n👋 Exiting. Workspace not trusted.\n'));
            return null;
    }
}

/**
 * Check trust and prompt if needed
 * Returns true if trusted (session or persistent), false if user declined
 */
export async function ensureTrusted(workspacePath: string): Promise<boolean> {
    // Check persistent trust
    if (isWorkspaceTrusted(workspacePath)) {
        updateEnvironment({ trustLevel: 'persistent' });
        return true;
    }

    // Prompt user
    const result = await handleTrustFlow(workspacePath);
    return result !== null;
}
