/**
 * Workspace Test Suite
 * 
 * Tests for workspace visibility, cwd persistence, and path safety.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { workspaceSession, normalizePath } from '../session';
import { validatePath } from '../fs-hardened';

// ==================== PATH VALIDATION TESTS ====================

describe('Path Validation', () => {
    beforeEach(() => {
        workspaceSession.reset();
    });

    it('blocks absolute paths', () => {
        const result = validatePath('/etc/passwd', '/project');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Absolute paths not allowed');
    });

    it('blocks Windows absolute paths', () => {
        const result = validatePath('C:\\Windows\\System32', '/project');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Absolute paths not allowed');
    });

    it('blocks path traversal with ..', () => {
        const result = validatePath('../secret', '/project');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('cannot escape root');
    });

    it('blocks nested path traversal', () => {
        const result = validatePath('foo/../../secret', '/project');
        expect(result.valid).toBe(false);
        expect(result.error).toContain('cannot escape root');
    });

    it('allows relative paths within root', () => {
        const result = validatePath('src/components', '/project');
        expect(result.valid).toBe(true);
        expect(result.normalized).toBe('src/components');
    });

    it('normalizes paths with .', () => {
        const result = validatePath('./src/../lib', '/project');
        expect(result.valid).toBe(true);
        expect(result.normalized).toBe('lib');
    });

    it('allows current directory', () => {
        const result = validatePath('.', '/project');
        expect(result.valid).toBe(true);
        expect(result.normalized).toBe('.');
    });
});

// ==================== WORKSPACE SESSION TESTS ====================

describe('WorkspaceSession', () => {
    beforeEach(() => {
        workspaceSession.reset();
    });

    it('initializes with a root', () => {
        workspaceSession.initialize('/project', 'trusted');
        expect(workspaceSession.isInitialized()).toBe(true);
        expect(workspaceSession.getCwd()).toBe('/project');
        expect(workspaceSession.getActiveRoot()).toBe('/project');
    });

    it('tracks cwd changes', () => {
        workspaceSession.initialize('/project', 'trusted');
        const result = workspaceSession.changeCwd('src');
        expect(result.success).toBe(true);
        expect(result.newCwd).toBe('/project/src');
    });

    it('blocks cwd outside workspace', () => {
        workspaceSession.initialize('/project', 'trusted');
        const result = workspaceSession.changeCwd('/etc');
        expect(result.success).toBe(false);
        expect(result.error).toContain('outside');
    });

    it('supports multiple roots', () => {
        workspaceSession.initialize('/project1', 'trusted');
        workspaceSession.addRoot('/project2', 'trusted');

        const roots = workspaceSession.getRoots();
        expect(roots).toHaveLength(2);
        expect(roots.map(r => r.path)).toContain('/project1');
        expect(roots.map(r => r.path)).toContain('/project2');
    });

    it('can switch between roots', () => {
        workspaceSession.initialize('/project1', 'trusted');
        workspaceSession.addRoot('/project2', 'trusted');

        const result = workspaceSession.changeCwd('/project2');
        expect(result.success).toBe(true);
        expect(workspaceSession.getCwd()).toBe('/project2');
    });

    it('trusts roots', () => {
        workspaceSession.initialize('/project', 'pending');
        expect(workspaceSession.isRootTrusted('/project')).toBe(false);

        workspaceSession.trustRoot('/project');
        expect(workspaceSession.isRootTrusted('/project')).toBe(true);
    });

    it('validates paths against all roots', () => {
        workspaceSession.initialize('/project1', 'trusted');
        workspaceSession.addRoot('/project2', 'trusted');

        // Valid - in first root
        const v1 = workspaceSession.validatePath('/project1/src');
        expect(v1.valid).toBe(true);

        // Valid - in second root
        const v2 = workspaceSession.validatePath('/project2/lib');
        expect(v2.valid).toBe(true);

        // Invalid - outside both roots
        const v3 = workspaceSession.validatePath('/other');
        expect(v3.valid).toBe(false);
    });
});

// ==================== PATH NORMALIZATION TESTS ====================

describe('Path Normalization', () => {
    it('normalizes backslashes', () => {
        expect(normalizePath('foo\\bar\\baz')).toBe('foo/bar/baz');
    });

    it('normalizes mixed slashes', () => {
        expect(normalizePath('foo/bar\\baz/qux')).toBe('foo/bar/baz/qux');
    });
});

// ==================== INTEGRATION TESTS ====================

describe('Workspace Integration', () => {
    beforeEach(() => {
        workspaceSession.reset();
    });

    it('persist/restore flow', () => {
        // Simulate: pick folder -> trust -> check
        workspaceSession.initialize('/my-project', 'pending');
        workspaceSession.trustRoot('/my-project');
        workspaceSession.changeCwd('src');

        // Verify state
        expect(workspaceSession.getCwd()).toBe('/my-project/src');
        expect(workspaceSession.isRootTrusted('/my-project')).toBe(true);
    });

    it('multi-root consistency', () => {
        // Add roots
        workspaceSession.initialize('/project-a', 'trusted');
        workspaceSession.addRoot('/project-b', 'trusted');

        // /directory show should list both
        const roots = workspaceSession.getWorkspaceRootsArray();
        expect(roots).toEqual(['/project-a', '/project-b']);

        // Switch and verify cwd persists
        workspaceSession.changeCwd('/project-b/src');
        expect(workspaceSession.getCwd()).toBe('/project-b/src');
    });
});
