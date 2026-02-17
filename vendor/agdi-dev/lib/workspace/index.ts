/**
 * Workspace Module Exports
 */

export * from './types';
export {
    workspaceSession,
    WorkspaceSession,
    canonicalizePath,
    isPathWithinRoot,
    normalizePath,
} from './session';
export * from './fs-adapter';
export * from './commands';
export * from './handle-store';
export * from './fs-hardened';
export { fileWatcher, type WatchEvent, type WatchEventType } from './file-watcher';
