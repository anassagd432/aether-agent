/**
 * ContextManager - Gathers workspace context for LLM prompts
 * 
 * Provides structured workspace information to make the AI "aware"
 * of the current project state.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { getEnvironment } from '../security/execution-env.js';

// ==================== TYPES ====================

export interface WorkspaceContext {
    workspaceRoot: string;
    fileTree: string;
    projectConfig: ProjectConfig | null;
    gitStatus: string | null;
}

export interface ProjectConfig {
    name: string;
    version?: string;
    description?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

// ==================== CONSTANTS ====================

/**
 * Files to always ignore when building file tree
 */
const IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.cache',
    'coverage',
    '__pycache__',
    '.venv',
    'venv',
    '.idea',
    '.vscode',
    '.turbo',
]);

const IGNORED_FILES = new Set([
    '.DS_Store',
    'Thumbs.db',
    '.env',
    '.env.local',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
]);

function debugWarn(message: string, error?: unknown) {
    if (process.env.AGDI_DEBUG === 'true') {
        console.warn(`[ContextManager] ${message}`, error ?? '');
    }
}

/**
 * Key files to read and summarize for context
 */
const KEY_FILES = [
    'package.json',
    'tsconfig.json',
    'README.md',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod',
];

const MAX_TREE_DEPTH = 4;
const MAX_FILES_PER_DIR = 20;
const MAX_TREE_BYTES = 20000;

// ==================== FILE TREE ====================

/**
 * Build a formatted file tree string
 */
export function getWorkspaceTree(rootDir?: string, maxDepth: number = MAX_TREE_DEPTH): string {
    const env = getEnvironment();
    const root = rootDir || env.workspaceRoot;

    if (!existsSync(root)) {
        return '(workspace not found)';
    }

    const lines: string[] = [];
    lines.push(basename(root) + '/');

    buildTree(root, '', lines, 0, maxDepth);

    const tree = lines.join('\n');
    if (tree.length > MAX_TREE_BYTES) {
        return tree.slice(0, MAX_TREE_BYTES) + '\n...[truncated]';
    }
    return tree;
}

function buildTree(
    dir: string,
    prefix: string,
    lines: string[],
    depth: number,
    maxDepth: number
): void {
    if (depth >= maxDepth) {
        lines.push(prefix + '└── ...');
        return;
    }

    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch (error) {
        debugWarn(`Failed to read directory: ${dir}`, error);
        return;
    }

    // Filter and sort entries
    const filtered = entries.filter(e => {
        if (IGNORED_DIRS.has(e) || IGNORED_FILES.has(e)) return false;
        if (e.startsWith('.') && e !== '.github') return false;
        return true;
    });

    // Separate dirs and files, sort alphabetically
    const dirs: string[] = [];
    const files: string[] = [];

    for (const entry of filtered) {
        const fullPath = join(dir, entry);
        try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
                dirs.push(entry);
            } else {
                files.push(entry);
            }
        } catch {
            // Skip inaccessible entries
        }
    }

    dirs.sort();
    files.sort();

    const allEntries = [...dirs.map(d => ({ name: d, isDir: true })), ...files.map(f => ({ name: f, isDir: false }))];

    // Limit entries per directory
    const truncated = allEntries.length > MAX_FILES_PER_DIR;
    const toShow = truncated ? allEntries.slice(0, MAX_FILES_PER_DIR) : allEntries;

    toShow.forEach((entry, index) => {
        const isLast = index === toShow.length - 1 && !truncated;
        const connector = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';

        if (entry.isDir) {
            lines.push(prefix + connector + entry.name + '/');
            buildTree(join(dir, entry.name), prefix + childPrefix, lines, depth + 1, maxDepth);
        } else {
            lines.push(prefix + connector + entry.name);
        }
    });

    if (truncated) {
        lines.push(prefix + '└── ... (' + (allEntries.length - MAX_FILES_PER_DIR) + ' more)');
    }
}

// ==================== PROJECT CONFIG ====================

/**
 * Read and parse package.json or equivalent
 */
export function getProjectConfig(rootDir?: string): ProjectConfig | null {
    const env = getEnvironment();
    const root = rootDir || env.workspaceRoot;

    const packageJsonPath = join(root, 'package.json');

    if (existsSync(packageJsonPath)) {
        try {
            const content = readFileSync(packageJsonPath, 'utf-8');
            const pkg = JSON.parse(content);
            return {
                name: pkg.name || basename(root),
                version: pkg.version,
                description: pkg.description,
                dependencies: pkg.dependencies,
                devDependencies: pkg.devDependencies,
                scripts: pkg.scripts,
            };
        } catch (error) {
            debugWarn(`Failed to parse package.json at ${packageJsonPath}`, error);
            return null;
        }
    }

    return null;
}

/**
 * Get summaries of key project files
 */
export function getFileSummaries(rootDir?: string): string {
    const env = getEnvironment();
    const root = rootDir || env.workspaceRoot;

    const summaries: string[] = [];

    for (const file of KEY_FILES) {
        const filePath = join(root, file);
        if (existsSync(filePath)) {
            try {
                const content = readFileSync(filePath, 'utf-8');
                const preview = content.slice(0, 500);
                const truncated = content.length > 500 ? '...(truncated)' : '';
                summaries.push(`### ${file}\n\`\`\`\n${preview}${truncated}\n\`\`\``);
            } catch (error) {
                debugWarn(`Failed to read key file: ${filePath}`, error);
                // Skip unreadable files
            }
        }
    }

    return summaries.length > 0 ? summaries.join('\n\n') : '(no key files found)';
}

// ==================== FULL CONTEXT ====================

/**
 * Build complete workspace context for LLM
 */
export function buildWorkspaceContext(rootDir?: string): WorkspaceContext {
    const env = getEnvironment();
    const root = rootDir || env.workspaceRoot;

    return {
        workspaceRoot: root,
        fileTree: getWorkspaceTree(root),
        projectConfig: getProjectConfig(root),
        gitStatus: null, // Filled by GitManager
    };
}

/**
 * Format context for injection into system prompt
 */
export function formatContextForPrompt(context: WorkspaceContext): string {
    const sections: string[] = [];

    sections.push('## Current Workspace');
    sections.push(`Path: ${context.workspaceRoot}`);

    if (context.projectConfig) {
        const cfg = context.projectConfig;
        sections.push(`\nProject: ${cfg.name}${cfg.version ? ' v' + cfg.version : ''}`);
        if (cfg.description) {
            sections.push(`Description: ${cfg.description}`);
        }
        if (cfg.scripts) {
            const scriptList = Object.keys(cfg.scripts).slice(0, 5).join(', ');
            sections.push(`Scripts: ${scriptList}`);
        }
    }

    sections.push('\n## File Structure');
    sections.push('```');
    sections.push(context.fileTree);
    sections.push('```');

    if (context.gitStatus) {
        sections.push('\n## Git Status');
        sections.push(context.gitStatus);
    }

    return sections.join('\n');
}
