/**
 * Argv Parser - Shell-aware command tokenization
 * 
 * Parses command strings into argv tokens, handles quoting,
 * and detects Windows flags vs file paths.
 */

// ==================== TYPES ====================

export interface ParsedCommand {
    argv: string[];
    command: string;
    args: string[];
    rawCommand: string;
}

export interface PathExtraction {
    path: string;
    operation: 'read' | 'write' | 'unknown';
    position: number;
}

// ==================== WINDOWS FLAG PATTERNS ====================

/**
 * Common Windows command-line flags that look like paths
 * These should NOT be treated as file paths
 */
const WINDOWS_FLAG_PATTERNS = [
    // Single letter flags: /i, /s, /r, /q, etc.
    /^\/[aAbBcCdDeEfFgGhHiIjJkKlLmMnNoOpPqQrRsStTuUvVwWxXyYzZ]$/,
    // Numbered flags: /1, /2, etc.
    /^\/[0-9]+$/,
    // Common multi-char flags
    /^\/(?:all|help|version|quiet|verbose|force|recursive)$/i,
    // findstr flags
    /^\/(?:b|e|l|r|s|i|x|v|n|m|o|p|offline|c|g|f|d|a)$/i,
    // xcopy/robocopy flags
    /^\/(?:e|s|h|k|y|q|f|l|c|v|w|d|u|m|a|t|n|o|x|exclude|copy|move|purge)$/i,
    // dir flags
    /^\/(?:a|b|c|d|l|n|o|p|q|r|s|t|w|x|4)$/i,
];

/**
 * Per-tool argument schemas
 * Maps command names to patterns where args are NOT paths
 */
const TOOL_ARG_SCHEMAS: Record<string, { flags: number[]; notPaths: number[] }> = {
    findstr: { flags: [], notPaths: [] }, // All /x args are flags
    xcopy: { flags: [], notPaths: [] },
    robocopy: { flags: [], notPaths: [] },
    dir: { flags: [], notPaths: [] },
    find: { flags: [], notPaths: [0] }, // First arg is search string
    grep: { flags: [], notPaths: [0] }, // First arg is pattern
    sed: { flags: [], notPaths: [0] }, // First arg is expression
    awk: { flags: [], notPaths: [0] }, // First arg is program
};

// ==================== TOKENIZATION ====================

/**
 * Parse a command string into argv tokens
 * Handles quoting (single, double) and escaping
 */
