/**
 * Project Management
 * Handles project state in memory
 */

import type { Project, GeneratedFile } from '../types/index.js';

export { Project, GeneratedFile };

/**
 * Project Manager - manages current project state
 */
export class ProjectManager {
    private project: Project | null = null;

    /**
     * Create a new project
     */
    create(name: string, prompt: string): Project {
        this.project = {
            id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `proj-${Date.now()}`,
            name,
            description: '',
            prompt,
            files: [],
            dependencies: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        return this.project;
    }

    /**
     * Get current project
     */
    get(): Project | null {
        return this.project;
    }

    /**
     * Load an existing project
     */
    load(project: Project): void {
        this.project = project;
    }

    /**
     * Update project files
     */
    updateFiles(files: GeneratedFile[]): void {
        if (this.project) {
            this.project.files = files;
            this.project.updatedAt = new Date();
        }
    }

    /**
     * Update project dependencies
     */
    updateDependencies(dependencies: string[]): void {
        if (this.project) {
            this.project.dependencies = dependencies;
            this.project.updatedAt = new Date();
        }
    }

    /**
     * Add a file to the project
     */
    addFile(file: GeneratedFile): void {
        if (this.project) {
            const existingIndex = this.project.files.findIndex(f => f.path === file.path);
            if (existingIndex >= 0) {
                this.project.files[existingIndex] = file;
            } else {
                this.project.files.push(file);
            }
            this.project.updatedAt = new Date();
        }
    }

    /**
     * Clear current project
     */
    clear(): void {
        this.project = null;
    }

    /**
     * Check if project exists
     */
    hasProject(): boolean {
        return this.project !== null;
    }
}
