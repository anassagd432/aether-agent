/**
 * Workspace Commands
 * 
 * Slash command handler for /add-dir, /cwd, /directory.
 */

import { workspaceSession } from './session';

// ==================== TYPES ====================

export interface CommandResult {
    success: boolean;
    output: string;
    action?: 'open_picker' | 'trust_prompt';
    data?: unknown;
}

export interface WorkspaceCommandHandler {
    addDir: (path?: string) => CommandResult;
    cwd: (path?: string) => CommandResult;
    directoryShow: () => CommandResult;
    help: () => CommandResult;
}

// ==================== COMMANDS ====================

/**
 * Parse and execute workspace slash commands
 */
export function executeWorkspaceCommand(
    input: string,
    openPicker?: () => void,
    trustPrompt?: (path: string) => void
): CommandResult | null {
    const trimmed = input.trim();

    // Check if it's a slash command
    if (!trimmed.startsWith('/')) {
        return null;
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    switch (command) {
        case 'add-dir':
        case 'adddir':
            return handleAddDir(args[0], openPicker, trustPrompt);

        case 'cwd':
        case 'cd':
            return handleCwd(args[0]);

        case 'directory':
            if (args[0] === 'show' || args[0] === 'list') {
                return handleDirectoryShow();
            }
            if (args[0] === 'add') {
                return handleAddDir(args[1], openPicker, trustPrompt);
            }
            return {
                success: false,
                output: 'Usage: /directory show | /directory add <path>',
            };

        case 'pwd':
            return {
                success: true,
                output: workspaceSession.getCwd(),
            };

        case 'help':
            if (args[0] === 'workspace' || args[0] === 'directory') {
                return handleHelp();
            }
            return null;  // Let other handlers process /help

        default:
            return null;
    }
}

/**
 * /add-dir command
 */
function handleAddDir(
    path?: string,
    openPicker?: () => void,
    trustPrompt?: (path: string) => void
): CommandResult {
    // No path provided - open picker
    if (!path) {
        if (openPicker) {
            openPicker();
            return {
                success: true,
                output: 'Opening folder picker...',
                action: 'open_picker',
            };
        }
        return {
            success: false,
            output: 'Please provide a path: /add-dir <path>',
        };
    }

    // Validate and add path
    const resolved = workspaceSession.resolvePath(path);

    // Check if already a root
    const roots = workspaceSession.getRoots();
    if (roots.some(r => r.path === resolved)) {
        return {
            success: false,
            output: `Folder already added: ${resolved}`,
        };
    }

    // Prompt for trust
    if (trustPrompt) {
        trustPrompt(resolved);
        return {
            success: true,
            output: `Requesting trust for: ${resolved}`,
            action: 'trust_prompt',
            data: { path: resolved },
        };
    }

    // Add as untrusted
    workspaceSession.addRoot(resolved, 'untrusted');
    return {
        success: true,
        output: `Added folder (untrusted): ${resolved}\nUse /trust to enable writes.`,
    };
}

/**
 * /cwd command
 */
function handleCwd(path?: string): CommandResult {
    if (!path) {
        return {
            success: true,
            output: `Current directory: ${workspaceSession.getCwd()}`,
        };
    }

    const result = workspaceSession.changeCwd(path);

    if (result.success) {
        return {
            success: true,
            output: `Changed to: ${result.newCwd}`,
        };
    }

    return {
        success: false,
        output: result.error || `Cannot change to: ${path}\nUse /add-dir first to add this folder.`,
    };
}

/**
 * /directory show command
 */
function handleDirectoryShow(): CommandResult {
    const roots = workspaceSession.getRoots();
    const cwd = workspaceSession.getCwd();
    const activeRoot = workspaceSession.getActiveRoot();

    if (roots.length === 0) {
        return {
            success: true,
            output: 'No workspace folders.\nUse /add-dir to add a folder.',
        };
    }

    const lines = [
        '📁 Workspace Folders:',
        '',
        ...roots.map(r =>
            `  ${r.path === activeRoot ? '→ ' : '  '}${r.path} [${r.trustLevel}]`
        ),
        '',
        `📍 Current directory: ${cwd}`,
    ];

    return {
        success: true,
        output: lines.join('\n'),
    };
}

/**
 * Help command
 */
function handleHelp(): CommandResult {
    return {
        success: true,
        output: `
Workspace Commands:
  /add-dir [path]     Add folder to workspace (opens picker if no path)
  /cwd [path]         Show or change current directory
  /pwd                Show current directory
  /directory show     List all workspace folders
  /directory add      Same as /add-dir

Examples:
  /add-dir            Open folder picker
  /cwd src            Change to src directory
  /directory show     Show workspace roots and cwd
`.trim(),
    };
}

/**
 * Check if input is a workspace command
 */
export function isWorkspaceCommand(input: string): boolean {
    const command = input.trim().toLowerCase();
    return (
        command.startsWith('/add-dir') ||
        command.startsWith('/adddir') ||
        command.startsWith('/cwd') ||
        command.startsWith('/cd') ||
        command.startsWith('/pwd') ||
        command.startsWith('/directory')
    );
}

/**
 * Get workspace command autocompletions
 */
export function getWorkspaceCommandCompletions(partial: string): string[] {
    const commands = [
        '/add-dir',
        '/cwd',
        '/pwd',
        '/directory show',
        '/directory add',
    ];

    if (!partial) return commands;

    return commands.filter(c =>
        c.toLowerCase().startsWith(partial.toLowerCase())
    );
}
