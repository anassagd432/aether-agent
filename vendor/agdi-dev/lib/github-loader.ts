/**
 * GitHub Loader
 * 
 * Fetches public GitHub repositories as ZIP and converts to FileTree.
 * Works in browser by fetching via GitHub API.
 */

import JSZip from 'jszip';
import type { GeneratedFile } from './agdi-architect';

// ==================== TYPES ====================

export interface GitHubRepoInfo {
    owner: string;
    repo: string;
    branch: string;
}

export interface GitHubImportResult {
    files: GeneratedFile[];
    repoName: string;
    branch: string;
}

// ==================== URL PARSING ====================

/**
 * Parse a GitHub URL to extract owner, repo, and optional branch.
 * Supports formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/tree/branch
 * - github.com/owner/repo
 */
export function parseGitHubUrl(url: string): GitHubRepoInfo {
    // Clean up the URL
    let cleanUrl = url.trim();

    // Remove trailing slash
    if (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
    }

    // Remove protocol prefix if present
    cleanUrl = cleanUrl.replace(/^https?:\/\//, '');

    // Remove www. if present
    cleanUrl = cleanUrl.replace(/^www\./, '');

    // Validate it's a GitHub URL
    if (!cleanUrl.startsWith('github.com/')) {
        throw new Error('Invalid GitHub URL. Please use format: https://github.com/owner/repo');
    }

    // Extract path after github.com/
    const path = cleanUrl.replace('github.com/', '');
    const parts = path.split('/');

    if (parts.length < 2) {
        throw new Error('Invalid GitHub URL. Could not extract owner/repo.');
    }

    const owner = parts[0];
    const repo = parts[1];

    // Check for branch in URL (e.g., /tree/main or /tree/master)
    let branch = 'main'; // Default branch
    if (parts.length >= 4 && parts[2] === 'tree') {
        branch = parts[3];
    }

    return { owner, repo, branch };
}

// ==================== FETCH REPOSITORY ====================

/**
 * Fetch a GitHub repository as a ZIP archive.
 * Uses GitHub's zipball API endpoint.
 */
export async function fetchRepoAsZip(
    owner: string,
    repo: string,
    branch: string = 'main'
): Promise<ArrayBuffer> {
    // GitHub API endpoint for zipball
    const url = `https://api.github.com/repos/${owner}/${repo}/zipball/${branch}`;

    const response = await fetch(url, {
        headers: {
            'Accept': 'application/vnd.github+json',
            // Note: For private repos, you'd need Authorization header
        },
    });

    if (!response.ok) {
        if (response.status === 404) {
            // Try with 'master' branch if 'main' failed
            if (branch === 'main') {
                return fetchRepoAsZip(owner, repo, 'master');
            }
            throw new Error(`Repository not found: ${owner}/${repo}. Make sure it exists and is public.`);
        }
        if (response.status === 403) {
            throw new Error('Rate limit exceeded. Please try again later or use a GitHub token.');
        }
        throw new Error(`Failed to fetch repository: ${response.statusText}`);
    }

    return response.arrayBuffer();
}

// ==================== ZIP EXTRACTION ====================

/**
 * Convert a GitHub ZIP to GeneratedFile array.
 * Handles the GitHub ZIP structure where files are in a root folder.
 */
export async function convertZipToFiles(buffer: ArrayBuffer): Promise<GeneratedFile[]> {
    const zip = await JSZip.loadAsync(buffer);
    const files: GeneratedFile[] = [];
    const promises: Promise<void>[] = [];

    // GitHub zips have a root folder like "owner-repo-commithash/"
    // We need to strip this prefix
    let rootPrefix = '';

    zip.forEach((relativePath) => {
        if (!rootPrefix && relativePath.endsWith('/')) {
            rootPrefix = relativePath;
        }
    });

    zip.forEach((relativePath, zipEntry) => {
        // Skip directories
        if (zipEntry.dir) return;

        // Get path relative to root folder
        let cleanPath = relativePath;
        if (rootPrefix && relativePath.startsWith(rootPrefix)) {
            cleanPath = relativePath.slice(rootPrefix.length);
        }

        // Skip hidden files and common non-essential files
        if (cleanPath.startsWith('.') ||
            cleanPath.includes('/.') ||
            cleanPath === '' ||
            cleanPath.includes('node_modules/')) {
            return;
        }

        promises.push(
            zipEntry.async('string').then(content => {
                const name = cleanPath.split('/').pop() || cleanPath;
                files.push({
                    name,
                    path: cleanPath,
                    content,
                });
            }).catch(() => {
                // Skip binary files that can't be read as strings
            })
        );
    });

    await Promise.all(promises);

    return files;
}

// ==================== MAIN IMPORT FUNCTION ====================

/**
 * Import a GitHub repository from URL.
 * Returns files ready to mount in WebContainer.
 */
export async function importFromGitHub(
    url: string,
    onProgress?: (status: string) => void
): Promise<GitHubImportResult> {
    onProgress?.('Parsing GitHub URL...');
    const { owner, repo, branch } = parseGitHubUrl(url);

    onProgress?.(`Fetching ${owner}/${repo}...`);
    const zipBuffer = await fetchRepoAsZip(owner, repo, branch);

    onProgress?.('Extracting files...');
    const files = await convertZipToFiles(zipBuffer);

    if (files.length === 0) {
        throw new Error('No files found in repository. It might be empty or contain only binary files.');
    }

    onProgress?.(`Imported ${files.length} files`);

    return {
        files,
        repoName: repo,
        branch,
    };
}

export default importFromGitHub;
