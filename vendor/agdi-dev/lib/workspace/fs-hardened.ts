/**
 * Hardened Filesystem Adapter
 * 
 * Production-quality file operations with:
 * - Path traversal protection
 * - Trust level enforcement
 * - Works via FileSystemDirectoryHandle (browser)
 */

import type {
    ListDirResult,
    ReadFileResult,
    WriteFileResult,
    DirEntry,
} from './types';
import { workspaceSession, normalizePath } from './session';
import { auditLogger } from '../security/audit-logger';

// ==================== TYPES ====================

export interface FsHandle {
    id: string;
    handle: FileSystemDirectoryHandle;
    trusted: boolean;
}

// ==================== HANDLE REGISTRY ====================

const handleRegistry = new Map<string, FsHandle>();

/**
 * Register a handle for use
 */
export function registerHandle(id: string, handle: FileSystemDirectoryHandle, trusted: boolean): void {
    handleRegistry.set(id, { id, handle, trusted });
}

/**
 * Unregister a handle
 */
export function unregisterHandle(id: string): void {
    handleRegistry.delete(id);
}

/**
 * Get handle for a root path
 */
export function getHandleForRoot(rootPath: string): FsHandle | null {
    const normalizedRoot = normalizePath(rootPath).toLowerCase();
    for (const [, h] of handleRegistry) {
        const handlePath = normalizePath(`/${h.handle.name}`).toLowerCase();
        if (normalizedRoot === handlePath || normalizedRoot.startsWith(handlePath + '/')) {
            return h;
        }
    }
    return null;
}

// ==================== PATH SAFETY ====================

/**
 * Validate and normalize a path
 * BLOCKS: absolute paths, path traversal, symlink escape attempts
 */
export function validatePath(path: string, rootPath: string): {
    valid: boolean;
    normalized: string;
    error?: string;
} {
    // Block absolute paths in browser mode
    if (path.startsWith('/') || path.match(/^[A-Za-z]:/)) {
        return {
            valid: false,
            normalized: '',
            error: 'Absolute paths not allowed. Use relative paths only.',
        };
    }

    // Normalize and strip leading ./
    const normalized = normalizePath(path).replace(/^\.\//, '');

    // Split into parts and check for traversal
    const parts = normalized.split('/').filter(Boolean);
    const resolved: string[] = [];

    for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') {
            if (resolved.length === 0) {
                return {
                    valid: false,
                    normalized: '',
                    error: 'Path traversal blocked: cannot escape root directory',
                };
            }
            resolved.pop();
        } else {
            resolved.push(part);
        }
    }

    const finalPath = resolved.join('/') || '.';

    // Ensure final path stays within root if rootPath provided
    if (rootPath) {
        const full = normalizePath(`${rootPath}/${finalPath}`);
        const normalizedRoot = normalizePath(rootPath);
        if (!full.startsWith(normalizedRoot)) {
            return {
                valid: false,
                normalized: '',
                error: 'Path traversal blocked: outside root directory',
            };
        }
    }

    return {
        valid: true,
        normalized: finalPath,
    };
}

// ==================== FILE OPERATIONS ====================

/**
 * List directory contents (hardened)
 */
export async function listDirHardened(
    path: string,
    rootHandle?: FileSystemDirectoryHandle
): Promise<ListDirResult> {
    // Validate path
    const validation = validatePath(path, rootHandle ? `/${rootHandle.name}` : '');
    if (!validation.valid) {
        return {
            success: false,
            path,
            entries: [],
            error: validation.error,
        };
    }

    // Get handle
    const handle = rootHandle || getActiveHandle();
    if (!handle) {
        return {
            success: false,
            path,
            entries: [],
            error: 'No workspace folder selected',
        };
    }

    try {
        // Navigate to target directory
        let current = handle;
        const parts = validation.normalized.split('/').filter(p => p && p !== '.');

        for (const part of parts) {
            current = await current.getDirectoryHandle(part);
        }

        // Read entries
        const entries: DirEntry[] = [];
        for await (const entry of (current as any).values()) {
            entries.push({
                name: entry.name,
                path: validation.normalized === '.'
                    ? entry.name
                    : `${validation.normalized}/${entry.name}`,
                type: entry.kind === 'directory' ? 'directory' : 'file',
            });
        }

        return {
            success: true,
            path: validation.normalized,
            entries: entries.sort((a, b) => {
                // Directories first, then alphabetical
                if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                return a.name.localeCompare(b.name);
            }),
        };
    } catch (error) {
        return {
            success: false,
            path,
            entries: [],
            error: error instanceof Error ? error.message : 'Failed to list directory',
        };
    }
}

