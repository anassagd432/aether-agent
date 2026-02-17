/**
 * Decision Loop
 * 
 * The core think → decide → act → observe → reflect cycle.
 * This is the main execution engine of the autonomous agent.
 */

import type {
    LoopState,
    LoopPhase,
    Decision,
    ActionType,
    ThoughtResult,
    Reflection,
    Observation,
    Task,
    Plan,
    ToolCall,
    ToolResult,
    AgentConfig,
    AgentResult,
    ErrorContext,
} from './types';
import { DEFAULT_AGENT_CONFIG } from './types';
import { PlanningEngine } from './planning-engine';
import { ToolExecutor } from './tool-executor';
import { MemoryManager } from './memory-manager';
import { SelfHealer } from './self-healer';
import { TerminationEngine } from './termination-logic';

// ==================== DECISION LOOP CLASS ====================

export class DecisionLoop {
    private config: AgentConfig;
    private planningEngine: PlanningEngine;
    private toolExecutor: ToolExecutor;
    private memory: MemoryManager;
    private selfHealer: SelfHealer;
    private terminationEngine: TerminationEngine;
    private llmCall?: (prompt: string, systemPrompt?: string) => Promise<string>;
    private state: LoopState | null = null;
    private isRunning = false;
    private shouldStop = false;

    constructor(
        config: Partial<AgentConfig> = {},
        llmCall?: (prompt: string, systemPrompt?: string) => Promise<string>
    ) {
        this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
        this.llmCall = llmCall;

        // Initialize components
        this.memory = new MemoryManager(this.config.persistMemory);
        this.planningEngine = new PlanningEngine(this.config, this.memory);
        this.toolExecutor = new ToolExecutor(this.config);
        this.selfHealer = new SelfHealer(this.config, this.toolExecutor, this.memory);
        this.terminationEngine = new TerminationEngine(this.config);
    }

    /**
     * Run the decision loop for a goal
     */
    async run(goal: string): Promise<AgentResult> {
        this.isRunning = true;
        this.shouldStop = false;

        // Generate initial plan
        const plan = await this.planningEngine.generatePlan(
            goal,
            this.memory.getCurrentContext(),
            this.llmCall
        );

        // Initialize state
        this.state = {
            phase: 'think',
            currentPlan: plan,
            currentTask: this.planningEngine.getNextExecutableTask(plan),
            observations: [],
            reflections: [],
            iterationCount: 0,
            maxIterations: this.config.maxIterations,
            startTime: Date.now(),
        };

        this.log('Starting decision loop', { goal, tasks: plan.tasks.length });

        // Main loop
        while (this.isRunning && !this.shouldStop) {
            // Check termination
            const termDecision = this.terminationEngine.checkTermination(this.state);
            if (termDecision.shouldTerminate) {
                this.log('Termination triggered', { reason: termDecision.reason });
                const execLog = this.toolExecutor.getExecutionLog();
                const report = await this.terminationEngine.generateReport(
                    this.state,
                    termDecision.reason!,
                    execLog
                );
                this.isRunning = false;
                return {
                    success: termDecision.reason === 'goal_achieved',
                    report,
                    artifacts: report.filesCreated,
                };
            }

            // Execute one iteration of the loop
            await this.runIteration();
            this.state.iterationCount++;
        }

        // Stopped externally
        const execLog = this.toolExecutor.getExecutionLog();
        const report = await this.terminationEngine.generateReport(
            this.state,
            'user_interrupt',
            execLog
        );

        return {
            success: false,
            report,
            artifacts: report.filesCreated,
        };
    }

    /**
     * Run one iteration of the decision loop
     */
    private async runIteration(): Promise<void> {
        if (!this.state) return;

        // THINK
        this.state.phase = 'think';
        const thought = await this.think();

        // DECIDE
        this.state.phase = 'decide';
        const decision = await this.decide(thought);

        // ACT
        this.state.phase = 'act';
        // Ensure we always have a tool call when executing
        if (decision.action === 'execute' && !decision.toolCall && this.state.currentTask) {
            decision.toolCall = this.taskToToolCall(this.state.currentTask);
        }
        const actionResult = await this.act(decision);

        // OBSERVE
        this.state.phase = 'observe';
        const observation = await this.observe(actionResult, decision);
        this.state.observations.push(observation);

        // REFLECT
        this.state.phase = 'reflect';
        const reflection = await this.reflect(observation);
        this.state.reflections.push(reflection);

        // Update memory
        this.memory.addObservation(observation);
    }

