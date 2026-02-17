/**
 * Lightweight logger with namespace and level support.
 * Wraps console methods so debug output is silenced in production.
 *
 * Usage:
 *   import { createLogger } from '../logger';
 *   const log = createLogger('Agent');
 *   log.info('boot complete');      // [Agent] boot complete
 *   log.debug('step detail');       // only shown when DEBUG=true
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

function getMinLevel(): LogLevel {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
        return 'warn';
    }
    return 'debug';
}

export interface Logger {
    debug(msg: string, ...args: unknown[]): void;
    info(msg: string, ...args: unknown[]): void;
    warn(msg: string, ...args: unknown[]): void;
    error(msg: string, ...args: unknown[]): void;
}

export function createLogger(namespace: string): Logger {
    const prefix = `[${namespace}]`;
    const minLevel = getMinLevel();

    function shouldLog(level: LogLevel): boolean {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
    }

    return {
        debug(msg, ...args) {
            if (shouldLog('debug')) console.debug(prefix, msg, ...args);
        },
        info(msg, ...args) {
            if (shouldLog('info')) console.log(prefix, msg, ...args);
        },
        warn(msg, ...args) {
            if (shouldLog('warn')) console.warn(prefix, msg, ...args);
        },
        error(msg, ...args) {
            if (shouldLog('error')) console.error(prefix, msg, ...args);
        },
    };
}
