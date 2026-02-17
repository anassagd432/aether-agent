#!/usr/bin/env node

/**
 * Agdi CLI — The Autonomous AI Employee
 * Build, test, and deploy from a single prompt in your terminal
 * 
 * v3.3.5 - The "Guru Killer" Wizard Upgrade
 */

import { Command } from 'commander';
import chalk from 'chalk'
import ora from 'ora';
import { input, select, confirm } from '@inquirer/prompts';
import { createLLMProvider, ProjectManager, generateApp } from './core/index.js';
import { writeProject, loadConfig, saveConfig } from './utils/index.js';
import { login, showStatus } from './commands/auth.js';
import { startChat } from './commands/chat.js';
import { runProject } from './commands/run.js';
import { needsOnboarding, runOnboarding, selectModel, getActiveProvider, PROVIDER_MODELS, type ProviderType } from './commands/onboarding.js';
import { startCodingMode } from './commands/agdi-dev.js';
import { runDoctor } from './commands/doctor.js';
import { runSquadCommand } from './commands/squad.js';
import { runImportCommand } from './commands/import.js';
import { runWizard } from './commands/wizard.js';
import { runReplayCommand } from './commands/replay.js';
import { runTUI } from './commands/tui-entry.js';
import { ui } from './utils/ui.js';

// ASCII Art Banner (only shown on help)
const BANNER = `
${chalk.cyan(`    ___              __ _  `)}
${chalk.cyan(`   /   |  ____ _____/ /(_) `)}
${chalk.cyan(`  / /| | / __ \`/ __  // /  `)}
${chalk.cyan(` / ___ |/ /_/ / /_/ // /   `)}
${chalk.cyan(`/_/  |_|\\_, /\\__,_//_/    `)}
${chalk.cyan(`       /____/              `)}
`;

const program = new Command();

program
    .name('agdi')
    .description(chalk.cyan('🦸 The Autonomous AI Employee'))
    .version('3.3.5')
    .option('-y, --yes', 'Auto-approve all prompts (headless/CI mode)')
    .option('-m, --minimal', 'Generate only the requested file(s), not a full app')
    .option('-d, --dry-run', 'Show what would be created without writing files')
    .option('--saas', 'Generate a production SaaS blueprint (Next.js + Prisma + Postgres + Stripe)');

// Parse global options early for headless mode
program.hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.yes) {
        ui.setFlags({ yes: true, headless: true });
    }
    if (opts.minimal) {
        ui.setFlags({ minimal: true });
    }
    if (opts.dryRun) {
        ui.setFlags({ dryRun: true });
    }
    if (opts.saas) {
        ui.setFlags({ saas: true });
    }
});

// Override help output with styled banner (non-recursive)
program.addHelpText('beforeAll', () => {
    return BANNER +
        '\n' + chalk.gray('  The Autonomous AI Employee') +
        '\n' + chalk.gray('  ─────────────────────────────\n');
});

program.addHelpText('afterAll', () => {
    return (
        '\n' +
        chalk.gray('Links:') +
        '\n' +
        `  ${chalk.cyan('Discord:')} https://discord.gg/pPkZ93Yb` +
        '\n'
    );
});

// Default action - Enter interactive Wizard Mode (Zero-to-Hero flow)
program.action(async () => {
    try {
        // Launch the ClawBot Wizard directly (User request: "agdi" should just start the flow)
        await runWizard();
    } catch (error) {
        if ((error as Error).name === 'ExitPromptError') {
            console.log(chalk.gray('\n\n👋 Goodbye!\n'));
            try { ui.safeExit(0); } catch { }
            return;
        }
        if ((error as Error).name === 'GracefulExitError') {
            return;
        }
        throw error;
    }
});

// Auth command
program
    .command('auth')
    .description('Configure API keys')
    .option('--status', 'Show authentication status')
    .action(async (options) => {
        try {
            if (options.status) {
                await showStatus();
            } else {
                await login();
            }
        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.gray('\n\n👋 Cancelled.\n'));
                try { ui.safeExit(0); } catch { }
                return;
            }
            if ((error as Error).name === 'GracefulExitError') {
                return;
            }
            throw error;
        }
    });

// Model command - Interactive model selector
program
    .command('model')
    .alias('models')
    .description('Change AI model')
    .action(async () => {
        try {
            await selectModel();
        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.gray('\n\n👋 Cancelled.\n'));
                try { ui.safeExit(0); } catch { }
                return;
            }
            if ((error as Error).name === 'GracefulExitError') {
                return;
            }
            throw error;
        }
    });

