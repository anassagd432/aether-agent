/**
 * CommandGuard - Enhanced CLI Execution Safety Middleware
 * 
 * Provides rich approval UX with 6 options and checkpoint support.
 */

import { select, confirm, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { spawn, SpawnOptions } from 'child_process';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, cpSync } from 'fs';
import { join } from 'path';

import { evaluateCommand, type GateResult, type RiskTier } from './permission-gate.js';
import { getEnvironment } from './execution-env.js';
import { addRule, addSessionRule } from './rules-engine.js';
import {
    logGateEvaluation,
    logApprovalRequest,
    logApprovalDecision,
    logCommandResult,
    type ApprovalChoice,
} from './audit-logger.js';

// ==================== TYPES ====================

export interface ExecutionResult {
    allowed: boolean;
    exitCode: number;
    output: string;
    error?: string;
    duration: number;
}

// ==================== DISPLAY HELPERS ====================

/**
 * Get risk tier badge
 */
function getRiskBadge(tier: RiskTier): string {
    switch (tier) {
        case 0: return chalk.green('Tier 0 (read-only)');
        case 1: return chalk.yellow('Tier 1 (workspace write)');
        case 2: return chalk.hex('#FFA500')('Tier 2 (system/package)');
        case 3: return chalk.red.bold('Tier 3 (DANGEROUS)');
    }
}

/**
 * Truncate path for display
 */
function truncatePath(path: string, maxLen: number = 40): string {
    if (path.length <= maxLen) return path;
    return '...' + path.slice(-(maxLen - 3));
}

/**
 * Display permission request box
 */
function displayPermissionBox(result: GateResult, reason: string): void {
    const boxWidth = 56;
    const topBorder = '╭─ Permission Required ' + '─'.repeat(boxWidth - 22) + '╮';
    const bottomBorder = '╰' + '─'.repeat(boxWidth) + '╯';

    console.log('');
    console.log(chalk.yellow(topBorder));

    const lines = [
        ['Command:', chalk.white(truncatePath(result.command, 40))],
        ['cwd:', chalk.gray(truncatePath(result.cwd, 40))],
        ['Risk:', getRiskBadge(result.riskTier)],
        ['Why:', chalk.gray(reason)],
    ];

    for (const [label, value] of lines) {
        console.log(chalk.yellow('│ ') + chalk.gray(label.padEnd(10)) + value);
    }

    // Side effects
    if (result.paths.length > 0 || result.domains.length > 0 || result.ports.length > 0) {
        console.log(chalk.yellow('│ ') + chalk.gray('Side Effects:'));

        if (result.paths.length > 0) {
            const writes = result.paths.filter(p => p.operation === 'write');
            const reads = result.paths.filter(p => p.operation === 'read');
            if (writes.length > 0) {
                console.log(chalk.yellow('│ ') + chalk.gray('  - Writes: ') + chalk.white(writes.map(p => p.path).join(', ')));
            }
            if (reads.length > 0) {
                console.log(chalk.yellow('│ ') + chalk.gray('  - Reads: ') + chalk.gray(reads.map(p => p.path).join(', ')));
            }
        }

        if (result.domains.length > 0) {
            console.log(chalk.yellow('│ ') + chalk.gray('  - Network: ') + chalk.cyan(result.domains.join(', ')));
        }

        if (result.ports.length > 0) {
            console.log(chalk.yellow('│ ') + chalk.gray('  - Ports: ') + chalk.magenta(result.ports.join(', ')));
        }
    }

    console.log(chalk.yellow(bottomBorder));
    console.log('');
}

// ==================== CHECKPOINT ====================

/**
 * Offer to create checkpoint before risky operation
 */
async function offerCheckpoint(result: GateResult): Promise<boolean> {
    if (result.riskTier < 2) return true;

    const env = getEnvironment();

    // Check if git repo
    const isGitRepo = existsSync(join(env.workspaceRoot, '.git'));

    if (isGitRepo) {
        const createCheckpoint = await confirm({
            message: 'Create git checkpoint before proceeding?',
            default: true,
        });

        if (createCheckpoint) {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                execSync(`git stash push -u -m "agdi-checkpoint-${timestamp}"`, {
                    cwd: env.workspaceRoot,
                    stdio: 'pipe',
                });
                console.log(chalk.green('✓ Checkpoint created (git stash)'));
                return true;
            } catch {
                console.log(chalk.yellow('⚠ Could not create git checkpoint'));
            }
        }
    } else {
        const createSnapshot = await confirm({
            message: 'Create workspace snapshot before proceeding?',
            default: true,
        });

        if (createSnapshot) {
            try {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const snapshotDir = join(env.workspaceRoot, '.agdi', 'snapshots', timestamp);
                mkdirSync(snapshotDir, { recursive: true });
                cpSync(env.workspaceRoot, snapshotDir, {
                    recursive: true,
                    filter: (src) => !src.includes('.agdi/snapshots') && !src.includes('node_modules'),
                });
                console.log(chalk.green(`✓ Snapshot created: ${snapshotDir}`));
                return true;
            } catch (error) {
                console.log(chalk.yellow('⚠ Could not create snapshot'));
            }
        }
    }

    return true;
}

