/**
 * Command Parser
 * 
 * Safely parses shell commands into argv arrays.
 * Handles quoting, escaping, and edge cases.
 */

// ==================== PARSE RESULT ====================

export interface ParseResult {
    success: boolean;
    argv: string[];
    error?: string;
}

// ==================== PARSER ====================

/**
 * Parse a shell command into argv array
 * Handles single/double quotes and basic escaping
 */
export function parseCommand(command: string): ParseResult {
    if (!command || typeof command !== 'string') {
        return { success: false, argv: [], error: 'Invalid command' };
    }

    const trimmed = command.trim();
    if (!trimmed) {
        return { success: false, argv: [], error: 'Empty command' };
    }

    try {
        const argv: string[] = [];
        let current = '';
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let escaped = false;

        for (let i = 0; i < trimmed.length; i++) {
            const char = trimmed[i];

            if (escaped) {
                // Handle escaped character
                current += char;
                escaped = false;
                continue;
            }

            if (char === '\\' && !inSingleQuote) {
                // Escape next character (not in single quotes)
                escaped = true;
                continue;
            }

            if (char === "'" && !inDoubleQuote) {
                // Toggle single quote mode
                inSingleQuote = !inSingleQuote;
                continue;
            }

            if (char === '"' && !inSingleQuote) {
                // Toggle double quote mode
                inDoubleQuote = !inDoubleQuote;
                continue;
            }

            if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
                // Word boundary
                if (current) {
                    argv.push(current);
                    current = '';
                }
                continue;
            }

            current += char;
        }

        // Check for unclosed quotes
        if (inSingleQuote || inDoubleQuote) {
            return {
                success: false,
                argv: [],
                error: `Unclosed ${inSingleQuote ? 'single' : 'double'} quote`
            };
        }

        // Add final argument
        if (current) {
            argv.push(current);
        }

        if (argv.length === 0) {
            return { success: false, argv: [], error: 'No command found' };
        }

        return { success: true, argv };

    } catch (error) {
        return {
            success: false,
            argv: [],
            error: error instanceof Error ? error.message : 'Parse error'
        };
    }
}

// ==================== PATH EXTRACTION ====================

/**
 * Extract potential filesystem paths from argv
 */
export function extractPaths(argv: string[]): string[] {
    const paths: string[] = [];
    const pathPattern = /^(\.{0,2}\/|~\/|[A-Za-z]:[\\/])/;

    for (let i = 1; i < argv.length; i++) {
        const arg = argv[i];

        // Skip flags
        if (arg.startsWith('-')) continue;

        // Check if looks like a path
        if (pathPattern.test(arg) ||
            arg.includes('/') ||
            arg.includes('\\') ||
            arg.endsWith('.txt') ||
            arg.endsWith('.json') ||
            arg.endsWith('.js') ||
            arg.endsWith('.ts') ||
            arg.endsWith('.tsx') ||
            arg.endsWith('.md')) {
            paths.push(arg);
        }
    }

    return paths;
}

// ==================== DOMAIN EXTRACTION ====================

/**
 * Extract network domains from command
 */
export function extractDomains(command: string): string[] {
    const domains: string[] = [];

    // URL pattern
    const urlPattern = /https?:\/\/([^/\s:]+)/gi;
    let match;
    while ((match = urlPattern.exec(command)) !== null) {
        if (match[1] && !domains.includes(match[1])) {
            domains.push(match[1]);
        }
    }

    // npm registry special case
    if (command.includes('npm ') || command.includes('npx ')) {
        if (!domains.includes('registry.npmjs.org')) {
            domains.push('registry.npmjs.org');
        }
    }

    return domains;
}

// ==================== COMMAND HASH ====================

/**
 * Generate a hash for command deduplication
 */
export function hashCommand(argv: string[], cwd: string): string {
    const normalized = argv.join('|');
    const input = `${normalized}@${cwd}`;

    // Simple hash (FNV-1a style)
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }

    return Math.abs(hash).toString(36);
}