// Chat command - Simple chat mode
program
    .command('chat')
    .description('Start a chat session')
    .action(async () => {
        try {
            if (needsOnboarding()) {
                await runOnboarding();
            }
            await startChat();
        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.gray('\n\n👋 Goodbye!\n'));
                try { ui.safeExit(0); } catch { }
                return;
            }
            if ((error as Error).name === 'GracefulExitError') {
                return;
            }
            throw error;
        }
    });

// Run command - Start dev server
program
    .command('run [directory]')
    .description('Run a generated project')
    .action(async (directory) => {
        try {
            await runProject(directory);
        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.gray('\n\n👋 Cancelled.\n'));
                try { ui.safeExit(0); } catch { }
                return;
            }
            if ((error as Error).name === 'GracefulExitError') {
                return;
            }
            throw error;
        }
    });

// Build command - Quick app generation
program
    .command('build <prompt>')
    .alias('b')
    .description('Generate an app from a prompt')
    .option('-o, --output <dir>', 'Output directory', './generated-app')
    .option('-m, --minimal', 'Generate only the requested file(s), not a full app')
    .option('-d, --dry-run', 'Show what would be created without writing files')
    .option('--saas', 'Generate a production SaaS blueprint (Next.js + Prisma + Postgres + Stripe)')
    .action(async (prompt, options) => {
        try {
            if (needsOnboarding()) {
                await runOnboarding();
            }

            if (options.saas) {
                ui.setFlags({ saas: true });
            }

            const activeConfig = getActiveProvider();
            if (!activeConfig) {
                console.log(chalk.red('❌ No API key configured. Run: agdi auth'));
                return;
            }

            const spinner = ora('Generating application...').start();

            try {
                const llm = createLLMProvider(activeConfig.provider as 'gemini' | 'openrouter', {
                    apiKey: activeConfig.apiKey,
                    model: activeConfig.model,
                });

                const pm = new ProjectManager();
                pm.create(options.output.replace('./', ''), prompt);

                const { plan, files } = await generateApp(prompt, llm, (step, file) => {
                    spinner.text = file ? `${step} ${chalk.gray(file)}` : step;
                });

                pm.updateFiles(files);
                pm.updateDependencies(plan.dependencies);

                if (options.dryRun || ui.flags.dryRun) {
                    spinner.stop();
                    console.log(chalk.cyan.bold('\n🚧 DRY RUN SUMMARY\n'));
                    console.log(chalk.gray(`Project: ${plan.name}\n`));

                    console.log(chalk.cyan('Files to be created:'));
                    files.forEach(f => console.log(chalk.gray(`  📄 ${f.path}`)));

                    console.log(chalk.cyan('\nDependencies:'));
                    console.log(chalk.gray(`  📦 ${plan.dependencies.join(', ')}`));

                    console.log(chalk.green('\n✓ Dry run complete. No files written.\n'));
                    return;
                }

                await writeProject(pm.get()!, options.output);

                spinner.succeed(chalk.green('App generated!'));
                console.log(chalk.gray(`\n📁 Created ${files.length} files in ${chalk.cyan(options.output)}`));

                if (ui.flags.saas || options.saas) {
                    console.log(chalk.cyan('\nSaaS Quick Start:'));
                    console.log(chalk.gray(`  1) cd ${options.output}`));
                    console.log(chalk.gray('  2) npm install'));
                    console.log(chalk.gray('  3) cp .env.example .env'));
                    console.log(chalk.gray('  4) npx prisma generate'));
                    console.log(chalk.gray('  5) npx prisma db push'));
                    console.log(chalk.gray('  6) npm run dev\n'));
                } else {
                    console.log(chalk.gray('\nNext: cd ' + options.output + ' && npm install && npm run dev\n'));
                }

            } catch (error) {
                spinner.fail('Generation failed');
                const msg = error instanceof Error ? error.message : String(error);
                if (msg.includes('429') || msg.includes('quota')) {
                    console.log(chalk.yellow('\n⚠️  Quota exceeded. Run: agdi model\n'));
                } else if (msg.includes('401') || msg.includes('403')) {
                    console.log(chalk.red('\n🔑 Invalid API key. Run: agdi auth\n'));
                } else {
                    console.error(chalk.red('\n' + msg + '\n'));
                }
                ui.safeExit(1);
            }

        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.gray('\n\n👋 Cancelled.\n'));
                try { ui.safeExit(0); } catch { }
                return;
            }
            if ((error as Error).name === 'GracefulExitError') {
                return;
            }
            throw error;
        }
    });

