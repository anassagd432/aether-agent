/**
 * Squad Command - Autonomous Multi-Agent Builder
 * 
 * Usage: agdi squad "Build a SaaS for dog walking"
 * 
 * This command activates the Agdi Squad - a team of specialized AI agents
 * that work together to build complete web applications from a single prompt.
 */

import chalk from 'chalk';
import ora from 'ora';
import { input } from '@inquirer/prompts';
import { SquadOrchestrator, SquadConfig, SquadResult } from '../agents/core/squad-orchestrator.js';
import type { ILLMProvider } from '../core/types/index.js';
import { ui } from '../utils/ui.js';

// ==================== SQUAD COMMAND ====================

export interface SquadCommandOptions {
    deploy?: boolean;
    verbose?: boolean;
    output?: string;
}

export async function runSquadCommand(
    prompt: string | undefined,
    llm: ILLMProvider,
    options: SquadCommandOptions = {}
): Promise<SquadResult | null> {
    console.log(chalk.cyan.bold('\n🦸 Agdi Squad - Autonomous Development Team\n'));

    // Get prompt if not provided
    let userPrompt = prompt;
    if (!userPrompt) {
        userPrompt = await input({
            message: 'What would you like me to build?',
            default: 'A simple todo app with authentication',
        });
    }

    if (!userPrompt.trim()) {
        console.log(chalk.red('Error: Please provide a project description.'));
        return null;
    }

    if (ui.flags.saas) {
        userPrompt = `${userPrompt}\n\nConstraints: Build a production SaaS using Next.js App Router, Prisma, Postgres, and Stripe. Include auth, billing, multi-tenant orgs, and a dashboard.`;
    }

    // Configure the squad
    const config: Partial<SquadConfig> = {
        workspaceRoot: options.output || process.cwd(),
        verbose: options.verbose ?? true,
        autoDeploy: options.deploy ?? false,
    };

    // Initialize orchestrator
    const spinner = ora('Assembling the squad...').start();
    const orchestrator = new SquadOrchestrator(llm, config);
    spinner.succeed('Squad assembled!');

    console.log(chalk.gray('\nTeam Members:'));
    console.log(chalk.gray('  🧠 Manager  - Plans and coordinates'));
    console.log(chalk.gray('  🎨 Frontend - Builds the UI'));
    console.log(chalk.gray('  ⚙️  Backend  - Creates APIs'));
    console.log(chalk.gray('  🕵️  QA       - Tests and fixes'));
    if (options.deploy) {
        console.log(chalk.gray('  🚀 DevOps   - Deploys to production'));
    }
    console.log('');

    // Run the squad
    const result = await orchestrator.run(userPrompt);

    // Display results
    console.log('\n');
    if (result.success) {
        console.log(chalk.green.bold('✅ Mission Accomplished!\n'));
    } else {
        console.log(chalk.yellow.bold('⚠️ Mission Completed with Issues\n'));
    }

    console.log(chalk.white('Summary:'));
    console.log(chalk.gray(`  Duration: ${(result.duration / 1000).toFixed(1)}s`));
    console.log(chalk.gray(`  Files Created: ${result.filesCreated.length}`));
    console.log(chalk.gray(`  Files Modified: ${result.filesModified.length}`));

    if (result.deploymentUrl) {
        console.log(chalk.green(`  Live URL: ${result.deploymentUrl}`));
    }

    if (result.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        result.errors.forEach(err => {
            console.log(chalk.red(`  • ${err}`));
        });
    }

    // Show created files
    if (result.filesCreated.length > 0) {
        console.log(chalk.white('\nCreated Files:'));
        result.filesCreated.slice(0, 10).forEach(file => {
            console.log(chalk.green(`  ✓ ${file}`));
        });
        if (result.filesCreated.length > 10) {
            console.log(chalk.gray(`  ... and ${result.filesCreated.length - 10} more`));
        }
    }

    console.log('');
    return result;
}

export default runSquadCommand;
