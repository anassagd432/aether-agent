/**
 * TypeScript/JavaScript Code Parser
 * Uses @babel/parser for robust TS/JS parsing
 */

import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
// @ts-expect-error @babel/traverse has a CJS/ESM interop default export mismatch depending on bundler
const traverse = _traverse.default || _traverse;
import * as t from '@babel/types';
import { createHash } from 'crypto';
import { CodeParser, ParsedFile, Symbol, Import, Export } from './types.js';

export class TypeScriptParser extends CodeParser {
    parse(content: string, filePath: string): ParsedFile {
        const hash = createHash('md5').update(content).digest('hex');
        
        try {
            // Parse with TypeScript support
            const ast = babelParse(content, {
                sourceType: 'module',
                plugins: [
                    'typescript',
                    'jsx',
                    'decorators-legacy',
                    'classProperties',
                    'objectRestSpread',
                ],
            });

            const symbols: Symbol[] = [];
            const imports: Import[] = [];
            const exports: Export[] = [];
            const dependencies = new Set<string>();

            // Traverse AST - extract all symbols
            traverse(ast, {
                // Functions
                FunctionDeclaration(path: any) {
                    if (path.node.id) {
                        symbols.push({
                            name: path.node.id.name,
                            type: 'function',
                            line: path.node.loc?.start.line || 0,
                            endLine: path.node.loc?.end.line,
                            signature: generateSignature(path.node),
                            isExported: isExported(path),
                            docstring: extractDocstring(path.node)
                        });
                    }
                },
                
                // Classes
                ClassDeclaration(path: any) {
                    if (path.node.id) {
                        symbols.push({
                            name: path.node.id.name,
                            type: 'class',
                            line: path.node.loc?.start.line || 0,
                            endLine: path.node.loc?.end.line,
                            signature: `class ${path.node.id.name}`,
                            isExported: isExported(path),
                            docstring: extractDocstring(path.node)
                        });
                    }
                },

                // Variables (const/let/var)
                VariableDeclaration(path: any) {
                    path.node.declarations.forEach((decl: any) => {
                        if (t.isIdentifier(decl.id)) {
                            symbols.push({
                                name: decl.id.name,
                                type: 'variable',
                                line: path.node.loc?.start.line || 0,
                                endLine: path.node.loc?.end.line,
                                signature: `${path.node.kind} ${decl.id.name}`,
                                isExported: isExported(path),
                                docstring: extractDocstring(path.node)
                            });
                        }
                    });
                },

                // Interfaces
                TSInterfaceDeclaration(path: any) {
                    symbols.push({
                        name: path.node.id.name,
                        type: 'interface',
                        line: path.node.loc?.start.line || 0,
                        endLine: path.node.loc?.end.line,
                        signature: `interface ${path.node.id.name}`,
                        isExported: isExported(path),
                        docstring: extractDocstring(path.node)
                    });
                },

                // Types
                TSTypeAliasDeclaration(path: any) {
                    symbols.push({
                        name: path.node.id.name,
                        type: 'type',
                        line: path.node.loc?.start.line || 0,
                        endLine: path.node.loc?.end.line,
                        signature: `type ${path.node.id.name}`,
                        isExported: isExported(path),
                        docstring: extractDocstring(path.node)
                    });
                },

                // Imports
                ImportDeclaration(path: any) {
                    const source = path.node.source.value;
                    dependencies.add(source);
                    
                    const names: string[] = [];
                    let isDefault = false;

                    path.node.specifiers.forEach((specifier: any) => {
                        if (t.isImportDefaultSpecifier(specifier)) {
                            isDefault = true;
                            names.push(specifier.local.name);
                        } else if (t.isImportSpecifier(specifier)) {
                            if (t.isStringLiteral(specifier.imported)) {
                                names.push(specifier.imported.value);
                            } else {
                                names.push(specifier.imported.name);
                            }
                        } else if (t.isImportNamespaceSpecifier(specifier)) {
                            names.push(specifier.local.name);
                        }
                    });

                    imports.push({
                        source,
                        names,
                        isDefault,
                        line: path.node.loc?.start.line || 0
                    });
                },

                // Exports
                ExportNamedDeclaration(path: any) {
                    if (path.node.declaration) {
                        // Handled by other visitors checking isExported
                    } else {
                        path.node.specifiers.forEach((specifier: any) => {
                            exports.push({
                                name: specifier.exported.name,
                                type: 'named',
                                line: path.node.loc?.start.line || 0
                            });
                        });
                    }
                    if (path.node.source) {
                        dependencies.add(path.node.source.value);
                    }
                },

                ExportDefaultDeclaration(path: any) {
                    let name = 'default';
                    if (path.node.declaration && (path.node.declaration as any).id) {
                        name = (path.node.declaration as any).id.name;
                    }
                    
                    exports.push({
                        name,
                        type: 'default',
                        line: path.node.loc?.start.line || 0
                    });
                }
            });

            return {
                path: filePath,
                language: this.detectLanguage(filePath),
                symbols,
                imports,
                exports,
                dependencies: Array.from(dependencies),
                lastModified: Date.now(),
                hash,
            };
        } catch (error) {
            // Fallback for parsing errors
            // console.warn(`Failed to parse ${filePath}:`, (error as Error).message);
            return {
                path: filePath,
                language: this.detectLanguage(filePath),
                symbols: [],
                imports: [],
                exports: [],
                dependencies: [],
                lastModified: Date.now(),
                hash,
            };
        }
    }

    private detectLanguage(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (ext === 'ts' || ext === 'tsx') return 'typescript';
        if (ext === 'js' || ext === 'jsx') return 'javascript';
        return 'unknown';
    }

    getSupportedExtensions(): string[] {
        return ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];
    }
}

// Helpers

function isExported(path: any): boolean {
    return t.isExportDeclaration(path.parent) || t.isExportNamedDeclaration(path.parent) || t.isExportDefaultDeclaration(path.parent);
}

function extractDocstring(node: any): string | undefined {
    if (node.leadingComments && node.leadingComments.length > 0) {
        return node.leadingComments[node.leadingComments.length - 1].value.trim();
    }
    return undefined;
}

function generateSignature(node: any): string {
    if (t.isFunctionDeclaration(node)) {
        const name = node.id?.name || 'anonymous';
        const params = node.params.map((p: any) => {
            if (t.isIdentifier(p)) return p.name;
            if (t.isAssignmentPattern(p) && t.isIdentifier(p.left)) return p.left.name + '?';
            return 'arg';
        }).join(', ');
        return `function ${name}(${params})`;
    }
    return '';
}
