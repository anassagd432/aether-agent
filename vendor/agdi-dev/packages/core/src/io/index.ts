/**
 * IO Module - Export/Import functionality
 * Works in both Node.js and browser
 */

import JSZip from 'jszip';
import type { Project, GeneratedFile } from '../types/index.js';

export { Project, GeneratedFile };

/**
 * Serialize project to ZIP buffer
 */
export async function projectToZip(project: Project): Promise<Uint8Array> {
    const zip = new JSZip();

    // Add metadata
    zip.file('agdi-project.json', JSON.stringify({
        version: '1.0.0',
        name: project.name,
        description: project.description,
        prompt: project.prompt,
        dependencies: project.dependencies,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
    }, null, 2));

    // Add README
    zip.file('README.md', `# ${project.name}

Generated with [Agdi.dev](https://agdi-dev.vercel.app)

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Original Prompt
${project.prompt}

## Files
${project.files.map(f => `- ${f.path}`).join('\n')}
`);

    // Add all source files
    for (const file of project.files) {
        zip.file(file.path, file.content);
    }

    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Parse project from ZIP buffer
 */
export async function zipToProject(zipData: Uint8Array | ArrayBuffer): Promise<Project> {
    const zip = await JSZip.loadAsync(zipData);

    // Read metadata
    const metadataFile = zip.file('agdi-project.json');
    if (!metadataFile) {
        throw new Error('Invalid project ZIP: missing agdi-project.json');
    }

    const metadataContent = await metadataFile.async('string');
    const metadata = JSON.parse(metadataContent);

    // Read all source files
    const files: GeneratedFile[] = [];
    const promises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
        if (relativePath === 'agdi-project.json' || relativePath === 'README.md') return;
        if (zipEntry.dir) return;

        promises.push(
            zipEntry.async('string').then(content => {
                files.push({ path: relativePath, content });
            })
        );
    });

    await Promise.all(promises);

    return {
        id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `proj-${Date.now()}`,
        name: metadata.name,
        description: metadata.description || '',
        prompt: metadata.prompt,
        files,
        dependencies: metadata.dependencies || [],
        createdAt: new Date(metadata.createdAt),
        updatedAt: new Date(),
    };
}
