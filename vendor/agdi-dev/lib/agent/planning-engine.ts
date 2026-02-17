/**
 * Planning Engine
 * 
 * Breaks high-level goals into executable tasks with dependency resolution.
 * Uses LLM to decompose complex goals and maintains task graphs.
 */

import type {
    Task,
    TaskStatus,
    Plan,
    AgentConfig,
} from './types';
import { DEFAULT_AGENT_CONFIG } from './types';
import { MemoryManager } from './memory-manager';

// ==================== CONSTANTS ====================

const MAX_SUBTASKS = 20;
const MAX_PLAN_REVISIONS = 5;

// ==================== PLANNING ENGINE CLASS ====================

export class PlanningEngine {
    private config: AgentConfig;
    private memory: MemoryManager;

    constructor(config: Partial<AgentConfig> = {}, memory?: MemoryManager) {
        this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
        this.memory = memory || new MemoryManager(this.config.persistMemory);
    }

    /**
     * Generate a plan from a high-level goal
     */
    async generatePlan(
        goal: string,
        context: string = '',
        llmCall?: (prompt: string) => Promise<string>
    ): Promise<Plan> {
        const planId = `plan-${Date.now()}`;

        // Get relevant memories
        const memories = this.memory.getRelevantMemories(goal);

        // Build the planning prompt
        const prompt = this.buildPlanningPrompt(goal, context, memories);

        let tasks: Task[];

        if (llmCall) {
            // Use LLM to decompose the goal
            const response = await llmCall(prompt);
            tasks = this.parseTasksFromLLM(response);
        } else {
            // Fallback: Create a simple single-task plan
            tasks = [{
                id: `task-${Date.now()}-0`,
                name: 'Execute Goal',
                description: goal,
                status: 'pending',
                dependencies: [],
                retryCount: 0,
                maxRetries: this.config.maxRetries,
                createdAt: Date.now(),
            }];
        }

        const plan: Plan = {
            id: planId,
            goal,
            tasks,
            currentTaskId: null,
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            revision: 0,
        };

        // Set the first executable task as current
        const firstTask = this.getNextExecutableTask(plan);
        if (firstTask) {
            plan.currentTaskId = firstTask.id;
        }

        return plan;
    }

    /**
     * Revise a plan based on new information
     */
    async refinePlan(
        plan: Plan,
        newInfo: string,
        llmCall?: (prompt: string) => Promise<string>
    ): Promise<Plan> {
        if (plan.revision >= MAX_PLAN_REVISIONS) {
            console.warn('Max plan revisions reached');
            return plan;
        }

        const prompt = this.buildRefinementPrompt(plan, newInfo);

        if (llmCall) {
            const response = await llmCall(prompt);
            const updatedTasks = this.parseTasksFromLLM(response, plan.tasks);

            return {
                ...plan,
                tasks: updatedTasks,
                updatedAt: Date.now(),
                revision: plan.revision + 1,
            };
        }

        return plan;
    }

    /**
     * Get the next task that can be executed (all dependencies met)
     */
    getNextExecutableTask(plan: Plan): Task | null {
        // Find pending tasks with all dependencies completed
        const executableTasks = plan.tasks.filter(task => {
            if (task.status !== 'pending') return false;

            // Check if all dependencies are completed
            const dependenciesMet = task.dependencies.every(depId => {
                const depTask = plan.tasks.find(t => t.id === depId);
                return depTask && depTask.status === 'completed';
            });

            return dependenciesMet;
        });

        // Return the first executable task (by creation order)
        return executableTasks.length > 0 ? executableTasks[0] : null;
    }

