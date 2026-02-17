/**
 * Agdi CLI Logger & Branding
 * Features:
 * - Namespace logging with colors
 * - Gradient Brand Headers
 * - Agent-specific output tags
 * - Technical/Cyberpunk styling
 */

import chalk from 'chalk';
import gradient from 'gradient-string';

// ==================== BRANDING & COLORS ====================

// "Agdi White" → "Agdi Blue" gradient (matches landing: white + blue/cyan)
const AGDI_GRADIENT = gradient(['#ffffff', '#38bdf8', '#22d3ee']);

// Brand Theme
const THEME = {
    cyan: chalk.hex('#22d3ee'),
    blue: chalk.hex('#38bdf8'),
    green: chalk.hex('#4ade80'),
    yellow: chalk.hex('#facc15'),
    red: chalk.hex('#f87171'),
    gray: chalk.hex('#94a3b8'),
    dark: chalk.hex('#475569'),
};

// ==================== HEADER ====================

export function printBrandHeader(subtitle?: string) {
    const logo = `
    █████╗  ██████╗ ██████╗ ██╗
   ██╔══██╗██╔════╝ ██╔══██╗██║
   ███████║██║  ███╗██║  ██║██║
   ██╔══██║██║   ██║██║  ██║██║
   ██║  ██║╚██████╔╝██████╔╝██║
   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝
`;
    console.log('\n' + AGDI_GRADIENT(logo));
    if (subtitle) {
        console.log(THEME.gray(`   ${subtitle}\n`));
    }
}

// ==================== AGENT TAGS ====================

// Agent personas matching the web visualizer
export const AgentTags = {
    SYSTEM: (msg: string) => console.log(`${THEME.dark('[SYSTEM]')} ${THEME.gray(msg)}`),
    ARCHITECT: (msg: string) => console.log(`${THEME.cyan('[ARCHITECT]')} ${THEME.gray(msg)}`),
    ENGINEER: (msg: string) => console.log(`${THEME.blue('[ENGINEER]')} ${THEME.gray(msg)}`),
    QA: (msg: string) => console.log(`${THEME.green('[QA BOT]')}   ${THEME.gray(msg)}`),
    DEVOPS: (msg: string) => console.log(`${THEME.yellow('[DEVOPS]')}   ${THEME.gray(msg)}`),
    SECURITY: (msg: string) => console.log(`${THEME.red('[SECURITY]')} ${THEME.gray(msg)}`),
};

// ==================== LOGGER ====================

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    success: 1,
    warn: 2,
    error: 3,
};

function getMinLevel(): LogLevel {
    if (process.env.NODE_ENV === 'production') return 'info';
    return 'debug';
}

export interface Logger {
    debug(msg: string, ...args: unknown[]): void;
    info(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
    success(msg: string, ...args: unknown[]): void;
}

export function createLogger(namespace: string): Logger {
    const prefix = THEME.dark(`[${namespace}]`);
    const minLevel = getMinLevel();

    function shouldLog(level: LogLevel): boolean {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
    }

    return {
        debug(msg, ...args) {
            if (shouldLog('debug')) console.debug(prefix, THEME.dark(msg), ...args);
        },
        info(msg, ...args) {
            if (shouldLog('info')) console.log(prefix, THEME.cyan(msg), ...args);
        },
        success(msg, ...args) {
            if (shouldLog('success')) console.log(prefix, THEME.green(msg), ...args);
        },
        warn(msg, ...args) {
            if (shouldLog('warn')) console.warn(prefix, THEME.yellow(msg), ...args);
        },
        error(msg, ...args) {
            if (shouldLog('error')) console.error(prefix, THEME.red(msg), ...args);
        },
    };
}
