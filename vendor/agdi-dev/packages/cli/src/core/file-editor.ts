/**
 * File Editor - AI-powered surgical file editing
 * 
 * Provides /edit command functionality for granular code modifications.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { input, confirm } from '@inquirer/prompts';

import { resolvePath, fileExists, applyPatchTool } from '../actions/fs-tools.js';
import { getEnvironment } from '../security/execution-env.js';
import { logEvent } from '../security/audit-logger.js';
import type { ILLMProvider } from '../core/types/index.js';

// ==================== SYSTEM PROMPT ====================

const EDIT_SYSTEM_PROMPT = `You are a surgical code editor. Given a file's content and an edit instruction, output ONLY a unified diff patch.

## Output Format (STRICT)
\`\`\`diff
--- a/filename
+++ b/filename
@@ -start,count +start,count @@
 context line (unchanged)
-removed line
+added line
 context line (unchanged)
\`\`\`

## Rules
1. Output ONLY the diff block, no explanation before or after
2. Include 3 context lines around each change
3. Use proper unified diff format with @@ hunk headers
4. Preserve exact indentation (spaces/tabs)
5. Multiple changes = multiple @@ hunks
6. Line numbers in @@ must be accurate

## Example
Input: "Add a console.log at line 5"
Output:
\`\`\`diff
--- a/index.ts
+++ b/index.ts
@@ -3,6 +3,7 @@
 import { foo } from './foo';
 
 function main() {
+    console.log('Debug point');
     const result = foo();
     return result;
 }
\`\`\``;

// ==================== TYPES ====================

export interface EditResult {
    success: boolean;
    error?: string;
    linesChanged?: number;
}

// ==================== CORE FUNCTIONS ====================

/**
 * Read file content with line numbers for display
 */
export async function readFileForEdit(filePath: string): Promise<{ content: string; numbered: string } | null> {
    const resolved = resolvePath(filePath);

    if (!existsSync(resolved)) {
        return null;
    }

    try {
        const content = await readFile(resolved, 'utf-8');
        const lines = content.split('\n');
        const numbered = lines
            .map((line, i) => `${String(i + 1).padStart(4, ' ')} │ ${line}`)
            .join('\n');

        return { content, numbered };
    } catch {
        return null;
    }
}

/**
 * Extract diff from LLM response (handles markdown code blocks)
 */
function extractDiff(response: string): string | null {
    // Try to extract from ```diff block
    const diffMatch = response.match(/```diff\n([\s\S]*?)```/);
    if (diffMatch) {
        return diffMatch[1].trim();
    }

    // Try to extract from ``` block
    const codeMatch = response.match(/```\n([\s\S]*?)```/);
    if (codeMatch && codeMatch[1].includes('@@')) {
        return codeMatch[1].trim();
    }

    // Check if response itself looks like a diff
    if (response.includes('@@') && (response.includes('---') || response.includes('+++'))) {
        return response.trim();
    }

    return null;
}

/**
 * Display colored diff preview in terminal
 */
export function previewDiff(diff: string): void {
    console.log(chalk.cyan.bold('\n📝 Proposed Changes:\n'));

    const lines = diff.split('\n');
    for (const line of lines) {
        if (line.startsWith('+++') || line.startsWith('---')) {
            console.log(chalk.gray(line));
        } else if (line.startsWith('@@')) {
            console.log(chalk.cyan(line));
        } else if (line.startsWith('+')) {
            console.log(chalk.green(line));
        } else if (line.startsWith('-')) {
            console.log(chalk.red(line));
        } else {
            console.log(chalk.gray(line));
        }
    }
    console.log('');
}

/**
 * Count lines changed in a diff
 */
function countChanges(diff: string): { added: number; removed: number } {
    const lines = diff.split('\n');
    let added = 0;
    let removed = 0;

    for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
            added++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            removed++;
        }
    }

    return { added, removed };
}

// ==================== MAIN EDIT HANDLER ====================

/**
 * Handle /edit <file> command
 */
export async function handleFileEdit(
    filePath: string,
    llm: ILLMProvider
): Promise<EditResult> {
    const env = getEnvironment();

    // Validate file exists
    if (!fileExists(filePath)) {
        console.log(chalk.red(`\n✗ File not found: ${filePath}\n`));
        return { success: false, error: 'File not found' };
    }

    // Read file content
    const fileData = await readFileForEdit(filePath);
    if (!fileData) {
        console.log(chalk.red(`\n✗ Could not read file: ${filePath}\n`));
        return { success: false, error: 'Could not read file' };
    }

    // Show file preview (first 20 lines)
    const previewLines = fileData.numbered.split('\n').slice(0, 20);
    console.log(chalk.cyan.bold(`\n📄 ${filePath}\n`));
    console.log(chalk.gray(previewLines.join('\n')));
    if (fileData.content.split('\n').length > 20) {
        console.log(chalk.gray(`    ... (${fileData.content.split('\n').length - 20} more lines)`));
    }
    console.log('');

    // Get edit instruction from user
    const instruction = await input({
        message: chalk.yellow('Describe the edit:'),
    });

    if (!instruction.trim()) {
        console.log(chalk.gray('\n(no instruction provided)\n'));
        return { success: false, error: 'No instruction' };
    }

    // Generate diff with AI
    const spinner = ora('Generating edit...').start();

    try {
        const prompt = `File: ${filePath}

Content:
\`\`\`
${fileData.content}
\`\`\`

Edit instruction: ${instruction}

Generate the unified diff to make this change.`;

        const response = await llm.generate(prompt, EDIT_SYSTEM_PROMPT);
        spinner.stop();

        // Extract diff from response
        const diff = extractDiff(response.text);

        if (!diff) {
            console.log(chalk.yellow('\n⚠️  Could not generate a valid diff.\n'));
            console.log(chalk.gray('AI response:\n' + response.text.slice(0, 500)));
            return { success: false, error: 'Invalid diff generated' };
        }

        // Preview the diff
        previewDiff(diff);

        // Show change stats
        const changes = countChanges(diff);
        console.log(chalk.gray(`  ${chalk.green(`+${changes.added}`)} additions, ${chalk.red(`-${changes.removed}`)} deletions\n`));

        // Confirm with user
        const shouldApply = await confirm({
            message: 'Apply these changes?',
            default: true,
        });

        if (!shouldApply) {
            console.log(chalk.gray('\n👋 Edit cancelled.\n'));
            return { success: false, error: 'Cancelled by user' };
        }

        // Apply the patch
        const applySpinner = ora('Applying changes...').start();
        const result = await applyPatchTool(filePath, diff);
        applySpinner.stop();

        if (result.success) {
            console.log(chalk.green(`\n✓ Successfully edited ${filePath}\n`));

            logEvent({
                eventType: 'command_result',
                command: `/edit ${filePath}`,
                result: { exitCode: 0 },
                metadata: {
                    instruction,
                    added: changes.added,
                    removed: changes.removed,
                },
            });

            return { success: true, linesChanged: changes.added + changes.removed };
        } else {
            console.log(chalk.red(`\n✗ Failed to apply changes: ${result.error}\n`));
            return { success: false, error: result.error };
        }

    } catch (error) {
        spinner.stop();
        const msg = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`\n✗ Error: ${msg}\n`));
        return { success: false, error: msg };
    }
}
