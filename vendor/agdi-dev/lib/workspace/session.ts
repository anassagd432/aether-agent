/**
 * Workspace Session
 * 
 * Singleton managing workspace state: roots, cwd, and trust levels.
 * Single source of truth for workspace visibility.
 */

import type {
    WorkspaceSessionState,
    WorkspaceRoot,
    TrustLevel,
    SessionEvent,
    SessionEventType,
    SessionEventHandler,
    CwdChangeResult,
    PathValidationResult,
} from './types';
import { DEFAULT_SESSION_STATE } from './types';
import { auditLogger } from '../security/audit-logger';

// ==================== PATH UTILITIES ====================

/**
 * Normalize path separators to forward slashes
 */
function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
}

/**
 * Resolve a path to canonical form
 * In browser, this is simplified (no actual realpath)
 */
function canonicalizePath(p: string, base?: string): string {
    let normalized = normalizePath(p);

    // Handle relative paths
    if (!normalized.startsWith('/') && !normalized.match(/^[A-Za-z]:/)) {
        if (base) {
            normalized = `${normalizePath(base)}/${normalized}`;
        }
    }

    // Resolve . and ..
    const parts = normalized.split('/').filter(Boolean);
    const resolved: string[] = [];

    for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') {
            resolved.pop();
        } else {
            resolved.push(part);
        }
    }

    // Preserve Windows drive letter
    if (normalized.match(/^[A-Za-z]:/)) {
        return resolved.join('/');
    }

    return '/' + resolved.join('/');
}

/**
 * Check if path is within a root
 */
function isPathWithinRoot(path: string, root: string): boolean {
    const normalizedPath = normalizePath(path).toLowerCase();
    const normalizedRoot = normalizePath(root).toLowerCase();
    return normalizedPath.startsWith(normalizedRoot + '/') ||
        normalizedPath === normalizedRoot;
}

// ==================== WORKSPACE SESSION ====================

class WorkspaceSession {
    private state: WorkspaceSessionState;
    private eventHandlers: Set<SessionEventHandler> = new Set();

    constructor() {
        this.state = { ...DEFAULT_SESSION_STATE };
    }

    // ==================== INITIALIZATION ====================

    /**
     * Initialize session with a workspace root
     */
    initialize(rootPath: string, trustLevel: TrustLevel = 'pending'): void {
        const canonical = canonicalizePath(rootPath);

        this.state.workspaceRoots = [{
            path: canonical,
            trustLevel,
            addedAt: Date.now(),
            addedBy: 'user',
        }];
        this.state.activeRoot = canonical;
        this.state.cwd = canonical;
        this.state.initialized = true;

        this.emit('session_initialized', canonical);

        auditLogger.log({
            type: 'config_changed',
            metadata: {
                action: 'session_initialized',
                root: canonical,
                trustLevel,
            },
        });
    }

    /**
     * Check if session is initialized
     */
    isInitialized(): boolean {
        return this.state.initialized;
    }

    // ==================== ROOT MANAGEMENT ====================

    /**
     * Add a new workspace root
     */
    addRoot(path: string, trustLevel: TrustLevel = 'pending'): boolean {
        const canonical = canonicalizePath(path);

        // Check if already exists
        if (this.state.workspaceRoots.some(r => r.path === canonical)) {
            return false;
        }

        this.state.workspaceRoots.push({
            path: canonical,
            trustLevel,
            addedAt: Date.now(),
            addedBy: 'user',
        });

        if (!this.state.activeRoot) {
            this.state.activeRoot = canonical;
            this.state.cwd = canonical;
        }

        this.emit('root_added', canonical);
        return true;
    }

    /**
     * Remove a workspace root
     */
    removeRoot(path: string): boolean {
        const canonical = canonicalizePath(path);
        const index = this.state.workspaceRoots.findIndex(r => r.path === canonical);

        if (index === -1) return false;

        this.state.workspaceRoots.splice(index, 1);

        // Update active root if removed
        if (this.state.activeRoot === canonical) {
            this.state.activeRoot = this.state.workspaceRoots[0]?.path || null;
            if (this.state.activeRoot) {
                this.state.cwd = this.state.activeRoot;
            }
        }

        this.emit('root_removed', canonical);
        return true;
    }