    /**
     * Update task status
     */
    updateTaskStatus(
        plan: Plan,
        taskId: string,
        status: TaskStatus,
        result?: { output: string; error?: string }
    ): Plan {
        const updatedTasks = plan.tasks.map(task => {
            if (task.id !== taskId) return task;

            return {
                ...task,
                status,
                result: result ? {
                    success: status === 'completed',
                    output: result.output,
                    duration: 0,
                } : task.result,
                completedAt: status === 'completed' || status === 'failed' ? Date.now() : undefined,
                error: result?.error,
                retryCount: status === 'failed' ? task.retryCount + 1 : task.retryCount,
            };
        });

        // Update current task to next executable
        let newCurrentTaskId = plan.currentTaskId;
        if (status === 'completed' || status === 'failed' || status === 'skipped') {
            const nextTask = this.getNextExecutableTask({ ...plan, tasks: updatedTasks });
            newCurrentTaskId = nextTask?.id || null;
        }

        // Check if plan is complete
        const allDone = updatedTasks.every(
            t => t.status === 'completed' || t.status === 'skipped'
        );
        const anyFailed = updatedTasks.some(t => t.status === 'failed');

        return {
            ...plan,
            tasks: updatedTasks,
            currentTaskId: newCurrentTaskId,
            status: allDone ? 'completed' : anyFailed && !newCurrentTaskId ? 'failed' : plan.status,
            updatedAt: Date.now(),
        };
    }

    /**
     * Check if the plan is blocked (no executable tasks but not complete)
     */
    isBlocked(plan: Plan): boolean {
        if (plan.status !== 'active') return false;

        const hasPendingTasks = plan.tasks.some(t => t.status === 'pending');
        const nextTask = this.getNextExecutableTask(plan);

        return hasPendingTasks && !nextTask;
    }

    /**
     * Get plan progress percentage
     */
    getProgress(plan: Plan): number {
        if (plan.tasks.length === 0) return 0;

        const completed = plan.tasks.filter(
            t => t.status === 'completed' || t.status === 'skipped'
        ).length;

        return Math.round((completed / plan.tasks.length) * 100);
    }

