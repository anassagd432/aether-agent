/**
 * Memory Store - Persistent memory for AI conversations
 * 
 * Stores user preferences, project context, and conversation history
 * across sessions using JSON file storage (no external DB needed).
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// ==================== TYPES ====================

export interface MemoryEntry {
    id: string;
    type: 'preference' | 'fact' | 'project' | 'conversation';
    content: string;
    importance: number; // 0-1, higher = more important
    createdAt: string;
    accessedAt: string;
    accessCount: number;
    projectPath?: string;
    tags?: string[];
}

export interface MemoryStore {
    version: number;
    entries: MemoryEntry[];
    userPreferences: Record<string, string>;
    projectContexts: Record<string, ProjectContext>;
}

export interface ProjectContext {
    path: string;
    language: string;
    framework?: string;
    dependencies?: string[];
    lastAccessed: string;
    notes: string[];
}

// ==================== CONSTANTS ====================

const MEMORY_DIR = join(homedir(), '.agdi', 'memory');
const MEMORY_FILE = join(MEMORY_DIR, 'store.json');
const MAX_ENTRIES = 1000;
const DECAY_RATE = 0.95; // Importance decays by 5% per day unused

function debugWarn(message: string, error?: unknown) {
    if (process.env.AGDI_DEBUG === 'true') {
        console.warn(`[MemoryStore] ${message}`, error ?? '');
    }
}

// ==================== PERSISTENCE ====================

function ensureMemoryDir(): void {
    if (!existsSync(MEMORY_DIR)) {
        mkdirSync(MEMORY_DIR, { recursive: true });
    }
}

function loadMemoryStore(): MemoryStore {
    ensureMemoryDir();

    if (existsSync(MEMORY_FILE)) {
        try {
            const data = readFileSync(MEMORY_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            // Corrupted, start fresh
            debugWarn(`Failed to parse memory store at ${MEMORY_FILE} (starting fresh)`, error);
        }
    }

    return {
        version: 1,
        entries: [],
        userPreferences: {},
        projectContexts: {},
    };
}

function saveMemoryStore(store: MemoryStore): void {
    try {
        ensureMemoryDir();
        writeFileSync(MEMORY_FILE, JSON.stringify(store, null, 2));
    } catch (error) {
        // Silent failure: memory should never break workflow
        debugWarn(`Failed to save memory store at ${MEMORY_FILE}`, error);
    }
}

// ==================== MEMORY OPERATIONS ====================

/**
 * Generate unique ID
 */
function generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Add a new memory entry
 */
export function addMemory(
    type: MemoryEntry['type'],
    content: string,
    options: {
        importance?: number;
        projectPath?: string;
        tags?: string[];
    } = {}
): MemoryEntry {
    const store = loadMemoryStore();
    const now = new Date().toISOString();

    const entry: MemoryEntry = {
        id: generateId(),
        type,
        content,
        importance: options.importance ?? 0.5,
        createdAt: now,
        accessedAt: now,
        accessCount: 1,
        projectPath: options.projectPath,
        tags: options.tags,
    };

    store.entries.push(entry);

    // Prune if too many entries
    if (store.entries.length > MAX_ENTRIES) {
        pruneMemories(store);
    }

    saveMemoryStore(store);
    return entry;
}

/**
 * Search memories by content or tags
 */
export function searchMemories(
    query: string,
    options: {
        type?: MemoryEntry['type'];
        projectPath?: string;
        limit?: number;
    } = {}
): MemoryEntry[] {
    const store = loadMemoryStore();
    const queryLower = query.toLowerCase();
    const limit = options.limit ?? 10;

    const results = store.entries.filter(entry => {
        // Type filter
        if (options.type && entry.type !== options.type) return false;

        // Project filter
        if (options.projectPath && entry.projectPath !== options.projectPath) return false;

        // Content match
        if (entry.content.toLowerCase().includes(queryLower)) return true;

        // Tag match
        if (entry.tags?.some(t => t.toLowerCase().includes(queryLower))) return true;

        return false;
    });

    // Sort by importance and recency
    results.sort((a, b) => {
        const scoreA = a.importance * 0.7 + (a.accessCount / 100) * 0.3;
        const scoreB = b.importance * 0.7 + (b.accessCount / 100) * 0.3;
        return scoreB - scoreA;
    });

    // Update access counts for returned entries
    const now = new Date().toISOString();
    for (const entry of results.slice(0, limit)) {
        const storeEntry = store.entries.find(e => e.id === entry.id);
        if (storeEntry) {
            storeEntry.accessedAt = now;
            storeEntry.accessCount++;
        }
    }
    saveMemoryStore(store);

    return results.slice(0, limit);
}

/**
 * Get relevant memories for a prompt
 */