// Config command
program
    .command('config')
    .description('Show configuration')
    .action(async () => {
        const config = loadConfig();
        const active = getActiveProvider();

        console.log(chalk.cyan.bold('\n⚙️  Configuration\n'));
        console.log(chalk.gray('  Provider: ') + chalk.cyan(config.defaultProvider || 'not set'));
        console.log(chalk.gray('  Model:    ') + chalk.cyan(config.defaultModel || 'not set'));
        console.log(chalk.gray('  Config:   ') + chalk.gray('~/.agdi/config.json'));

        console.log(chalk.cyan.bold('\n🔐 API Keys\n'));
        const keys = [
            ['Gemini', config.geminiApiKey],
            ['OpenRouter', config.openrouterApiKey],
            ['OpenAI', config.openaiApiKey],
            ['Anthropic', config.anthropicApiKey],
            ['DeepSeek', config.deepseekApiKey],
        ];
        for (const [name, key] of keys) {
            const status = key ? chalk.green('✓') : chalk.gray('✗');
            console.log(`  ${status} ${name}`);
        }

        // Telemetry status
        console.log(chalk.cyan.bold('\n📊 Telemetry\n'));
        const telemetryEnabled = config.telemetry?.enabled ?? false;
        console.log(`  ${telemetryEnabled ? chalk.green('✓ Enabled') : chalk.gray('✗ Disabled')}`);
        console.log(chalk.gray('  Change with: agdi config telemetry --enable | --disable'));
        console.log('');
        console.log('');
    });

// Telemetry config subcommand
program
    .command('config:telemetry')
    .alias('telemetry')
    .description('Manage telemetry settings')
    .option('--enable', 'Enable anonymous telemetry')
    .option('--disable', 'Disable telemetry')
    .option('--status', 'Show current telemetry status')
    .option('--dry-run', 'Show exactly what data would be sent (transparency mode)')
    .option('--test', 'Alias for --dry-run')
    .action(async (options) => {
        const { isTelemetryEnabled, setTelemetryConsent, getTelemetryConfig } = await import('./core/telemetry/config.js');
        const { generateSampleEvent, generateSanitizationDemo } = await import('./core/telemetry/telemetry-service.js');

        // Feature 1: Transparency Mode (--dry-run / --test)
        if (options.dryRun || options.test) {
            console.log(chalk.cyan.bold('\n🔍 TELEMETRY TRANSPARENCY MODE\n'));
            console.log(chalk.gray('This is exactly what Agdi sends. Notice there is'));
            console.log(chalk.green.bold('NO source code, file paths, or API keys.\n'));

            // Show a sample event
            console.log(chalk.white.bold('📊 Sample "Build Failed" Event:\n'));
            const sample = generateSampleEvent();
            console.log(chalk.gray(JSON.stringify(sample, null, 2)));

            // Show sanitization in action
            console.log(chalk.white.bold('\n🛡️  Sanitization Demo:\n'));
            console.log(chalk.gray('Even if sensitive data accidentally enters an error message,'));
            console.log(chalk.gray('our sanitization layer strips it before transmission:\n'));

            const demo = generateSanitizationDemo();
            console.log(chalk.red.bold('BEFORE sanitization (never sent):'));
            console.log(chalk.gray(JSON.stringify({
                errorCode: (demo.before as any).errorCode,
                feedback: (demo.before as any).feedback,
            }, null, 2)));

            console.log(chalk.green.bold('\nAFTER sanitization (what we actually send):'));
            console.log(chalk.gray(JSON.stringify({
                errorCode: demo.after.errorCode,
                feedback: demo.after.feedback,
            }, null, 2)));

            console.log(chalk.cyan('\n✅ Your code and secrets are NEVER transmitted.'));
            console.log(chalk.gray('   Learn more: https://agdi-dev.vercel.app/privacy\n'));
            return;
        }

        if (options.enable) {
            setTelemetryConsent(true);
            console.log(chalk.green('\n✅ Telemetry enabled'));
            console.log(chalk.gray('   We collect: success/fail, error types, model used'));
            console.log(chalk.gray('   We NEVER collect: source code, API keys, file paths'));
            console.log(chalk.gray('   Verify anytime: agdi config telemetry --dry-run\n'));
        } else if (options.disable) {
            setTelemetryConsent(false);
            console.log(chalk.yellow('\n📊 Telemetry disabled'));
            console.log(chalk.gray('   You can re-enable anytime with: agdi config telemetry --enable\n'));
        } else {
            // Show status
            const config = getTelemetryConfig();
            console.log(chalk.cyan.bold('\n📊 Telemetry Status\n'));
            console.log(chalk.gray('  Enabled:  ') + (config.enabled ? chalk.green('Yes') : chalk.gray('No')));
            console.log(chalk.gray('  Consent:  ') + (config.consentAsked ? chalk.green('Asked') : chalk.gray('Not asked')));
            if (config.anonymousId) {
                console.log(chalk.gray('  ID:       ') + chalk.gray(config.anonymousId.slice(0, 8) + '...'));
            }
            console.log('');
            console.log(chalk.gray('  Enable:   agdi config telemetry --enable'));
            console.log(chalk.gray('  Disable:  agdi config telemetry --disable'));
            console.log(chalk.gray('  Verify:   agdi config telemetry --dry-run\n'));
        }
    });