    /**
     * THINK: Analyze current state and plan
     */
    private async think(): Promise<ThoughtResult> {
        if (!this.state) throw new Error('No state');

        const currentTask = this.state.currentTask;
        const recentObs = this.state.observations.slice(-3);
        const failedApproaches = this.memory.getFailedApproaches();

        // Build analysis
        const analysis = `
Current phase: ${this.state.phase}
Current task: ${currentTask?.name || 'None'}
Task status: ${currentTask?.status || 'N/A'}
Iteration: ${this.state.iterationCount}/${this.state.maxIterations}
Recent observations: ${recentObs.length}
Failed approaches to avoid: ${failedApproaches.length}
    `.trim();

        // Use LLM for deeper analysis if available
        if (this.llmCall && currentTask) {
            try {
                const prompt = this.buildThinkPrompt();
                const response = await this.llmCall(prompt);
                return this.parseThoughtResult(response, analysis);
            } catch (e) {
                this.log('LLM think failed, using fallback', { error: String(e) });
            }
        }

        // Fallback: Simple analysis
        return {
            analysis,
            currentState: currentTask ? 'has_task' : 'no_task',
            nextSteps: currentTask ? [`Execute: ${currentTask.name}`] : ['Find next task'],
            concerns: [],
        };
    }

    /**
     * DECIDE: Choose the next action
     */
    private async decide(thought: ThoughtResult): Promise<Decision> {
        if (!this.state) throw new Error('No state');

        const currentTask = this.state.currentTask;

        // No task - check if plan is complete or stuck
        if (!currentTask) {
            if (this.planningEngine.isBlocked(this.state.currentPlan)) {
                return {
                    action: 'pivot',
                    reason: 'Plan is blocked, need to revise',
                    confidence: 0.7,
                };
            }

            // Try to get next task
            const nextTask = this.planningEngine.getNextExecutableTask(this.state.currentPlan);
            if (nextTask) {
                this.state.currentTask = nextTask;
                return {
                    action: 'execute',
                    reason: `Moving to next task: ${nextTask.name}`,
                    confidence: 0.9,
                };
            }

            return {
                action: 'terminate',
                reason: 'No more tasks to execute',
                confidence: 0.9,
            };
        }

        // Check if current task has failed too many times
        if (currentTask.retryCount >= currentTask.maxRetries) {
            return {
                action: 'skip',
                reason: `Task ${currentTask.name} failed after ${currentTask.retryCount} retries`,
                confidence: 0.8,
            };
        }

        // Check for recent failures that might need healing
        const recentObs = this.state.observations.slice(-1)[0];
        if (recentObs && recentObs.type === 'error' && this.config.autoHeal) {
            return {
                action: 'heal',
                reason: 'Recent error detected, attempting self-healing',
                confidence: 0.7,
            };
        }

        // Use LLM for complex decisions
        if (this.llmCall && thought.concerns.length > 0) {
            try {
                const prompt = this.buildDecidePrompt(thought);
                const response = await this.llmCall(prompt);
                return this.parseDecision(response);
            } catch (e) {
                this.log('LLM decide failed, using fallback', { error: String(e) });
            }
        }

        // Default: Execute current task
        return {
            action: 'execute',
            reason: `Executing task: ${currentTask.name}`,
            toolCall: this.taskToToolCall(currentTask),
            confidence: 0.8,
        };
    }

    /**
     * ACT: Execute the decided action
     */
    private async act(decision: Decision): Promise<ToolResult> {
        if (!this.state) throw new Error('No state');

        this.log('Acting', { action: decision.action, reason: decision.reason });

        switch (decision.action) {
            case 'execute':
                return this.executeTask(decision.toolCall);

            case 'retry':
                // Retry current task
                if (this.state.currentTask) {
                    return this.executeTask(this.taskToToolCall(this.state.currentTask));
                }
                return { success: false, output: '', error: 'No task to retry', duration: 0 };

            case 'pivot': {
                // Revise the plan
                const newInfo = this.state.observations.slice(-3)
                    .map(o => o.content)
                    .join('\n');
                this.state.currentPlan = await this.planningEngine.refinePlan(
                    this.state.currentPlan,
                    newInfo,
                    this.llmCall
                );
                this.state.currentTask = this.planningEngine.getNextExecutableTask(this.state.currentPlan);
                return { success: true, output: 'Plan revised', duration: 0 };
            }

            case 'skip':
                // Mark task as skipped and move on
                if (this.state.currentTask) {
                    this.state.currentPlan = this.planningEngine.updateTaskStatus(
                        this.state.currentPlan,
                        this.state.currentTask.id,
                        'skipped'
                    );
                    this.state.currentTask = this.planningEngine.getNextExecutableTask(this.state.currentPlan);
                }
                return { success: true, output: 'Task skipped', duration: 0 };

            case 'heal': {
                // Attempt self-healing
                const lastError = this.extractLastError();
                if (lastError) {
                    const result = await this.selfHealer.heal(lastError, this.llmCall);
                    return {
                        success: result.fixed,
                        output: result.summary,
                        error: result.fixed ? undefined : 'Healing failed',
                        duration: 0,
                    };
                }
                return { success: false, output: '', error: 'No error to heal', duration: 0 };
            }

            case 'terminate':
                return { success: true, output: 'Termination requested', duration: 0 };

            default:
                return { success: false, output: '', error: `Unknown action: ${decision.action}`, duration: 0 };
        }
    }

