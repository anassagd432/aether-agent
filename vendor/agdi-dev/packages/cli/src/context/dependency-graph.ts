/**
 * Dependency Graph
 * Builds and queries relationships between files
 */

import type { ParsedFile } from './types.js';

export interface DependencyNode {
    file: string;
    imports: string[]; // Files this file imports
    exportedBy: string[]; // Files that export this
    usedBy: string[]; // Files that import this
}

export class DependencyGraph {
    private nodes: Map<string, DependencyNode>;

    constructor() {
        this.nodes = new Map();
    }

    /**
     * Build graph from parsed files
     */
    buildGraph(files: ParsedFile[]): void {
        this.nodes.clear();

        // Initialize nodes
        for (const file of files) {
            this.nodes.set(file.path, {
                file: file.path,
                imports: [],
                exportedBy: [],
                usedBy: [],
            });
        }

        // Build relationships
        for (const file of files) {
            const node = this.nodes.get(file.path)!;

            // Resolve import paths to absolute paths
            for (const imp of file.imports) {
                const resolvedPath = this.resolveImportPath(imp.source, file.path, files);
                if (resolvedPath && this.nodes.has(resolvedPath)) {
                    node.imports.push(resolvedPath);

                    // Update reverse relationship
                    const importedNode = this.nodes.get(resolvedPath)!;
                    importedNode.usedBy.push(file.path);
                }
            }
        }
    }

    /**
     * Get all dependencies of a file (depth-limited)
     */
    getDependencies(file: string, maxDepth: number = 3): string[] {
        const visited = new Set<string>();
        const result: string[] = [];

        const traverse = (currentFile: string, depth: number) => {
            if (depth > maxDepth || visited.has(currentFile)) return;

            visited.add(currentFile);
            const node = this.nodes.get(currentFile);

            if (!node) return;

            for (const dep of node.imports) {
                if (!visited.has(dep)) {
                    result.push(dep);
                    traverse(dep, depth + 1);
                }
            }
        };

        traverse(file, 0);
        return result;
    }

    /**
     * Get all files that depend on this file
     */
    getDependents(file: string, maxDepth: number = 2): string[] {
        const visited = new Set<string>();
        const result: string[] = [];

        const traverse = (currentFile: string, depth: number) => {
            if (depth > maxDepth || visited.has(currentFile)) return;

            visited.add(currentFile);
            const node = this.nodes.get(currentFile);

            if (!node) return;

            for (const dependent of node.usedBy) {
                if (!visited.has(dependent)) {
                    result.push(dependent);
                    traverse(dependent, depth + 1);
                }
            }
        };

        traverse(file, 0);
        return result;
    }

    /**
     * Find circular dependencies
     */
    findCircularDeps(): string[][] {
        const cycles: string[][] = [];
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const path: string[] = [];

        const dfs = (file: string): void => {
            visited.add(file);
            recursionStack.add(file);
            path.push(file);

            const node = this.nodes.get(file);
            if (node) {
                for (const dep of node.imports) {
                    if (!visited.has(dep)) {
                        dfs(dep);
                    } else if (recursionStack.has(dep)) {
                        // Found cycle
                        const cycleStart = path.indexOf(dep);
                        const cycle = path.slice(cycleStart);
                        cycles.push([...cycle, dep]);
                    }
                }
            }

            path.pop();
            recursionStack.delete(file);
        };

        for (const file of this.nodes.keys()) {
            if (!visited.has(file)) {
                dfs(file);
            }
        }

        return cycles;
    }

    /**
     * Get statistics about the graph
     */
    getStats(): { totalFiles: number; totalEdges: number; avgDeps: number } {
        const totalFiles = this.nodes.size;
        let totalEdges = 0;

        for (const node of this.nodes.values()) {
            totalEdges += node.imports.length;
        }

        return {
            totalFiles,
            totalEdges,
            avgDeps: totalFiles > 0 ? totalEdges / totalFiles : 0,
        };
    }

    /**
     * Resolve import path to absolute file path
     */
    private resolveImportPath(importSource: string, fromFile: string, allFiles: ParsedFile[]): string | null {
        // Handle relative imports (./file or ../file)
        if (importSource.startsWith('.')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            const resolved = this.normalizePath(`${fromDir}/${importSource}`);

            // Try with common extensions
            for (const ext of ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']) {
                const withExt = resolved + ext;
                if (allFiles.some(f => f.path === withExt)) {
                    return withExt;
                }
            }
        }

        // Package imports (node_modules) - not resolved to local files
        // We only track local file dependencies

        return null;
    }

    /**
     * Normalize path (remove .., etc.)
     */
    private normalizePath(path: string): string {
        const parts = path.split('/');
        const result: string[] = [];

        for (const part of parts) {
            if (part === '..') {
                result.pop();
            } else if (part !== '.' && part !== '') {
                result.push(part);
            }
        }

        return result.join('/');
    }

    /**
     * Export graph to JSON
     */
    toJSON(): any {
        return {
            nodes: Array.from(this.nodes.entries()).map(([file, node]) => ({
                ...node,
            })),
        };
    }

    /**
     * Import graph from JSON
     */
    fromJSON(data: any): void {
        this.nodes.clear();
        for (const node of data.nodes) {
            this.nodes.set(node.file, {
                file: node.file,
                imports: node.imports,
                exportedBy: node.exportedBy,
                usedBy: node.usedBy,
            });
        }
    }
}
