/**
 * Snapshot Manager - WebContainer State Time-Travel
 * 
 * Creates snapshots of the entire file system state for instant rollback.
 * "Ctrl+Z for the entire application state"
 */

// ==================== TYPES ====================

export interface FileState {
    path: string;
    content: string;
}

export interface Snapshot {
    id: string;
    timestamp: number;
    label: string;
    description?: string;
    files: FileState[];
    previewUrl?: string;
}

export interface TimelineState {
    snapshots: Snapshot[];
    currentIndex: number;
    maxSnapshots: number;
}

// ==================== SNAPSHOT MANAGER ====================

export class SnapshotManager {
    private snapshots: Snapshot[] = [];
    private currentIndex: number = -1;
    private maxSnapshots: number;
    private listeners: Set<(state: TimelineState) => void> = new Set();

    constructor(maxSnapshots: number = 50) {
        this.maxSnapshots = maxSnapshots;
    }

    /**
     * Create a new snapshot of the current file state
     */
    createSnapshot(files: FileState[], label: string, description?: string): Snapshot {
        const snapshot: Snapshot = {
            id: `snap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            label,
            description,
            files: files.map(f => ({ ...f })), // Deep copy
        };

        // If we're not at the end, truncate future snapshots (like git)
        if (this.currentIndex < this.snapshots.length - 1) {
            this.snapshots = this.snapshots.slice(0, this.currentIndex + 1);
        }

        // Add new snapshot
        this.snapshots.push(snapshot);
        this.currentIndex = this.snapshots.length - 1;

        // Trim old snapshots if exceeding max
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
            this.currentIndex = Math.max(0, this.currentIndex - 1);
        }

        this.notifyListeners();
        return snapshot;
    }

    /**
     * Get snapshot by ID
     */
    getSnapshot(snapshotId: string): Snapshot | null {
        return this.snapshots.find(s => s.id === snapshotId) || null;
    }

    /**
     * Get snapshot at specific index
     */
    getSnapshotAt(index: number): Snapshot | null {
        return this.snapshots[index] || null;
    }

    /**
     * Navigate to a specific snapshot (restore state)
     */
    goTo(index: number): Snapshot | null {
        if (index < 0 || index >= this.snapshots.length) {
            return null;
        }
        this.currentIndex = index;
        this.notifyListeners();
        return this.snapshots[index];
    }

    /**
     * Go to previous snapshot (undo)
     */
    undo(): Snapshot | null {
        if (this.currentIndex <= 0) {
            return null;
        }
        return this.goTo(this.currentIndex - 1);
    }

    /**
     * Go to next snapshot (redo)
     */
    redo(): Snapshot | null {
        if (this.currentIndex >= this.snapshots.length - 1) {
            return null;
        }
        return this.goTo(this.currentIndex + 1);
    }

    /**
     * Get current timeline state
     */
    getState(): TimelineState {
        return {
            snapshots: [...this.snapshots],
            currentIndex: this.currentIndex,
            maxSnapshots: this.maxSnapshots,
        };
    }

    /**
     * Get current snapshot
     */
    getCurrent(): Snapshot | null {
        return this.snapshots[this.currentIndex] || null;
    }

    /**
     * Check if undo is available
     */
    canUndo(): boolean {
        return this.currentIndex > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo(): boolean {
        return this.currentIndex < this.snapshots.length - 1;
    }

    /**
     * Subscribe to state changes
     */
    subscribe(listener: (state: TimelineState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Clear all snapshots
     */
    clear(): void {
        this.snapshots = [];
        this.currentIndex = -1;
        this.notifyListeners();
    }

    /**
     * Get snapshot count
     */
    get length(): number {
        return this.snapshots.length;
    }

    private notifyListeners(): void {
        const state = this.getState();
        this.listeners.forEach(listener => listener(state));
    }
}

// ==================== SINGLETON INSTANCE ====================

let globalSnapshotManager: SnapshotManager | null = null;

export function getSnapshotManager(): SnapshotManager {
    if (!globalSnapshotManager) {
        globalSnapshotManager = new SnapshotManager();
    }
    return globalSnapshotManager;
}

// ==================== HELPERS ====================

/**
 * Generate a human-readable label for auto-snapshots
 */
export function generateSnapshotLabel(action: string): string {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return `${action} @ ${time}`;
}
