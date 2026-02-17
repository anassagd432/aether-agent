/**
 * Self-Healer
 * 
 * Automatically detects errors, diagnoses root causes, and applies fixes.
 * Uses LLM to understand errors and generate targeted fixes.
 */

import type {
    ErrorContext,
    ErrorType,
    FixAttempt,
    Diagnosis,
    HealingResult,
    ToolResult,
    AgentConfig,
} from './types';
import { DEFAULT_AGENT_CONFIG } from './types';
import { ToolExecutor } from './tool-executor';
import { MemoryManager } from './memory-manager';

// ==================== CONSTANTS ====================

const MAX_HEALING_ATTEMPTS = 3;

// Error patterns for classification
const ERROR_PATTERNS: Record<ErrorType, RegExp[]> = {
    build_error: [
        /error TS\d+/i,
        /SyntaxError/i,
        /Unexpected token/i,
        /Cannot find module/i,
        /Module not found/i,
        /Failed to compile/i,
        /Build failed/i,
    ],
    test_failure: [
        /Test failed/i,
        /FAIL\s+/,
        /AssertionError/i,
        /Expected.*but got/i,
        /✗.*test/i,
    ],
    runtime_error: [
        /ReferenceError/i,
        /TypeError/i,
        /RangeError/i,
        /Error:.*at\s+/i,
        /Uncaught.*Error/i,
        /undefined is not/i,
    ],
    lint_error: [
        /eslint/i,
        /warning\s+/i,
        /error\s+.*rule/i,
        /prettier/i,
    ],
    type_error: [
        /Type '.*' is not assignable/i,
        /Property '.*' does not exist/i,
        /Argument of type/i,
        /TS\d+:/i,
    ],
    unknown: [],
};

// ==================== SELF-HEALER CLASS ====================

export class SelfHealer {
    private config: AgentConfig;
    private toolExecutor: ToolExecutor;
    private memory: MemoryManager;
    private healingLog: HealingResult[] = [];

    constructor(
        config: Partial<AgentConfig> = {},
        toolExecutor?: ToolExecutor,
        memory?: MemoryManager
    ) {
        this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
        this.toolExecutor = toolExecutor || new ToolExecutor(this.config);
        this.memory = memory || new MemoryManager(this.config.persistMemory);
    }

    /**
     * Attempt to heal an error automatically
     */
    async heal(
        error: ErrorContext,
        llmCall?: (prompt: string) => Promise<string>
    ): Promise<HealingResult> {
        const attempts: FixAttempt[] = [...error.previousAttempts];
        let fixed = false;

        for (let i = attempts.length; i < MAX_HEALING_ATTEMPTS; i++) {
            // Diagnose the error
            const diagnosis = await this.diagnose(error, attempts, llmCall);

            if (diagnosis.confidence < 0.3) {
                // Low confidence - escalate to human
                return {
                    fixed: false,
                    attempts,
                    finalState: 'needs_human',
                    summary: `Low confidence diagnosis (${diagnosis.confidence}). Human review recommended.`,
                };
            }

            if (!diagnosis.suggestedFixes || diagnosis.suggestedFixes.length === 0) {
                return {
                    fixed: false,
                    attempts,
                    finalState: 'needs_human',
                    summary: 'No suggested fixes available. Human review recommended.',
                };
            }

            // Generate a fix
            const fix = await this.generateFix(error, diagnosis, llmCall);

            // Apply the fix
            const applyResult = await this.applyFix(fix, error);

            const attempt: FixAttempt = {
                diagnosis: diagnosis.rootCause,
                fix,
                appliedAt: Date.now(),
                result: applyResult.success ? 'success' : 'failed',
            };
            attempts.push(attempt);

            if (!applyResult.success) {
                // Fix application failed - try again
                this.memory.recordFailure(
                    `Fix attempt: ${fix.substring(0, 100)}`,
                    `Application failed: ${applyResult.error || 'Unknown error'}`,
                    error.message
                );
                continue;
            }

            // Verify the fix
            const verified = await this.verify(error);

            if (verified) {
                attempt.result = 'success';
                fixed = true;
                break;
            } else {
                attempt.result = 'partial';
                // Record this failed approach to avoid repeating
                this.memory.recordFailure(
                    `Fix: ${diagnosis.rootCause}`,
                    'Verification failed after applying fix',
                    error.message
                );
            }
        }

        const result: HealingResult = {
            fixed,
            attempts,
            finalState: fixed ? 'resolved' : attempts.length >= MAX_HEALING_ATTEMPTS ? 'unresolvable' : 'needs_human',
            summary: this.generateHealingSummary(attempts, fixed),
        };

        this.healingLog.push(result);
        return result;
    }

