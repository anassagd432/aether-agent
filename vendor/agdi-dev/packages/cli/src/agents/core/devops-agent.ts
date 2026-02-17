/**
 * DevOps Agent
 * 
 * Deployment and infrastructure specialist.
 * Handles deploying to Vercel, Netlify, or other platforms.
 * Supports token-based authentication for fully autonomous deployment.
 */

import { BaseAgent, SquadTask, AgentOutput, GeneratedFile } from './base-agent.js';
import type { ILLMProvider } from '../../core/types/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { loadConfig } from '../../utils/config.js';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

async function detectBuildOutputDir(cwd: string): Promise<string> {
    try {
        const pkgPath = path.join(cwd, 'package.json');
        const raw = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps['next']) return '.next';
        if (deps['vite']) return 'dist';
        if (deps['react-scripts']) return 'build';
    } catch (error) {
        // ignore
        if (process.env.AGDI_DEBUG === 'true') {
             console.warn('[DevOps] Failed to detect build dir:', error);
        }
    }

    return 'dist';
}

// ==================== DEVOPS SYSTEM PROMPT ====================

const DEVOPS_SYSTEM_PROMPT = `You are a SENIOR DEVOPS ENGINEER with expertise in:
- Vercel / Netlify deployment
- CI/CD pipelines
- Environment variables management
- Domain configuration
- Performance optimization

Your responsibilities:
1. Deploy applications to production
2. Configure environment variables
3. Set up preview deployments
4. Monitor deployment status

When generating config files:
- vercel.json for Vercel settings
- .env.production for production vars
- netlify.toml for Netlify settings

Output Format:
\`\`\`json
// filepath: vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
\`\`\`

Sources:
- If you reference any external docs or guides, list their URLs in a "Sources:" section at the end.

Ensure deployments are secure and optimized.`;

// ==================== DEVOPS AGENT CLASS ====================

export class DevOpsAgent extends BaseAgent {
    private vercelToken?: string;
    private netlifyToken?: string;
    private railwayToken?: string;

    constructor(llm: ILLMProvider, options: { verbose?: boolean } = {}) {
        super('devops', '🚀 DevOps', llm, options);

        // Load tokens from config
        const config = loadConfig();
        this.vercelToken = config.vercelToken;
        this.netlifyToken = config.netlifyToken;
        this.railwayToken = config.railwayToken;
    }

    getSystemPrompt(): string {
        return DEVOPS_SYSTEM_PROMPT;
    }

    /**
     * Check if deployment is possible (token exists)
     */
    canDeploy(platform: 'vercel' | 'netlify' | 'railway' = 'vercel'): boolean {
        if (platform === 'vercel') {
            return !!this.vercelToken;
        }
        if (platform === 'railway') {
            return !!this.railwayToken;
        }
        return !!this.netlifyToken;
    }

    /**
     * Generate deployment configuration
     */
    async generateConfig(platform: 'vercel' | 'netlify' | 'railway' = 'vercel'): Promise<GeneratedFile[]> {
        this.log(`Generating ${platform} config...`);

        if (platform === 'railway') {
            return [
                {
                    path: 'railway.toml',
                    content: `# Railway deployment config
[build]
provider = "nixpacks"

[deploy]
startCommand = "npm run start"
`,
                    action: 'create',
                },
                {
                    path: 'nixpacks.toml',
                    content: `# Nixpacks config for Next.js
[phases.setup]
aptPkgs = ["openssl"]

[phases.build]
cmds = ["npm install", "npm run build"]

[start]
cmd = "npm run start"
`,
                    action: 'create',
                },
            ];
        }

        const response = await this.think(`
Generate deployment configuration for ${platform}.

Requirements:
- Optimize for Next.js App Router
- Configure caching headers
- Set up redirects if needed
- Include build settings
        `);

        return this.extractCodeBlocks(response);
    }

