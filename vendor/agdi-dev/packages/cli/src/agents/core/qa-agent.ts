/**
 * QA Agent
 * 
 * Quality Assurance specialist.
 * Runs builds, tests, and fixes errors automatically.
 */

import { BaseAgent, SquadTask, AgentOutput, GeneratedFile } from './base-agent.js';
import type { ILLMProvider } from '../../core/types/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// ==================== QA SYSTEM PROMPT ====================

const QA_SYSTEM_PROMPT = `You are a SENIOR QA ENGINEER and DEBUGGER with expertise in:
- TypeScript/JavaScript debugging
- React Testing Library
- Vitest / Jest
- Build error diagnosis
- ESLint / TypeScript errors

Your responsibilities:
1. Analyze build/test errors
2. Read the provided source code context
3. Diagnose the root cause (e.g., missing prop, type mismatch, bad import)
4. Generate SURGICAL fixes

When fixing errors, you MUST:
1. Quote the exact error message
2. Explain the root cause
3. Provide the fixed code with filepath

Output Format:
\`\`\`typescript
// filepath: src/components/Broken.tsx
// Fixed: [description of what was wrong]
import React from 'react';
// ... fixed code
\`\`\`

IMPORTANT:
- Do NOT generate "placeholder" fixes. 
- If an import is missing, make sure the file actually exists or fix the path.
- If a type is missing, check where it is defined.

Sources:
- If you reference any external fixes or docs, list their URLs in a "Sources:" section at the end.`;

// ==================== QA AGENT CLASS ====================

export class QAAgent extends BaseAgent {
    private maxFixAttempts = 3;

    constructor(llm: ILLMProvider, options: { verbose?: boolean } = {}) {
        super('qa', '🕵️ QA', llm, options);
    }

    getSystemPrompt(): string {
        return QA_SYSTEM_PROMPT;
    }

    /**
     * Run npm build and capture output
     */
    async runBuild(cwd: string): Promise<{ success: boolean; output: string }> {
        this.log('Running npm build...');

        try {
            const { stdout, stderr } = await execAsync('npm run build', {
                cwd,
                timeout: 300000, // 5 minutes
            });

            return {
                success: true,
                output: stdout + stderr
            };
        } catch (error: unknown) {
            const execError = error as { stdout?: string; stderr?: string; message?: string };
            return {
                success: false,
                output: (execError.stdout || '') + (execError.stderr || '') + (execError.message || '')
            };
        }
    }

    /**
     * Run npm test
     */
    async runTests(cwd: string): Promise<{ success: boolean; output: string }> {
        this.log('Running tests...');

        try {
            const { stdout, stderr } = await execAsync('npm test -- --run', {
                cwd,
                timeout: 300000,
            });

            return { success: true, output: stdout + stderr };
        } catch (error: unknown) {
            const execError = error as { stdout?: string; stderr?: string; message?: string };
            return {
                success: false,
                output: (execError.stdout || '') + (execError.stderr || '') + (execError.message || '')
            };
        }
    }

    /**
     * Extract file paths from error log
     */
    private extractFilePaths(errorLog: string): Set<string> {
        const paths = new Set<string>();
        // Regex to match common error formats like:
        // src/components/Foo.tsx(10,5): error ...
        // ./src/lib/utils.ts:5:10
        const regex = /((?:src|app|pages|lib|components)\/[a-zA-Z0-9_./-]+\.(?:ts|tsx|js|jsx|json))/g;
        
        const matches = errorLog.matchAll(regex);
        for (const match of matches) {
            paths.add(match[1]);
        }
        return paths;
    }

    /**
     * Read file content for context
     */
    private async getFileContext(cwd: string, paths: Set<string>): Promise<string> {
        if (paths.size === 0) return '';

        const contextParts: string[] = [];
        for (const filePath of paths) {
            try {
                const fullPath = path.join(cwd, filePath);
                const content = await fs.readFile(fullPath, 'utf-8');
                contextParts.push(`// File: ${filePath}\n${content}`);
            } catch (e) {
                // Ignore missing files (might be deleted or phantom error)
            }
        }
        return contextParts.join('\n\n');
    }

