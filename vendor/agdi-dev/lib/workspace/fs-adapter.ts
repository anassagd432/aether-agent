/**
 * Filesystem Adapter
 * 
 * Provides file operations with workspace validation.
 * Works in browser via WebContainer or stubs.
 */

import type {
    ListDirResult,
    ReadFileResult,
    WriteFileResult,
    DirEntry,
} from './types';
import { workspaceSession, canonicalizePath } from './session';
import { auditLogger } from '../security/audit-logger';

// ==================== BROWSER DETECTION ====================

const isBrowser = typeof window !== 'undefined';

// ==================== WEBCONTAINER INTEGRATION ====================

let webContainerInstance: any = null;

/**
 * Set WebContainer instance for browser file operations
 */
export function setWebContainer(container: any): void {
    webContainerInstance = container;
}

// ==================== FILE OPERATIONS ====================

/**
 * List directory contents
 */
export async function listDir(path: string): Promise<ListDirResult> {
    const resolved = workspaceSession.resolvePath(path);
    const validation = workspaceSession.validatePath(resolved);

    if (!validation.valid || !validation.withinWorkspace) {
        return {
            success: false,
            path: resolved,
            entries: [],
            error: validation.error || 'Path outside workspace',
        };
    }

    try {
        if (isBrowser && webContainerInstance) {
            // Use WebContainer
            const entries = await listDirWebContainer(resolved);
            return {
                success: true,
                path: resolved,
                entries,
            };
        } else {
            // Stub for non-browser
            return {
                success: false,
                path: resolved,
                entries: [],
                error: 'Filesystem not available in this environment',
            };
        }
    } catch (error) {
        return {
            success: false,
            path: resolved,
            entries: [],
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * List directory using WebContainer
 */
function debugWarn(message: string, error?: unknown) {
    if (process.env.AGDI_DEBUG === 'true') {
        console.warn(`[FSAdapter] ${message}`, error ?? '');
    }
}

async function listDirWebContainer(path: string): Promise<DirEntry[]> {
    if (!webContainerInstance) return [];

    try {
        const entries = await webContainerInstance.fs.readdir(path, { withFileTypes: true });
        const result: DirEntry[] = [];

        for (const entry of entries) {
            const entryPath = `${path}/${entry.name}`;
            result.push({
                name: entry.name,
                path: entryPath,
                type: entry.isDirectory() ? 'directory' : 'file',
            });
        }

        return result;
    } catch (error) {
        debugWarn(`WebContainer readdir failed for ${path}`, error);
        return [];
    }
}

/**
 * Read file contents
 */
export async function readFile(path: string): Promise<ReadFileResult> {
    const resolved = workspaceSession.resolvePath(path);
    const validation = workspaceSession.validatePath(resolved);

    if (!validation.valid || !validation.withinWorkspace) {
        return {
            success: false,
            path: resolved,
            error: validation.error || 'Path outside workspace',
        };
    }

    try {
        if (isBrowser && webContainerInstance) {
            const content = await webContainerInstance.fs.readFile(resolved, 'utf-8');
            return {
                success: true,
                path: resolved,
                content,
                size: content.length,
            };
        } else {
            return {
                success: false,
                path: resolved,
                error: 'Filesystem not available',
            };
        }
    } catch (error) {
        return {
            success: false,
            path: resolved,
            error: error instanceof Error ? error.message : 'Failed to read file',
        };
    }
}

/**
 * Write file contents
 */
export async function writeFile(
    path: string,
    content: string,
    mode: 'create' | 'overwrite' | 'append' = 'overwrite'
): Promise<WriteFileResult> {
    const resolved = workspaceSession.resolvePath(path);
    const validation = workspaceSession.validatePath(resolved);

    if (!validation.valid || !validation.withinWorkspace) {
        return {
            success: false,
            path: resolved,
            error: validation.error || 'Path outside workspace',
        };
    }

    // Check if root is trusted
    if (validation.root && !workspaceSession.isRootTrusted(validation.root)) {
        return {
            success: false,
            path: resolved,
            error: 'Workspace is not trusted. Trust the workspace first.',
        };
    }

    try {
        if (isBrowser && webContainerInstance) {
            // Ensure directory exists
            const dir = resolved.split('/').slice(0, -1).join('/');
            if (dir) {
                try {
                    await webContainerInstance.fs.mkdir(dir, { recursive: true });
                } catch (error) {
                    // Directory might exist
                    debugWarn(`WebContainer mkdir failed for ${dir}`, error);
                }
            }

            await webContainerInstance.fs.writeFile(resolved, content);

            auditLogger.log({
                type: 'tool_result',
                command: `write_file ${resolved}`,
                success: true,
                metadata: { bytesWritten: content.length },
            });

            return {
                success: true,
                path: resolved,
                bytesWritten: content.length,
            };
        } else {
            return {
                success: false,
                path: resolved,
                error: 'Filesystem not available',
            };
        }
    } catch (error) {
        return {
            success: false,
            path: resolved,
            error: error instanceof Error ? error.message : 'Failed to write file',
        };
    }
}

/**
 * Check if path exists
 */
export async function exists(path: string): Promise<boolean> {
    const resolved = workspaceSession.resolvePath(path);

    if (isBrowser && webContainerInstance) {
        try {
            await webContainerInstance.fs.readdir(resolved);
            return true;
        } catch {
            try {
                await webContainerInstance.fs.readFile(resolved);
                return true;
            } catch {
                return false;
            }
        }
    }
    return false;
}

/**
 * Create directory
 */
export async function mkdir(path: string, recursive: boolean = true): Promise<boolean> {
    const resolved = workspaceSession.resolvePath(path);
    const validation = workspaceSession.validatePath(resolved);

    if (!validation.valid || !validation.withinWorkspace) {
        return false;
    }

    if (isBrowser && webContainerInstance) {
        try {
            await webContainerInstance.fs.mkdir(resolved, { recursive });
            return true;
        } catch {
            return false;
        }
    }
    return false;
}

/**
 * Search files by pattern
 */
export async function searchFiles(
    pattern: string,
    root?: string
): Promise<DirEntry[]> {
    const searchRoot = root
        ? workspaceSession.resolvePath(root)
        : workspaceSession.getCwd();

    const validation = workspaceSession.validatePath(searchRoot);
    if (!validation.valid) return [];

    // Simple recursive search
    const results: DirEntry[] = [];
    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');

    async function searchDir(dir: string): Promise<void> {
        const listResult = await listDir(dir);
        if (!listResult.success) return;

        for (const entry of listResult.entries) {
            if (regex.test(entry.name)) {
                results.push(entry);
            }
            if (entry.type === 'directory' && results.length < 100) {
                await searchDir(entry.path);
            }
        }
    }

    await searchDir(searchRoot);
    return results;
}
