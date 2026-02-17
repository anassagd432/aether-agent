/**
 * Plan Executor
 * 
 * Executes action plans with transactional permission prompt.
 */

import { select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { resolve } from 'path';
import { ui } from '../utils/ui.js';

import {
    type ActionPlan,
    type Action,
    type ActionResult,
    type PlanExecutionResult,
    summarizePlan,
    parseActionPlan,
} from './types.js';
import { mkdirTool, writeFileTool, deleteFileTool } from './fs-tools.js';
import { getEnvironment, updateEnvironment } from '../security/execution-env.js';
import { evaluateCommand, type GateResult } from '../security/permission-gate.js';
import { trustWorkspace } from '../security/workspace-trust.js';
import { logEvent, logSessionStart } from '../security/audit-logger.js';
import { generateImage, downloadImageAsBase64 } from '../core/image-generator.js';
import { loadConfig } from '../utils/config.js';

// ==================== DISPLAY ====================

/**
 * Display plan summary for approval
 */
function displayPlanSummary(plan: ActionPlan): void {
    const summary = summarizePlan(plan);
    const lines: string[] = [];

    if (summary.dirsCreated > 0) lines.push(`📁 Create ${summary.dirsCreated} directories`);
    if (summary.filesCreated > 0) lines.push(`📄 Create ${summary.filesCreated} files`);
    if (summary.filesDeleted > 0) lines.push(`🗑️  Delete ${summary.filesDeleted} files`);
    if (summary.commandsToRun > 0) lines.push(`⚡ Run ${summary.commandsToRun} commands`);
    if (summary.domains.length > 0) lines.push(`🌐 Network: ${summary.domains.join(', ')}`);
    if (summary.ports.length > 0) lines.push(`🔌 Ports: ${summary.ports.join(', ')}`);

    const content = lines.join('\n');
    ui.renderBox(`PLAN: ${plan.projectName}`, content, 'info');
}

/**
 * Display individual action progress
 */
function displayActionProgress(action: Action, index: number, total: number): void {
    const num = `[${index + 1}/${total}]`;

    switch (action.type) {
        case 'mkdir':
            console.log(chalk.gray(`${num} Creating directory: ${action.path}`));
            break;
        case 'writeFile':
            console.log(chalk.gray(`${num} Writing file: ${action.path}`));
            break;
        case 'deleteFile':
            console.log(chalk.gray(`${num} Deleting file: ${action.path}`));
            break;
        case 'exec':
            console.log(chalk.blue(`${num} Running: ${action.argv.join(' ')}`));
            break;
        case 'generateImage':
            console.log(chalk.magenta(`${num} 🎨 Generating image: ${action.savePath}`));
            break;
    }
}

// ==================== DRY RUN ====================

/**
 * Dry-run all actions through gate to check permissions
 */
async function dryRunActions(plan: ActionPlan): Promise<{
    canProceed: boolean;
    requiresTrust: boolean;
    gateResults: GateResult[];
}> {
    const gateResults: GateResult[] = [];
    let requiresTrust = false;
    let hasHardDeny = false;

    for (const action of plan.actions) {
        if (action.type === 'exec') {
            const command = action.argv.join(' ');
            const result = evaluateCommand(command, action.cwd);
            gateResults.push(result);

            if (result.decision === 'deny') {
                const isHard = result.violations.some(v => v.severity === 'hard');
                if (isHard) {
                    hasHardDeny = true;
                }
            }

            // Check if trust is needed
            if (result.violations.some(v => v.message === 'Workspace not trusted')) {
                requiresTrust = true;
            }
        } else {
            // File operations - check write permission
            const env = getEnvironment();
            if (env.trustLevel === 'untrusted') {
                requiresTrust = true;
            }
        }
    }

    return {
        canProceed: !hasHardDeny,
        requiresTrust,
        gateResults,
    };
}

// ==================== EXECUTION ====================

/**
 * Execute a single action
 */
async function executeAction(action: Action): Promise<ActionResult> {
    const env = getEnvironment();

    switch (action.type) {
        case 'mkdir': {
            const result = await mkdirTool(action.path);
            return {
                action,
                success: result.success,
                error: result.error,
            };
        }

        case 'writeFile': {
            const result = await writeFileTool(action.path, action.content);
            return {
                action,
                success: result.success,
                error: result.error,
            };
        }

        case 'deleteFile': {
            const result = await deleteFileTool(action.path);
            return {
                action,
                success: result.success,
                error: result.error,
            };
        }

        case 'exec': {
            const cwd = action.cwd ? resolve(env.workspaceRoot, action.cwd) : env.workspaceRoot;
            const command = action.argv.join(' ');

            return new Promise((resolvePromise) => {
                let output = '';
                let error = '';

                const child = spawn(action.argv[0], action.argv.slice(1), {
                    cwd,
                    shell: true,
                    stdio: 'pipe',
                });

                child.stdout?.on('data', (data) => {
                    const text = data.toString();
                    output += text;
                    process.stdout.write(text);
                });

                child.stderr?.on('data', (data) => {
                    const text = data.toString();
                    error += text;
                    process.stderr.write(text);
                });

                child.on('close', (code) => {
                    resolvePromise({
                        action,
                        success: code === 0,
                        error: code !== 0 ? error || `Exit code: ${code}` : undefined,
                        output,
                    });
                });

                child.on('error', (err) => {
                    resolvePromise({
                        action,
                        success: false,
                        error: err.message,
                    });
                });
            });
        }

        case 'generateImage': {
            // Resolve image provider + key
            const config = loadConfig();
            const imageProvider = config.imageProvider || (config.nanoBananaApiKey ? 'nanobanana' : 'openrouter');
            const apiKey = imageProvider === 'nanobanana' ? config.nanoBananaApiKey : config.openrouterApiKey;

            if (!apiKey) {
                const providerName = imageProvider === 'nanobanana' ? 'Nano Banana Pro' : 'OpenRouter';
                return {
                    action,
                    success: false,
                    error: `${providerName} API key required for image generation. Run: agdi auth`,
                };
            }

            try {
                console.log(chalk.gray(`   Prompt: "${action.prompt.slice(0, 50)}..."`));
                const result = await generateImage(action.prompt, {
                    provider: imageProvider,
                    apiKey,
                    baseUrl: config.nanoBananaBaseUrl,
                }, { style: action.style });

                // Download and save the image
                if (result.url) {
                    const base64Data = await downloadImageAsBase64(result.url);
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    await writeFileTool(action.savePath, imageBuffer.toString('base64'));
                    console.log(chalk.green(`   ✓ Saved to ${action.savePath}`));
                } else if (result.base64) {
                    await writeFileTool(action.savePath, result.base64);
                    console.log(chalk.green(`   ✓ Saved to ${action.savePath}`));
                }

                return {
                    action,
                    success: true,
                    output: `Image generated: ${action.savePath}`,
                };
            } catch (err) {
                return {
                    action,
                    success: false,
                    error: err instanceof Error ? err.message : 'Image generation failed',
                };
            }
        }
    }
}

// ==================== MAIN EXECUTOR ====================

/**
 * Execute an action plan with transactional permission prompt
 */
export async function executePlan(plan: ActionPlan): Promise<PlanExecutionResult> {
    const env = getEnvironment();
    const results: ActionResult[] = [];
    const filesCreated: string[] = [];
    const commandsRun: string[] = [];
    const errors: string[] = [];

    // Display summary
    displayPlanSummary(plan);

    // Dry-run to check permissions
    const dryRun = await dryRunActions(plan);

    // Handle hard denies
    if (!dryRun.canProceed) {
        const errorLines = dryRun.gateResults
            .filter(r => r.decision === 'deny')
            .map(r => `• ${r.command}: ${r.reason}`);

        ui.renderBox('BLOCKED ACTIONS', errorLines.join('\n'), 'error');
        dryRun.gateResults.filter(r => r.decision === 'deny').forEach(r => errors.push(r.reason));

        return { success: false, results, filesCreated, commandsRun, errors };
    }

    // Handle trust requirement
    if (dryRun.requiresTrust) {
        ui.renderAlert('UNTRUSTED WORKSPACE',
            `The agent wants to execute ${plan.actions.length} actions in this folder.\n` +
            `This includes writing files and/or running commands.\n` +
            `\nTarget: ${env.workspaceRoot}`
        );

        const trustChoice = await select({
            message: 'Trust this workspace?',
            choices: [
                { name: 'Trust for this session', value: 'session' },
                { name: 'Trust and remember', value: 'persistent' },
                { name: 'Cancel', value: 'cancel' },
            ],
        });

        if (trustChoice === 'cancel') {
            console.log(chalk.yellow('\n👋 Plan cancelled.\n'));
            return { success: false, results, filesCreated, commandsRun, errors: ['User cancelled'] };
        }

        if (trustChoice === 'persistent') {
            trustWorkspace(env.workspaceRoot);
            updateEnvironment({ trustLevel: 'persistent' });
            console.log(chalk.green('✓ Workspace trusted and remembered\n'));
        } else {
            updateEnvironment({ trustLevel: 'session' });
            console.log(chalk.green('✓ Trusted for this session\n'));
        }
    }

    // Dangerous command check (P2: Security Hardening)
    const dangerousKeywords = ['rm', 'rimraf', 'del', 'npm install', 'pnpm install', 'yarn install', 'chmod', 'chown'];
    const dangerousActions = plan.actions.filter(a => {
        if (a.type !== 'exec') return false;
        const cmd = a.argv.join(' ');
        return dangerousKeywords.some(k => cmd.includes(k));
    });

    if (dangerousActions.length > 0) {
        ui.renderAlert('⚠️ DANGEROUS COMMANDS DETECTED',
            dangerousActions.map(a => `• ${(a as any).argv.join(' ')}`).join('\n') +
            '\n\nThese commands can modify your system or delete files.'
        );

        // Strict yes/no validation - prevent buffered input
        let allowDangerous = false;
        let validResponse = false;

        while (!validResponse) {
            const response = await confirm({
                message: 'Type "yes" to execute or "no" to cancel',
                default: false,
            });

            // confirm() returns boolean, so this is safe
            allowDangerous = response;
            validResponse = true;
        }

        if (!allowDangerous) {
            console.log(chalk.yellow('\n👋 Execution cancelled for safety.\n'));
            return { success: false, results, filesCreated, commandsRun, errors: ['User cancelled dangerous commands'] };
        }
    }

    // Final approval / Dry Run Logic
    let approved: boolean;

    if (ui.flags.dryRun) {
        console.log(chalk.yellow('\n🚧 DRY RUN MODE ENABLED'));
        console.log(chalk.gray('   No files will be written and no commands will be executed.\n'));
        approved = true; // Auto-approve for dry run since it's safe
    } else {
        approved = await confirm({
            message: `Execute ${plan.actions.length} actions?`,
            default: true,
        });
    }

    if (!approved) {
        console.log(chalk.yellow('\n👋 Plan cancelled.\n'));
        return { success: false, results, filesCreated, commandsRun, errors: ['User cancelled'] };
    }

    // Log plan execution start
    logEvent({
        eventType: 'command_start',
        command: `executePlan: ${plan.projectName}`,
        metadata: {
            actionsCount: plan.actions.length,
            summary: summarizePlan(plan),
        },
    });

    console.log(chalk.cyan('\n▶ Executing plan...\n'));

    // Execute actions in order
    for (let i = 0; i < plan.actions.length; i++) {
        const action = plan.actions[i];
        displayActionProgress(action, i, plan.actions.length);

        // Check for dry run
        if (ui.flags.dryRun) {
            console.log(chalk.yellow(`   [DRY RUN] Would execute: ${action.type} ${(action as any).path || (action as any).argv?.join(' ')}`));
            results.push({ action, success: true, output: '(dry run)' });
            continue;
        }

        const result = await executeAction(action);
        results.push(result);

        if (result.success) {
            if (action.type === 'writeFile' || action.type === 'mkdir') {
                filesCreated.push((action as { path: string }).path);
            }
            if (action.type === 'exec') {
                commandsRun.push(action.argv.join(' '));
            }
        } else {
            errors.push(result.error || 'Unknown error');
            console.log(chalk.red(`   ✗ Failed: ${result.error}`));
        }
    }

    // Summary
    const success = errors.length === 0;
    if (success) {
        console.log(chalk.green(`\n✓ Plan executed successfully!`));
        console.log(chalk.gray(`  Created ${filesCreated.length} files`));
        console.log(chalk.gray(`  Ran ${commandsRun.length} commands\n`));
    } else {
        console.log(chalk.red(`\n✗ Plan completed with ${errors.length} errors\n`));
    }

    // Next steps
    if (plan.nextSteps) {
        console.log(chalk.cyan('Next steps:'));
        console.log(chalk.gray(`  ${plan.nextSteps}\n`));
    }

    // Log plan execution end
    logEvent({
        eventType: 'command_result',
        command: `executePlan: ${plan.projectName}`,
        result: {
            exitCode: success ? 0 : 1,
        },
        metadata: {
            filesCreated,
            commandsRun,
            errors,
        },
    });

    return { success, results, filesCreated, commandsRun, errors };
}

/**
 * Parse and execute plan from model response
 */
export async function parseAndExecutePlan(response: string): Promise<PlanExecutionResult | null> {
    const plan = parseActionPlan(response);

    if (!plan) {
        console.log(chalk.yellow('\n⚠️  Could not parse action plan from response.\n'));
        return null;
    }

    return executePlan(plan);
}

// Re-export types
export { parseActionPlan, summarizePlan } from './types.js';
