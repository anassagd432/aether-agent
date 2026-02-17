/**
 * useWorkspacePicker Hook (Hardened)
 * 
 * Production-quality folder selection with:
 * - IndexedDB handle persistence
 * - Permission re-auth flow
 * - Path traversal protection
 */

import { useState, useCallback, useEffect } from 'react';
import { workspaceSession } from '../lib/workspace';
import {
    saveHandle,
    getAllHandles,
    deleteHandle,
    updateTrust,
    queryPermission,
    requestPermission,
    restoreHandles,
    type StoredHandle,
} from '../lib/workspace/handle-store';
import {
    setActiveHandle,
    listDirHardened,
    readFileHardened,
    writeFileHardened,
} from '../lib/workspace/fs-hardened';
import { fileWatcher } from '../lib/workspace/file-watcher';

// ==================== TYPES ====================

export interface WorkspaceFolder {
    id: string;
    name: string;
    path: string;
    handle?: FileSystemDirectoryHandle;
    trusted: boolean;
    addedAt: number;
    needsReauth?: boolean;
}

export interface UseWorkspacePickerReturn {
    // State
    folders: WorkspaceFolder[];
    activeFolder: WorkspaceFolder | null;
    cwd: string;
    isSupported: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    selectFolder: () => Promise<WorkspaceFolder | null>;
    trustFolder: (folderId: string) => void;
    removeFolder: (folderId: string) => void;
    setActiveFolder: (folderId: string) => void;
    changeCwd: (path: string) => { success: boolean; error?: string };
    reauthorize: (folderId: string) => Promise<boolean>;
    listDirectory: (path?: string) => Promise<string[]>;
    readFile: (path: string) => Promise<string | null>;
    writeFile: (path: string, content: string) => Promise<boolean>;
}

// ==================== HOOK ====================