export function getRelevantMemories(
    prompt: string,
    projectPath?: string,
    limit: number = 5
): MemoryEntry[] {
    // Extract keywords from prompt
    const words = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const keywords = [...new Set(words)].slice(0, 10);

    const store = loadMemoryStore();

    // Score each entry
    const scored = store.entries.map(entry => {
        let score = entry.importance;

        // Project bonus
        if (projectPath && entry.projectPath === projectPath) {
            score += 0.3;
        }

        // Keyword matches
        const contentLower = entry.content.toLowerCase();
        for (const keyword of keywords) {
            if (contentLower.includes(keyword)) {
                score += 0.1;
            }
        }

        // Recency bonus (last 7 days)
        const daysSinceAccess = (Date.now() - new Date(entry.accessedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceAccess < 7) {
            score += (7 - daysSinceAccess) / 70;
        }

        return { entry, score };
    });

    // Sort and return top entries
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.entry);
}

// ==================== USER PREFERENCES ====================

/**
 * Set a user preference
 */
export function setPreference(key: string, value: string): void {
    const store = loadMemoryStore();
    store.userPreferences[key] = value;
    saveMemoryStore(store);

    // Also add as memory for context
    addMemory('preference', `User prefers: ${key} = ${value}`, {
        importance: 0.8,
        tags: ['preference', key],
    });
}

/**
 * Get a user preference
 */
export function getPreference(key: string): string | undefined {
    const store = loadMemoryStore();
    return store.userPreferences[key];
}

/**
 * Get all user preferences
 */
export function getAllPreferences(): Record<string, string> {
    return loadMemoryStore().userPreferences;
}

// ==================== PROJECT CONTEXT ====================

/**
 * Set project context
 */
export function setProjectContext(path: string, context: Partial<ProjectContext>): void {
    const store = loadMemoryStore();
    const existing = store.projectContexts[path] || {
        path,
        language: 'unknown',
        lastAccessed: new Date().toISOString(),
        notes: [],
    };

    store.projectContexts[path] = {
        ...existing,
        ...context,
        lastAccessed: new Date().toISOString(),
    };

    saveMemoryStore(store);
}

/**
 * Get project context
 */
export function getProjectContext(path: string): ProjectContext | undefined {
    const store = loadMemoryStore();
    const ctx = store.projectContexts[path];

    if (ctx) {
        // Update last accessed
        ctx.lastAccessed = new Date().toISOString();
        saveMemoryStore(store);
    }

    return ctx;
}

// ==================== MEMORY MANAGEMENT ====================

/**
 * Prune old/low-importance memories
 */
function pruneMemories(store: MemoryStore): void {
    const now = Date.now();

    // Apply decay based on time since last access
    for (const entry of store.entries) {
        const daysSinceAccess = (now - new Date(entry.accessedAt).getTime()) / (1000 * 60 * 60 * 24);
        entry.importance *= Math.pow(DECAY_RATE, daysSinceAccess);
    }

    // Sort by importance and keep top MAX_ENTRIES
    store.entries.sort((a, b) => b.importance - a.importance);
    store.entries = store.entries.slice(0, MAX_ENTRIES);
}

/**
 * Clear all memories (nuclear option)
 */
export function clearAllMemories(): void {
    const store: MemoryStore = {
        version: 1,
        entries: [],
        userPreferences: {},
        projectContexts: {},
    };
    saveMemoryStore(store);
}

/**
 * Get memory statistics
 */
export function getMemoryStats(): {
    totalEntries: number;
    byType: Record<string, number>;
    projectCount: number;
    preferenceCount: number;
} {
    const store = loadMemoryStore();

    const byType: Record<string, number> = {};
    for (const entry of store.entries) {
        byType[entry.type] = (byType[entry.type] || 0) + 1;
    }

    return {
        totalEntries: store.entries.length,
        byType,
        projectCount: Object.keys(store.projectContexts).length,
        preferenceCount: Object.keys(store.userPreferences).length,
    };
}

// ==================== CONTEXT BUILDER ====================

/**
 * Build a context string from relevant memories for LLM
 */
export function buildMemoryContext(
    prompt: string,
    projectPath?: string
): string {
    const memories = getRelevantMemories(prompt, projectPath, 5);
    const preferences = getAllPreferences();
    const projectCtx = projectPath ? getProjectContext(projectPath) : undefined;

    if (memories.length === 0 && Object.keys(preferences).length === 0 && !projectCtx) {
        return '';
    }

    const parts: string[] = ['[Memory Context]'];

    // Add preferences
    if (Object.keys(preferences).length > 0) {
        parts.push('User preferences:');
        for (const [key, value] of Object.entries(preferences).slice(0, 5)) {
            parts.push(`- ${key}: ${value}`);
        }
    }

    // Add project context
    if (projectCtx) {
        parts.push(`\nProject: ${projectCtx.language}${projectCtx.framework ? ` + ${projectCtx.framework}` : ''}`);
        if (projectCtx.notes.length > 0) {
            parts.push('Notes: ' + projectCtx.notes.slice(-3).join('; '));
        }
    }

    // Add relevant memories
    if (memories.length > 0) {
        parts.push('\nRelevant context:');
        for (const mem of memories) {
            parts.push(`- ${mem.content.slice(0, 100)}${mem.content.length > 100 ? '...' : ''}`);
        }
    }

    parts.push('[/Memory Context]\n');

    return parts.join('\n');
}
