/**
 * Project Store Tests
 * 
 * Tests for IndexedDB-based project persistence.
 * Uses fake-indexeddb for mocking in jsdom.
 */

// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// Must import after fake-indexeddb setup
import * as db from '../indexeddb-store';
import * as projectStore from '../project-store';
import type { LocalProject } from '../../local-project-manager';

// ==================== TEST DATA ====================

const createMockProject = (overrides: Partial<LocalProject> = {}): LocalProject => ({
    id: crypto.randomUUID(),
    name: 'Test Project',
    description: 'A test project',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    files: [
        { name: 'App.tsx', path: 'src/App.tsx', content: 'export default function App() { return <div>Hello</div>; }' },
        { name: 'index.css', path: 'src/index.css', content: 'body { margin: 0; }' },
    ],
    dependencies: ['react', 'react-dom'],
    initialPrompt: 'Build a todo app',
    ...overrides,
});

// ==================== TESTS ====================

describe('project-store', () => {
    beforeAll(async () => {
        // Initialize database
        await db.openDatabase();
    });

    beforeEach(async () => {
        // Clear all data before each test
        await projectStore.clearAllData();
    });

    afterEach(() => {
        // Cleanup if needed
    });

    describe('saveProject', () => {
        it('should save a project to IndexedDB', async () => {
            const project = createMockProject({ name: 'My Saved Project' });

            await projectStore.saveProject(project);

            const loaded = await projectStore.loadProject(project.id);
            expect(loaded).not.toBeNull();
            expect(loaded?.name).toBe('My Saved Project');
            expect(loaded?.files.length).toBe(2);
        });

        it('should update an existing project', async () => {
            const project = createMockProject({ name: 'Original Name' });
            await projectStore.saveProject(project);

            // Update and save again
            project.name = 'Updated Name';
            project.files.push({ name: 'new.ts', path: 'new.ts', content: '' });
            await projectStore.saveProject(project);

            const loaded = await projectStore.loadProject(project.id);
            expect(loaded?.name).toBe('Updated Name');
            expect(loaded?.files.length).toBe(3);
        });
    });

    describe('loadProject', () => {
        it('should return null for non-existent project', async () => {
            const loaded = await projectStore.loadProject('non-existent-id');
            expect(loaded).toBeNull();
        });

        it('should load a saved project with all fields', async () => {
            const project = createMockProject({
                name: 'Full Project',
                description: 'Has all fields',
                initialPrompt: 'Build a dashboard',
            });
            await projectStore.saveProject(project);

            const loaded = await projectStore.loadProject(project.id);
            expect(loaded?.name).toBe('Full Project');
            expect(loaded?.description).toBe('Has all fields');
            expect(loaded?.initialPrompt).toBe('Build a dashboard');
            expect(loaded?.files).toHaveLength(2);
            expect(loaded?.dependencies).toContain('react');
        });
    });

    describe('listProjects', () => {
        it('should return empty array when no projects', async () => {
            const projects = await projectStore.listProjects();
            expect(projects).toEqual([]);
        });

        it('should list all projects with metadata', async () => {
            await projectStore.saveProject(createMockProject({ name: 'Project 1' }));
            await projectStore.saveProject(createMockProject({ name: 'Project 2' }));
            await projectStore.saveProject(createMockProject({ name: 'Project 3' }));

            const projects = await projectStore.listProjects();
            expect(projects).toHaveLength(3);
            expect(projects.map(p => p.name)).toContain('Project 1');
            expect(projects.map(p => p.name)).toContain('Project 2');
            expect(projects.map(p => p.name)).toContain('Project 3');
        });

        it('should return projects sorted by savedAt (most recent first)', async () => {
            const p1 = createMockProject({ name: 'First' });
            const p2 = createMockProject({ name: 'Second' });
            const p3 = createMockProject({ name: 'Third' });

            await projectStore.saveProject(p1);
            await new Promise(r => setTimeout(r, 10)); // Small delay
            await projectStore.saveProject(p2);
            await new Promise(r => setTimeout(r, 10));
            await projectStore.saveProject(p3);

            const projects = await projectStore.listProjects();
            expect(projects[0].name).toBe('Third');
            expect(projects[2].name).toBe('First');
        });

        it('should include fileCount in metadata', async () => {
            await projectStore.saveProject(createMockProject({
                name: 'With Files',
                files: [
                    { name: 'a.ts', path: 'a.ts', content: '' },
                    { name: 'b.ts', path: 'b.ts', content: '' },
                    { name: 'c.ts', path: 'c.ts', content: '' },
                ],
            }));

            const projects = await projectStore.listProjects();
            expect(projects[0].fileCount).toBe(3);
        });
    });

    describe('deleteProject', () => {
        it('should delete a project', async () => {
            const project = createMockProject({ name: 'To Delete' });
            await projectStore.saveProject(project);

            // Verify it exists
            const beforeDelete = await projectStore.loadProject(project.id);
            expect(beforeDelete).not.toBeNull();

            // Delete it
            await projectStore.deleteProject(project.id);

            // Verify it's gone
            const afterDelete = await projectStore.loadProject(project.id);
            expect(afterDelete).toBeNull();
        });

        it('should not throw when deleting non-existent project', async () => {
            await expect(projectStore.deleteProject('non-existent')).resolves.toBeUndefined();
        });
    });

    describe('projectExists', () => {
        it('should return true for existing project', async () => {
            const project = createMockProject();
            await projectStore.saveProject(project);

            const exists = await projectStore.projectExists(project.id);
            expect(exists).toBe(true);
        });

        it('should return false for non-existent project', async () => {
            const exists = await projectStore.projectExists('non-existent');
            expect(exists).toBe(false);
        });
    });

    describe('getProjectCount', () => {
        it('should return 0 when no projects', async () => {
            const count = await projectStore.getProjectCount();
            expect(count).toBe(0);
        });

        it('should return correct count', async () => {
            await projectStore.saveProject(createMockProject());
            await projectStore.saveProject(createMockProject());
            await projectStore.saveProject(createMockProject());

            const count = await projectStore.getProjectCount();
            expect(count).toBe(3);
        });
    });
});
