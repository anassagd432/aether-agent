/**
 * useProjectPersistence Hook
 * 
 * React hook for managing project persistence.
 * Provides project listing, loading, saving, and auto-save status.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { localProjectManager, type LocalProject } from '../lib/local-project-manager';
import type { ProjectMeta } from '../lib/persistence/types';

// ==================== HOOK INTERFACE ====================

export interface UseProjectPersistenceReturn {
    // State
    currentProject: LocalProject | null;
    savedProjects: ProjectMeta[];
    lastSavedAt: number | null;
    isSaving: boolean;
    isLoading: boolean;
    isPersistenceAvailable: boolean;

    // Actions
    createProject: (name: string, prompt: string) => LocalProject;
    loadProject: (id: string) => Promise<void>;
    saveProject: () => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    refreshProjectList: () => Promise<void>;
    updateFiles: (files: { name: string; path: string; content: string }[], dependencies: string[]) => void;
    clearCurrentProject: () => void;
}

// ==================== HOOK IMPLEMENTATION ====================

export function useProjectPersistence(): UseProjectPersistenceReturn {
    const [currentProject, setCurrentProject] = useState<LocalProject | null>(
        localProjectManager.getCurrentProject()
    );
    const [savedProjects, setSavedProjects] = useState<ProjectMeta[]>([]);
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(
        localProjectManager.getLastSavedAt()
    );
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isPersistenceAvailable] = useState(
        localProjectManager.isPersistenceAvailable()
    );

    // Track save timeout for cleanup
    const saveCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load saved projects on mount
    useEffect(() => {
        refreshProjectList();

        // Poll for lastSavedAt changes (from auto-save)
        saveCheckInterval.current = setInterval(() => {
            const newLastSaved = localProjectManager.getLastSavedAt();
            if (newLastSaved !== lastSavedAt) {
                setLastSavedAt(newLastSaved);
            }
        }, 1000);

        return () => {
            if (saveCheckInterval.current) {
                clearInterval(saveCheckInterval.current);
            }
        };
    }, []);

    /**
     * Refresh the list of saved projects
     */
    const refreshProjectList = useCallback(async (): Promise<void> => {
        if (!isPersistenceAvailable) return;

        try {
            const projects = await localProjectManager.listSavedProjects();
            setSavedProjects(projects);
        } catch (error) {
            console.error('Failed to list projects:', error);
        }
    }, [isPersistenceAvailable]);

    /**
     * Create a new project
     */
    const createProject = useCallback((name: string, prompt: string): LocalProject => {
        const project = localProjectManager.createProject(name, prompt);
        setCurrentProject(project);
        setLastSavedAt(localProjectManager.getLastSavedAt());

        // Refresh list after short delay (wait for auto-save)
        setTimeout(refreshProjectList, 600);

        return project;
    }, [refreshProjectList]);

    /**
     * Load a project by ID
     */
    const loadProject = useCallback(async (id: string): Promise<void> => {
        setIsLoading(true);
        try {
            const project = await localProjectManager.loadProjectById(id);
            if (project) {
                setCurrentProject(project);
                setLastSavedAt(localProjectManager.getLastSavedAt());
            }
        } catch (error) {
            console.error('Failed to load project:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Manually save the current project
     */
    const saveProject = useCallback(async (): Promise<void> => {
        if (!currentProject) return;

        setIsSaving(true);
        try {
            await localProjectManager.saveNow();
            setLastSavedAt(localProjectManager.getLastSavedAt());
            await refreshProjectList();
        } catch (error) {
            console.error('Failed to save project:', error);
        } finally {
            setIsSaving(false);
        }
    }, [currentProject, refreshProjectList]);

    /**
     * Delete a project
     */
    const deleteProject = useCallback(async (id: string): Promise<void> => {
        try {
            await localProjectManager.deleteProject(id);

            // If we deleted the current project, clear state
            if (currentProject?.id === id) {
                setCurrentProject(null);
                setLastSavedAt(null);
            }

            await refreshProjectList();
        } catch (error) {
            console.error('Failed to delete project:', error);
        }
    }, [currentProject, refreshProjectList]);

    /**
     * Update files (triggers auto-save)
     */
    const updateFiles = useCallback((
        files: { name: string; path: string; content: string }[],
        dependencies: string[]
    ): void => {
        localProjectManager.updateProject(files, dependencies);
        setCurrentProject(localProjectManager.getCurrentProject());
    }, []);

    /**
     * Clear the current project from state
     */
    const clearCurrentProject = useCallback(() => {
        localProjectManager.clearProject();
        setCurrentProject(null);
        setLastSavedAt(null);
    }, []);

    return {
        currentProject,
        savedProjects,
        lastSavedAt,
        isSaving,
        isLoading,
        isPersistenceAvailable,
        createProject,
        loadProject,
        saveProject,
        deleteProject,
        refreshProjectList,
        updateFiles,
        clearCurrentProject,
    };
}

export default useProjectPersistence;
