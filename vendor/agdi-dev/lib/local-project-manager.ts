/**
 * Local Project Manager
 * 
 * Manages projects with automatic IndexedDB persistence.
 * Projects survive browser tab closes thanks to local storage.
 */

import type { GeneratedFile } from './agdi-architect';
import * as projectStore from './persistence/project-store';
import type { ProjectMeta } from './persistence/types';

export interface LocalProject {
    id: string;
    name: string;
    description: string;
    createdAt: number;
    updatedAt: number;
    files: GeneratedFile[];
    dependencies: string[];
    initialPrompt: string;
}

export interface LocalProjectManagerOptions {
    autoSave: boolean;
}

export class LocalProjectManager {
    private currentProject: LocalProject | null = null;
    private options: LocalProjectManagerOptions;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private lastSavedAt: number | null = null;

    constructor(options: Partial<LocalProjectManagerOptions> = {}) {
        this.options = {
            autoSave: true,
            ...options,
        };
    }

    /**
     * Create a new project
     */
    createProject(name: string, prompt: string): LocalProject {
        this.currentProject = {
            id: crypto.randomUUID(),
            name,
            description: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            files: [],
            dependencies: [],
            initialPrompt: prompt,
        };

        // Auto-save immediately for new projects
        if (this.options.autoSave) {
            this.saveNow();
        }

        return this.currentProject;
    }

    /**
     * Update the current project with new files/dependencies
     */
    updateProject(files: GeneratedFile[], dependencies: string[]): void {
        if (!this.currentProject) return;
        this.currentProject.files = files;
        this.currentProject.dependencies = dependencies;
        this.currentProject.updatedAt = Date.now();

        // Debounced auto-save
        if (this.options.autoSave) {
            this.scheduleSave();
        }
    }

    /**
     * Update project metadata
     */
    updateMetadata(updates: Partial<Pick<LocalProject, 'name' | 'description'>>): void {
        if (!this.currentProject) return;
        if (updates.name) this.currentProject.name = updates.name;
        if (updates.description !== undefined) this.currentProject.description = updates.description;
        this.currentProject.updatedAt = Date.now();

        if (this.options.autoSave) {
            this.scheduleSave();
        }
    }

    /**
     * Get the current project (or null if none)
     */
    getCurrentProject(): LocalProject | null {
        return this.currentProject;
    }

    /**
     * Get last saved timestamp
     */
    getLastSavedAt(): number | null {
        return this.lastSavedAt;
    }

    /**
     * Load a project (e.g., from import or storage)
     */
    loadProject(project: LocalProject): void {
        this.currentProject = project;
        this.lastSavedAt = project.updatedAt;
    }

    /**
     * Load a project by ID from IndexedDB
     */
    async loadProjectById(id: string): Promise<LocalProject | null> {
        const project = await projectStore.loadProject(id);
        if (project) {
            this.currentProject = project;
            this.lastSavedAt = project.updatedAt;
        }
        return project;
    }

    /**
     * List all saved projects
     */
    async listSavedProjects(): Promise<ProjectMeta[]> {
        return projectStore.listProjects();
    }

    /**
     * Delete a saved project
     */
    async deleteProject(id: string): Promise<void> {
        await projectStore.deleteProject(id);

        // If deleting current project, clear it
        if (this.currentProject?.id === id) {
            this.currentProject = null;
            this.lastSavedAt = null;
        }
    }

    /**
     * Clear the current project (from memory only)
     */
    clearProject(): void {
        this.currentProject = null;
        this.lastSavedAt = null;

        // Cancel pending save
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
    }

    /**
     * Check if a project is loaded
     */
    hasProject(): boolean {
        return this.currentProject !== null;
    }

    /**
     * Manually save current project
     */
    async saveNow(): Promise<void> {
        if (!this.currentProject) return;

        // Cancel pending debounced save
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }

        await projectStore.saveProject(this.currentProject);
        this.lastSavedAt = Date.now();
    }

    /**
     * Schedule a debounced save (500ms delay)
     */
    private scheduleSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(async () => {
            await this.saveNow();
            this.saveTimeout = null;
        }, 500);
    }

    /**
     * Check if persistence is available
     */
    isPersistenceAvailable(): boolean {
        return projectStore.isPersistenceAvailable();
    }
}

// Export singleton instance
export const localProjectManager = new LocalProjectManager();
