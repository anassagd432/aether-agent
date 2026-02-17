/**
 * Autonomous Agent
 * 
 * Main entry point for the autonomous software engineering agent.
 * Coordinates all components: planning, execution, healing, and termination.
 */

import type {
    AgentConfig,
    AgentResult,
    AgentState,
    AgentStatus,
    AgentEvent,
    AgentEventHandler,
    AgentEventType,
} from './types';
import { DEFAULT_AGENT_CONFIG } from './types';
import { DecisionLoop } from './decision-loop';
import { PlanningEngine } from './planning-engine';
import { ToolExecutor } from './tool-executor';
import { MemoryManager } from './memory-manager';
import { SelfHealer } from './self-healer';
import { TerminationEngine } from './termination-logic';

// Re-export types and utilities
export * from './types';
export { ToolExecutor } from './tool-executor';
export { MemoryManager } from './memory-manager';
export { PlanningEngine } from './planning-engine';
export { SelfHealer } from './self-healer';
export { TerminationEngine } from './termination-logic';
export { DecisionLoop, createDecisionLoop } from './decision-loop';

// ==================== AUTONOMOUS AGENT CLASS ====================

export class AutonomousAgent {
    private config: AgentConfig;
    private decisionLoop: DecisionLoop;
    private planningEngine: PlanningEngine;
    private toolExecutor: ToolExecutor;
    private memory: MemoryManager;
    private selfHealer: SelfHealer;
    private terminationEngine: TerminationEngine;
    private eventHandlers: Map<AgentEventType, AgentEventHandler[]> = new Map();
    private status: AgentStatus = 'idle';
    private currentGoal: string | null = null;
    private startTime: number | null = null;

    constructor(
        config: Partial<AgentConfig> = {},
        llmCall?: (prompt: string, systemPrompt?: string) => Promise<string>
    ) {
        this.config = { ...DEFAULT_AGENT_CONFIG, ...config };

        // Initialize shared components
        this.memory = new MemoryManager(this.config.persistMemory);
        this.toolExecutor = new ToolExecutor(this.config);
        this.planningEngine = new PlanningEngine(this.config, this.memory);
        this.selfHealer = new SelfHealer(this.config, this.toolExecutor, this.memory);
        this.terminationEngine = new TerminationEngine(this.config);
        this.decisionLoop = new DecisionLoop(this.config, llmCall);
    }

    /**
     * Run the agent with a goal
     */
    async run(goal: string): Promise<AgentResult> {
        this.currentGoal = goal;
        this.startTime = Date.now();
        this.status = 'planning';

        this.log(`Starting agent with goal: "${goal}"`);
        this.emit('plan_created', { goal });

        try {
            this.status = 'executing';
            const result = await this.decisionLoop.run(goal);

            this.status = result.success ? 'completed' : 'failed';
            this.emit(result.success ? 'agent_completed' : 'agent_failed', {
                result: result.report
            });

            this.log(`Agent ${result.success ? 'completed' : 'failed'}`, result.report);

            return result;
        } catch (error) {
            this.status = 'failed';
            this.log('Agent crashed', { error: String(error) });

            // Generate crash report
            const state = this.decisionLoop.getState();
            const execLog = this.toolExecutor.getExecutionLog();
            const report = await this.terminationEngine.generateReport(
                state || {
                    phase: 'think',
                    currentPlan: { id: '', goal, tasks: [], currentTaskId: null, status: 'failed', createdAt: Date.now(), updatedAt: Date.now(), revision: 0 },
                    currentTask: null,
                    observations: [],
                    reflections: [],
                    iterationCount: 0,
                    maxIterations: this.config.maxIterations,
                    startTime: this.startTime || Date.now(),
                },
                'unrecoverable_error',
                execLog
            );

            return {
                success: false,
                report: {
                    ...report,
                    errors: [error instanceof Error ? error.message : String(error)],
                },
                artifacts: [],
            };
        }
    }

    /**
     * Stop the agent
     */
    stop(): void {
        this.log('Stopping agent');
        this.decisionLoop.stop();
        this.status = 'paused';
    }

    /**
     * Get current status
     */
    getStatus(): AgentState {
        const loopState = this.decisionLoop.getState();

        return {
            status: this.status,
            currentGoal: this.currentGoal,
            currentPlan: loopState?.currentPlan || null,
            currentTask: loopState?.currentTask || null,
            iterationCount: loopState?.iterationCount || 0,
            startTime: this.startTime,
            lastAction: this.memory.getRecentActions(1)[0] || null,
            errors: [],
        };
    }

    /**
     * Subscribe to agent events
     */
    on(event: AgentEventType, handler: AgentEventHandler): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    /**
     * Unsubscribe from agent events
     */
    off(event: AgentEventType, handler: AgentEventHandler): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index >= 0) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event
     */
    private emit(type: AgentEventType, data: Record<string, unknown> = {}): void {
        const event: AgentEvent = {
            type,
            timestamp: Date.now(),
            data,
        };

        const handlers = this.eventHandlers.get(type) || [];
        handlers.forEach(handler => {
            try {
                handler(event);
            } catch (e) {
                console.error(`Event handler error for ${type}:`, e);
            }
        });
    }

    /**
     * Log a message
     */
    private log(message: string, data?: unknown): void {
        if (this.config.verbose) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [Agent] ${message}`, data || '');
        }
    }

    /**
     * Get memory manager for external access
     */
    getMemory(): MemoryManager {
        return this.memory;
    }

    /**
     * Get tool executor for external access
     */
    getToolExecutor(): ToolExecutor {
        return this.toolExecutor;
    }

    /**
     * Clear all memory and reset
     */
    reset(): void {
        this.memory.clearAll();
        this.toolExecutor.clearExecutionLog();
        this.terminationEngine.reset();
        this.status = 'idle';
        this.currentGoal = null;
        this.startTime = null;
    }
}

// ==================== FACTORY FUNCTION ====================

/**
 * Create a new autonomous agent
 */
export function createAgent(
    config?: Partial<AgentConfig>,
    llmCall?: (prompt: string, systemPrompt?: string) => Promise<string>
): AutonomousAgent {
    return new AutonomousAgent(config, llmCall);
}

// ==================== INTEGRATION WITH LLM PROVIDER ====================

/**
 * Create an agent with the LLM provider from agdi-architect
 */
export async function createAgentWithLLM(
    config?: Partial<AgentConfig>
): Promise<AutonomousAgent> {
    // Dynamic import to avoid circular dependencies
    const { llmService } = await import('../llm-provider');

    const llmCall = async (prompt: string, systemPrompt?: string): Promise<string> => {
        const messages = [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            { role: 'user' as const, content: prompt },
        ];
        // Import ModelRole for task config
        const { ModelRole } = await import('../llm-provider');
        const response = await llmService.complete(messages, { role: ModelRole.REASONING });

        return response.content;
    };

    return new AutonomousAgent(config, llmCall);
}

// ==================== QUICK START HELPER ====================

/**
 * Quick start: Create and run an agent with a goal
 */
export async function runAgent(
    goal: string,
    config?: Partial<AgentConfig>
): Promise<AgentResult> {
    const agent = await createAgentWithLLM(config);
    return agent.run(goal);
}
