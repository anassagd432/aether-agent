/**
 * RAG Indexer - Index codebase files for semantic search
 * 
 * Creates a searchable index of the codebase for context retrieval.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, extname, relative, basename } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

// ==================== TYPES ====================

export interface CodeChunk {
    id: string;
    filePath: string;
    relativePath: string;
    content: string;
    startLine: number;
    endLine: number;
    type: 'function' | 'class' | 'import' | 'export' | 'comment' | 'other';
    language: string;
    hash: string;
}

export interface CodebaseIndex {
    version: number;
    projectPath: string;
    indexedAt: string;
    fileCount: number;
    chunkCount: number;
    chunks: CodeChunk[];
    files: Record<string, { mtimeMs: number; size: number }>;
}

// ==================== CONSTANTS ====================

const INDEX_DIR = join(homedir(), '.agdi', 'indexes');
const CHUNK_SIZE = 50; // lines per chunk
const OVERLAP = 10; // overlap lines between chunks

const SUPPORTED_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.rb', '.go', '.rs', '.java', '.kt',
    '.c', '.cpp', '.h', '.hpp', '.cs',
    '.json', '.yaml', '.yml', '.toml',
    '.md', '.txt', '.css', '.scss', '.html',
]);

const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next',
    '__pycache__', '.venv', 'venv', 'target',
    '.idea', '.vscode', 'coverage', '.nyc_output',
]);

const IGNORE_FILES = new Set([
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.DS_Store', 'Thumbs.db',
]);

// ==================== HELPERS ====================

function getLanguage(ext: string): string {
    const langMap: Record<string, string> = {
        '.ts': 'typescript', '.tsx': 'typescript',
        '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
        '.py': 'python', '.rb': 'ruby', '.go': 'go',
        '.rs': 'rust', '.java': 'java', '.kt': 'kotlin',
        '.c': 'c', '.cpp': 'cpp', '.cs': 'csharp',
        '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
        '.md': 'markdown', '.css': 'css', '.html': 'html',
    };
    return langMap[ext] || 'text';
}

function generateId(filePath: string, startLine: number): string {
    const hash = createHash('md5').update(`${filePath}:${startLine}`).digest('hex').slice(0, 8);
    return `chunk_${hash}`;
}

function hashContent(content: string): string {
    return createHash('md5').update(content).digest('hex').slice(0, 12);
}

function detectChunkType(content: string, language: string): CodeChunk['type'] {
    const firstLine = content.split('\n')[0].trim();

    if (language === 'typescript' || language === 'javascript') {
        if (/^(export\s+)?(async\s+)?function\s/.test(firstLine)) return 'function';
        if (/^(export\s+)?(abstract\s+)?class\s/.test(firstLine)) return 'class';
        if (/^(import|from)\s/.test(firstLine)) return 'import';
        if (/^export\s/.test(firstLine)) return 'export';
    }

    if (language === 'python') {
        if (/^(async\s+)?def\s/.test(firstLine)) return 'function';
        if (/^class\s/.test(firstLine)) return 'class';
        if (/^(from|import)\s/.test(firstLine)) return 'import';
    }

    if (/^(\/\/|\/\*|#|""")/.test(firstLine)) return 'comment';

    return 'other';
}

// ==================== FILE DISCOVERY ====================

function* walkDirectory(dir: string, basePath: string): Generator<string> {
    let entries: import('fs').Dirent[];
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        const fullPath = join(dir, String(entry.name));

        if (entry.isDirectory()) {
            if (!IGNORE_DIRS.has(String(entry.name))) {
                yield* walkDirectory(fullPath, basePath);
            }
        } else if (entry.isFile()) {
            if (!IGNORE_FILES.has(String(entry.name))) {
                const ext = extname(String(entry.name)).toLowerCase();
                if (SUPPORTED_EXTENSIONS.has(ext)) {
                    yield fullPath;
                }
            }
        }
    }
}

// ==================== CHUNKING ====================

function chunkFile(filePath: string, basePath: string): CodeChunk[] {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const ext = extname(filePath).toLowerCase();
    const language = getLanguage(ext);
    const relativePath = relative(basePath, filePath);
    const chunks: CodeChunk[] = [];

    // Simple chunking with overlap
    for (let i = 0; i < lines.length; i += CHUNK_SIZE - OVERLAP) {
        const chunkLines = lines.slice(i, i + CHUNK_SIZE);
        const chunkContent = chunkLines.join('\n');

        if (chunkContent.trim().length === 0) continue;

        chunks.push({
            id: generateId(filePath, i),
            filePath,
            relativePath,
            content: chunkContent,
            startLine: i + 1,
            endLine: Math.min(i + CHUNK_SIZE, lines.length),
            type: detectChunkType(chunkContent, language),
            language,
            hash: hashContent(chunkContent),
        });
    }

    return chunks;
}

// ==================== INDEXING ====================

/**
 * Index a project directory
 */
