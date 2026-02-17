/**
 * File System Utilities for CLI
 * Includes Code Firewall integration for security scanning
 */

import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import type { Project } from '../core/index.js';
import { validateCodeBeforeWrite } from '../security/code-firewall.js';

/**
 * Write project files to disk with security scanning
 */
export async function writeProject(project: Project, outputDir: string): Promise<void> {
    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    let blockedCount = 0;
    let writtenCount = 0;

    // Write all files with security scanning
    for (const file of project.files) {
        if (path.isAbsolute(file.path) || file.path.split('/').includes('..')) {
            blockedCount++;
            console.log(chalk.red(`⛔ BLOCKED (unsafe path): ${file.path}`));
            continue;
        }
        const filePath = path.join(outputDir, file.path);

        // Security scan before writing
        const isSafe = validateCodeBeforeWrite(file.content, file.path);

        if (!isSafe) {
            blockedCount++;
            console.log(chalk.red(`⛔ BLOCKED: ${file.path}`));
            continue;
        }

        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.content, 'utf-8');
        writtenCount++;
    }

    // Report summary
    console.log('');
    if (blockedCount > 0) {
        console.log(chalk.yellow(`⚠️  ${blockedCount} file(s) blocked by security scan`));
    }
    console.log(chalk.green(`✅ ${writtenCount} file(s) written successfully`));
}

/**
 * Write a single file with security scanning
 */
export async function writeFileSecure(filePath: string, content: string): Promise<boolean> {
    if (path.isAbsolute(filePath) || filePath.split('/').includes('..')) {
        return false;
    }

    const isSafe = validateCodeBeforeWrite(content, path.basename(filePath));

    if (!isSafe) {
        return false;
    }

    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
    return true;
}

/**
 * Read all files from a directory
 */
export async function readProjectFiles(
    dir: string
): Promise<{ path: string; content: string }[]> {
    const files: { path: string; content: string }[] = [];

    async function walk(currentPath: string, basePath: string) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);

            // Skip common non-source directories
            if (entry.isDirectory()) {
                if (!['node_modules', '.git', 'dist', '.next', 'build'].includes(entry.name)) {
                    await walk(fullPath, basePath);
                }
            } else {
                const content = await fs.readFile(fullPath, 'utf-8');
                files.push({ path: relativePath.replace(/\\/g, '/'), content });
            }
        }
    }

    await walk(dir, dir);
    return files;
}
