/**
 * Project Import
 * 
 * Imports a project from a ZIP file or folder structure.
 */

import JSZip from 'jszip';
import type { LocalProject } from './local-project-manager';
import type { GeneratedFile } from './agdi-architect';

interface ProjectMetadata {
    version?: string;
    name: string;
    description?: string;
    initialPrompt: string;
    createdAt: number;
    updatedAt?: number;
    dependencies: string[];
}

export async function importProjectFromZip(file: File): Promise<LocalProject> {
    const zip = await JSZip.loadAsync(file);

    // Read metadata
    const metadataFile = zip.file('agdi-project.json');
    if (!metadataFile) {
        throw new Error('Invalid project file: missing agdi-project.json');
    }

    const metadataContent = await metadataFile.async('string');
    const metadata: ProjectMetadata = JSON.parse(metadataContent);

    // Read all source files (exclude metadata and README)
    const files: GeneratedFile[] = [];
    const promises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
        // Skip non-source files
        if (relativePath === 'agdi-project.json') return;
        if (relativePath === 'README.md') return;
        if (zipEntry.dir) return;

        promises.push(
            zipEntry.async('string').then(content => {
                const name = relativePath.split('/').pop() || relativePath;
                files.push({
                    name,
                    path: relativePath,
                    content,
                });
            })
        );
    });

    await Promise.all(promises);

    // Reconstruct project
    const project: LocalProject = {
        id: crypto.randomUUID(),
        name: metadata.name,
        description: metadata.description || '',
        initialPrompt: metadata.initialPrompt,
        createdAt: metadata.createdAt,
        updatedAt: Date.now(),
        files,
        dependencies: metadata.dependencies || [],
    };

    return project;
}

/**
 * Import from directory (using File System Access API)
 * Only works in modern browsers that support showDirectoryPicker
 */
export async function importProjectFromDirectory(): Promise<LocalProject> {
    if (!('showDirectoryPicker' in window)) {
        throw new Error('Your browser does not support directory import. Please use ZIP import instead.');
    }

    // @ts-expect-error - showDirectoryPicker is not in all TypeScript defs yet
    const dirHandle = await window.showDirectoryPicker();

    // Read metadata
    const metadataHandle = await dirHandle.getFileHandle('agdi-project.json');
    const metadataFile = await metadataHandle.getFile();
    const metadataContent = await metadataFile.text();
    const metadata: ProjectMetadata = JSON.parse(metadataContent);

    // Read all files recursively
    const files: GeneratedFile[] = [];

    async function readDirectory(handle: any, basePath = '') {
        for await (const entry of handle.values()) {
            const path = basePath ? `${basePath}/${entry.name}` : entry.name;

            // Skip metadata and README
            if (entry.name === 'agdi-project.json' || entry.name === 'README.md') continue;

            if (entry.kind === 'file') {
                const file = await entry.getFile();
                const content = await file.text();
                files.push({ name: entry.name, path, content });
            } else if (entry.kind === 'directory') {
                await readDirectory(entry, path);
            }
        }
    }

    await readDirectory(dirHandle);

    return {
        id: crypto.randomUUID(),
        name: metadata.name,
        description: metadata.description || '',
        initialPrompt: metadata.initialPrompt,
        createdAt: metadata.createdAt,
        updatedAt: Date.now(),
        files,
        dependencies: metadata.dependencies || [],
    };
}
