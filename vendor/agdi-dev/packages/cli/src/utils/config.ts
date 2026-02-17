/**
 * Configuration Utilities for CLI
 * Stores config in user's home directory with SECURE permissions (0600)
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

export interface Config {
    // API Keys
    geminiApiKey?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    deepseekApiKey?: string;
    openrouterApiKey?: string;
    xaiApiKey?: string;
    // Search API
    searchApiKey?: string;
    searchProvider?: 'brave' | 'perplexity' | 'tavily';
    searchEnabled?: boolean; // Default: true
    searchAutoTrigger?: boolean; // Default: true
    // Deployment Tokens (for autonomous deployment)
    vercelToken?: string;
    netlifyToken?: string;
    railwayToken?: string;
    deploymentProvider?: 'vercel' | 'netlify' | 'railway';
    // Image Generation
    imageProvider?: 'openrouter' | 'nanobanana';
    nanoBananaApiKey?: string;
    nanoBananaBaseUrl?: string;
    // Preferences
    defaultProvider?: string;
    defaultModel?: string;
    ollamaUrl?: string;
    saasBlueprint?: boolean;

    // Advanced (optional)
    semanticSearchEnabled?: boolean; // enable local embeddings via @xenova/transformers
    // Telemetry (opt-in)
    telemetry?: {
        enabled: boolean;
        anonymousId?: string;
        consentAsked?: boolean;
    };
}

const CONFIG_DIR = path.join(os.homedir(), '.agdi');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * File mode 0600 - Read/Write for owner only
 * This prevents other users on the system from reading API keys
 */
const SECURE_FILE_MODE = 0o600;
const SECURE_DIR_MODE = 0o700;

/**
 * Check if file has secure permissions (owner-only)
 */
function checkPermissions(): boolean {
    try {
        if (!fs.existsSync(CONFIG_FILE)) {
            return true; // No file yet, will be created securely
        }

        const stats = fs.statSync(CONFIG_FILE);
        const mode = stats.mode & 0o777; // Get permission bits

        // On Windows, permission model is different
        if (os.platform() === 'win32') {
            return true; // Windows uses ACLs, not Unix permissions
        }

        // Check if file is readable by group or others
        const isWorldReadable = (mode & 0o044) !== 0;

        if (isWorldReadable) {
            console.log(chalk.yellow('\n⚠️  SECURITY WARNING'));
            console.log(chalk.gray('Your config file is readable by other users!'));
            console.log(chalk.gray(`File: ${CONFIG_FILE}`));
            console.log(chalk.gray('Run the following to fix:'));
            console.log(chalk.cyan(`  chmod 600 "${CONFIG_FILE}"\n`));
            return false;
        }

        return true;
    } catch {
        return true;
    }
}

/**
 * Set secure permissions on config file
 */
function setSecurePermissions(): void {
    try {
        if (os.platform() !== 'win32') {
            // Unix-like systems: set 0600 permissions
            fs.chmodSync(CONFIG_DIR, SECURE_DIR_MODE);
            if (fs.existsSync(CONFIG_FILE)) {
                fs.chmodSync(CONFIG_FILE, SECURE_FILE_MODE);
            }
        }
        // Windows: permissions are handled by the OS/ACLs
    } catch (error) {
        // Ignore permission errors on some systems
    }
}

/**
 * Load configuration from disk
 */
export function loadConfig(): Config {
    // Check permissions on startup
    checkPermissions();

    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return fs.readJsonSync(CONFIG_FILE);
        }
    } catch {
        // Ignore errors, return empty config
    }
    return {};
}

/**
 * Save configuration to disk with SECURE permissions
 */
export function saveConfig(config: Config): void {
    try {
        // Ensure directory exists with secure permissions
        fs.ensureDirSync(CONFIG_DIR);

        // Write config file
        fs.writeJsonSync(CONFIG_FILE, config, { spaces: 2 });

        // Set secure permissions (0600 - owner read/write only)
        setSecurePermissions();

    } catch (error) {
        console.error(chalk.red('Failed to save config:'), error);
    }
}

/**
 * Get config directory path
 */
export function getConfigDir(): string {
    return CONFIG_DIR;
}

/**
 * Securely delete config (overwrite before delete)
 */
export function secureDeleteConfig(): void {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            // Overwrite with zeros before deletion
            const size = fs.statSync(CONFIG_FILE).size;
            const zeros = Buffer.alloc(size, 0);
            fs.writeFileSync(CONFIG_FILE, zeros);

            // Now delete
            fs.unlinkSync(CONFIG_FILE);
            console.log(chalk.green('✅ Config securely deleted'));
        }
    } catch (error) {
        console.error(chalk.red('Failed to delete config:'), error);
    }
}