    /**
     * Deploy to Vercel with token-based authentication
     */
    async deployToVercel(cwd: string, production: boolean = false): Promise<{ success: boolean; url?: string; error?: string; output?: string; command?: string }> {
        const mode = production ? 'PRODUCTION' : 'preview';
        this.log(`Deploying to Vercel (${mode})...`);

        // Check for token
        if (!this.vercelToken) {
            this.log('No Vercel token found. Run: agdi auth → Deployment', 'error');
            return {
                success: false,
                error: 'No Vercel token configured. Run: agdi auth → Deployment (Vercel/Netlify/Railway)',
                command: 'npx vercel',
            };
        }

        try {
            // Check if Vercel CLI is installed
            await execAsync('npx vercel --version', { cwd });
        } catch (error) {
            this.log(`Vercel CLI unavailable via npx: ${(error as Error)?.message || error}`, 'warn');
            try {
                // We use npx so we don't necessarily need global install, but this ensures it's available
                // Actually npx downloads on demand, so we might just proceed.
            } catch (installError) {
                // Ignore
            }
        }

        try {
            // Build the command with token passed via environment (security: not visible in ps)
            // Using npx ensures we use the latest compatible version without polluting global scope
            const prodFlag = production ? '--prod' : '';
            const command = `npx vercel ${prodFlag} --yes`;

            this.log(`Running: npx vercel ${prodFlag} --yes`, 'info');

            const { stdout, stderr } = await execAsync(command, {
                cwd,
                timeout: 300000, // 5 minutes
                env: {
                    ...process.env,
                    VERCEL_TOKEN: this.vercelToken, // Pass via env, not CLI (security)
                },
            });

            // Extract URL from output
            const output = stdout + stderr;
            const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
            const url = urlMatch ? urlMatch[0] : undefined;

            if (url) {
                this.log(`Deployed: ${url}`, 'success');
                return { success: true, url, output, command };
            } else {
                // Try to find any URL
                const anyUrl = output.match(/https:\/\/[^\s]+/);
                this.log(`Deployed: ${anyUrl?.[0] || 'Success'}`, 'success');
                return { success: true, url: anyUrl?.[0], output, command };
            }
        } catch (error: unknown) {
            const execError = error as { message?: string; stdout?: string; stderr?: string };
            const errorOutput = execError.stderr || execError.stdout || execError.message || '';

            this.log('Deployment failed', 'error');

            // Check for common errors
            if (errorOutput.includes('Invalid token')) {
                return {
                    success: false,
                    error: 'Invalid Vercel token. Please regenerate at https://vercel.com/account/tokens',
                };
            }

            return {
                success: false,
                error: errorOutput.slice(0, 500) || 'Unknown deployment error',
                output: errorOutput,
                command: 'npx vercel',
            };
        }
    }

    /**
     * Deploy to Netlify with token-based authentication
     */
    async deployToNetlify(cwd: string, production: boolean = false): Promise<{ success: boolean; url?: string; error?: string; output?: string; command?: string }> {
        this.log(`Deploying to Netlify...`);

        if (!this.netlifyToken) {
            return {
                success: false,
                error: 'No Netlify token configured. Run: agdi auth → Deployment (Vercel/Netlify/Railway)',
            };
        }

        try {
            // Check if Netlify CLI is installed
            await execAsync('npx netlify --version', { cwd });
        } catch (error) {
            this.log(`Netlify CLI unavailable via npx: ${(error as Error)?.message || error}`, 'warn');
        }

        try {
            const prodFlag = production ? '--prod' : '';
            const outputDir = await detectBuildOutputDir(cwd);
            // Use npx for safer execution, pass token via env (security)
            const command = `npx netlify deploy ${prodFlag} --dir=${outputDir}`;

            const { stdout, stderr } = await execAsync(command, {
                cwd,
                timeout: 300000,
                env: {
                    ...process.env,
                    NETLIFY_AUTH_TOKEN: this.netlifyToken, // Pass via env, not CLI (security)
                },
            });

            const output = stdout + (stderr || '');
            const urlMatch = output.match(/https:\/\/[^\s]+\.netlify\.app/);
            const url = urlMatch ? urlMatch[0] : undefined;

            this.log(`Deployed: ${url || 'Success'}`, 'success');
            return { success: true, url, output, command };
        } catch (error: unknown) {
            const execError = error as { message?: string };
            return {
                success: false,
                error: execError.message || 'Unknown deployment error',
                output: execError.message || '',
                command: 'npx netlify deploy',
            };
        }
    }