    /**
     * OBSERVE: Process the action result
     */
    private async observe(result: ToolResult, decision: Decision): Promise<Observation> {
        const observation: Observation = {
            id: `obs-${Date.now()}`,
            timestamp: Date.now(),
            type: result.success ? 'tool_result' : 'error',
            content: result.success
                ? result.output.substring(0, 500)
                : `Error: ${result.error || 'Unknown error'}`,
            source: decision.toolCall?.tool || decision.action,
            importance: result.success ? 'low' : 'high',
        };

        // Check for discoveries in successful results
        if (result.success && result.output.length > 100) {
            const hasImportantInfo =
                result.output.includes('TODO') ||
                result.output.includes('FIXME') ||
                result.output.includes('Warning');

            if (hasImportantInfo) {
                observation.importance = 'medium';
                observation.type = 'discovery';
            }
        }

        return observation;
    }

    /**
     * REFLECT: Learn from the observation
     */
    private async reflect(observation: Observation): Promise<Reflection> {
        if (!this.state) throw new Error('No state');

        const wasSuccessful = observation.type !== 'error';

        // Capture current task before updating
        const failedTaskName = this.state.currentTask?.name || 'Unknown task';

        // Update task status if we have a current task
        if (this.state.currentTask) {
            const newStatus = wasSuccessful ? 'completed' : 'failed';
            this.state.currentPlan = this.planningEngine.updateTaskStatus(
                this.state.currentPlan,
                this.state.currentTask.id,
                newStatus,
                { output: observation.content, error: wasSuccessful ? undefined : observation.content }
            );

            // Get next task
            this.state.currentTask = this.planningEngine.getNextExecutableTask(this.state.currentPlan);
        }

        // Extract lessons learned
        const lessonsLearned: string[] = [];
        if (!wasSuccessful) {
            lessonsLearned.push(`Task failed: ${observation.content.substring(0, 100)}`);

            // Record failure to avoid repeating
            this.memory.recordFailure(
                failedTaskName,
                observation.content.substring(0, 200)
            );
        }

        // Check if we should revise the plan
        const shouldRevise =
            !wasSuccessful &&
            this.state.reflections.filter(r => !r.wasSuccessful).length >= 2;

        return {
            wasSuccessful,
            lessonsLearned,
            shouldRevise,
            revisionSuggestion: shouldRevise ? 'Consider breaking down the failing task' : undefined,
        };
    }

    // ==================== HELPER METHODS ====================

    /**
     * Execute a task using the tool executor
     */
    private async executeTask(toolCall?: ToolCall): Promise<ToolResult> {
        if (!toolCall) {
            return { success: false, output: '', error: 'No tool call specified', duration: 0 };
        }

        const result = await this.toolExecutor.execute(toolCall);

        // Record in memory
        this.memory.addAction({
            id: `action-${Date.now()}`,
            timestamp: Date.now(),
            type: toolCall.tool,
            params: toolCall.params,
            result,
        });

        return result;
    }

    /**
     * Convert a task to a tool call
     */
    private taskToToolCall(task: Task): ToolCall {
        // Parse task description to determine tool type
        const desc = task.description.toLowerCase();

        if (desc.includes('npm install') || desc.includes('install dependencies')) {
            return { tool: 'npm_install', params: { cwd: this.config.workingDirectory } };
        }

        if (desc.includes('npm build') || desc.includes('build the project')) {
            return { tool: 'npm_build', params: { cwd: this.config.workingDirectory } };
        }

        if (desc.includes('npm test') || desc.includes('run tests')) {
            return { tool: 'npm_test', params: { cwd: this.config.workingDirectory } };
        }

        if (desc.includes('npm dev') || desc.includes('start server')) {
            return { tool: 'npm_dev', params: { cwd: this.config.workingDirectory } };
        }

        if (desc.includes('create file') || desc.includes('write file')) {
            // Extract file path from description
            const pathMatch = desc.match(/(?:create|write)\s+(?:file\s+)?([^\s]+)/);
            return {
                tool: 'file_write',
                params: {
                    path: pathMatch?.[1] || 'output.txt',
                    content: task.description,
                }
            };
        }

        if (desc.includes('read file')) {
            const pathMatch = desc.match(/read\s+(?:file\s+)?([^\s]+)/);
            return { tool: 'file_read', params: { path: pathMatch?.[1] || '' } };
        }

        if (desc.includes('search') || desc.includes('find')) {
            return { tool: 'search_code', params: { query: task.description, cwd: this.config.workingDirectory } };
        }

        // Default: LLM call to figure out what to do
        return {
            tool: 'llm_call',
            params: {
                prompt: `Execute this task: ${task.name}\n\nDescription: ${task.description}`
            }
        };
    }

