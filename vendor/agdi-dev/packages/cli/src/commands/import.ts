#!/usr/bin/env node

/**
 * Agdi Import Command
 * 
 * Import a GitHub repository into the current workspace.
 * Fetches the repo as a ZIP and extracts files.
 */

import chalk from 'chalk';
import ora from 'ora';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';

// ==================== TYPES ====================

interface GitHubRepoInfo {
    owner: string;
    repo: string;
    branch: string;
}

interface ImportedFile {
    path: string;
    content: string;
}

function sanitizeRelativePath(p: string): string | null {
    if (!p || p.startsWith('/') || p.match(/^[A-Za-z]:/)) return null;
    const normalized = p.replace(/\\/g, '/');
    if (normalized.split('/').some(part => part === '..')) return null;
    return normalized;
}

// ==================== URL PARSING ====================

function parseGitHubUrl(url: string): GitHubRepoInfo {
    let cleanUrl = url.trim();

    if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
    }

    cleanUrl = cleanUrl.replace(/^https?:\/\//, '');
    cleanUrl = cleanUrl.replace(/^www\./, '');

    if (!cleanUrl.startsWith('github.com/')) {
        throw new Error('Invalid GitHub URL. Please use format: https://github.com/owner/repo');
    }

    const path = cleanUrl.replace('github.com/', '');
    const parts = path.split('/');

    if (parts.length < 2) {
        throw new Error('Invalid GitHub URL. Could not extract owner/repo.');
    }

    const owner = parts[0];
    const repo = parts[1];

    let branch = 'main';
    if (parts.length >= 4 && parts[2] === 'tree') {
        branch = parts[3];
    }

    return { owner, repo, branch };
}

// ==================== FETCH & EXTRACT ====================

async function fetchRepoAsZip(
    owner: string,
    repo: string,
    branch: string
): Promise<ArrayBuffer> {
    const url = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Agdi-CLI',
        },
    });

    if (!response.ok) {
        if (response.status === 404) {
            if (branch === 'main') {
                return fetchRepoAsZip(owner, repo, 'master');
            }
            throw new Error(`Repository not found: ${owner}/${repo}. Make sure it exists and is public.`);
        }
        if (response.status === 403) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`Failed to fetch repository: ${response.statusText}`);
    }

    return response.arrayBuffer();
}

async function extractZipToFiles(buffer: ArrayBuffer): Promise<ImportedFile[]> {
    // Dynamic import for JSZip (ESM compatible)
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const files: ImportedFile[] = [];
    const promises: Promise<void>[] = [];

    // GitHub zips have a root folder like "owner-repo-commithash/"
    let rootPrefix = '';

    zip.forEach((relativePath) => {
        if (!rootPrefix && relativePath.endsWith('/')) {
            rootPrefix = relativePath;
        }
    });

    zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;

        let cleanPath = relativePath;
        if (rootPrefix && relativePath.startsWith(rootPrefix)) {
            cleanPath = relativePath.slice(rootPrefix.length);
        }

        // Skip hidden files and node_modules
        if (cleanPath.startsWith('.') ||
            cleanPath.includes('/.') ||
            cleanPath === '' ||
            cleanPath.includes('node_modules/')) {
            return;
        }

        const safePath = sanitizeRelativePath(cleanPath);
        if (!safePath) return;

        promises.push(
            zipEntry.async('string').then(content => {
                files.push({ path: safePath, content });
            }).catch(() => {
                // Skip binary files
            })
        );
    });

    await Promise.all(promises);
    return files;
}

// ==================== WRITE TO DISK ====================

async function writeFiles(files: ImportedFile[], outputDir: string): Promise<void> {
    for (const file of files) {
        const fullPath = join(outputDir, file.path);
        const dir = dirname(fullPath);

        await mkdir(dir, { recursive: true });
        await writeFile(fullPath, file.content, 'utf-8');
    }
}

// ==================== MAIN COMMAND ====================

export async function runImportCommand(url: string, outputDir?: string): Promise<void> {
    console.log(chalk.cyan.bold('\n📦 Agdi Import\n'));

    const spinner = ora('Parsing GitHub URL...').start();

    try {
        const { owner, repo, branch } = parseGitHubUrl(url);
        const targetDir = outputDir || `./${repo}`;

        spinner.text = `Fetching ${owner}/${repo} (${branch})...`;
        const zipBuffer = await fetchRepoAsZip(owner, repo, branch);

        spinner.text = 'Extracting files...';
        const files = await extractZipToFiles(zipBuffer);

        if (files.length === 0) {
            spinner.fail('No files found in repository');
            return;
        }

        spinner.text = `Writing ${files.length} files to ${targetDir}...`;
        await writeFiles(files, targetDir);

        spinner.succeed(chalk.green(`Imported ${files.length} files to ${chalk.cyan(targetDir)}`));

        console.log(chalk.gray(`\nNext steps:`));
        console.log(chalk.gray(`  cd ${targetDir}`));
        console.log(chalk.gray(`  npm install`));
        console.log(chalk.gray(`  npm run dev\n`));

    } catch (error) {
        spinner.fail('Import failed');
        const msg = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`\n${msg}\n`));
        process.exit(1);
    }
}

export default runImportCommand;
