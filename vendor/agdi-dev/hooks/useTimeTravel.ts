/**
 * useTimeTravel Hook
 * 
 * React hook for managing WebContainer state snapshots.
 * Provides undo/redo and timeline navigation.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
    SnapshotManager,
    getSnapshotManager,
    Snapshot,
    FileState,
    TimelineState,
    generateSnapshotLabel
} from '../lib/snapshot-manager';
import { WebContainerService } from '../lib/webcontainer';

// ==================== HOOK INTERFACE ====================

export interface UseTimeTravelReturn {
    // State
    snapshots: Snapshot[];
    currentIndex: number;
    currentSnapshot: Snapshot | null;
    canUndo: boolean;
    canRedo: boolean;

    // Actions
    createSnapshot: (label?: string) => Promise<Snapshot>;
    undo: () => Promise<void>;
    redo: () => Promise<void>;
    goTo: (index: number) => Promise<void>;
    clear: () => void;
}

// ==================== HOOK IMPLEMENTATION ====================

export function useTimeTravel(): UseTimeTravelReturn {
    const manager = useMemo(() => getSnapshotManager(), []);
    const [state, setState] = useState<TimelineState>(manager.getState());

    // Subscribe to manager updates
    useEffect(() => {
        const unsubscribe = manager.subscribe(setState);
        return unsubscribe;
    }, [manager]);

    /**
     * Read all files from WebContainer
     */
    const readFilesFromContainer = useCallback(async (): Promise<FileState[]> => {
        const container = await WebContainerService.boot();
        const files: FileState[] = [];

        async function readDir(path: string): Promise<void> {
            try {
                const entries = await container.fs.readdir(path, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path === '.' ? entry.name : `${path}/${entry.name}`;

                    // Skip node_modules and hidden files
                    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
                        continue;
                    }

                    if (entry.isDirectory()) {
                        await readDir(fullPath);
                    } else {
                        try {
                            const content = await container.fs.readFile(fullPath, 'utf-8');
                            files.push({ path: fullPath, content });
                        } catch {
                            // Skip unreadable files
                        }
                    }
                }
            } catch {
                // Directory doesn't exist or can't be read
            }
        }

        await readDir('.');
        return files;
    }, []);

    /**
     * Write files to WebContainer (restore snapshot)
     */
    const writeFilesToContainer = useCallback(async (files: FileState[]): Promise<void> => {
        const container = await WebContainerService.boot();

        for (const file of files) {
            // Ensure directory exists
            const dir = file.path.split('/').slice(0, -1).join('/');
            if (dir) {
                try {
                    await container.fs.mkdir(dir, { recursive: true });
                } catch {
                    // Directory might already exist
                }
            }

            // Write file
            await container.fs.writeFile(file.path, file.content);
        }
    }, []);

    /**
     * Create a snapshot of current state
     */
    const createSnapshot = useCallback(async (label?: string): Promise<Snapshot> => {
        const files = await readFilesFromContainer();
        const snapshotLabel = label || generateSnapshotLabel('Code change');
        return manager.createSnapshot(files, snapshotLabel);
    }, [manager, readFilesFromContainer]);

    /**
     * Restore a snapshot to WebContainer
     */
    const restoreSnapshot = useCallback(async (snapshot: Snapshot): Promise<void> => {
        await writeFilesToContainer(snapshot.files);
    }, [writeFilesToContainer]);

    /**
     * Undo - go to previous snapshot
     */
    const undo = useCallback(async (): Promise<void> => {
        const snapshot = manager.undo();
        if (snapshot) {
            await restoreSnapshot(snapshot);
        }
    }, [manager, restoreSnapshot]);

    /**
     * Redo - go to next snapshot
     */
    const redo = useCallback(async (): Promise<void> => {
        const snapshot = manager.redo();
        if (snapshot) {
            await restoreSnapshot(snapshot);
        }
    }, [manager, restoreSnapshot]);

    /**
     * Go to specific snapshot index
     */
    const goTo = useCallback(async (index: number): Promise<void> => {
        const snapshot = manager.goTo(index);
        if (snapshot) {
            await restoreSnapshot(snapshot);
        }
    }, [manager, restoreSnapshot]);

    /**
     * Clear all snapshots
     */
    const clear = useCallback((): void => {
        manager.clear();
    }, [manager]);

    return {
        snapshots: state.snapshots,
        currentIndex: state.currentIndex,
        currentSnapshot: state.snapshots[state.currentIndex] || null,
        canUndo: manager.canUndo(),
        canRedo: manager.canRedo(),
        createSnapshot,
        undo,
        redo,
        goTo,
        clear,
    };
}

export default useTimeTravel;
