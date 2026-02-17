/**
 * Persistence Types
 * 
 * Shared types for IndexedDB-based local storage.
 */

import type { LocalProject } from '../local-project-manager';
import type { Snapshot } from '../snapshot-manager';

// ==================== STORED TYPES ====================

/**
 * Project as stored in IndexedDB (with save metadata)
 */
export interface StoredProject extends LocalProject {
    savedAt: number;
}

/**
 * Lightweight project metadata for listing
 */
export interface ProjectMeta {
    id: string;
    name: string;
    description: string;
    savedAt: number;
    createdAt: number;
    fileCount: number;
}

/**
 * Snapshots stored per project
 */
export interface StoredSnapshots {
    projectId: string;
    id?: string; // Alias for projectId (IndexedDB keyPath compatibility)
    snapshots: Snapshot[];
    currentIndex: number;
    savedAt: number;
}

/**
 * User settings (API keys, preferences)
 */
export interface UserSettings {
    id: string; // Always 'default'
    apiKeys: Record<string, string>;
    defaultModel: string;
    theme: 'dark' | 'light';
    savedAt: number;
}

// ==================== DATABASE SCHEMA ====================

export const DB_NAME = 'agdi-local';
export const DB_VERSION = 1;

export const STORES = {
    PROJECTS: 'projects',
    SNAPSHOTS: 'snapshots',
    SETTINGS: 'settings',
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];