export function useWorkspacePicker(): UseWorkspacePickerReturn {
    const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
    const [activeFolder, setActiveFolderState] = useState<WorkspaceFolder | null>(null);
    const [cwd, setCwd] = useState<string>('.');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Check if File System Access API is supported
    const isSupported = typeof window !== 'undefined' &&
        'showDirectoryPicker' in window;

    // Restore handles from IndexedDB on mount
    useEffect(() => {
        if (!isSupported) return;

        async function restore() {
            setIsLoading(true);
            try {
                const { restored, needsReauth } = await restoreHandles();

                const restoredFolders: WorkspaceFolder[] = restored.map(h => ({
                    id: h.id,
                    name: h.name,
                    path: `/${h.name}`,
                    handle: h.handle,
                    trusted: h.trusted,
                    addedAt: h.addedAt,
                    needsReauth: false,
                }));

                const reauthFolders: WorkspaceFolder[] = needsReauth.map(h => ({
                    id: h.id,
                    name: h.name,
                    path: `/${h.name}`,
                    handle: h.handle,
                    trusted: h.trusted,
                    addedAt: h.addedAt,
                    needsReauth: true,
                }));

                const allFolders = [...restoredFolders, ...reauthFolders];
                setFolders(allFolders);

                // Set active to first restored folder
                if (restoredFolders.length > 0) {
                    const first = restoredFolders[0];
                    setActiveFolderState(first);
                    setCwd(first.path);
                    if (first.handle) {
                        setActiveHandle(first.handle);
                        workspaceSession.initialize(first.path, first.trusted ? 'trusted' : 'pending');
                        // Start file watcher
                        fileWatcher.start(first.handle);
                    }
                }
            } catch (e) {
                console.error('Failed to restore handles:', e);
            }
            setIsLoading(false);
        }

        restore();

        return () => {
            fileWatcher.stop();
        };
    }, [isSupported]);

    /**
     * Select a folder using File System Access API
     */
    const selectFolder = useCallback(async (): Promise<WorkspaceFolder | null> => {
        if (!isSupported) {
            setError('File System Access API not supported in this browser');
            return null;
        }

        setIsLoading(true);
        setError(null);

        try {
            // This requires user gesture and secure context
            const handle = await (window as any).showDirectoryPicker({
                mode: 'readwrite',
            });

            const folder: WorkspaceFolder = {
                id: `folder-${Date.now()}`,
                name: handle.name,
                path: `/${handle.name}`,
                handle,
                trusted: false,
                addedAt: Date.now(),
                needsReauth: false,
            };

            // Save to IndexedDB
            await saveHandle({
                id: folder.id,
                name: folder.name,
                handle,
                trusted: false,
                addedAt: folder.addedAt,
            });

            setFolders(prev => [...prev, folder]);

            // Set as active
            setActiveFolderState(folder);
            setCwd(folder.path);
            setActiveHandle(handle);
            workspaceSession.initialize(folder.path, 'pending');

            // Start file watcher
            fileWatcher.stop();
            fileWatcher.start(handle);

            setIsLoading(false);
            return folder;

        } catch (err: any) {
            if (err.name === 'AbortError') {
                setIsLoading(false);
                return null;
            }
            setError(err.message || 'Failed to select folder');
            setIsLoading(false);
            return null;
        }
    }, [isSupported]);

    /**
     * Re-authorize a folder (requires user gesture)
     */
    const reauthorize = useCallback(async (folderId: string): Promise<boolean> => {
        const folder = folders.find(f => f.id === folderId);
        if (!folder?.handle) return false;

        const granted = await requestPermission(folder.handle, 'readwrite');
        if (granted) {
            setFolders(prev => prev.map(f =>
                f.id === folderId ? { ...f, needsReauth: false } : f
            ));
            return true;
        }
        return false;
    }, [folders]);

    /**
     * Trust a folder (enable writes)
     */
    const trustFolder = useCallback(async (folderId: string) => {
        await updateTrust(folderId, true);

        setFolders(prev => {
            const updated = prev.map(f =>
                f.id === folderId ? { ...f, trusted: true } : f
            );

            const folder = updated.find(f => f.id === folderId);
            if (folder) {
                workspaceSession.trustRoot(folder.path);
            }

            return updated;
        });
    }, []);

    /**
     * Remove a folder from workspace
     */
    const removeFolder = useCallback(async (folderId: string) => {
        const folder = folders.find(f => f.id === folderId);
        if (folder) {
            workspaceSession.removeRoot(folder.path);
        }

        await deleteHandle(folderId);

        setFolders(prev => {
            const updated = prev.filter(f => f.id !== folderId);

            if (activeFolder?.id === folderId) {
                const newActive = updated[0] || null;
                setActiveFolderState(newActive);
                if (newActive?.handle) {
                    setCwd(newActive.path);
                    setActiveHandle(newActive.handle);
                    fileWatcher.stop();
                    fileWatcher.start(newActive.handle);
                } else {
                    setActiveHandle(null);
                    fileWatcher.stop();
                }
            }

            return updated;
        });
    }, [activeFolder, folders]);

    /**
     * Set active folder
     */
    const setActiveFolder = useCallback((folderId: string) => {
        const folder = folders.find(f => f.id === folderId);
        if (folder && !folder.needsReauth) {
            setActiveFolderState(folder);
            setCwd(folder.path);
            if (folder.handle) {
                setActiveHandle(folder.handle);
                workspaceSession.changeCwd(folder.path);
                fileWatcher.stop();
                fileWatcher.start(folder.handle);
            }
        }
    }, [folders]);

    /**
     * Change working directory
     */
    const changeCwd = useCallback((path: string): { success: boolean; error?: string } => {
        const result = workspaceSession.changeCwd(path);
        if (result.success) {
            setCwd(result.newCwd);
        }
        return result;
    }, []);

    /**
     * List directory contents (hardened)
     */
    const listDirectory = useCallback(async (path: string = '.'): Promise<string[]> => {
        if (!activeFolder?.handle) return [];

        const result = await listDirHardened(path, activeFolder.handle);
        return result.success ? result.entries.map(e => e.name) : [];
    }, [activeFolder]);

    /**
     * Read file (hardened)
     */
    const readFile = useCallback(async (path: string): Promise<string | null> => {
        if (!activeFolder?.handle) return null;

        const result = await readFileHardened(path, activeFolder.handle);
        return result.success ? (result.content ?? null) : null;
    }, [activeFolder]);

    /**
     * Write file (hardened - requires trust)
     */
    const writeFile = useCallback(async (path: string, content: string): Promise<boolean> => {
        if (!activeFolder?.handle || !activeFolder.trusted) return false;

        const result = await writeFileHardened(path, content, activeFolder.handle, activeFolder.trusted);
        return result.success;
    }, [activeFolder]);

    return {
        folders,
        activeFolder,
        cwd,
        isSupported,
        isLoading,
        error,
        selectFolder,
        trustFolder,
        removeFolder,
        setActiveFolder,
        changeCwd,
        reauthorize,
        listDirectory,
        readFile,
        writeFile,
    };
}

export default useWorkspacePicker;
