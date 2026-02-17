/**
 * GitManager - Intelligent Git operations for the CLI
 * 
 * Wraps git commands and provides structured output for AI reasoning.
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { getEnvironment } from '../security/execution-env.js';

// ==================== TYPES ====================

export interface GitStatus {
    isGitRepo: boolean;
    branch: string;
    ahead: number;
    behind: number;
    staged: FileChange[];
    unstaged: FileChange[];
    untracked: string[];
    hasConflicts: boolean;
}

export interface FileChange {
    path: string;
    status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
    oldPath?: string; // For renames
}

export interface GitDiff {
    files: DiffFile[];
    summary: string;
}

export interface DiffFile {
    path: string;
    additions: number;
    deletions: number;
    patch: string;
}

// ==================== HELPERS ====================

function debugWarn(message: string, error?: unknown) {
    if (process.env.AGDI_DEBUG === 'true') {
        console.warn(`[GitManager] ${message}`, error ?? '');
    }
}

/**
 * Execute git command and return output
 */
function execGit(args: string[], cwd?: string): string {
    const env = getEnvironment();
    const workDir = cwd || env.workspaceRoot;

    try {
        const result = spawnSync('git', args, {
            cwd: workDir,
            encoding: 'utf-8',
            timeout: 10000,
        });

        if (result.error || result.status !== 0) {
            debugWarn(`git ${args.join(' ')} failed (status=${result.status ?? 'unknown'})`, result.error);
            return '';
        }

        return result.stdout?.trim() || '';
    } catch (error) {
        debugWarn(`git ${args.join(' ')} threw`, error);
        return '';
    }
}

/**
 * Check if directory is a git repository
 */
export function isGitRepo(dir?: string): boolean {
    const env = getEnvironment();
    const checkDir = dir || env.workspaceRoot;
    return existsSync(join(checkDir, '.git'));
}

// ==================== STATUS ====================

/**
 * Get structured git status
 */
export function getStatus(cwd?: string): GitStatus {
    if (!isGitRepo(cwd)) {
        return {
            isGitRepo: false,
            branch: '',
            ahead: 0,
            behind: 0,
            staged: [],
            unstaged: [],
            untracked: [],
            hasConflicts: false,
        };
    }

    const branch = execGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd) || 'main';

    // Get ahead/behind
    let ahead = 0;
    let behind = 0;
    const trackingInfo = execGit(['rev-list', '--left-right', '--count', `origin/${branch}...HEAD`], cwd);
    if (trackingInfo) {
        const [behindStr, aheadStr] = trackingInfo.split(/\s+/);
        behind = parseInt(behindStr, 10) || 0;
        ahead = parseInt(aheadStr, 10) || 0;
    }

    // Get status with porcelain format
    const statusOutput = execGit(['status', '--porcelain=v1'], cwd);
    const staged: FileChange[] = [];
    const unstaged: FileChange[] = [];
    const untracked: string[] = [];
    let hasConflicts = false;

    for (const line of statusOutput.split('\n')) {
        if (!line) continue;

        const indexStatus = line[0];
        const workTreeStatus = line[1];
        const filePath = line.slice(3).trim();

        // Check for conflicts
        if (indexStatus === 'U' || workTreeStatus === 'U' || (indexStatus === 'A' && workTreeStatus === 'A') || (indexStatus === 'D' && workTreeStatus === 'D')) {
            hasConflicts = true;
        }

        // Untracked files
        if (indexStatus === '?' && workTreeStatus === '?') {
            untracked.push(filePath);
            continue;
        }

        // Staged changes
        if (indexStatus !== ' ' && indexStatus !== '?') {
            staged.push({
                path: filePath,
                status: parseStatus(indexStatus),
            });
        }

        // Unstaged changes
        if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
            unstaged.push({
                path: filePath,
                status: parseStatus(workTreeStatus),
            });
        }
    }

    return {
        isGitRepo: true,
        branch,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
        hasConflicts,
    };
}

function parseStatus(code: string): FileChange['status'] {
    switch (code) {
        case 'A': return 'added';
        case 'M': return 'modified';
        case 'D': return 'deleted';
        case 'R': return 'renamed';
        case 'C': return 'copied';
        default: return 'modified';
    }
}