export function indexProject(projectPath: string): CodebaseIndex {
    const startTime = Date.now();
    const allChunks: CodeChunk[] = [];
    const files: Record<string, { mtimeMs: number; size: number }> = {};
    let fileCount = 0;

    const previousIndex = loadIndex(projectPath);
    const previousChunksByFile = new Map<string, CodeChunk[]>();

    if (previousIndex) {
        for (const chunk of previousIndex.chunks) {
            const list = previousChunksByFile.get(chunk.filePath) || [];
            list.push(chunk);
            previousChunksByFile.set(chunk.filePath, list);
        }
    }

    // Walk and chunk all files
    for (const filePath of walkDirectory(projectPath, projectPath)) {
        try {
            const stat = statSync(filePath);
            // Skip large files (> 1MB)
            if (stat.size > 1024 * 1024) continue;

            files[filePath] = { mtimeMs: stat.mtimeMs, size: stat.size };
            fileCount++;

            const prevMeta = previousIndex?.files?.[filePath];
            const isUnchanged = prevMeta && prevMeta.mtimeMs === stat.mtimeMs && prevMeta.size === stat.size;

            if (isUnchanged) {
                const cachedChunks = previousChunksByFile.get(filePath);
                if (cachedChunks?.length) {
                    allChunks.push(...cachedChunks);
                    continue;
                }
            }

            const chunks = chunkFile(filePath, projectPath);
            allChunks.push(...chunks);
        } catch {
            // Skip unreadable files
        }
    }

    const index: CodebaseIndex = {
        version: 2,
        projectPath,
        indexedAt: new Date().toISOString(),
        fileCount,
        chunkCount: allChunks.length,
        chunks: allChunks,
        files,
    };

    // Save index
    saveIndex(projectPath, index);

    if (process.env.AGDI_DEBUG === 'true') {
        console.log(`Indexed ${fileCount} files, ${allChunks.length} chunks in ${Date.now() - startTime}ms`);
    }

    return index;
}

/**
 * Get index path for a project
 */
function getIndexPath(projectPath: string): string {
    const hash = createHash('md5').update(projectPath).digest('hex').slice(0, 12);
    return join(INDEX_DIR, `${hash}.json`);
}

/**
 * Save index to disk
 */
function saveIndex(projectPath: string, index: CodebaseIndex): void {
    if (!existsSync(INDEX_DIR)) {
        mkdirSync(INDEX_DIR, { recursive: true });
    }
    writeFileSync(getIndexPath(projectPath), JSON.stringify(index));
}

/**
 * Load index from disk
 */
export function loadIndex(projectPath: string): CodebaseIndex | null {
    const indexPath = getIndexPath(projectPath);
    if (!existsSync(indexPath)) return null;

    try {
        const data = readFileSync(indexPath, 'utf-8');
        const parsed = JSON.parse(data);
        if (!parsed.files) {
            parsed.files = {};
        }
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Check if index is stale (older than 1 hour)
 */
export function isIndexStale(index: CodebaseIndex): boolean {
    const indexedAt = new Date(index.indexedAt).getTime();
    const hourAgo = Date.now() - 60 * 60 * 1000;
    return indexedAt < hourAgo;
}
