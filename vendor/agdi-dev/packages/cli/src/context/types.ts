/**
 * Code Parser Types
 * Interfaces for parsed code structures
 */

export interface ParsedFile {
    path: string;
    language: string;
    symbols: Symbol[];
    imports: Import[];
    exports: Export[];
    dependencies: string[];
    lastModified: number;
    hash: string; // For change detection
}

export interface Symbol {
    name: string;
    type: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'enum';
    line: number;
    endLine?: number;
    signature: string;
    docstring?: string;
    isExported: boolean;
}

export interface Import {
    source: string; // Module being imported from
    names: string[]; // Imported names
    isDefault: boolean;
    line: number;
}

export interface Export {
    name: string;
    type: 'default' | 'named';
    line: number;
}

/**
 * Abstract Code Parser
 */
export abstract class CodeParser {
    /**
     * Parse a file and extract structure
     */
    abstract parse(content: string, filePath: string): ParsedFile;

    /**
     * Get supported file extensions
     */
    abstract getSupportedExtensions(): string[];

    /**
     * Check if parser supports this file
     */
    canParse(filePath: string): boolean {
        const ext = filePath.split('.').pop()?.toLowerCase();
        return ext ? this.getSupportedExtensions().includes(ext) : false;
    }
}