export function parseArgv(command: string): ParsedCommand {
    const argv: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < command.length; i++) {
        const char = command[i];

        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === '\\' && !inSingleQuote) {
            escaped = true;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            continue;
        }

        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            continue;
        }

        if ((char === ' ' || char === '\t') && !inSingleQuote && !inDoubleQuote) {
            if (current) {
                argv.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (current) {
        argv.push(current);
    }

    return {
        argv,
        command: argv[0] || '',
        args: argv.slice(1),
        rawCommand: command,
    };
}

// ==================== FLAG DETECTION ====================

/**
 * Check if a token is a Windows flag (not a file path)
 */
export function isWindowsFlag(token: string, commandName?: string): boolean {
    // Check explicit patterns
    for (const pattern of WINDOWS_FLAG_PATTERNS) {
        if (pattern.test(token)) {
            return true;
        }
    }

    // Check tool-specific schemas
    if (commandName && TOOL_ARG_SCHEMAS[commandName.toLowerCase()]) {
        // If command has a schema, all /x tokens are likely flags
        if (/^\/[a-zA-Z]/.test(token)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if a token looks like a file path
 */
export function isLikelyPath(token: string, commandName?: string): boolean {
    // Skip if it's a Windows flag
    if (isWindowsFlag(token, commandName)) {
        return false;
    }

    // Skip redirection tokens or inline redirections
    if (token.includes('>') || token.includes('<')) {
        return false;
    }

    // Unix absolute path
    if (token.startsWith('/') && token.length > 1 && token.includes('/')) {
        return true;
    }

    // Windows absolute path
    if (/^[A-Za-z]:[\\/]/.test(token)) {
        return true;
    }

    // Relative path with directory separator
    if (token.includes('/') || token.includes('\\')) {
        return true;
    }

    // Has file extension
    if (/\.[a-zA-Z0-9]{1,6}$/.test(token) && !token.startsWith('-') && !token.startsWith('/')) {
        return true;
    }

    // Special paths
    if (token === '.' || token === '..' || token.startsWith('./') || token.startsWith('../')) {
        return true;
    }

    return false;
}

// ==================== PATH EXTRACTION ====================

/**
 * Commands that write to paths at specific positions
 */
const WRITE_COMMANDS: Record<string, number[]> = {
    // Position of write path(s) in args (0-indexed)
    cp: [1],
    mv: [1],
    touch: [0, 1, 2, 3, 4], // All args
    mkdir: [0, 1, 2, 3, 4],
    rm: [0, 1, 2, 3, 4],
    echo: [], // Only writes with >
    tee: [0],
    sed: [1], // With -i
    tar: [1], // -cf archive
    zip: [0],
    unzip: [], // Uses -d flag
    git: [], // Complex
    npm: [], // Writes to node_modules
    yarn: [],
    pnpm: [],
};

/**
 * Commands that read from paths at specific positions
 */
const READ_COMMANDS: Record<string, number[]> = {
    cat: [0, 1, 2, 3, 4],
    head: [0],
    tail: [0],
    less: [0],
    more: [0],
    grep: [1, 2, 3, 4],
    find: [0],
    ls: [0],
    dir: [0],
    type: [0],
};

/**
 * Extract paths from a parsed command with operation type
 */
export function extractPaths(parsed: ParsedCommand): PathExtraction[] {
    const paths: PathExtraction[] = [];
    const cmd = parsed.command.toLowerCase();

    // Check for output redirection
    const redirections = extractRedirections(parsed.rawCommand);
    for (const path of redirections) {
        paths.push({
            path,
            operation: 'write',
            position: -1,
        });
    }

    // Check args for paths
    for (let i = 0; i < parsed.args.length; i++) {
        const arg = parsed.args[i];
        const prevArg = i > 0 ? parsed.args[i - 1] : '';

        if (/^(?:\d)?>>?$/.test(prevArg)) {
            continue;
        }

        if (!isLikelyPath(arg, cmd)) {
            continue;
        }

        // Determine operation
        let operation: 'read' | 'write' | 'unknown' = 'unknown';

        if (WRITE_COMMANDS[cmd]?.includes(i)) {
            operation = 'write';
        } else if (READ_COMMANDS[cmd]?.includes(i)) {
            operation = 'read';
        }

        paths.push({
            path: arg,
            operation,
            position: i,
        });
    }

    return paths;
}

// ==================== REDIRECTION PARSING ====================

/**
 * Extract output redirection targets (>, >>, 1>, 2>) from a raw command.
 * Skips quoted '>' and file-descriptor redirects like 2>&1.
 */
function extractRedirections(command: string): string[] {
    const targets: string[] = [];
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = 0; i < command.length; i++) {
        const char = command[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char === '\\' && !inSingleQuote) {
            escaped = true;
            continue;
        }

        if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            continue;
        }

        if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            continue;
        }

        if (inSingleQuote || inDoubleQuote) {
            continue;
        }

        if (char !== '>') {
            continue;
        }

        let j = i + 1;
        if (command[j] === '>') {
            j += 1;
        }

        while (j < command.length && /\s/.test(command[j])) {
            j += 1;
        }

        if (j >= command.length || command[j] === '&') {
            continue;
        }

        let token = '';
        const quote = command[j];
        if (quote === "'" || quote === '"') {
            const quoteChar = quote;
            j += 1;
            while (j < command.length && command[j] !== quoteChar) {
                token += command[j];
                j += 1;
            }
        } else {
            while (j < command.length && !/\s/.test(command[j])) {
                if (command[j] === '\\' && j + 1 < command.length) {
                    j += 1;
                }
                token += command[j];
                j += 1;
            }
        }

        if (token) {
            targets.push(token);
        }

        i = Math.max(i, j - 1);
    }

    return [...new Set(targets)];
}

// ==================== NETWORK DETECTION ====================

/**
 * Extract domains from command (for network policy)
 */
export function extractDomains(command: string): string[] {
    const domains: string[] = [];

    // URL pattern
    const urlPattern = /https?:\/\/([a-zA-Z0-9.-]+)/gi;
    let match;
    while ((match = urlPattern.exec(command)) !== null) {
        domains.push(match[1]);
    }

    // Known commands that use network
    const networkCommands = ['curl', 'wget', 'fetch', 'npm', 'yarn', 'pnpm', 'pip', 'git'];
    const parsed = parseArgv(command);

    if (networkCommands.includes(parsed.command.toLowerCase())) {
        // Add default domains for package managers
        if (['npm', 'yarn', 'pnpm'].includes(parsed.command.toLowerCase())) {
            domains.push('registry.npmjs.org');
        }
        if (parsed.command.toLowerCase() === 'pip') {
            domains.push('pypi.org');
        }
    }

    return [...new Set(domains)];
}

// ==================== PORT DETECTION ====================

/**
 * Extract ports from command (for network policy)
 */
export function extractPorts(command: string): number[] {
    const ports: number[] = [];

    // Common port patterns
    const patterns = [
        /-p\s*(\d+)/gi,           // -p 3000
        /--port[=\s]+(\d+)/gi,    // --port 3000 or --port=3000
        /:(\d{2,5})(?:\s|$|\/)/g, // :3000 or localhost:3000
        /PORT[=:]\s*(\d+)/gi,     // PORT=3000
    ];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(command)) !== null) {
            const port = parseInt(match[1], 10);
            if (port > 0 && port <= 65535) {
                ports.push(port);
            }
        }
    }

    return [...new Set(ports)];
}