    /**
     * Extract the last error from observations
     */
    private extractLastError(): ErrorContext | null {
        const errorObs = this.state?.observations
            .filter(o => o.type === 'error')
            .slice(-1)[0];

        if (!errorObs) return null;

        const location = this.selfHealer.extractLocation(errorObs.content);

        return {
            type: this.selfHealer.classifyError(errorObs.content),
            message: errorObs.content,
            file: location.file,
            line: location.line,
            previousAttempts: [],
        };
    }

    /**
     * Build the think prompt
     */
    private buildThinkPrompt(): string {
        if (!this.state) return '';

        return `
You are an autonomous software engineering agent. Analyze the current state and determine what to focus on.

## Current Task
${this.state.currentTask ? `
Name: ${this.state.currentTask.name}
Description: ${this.state.currentTask.description}
Status: ${this.state.currentTask.status}
Retries: ${this.state.currentTask.retryCount}/${this.state.currentTask.maxRetries}
` : 'No current task'}

## Recent Observations
${this.state.observations.slice(-3).map(o => `[${o.type}] ${o.content}`).join('\n') || 'None'}

## Plan Progress
${this.planningEngine.summarizePlan(this.state.currentPlan)}

## Memory
${this.memory.summarizeForLLM()}

Provide a brief analysis:
1. What is the current state?
2. What should be the next steps?
3. Are there any concerns?

Output as JSON:
\`\`\`json
{
  "analysis": "...",
  "currentState": "...",
  "nextSteps": ["..."],
  "concerns": ["..."]
}
\`\`\`
`.trim();
    }

    /**
     * Build the decide prompt
     */
    private buildDecidePrompt(thought: ThoughtResult): string {
        return `
Based on the analysis, decide what action to take.

## Analysis
${thought.analysis}

## Concerns
${thought.concerns.join('\n') || 'None'}

## Available Actions
- execute: Run the current task
- retry: Retry the failed task
- pivot: Revise the plan
- skip: Skip the current task
- heal: Attempt to fix an error
- terminate: Stop execution

Choose ONE action and explain why.

Output as JSON:
\`\`\`json
{
  "action": "execute|retry|pivot|skip|heal|terminate",
  "reason": "...",
  "confidence": 0.0-1.0
}
\`\`\`
`.trim();
    }

    /**
     * Parse thought result from LLM
     */
    private parseThoughtResult(response: string, fallbackAnalysis: string): ThoughtResult {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    analysis: parsed.analysis || fallbackAnalysis,
                    currentState: parsed.currentState || '',
                    nextSteps: parsed.nextSteps || [],
                    concerns: parsed.concerns || [],
                };
            }
        } catch {
            // Fall through
        }

        return {
            analysis: fallbackAnalysis,
            currentState: '',
            nextSteps: [],
            concerns: [],
        };
    }

    /**
     * Parse decision from LLM
     */
    private parseDecision(response: string): Decision {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    action: parsed.action as ActionType || 'execute',
                    reason: parsed.reason || 'LLM decision',
                    confidence: parsed.confidence || 0.5,
                };
            }
        } catch {
            // Fall through
        }

        return {
            action: 'execute',
            reason: 'Default action',
            confidence: 0.5,
        };
    }

    /**
     * Log a message (if verbose)
     */
    private log(message: string, data?: Record<string, unknown>): void {
        if (this.config.verbose) {
            console.log(`[Agent] ${message}`, data || '');
        }
    }

    /**
     * Stop the decision loop
     */
    stop(): void {
        this.shouldStop = true;
    }

    /**
     * Get current state
     */
    getState(): LoopState | null {
        return this.state;
    }

    /**
     * Check if running
     */
    getIsRunning(): boolean {
        return this.isRunning;
    }
}

// Export factory function
export function createDecisionLoop(
    config?: Partial<AgentConfig>,
    llmCall?: (prompt: string, systemPrompt?: string) => Promise<string>
): DecisionLoop {
    return new DecisionLoop(config, llmCall);
}
