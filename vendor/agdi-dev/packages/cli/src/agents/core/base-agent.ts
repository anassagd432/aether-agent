/**
 * Base Agent Class
 * 
 * Abstract foundation for all specialized agents in the Agdi Squad.
 * Each agent has a role, system prompt, available tools, and execution logic.
 */

import type { ILLMProvider } from '../../core/types/index.js';
import chalk from 'chalk';

// ==================== AGENT TYPES ====================

export type SquadRole =
    | 'manager'      // Project Manager - Plans and delegates
    | 'frontend'     // Frontend Developer - UI/UX
    | 'backend'      // Backend Developer - API/DB
    | 'qa'           // QA Engineer - Testing
    | 'devops';      // DevOps - Deployment

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskState = 'pending' | 'in-progress' | 'blocked' | 'completed' | 'failed';

export interface SquadTask {
    id: string;
    title: string;
    description: string;
    assignee: SquadRole;
    priority: TaskPriority;
    state: TaskState;
    dependencies: string[];
    input?: Record<string, unknown>;
    output?: AgentOutput;
    createdAt: number;
    completedAt?: number;
    retryCount: number;
}

export interface AgentOutput {
    success: boolean;
    content: string;
    files?: GeneratedFile[];
    commands?: string[];
    commandOutputs?: Array<{ command: string; output: string; success: boolean }>;
    errors?: string[];
    nextSteps?: string[];
    sources?: string[];
}

export interface GeneratedFile {
    path: string;
    content: string;
    action: 'create' | 'modify' | 'delete';
}

export interface AgentContext {
    projectSpec: ProjectSpec;
    workspaceRoot: string;
    tasks: SquadTask[];
    sharedMemory: Map<string, unknown>;
}

export interface ProjectSpec {
    name: string;
    description: string;
    type: 'web-app' | 'api' | 'fullstack' | 'library';
    stack: {
        frontend?: string[];
        backend?: string[];
        database?: string;
    };
    features: string[];
    pages?: PageSpec[];
    apiEndpoints?: APIEndpointSpec[];
}

export interface PageSpec {
    route: string;
    name: string;
    components: string[];
    description: string;
}

export interface APIEndpointSpec {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    description: string;
    requestBody?: string;
    responseBody?: string;
}

import { emitAgentEvent } from '../../core/event-bus.js';

// ==================== BASE AGENT CLASS ====================

export abstract class BaseAgent {
    readonly role: SquadRole;
    readonly name: string;
    protected llm: ILLMProvider;
    protected context: AgentContext | null = null;
    protected verbose: boolean;
    protected sources: Set<string> = new Set();

    constructor(
        role: SquadRole,
        name: string,
        llm: ILLMProvider,
        options: { verbose?: boolean } = {}
    ) {
        this.role = role;
        this.name = name;
        this.llm = llm;
        this.verbose = options.verbose ?? true;
    }

    /**
     * Get the system prompt for this agent
     */
    abstract getSystemPrompt(): string;

    /**
     * Execute a task assigned to this agent
     */
    abstract execute(task: SquadTask): Promise<AgentOutput>;

    /**
     * Set the shared context
     */
    setContext(context: AgentContext): void {
        this.context = context;
    }

    /**
     * Log a message (if verbose)
     */
    protected log(message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info'): void {
        // Emit live event for TUI
        emitAgentEvent({
            type: 'log',
            agentName: this.name,
            role: this.role,
            message: message,
            metadata: { type }
        });

        if (!this.verbose) return;

        const prefix = `[${this.name}]`;
        switch (type) {
            case 'success':
                console.log(chalk.green(`${prefix} ✓ ${message}`));
                break;
            case 'warn':
                console.log(chalk.yellow(`${prefix} ⚠ ${message}`));
                break;
            case 'error':
                console.log(chalk.red(`${prefix} ✗ ${message}`));
                break;
            default:
                console.log(chalk.cyan(`${prefix} ${message}`));
        }
    }

    /**
     * Generate a response from the LLM
     * Includes timeout protection to prevent indefinite hanging
     */
    protected async think(prompt: string, timeoutMs: number = 120000): Promise<string> {
        this.log('Thinking...', 'info');

        // Emit specific "Thinking" event
        emitAgentEvent({
            type: 'thought',
            agentName: this.name,
            role: this.role,
            message: `Analyzing task...`,
        });

        // Inject repository context if available (and not already in prompt)
        let fullPrompt = prompt;
        if (this.context?.sharedMemory.has('repo_context')) {
            const context = this.context.sharedMemory.get('repo_context') as string;
            // Simple check to avoid duplication if the caller already added it (like Manager)
            if (context && !prompt.includes('# Repository Context')) {
                fullPrompt += `\n\n${context}`;
            }
        }

        // Wrap LLM call with timeout to prevent indefinite hanging
        const response = await Promise.race([
            this.llm.generate(fullPrompt, this.getSystemPrompt()),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`LLM request timed out after ${timeoutMs / 1000}s`)), timeoutMs)
            )
        ]);

        // Emit the "Aha!" moment (first 100 chars of response)
        const summary = response.text.split('\n')[0].substring(0, 80) + '...';
        emitAgentEvent({
            type: 'thought',
            agentName: this.name,
            role: this.role,
            message: `Generated response: ${summary}`,
        });

        this.collectSourcesFromText(response.text);
        return response.text;
    }

    protected resetSources(): void {
        this.sources.clear();
    }

    protected getSources(): string[] {
        return Array.from(this.sources);
    }

    protected collectSourcesFromText(text?: string): void {
        if (!text) return;

        const urls = text.match(/https?:\/\/[^\s)\]"'<>]+/g) || [];
        urls.forEach(url => this.sources.add(url));

        const sourcesMatch = text.match(/Sources:\s*([\s\S]*)/i);
        if (sourcesMatch) {
            const lines = sourcesMatch[1].split('\n');
            for (const line of lines) {
                if (!line.trim()) break;
                const lineUrls = line.match(/https?:\/\/[^\s)\]"'<>]+/g) || [];
                lineUrls.forEach(url => this.sources.add(url));
            }
        }
    }

    /**
     * Extract code blocks from LLM response
     */
    protected extractCodeBlocks(response: string): GeneratedFile[] {
        const files: GeneratedFile[] = [];

        // Match code blocks with filepath comments
        const codeBlockRegex = /```(?:typescript|tsx|javascript|jsx|json|css|html|prisma|sql)?\n\/\/ filepath: (.+)\n([\s\S]*?)```/g;

        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            files.push({
                path: match[1].trim(),
                content: match[2].trim(),
                action: 'create',
            });
        }

        return files;
    }

    /**
     * Parse a structured JSON response from LLM
     */
    protected parseJSON<T>(response: string, fallback: T): T {
        try {
            // Try to extract JSON from code block
            const jsonMatch = response.match(/```json\n([\s\S]*?)```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            // Try raw JSON
            return JSON.parse(response);
        } catch (error) {
            this.log(`Failed to parse JSON response: ${(error as Error)?.message || error}`, 'warn');
            return fallback;
        }
    }
}

export default BaseAgent;
