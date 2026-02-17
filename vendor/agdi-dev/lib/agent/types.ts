/**
 * Autonomous Agent Type Definitions
 * 
 * Core types for the autonomous software engineering agent.
 */

// ==================== TASK & PLANNING ====================

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked' | 'skipped';

export interface Task {
    id: string;
    name: string;
    description: string;
    status: TaskStatus;
    dependencies: string[];
    subtasks?: Task[];
    result?: TaskResult;
    retryCount: number;
    maxRetries: number;
    createdAt: number;
    completedAt?: number;
    error?: string;
}

export interface TaskResult {
    success: boolean;
    output: string;
    artifacts?: string[];
    duration: number;
}

export interface Plan {
    id: string;
    goal: string;
    tasks: Task[];
    currentTaskId: string | null;
    status: 'active' | 'completed' | 'failed' | 'paused';
    createdAt: number;
    updatedAt: number;
    revision: number;
}

// ==================== DECISION LOOP ====================

export type LoopPhase = 'think' | 'decide' | 'act' | 'observe' | 'reflect';

export type ActionType = 'execute' | 'retry' | 'pivot' | 'skip' | 'terminate' | 'heal';

export interface Decision {
    action: ActionType;
    reason: string;
    toolCall?: ToolCall;
    confidence: number;
}

export interface ThoughtResult {
    analysis: string;
    currentState: string;
    nextSteps: string[];
    concerns: string[];
}

export interface Reflection {
    wasSuccessful: boolean;
    lessonsLearned: string[];
    shouldRevise: boolean;
    revisionSuggestion?: string;
}

export interface LoopState {
    phase: LoopPhase;
    currentPlan: Plan;
    currentTask: Task | null;
    observations: Observation[];
    reflections: Reflection[];
    iterationCount: number;
    maxIterations: number;
    startTime: number;
}

// ==================== TOOLS ====================

export type ToolType =
    | 'shell'
    | 'file_read'
    | 'file_write'
    | 'file_delete'
    | 'npm_install'
    | 'npm_build'
    | 'npm_test'
    | 'npm_dev'
    | 'lint'
    | 'search_files'
    | 'search_code'
    | 'web_search'
    | 'llm_call'
    | 'generate_code'
    // Workspace tools
    | 'list_dir'
    | 'get_cwd'
    | 'change_dir';

export interface ToolCall {
    tool: ToolType;
    params: Record<string, unknown>;
    timeout?: number;
}

export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
    exitCode?: number;
    duration: number;
    metadata?: Record<string, unknown>;
}

// ==================== OBSERVATIONS ====================

export interface Observation {
    id: string;
    timestamp: number;
    type: 'tool_result' | 'error' | 'discovery' | 'state_change';
    content: string;
    source: string;
    importance: 'low' | 'medium' | 'high' | 'critical';
}

// ==================== ERRORS & HEALING ====================

export type ErrorType = 'build_error' | 'test_failure' | 'runtime_error' | 'lint_error' | 'type_error' | 'unknown';

export interface ErrorContext {
    type: ErrorType;
    message: string;
    stackTrace?: string;
    file?: string;
    line?: number;
    column?: number;
    previousAttempts: FixAttempt[];
}

export interface FixAttempt {
    diagnosis: string;
    fix: string;
    appliedAt: number;
    result: 'success' | 'failed' | 'partial';
}

export interface Diagnosis {
    rootCause: string;
    affectedFiles: string[];
    suggestedFixes: string[];
    confidence: number;
}

export interface HealingResult {
    fixed: boolean;
    attempts: FixAttempt[];
    finalState: 'resolved' | 'unresolvable' | 'needs_human';
    summary: string;
}

// ==================== MEMORY ====================

export interface Action {
    id: string;
    timestamp: number;
    type: ToolType;
    params: Record<string, unknown>;
    result: ToolResult;
}

export interface ShortTermMemory {
    recentActions: Action[];
    recentObservations: Observation[];
    currentContext: string;
    workingSet: Map<string, unknown>;
}

export interface Discovery {
    id: string;
    description: string;
    relevance: string[];
    timestamp: number;
    source: string;
}

export interface FailedApproach {
    approach: string;
    reason: string;
    timestamp: number;
    context: string;
}

export interface CodeKnowledge {
    file: string;
    summary: string;
    exports: string[];
    dependencies: string[];
    lastUpdated: number;
}

export interface LongTermMemory {
    completedGoals: string[];
    failedApproaches: FailedApproach[];
    discoveries: Discovery[];
    codeKnowledge: CodeKnowledge[];
}

// ==================== TERMINATION ====================

export type TerminationReason =
    | 'goal_achieved'
    | 'max_iterations'
    | 'max_time'
    | 'unrecoverable_error'
    | 'user_interrupt'
    | 'resource_limit'
    | 'stuck_loop';

export interface FinalReport {
    goal: string;
    status: 'success' | 'partial' | 'failed';
    reason: TerminationReason;
    summary: string;
    tasksCompleted: Task[];
    tasksFailed: Task[];
    filesModified: string[];
    filesCreated: string[];
    commandsExecuted: string[];
    totalDuration: number;
    totalIterations: number;
    recommendations?: string[];
    errors?: string[];
}

export interface TerminationDecision {
    shouldTerminate: boolean;
    reason?: TerminationReason;
    confidence: number;
}

// ==================== AGENT CONFIG ====================

export interface AgentConfig {
    maxIterations: number;
    maxRetries: number;
    maxTimeMs: number;
    workingDirectory: string;
    verbose: boolean;
    autoHeal: boolean;
    persistMemory: boolean;
    dangerousCommandsAllowed: boolean;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
    maxIterations: 100,
    maxRetries: 3,
    maxTimeMs: 30 * 60 * 1000, // 30 minutes
    workingDirectory: typeof process !== 'undefined' && process.cwd ? process.cwd() : '.',
    verbose: true,
    autoHeal: true,
    persistMemory: true,
    dangerousCommandsAllowed: false,
};

// ==================== AGENT STATE ====================

export type AgentStatus = 'idle' | 'planning' | 'executing' | 'healing' | 'completed' | 'failed' | 'paused';

export interface AgentState {
    status: AgentStatus;
    currentGoal: string | null;
    currentPlan: Plan | null;
    currentTask: Task | null;
    iterationCount: number;
    startTime: number | null;
    lastAction: Action | null;
    errors: ErrorContext[];
}

export interface AgentResult {
    success: boolean;
    report: FinalReport;
    artifacts: string[];
}

// ==================== EVENTS ====================

export type AgentEventType =
    | 'plan_created'
    | 'plan_revised'
    | 'task_started'
    | 'task_completed'
    | 'task_failed'
    | 'tool_executed'
    | 'error_detected'
    | 'healing_started'
    | 'healing_completed'
    | 'iteration_completed'
    | 'agent_completed'
    | 'agent_failed';

export interface AgentEvent {
    type: AgentEventType;
    timestamp: number;
    data: Record<string, unknown>;
}

export type AgentEventHandler = (event: AgentEvent) => void;
