/**
 * Termination Logic
 * 
 * Determines when the agent should stop and generates final reports.
 */

import type {
    LoopState,
    TerminationReason,
    TerminationDecision,
    FinalReport,
    Task,
    AgentConfig,
} from './types';
import { DEFAULT_AGENT_CONFIG } from './types';

// ==================== CONSTANTS ====================

const STUCK_LOOP_THRESHOLD = 3;
const LOW_PROGRESS_ITERATIONS = 10;

// ==================== TERMINATION ENGINE CLASS ====================

export class TerminationEngine {
    private config: AgentConfig;
    private stateHistory: string[] = [];

    constructor(config: Partial<AgentConfig> = {}) {
        this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    }

    /**
     * Check if the agent should terminate
     */
    checkTermination(state: LoopState): TerminationDecision {
        // Check goal achievement
        if (this.isGoalAchieved(state)) {
            return {
                shouldTerminate: true,
                reason: 'goal_achieved',
                confidence: 1.0,
            };
        }

        // Check iteration limit
        if (state.iterationCount >= state.maxIterations) {
            return {
                shouldTerminate: true,
                reason: 'max_iterations',
                confidence: 1.0,
            };
        }

        // Check time limit
        const elapsed = Date.now() - state.startTime;
        if (elapsed >= this.config.maxTimeMs) {
            return {
                shouldTerminate: true,
                reason: 'max_time',
                confidence: 1.0,
            };
        }

        // Check for stuck loop
        if (this.isStuck(state)) {
            return {
                shouldTerminate: true,
                reason: 'stuck_loop',
                confidence: 0.8,
            };
        }

        // Check for unrecoverable errors
        if (this.hasUnrecoverableError(state)) {
            return {
                shouldTerminate: true,
                reason: 'unrecoverable_error',
                confidence: 0.9,
            };
        }

        return {
            shouldTerminate: false,
            confidence: 0,
        };
    }

    /**
     * Check if the goal has been achieved
     */
    isGoalAchieved(state: LoopState): boolean {
        if (!state.currentPlan) return false;

        // All tasks completed
        const allCompleted = state.currentPlan.tasks.every(
            t => t.status === 'completed' || t.status === 'skipped'
        );

        // Plan marked as completed
        const planCompleted = state.currentPlan.status === 'completed';

        return allCompleted || planCompleted;
    }

