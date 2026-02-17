/**
 * Agdi Wizard - The Interactive "Zero-to-Hero" Flow
 * Orchestrates the entire user journey from setup to autonomous squad execution.
 */

import { input, select, confirm, password } from '@inquirer/prompts';
import chalk from 'chalk';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { loadConfig, saveConfig } from '../utils/config.js';
import { needsOnboarding, runOnboarding, getActiveProvider } from './onboarding.js';
import { createLLMProvider } from '../core/index.js';
import { runSquadCommand } from './squad.js';
import { ui } from '../utils/ui.js';

/**
 * Main Wizard Entry Point
 */
export async function runWizard() {
    // 1. Safety Check
    await checkSafety();

    // 2. LLM Setup (Core Authentication)
    if (needsOnboarding()) {
        await runOnboarding();
    }

    // 3. Optional Tool Setup (Search & Deploy)
    await setupOptionalTools();

    // 4. SaaS Mode (Blueprint)
    const configBefore = loadConfig();

    const wantsSaas = await confirm({
        message: 'Enable SaaS Blueprint mode? (Next.js + Prisma + Postgres + Stripe)',
        default: configBefore.saasBlueprint ?? true,
    });

    // Persist the choice so the wizard behaves consistently across runs.
    if (configBefore.saasBlueprint !== wantsSaas) {
        saveConfig({ ...configBefore, saasBlueprint: wantsSaas });
    }

    if (wantsSaas) {
        ui.setFlags({ saas: true });
    }

    // 5. The Mission (Prompt Collection)
    console.log(chalk.cyan.bold('\n🎯 Mission Control (ClawBot Setup)'));
    console.log(chalk.gray('I need to calibrate the squad. Answer these 4 questions to define your build.\n'));
    
    // Q1: The Vision
    const vision = await input({
        message: '1. What are we building today? (e.g. "A Kanban board", "Portfolio site")',
        validate: (value) => value.length > 3 ? true : 'Please provide a bit more detail',
    });

    // Q2: The Target
    const target = await input({
        message: '2. Who is this for? (Target Audience)',
        default: 'General users',
    });

    // Q3: The Problem
    const problem = await input({
        message: '3. What core problem does this solve?',
        default: 'Simplifying a workflow',
    });

    // Q4: Assets & Style
    const needsImages = await confirm({
        message: '4. Do you need generated images or placeholder assets?',
        default: true,
    });

    // Construct the Master Prompt
    let prompt = `Build an application with the following specification:
    - **Concept:** ${vision}
    - **Target Audience:** ${target}
    - **Problem Solved:** ${problem}
    - **Asset Requirement:** ${needsImages ? 'Include placeholder images and assets' : 'Minimalist, code-only layout'}
    `;

    if (wantsSaas) {
        prompt = `${prompt}\n\nConstraints: Build a production SaaS using Next.js App Router, Prisma, Postgres, and Stripe. Include auth, billing, multi-tenant orgs, and a dashboard.`;
    }

    // 6. Handover to the Squad
    const activeConfig = getActiveProvider();
    if (!activeConfig) {
        console.log(chalk.red('❌ No API key configured. Run: agdi auth'));
        return;
    }

    // Create the LLM instance early for analysis
    const llm = createLLMProvider(activeConfig.provider as 'gemini' | 'openrouter', {
        apiKey: activeConfig.apiKey,
        model: activeConfig.model,
    });

    // --- INTELLIGENT ANALYST LOOP ---
    console.log(chalk.cyan('\n🤔 Analyzing requirements...'));
    try {
        const analysis = await llm.generate(prompt, `
            You are a Senior Product Manager. Analyze this app idea.
            If it is vague (e.g., "make a CRM"), generate 3 specific questions to clarify scope, tech stack, and features.
            If it is detailed enough, return "DETAILED".
            
            Format:
            Questions:
            1. [Question 1]
            2. [Question 2]
            3. [Question 3]
        `);

        if (!analysis.text.includes('DETAILED')) {
            console.log(chalk.yellow('\n💡 I need a few more details to build exactly what you want:'));
            const questions = analysis.text.split('\n').filter(line => line.match(/^\d+\./));
            
            const answers = [];
            for (const q of questions.slice(0, 3)) {
                const answer = await input({ message: q.replace(/^\d+\.\s*/, '') });
                answers.push({ q, a: answer });
            }

            console.log(chalk.cyan('\n🔄 Synthesizing Master Plan...'));
            const synthesis = await llm.generate(
                `Original Request: ${prompt}\n\nClarifications:\n${answers.map(x => `Q: ${x.q}\nA: ${x.a}`).join('\n')}\n\nRewrite the original request into a comprehensive technical specification for a developer squad.`,
                'You are a Technical Architect.'
            );
            prompt = synthesis.text;
            console.log(chalk.gray('\nUpdated Spec: ' + prompt.substring(0, 100) + '...\n'));
        }
    } catch (err) {
        // Fallback if analysis fails (e.g. API error), just proceed with raw prompt
        console.log(chalk.gray('Skipping analysis (API unreachable), proceeding with raw prompt.'));
    }
    // -------------------------------

    console.log(chalk.cyan('\n🚀 Assembling the Squad...'));
    console.log(chalk.gray('Frontend, Backend, QA, and DevOps agents are coming online.\n'));

    // Launch the Squad
    const config = loadConfig();
    const canDeploy = !!(config.vercelToken || config.netlifyToken || config.railwayToken);
    
    await runSquadCommand(prompt, llm, {
        deploy: canDeploy, // Auto-deploy if configured
        output: './',      // Current directory (safe because we checked safety earlier)
        verbose: true,
    });

    if (ui.flags.saas) {
        console.log(chalk.cyan('\nSaaS Quick Start:'));
        console.log(chalk.gray('  1) npm install'));
        console.log(chalk.gray('  2) cp .env.example .env'));
        console.log(chalk.gray('  3) npx prisma generate'));
        console.log(chalk.gray('  4) npx prisma db push'));
        console.log(chalk.gray('  5) npm run dev\n'));
    }
}

