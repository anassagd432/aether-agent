/**
 * Project Export
 * 
 * Exports the current project as a downloadable ZIP file.
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { LocalProject } from './local-project-manager';

export async function exportProjectAsZip(project: LocalProject): Promise<void> {
    const zip = new JSZip();

    // Add project metadata
    zip.file('agdi-project.json', JSON.stringify({
        version: '1.0.0',
        name: project.name,
        description: project.description,
        initialPrompt: project.initialPrompt,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        dependencies: project.dependencies,
    }, null, 2));

    // Add README with instructions
    zip.file('README.md', `# ${project.name}

This project was generated with Agdi.dev.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Re-import to Agdi

1. Visit https://agdi-dev.vercel.app
2. Click "Import Project"
3. Select this entire folder or ZIP file

## Project Info
- Created: ${new Date(project.createdAt).toLocaleString()}
- Last Updated: ${new Date(project.updatedAt).toLocaleString()}
- Dependencies: ${project.dependencies.length} packages
`);

    // Add all source files
    project.files.forEach(file => {
        zip.file(file.path, file.content);
    });

    // Generate and download
    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    const sanitizedName = project.name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 50);

    const filename = `${sanitizedName}-${Date.now()}.zip`;
    saveAs(blob, filename);
}
