/**
 * useAutonomousAgent Hook
 * 
 * React hook for managing the autonomous agent lifecycle.
 * Provides real-time event streaming to the UI.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
    AgentConfig,
    AgentState,
    AgentEventType,
    AgentEvent,
    AgentResult
} from '../lib/agent/types';

// ==================== LOG TYPES ====================

export type LogType = 'thinking' | 'tool' | 'success' | 'error' | 'healing' | 'info';

export interface AgentLog {
    id: string;
    type: LogType;
    message: string;
    timestamp: number;
}

// Color mapping for log types
export const LOG_COLORS: Record<LogType, string> = {
    thinking: 'text-cyan-400',
    tool: 'text-cyan-400',
    success: 'text-green-400',
    error: 'text-red-400',
    healing: 'text-orange-400',
    info: 'text-slate-400',
};

export const LOG_ICONS: Record<LogType, string> = {
    thinking: '🧠',
    tool: '🛠️',
    success: '✅',
    error: '❌',
    healing: '🩹',
    info: '💡',
};

// ==================== HOOK INTERFACE ====================

export interface UseAutonomousAgentReturn {
    // State
    isRunning: boolean;
    status: AgentState['status'] | 'idle';
    logs: AgentLog[];
    result: AgentResult | null;

    // Actions
    run: (goal: string) => Promise<AgentResult>;
    stop: () => void;
    reset: () => void;
}

// ==================== HOOK IMPLEMENTATION ====================

export function useAutonomousAgent(
    config?: Partial<AgentConfig>
): UseAutonomousAgentReturn {
    const [isRunning, setIsRunning] = useState(false);
    const [status, setStatus] = useState<AgentState['status'] | 'idle'>('idle');
    const [logs, setLogs] = useState<AgentLog[]>([]);
    const [result, setResult] = useState<AgentResult | null>(null);

    const agentRef = useRef<any>(null);
    const abortRef = useRef(false);

    // Add a log entry
    const addLog = useCallback((type: LogType, message: string) => {
        const log: AgentLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            message,
            timestamp: Date.now(),
        };
        setLogs(prev => [...prev, log]);
    }, []);

    // Map agent events to logs
    const handleAgentEvent = useCallback((event: AgentEvent) => {
        switch (event.type) {
            case 'plan_created':
                addLog('thinking', `Planning: "${event.data.goal}"`);
                break;
            case 'plan_revised':
                addLog('thinking', 'Revising plan based on new information...');
                break;
            case 'task_started':
                addLog('info', `Starting task: ${(event.data.task as { name?: string })?.name || 'Unknown'}`);
                break;
            case 'task_completed':
                addLog('success', `Completed: ${(event.data.task as { name?: string })?.name || 'Task'}`);
                break;
            case 'task_failed':
                addLog('error', `Failed: ${(event.data.task as { name?: string })?.name || 'Task'} - ${event.data.error || ''}`);
                break;
            case 'tool_executed':
                addLog('tool', `Executed: ${event.data.tool || 'Unknown tool'}`);
                break;
            case 'error_detected':
                addLog('error', `Error: ${event.data.message || 'Unknown error'}`);
                break;
            case 'healing_started':
                addLog('healing', 'Attempting to self-heal...');
                break;
            case 'healing_completed':
                addLog('healing', `Self-healing ${event.data.success ? 'successful' : 'failed'}`);
                break;
            case 'iteration_completed':
                addLog('info', `Completed iteration ${event.data.iteration || 0}`);
                break;
            case 'agent_completed':
                addLog('success', 'Agent completed successfully!');
                break;
            case 'agent_failed':
                addLog('error', `Agent failed: ${event.data.reason || 'Unknown reason'}`);
                break;
        }
    }, [addLog]);

    // Run the agent
    const run = useCallback(async (goal: string): Promise<AgentResult> => {
        setIsRunning(true);
        setStatus('planning');
        setResult(null);
        abortRef.current = false;

        // Clear old logs, add initial log
        setLogs([]);
        addLog('thinking', `Initializing autonomous agent with goal: "${goal.substring(0, 50)}${goal.length > 50 ? '...' : ''}"`);

        try {
            // Dynamically import to avoid SSR issues
            const { createAgentWithLLM } = await import('../lib/agent/index');
            const { BrowserToolExecutor } = await import('../lib/agent/browser-tool-executor');

            // Create browser executor with event streaming
            const executor = new BrowserToolExecutor(config);
            executor.onEvent((event) => {
                if (event.type === 'output') {
                    addLog('tool', event.message);
                } else if (event.type === 'error') {
                    addLog('error', event.message);
                } else if (event.type === 'start') {
                    addLog('tool', `Starting ${event.tool}...`);
                } else if (event.type === 'complete') {
                    addLog('success', `${event.tool} completed`);
                }
            });

            // Create agent
            const agent = await createAgentWithLLM({
                ...config,
                verbose: true,
            });
            agentRef.current = agent;

            // Subscribe to agent events
            const eventTypes: AgentEventType[] = [
                'plan_created',
                'plan_revised',
                'task_started',
                'task_completed',
                'task_failed',
                'tool_executed',
                'error_detected',
                'healing_started',
                'healing_completed',
                'iteration_completed',
                'agent_completed',
                'agent_failed',
            ];

            eventTypes.forEach(type => {
                agent.on(type, handleAgentEvent);
            });

            addLog('thinking', 'Analyzing requirements and creating execution plan...');
            setStatus('executing');

            // Run the agent
            const agentResult = await agent.run(goal);

            // Check if aborted
            if (abortRef.current) {
                addLog('info', 'Agent was stopped by user.');
                return agentResult;
            }

            setResult(agentResult);
            setStatus(agentResult.success ? 'completed' : 'failed');

            if (agentResult.success) {
                addLog('success', `Goal achieved! Created ${agentResult.artifacts?.length || 0} artifacts.`);
            } else {
                addLog('error', `Agent finished with errors. See report for details.`);
            }

            return agentResult;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog('error', `Agent crashed: ${errorMessage}`);
            setStatus('failed');

            return {
                success: false,
                report: {
                    goal,
                    status: 'failed',
                    reason: 'unrecoverable_error',
                    summary: errorMessage,
                    tasksCompleted: [],
                    tasksFailed: [],
                    filesModified: [],
                    filesCreated: [],
                    commandsExecuted: [],
                    totalDuration: 0,
                    totalIterations: 0,
                    errors: [errorMessage],
                },
                artifacts: [],
            };
        } finally {
            setIsRunning(false);
        }
    }, [config, addLog, handleAgentEvent]);

    // Stop the agent
    const stop = useCallback(() => {
        abortRef.current = true;
        if (agentRef.current) {
            agentRef.current.stop();
            addLog('info', 'Stopping agent...');
        }
        setIsRunning(false);
        setStatus('paused');
    }, [addLog]);

    // Reset the agent state
    const reset = useCallback(() => {
        abortRef.current = true;
        if (agentRef.current) {
            agentRef.current.reset();
        }
        setIsRunning(false);
        setStatus('idle');
        setLogs([]);
        setResult(null);
        agentRef.current = null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (agentRef.current) {
                agentRef.current.stop();
            }
        };
    }, []);

    return {
        isRunning,
        status,
        logs,
        result,
        run,
        stop,
        reset,
    };
}

export default useAutonomousAgent;