// ==================== APPROVAL PROMPT ====================

/**
 * Show approval prompt with 6 options
 */
async function promptApproval(result: GateResult, reason: string): Promise<ApprovalChoice> {
    displayPermissionBox(result, reason);
    logApprovalRequest(result, reason);

    const choice = await select<ApprovalChoice>({
        message: 'Action:',
        choices: [
            { name: '[A] Approve once', value: 'approve_once' },
            { name: '[S] Approve tool for session', value: 'approve_session' },
            { name: '[+] Always allow (save rule)', value: 'always_allow' },
            { name: '[?] Always prompt (save rule)', value: 'always_prompt' },
            { name: '[-] Always forbid (save rule)', value: 'always_forbid' },
            { name: '[D] Deny', value: 'deny' },
        ],
    });

    logApprovalDecision(result, choice);

    // Handle rule creation
    if (choice === 'always_allow' || choice === 'always_prompt' || choice === 'always_forbid') {
        const action = choice === 'always_allow' ? 'allow' : choice === 'always_prompt' ? 'prompt' : 'forbid';
        const pattern = result.parsedArgv.slice(0, 2); // Use first 2 tokens as pattern
        addRule(pattern, action, `User rule for: ${result.command.substring(0, 30)}`);
        console.log(chalk.gray(`✓ Rule saved: ${pattern.join(' ')} → ${action}`));
    }

    // Handle session rule
    if (choice === 'approve_session') {
        const pattern = result.parsedArgv.slice(0, 2);
        addSessionRule(pattern, 'allow', `Session approval for: ${result.command.substring(0, 30)}`);
        console.log(chalk.gray(`✓ Approved for this session`));
    }

    return choice;
}

// ==================== MAIN EXECUTION ====================

/**
 * Execute a command through the permission gate
 */
export async function safeExecute(
    command: string,
    options: {
        cwd?: string;
        reason?: string;
        autoApprove?: boolean;
        shell?: boolean;
        stdio?: 'inherit' | 'pipe';
    } = {}
): Promise<ExecutionResult> {
    const startTime = Date.now();
    const env = getEnvironment();
    const cwd = options.cwd || env.cwd;

    // Evaluate through gate
    const gateResult = evaluateCommand(command, cwd);
    logGateEvaluation(gateResult);

    // Handle deny
    if (gateResult.decision === 'deny') {
        console.log(chalk.red('\n⛔ Command blocked'));
        console.log(chalk.gray(`   Reason: ${gateResult.reason}`));
        if (gateResult.violations.length > 0) {
            for (const v of gateResult.violations) {
                console.log(chalk.gray(`   - ${v}`));
            }
        }
        console.log('');

        return {
            allowed: false,
            exitCode: -1,
            output: '',
            error: gateResult.reason,
            duration: Date.now() - startTime,
        };
    }

    // Handle prompt
    if (gateResult.decision === 'prompt') {
        const choice = await promptApproval(gateResult, options.reason || gateResult.reason);

        if (choice === 'deny' || choice === 'always_forbid') {
            console.log(chalk.yellow('\n⛔ Command denied by user\n'));
            return {
                allowed: false,
                exitCode: -1,
                output: '',
                error: 'Denied by user',
                duration: Date.now() - startTime,
            };
        }

        // Offer checkpoint for risky operations
        if (gateResult.riskTier >= 2) {
            await offerCheckpoint(gateResult);
        }
    }

    // Execute command
    console.log(chalk.gray(`\n▶ ${command}\n`));

    return new Promise((resolve) => {
        let output = '';
        let error = '';

        const child = spawn(command, [], {
            cwd,
            shell: options.shell ?? true,
            stdio: options.stdio === 'pipe' ? 'pipe' : 'inherit',
        });

        if (options.stdio === 'pipe') {
            child.stdout?.on('data', (data) => {
                output += data.toString();
            });
            child.stderr?.on('data', (data) => {
                error += data.toString();
            });
        }

        child.on('close', (code) => {
            const duration = Date.now() - startTime;
            const exitCode = code ?? 0;

            logCommandResult(command, exitCode, output, error || undefined, duration);

            if (exitCode === 0) {
                console.log(chalk.green('\n✓ Command completed successfully\n'));
            } else {
                console.log(chalk.red(`\n✗ Command exited with code ${exitCode}\n`));
            }

            resolve({
                allowed: true,
                exitCode,
                output,
                error: error || undefined,
                duration,
            });
        });

        child.on('error', (err) => {
            const duration = Date.now() - startTime;
            logCommandResult(command, -1, '', err.message, duration);

            console.log(chalk.red(`\n✗ Command failed: ${err.message}\n`));

            resolve({
                allowed: true,
                exitCode: -1,
                output: '',
                error: err.message,
                duration,
            });
        });
    });
}

// ==================== LEGACY EXPORTS ====================

// Keep old exports for backwards compatibility
export { evaluateCommand } from './permission-gate.js';
export { logCommandResult as logCommandExecution } from './audit-logger.js';
