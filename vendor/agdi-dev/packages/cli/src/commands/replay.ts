/**
 * Replay Command - Re-run a past squad execution
 */

import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SquadOrchestrator, SquadConfig, SquadResult } from '../agents/core/squad-orchestrator.js';
import type { ILLMProvider } from '../core/types/index.js';

export interface ReplayCommandOptions {
    verbose?: boolean;
    deploy?: boolean;
    workspace?: string;
    exact?: boolean;
}

export async function runReplayCommand(
    runId: string,
    llm: ILLMProvider | null,
    options: ReplayCommandOptions = {}
): Promise<SquadResult | null> {
    const workspaceRoot = options.workspace || process.cwd();
    const runConfigPath = path.join(workspaceRoot, 'runs', runId, 'run.json');
    const outputsDir = path.join(workspaceRoot, 'runs', runId, 'outputs');

    try {
        const raw = await fs.readFile(runConfigPath, 'utf-8');
        const runConfig = JSON.parse(raw) as { prompt: string; config?: Partial<SquadConfig> };

        if (!runConfig.prompt) {
            console.log(chalk.red('❌ Invalid run.json (missing prompt)'));
            return null;
        }

        const config: Partial<SquadConfig> = {
            ...runConfig.config,
            workspaceRoot: runConfig.config?.workspaceRoot || workspaceRoot,
            verbose: options.verbose ?? runConfig.config?.verbose ?? true,
            autoDeploy: options.deploy ?? runConfig.config?.autoDeploy ?? false,
        };

        console.log(chalk.cyan(`\n🔁 Replaying run ${runId}`));

        if (options.exact !== false) {
            try {
                const entries = await fs.readdir(outputsDir, { withFileTypes: true });
                if (entries.length === 0) {
                    throw new Error('No outputs found');
                }

                const copyOutputs = async (dir: string, rel: string = ''): Promise<void> => {
                    const files = await fs.readdir(dir, { withFileTypes: true });
                    for (const file of files) {
                        const sourcePath = path.join(dir, file.name);
                        const targetRel = path.join(rel, file.name);
                        const targetPath = path.join(workspaceRoot, targetRel);

                        if (file.isDirectory()) {
                            await copyOutputs(sourcePath, targetRel);
                        } else if (file.isFile()) {
                            await fs.mkdir(path.dirname(targetPath), { recursive: true });
                            const content = await fs.readFile(sourcePath, 'utf-8');
                            await fs.writeFile(targetPath, content, 'utf-8');
                        }
                    }
                };

                await copyOutputs(outputsDir);
                console.log(chalk.green('✅ Exact replay applied from stored outputs.'));

                return {
                    success: true,
                    projectSpec: { name: 'replay', description: 'Exact replay', type: 'web-app', stack: {}, features: [] },
                    filesCreated: [],
                    filesModified: [],
                    duration: 0,
                    tasksSummary: [],
                    errors: [],
                } as SquadResult;
            } catch (error) {
                console.log(chalk.yellow('⚠️ Exact replay failed, falling back to rerun.'));
                console.log(chalk.gray(String(error)));
            }
        }

        if (!llm) {
            console.log(chalk.red('❌ No LLM provider available for replay.'));
            return null;
        }

        const orchestrator = new SquadOrchestrator(llm, config);
        return await orchestrator.run(runConfig.prompt);
    } catch (error) {
        console.log(chalk.red('❌ Failed to load run config for replay'));
        console.log(chalk.gray(String(error)));
        return null;
    }
}

export default runReplayCommand;
