/**
 * Filesystem Tools
 * 
 * Safe filesystem operations that go through the permission gate.
 */

import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname, relative, isAbsolute } from 'path';
import chalk from 'chalk';

import { getEnvironment } from '../security/execution-env.js';
import { logEvent } from '../security/audit-logger.js';

// ==================== PATH VALIDATION ====================

/**
 * Check if a path is within workspace root
 */
function isWithinWorkspace(p: string, workspaceRoot: string): boolean {
    const resolved = resolve(workspaceRoot, p);
    const root = resolve(workspaceRoot);
    const rel = relative(root, resolved);

    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Validate path is within workspace
 */
function validatePath(path: string): { valid: boolean; resolved: string; error?: string } {
    const env = getEnvironment();
    const resolved = resolve(env.workspaceRoot, path);

    if (!isWithinWorkspace(path, env.workspaceRoot)) {
        return {
            valid: false,
            resolved,
            error: `Path outside workspace: ${path}`,
        };
    }

    return { valid: true, resolved };
}

// ==================== FILESYSTEM TOOLS ====================

/**
 * Create a directory (with parents)
 */
export async function mkdirTool(path: string): Promise<{ success: boolean; error?: string }> {
    const validation = validatePath(path);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    try {
        await mkdir(validation.resolved, { recursive: true });

        logEvent({
            eventType: 'command_result',
            command: `mkdir ${path}`,
            result: { exitCode: 0 },
            metadata: { tool: 'mkdirTool', path: validation.resolved },
        });

        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
    }
}

/**
 * Write a file (creates parent directories)
 */
export async function writeFileTool(
    path: string,
    content: string
): Promise<{ success: boolean; error?: string }> {
    const validation = validatePath(path);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    try {
        // Create parent directories
        const dir = dirname(validation.resolved);
        await mkdir(dir, { recursive: true });

        // Write file
        await writeFile(validation.resolved, content, 'utf-8');

        logEvent({
            eventType: 'command_result',
            command: `writeFile ${path}`,
            result: { exitCode: 0 },
            metadata: {
                tool: 'writeFileTool',
                path: validation.resolved,
                contentLength: content.length,
            },
        });

        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
    }
}

/**
 * Delete a file
 */
export async function deleteFileTool(path: string): Promise<{ success: boolean; error?: string }> {
    const validation = validatePath(path);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    try {
        if (!existsSync(validation.resolved)) {
            return { success: true }; // Already deleted
        }

        await rm(validation.resolved);

        logEvent({
            eventType: 'command_result',
            command: `deleteFile ${path}`,
            result: { exitCode: 0 },
            metadata: { tool: 'deleteFileTool', path: validation.resolved },
        });

        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
    }
}

/**
 * Apply a unified diff patch to a file
 */
export async function applyPatchTool(
    path: string,
    unifiedDiff: string
): Promise<{ success: boolean; error?: string }> {
    const validation = validatePath(path);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    try {
        // Read current content
        const current = existsSync(validation.resolved)
            ? await readFile(validation.resolved, 'utf-8')
            : '';

        // Simple patch application (line-based)
        const patched = applySimplePatch(current, unifiedDiff);

        if (patched === null) {
            return { success: false, error: 'Failed to apply patch' };
        }

        // Write patched content
        await writeFile(validation.resolved, patched, 'utf-8');

        logEvent({
            eventType: 'command_result',
            command: `applyPatch ${path}`,
            result: { exitCode: 0 },
            metadata: {
                tool: 'applyPatchTool',
                path: validation.resolved,
                patchLength: unifiedDiff.length,
            },
        });

        return { success: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
    }
}

/**
 * Simple unified diff patch application
 */
function applySimplePatch(content: string, diff: string): string | null {
    const lines = content.split('\n');
    const diffLines = diff.split('\n');

    let lineIndex = 0;
    const result: string[] = [];

    for (const diffLine of diffLines) {
        // Skip diff headers
        if (diffLine.startsWith('---') || diffLine.startsWith('+++') || diffLine.startsWith('@@')) {
            continue;
        }

        if (diffLine.startsWith('-')) {
            // Remove line - skip it in original
            lineIndex++;
        } else if (diffLine.startsWith('+')) {
            // Add line
            result.push(diffLine.slice(1));
        } else if (diffLine.startsWith(' ') || diffLine === '') {
            // Context line - copy from original
            if (lineIndex < lines.length) {
                result.push(lines[lineIndex]);
                lineIndex++;
            }
        }
    }

    // Add remaining lines
    while (lineIndex < lines.length) {
        result.push(lines[lineIndex]);
        lineIndex++;
    }

    return result.join('\n');
}

/**
 * Get resolved path for a relative path
 */
export function resolvePath(path: string): string {
    const env = getEnvironment();
    return resolve(env.workspaceRoot, path);
}

/**
 * Check if a file exists
 */
export function fileExists(path: string): boolean {
    const resolved = resolvePath(path);
    return existsSync(resolved);
}
