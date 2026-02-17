/**
 * Doctor Command - Self-diagnosis for Agdi CLI
 * 
 * Checks Node version, API key validity, config permissions, etc.
 */

import chalk from 'chalk';
import { existsSync, statSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';
import { ui } from '../utils/ui.js';
import { loadConfig } from '../utils/config.js';
import { getActiveProvider } from './onboarding.js';

interface CheckResult {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
}

/**
 * Run all diagnostic checks
 */
export async function runDoctor(): Promise<void> {
    console.log('');
    ui.renderBox('AGDI DOCTOR', 'Running diagnostics...', 'info');
    console.log('');

    const results: CheckResult[] = [];

    // 1. Node.js Version Check
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);

    if (majorVersion >= 18) {
        results.push({
            name: 'Node.js Version',
            status: 'pass',
            message: `${nodeVersion} (≥18 required)`
        });
    } else {
        results.push({
            name: 'Node.js Version',
            status: 'fail',
            message: `${nodeVersion} - Node.js 18+ required!`
        });
    }

    // 2. Config File Check
    const configDir = join(homedir(), '.agdi');
    const configPath = join(configDir, 'config.json');

    if (existsSync(configPath)) {
        // Check permissions on Unix
        if (platform() !== 'win32') {
            try {
                const stats = statSync(configPath);
                const mode = (stats.mode & parseInt('777', 8)).toString(8);
                if (mode === '600') {
                    results.push({
                        name: 'Config Permissions',
                        status: 'pass',
                        message: `${configPath} (mode: 600)`
                    });
                } else {
                    results.push({
                        name: 'Config Permissions',
                        status: 'warn',
                        message: `${configPath} (mode: ${mode}) - Should be 600!`
                    });
                }
            } catch {
                results.push({
                    name: 'Config Permissions',
                    status: 'warn',
                    message: 'Could not check permissions'
                });
            }
        } else {
            results.push({
                name: 'Config File',
                status: 'pass',
                message: `${configPath} exists`
            });
        }
    } else {
        results.push({
            name: 'Config File',
            status: 'warn',
            message: 'No config found. Run: agdi auth'
        });
    }

    // 3. API Key Check
    const activeConfig = getActiveProvider();

    if (activeConfig) {
        const keyPreview = activeConfig.apiKey.slice(0, 8) + '...' + activeConfig.apiKey.slice(-4);
        results.push({
            name: 'API Key',
            status: 'pass',
            message: `${activeConfig.provider} (${keyPreview})`
        });

        results.push({
            name: 'Active Model',
            status: 'pass',
            message: activeConfig.model
        });
    } else {
        results.push({
            name: 'API Key',
            status: 'fail',
            message: 'No API key configured. Run: agdi auth'
        });
    }

    // 4. Audit Log Check
    const auditPath = join(configDir, 'audit.jsonl');
    if (existsSync(auditPath)) {
        results.push({
            name: 'Audit Log',
            status: 'pass',
            message: `Logging to ${auditPath}`
        });
    } else {
        results.push({
            name: 'Audit Log',
            status: 'warn',
            message: 'No audit log found (will be created on first action)'
        });
    }

    // 5. Trust Store Check
    const trustPath = join(configDir, 'trusted-workspaces.json');
    if (existsSync(trustPath)) {
        results.push({
            name: 'Trust Store',
            status: 'pass',
            message: 'Workspace trust store found'
        });
    } else {
        results.push({
            name: 'Trust Store',
            status: 'warn',
            message: 'No trusted workspaces yet'
        });
    }

    // Display Results
    console.log(chalk.bold('Diagnostic Results:\n'));

    for (const result of results) {
        let icon: string;
        let color: typeof chalk;

        switch (result.status) {
            case 'pass':
                icon = '✅';
                color = chalk.green;
                break;
            case 'warn':
                icon = '⚠️';
                color = chalk.yellow;
                break;
            case 'fail':
                icon = '❌';
                color = chalk.red;
                break;
        }

        console.log(`  ${icon} ${chalk.bold(result.name)}`);
        console.log(`     ${color(result.message)}\n`);
    }

    // Summary
    const passed = results.filter(r => r.status === 'pass').length;
    const warnings = results.filter(r => r.status === 'warn').length;
    const failed = results.filter(r => r.status === 'fail').length;

    console.log(chalk.gray('─'.repeat(50)));
    console.log(`\n  ${chalk.bold('Summary:')} ${chalk.green(passed + ' passed')}, ${chalk.yellow(warnings + ' warnings')}, ${chalk.red(failed + ' failed')}\n`);

    if (failed > 0) {
        console.log(chalk.red('  ⚠️ There are critical issues that need attention.\n'));
    } else if (warnings > 0) {
        console.log(chalk.yellow('  ℹ️ There are some warnings, but Agdi should work.\n'));
    } else {
        console.log(chalk.green('  🎉 All checks passed! Agdi is ready to use.\n'));
    }
}