    /**
     * Trust a workspace root
     */
    trustRoot(path: string): boolean {
        const canonical = canonicalizePath(path);
        const root = this.state.workspaceRoots.find(r => r.path === canonical);

        if (!root) return false;

        root.trustLevel = 'trusted';
        this.emit('root_trusted', canonical);
        return true;
    }

    /**
     * Get all workspace roots
     */
    getRoots(): WorkspaceRoot[] {
        return [...this.state.workspaceRoots];
    }

    /**
     * Get active root
     */
    getActiveRoot(): string | null {
        return this.state.activeRoot;
    }

    /**
     * Check if a root is trusted
     */
    isRootTrusted(path: string): boolean {
        const canonical = canonicalizePath(path);
        const root = this.state.workspaceRoots.find(r => r.path === canonical);
        return root?.trustLevel === 'trusted';
    }

    // ==================== CWD MANAGEMENT ====================

    /**
     * Get current working directory
     */
    getCwd(): string {
        return this.state.cwd;
    }

    /**
     * Change current working directory
     */
    changeCwd(newPath: string): CwdChangeResult {
        const oldCwd = this.state.cwd;

        // Resolve relative to current cwd
        const canonical = canonicalizePath(newPath, this.state.cwd);

        // Validate path is within workspace
        const validation = this.validatePath(canonical);
        if (!validation.valid || !validation.withinWorkspace) {
            return {
                success: false,
                oldCwd,
                newCwd: canonical,
                error: validation.error || 'Path is outside workspace',
            };
        }

        this.state.cwd = canonical;

        // Update active root if cwd is in different root
        const matchingRoot = this.state.workspaceRoots.find(r =>
            isPathWithinRoot(canonical, r.path)
        );
        if (matchingRoot) {
            this.state.activeRoot = matchingRoot.path;
        }

        this.emit('cwd_changed', canonical, oldCwd);

        auditLogger.log({
            type: 'config_changed',
            metadata: {
                action: 'cwd_changed',
                oldCwd,
                newCwd: canonical,
            },
        });

        return {
            success: true,
            oldCwd,
            newCwd: canonical,
        };
    }

    // ==================== PATH VALIDATION ====================

    /**
     * Validate a path against workspace roots
     */
    validatePath(path: string): PathValidationResult {
        const canonical = canonicalizePath(path, this.state.cwd);

        // Check symlink escape (simplified - just path check)
        // In real implementation, would use fs.realpathSync

        // Find matching root
        for (const root of this.state.workspaceRoots) {
            if (isPathWithinRoot(canonical, root.path)) {
                return {
                    valid: true,
                    canonicalPath: canonical,
                    withinWorkspace: true,
                    root: root.path,
                };
            }
        }

        return {
            valid: false,
            canonicalPath: canonical,
            withinWorkspace: false,
            error: 'Path is outside all workspace roots',
        };
    }

    /**
     * Resolve a path relative to cwd
     */
    resolvePath(path: string): string {
        if (path.startsWith('/') || path.match(/^[A-Za-z]:/)) {
            return canonicalizePath(path);
        }
        return canonicalizePath(path, this.state.cwd);
    }

    /**
     * Get workspace roots as string array (for permission manager)
     */
    getWorkspaceRootsArray(): string[] {
        return this.state.workspaceRoots.map(r => r.path);
    }

    // ==================== EVENT HANDLING ====================

    /**
     * Subscribe to session events
     */
    subscribe(handler: SessionEventHandler): () => void {
        this.eventHandlers.add(handler);
        return () => this.eventHandlers.delete(handler);
    }

    /**
     * Emit an event
     */
    private emit(type: SessionEventType, path?: string, oldPath?: string): void {
        const event: SessionEvent = {
            type,
            timestamp: Date.now(),
            path,
            oldPath,
        };

        this.eventHandlers.forEach(handler => {
            try {
                handler(event);
            } catch (e) {
                console.error('Session event handler error:', e);
            }
        });
    }

    // ==================== STATE ACCESS ====================

    /**
     * Get full session state (for debugging)
     */
    getState(): WorkspaceSessionState {
        return { ...this.state };
    }

    /**
     * Reset session
     */
    reset(): void {
        this.state = { ...DEFAULT_SESSION_STATE };
    }
}

// ==================== SINGLETON ====================

export const workspaceSession = new WorkspaceSession();
export { WorkspaceSession, canonicalizePath, isPathWithinRoot, normalizePath };
