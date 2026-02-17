/**
 * Project Store
 * 
 * High-level project persistence operations.
 * Provides save, load, list, delete for projects.
 */

import type { LocalProject } from '../local-project-manager';
import type { StoredProject, ProjectMeta, StoredSnapshots } from './types';
import { STORES } from './types';
import * as db from './indexeddb-store';

// ==================== PROJECT OPERATIONS ====================

/**
 * Save a project to IndexedDB
 */
export async function saveProject(project: LocalProject): Promise<void> {
    const storedProject: StoredProject = {
        ...project,
        savedAt: Date.now(),
    };

    await db.put(STORES.PROJECTS, storedProject);
}

/**
 * Load a project by ID
 */
export async function loadProject(id: string): Promise<LocalProject | null> {
    const stored = await db.get<StoredProject>(STORES.PROJECTS, id);
    if (!stored) return null;

    // Return as LocalProject (strip savedAt)
    const { savedAt, ...project } = stored;
    return project;
}

/**
 * Get project with full metadata
 */
export async function getStoredProject(id: string): Promise<StoredProject | null> {
    const stored = await db.get<StoredProject>(STORES.PROJECTS, id);
    return stored || null;
}

/**
 * List all projects (metadata only for performance)
 */
export async function listProjects(): Promise<ProjectMeta[]> {
    const projects = await db.getAll<StoredProject>(STORES.PROJECTS);

    return projects
        .map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            savedAt: p.savedAt,
            createdAt: p.createdAt,
            fileCount: p.files.length,
        }))
        .sort((a, b) => b.savedAt - a.savedAt); // Most recent first
}

/**
 * Delete a project and its snapshots
 */
export async function deleteProject(id: string): Promise<void> {
    await db.del(STORES.PROJECTS, id);
    await db.del(STORES.SNAPSHOTS, id); // Also delete snapshots
}

/**
 * Check if a project exists
 */
export async function projectExists(id: string): Promise<boolean> {
    const project = await db.get<StoredProject>(STORES.PROJECTS, id);
    return project !== undefined;
}

/**
 * Get project count
 */
export async function getProjectCount(): Promise<number> {
    return db.count(STORES.PROJECTS);
}

// ==================== SNAPSHOT OPERATIONS ====================

/**
 * Save snapshots for a project
 */
export async function saveSnapshots(
    projectId: string,
    snapshots: StoredSnapshots['snapshots'],
    currentIndex: number
): Promise<void> {
    const stored: StoredSnapshots = {
        projectId,
        id: projectId, // IndexedDB uses 'id' as keyPath
        snapshots,
        currentIndex,
        savedAt: Date.now(),
    };

    await db.put(STORES.SNAPSHOTS, stored);
}

/**
 * Load snapshots for a project
 */
export async function loadSnapshots(projectId: string): Promise<StoredSnapshots | null> {
    const stored = await db.get<StoredSnapshots>(STORES.SNAPSHOTS, projectId);
    return stored || null;
}

// ==================== UTILITY ====================

/**
 * Clear all data (for testing or reset)
 */
export async function clearAllData(): Promise<void> {
    await db.clear(STORES.PROJECTS);
    await db.clear(STORES.SNAPSHOTS);
    await db.clear(STORES.SETTINGS);
}

/**
 * Check if persistence is available
 */
export function isPersistenceAvailable(): boolean {
    return db.isIndexedDBAvailable();
}