// Doctor command
program
    .command('doctor')
    .alias('doc')
    .description('Run self-diagnosis checks')
    .action(async () => {
        try {
            await runDoctor();
        } catch (error) {
            console.error(chalk.red('Diagnostic failed: ' + error));
            ui.safeExit(1);
        }
    });

// Squad command - Multi-agent autonomous builder
program
    .command('squad [prompt]')
    .alias('s')
    .description('🦸 Autonomous multi-agent app builder')
    .option('-d, --deploy', 'Auto-deploy to Vercel after build')
    .option('-o, --output <dir>', 'Output directory', './')
    .option('-v, --verbose', 'Show detailed agent logs', true)
    .action(async (prompt, options) => {
        try {
            if (needsOnboarding()) {
                await runOnboarding();
            }

            const activeConfig = getActiveProvider();
            if (!activeConfig) {
                console.log(chalk.red('❌ No API key configured. Run: agdi auth'));
                return;
            }

            const llm = createLLMProvider(activeConfig.provider as 'gemini' | 'openrouter', {
                apiKey: activeConfig.apiKey,
                model: activeConfig.model,
            });

            await runSquadCommand(prompt, llm, {
                deploy: options.deploy,
                output: options.output,
                verbose: options.verbose,
            });

        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.gray('\n\n👋 Cancelled.\n'));
                try { ui.safeExit(0); } catch { }
                return;
            }
            if ((error as Error).name === 'GracefulExitError') {
                return;
            }
            throw error;
        }
    });

// Replay command - Re-run a previous squad run
program
    .command('replay <runId>')
    .description('🔁 Replay a previous squad run')
    .option('-o, --output <dir>', 'Workspace directory (default: current)', './')
    .option('-v, --verbose', 'Show detailed agent logs', true)
    .option('--no-exact', 'Disable exact replay from stored outputs')
    .action(async (runId: string, options) => {
        try {
            if (options.exact) {
                await runReplayCommand(runId, null, {
                    workspace: options.output,
                    verbose: options.verbose,
                    exact: options.exact,
                });
                return;
            }

            if (needsOnboarding()) {
                await runOnboarding();
            }

            const activeConfig = getActiveProvider();
            if (!activeConfig) {
                console.log(chalk.red('❌ No API key configured. Run: agdi auth'));
                return;
            }

            const llm = createLLMProvider(activeConfig.provider as 'gemini' | 'openrouter', {
                apiKey: activeConfig.apiKey,
                model: activeConfig.model,
            });

            await runReplayCommand(runId, llm, {
                workspace: options.output,
                verbose: options.verbose,
                exact: options.exact,
            });
        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.gray('\n\n👋 Cancelled.\n'));
                try { ui.safeExit(0); } catch { }
                return;
            }
            if ((error as Error).name === 'GracefulExitError') {
                return;
            }
            throw error;
        }
    });

// Import command - Import GitHub repository
program
    .command('import <url>')
    .alias('i')
    .description('📦 Import a GitHub repository')
    .option('-o, --output <dir>', 'Output directory (default: repo name)')
    .action(async (url: string, options: { output?: string }) => {
        try {
            await runImportCommand(url, options.output);
        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                console.log(chalk.gray('\n\n👋 Cancelled.\n'));
                try { ui.safeExit(0); } catch { }
                return;
            }
            throw error;
        }
    });

// Wizard command - Interactive Setup
program
    .command('wizard')
    .alias('w')
    .description('🧙 Start the ClawBot Setup Wizard')
    .action(async () => {
        try {
            await runWizard();
        } catch (error) {
            console.log(chalk.gray('\n\n👋 Cancelled.\n'));
            try { ui.safeExit(0); } catch { }
        }
    });

program.parse();