    /**
     * Diagnose build errors and generate fixes
     */
    async diagnoseAndFix(cwd: string, errorOutput: string): Promise<GeneratedFile[]> {
        this.log('Analyzing errors and reading source files...');

        // 1. Identify relevant files from error log
        const problematicFiles = this.extractFilePaths(errorOutput);
        this.log(`Identified ${problematicFiles.size} problematic files: ${Array.from(problematicFiles).join(', ')}`);

        // 2. Read their content
        const fileContext = await this.getFileContext(cwd, problematicFiles);

        // 3. Prompt LLM with context
        const response = await this.think(`
The following build/test errors occurred:

\`\`\`
${errorOutput.slice(0, 5000)}
\`\`\`

Here is the content of the files mentioned in the errors:

\`\`\`typescript
${fileContext.slice(0, 20000)}
\`\`\`

Analyze these errors and the provided code.
Diagnose the root cause and provide SURGICAL fixes.
For example, if a property is missing in a component prop type, fix the interface.
If an import is wrong, correct it.
`);

        const fixes = this.extractCodeBlocks(response);
        this.log(`Generated ${fixes.length} fixes`, fixes.length > 0 ? 'success' : 'warn');

        return fixes;
    }

    /**
     * Run the build-fix loop
     */
    async buildFixLoop(cwd: string): Promise<AgentOutput> {
        let attempt = 0;
        let lastOutput = '';
        const allFixes: GeneratedFile[] = [];
        const errors: string[] = [];
        const commandOutputs: Array<{ command: string; output: string; success: boolean }> = [];

        while (attempt < this.maxFixAttempts) {
            attempt++;
            this.log(`Build attempt ${attempt}/${this.maxFixAttempts}`);

            const buildResult = await this.runBuild(cwd);
            lastOutput = buildResult.output;
            commandOutputs.push({ command: 'npm run build', output: buildResult.output, success: buildResult.success });

            if (buildResult.success) {
                this.log('Build succeeded! ✅', 'success');

                // Now run tests
                const testResult = await this.runTests(cwd);
                commandOutputs.push({ command: 'npm test -- --run', output: testResult.output, success: testResult.success });
                if (testResult.success) {
                    return {
                        success: true,
                        content: `Build and tests passed on attempt ${attempt}`,
                        files: allFixes,
                        commandOutputs,
                    };
                } else {
                    // Tests failed, try to fix
                    const testFixes = await this.diagnoseAndFix(cwd, testResult.output);
                    allFixes.push(...testFixes);

                    if (testFixes.length === 0) {
                        errors.push(`Tests failed but couldn't generate fixes: ${testResult.output.slice(0, 500)}`);
                        break;
                    }
                    continue;
                }
            }

            // Build failed, diagnose and fix
            this.log('Build failed, diagnosing...', 'warn');
            const fixes = await this.diagnoseAndFix(cwd, buildResult.output);

            if (fixes.length === 0) {
                errors.push(`Build failed but couldn't generate fixes: ${buildResult.output.slice(0, 500)}`);
                break;
            }

            allFixes.push(...fixes);
            
            // Apply fixes immediately to the disk so the next build attempt sees them
            for (const fix of fixes) {
                try {
                    const fullPath = path.join(cwd, fix.path);
                    await fs.mkdir(path.dirname(fullPath), { recursive: true });
                    await fs.writeFile(fullPath, fix.content, 'utf-8');
                    this.log(`  Applied fix to: ${fix.path}`, 'info');
                } catch (e) {
                    this.log(`Failed to apply fix to ${fix.path}: ${e}`, 'error');
                }
            }
        }

        return {
            success: false,
            content: `Build failed after ${attempt} attempts`,
            files: allFixes,
            errors,
            commandOutputs,
        };
    }

    /**
     * Execute QA task
     */
    async execute(task: SquadTask): Promise<AgentOutput> {
        this.log(`Executing: ${task.title}`);
        this.resetSources();

        const cwd = this.context?.workspaceRoot || process.cwd();

        try {
            const result = await this.buildFixLoop(cwd);
            return { ...result, sources: this.getSources() };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`QA task failed: ${errorMsg}`, 'error');

            return {
                success: false,
                content: errorMsg,
                errors: [errorMsg],
                sources: this.getSources(),
            };
        }
    }
}

export default QAAgent;