    /**
     * Deploy to Railway with token-based authentication
     */
    async deployToRailway(cwd: string): Promise<{ success: boolean; url?: string; error?: string; output?: string; command?: string }> {
        this.log('Deploying to Railway...');

        if (!this.railwayToken) {
            return {
                success: false,
                error: 'No Railway token configured. Run: agdi auth → Deployment (Vercel/Netlify/Railway)',
                command: 'npx railway up --detach',
            };
        }

        try {
            await execAsync('npx railway --version', { cwd });
        } catch (error) {
            this.log(`Railway CLI unavailable via npx: ${(error as Error)?.message || error}`, 'warn');
        }

        try {
            const command = `npx railway up --detach`;
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                timeout: 300000,
                env: {
                    ...process.env,
                    RAILWAY_TOKEN: this.railwayToken,
                },
            });

            const output = stdout + stderr;
            const urlMatch = output.match(/https:\/\/[^\s]+/);
            const url = urlMatch ? urlMatch[0] : undefined;

            this.log(`Deployed: ${url || 'Success'}`, 'success');
            return { success: true, url, output, command };
        } catch (error: unknown) {
            const execError = error as { message?: string };
            return {
                success: false,
                error: execError.message || 'Unknown deployment error',
                output: execError.message || '',
                command: 'npx railway up --detach',
            };
        }
    }

    /**
     * Execute devops task
     */
    async execute(task: SquadTask): Promise<AgentOutput> {
        this.log(`Executing: ${task.title}`);
        this.resetSources();

        const cwd = this.context?.workspaceRoot || process.cwd();
        const files: GeneratedFile[] = [];
        const commands: string[] = [];
        const commandOutputs: Array<{ command: string; output: string; success: boolean }> = [];
        const errors: string[] = [];

        // Determine platform from config
        const config = loadConfig();
        const platform = (config.deploymentProvider || 'vercel') as 'vercel' | 'netlify' | 'railway';
        const isProduction = task.title.toLowerCase().includes('production') ||
            task.title.toLowerCase().includes('deploy');

        try {
            // Generate config
            const configFiles = await this.generateConfig(platform);
            files.push(...configFiles);

            // Check if we can deploy
            if (!this.canDeploy(platform)) {
                return {
                    success: false,
                    content: `No ${platform} token configured. Run: agdi auth → Deployment`,
                    files,
                    errors: [`Missing ${platform} deployment token`],
                    sources: this.getSources(),
                };
            }

            // Deploy based on platform
            let deployResult: { success: boolean; url?: string; error?: string; output?: string; command?: string };

            if (platform === 'netlify') {
                deployResult = await this.deployToNetlify(cwd, isProduction);
            } else if (platform === 'railway') {
                deployResult = await this.deployToRailway(cwd);
            } else {
                deployResult = await this.deployToVercel(cwd, isProduction);
            }

            if (deployResult.command && deployResult.output !== undefined) {
                commandOutputs.push({
                    command: deployResult.command,
                    output: deployResult.output,
                    success: deployResult.success,
                });
            }

            if (deployResult.success) {
                commands.push(`Deployed to: ${deployResult.url || platform}`);

                return {
                    success: true,
                    content: `🚀 Deployment successful!\n\nURL: ${deployResult.url || 'See dashboard'}`,
                    files,
                    commands,
                    commandOutputs,
                    sources: this.getSources(),
                };
            } else {
                errors.push(deployResult.error || 'Deployment failed');

                return {
                    success: false,
                    content: `Deployment failed: ${deployResult.error}`,
                    files,
                    errors,
                    commandOutputs,
                    sources: this.getSources(),
                };
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`DevOps task failed: ${errorMsg}`, 'error');

            return {
                success: false,
                content: errorMsg,
                errors: [errorMsg],
                sources: this.getSources(),
            };
        }
    }
}

export default DevOpsAgent;
