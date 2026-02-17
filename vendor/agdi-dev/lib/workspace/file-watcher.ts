/**
 * File Watcher
 * 
 * Polling-based file watching for browser (FileSystemDirectoryHandle).
 * Emits created/changed/deleted events.
 */

// ==================== TYPES ====================

export type WatchEventType = 'created' | 'changed' | 'deleted';

export interface WatchEvent {
    type: WatchEventType;
    path: string;
    timestamp: number;
}

export type WatchEventHandler = (event: WatchEvent) => void;

interface FileSnapshot {
    name: string;
    type: 'file' | 'directory';
    lastModified?: number;
    size?: number;
}

// ==================== WATCHER ====================

export class FileWatcher {
    private handle: FileSystemDirectoryHandle | null = null;
    private snapshot: Map<string, FileSnapshot> = new Map();
    private handlers: Set<WatchEventHandler> = new Set();
    private intervalId: number | null = null;
    private pollInterval: number;

    constructor(pollInterval: number = 2000) {
        this.pollInterval = pollInterval;
    }

    /**
     * Start watching a directory
     */
    async start(handle: FileSystemDirectoryHandle): Promise<void> {
        this.handle = handle;
        await this.buildSnapshot();
        if (typeof window !== 'undefined') {
            this.intervalId = window.setInterval(() => this.poll(), this.pollInterval);
        }
    }

    /**
     * Stop watching
     */
    stop(): void {
        if (this.intervalId !== null && typeof window !== 'undefined') {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.handle = null;
        this.snapshot.clear();
    }

    /**
     * Subscribe to watch events
     */
    subscribe(handler: WatchEventHandler): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    /**
     * Build initial snapshot
     */
    private async buildSnapshot(): Promise<void> {
        if (!this.handle) return;
        this.snapshot.clear();
        await this.scanDirectory(this.handle, '');
    }

    /**
     * Scan directory recursively
     */
    private async scanDirectory(dir: FileSystemDirectoryHandle, basePath: string): Promise<void> {
        try {
            for await (const entry of (dir as any).values()) {
                const path = basePath ? `${basePath}/${entry.name}` : entry.name;

                if (entry.kind === 'file') {
                    try {
                        const file = await entry.getFile();
                        this.snapshot.set(path, {
                            name: entry.name,
                            type: 'file',
                            lastModified: file.lastModified,
                            size: file.size,
                        });
                    } catch {
                        this.snapshot.set(path, {
                            name: entry.name,
                            type: 'file',
                        });
                    }
                } else {
                    this.snapshot.set(path, {
                        name: entry.name,
                        type: 'directory',
                    });
                    // Recursively scan
                    await this.scanDirectory(entry, path);
                }
            }
        } catch {
            // Skip inaccessible directories
        }
    }

    /**
     * Poll for changes
     */
    private async poll(): Promise<void> {
        if (!this.handle) return;

        const oldSnapshot = new Map(this.snapshot);
        this.snapshot.clear();
        await this.scanDirectory(this.handle, '');

        // Detect changes
        const events: WatchEvent[] = [];

        // Check for created and changed
        for (const [path, entry] of this.snapshot) {
            const old = oldSnapshot.get(path);
            if (!old) {
                events.push({ type: 'created', path, timestamp: Date.now() });
            } else if (entry.type === 'file' && old.type === 'file') {
                if (entry.lastModified !== old.lastModified || entry.size !== old.size) {
                    events.push({ type: 'changed', path, timestamp: Date.now() });
                }
            }
            oldSnapshot.delete(path);
        }

        // Remaining in oldSnapshot are deleted
        for (const [path] of oldSnapshot) {
            events.push({ type: 'deleted', path, timestamp: Date.now() });
        }

        // Emit events
        for (const event of events) {
            this.emit(event);
        }
    }

    /**
     * Emit event to all handlers
     */
    private emit(event: WatchEvent): void {
        this.handlers.forEach(handler => {
            try {
                handler(event);
            } catch (e) {
                console.error('Watch event handler error:', e);
            }
        });
    }

    /**
     * Check if watching
     */
    isWatching(): boolean {
        return this.intervalId !== null;
    }
}

// ==================== SINGLETON ====================

export const fileWatcher = new FileWatcher();