    /**
     * Diagnose the root cause of an error
     */
    async diagnose(
        error: ErrorContext,
        previousAttempts: FixAttempt[],
        llmCall?: (prompt: string) => Promise<string>
    ): Promise<Diagnosis> {
        // Classify error type if not already set
        if (error.type === 'unknown') {
            error.type = this.classifyError(error.message);
        }

        // Build diagnosis prompt
        const prompt = this.buildDiagnosisPrompt(error, previousAttempts);

        if (llmCall) {
            try {
                const response = await llmCall(prompt);
                return this.parseDiagnosis(response, error);
            } catch (e) {
                console.error('LLM diagnosis failed:', e);
            }
        }

        // Fallback: Pattern-based diagnosis
        return this.patternBasedDiagnosis(error);
    }

    /**
     * Generate a fix for the diagnosed error
     */
    async generateFix(
        error: ErrorContext,
        diagnosis: Diagnosis,
        llmCall?: (prompt: string) => Promise<string>
    ): Promise<string> {
        const prompt = this.buildFixPrompt(error, diagnosis);

        if (llmCall) {
            try {
                const response = await llmCall(prompt);
                return this.extractCodeFromResponse(response);
            } catch (e) {
                console.error('LLM fix generation failed:', e);
            }
        }

        // Fallback: Return the first suggested fix
        return diagnosis.suggestedFixes[0] || '';
    }

    /**
     * Apply a fix to the codebase
     */
    async applyFix(fix: string, error: ErrorContext): Promise<ToolResult> {
        // If we have a file and the fix is code, write it
        if (error.file && fix.trim()) {
            // Check if fix is a complete file replacement or a patch
            if (fix.includes('<<<') && fix.includes('>>>')) {
                // It's a diff patch - apply it
                return this.applyPatch(fix, error.file);
            } else if (fix.startsWith('npm ') || fix.startsWith('npx ')) {
                // It's a command - run it
                if (!this.config.dangerousCommandsAllowed && /\b(rm\s+-rf|sudo|mkfs|dd\s+if=|:(){:|}\s*;:)/i.test(fix)) {
                    return {
                        success: false,
                        output: '',
                        error: 'Dangerous command blocked by policy',
                        duration: 0,
                    };
                }
                return this.toolExecutor.execute({
                    tool: 'shell',
                    params: { command: fix },
                });
            } else {
                // Assume it's a file replacement
                return this.toolExecutor.execute({
                    tool: 'file_write',
                    params: { path: error.file, content: fix },
                });
            }
        }

        // If no file, try to run the fix as a command
        if (fix.startsWith('npm ') || fix.startsWith('npx ') || fix.startsWith('git ')) {
            // Block dangerous commands unless explicitly allowed
            if (!this.config.dangerousCommandsAllowed && /\b(rm\s+-rf|sudo|mkfs|dd\s+if=|:(){:|}\s*;:)/i.test(fix)) {
                return {
                    success: false,
                    output: '',
                    error: 'Dangerous command blocked by policy',
                    duration: 0,
                };
            }
            return this.toolExecutor.execute({
                tool: 'shell',
                params: { command: fix },
            });
        }

        return {
            success: false,
            output: '',
            error: 'Unable to apply fix: no file specified and fix is not a command',
            duration: 0,
        };
    }