    /**
     * Get a summary of the plan for display
     */
    summarizePlan(plan: Plan): string {
        const progress = this.getProgress(plan);
        const currentTask = plan.tasks.find(t => t.id === plan.currentTaskId);

        const statusCounts = plan.tasks.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
        }, {} as Record<TaskStatus, number>);

        return `
## Plan: ${plan.goal}
Status: ${plan.status} | Progress: ${progress}%
Tasks: ${statusCounts.completed || 0}✓ ${statusCounts.failed || 0}✗ ${statusCounts.pending || 0}⏳ ${statusCounts['in-progress'] || 0}🔄

${currentTask ? `Current: ${currentTask.name}` : 'No active task'}

### All Tasks:
${plan.tasks.map((t, i) =>
            `${i + 1}. [${this.getStatusEmoji(t.status)}] ${t.name}${t.dependencies.length > 0 ? ` (depends on: ${t.dependencies.join(', ')})` : ''}`
        ).join('\n')}
`.trim();
    }

    // ==================== PRIVATE METHODS ====================

    /**
     * Build the prompt for plan generation
     */
    private buildPlanningPrompt(
        goal: string,
        context: string,
        memories: { failedApproaches: { approach: string; reason: string }[] }
    ): string {
        const failedApproachesText = memories.failedApproaches.length > 0
            ? `\n\nIMPORTANT - Avoid these failed approaches:\n${memories.failedApproaches.map(f => `- ${f.approach}: ${f.reason}`).join('\n')}`
            : '';

        return `
You are an autonomous software engineering agent. Break down the following goal into a list of executable tasks.

## Goal
${goal}

## Context
${context || 'No additional context provided.'}
${failedApproachesText}

## Instructions
1. Decompose the goal into 3-10 concrete, actionable tasks
2. Each task should be independently verifiable
3. Specify dependencies between tasks (which tasks must complete first)
4. Order tasks logically (dependencies first)

## Output Format
Return a JSON array of tasks:
\`\`\`json
[
  {
    "name": "Short task name",
    "description": "Detailed description of what to do",
    "dependencies": []  // Array of task indices (0-based) this depends on
  },
  {
    "name": "Another task",
    "description": "Description",
    "dependencies": [0]  // Depends on first task
  }
]
\`\`\`

Return ONLY the JSON array, no other text.
`.trim();
    }

    /**
     * Build the prompt for plan refinement
     */
    private buildRefinementPrompt(plan: Plan, newInfo: string): string {
        return `
You are an autonomous software engineering agent. Revise the plan based on new information.

## Original Goal
${plan.goal}

## Current Plan (revision ${plan.revision})
${plan.tasks.map((t, i) => `${i}. [${t.status}] ${t.name}: ${t.description}`).join('\n')}

## New Information
${newInfo}

## Instructions
1. Adjust the remaining pending tasks based on the new information
2. Add new tasks if needed
3. Remove or skip tasks that are no longer necessary
4. Keep completed tasks as-is

## Output Format
Return the updated JSON array of all tasks (including completed ones):
\`\`\`json
[
  { "name": "...", "description": "...", "dependencies": [], "status": "completed" },
  { "name": "New task", "description": "...", "dependencies": [0] }
]
\`\`\`

Return ONLY the JSON array.
`.trim();
    }

    /**
     * Parse tasks from LLM response
     */
    private parseTasksFromLLM(response: string, existingTasks?: Task[]): Task[] {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                throw new Error('No JSON array found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (!Array.isArray(parsed)) {
                throw new Error('Parsed result is not an array');
            }

            const tasks: Task[] = parsed.slice(0, MAX_SUBTASKS).map((item: {
                name?: string;
                description?: string;
                dependencies?: number[];
                status?: TaskStatus;
            }, index: number) => {
                // Check if this matches an existing task
                const existingTask = existingTasks?.find(t => t.name === item.name);

                return {
                    id: existingTask?.id || `task-${Date.now()}-${index}`,
                    name: item.name || `Task ${index + 1}`,
                    description: item.description || '',
                    status: item.status || existingTask?.status || 'pending',
                    dependencies: (item.dependencies || []).map((d: number) => `task-${Date.now()}-${d}`),
                    retryCount: existingTask?.retryCount || 0,
                    maxRetries: this.config.maxRetries,
                    createdAt: existingTask?.createdAt || Date.now(),
                    result: existingTask?.result,
                    completedAt: existingTask?.completedAt,
                };
            });

            // Fix dependency references
            const idMapping = new Map<number, string>();
            tasks.forEach((task, index) => {
                idMapping.set(index, task.id);
            });

            return tasks.map(task => ({
                ...task,
                dependencies: task.dependencies.map(dep => {
                    const depIndex = parseInt(dep.split('-').pop() || '0');
                    return idMapping.get(depIndex) || dep;
                }).filter(dep => tasks.some(t => t.id === dep)),
            }));
        } catch (error) {
            console.error('Failed to parse tasks from LLM:', error);

            // Return a fallback single task
            return [{
                id: `task-${Date.now()}-0`,
                name: 'Execute Goal',
                description: 'Unable to decompose goal. Execute directly.',
                status: 'pending',
                dependencies: [],
                retryCount: 0,
                maxRetries: this.config.maxRetries,
                createdAt: Date.now(),
            }];
        }
    }

    /**
     * Get emoji for task status
     */
    private getStatusEmoji(status: TaskStatus): string {
        const emojis: Record<TaskStatus, string> = {
            pending: '⏳',
            'in-progress': '🔄',
            completed: '✓',
            failed: '✗',
            blocked: '🚫',
            skipped: '⏭️',
        };
        return emojis[status] || '?';
    }

    /**
     * Topologically sort tasks based on dependencies
     */
    topologicalSort(tasks: Task[]): Task[] {
        const sorted: Task[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (task: Task) => {
            if (visited.has(task.id)) return;
            if (visiting.has(task.id)) {
                console.warn('Circular dependency detected:', task.id);
                return;
            }

            visiting.add(task.id);

            for (const depId of task.dependencies) {
                const dep = tasks.find(t => t.id === depId);
                if (dep) visit(dep);
            }

            visiting.delete(task.id);
            visited.add(task.id);
            sorted.push(task);
        };

        for (const task of tasks) {
            visit(task);
        }

        return sorted;
    }

    /**
     * Get tasks that can be executed in parallel
     */
    getParallelTasks(plan: Plan): Task[] {
        const completedIds = new Set(
            plan.tasks.filter(t => t.status === 'completed').map(t => t.id)
        );

        return plan.tasks.filter(task => {
            if (task.status !== 'pending') return false;
            return task.dependencies.every(depId => completedIds.has(depId));
        });
    }
}

// Export singleton for convenience
export const planningEngine = new PlanningEngine();
