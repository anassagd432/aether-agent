/**
 * Squad Orchestrator
 * 
 * Coordinates the multi-agent team (Agdi Squad).
 * Manages task assignment, parallel execution, and synchronization.
 */

import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import type { ILLMProvider } from '../../core/types/index.js';
import {
    SquadTask,
    SquadRole,
    AgentOutput,
    ProjectSpec,
    AgentContext,
    GeneratedFile
} from './base-agent.js';
import { ManagerAgent } from './manager-agent.js';
import { FrontendAgent } from './frontend-agent.js';
import { BackendAgent } from './backend-agent.js';
import { QAAgent } from './qa-agent.js';
import { DevOpsAgent } from './devops-agent.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import crypto from 'crypto';
import { loadConfig, getConfigDir } from '../../utils/config.js';
import { RepositoryIndexer } from '../../context/repository-indexer.js';

// ==================== TYPES ====================

export interface SquadConfig {
    workspaceRoot: string;
    verbose: boolean;
    maxRetries: number;
    parallel: boolean;
    autoDeploy: boolean;
}

export interface SquadResult {
    success: boolean;
    projectSpec: ProjectSpec;
    filesCreated: string[];
    filesModified: string[];
    deploymentUrl?: string;
    duration: number;
    tasksSummary: TaskSummary[];
    errors: string[];
}

export interface TaskSummary {
    id: string;
    title: string;
    assignee: SquadRole;
    status: 'completed' | 'failed' | 'skipped';
    duration: number;
}

// ==================== SQUAD ORCHESTRATOR ====================

export class SquadOrchestrator {
    private manager: ManagerAgent;
    private frontend: FrontendAgent;
    private backend: BackendAgent;
    private qa: QAAgent;
    private devops: DevOpsAgent;

    private config: SquadConfig;
    private context: AgentContext | null = null;
    private tasks: SquadTask[] = [];
    private completedTasks: Map<string, AgentOutput> = new Map();

    private runId: string = '';
    private runDir: string = '';
    private tracePath: string = '';
    private reportPath: string = '';
    private traceBuffer: Array<{ timestamp: string; event: string; data?: unknown }> = [];
    private sources: Set<string> = new Set();
    private sourcesPath: string = '';
    private snapshotManifestPath: string = '';
    private runConfigPath: string = '';

    constructor(llm: ILLMProvider, config: Partial<SquadConfig> = {}) {
        this.config = {
            workspaceRoot: process.cwd(),
            verbose: true,
            maxRetries: 3,
            parallel: true,
            autoDeploy: false,
            ...config,
        };

        const agentOptions = { verbose: this.config.verbose };

        // Initialize all agents
        this.manager = new ManagerAgent(llm, agentOptions);
        this.frontend = new FrontendAgent(llm, agentOptions);
        this.backend = new BackendAgent(llm, agentOptions);
        this.qa = new QAAgent(llm, agentOptions);
        this.devops = new DevOpsAgent(llm, agentOptions);
    }

