/**
 * Shell Wrapper Detector
 * 
 * Detects shell wrapper commands (bash -c, sh -c, cmd /c, etc.)
 * and evaluates embedded scripts for security.
 */

import { parseArgv } from './argv-parser.js';

// ==================== TYPES ====================

export interface ShellWrapperResult {
    isWrapper: boolean;
    wrapperType?: 'bash' | 'sh' | 'zsh' | 'cmd' | 'powershell' | 'pwsh';
    embeddedScript?: string;
    subCommands?: string[];
    isComplex: boolean;
}

// ==================== WRAPPER PATTERNS ====================

/**
 * Shell wrapper detection patterns
 */
const SHELL_WRAPPERS: Record<string, { patterns: RegExp[]; extractScript: (argv: string[]) => string | undefined }> = {
    bash: {
        patterns: [/^bash$/i],
        extractScript: (argv) => {
            const cIdx = argv.findIndex(a => a === '-c' || a === '-lc');
            return cIdx !== -1 && argv[cIdx + 1] ? argv[cIdx + 1] : undefined;
        },
    },
    sh: {
        patterns: [/^sh$/i],
        extractScript: (argv) => {
            const cIdx = argv.findIndex(a => a === '-c');
            return cIdx !== -1 && argv[cIdx + 1] ? argv[cIdx + 1] : undefined;
        },
    },
    zsh: {
        patterns: [/^zsh$/i],
        extractScript: (argv) => {
            const cIdx = argv.findIndex(a => a === '-c');
            return cIdx !== -1 && argv[cIdx + 1] ? argv[cIdx + 1] : undefined;
        },
    },
    cmd: {
        patterns: [/^cmd$/i, /^cmd\.exe$/i],
        extractScript: (argv) => {
            const cIdx = argv.findIndex(a => a.toLowerCase() === '/c' || a.toLowerCase() === '/k');
            return cIdx !== -1 ? argv.slice(cIdx + 1).join(' ') : undefined;
        },
    },
    powershell: {
        patterns: [/^powershell$/i, /^powershell\.exe$/i],
        extractScript: (argv) => {
            const cIdx = argv.findIndex(a =>
                a.toLowerCase() === '-command' ||
                a.toLowerCase() === '-c' ||
                a.toLowerCase() === '-encodedcommand' ||
                a.toLowerCase() === '-e'
            );
            return cIdx !== -1 && argv[cIdx + 1] ? argv[cIdx + 1] : undefined;
        },
    },
    pwsh: {
        patterns: [/^pwsh$/i, /^pwsh\.exe$/i],
        extractScript: (argv) => {
            const cIdx = argv.findIndex(a =>
                a.toLowerCase() === '-command' ||
                a.toLowerCase() === '-c'
            );
            return cIdx !== -1 && argv[cIdx + 1] ? argv[cIdx + 1] : undefined;
        },
    },
};

// ==================== COMPLEXITY DETECTION ====================

/**
 * Patterns that indicate a complex script (not safely splittable)
 */
const COMPLEX_SCRIPT_PATTERNS = [
    /\bif\b.*\bthen\b/i,          // if-then
    /\bfor\b.*\bdo\b/i,           // for loops
    /\bwhile\b.*\bdo\b/i,         // while loops
    /\bfunction\b/i,              // function definitions
    /\$\(/,                       // command substitution
    /`[^`]+`/,                    // backtick substitution
    /\|\|/,                       // OR chain
    /&&.*&&/,                     // multiple AND chains
    /\beval\b/i,                  // eval
    /\bexec\b/i,                  // exec
    /\bsource\b/i,                // source
    /\.\s+\//,                    // dot source
    /<<[<-]?\s*[A-Z]+/,           // heredocs
];

/**
 * Check if a script is complex (hard to split safely)
 */
function isComplexScript(script: string): boolean {
    return COMPLEX_SCRIPT_PATTERNS.some(pattern => pattern.test(script));
}

/**
 * Split a simple script into individual commands
 * Only works for scripts joined by ; or single &&
 */
function splitSimpleScript(script: string): string[] | null {
    // Don't split if complex
    if (isComplexScript(script)) {
        return null;
    }

    // Split by ; or single &&
    const commands: string[] = [];

    // Try splitting by semicolon first
    const semiParts = script.split(/\s*;\s*/);
    if (semiParts.length > 1) {
        for (const part of semiParts) {
            const trimmed = part.trim();
            if (trimmed) {
                commands.push(trimmed);
            }
        }
        return commands;
    }

    // Try splitting by &&
    const andParts = script.split(/\s*&&\s*/);
    if (andParts.length > 1 && andParts.length <= 3) {
        for (const part of andParts) {
            const trimmed = part.trim();
            if (trimmed) {
                commands.push(trimmed);
            }
        }
        return commands;
    }

    // Single command
    return [script.trim()];
}

// ==================== MAIN DETECTION ====================

/**
 * Detect if a command is a shell wrapper and analyze it
 */
export function detectShellWrapper(argv: string[]): ShellWrapperResult {
    if (argv.length === 0) {
        return { isWrapper: false, isComplex: false };
    }

    const cmd = argv[0];

    for (const [wrapperType, config] of Object.entries(SHELL_WRAPPERS)) {
        for (const pattern of config.patterns) {
            if (pattern.test(cmd)) {
                const script = config.extractScript(argv);

                if (!script) {
                    // Wrapper without -c flag (e.g., interactive shell)
                    return {
                        isWrapper: true,
                        wrapperType: wrapperType as ShellWrapperResult['wrapperType'],
                        isComplex: true, // Treat interactive shells as complex
                    };
                }

                const isComplex = isComplexScript(script);
                const subCommands = splitSimpleScript(script);

                return {
                    isWrapper: true,
                    wrapperType: wrapperType as ShellWrapperResult['wrapperType'],
                    embeddedScript: script,
                    subCommands: subCommands || undefined,
                    isComplex,
                };
            }
        }
    }

    return { isWrapper: false, isComplex: false };
}

/**
 * Get the most restrictive risk tier from multiple commands
 */
export function getMostRestrictiveTier(tiers: number[]): number {
    return Math.max(...tiers, 0);
}

/**
 * Check if a shell wrapper should be treated as Tier 3
 */
export function isHighRiskWrapper(result: ShellWrapperResult): boolean {
    // Complex scripts are always high risk
    if (result.isComplex) {
        return true;
    }

    // Encoded commands are high risk (potential obfuscation)
    if (result.embeddedScript?.includes('encodedcommand')) {
        return true;
    }

    return false;
}