    /**
     * Check if the agent is stuck in a loop
     */
    isStuck(state: LoopState): boolean {
        // Create a state fingerprint
        const fingerprint = this.createStateFingerprint(state);
        this.stateHistory.push(fingerprint);

        // Keep only recent history
        if (this.stateHistory.length > 20) {
            this.stateHistory = this.stateHistory.slice(-20);
        }

        // Count repeated states
        const repeatCount = this.stateHistory.filter(s => s === fingerprint).length;

        if (repeatCount >= STUCK_LOOP_THRESHOLD) {
            return true;
        }

        // Check for low progress
        if (state.iterationCount > LOW_PROGRESS_ITERATIONS) {
            const recentReflections = state.reflections.slice(-5);
            const noSuccess = recentReflections.every(r => !r.wasSuccessful);
            if (noSuccess) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if there's an unrecoverable error
     */
    hasUnrecoverableError(state: LoopState): boolean {
        if (!state.currentPlan) return false;

        // Check for tasks that failed max retries
        const unrecoverableTasks = state.currentPlan.tasks.filter(
            t => t.status === 'failed' && t.retryCount >= t.maxRetries
        );

        // If all remaining tasks depend on failed tasks, we're stuck
        const failedIds = new Set(unrecoverableTasks.map(t => t.id));
        const pendingTasks = state.currentPlan.tasks.filter(t => t.status === 'pending');

        const allBlocked = pendingTasks.every(t =>
            t.dependencies.some(dep => failedIds.has(dep))
        );

        return unrecoverableTasks.length > 0 && (allBlocked || pendingTasks.length === 0);
    }

    /**
     * Create a fingerprint of the current state for loop detection
     */
    private createStateFingerprint(state: LoopState): string {
        const taskStates = state.currentPlan?.tasks
            .map(t => `${t.id}:${t.status}`)
            .join(',') || '';

        const currentTask = state.currentTask?.id || 'none';
        const phase = state.phase;

        return `${phase}|${currentTask}|${taskStates}`;
    }

    /**
     * Generate a final report
     */
    async generateReport(
        state: LoopState,
        reason: TerminationReason,
        executionLog: Array<{ call: { tool: string; params: Record<string, unknown> }; result: { success: boolean; output: string; error?: string } }> = []
    ): Promise<FinalReport> {
        const endTime = Date.now();
        const duration = endTime - state.startTime;

        const completedTasks = state.currentPlan?.tasks.filter(t => t.status === 'completed') || [];
        const failedTasks = state.currentPlan?.tasks.filter(t => t.status === 'failed') || [];

        // Collect files modified from execution log
        const filesModified = new Set<string>();
        const filesCreated = new Set<string>();
        const commandsExecuted: string[] = [];

        executionLog.forEach(log => {
            const tool = log.call.tool;
            if (tool === 'file_write') {
                const path = String(log.call.params?.path || '');
                if (path) filesCreated.add(path);
            }
            if (tool === 'file_delete') {
                const path = String(log.call.params?.path || '');
                if (path) filesModified.add(path);
            }
            if (tool === 'shell') {
                const cmd = String(log.call.params?.command || '');
                if (cmd) commandsExecuted.push(cmd);
            }
        });

        // Determine status
        let status: 'success' | 'partial' | 'failed';
        if (reason === 'goal_achieved') {
            status = 'success';
        } else if (completedTasks.length > 0) {
            status = 'partial';
        } else {
            status = 'failed';
        }

        // Generate summary
        const summary = this.generateSummary(state, reason, completedTasks, failedTasks);

        // Generate recommendations
        const recommendations = this.generateRecommendations(state, reason, failedTasks);

        // Collect errors
        const errors = failedTasks
            .filter(t => t.error)
            .map(t => `${t.name}: ${t.error}`);

        return {
            goal: state.currentPlan?.goal || 'Unknown goal',
            status,
            reason,
            summary,
            tasksCompleted: completedTasks,
            tasksFailed: failedTasks,
            filesModified: Array.from(filesModified),
            filesCreated: Array.from(filesCreated),
            commandsExecuted,
            totalDuration: duration,
            totalIterations: state.iterationCount,
            recommendations: recommendations.length > 0 ? recommendations : undefined,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    /**
     * Generate a human-readable summary
     */
    private generateSummary(
        state: LoopState,
        reason: TerminationReason,
        completedTasks: Task[],
        failedTasks: Task[]
    ): string {
        const totalTasks = state.currentPlan?.tasks.length || 0;
        const completedCount = completedTasks.length;
        const failedCount = failedTasks.length;

        const reasonMessages: Record<TerminationReason, string> = {
            goal_achieved: 'Goal successfully achieved.',
            max_iterations: `Stopped after reaching maximum iterations (${state.maxIterations}).`,
            max_time: 'Stopped due to time limit.',
            unrecoverable_error: 'Stopped due to unrecoverable errors.',
            user_interrupt: 'Stopped by user request.',
            resource_limit: 'Stopped due to resource limits.',
            stuck_loop: 'Stopped because the agent was stuck in a loop.',
        };

        return `
${reasonMessages[reason]}

Completed ${completedCount} of ${totalTasks} tasks (${failedCount} failed).

${completedTasks.length > 0 ? `Completed:\n${completedTasks.map(t => `  ✓ ${t.name}`).join('\n')}` : ''}
${failedTasks.length > 0 ? `\nFailed:\n${failedTasks.map(t => `  ✗ ${t.name}: ${t.error || 'Unknown error'}`).join('\n')}` : ''}
`.trim();
    }

    /**
     * Generate recommendations based on what happened
     */
    private generateRecommendations(
        state: LoopState,
        reason: TerminationReason,
        failedTasks: Task[]
    ): string[] {
        const recommendations: string[] = [];

        switch (reason) {
            case 'max_iterations':
                recommendations.push('Consider breaking down the goal into smaller sub-goals.');
                recommendations.push('Increase the iteration limit if more time is needed.');
                break;

            case 'stuck_loop':
                recommendations.push('The agent was repeating the same actions. Review the task definitions.');
                recommendations.push('Consider providing more specific instructions.');
                break;

            case 'unrecoverable_error':
                if (failedTasks.length > 0) {
                    recommendations.push(`Review the failed task: "${failedTasks[0].name}"`);
                    recommendations.push('Check if dependencies are correctly installed.');
                }
                break;

            case 'max_time':
                recommendations.push('Consider increasing the time limit for complex tasks.');
                break;
        }

        // Add general recommendations based on reflections
        const recentReflections = state.reflections.slice(-3);
        const lessons = recentReflections.flatMap(r => r.lessonsLearned);
        if (lessons.length > 0) {
            recommendations.push(`Lessons learned: ${lessons.slice(0, 2).join('; ')}`);
        }

        return recommendations;
    }

    /**
     * Reset state history
     */
    reset(): void {
        this.stateHistory = [];
    }
}

// Export singleton
export const terminationEngine = new TerminationEngine();