    /**
     * Main entry point - run the full squad pipeline
     */
    async run(userPrompt: string): Promise<SquadResult> {
        const startTime = Date.now();
        const filesCreated: string[] = [];
        const filesModified: string[] = [];
        const tasksSummary: TaskSummary[] = [];
        const errors: string[] = [];

        await this.initializeRun(userPrompt);

        this.log('🚀 Agdi Squad Activated!', 'header');
        this.log(`Goal: "${userPrompt}"`, 'info');

        try {
            // ==================== PHASE 1: PLANNING ====================
            this.log('📋 Phase 1: Planning', 'phase');

            const memoryContext = await this.retrieveRepositoryContext(userPrompt);
            const userPromptWithMemory = memoryContext ? `${userPrompt}\n\n${memoryContext}` : userPrompt;

            const projectSpec = await this.manager.analyzeRequest(userPromptWithMemory);
            this.tasks = this.manager.generateTasks(projectSpec);

            // Create shared context
            this.context = {
                projectSpec,
                workspaceRoot: this.config.workspaceRoot,
                tasks: this.tasks,
                sharedMemory: new Map([['repo_context', memoryContext]]),
            };

            // Share context with all agents
            this.manager.setContext(this.context);
            this.frontend.setContext(this.context);
            this.backend.setContext(this.context);
            this.qa.setContext(this.context);
            this.devops.setContext(this.context);

            this.log(`Created ${this.tasks.length} tasks`, 'success');

            // ==================== PHASE 2 & 3: EXECUTION & AUTO-REPAIR LOOP ====================
            this.log('⚡ Phase 2: Execution & Auto-Repair', 'phase');

            let attempts = 0;
            let healthy = false;

            while (attempts < this.config.maxRetries && !healthy) {
                attempts++;
                this.log(`\n🔄 Cycle ${attempts}/${this.config.maxRetries}`, 'phase');

                // 1. Execute Pending Tasks
                await this.executeTasks(filesCreated, filesModified, tasksSummary, errors);

                // 2. Validation (QA)
                this.log('🕵️  QA Check', 'task');

                // Find or create QA task
                let qaTask = this.tasks.find(t => t.assignee === 'qa' && !this.completedTasks.has(t.id));
                if (!qaTask) {
                    // Create ad-hoc QA task for this cycle
                    qaTask = {
                        id: `qa-${attempts}`,
                        title: `Quality Assurance Cycle ${attempts}`,
                        description: 'Review codebase for errors, missing features, and type safety.',
                        assignee: 'qa',
                        dependencies: [],
                        priority: 'high',
                        state: 'pending',
                        createdAt: Date.now(),
                        retryCount: 0
                    };
                }

                const qaResult = await this.executeTask(qaTask);

                // Track results
                tasksSummary.push({
                    id: qaTask.id,
                    title: qaTask.title,
                    assignee: qaTask.assignee,
                    status: qaResult.success ? 'completed' : 'failed',
                    duration: 0, // Placeholder
                });

                if (qaResult.files) {
                    await this.writeFiles(qaResult.files, filesCreated, filesModified);
                }

                // 3. Analyze QA Results
                if (qaResult.success) {
                    this.log('✨ QA Passed - Codebase is healthy', 'success');
                    healthy = true;
                } else {
                    this.log(`⚠️  QA Found Issues: ${qaResult.errors?.length || 0} errors`, 'warn');
                    if (qaResult.errors) {
                        qaResult.errors.forEach(e => this.log(`  - ${e}`, 'error'));
                    }

                    // If we have retries left, generate fix tasks
                    if (attempts < this.config.maxRetries) {
                        this.log('🛠️  Generating Fix Plan...', 'info');

                        // Ask Manager to plan fixes based on QA output
                        const fixPrompt = `QA found these issues:\n${qaResult.errors?.join('\n')}\n\nCreate specific tasks to fix these errors.`;

                        // We need to implement a 'planFixes' method on Manager or just use execute with a special prompt
                        // For now, we'll crudely assign fix tasks based on error context (simplified)
                        // In a real implementation, we'd ask the Manager Agent to create new tasks.

                        // Simplified Fix Strategy: Create a generic "Fix" task for the most relevant agent
                        const fixTask: SquadTask = {
                            id: `fix-${attempts}`,
                            title: `Fix Issues from Cycle ${attempts}`,
                            description: `Fix the following errors:\n${qaResult.errors?.join('\n')}`,
                            assignee: 'frontend', // Defaulting to frontend for now, ideal would be to detect
                            dependencies: [],
                            priority: 'critical',
                            state: 'pending',
                            createdAt: Date.now(),
                            retryCount: 0
                        };

                        this.tasks.push(fixTask);
                        this.log(`  + Added repair task: ${fixTask.title}`, 'info');
                    }
                }
            }

            if (!healthy) {
                this.log('⚠️  Max retries reached. Proceeding with best-effort.', 'warn');
            } else {
                this.log('✅ Codebase is stable.', 'success');
            }

            // ==================== PHASE 4: DEPLOYMENT (Optional) ====================
            let deploymentUrl: string | undefined;

            if (healthy && this.config.autoDeploy) {
                this.log('🚀 Phase 4: Deployment', 'phase');

                const devopsTask = this.tasks.find(t => t.assignee === 'devops');
                if (devopsTask) {
                    const deployResult = await this.executeTask(devopsTask);

                    if (deployResult.success) {
                        // Extract URL from content
                        const urlMatch = deployResult.content.match(/https:\/\/[^\s]+/);
                        deploymentUrl = urlMatch ? urlMatch[0] : undefined;
                    }

                    tasksSummary.push({
                        id: devopsTask.id,
                        title: devopsTask.title,
                        assignee: devopsTask.assignee,
                        status: deployResult.success ? 'completed' : 'failed',
                        duration: Date.now() - startTime,
                    });
                }
            }

            // ==================== SUMMARY ====================
            const duration = Date.now() - startTime;
            this.log('🎉 Squad Mission Complete!', 'header');
            this.log(`Duration: ${(duration / 1000).toFixed(1)}s`, 'info');
            this.log(`Files created: ${filesCreated.length}`, 'info');
            if (deploymentUrl) {
                this.log(`Live URL: ${deploymentUrl}`, 'success');
            }

            const result: SquadResult = {
                success: errors.length === 0,
                projectSpec,
                filesCreated,
                filesModified,
                deploymentUrl,
                duration,
                tasksSummary,
                errors,
            };

            await this.finalizeRun(result);

            return result;

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`Mission failed: ${errorMsg}`, 'error');
            errors.push(errorMsg);

            const result: SquadResult = {
                success: false,
                projectSpec: { name: 'error', description: '', type: 'web-app', stack: {}, features: [] },
                filesCreated,
                filesModified,
                duration: Date.now() - startTime,
                tasksSummary,
                errors,
            };

            await this.finalizeRun(result);

            return result;
        }
    }

    /**
     * Execute tasks respecting dependencies
     */
    private async executeTasks(
        filesCreated: string[],
        filesModified: string[],
        tasksSummary: TaskSummary[],
        errors: string[]
    ): Promise<void> {
        // Get non-QA, non-DevOps tasks (those are handled separately)
        const coreTasks = this.tasks.filter(t =>
            t.assignee !== 'qa' && t.assignee !== 'devops'
        );

        const pending = new Map<string, SquadTask>();
        // Only add tasks that haven't been completed yet
        coreTasks.forEach(task => {
            if (!this.completedTasks.has(task.id)) {
                pending.set(task.id, task);
            }
        });

        if (pending.size === 0) {
            this.log('No new tasks to execute.', 'info');
            return;
        }

        const runTask = async (task: SquadTask): Promise<void> => {
            const taskStart = Date.now();
            const result = await this.executeTask(task);

            if (result.files) {
                await this.writeFiles(result.files, filesCreated, filesModified);
            }

            this.completedTasks.set(task.id, result);

            tasksSummary.push({
                id: task.id,
                title: task.title,
                assignee: task.assignee,
                status: result.success ? 'completed' : 'failed',
                duration: Date.now() - taskStart,
            });

            if (!result.success && result.errors) {
                errors.push(...result.errors);
            }

            pending.delete(task.id);
        };

        while (pending.size > 0) {
            const readyTasks = Array.from(pending.values()).filter(task =>
                task.dependencies.every(depId => this.completedTasks.has(depId))
            );

            if (readyTasks.length === 0) {
                this.log('No executable tasks found (possible circular dependencies).', 'error');
                break;
            }

            if (this.config.parallel) {
                await Promise.all(readyTasks.map(task => runTask(task)));
            } else {
                await runTask(readyTasks[0]);
            }
        }
    }

    /**
     * Execute a single task with the appropriate agent
     */
    private async executeTask(task: SquadTask): Promise<AgentOutput> {
        this.log(`[${task.assignee}] ${task.title}`, 'task');

        // Emit handoff event
        const { emitAgentEvent } = await import('../../core/event-bus.js');
        emitAgentEvent({
            type: 'handoff',
            agentName: task.assignee, // e.g. "frontend"
            role: task.assignee,
            message: `Taking control for task: ${task.title}`
        });

        await this.appendTrace('task_start', {
            id: task.id,
            title: task.title,
            assignee: task.assignee,
            dependencies: task.dependencies,
            input: task.input,
        });

        let result: AgentOutput;
        switch (task.assignee) {
            case 'manager':
                result = await this.manager.execute(task);
                break;
            case 'frontend':
                result = await this.frontend.execute(task);
                break;
            case 'backend':
                result = await this.backend.execute(task);
                break;
            case 'qa':
                result = await this.qa.execute(task);
                break;
            case 'devops':
                result = await this.devops.execute(task);
                break;
            default:
                result = { success: false, content: 'Unknown agent role', errors: ['Unknown agent'] };
        }

        this.collectSourcesFromText(result.content);
        if (result.sources) {
            result.sources.forEach(src => this.collectSourcesFromText(src));
        }
        if (result.files) {
            result.files.forEach(file => this.collectSourcesFromText(file.content));
        }

        await this.appendTrace('task_end', {
            id: task.id,
            title: task.title,
            assignee: task.assignee,
            success: result.success,
            errors: result.errors,
            files: result.files?.map(f => f.path),
            commandOutputs: result.commandOutputs,
        });

        return result;
    }

    /**
     * Write generated files to disk
     * SECURITY: All paths are validated to prevent directory traversal attacks
     */
    private async writeFiles(
        files: GeneratedFile[],
        filesCreated: string[],
        filesModified: string[]
    ): Promise<void> {
        const workspaceRoot = path.resolve(this.config.workspaceRoot);

        for (const file of files) {
            // SECURITY: Validate path to prevent directory traversal
            const validationResult = this.validateFilePath(file.path, workspaceRoot);
            if (!validationResult.valid) {
                this.log(`🛡️ Blocked unsafe path: ${file.path} - ${validationResult.error}`, 'error');
                await this.appendTrace('file_blocked', {
                    path: file.path,
                    reason: validationResult.error,
                });
                continue; // Skip this file
            }

            const fullPath = validationResult.resolvedPath!;
            const dir = path.dirname(fullPath);

            try {
                // Ensure directory exists
                await fs.mkdir(dir, { recursive: true });

                // Check if file exists
                let existed = false;
                let beforeContent: string | null = null;
                try {
                    await fs.access(fullPath);
                    existed = true;
                    beforeContent = await fs.readFile(fullPath, 'utf-8');
                } catch {
                    existed = false;
                }

                // Write file
                await fs.writeFile(fullPath, file.content, 'utf-8');

                const afterContent = file.content;

                // Store output copy for exact replay (also validated)
                const outputPath = path.join(this.runDir, 'outputs', validationResult.normalizedPath!);
                await fs.mkdir(path.dirname(outputPath), { recursive: true });
                await fs.writeFile(outputPath, file.content, 'utf-8');
                const beforeHash = beforeContent ? this.hashContent(beforeContent) : null;
                const afterHash = this.hashContent(afterContent);

                await this.appendTrace('file_write', {
                    path: file.path,
                    existed,
                    beforeHash,
                    afterHash,
                    beforeLines: beforeContent ? beforeContent.split('\n').length : 0,
                    afterLines: afterContent.split('\n').length,
                    beforeBytes: beforeContent ? Buffer.byteLength(beforeContent, 'utf-8') : 0,
                    afterBytes: Buffer.byteLength(afterContent, 'utf-8'),
                });

                if (existed) {
                    filesModified.push(file.path);
                    this.log(`📝 Modified: ${file.path}`, 'info');
                } else {
                    filesCreated.push(file.path);
                    this.log(`✨ Created: ${file.path}`, 'success');
                }
            } catch (error) {
                this.log(`Failed to write ${file.path}: ${error}`, 'error');
            }
        }
    }

    /**
     * Validate a file path to prevent directory traversal attacks
     * SECURITY: Critical function - blocks paths that escape workspace root
     */
    private validateFilePath(filePath: string, workspaceRoot: string): {
        valid: boolean;
        error?: string;
        resolvedPath?: string;
        normalizedPath?: string;
    } {
        // Block absolute paths
        if (path.isAbsolute(filePath)) {
            return {
                valid: false,
                error: 'Absolute paths not allowed',
            };
        }

        // Normalize and resolve the path
        const normalizedPath = path.normalize(filePath).replace(/^(\.\.[\\/])+/, '');
        const resolvedPath = path.resolve(workspaceRoot, filePath);

        // Check for path traversal attempts
        if (filePath.includes('..')) {
            // After resolution, verify we're still within workspace
            if (!resolvedPath.startsWith(workspaceRoot + path.sep) && resolvedPath !== workspaceRoot) {
                return {
                    valid: false,
                    error: 'Path traversal blocked: cannot escape workspace root',
                };
            }
        }

        // Double-check: final resolved path must be within workspace
        if (!resolvedPath.startsWith(workspaceRoot)) {
            return {
                valid: false,
                error: 'Path traversal blocked: resolved path outside workspace',
            };
        }

        // Block writes to sensitive directories
        const sensitivePatterns = [
            /^\.git\//,
            /^node_modules\//,
            /^\.env$/,
            /^\.env\./,
            /\/\.git\//,
        ];

        for (const pattern of sensitivePatterns) {
            if (pattern.test(normalizedPath)) {
                return {
                    valid: false,
                    error: `Blocked write to sensitive path: ${normalizedPath}`,
                };
            }
        }

        return {
            valid: true,
            resolvedPath,
            normalizedPath,
        };
    }


    private async retrieveRepositoryContext(userPrompt: string): Promise<string> {
        try {
            const cfg = loadConfig();
            const enabled =
                cfg.semanticSearchEnabled === true ||
                process.env.AGDI_SEMANTIC_SEARCH === 'true' ||
                process.env.AGDI_SEMANTIC_SEARCH === '1';

            if (!enabled) return '';

            const dbPath = path.join(getConfigDir(), 'semantic.sqlite');
            const indexer = new RepositoryIndexer(dbPath);

            // Index if stale (no vectors yet)
            const stale = await indexer.isStale();
            if (stale) {
                this.log('🧠 Building semantic memory index (first run)...', 'info');
                await indexer.indexRepository(this.config.workspaceRoot);
                this.log('🧠 Semantic memory index ready.', 'success');
            }

            // Hydrate a minimal parsedFiles map for dependency/recent-file strategies
            // Even if we already have vectors, we still parse a light set of files for symbols.
            // (Full incremental persistence is a future improvement.)
            if (indexer.getParsedFiles().size === 0) {
                await indexer.indexRepository(this.config.workspaceRoot);
            }

            const retriever = indexer.createContextRetriever();
            const context = await retriever.getRelevantContext(userPrompt, undefined, 2500);
            return retriever.formatContext(context);
        } catch (err) {
            // Never fail the run because of memory
            return '';
        }
    }


    private async initializeRun(userPrompt: string): Promise<void> {
        this.runId = uuidv4();
        this.runDir = path.join(this.config.workspaceRoot, 'runs', this.runId);
        this.tracePath = path.join(this.runDir, 'trace.jsonl');
        this.reportPath = path.join(this.runDir, 'report.md');
        this.sourcesPath = path.join(this.runDir, 'sources.json');
        this.snapshotManifestPath = path.join(this.runDir, 'snapshot', 'manifest.json');
        this.runConfigPath = path.join(this.runDir, 'run.json');
        const outputsDir = path.join(this.runDir, 'outputs');

        await fs.mkdir(this.runDir, { recursive: true });
        await fs.mkdir(path.join(this.runDir, 'snapshot'), { recursive: true });
        await fs.mkdir(outputsDir, { recursive: true });

        await fs.writeFile(this.runConfigPath, JSON.stringify({
            runId: this.runId,
            prompt: userPrompt,
            config: {
                workspaceRoot: this.config.workspaceRoot,
                autoDeploy: this.config.autoDeploy,
                parallel: this.config.parallel,
                maxRetries: this.config.maxRetries,
                verbose: this.config.verbose,
            },
        }, null, 2), 'utf-8');

        this.collectSourcesFromText(userPrompt);

        await this.appendTrace('run_start', {
            runId: this.runId,
            prompt: userPrompt,
            config: {
                workspaceRoot: this.config.workspaceRoot,
                autoDeploy: this.config.autoDeploy,
                parallel: this.config.parallel,
                maxRetries: this.config.maxRetries,
                verbose: this.config.verbose,
            },
        });

        await this.createSnapshot();
    }

    private async finalizeRun(result: SquadResult): Promise<void> {
        await this.appendTrace('run_end', {
            runId: this.runId,
            success: result.success,
            durationMs: result.duration,
            filesCreated: result.filesCreated.length,
            filesModified: result.filesModified.length,
            errors: result.errors,
            deploymentUrl: result.deploymentUrl,
        });

        await fs.writeFile(this.sourcesPath, JSON.stringify(Array.from(this.sources).sort(), null, 2), 'utf-8');

        const diffSummary = await this.generateDiffReport();

        const reportLines = [
            `# Agdi Squad Run Report`,
            ``,
            `Run ID: ${this.runId}`,
            `Status: ${result.success ? 'Success' : 'Completed with issues'}`,
            `Duration: ${(result.duration / 1000).toFixed(1)}s`,
            ``,
            `## Files`,
            `- Created: ${result.filesCreated.length}`,
            `- Modified: ${result.filesModified.length}`,
            ``,
            `## Diff`,
            `- Created: ${diffSummary.created.length}`,
            `- Modified: ${diffSummary.modified.length}`,
            `- Deleted: ${diffSummary.deleted.length}`,
            ``,
            `## Sources`,
            `- ${Array.from(this.sources).length} URLs captured`,
            ``,
            result.deploymentUrl ? `Deployment: ${result.deploymentUrl}` : undefined,
            ``,
            result.errors.length ? `## Errors` : undefined,
            ...(result.errors.length ? result.errors.map(e => `- ${e}`) : []),
        ].filter(Boolean).join('\n');

        await fs.writeFile(this.reportPath, reportLines, 'utf-8');
    }

    private async appendTrace(event: string, data?: unknown): Promise<void> {
        const entry = { timestamp: new Date().toISOString(), event, data };
        this.traceBuffer.push(entry);
        if (!this.tracePath) return;
        await fs.appendFile(this.tracePath, JSON.stringify(entry) + '\n', 'utf-8');
    }

    private hashContent(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    private collectSourcesFromText(text?: string): void {
        if (!text) return;
        const urls = text.match(/https?:\/\/[^\s)\]"'<>]+/g) || [];
        urls.forEach(url => this.sources.add(url));
    }

    private async createSnapshot(): Promise<void> {
        const snapshotRoot = this.config.workspaceRoot;
        const ignore = new Set(['node_modules', '.git', 'runs', 'dist', 'build', '.next']);
        const manifest: Array<{ path: string; size: number; hash: string }> = [];

        const walk = async (dir: string): Promise<void> => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (ignore.has(entry.name)) continue;
                const fullPath = path.join(dir, entry.name);
                const relPath = path.relative(snapshotRoot, fullPath);

                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else if (entry.isFile()) {
                    const buffer = await fs.readFile(fullPath);
                    const content = buffer.toString('utf-8');
                    manifest.push({
                        path: relPath,
                        size: buffer.length,
                        hash: this.hashContent(content),
                    });
                }
            }
        };

        await walk(snapshotRoot);
        await fs.writeFile(this.snapshotManifestPath, JSON.stringify({
            generatedAt: new Date().toISOString(),
            root: snapshotRoot,
            files: manifest,
        }, null, 2), 'utf-8');

        await this.appendTrace('snapshot', {
            files: manifest.length,
            manifestPath: path.relative(this.config.workspaceRoot, this.snapshotManifestPath),
        });
    }

    private async generateDiffReport(): Promise<{ created: string[]; modified: string[]; deleted: string[] }> {
        const snapshotRoot = this.config.workspaceRoot;
        const ignore = new Set(['node_modules', '.git', 'runs', 'dist', 'build', '.next']);
        const diffPath = path.join(this.runDir, 'diff.json');

        let snapshotData: { files: Array<{ path: string; hash: string }> } = { files: [] };
        try {
            const raw = await fs.readFile(this.snapshotManifestPath, 'utf-8');
            snapshotData = JSON.parse(raw) as { files: Array<{ path: string; hash: string }> };
        } catch {
            // no snapshot manifest yet
        }

        const snapshotMap = new Map(snapshotData.files.map(file => [file.path, file.hash]));
        const currentMap = new Map<string, string>();

        const walk = async (dir: string): Promise<void> => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (ignore.has(entry.name)) continue;
                const fullPath = path.join(dir, entry.name);
                const relPath = path.relative(snapshotRoot, fullPath);

                if (entry.isDirectory()) {
                    await walk(fullPath);
                } else if (entry.isFile()) {
                    const buffer = await fs.readFile(fullPath);
                    const content = buffer.toString('utf-8');
                    currentMap.set(relPath, this.hashContent(content));
                }
            }
        };

        await walk(snapshotRoot);

        const created: string[] = [];
        const modified: string[] = [];
        const deleted: string[] = [];

        currentMap.forEach((hash, filePath) => {
            if (!snapshotMap.has(filePath)) {
                created.push(filePath);
            } else if (snapshotMap.get(filePath) !== hash) {
                modified.push(filePath);
            }
        });

        snapshotMap.forEach((_hash, filePath) => {
            if (!currentMap.has(filePath)) {
                deleted.push(filePath);
            }
        });

        const diffPayload = {
            created,
            modified,
            deleted,
        };

        await fs.writeFile(diffPath, JSON.stringify(diffPayload, null, 2), 'utf-8');
        await this.appendTrace('diff', {
            created: created.length,
            modified: modified.length,
            deleted: deleted.length,
            diffPath: path.relative(this.config.workspaceRoot, diffPath),
        });

        return diffPayload;
    }

    /**
     * Styled console logging
     */
    private log(message: string, type: 'header' | 'phase' | 'task' | 'info' | 'success' | 'warn' | 'error' = 'info'): void {
        if (!this.config.verbose) return;

        switch (type) {
            case 'header':
                console.log(chalk.cyan.bold(`\n${'═'.repeat(50)}`));
                console.log(chalk.cyan.bold(message));
                console.log(chalk.cyan.bold(`${'═'.repeat(50)}\n`));
                break;
            case 'phase':
                console.log(chalk.magenta.bold(`\n▶ ${message}\n`));
                break;
            case 'task':
                console.log(chalk.yellow(`  → ${message}`));
                break;
            case 'success':
                console.log(chalk.green(`  ✓ ${message}`));
                break;
            case 'warn':
                console.log(chalk.yellow(`  ⚠ ${message}`));
                break;
            case 'error':
                console.log(chalk.red(`  ✗ ${message}`));
                break;
            default:
                console.log(chalk.gray(`  ${message}`));
        }
    }
}

export default SquadOrchestrator;
