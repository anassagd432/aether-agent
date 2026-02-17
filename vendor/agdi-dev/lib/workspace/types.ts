/**
 * Workspace Types
 * 
 * Type definitions for workspace visibility and session management.
 */

// ==================== TRUST LEVELS ====================

export type TrustLevel = 'trusted' | 'untrusted' | 'pending';

// ==================== WORKSPACE ROOT ====================

export interface WorkspaceRoot {
    path: string;           // Canonical absolute path
    trustLevel: TrustLevel;
    addedAt: number;
    addedBy: 'user' | 'cli' | 'system';
}

// ==================== SESSION STATE ====================

export interface WorkspaceSessionState {
    workspaceRoots: WorkspaceRoot[];
    activeRoot: string | null;  // Currently focused root
    cwd: string;                // Current working directory (canonical, within roots)
    fileIndex: Map<string, FileIndexEntry>;
    initialized: boolean;
}

export interface FileIndexEntry {
    path: string;
    type: 'file' | 'directory';
    size?: number;
    mtime?: number;
}

// ==================== SESSION EVENTS ====================

export type SessionEventType =
    | 'root_added'
    | 'root_removed'
    | 'root_trusted'
    | 'cwd_changed'
    | 'file_created'
    | 'file_modified'
    | 'file_deleted'
    | 'session_initialized';

export interface SessionEvent {
    type: SessionEventType;
    timestamp: number;
    path?: string;
    oldPath?: string;
    data?: unknown;
}

export type SessionEventHandler = (event: SessionEvent) => void;

// ==================== FILE OPERATIONS ====================

export interface ListDirResult {
    success: boolean;
    path: string;
    entries: DirEntry[];
    error?: string;
}

export interface DirEntry {
    name: string;
    path: string;
    type: 'file' | 'directory' | 'symlink';
    size?: number;
    mtime?: number;
}

export interface ReadFileResult {
    success: boolean;
    path: string;
    content?: string;
    size?: number;
    error?: string;
}

export interface WriteFileResult {
    success: boolean;
    path: string;
    bytesWritten?: number;
    error?: string;
}

export interface PathValidationResult {
    valid: boolean;
    canonicalPath: string;
    withinWorkspace: boolean;
    root?: string;
    error?: string;
}

// ==================== CWD CHANGE ====================

export interface CwdChangeResult {
    success: boolean;
    oldCwd: string;
    newCwd: string;
    error?: string;
}

// ==================== DEFAULTS ====================

export const DEFAULT_SESSION_STATE: WorkspaceSessionState = {
    workspaceRoots: [],
    activeRoot: null,
    cwd: '.',
    fileIndex: new Map(),
    initialized: false,
};