/**
 * 1. Safety Check
 * Detects if running in HOME or ROOT and forces a safe directory.
 */
async function checkSafety() {
    const cwd = process.cwd();
    const home = os.homedir();
    const root = path.parse(cwd).root;

    const isUnsafe = cwd === home || cwd === root;

    if (isUnsafe) {
        console.log(chalk.yellow.bold('\n⚠️  Safety Warning'));
        console.log(chalk.gray(`You are running Agdi in ${chalk.cyan(cwd)}.`));
        console.log(chalk.gray('Agdi writes files and runs commands. It needs its own space.\n'));

        const action = await select({
            message: 'What would you like to do?',
            choices: [
                { name: '📂 Create a new project folder (Recommended)', value: 'create' },
                { name: '🔥 Run here anyway (Dangerous)', value: 'unsafe' },
                { name: '❌ Cancel', value: 'cancel' },
            ],
        });

        if (action === 'cancel') {
            ui.safeExit(0);
        }

        if (action === 'create') {
            const folderName = await input({
                message: 'Project name:',
                default: 'my-agdi-app',
                validate: (v) => /^[a-z0-9-_]+$/i.test(v) ? true : 'Invalid folder name',
            });

            const newPath = path.join(cwd, folderName);
            if (!fs.existsSync(newPath)) {
                fs.mkdirSync(newPath);
            }
            
            // Change process directory to the new folder
            process.chdir(newPath);
            console.log(chalk.green(`\n📂 Switched to: ${chalk.cyan(newPath)}\n`));
        }
    }
}

/**
 * 3. Optional Tool Setup
 * Guides user through Search and Deployment configuration.
 */
async function setupOptionalTools() {
    const config = loadConfig();
    let configChanged = false;

    // --- Search Configuration ---
    if (!config.searchApiKey) {
        // Only ask if user hasn't explicitly skipped before (we could add a 'skipSearch' flag to config)
        // For now, we'll be polite and ask.
        
        // Check if we should ask (using a simple logic: ask if not set)
        console.log(chalk.white.bold('\n🌐 Web Access (Optional)\n'));
        console.log(chalk.gray('Giving Agdi web access allows it to find up-to-date docs and fix tricky bugs.'));

        const wantsSearch = await confirm({
            message: 'Enable web search capabilities?',
            default: true,
        });

        if (wantsSearch) {
            const provider = await select({
                message: 'Select Search Provider:',
                choices: [
                    { name: 'Brave Search (Recommended)', value: 'brave' },
                    { name: 'Tavily', value: 'tavily' },
                ],
            });

            const keyUrl = provider === 'brave' 
                ? 'https://brave.com/search/api/' 
                : 'https://tavily.com/';

            console.log(chalk.gray(`Get your key at: ${chalk.cyan(keyUrl)}\n`));

            const apiKey = await password({
                message: `Enter your ${provider} API key:`,
                mask: '*',
            });

            if (apiKey) {
                config.searchApiKey = apiKey;
                config.searchProvider = provider as 'brave' | 'tavily';
                config.searchEnabled = true;
                configChanged = true;
                console.log(chalk.green('✅ Web search enabled!'));
            }
        }
    }

    // --- Deployment Configuration ---
    if (!config.vercelToken && !config.netlifyToken && !config.railwayToken) {
        console.log(chalk.white.bold('\n🚀 Deployment (Optional)\n'));
        console.log(chalk.gray('Agdi can automatically deploy your app to the cloud when finished.'));

        const wantsDeploy = await confirm({
            message: 'Enable auto-deployment?',
            default: true,
        });

        if (wantsDeploy) {
            const provider = await select({
                message: 'Select Deployment Target:',
                choices: [
                    { name: 'Vercel', value: 'vercel' },
                    { name: 'Railway', value: 'railway' },
                    { name: 'Netlify', value: 'netlify' },
                ],
            });

            const keyUrl = provider === 'vercel'
                ? 'https://vercel.com/account/tokens'
                : provider === 'railway'
                    ? 'https://railway.app/account/tokens'
                    : 'https://app.netlify.com/user/applications#personal-access-tokens';

            console.log(chalk.gray(`Get your key at: ${chalk.cyan(keyUrl)}\n`));

            const apiKey = await password({
                message: `Enter your ${provider} API token:`,
                mask: '*',
            });

            if (apiKey) {
                if (provider === 'vercel') config.vercelToken = apiKey;
                if (provider === 'netlify') config.netlifyToken = apiKey;
                if (provider === 'railway') config.railwayToken = apiKey;
                config.deploymentProvider = provider as 'vercel' | 'netlify' | 'railway';
                configChanged = true;
                console.log(chalk.green('✅ Auto-deployment enabled!'));
            }
        }
    }

    if (configChanged) {
        saveConfig(config);
    }
}