// ==================== DIFF ====================

/**
 * Get structured diff output
 */
export function getDiff(staged: boolean = false, cwd?: string): GitDiff {
    if (!isGitRepo(cwd)) {
        return { files: [], summary: '(not a git repository)' };
    }

    const args = staged ? ['diff', '--cached', '--stat'] : ['diff', '--stat'];
    const statOutput = execGit(args, cwd);

    const patchArgs = staged ? ['diff', '--cached'] : ['diff'];
    const patchOutput = execGit(patchArgs, cwd);

    // Parse stat output
    const files: DiffFile[] = [];
    const statLines = statOutput.split('\n');

    for (const line of statLines) {
        // Match lines like: "src/index.ts | 10 ++++-----"
        const match = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s*([+-]*)/);
        if (match) {
            const [, path, changes, plusMinus] = match;
            const additions = (plusMinus.match(/\+/g) || []).length;
            const deletions = (plusMinus.match(/-/g) || []).length;

            // Extract patch for this file
            const filePatches = patchOutput.split(/^diff --git/m);
            const filePatch = filePatches.find(p => p.includes(path.trim())) || '';

            files.push({
                path: path.trim(),
                additions,
                deletions,
                patch: filePatch.slice(0, 2000), // Limit patch size
            });
        }
    }

    // Build summary
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
    const summary = `${files.length} file(s) changed, ${totalAdditions} insertion(s), ${totalDeletions} deletion(s)`;

    return { files, summary };
}

// ==================== FORMATTING ====================

/**
 * Format git status for display or LLM prompt
 */
export function formatStatusForPrompt(status: GitStatus): string {
    if (!status.isGitRepo) {
        return '(not a git repository)';
    }

    const lines: string[] = [];
    lines.push(`Branch: ${status.branch}`);

    if (status.ahead > 0 || status.behind > 0) {
        lines.push(`Tracking: ${status.ahead} ahead, ${status.behind} behind origin`);
    }

    if (status.hasConflicts) {
        lines.push('⚠️  MERGE CONFLICTS DETECTED');
    }

    if (status.staged.length > 0) {
        lines.push(`\nStaged (${status.staged.length}):`);
        for (const f of status.staged.slice(0, 10)) {
            lines.push(`  ${f.status[0].toUpperCase()} ${f.path}`);
        }
        if (status.staged.length > 10) {
            lines.push(`  ... and ${status.staged.length - 10} more`);
        }
    }

    if (status.unstaged.length > 0) {
        lines.push(`\nUnstaged (${status.unstaged.length}):`);
        for (const f of status.unstaged.slice(0, 10)) {
            lines.push(`  ${f.status[0].toUpperCase()} ${f.path}`);
        }
        if (status.unstaged.length > 10) {
            lines.push(`  ... and ${status.unstaged.length - 10} more`);
        }
    }

    if (status.untracked.length > 0) {
        lines.push(`\nUntracked (${status.untracked.length}):`);
        for (const f of status.untracked.slice(0, 5)) {
            lines.push(`  ? ${f}`);
        }
        if (status.untracked.length > 5) {
            lines.push(`  ... and ${status.untracked.length - 5} more`);
        }
    }

    if (status.staged.length === 0 && status.unstaged.length === 0 && status.untracked.length === 0) {
        lines.push('\n✓ Working tree clean');
    }

    return lines.join('\n');
}

/**
 * Format diff for display or LLM prompt
 */
export function formatDiffForPrompt(diff: GitDiff): string {
    if (diff.files.length === 0) {
        return '(no changes)';
    }

    const lines: string[] = [];
    lines.push(diff.summary);
    lines.push('');

    for (const file of diff.files.slice(0, 5)) {
        lines.push(`### ${file.path}`);
        lines.push(`+${file.additions} -${file.deletions}`);
        if (file.patch) {
            lines.push('```diff');
            lines.push(file.patch.slice(0, 1000));
            if (file.patch.length > 1000) lines.push('... (truncated)');
            lines.push('```');
        }
        lines.push('');
    }

    if (diff.files.length > 5) {
        lines.push(`... and ${diff.files.length - 5} more files`);
    }

    return lines.join('\n');
}