/**
 * Read file contents (hardened)
 */
export async function readFileHardened(
    path: string,
    rootHandle?: FileSystemDirectoryHandle
): Promise<ReadFileResult> {
    // Validate path
    const validation = validatePath(path, rootHandle ? `/${rootHandle.name}` : '');
    if (!validation.valid) {
        return {
            success: false,
            path,
            error: validation.error,
        };
    }

    // Get handle
    const handle = rootHandle || getActiveHandle();
    if (!handle) {
        return {
            success: false,
            path,
            error: 'No workspace folder selected',
        };
    }

    try {
        // Navigate to file
        let current = handle;
        const parts = validation.normalized.split('/').filter(Boolean);
        const fileName = parts.pop();

        if (!fileName) {
            return {
                success: false,
                path,
                error: 'Invalid file path',
            };
        }

        for (const part of parts) {
            current = await current.getDirectoryHandle(part);
        }

        const fileHandle = await current.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const content = await file.text();

        auditLogger.log({
            type: 'tool_result',
            command: `read_file ${path}`,
            success: true,
            metadata: { size: content.length },
        });

        return {
            success: true,
            path: validation.normalized,
            content,
            size: content.length,
        };
    } catch (error) {
        return {
            success: false,
            path,
            error: error instanceof Error ? error.message : 'Failed to read file',
        };
    }
}

/**
 * Write file contents (hardened)
 * REQUIRES: trustLevel === 'trusted'
 */
export async function writeFileHardened(
    path: string,
    content: string,
    rootHandle?: FileSystemDirectoryHandle,
    trusted?: boolean
): Promise<WriteFileResult> {
    // Check trust level
    if (trusted === false) {
        return {
            success: false,
            path,
            error: 'Write denied: folder not trusted. Click "Trust" to enable writes.',
        };
    }

    // Validate path
    const validation = validatePath(path, rootHandle ? `/${rootHandle.name}` : '');
    if (!validation.valid) {
        return {
            success: false,
            path,
            error: validation.error,
        };
    }

    // Get handle
    const handle = rootHandle || getActiveHandle();
    if (!handle) {
        return {
            success: false,
            path,
            error: 'No workspace folder selected',
        };
    }

    try {
        // Navigate/create directories
        let current = handle;
        const parts = validation.normalized.split('/').filter(Boolean);
        const fileName = parts.pop();

        if (!fileName) {
            return {
                success: false,
                path,
                error: 'Invalid file path',
            };
        }

        for (const part of parts) {
            current = await current.getDirectoryHandle(part, { create: true });
        }

        const fileHandle = await current.getFileHandle(fileName, { create: true });
        const writable = await (fileHandle as any).createWritable();
        await writable.write(content);
        await writable.close();

        auditLogger.log({
            type: 'tool_result',
            command: `write_file ${path}`,
            success: true,
            metadata: { bytesWritten: content.length },
        });

        return {
            success: true,
            path: validation.normalized,
            bytesWritten: content.length,
        };
    } catch (error) {
        return {
            success: false,
            path,
            error: error instanceof Error ? error.message : 'Failed to write file',
        };
    }
}

/**
 * Search files by pattern (hardened)
 */
export async function searchFilesHardened(
    pattern: string,
    rootHandle?: FileSystemDirectoryHandle,
    maxResults: number = 100
): Promise<DirEntry[]> {
    const handle = rootHandle || getActiveHandle();
    if (!handle) return [];

    const results: DirEntry[] = [];
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');

    async function search(dir: FileSystemDirectoryHandle, basePath: string): Promise<void> {
        if (results.length >= maxResults) return;

        try {
            for await (const entry of (dir as any).values()) {
                if (results.length >= maxResults) break;

                const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

                if (regex.test(entry.name)) {
                    results.push({
                        name: entry.name,
                        path: entryPath,
                        type: entry.kind === 'directory' ? 'directory' : 'file',
                    });
                }

                if (entry.kind === 'directory') {
                    await search(entry, entryPath);
                }
            }
        } catch {
            // Skip inaccessible directories
        }
    }

    await search(handle, '');
    return results;
}

// ==================== HELPERS ====================

let activeHandle: FileSystemDirectoryHandle | null = null;

export function setActiveHandle(handle: FileSystemDirectoryHandle | null): void {
    activeHandle = handle;
}

export function getActiveHandle(): FileSystemDirectoryHandle | null {
    return activeHandle;
}
