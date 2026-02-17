/**
 * UI Utility - Cinematic Dark Mode Design System
 * 
 * Centralized design tokens and components for the CLI v2.6
 */

import chalk from 'chalk';
import gradient from 'gradient-string';
import boxen, { Options as BoxenOptions } from 'boxen';
import figlet from 'figlet';
import ora, { Ora } from 'ora';

// ==================== THEME TOKENS ====================

const THEME = {
    cyan: '#06b6d4',      // Cyan-500
    purple: '#8b5cf6',    // Violet-500
    red: '#ef4444',       // Red-500
    yellow: '#eab308',    // Yellow-500
    gray: '#71717a',      // Zinc-500
    dim: '#52525b',       // Zinc-600
};

// Gradients
const brandGradient = gradient([THEME.cyan, THEME.purple]);
const errorGradient = gradient([THEME.red, '#b91c1c']);
const goldGradient = gradient([THEME.yellow, '#fbbf24']);

// ==================== COMPONENTS ====================

/**
 * Render the Startup "Neon Banner"
 */
export async function renderBanner(version: string = 'v2.6.0') {
    console.clear();

    // Figlet Text
    const text = await new Promise<string>((resolve) => {
        figlet('AGDI', { font: 'Slant' }, (err, data) => {
            resolve(data || 'AGDI');
        });
    });

    console.log(brandGradient.multiline(text));
    console.log(chalk.hex(THEME.dim)(`      ${version} [ARCHITECT ONLINE]\n`));
}

/**
 * Render a "Glass Card" box
 */
export function renderBox(title: string, content: string, style: 'info' | 'success' | 'warning' | 'error' = 'info') {
    let borderColor = THEME.cyan;
    let titleColor = chalk.cyan;

    if (style === 'success') {
        borderColor = THEME.cyan; // Keeping consistent brand color for success/info usually
    } else if (style === 'warning') {
        borderColor = THEME.yellow;
        titleColor = chalk.yellow;
    } else if (style === 'error') {
        borderColor = THEME.red;
        titleColor = chalk.red;
    }

    const box = boxen(content, {
        title: titleColor.bold(title),
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: borderColor,
        dimBorder: false,
        float: 'left',
    });

    console.log(box);
}

/**
 * Render the "Security Gate" Alert
 */
export function renderAlert(title: string, message: string) {
    console.log('');
    const box = boxen(chalk.white(message), {
        title: chalk.red.bold(`🛡️  ${title.toUpperCase()}  `),
        padding: 1,
        borderStyle: 'double',
        borderColor: 'red',
        textAlignment: 'center',
    });
    console.log(box);
    console.log('');
}

/**
 * Print User Interaction Bubble
 */
export function printUserMessage(message: string) {
    console.log('');
    console.log(chalk.cyan.bold('👤 YOU › ') + chalk.white(message));
    console.log('');
}

/**
 * Print AI Interaction Bubble
 */
export function printAIMessage(message: string) {
    console.log('');
    console.log(brandGradient.multiline('⚡ AGDI › ')); // Gradient prefix
    // console.log(chalk.hex(THEME.purple).bold('⚡ AGDI › ') + message); // Or simple color
    console.log(message.trim());
    console.log('');
}

/**
 * Spinner Factory
 */
export function createSpinner(text: string): Ora {
    return ora({
        text: chalk.hex(THEME.gray)(text),
        color: 'cyan',
        spinner: 'dots',
        discardStdin: false, // Important for allowing interruption if needed
    });
}

/**
 * Separator
 */
export function printIter() {
    console.log(chalk.hex(THEME.dim)('──────────────────────────────────────────────────'));
}

// ==================== PROCESS SAFETY ====================

/**
 * Active readline interface tracker for safe cleanup
 */
let activeReadlineInterface: NodeJS.ReadableStream | null = null;

/**
 * Register the active readline interface for cleanup
 */
export function registerActivePrompt(rl: NodeJS.ReadableStream | null) {
    activeReadlineInterface = rl;
}

/**
 * Global flags for headless/automation mode
 */
export const flags = {
    yes: false,
    headless: false,
    minimal: false,
    dryRun: false,
    saas: false,
};

/**
 * Set global flags (called from CLI argument parsing)
 */
export function setFlags(newFlags: Partial<typeof flags>) {
    Object.assign(flags, newFlags);
}

/**
 * Custom error to signal graceful exit without stack trace dump
 */
export class GracefulExitError extends Error {
    constructor() {
        super('Process exiting');
        this.name = 'GracefulExitError';
    }
}

/**
 * Safe Exit - Properly tears down libuv handles before exiting
 * 
 * Fixes UV_HANDLE_CLOSING crash on Windows when readline is active.
 * Uses setImmediate to allow one event loop tick for handle cleanup.
 */
export function safeExit(code: number = 0): never {
    // Attempt to close any active readline interface
    if (activeReadlineInterface) {
        try {
            // Force close the readline interface
            (activeReadlineInterface as any).close?.();
            (activeReadlineInterface as any).destroy?.();
        } catch {
            // Ignore errors during cleanup
        }
        activeReadlineInterface = null;
    }

    // Allow one event loop tick for libuv handle cleanup
    setImmediate(() => {
        process.exit(code);
    });

    // Throw specific error to stop execution flow immediately
    // Top-level handler in index.ts should catch and ignore this
    throw new GracefulExitError();
}

/**
 * Smart Confirm - Handles headless/CI environments gracefully
 * 
 * Returns true immediately if --yes flag or CI env is set.
 * Returns false (fail-safe) if non-interactive and no --yes flag.
 */
export async function smartConfirm(message: string, defaultValue: boolean = false): Promise<boolean> {
    // Headless mode: auto-approve
    if (flags.yes || flags.headless || process.env.CI === 'true' || process.env.CI === '1') {
        console.log(chalk.gray(`  [Auto-approved: ${message}]`));
        return true;
    }

    // Non-TTY detection: fail-safe
    if (!process.stdout.isTTY) {
        console.warn(chalk.yellow('⚠️  Non-interactive session detected. Use --yes to approve actions.'));
        return false;
    }

    // Interactive mode: use inquirer
    const { confirm } = await import('@inquirer/prompts');
    return confirm({ message, default: defaultValue });
}

/**
 * Smart Select - Handles headless/CI environments gracefully
 */
export async function smartSelect<T extends string>(
    message: string,
    choices: { name: string; value: T }[],
    defaultValue?: T
): Promise<T | null> {
    // Non-TTY: return default or first choice
    if (!process.stdout.isTTY || flags.headless) {
        const result = defaultValue || choices[0]?.value;
        if (result) {
            console.log(chalk.gray(`  [Auto-selected: ${result}]`));
        }
        return result || null;
    }

    const { select } = await import('@inquirer/prompts');
    return select({ message, choices });
}

export const ui = {
    renderBanner,
    renderBox,
    renderAlert,
    printUserMessage,
    printAIMessage,
    createSpinner,
    printIter,
    brandGradient,
    THEME,
    // Safety & Automation
    safeExit,
    smartConfirm,
    smartSelect,
    setFlags,
    flags,
    registerActivePrompt,
};