    /**
     * Apply a diff patch to a file
     */
    private async applyPatch(patch: string, file: string): Promise<ToolResult> {
        try {
            // Read current file
            const readResult = await this.toolExecutor.execute({
                tool: 'file_read',
                params: { path: file },
            });

            if (!readResult.success) {
                return readResult;
            }

            let content = readResult.output;

            // Parse and apply patch blocks
            const patchBlocks = patch.match(/<<<\s*([\s\S]*?)\s*>>>\s*([\s\S]*?)(?=<<<|$)/g);

            if (patchBlocks) {
                for (const block of patchBlocks) {
                    const match = block.match(/<<<\s*([\s\S]*?)\s*>>>\s*([\s\S]*)/);
                    if (match) {
                        const [, before, after] = match;
                        if (content.includes(before.trim())) {
                            content = content.replace(before.trim(), after.trim());
                        } else {
                            // No exact match found, abort to avoid unintended changes
                            return {
                                success: false,
                                output: '',
                                error: 'Patch application failed: target block not found',
                                duration: 0,
                            };
                        }
                    }
                }
            }

            // Write updated content
            return this.toolExecutor.execute({
                tool: 'file_write',
                params: { path: file, content },
            });
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'Patch application failed',
                duration: 0,
            };
        }
    }

    /**
     * Verify that the error is fixed
     */
    async verify(error: ErrorContext): Promise<boolean> {
        // Run the appropriate verification based on error type
        let result: ToolResult;

        switch (error.type) {
            case 'build_error':
            case 'type_error':
                result = await this.toolExecutor.execute({
                    tool: 'npm_build',
                    params: {},
                });
                break;

            case 'test_failure':
                result = await this.toolExecutor.execute({
                    tool: 'npm_test',
                    params: {},
                });
                break;

            case 'lint_error':
                result = await this.toolExecutor.execute({
                    tool: 'lint',
                    params: {},
                });
                break;

            default:
                // Try TypeScript check
                result = await this.toolExecutor.execute({
                    tool: 'shell',
                    params: { command: 'npx tsc --noEmit' },
                });
        }

        // Check if the original error message is gone
        if (result.success) {
            return true;
        }

        const output = result.output + (result.error || '');
        return !output.includes(error.message.substring(0, 50));
    }

    /**
     * Classify error type based on patterns
     */
    classifyError(message: string): ErrorType {
        for (const [type, patterns] of Object.entries(ERROR_PATTERNS)) {
            if (type === 'unknown') continue;
            for (const pattern of patterns) {
                if (pattern.test(message)) {
                    return type as ErrorType;
                }
            }
        }
        return 'unknown';
    }

    /**
     * Extract file and line from error message
     */
    extractLocation(message: string): { file?: string; line?: number; column?: number } {
        // Common patterns:
        // - File.tsx:123:45
        // - at File.tsx line 123
        // - in ./src/File.tsx (line 123)

        const patterns = [
            /([^\s:]+\.[jt]sx?):(\d+):(\d+)/,
            /([^\s:]+\.[jt]sx?):(\d+)/,
            /at\s+([^\s:]+\.[jt]sx?)\s+line\s+(\d+)/i,
            /in\s+\.?\/?(src\/[^\s]+\.[jt]sx?)/,
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return {
                    file: match[1],
                    line: match[2] ? parseInt(match[2]) : undefined,
                    column: match[3] ? parseInt(match[3]) : undefined,
                };
            }
        }

        return {};
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Build the diagnosis prompt
     */
    private buildDiagnosisPrompt(error: ErrorContext, previousAttempts: FixAttempt[]): string {
        const previousAttemptsText = previousAttempts.length > 0
            ? `\n\n## Previous Fix Attempts (all failed)\n${previousAttempts.map((a, i) =>
                `${i + 1}. Diagnosis: ${a.diagnosis}\n   Fix: ${a.fix.substring(0, 100)}...\n   Result: ${a.result}`
            ).join('\n')}`
            : '';

        return `
You are a senior software engineer debugging an error. Analyze the error and identify the root cause.

## Error Type
${error.type}

## Error Message
\`\`\`
${error.message}
\`\`\`

## Stack Trace
\`\`\`
${error.stackTrace || 'No stack trace available'}
\`\`\`

## File Location
${error.file ? `File: ${error.file}${error.line ? ` (line ${error.line})` : ''}` : 'Unknown location'}
${previousAttemptsText}

## Instructions
1. Identify the most likely root cause
2. List the files that need to be modified
3. Suggest specific fixes (in order of likelihood)
4. Rate your confidence (0-1)

## Output Format
\`\`\`json
{
  "rootCause": "Clear explanation of what's wrong",
  "affectedFiles": ["path/to/file.ts"],
  "suggestedFixes": [
    "Most likely fix",
    "Alternative fix"
  ],
  "confidence": 0.8
}
\`\`\`
`.trim();
    }

    /**
     * Build the fix generation prompt
     */
    private buildFixPrompt(error: ErrorContext, diagnosis: Diagnosis): string {
        return `
You are a senior software engineer fixing a bug. Generate the exact code fix.

## Error
${error.message}

## Root Cause
${diagnosis.rootCause}

## File to Fix
${error.file || diagnosis.affectedFiles[0] || 'Unknown'}

## Instructions
Generate the EXACT code that should replace the problematic code.
If it's a command (npm install, etc.), provide the command.
If it's a code change, provide the complete fixed code for the affected section.

For code changes, use this format:
<<<
old code to replace
>>>
new fixed code

Return ONLY the fix, no explanations.
`.trim();
    }

    /**
     * Parse diagnosis from LLM response
     */
    private parseDiagnosis(response: string, error: ErrorContext): Diagnosis {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    rootCause: parsed.rootCause || 'Unknown',
                    affectedFiles: parsed.affectedFiles || (error.file ? [error.file] : []),
                    suggestedFixes: parsed.suggestedFixes || [],
                    confidence: parsed.confidence || 0.5,
                };
            }
        } catch {
            // Fall through to pattern-based
        }

        return this.patternBasedDiagnosis(error);
    }

    /**
     * Pattern-based diagnosis fallback
     */
    private patternBasedDiagnosis(error: ErrorContext): Diagnosis {
        const diagnosis: Diagnosis = {
            rootCause: 'Unknown error',
            affectedFiles: error.file ? [error.file] : [],
            suggestedFixes: [],
            confidence: 0.3,
        };

        // Common patterns and their fixes
        if (error.message.includes('Cannot find module')) {
            const moduleMatch = error.message.match(/Cannot find module '([^']+)'/);
            diagnosis.rootCause = `Missing module: ${moduleMatch?.[1] || 'unknown'}`;
            diagnosis.suggestedFixes = [
                `npm install ${moduleMatch?.[1] || ''}`,
                'npm install',
            ];
            diagnosis.confidence = 0.7;
        } else if (error.message.includes('is not assignable to type')) {
            diagnosis.rootCause = 'Type mismatch in TypeScript';
            diagnosis.suggestedFixes = [
                'Check and fix the type annotation',
                'Add explicit type casting',
            ];
            diagnosis.confidence = 0.5;
        } else if (error.message.includes('Unexpected token')) {
            diagnosis.rootCause = 'Syntax error in code';
            diagnosis.suggestedFixes = [
                'Check for missing brackets, commas, or semicolons',
            ];
            diagnosis.confidence = 0.4;
        }

        return diagnosis;
    }

    /**
     * Extract code from LLM response
     */
    private extractCodeFromResponse(response: string): string {
        // Try to extract code blocks
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim();
        }

        // Try to extract patch format
        const patchMatch = response.match(/<<<[\s\S]*>>>/);
        if (patchMatch) {
            return patchMatch[0];
        }

        // Return the whole response as the fix
        return response.trim();
    }

    /**
     * Generate a summary of healing attempts
     */
    private generateHealingSummary(attempts: FixAttempt[], fixed: boolean): string {
        if (attempts.length === 0) {
            return 'No healing attempts made';
        }

        const successful = attempts.filter(a => a.result === 'success').length;
        const partial = attempts.filter(a => a.result === 'partial').length;
        const failed = attempts.filter(a => a.result === 'failed').length;

        return `${fixed ? 'Fixed' : 'Not fixed'} after ${attempts.length} attempt(s). ` +
            `Success: ${successful}, Partial: ${partial}, Failed: ${failed}. ` +
            `Last diagnosis: ${attempts[attempts.length - 1].diagnosis}`;
    }

    /**
     * Get healing log
     */
    getHealingLog(): HealingResult[] {
        return [...this.healingLog];
    }

    /**
     * Clear healing log
     */
    clearHealingLog(): void {
        this.healingLog = [];
    }
}

// Export singleton for convenience
export const selfHealer = new SelfHealer();
