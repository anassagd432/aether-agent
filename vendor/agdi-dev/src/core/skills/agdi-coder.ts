/**
 * Agdi Coder Skill
 * 
 * Ported from MoltBot coding intelligence with full rebrand.
 * This module provides the "Coding Brain" for Agdi - the system prompts,
 * tool definitions, and error recovery mechanisms that make Agdi an
 * expert coding assistant.
 * 
 * Zero-Trust Integration: All tool executions pass through Agdi's PermissionGate
 */

// =============================================================================
// AGDI SYSTEM PROMPTS - The "Brain" of the Coding Agent
// =============================================================================

/**
 * Core system prompt that defines Agdi's coding personality and capabilities.
 * Ported from MoltBot's buildAgentSystemPrompt with full rebrand.
 */
export function buildAgdiSystemPrompt(params: {
    workspaceDir: string;
    toolNames?: string[];
    contextFiles?: { path: string; content: string }[];
    userTimezone?: string;
    extraSystemPrompt?: string;
}): string {
    const { workspaceDir, toolNames = [], contextFiles = [], userTimezone, extraSystemPrompt } = params;

    const lines: string[] = [
        // IDENTITY - Rebranded from "Moltbot" to "Agdi"
        "You are Agdi, an expert AI coding assistant running inside AgdiCore.",
        "You help developers build, debug, and ship production-quality code.",
        "",

        // TOOL AVAILABILITY
        "## Tooling",
        "Tool availability (filtered by Zero-Trust policy):",
        "Tool names are case-sensitive. Call tools exactly as listed.",
        ...buildToolLines(toolNames),
        "",

        // TOOL CALL STYLE - Critical for good UX
        "## Tool Call Style",
        "Default: do not narrate routine, low-risk tool calls (just call the tool).",
        "Narrate only when it helps: multi-step work, complex/challenging problems, sensitive actions (e.g., deletions), or when the user explicitly asks.",
        "Keep narration brief and value-dense; avoid repeating obvious steps.",
        "Use plain human language for narration unless in a technical context.",
        "",

        // CHAIN OF THOUGHT - The "Plan-Execute" Loop
        "## Problem Solving Approach",
        "For complex coding tasks, follow this pattern:",
        "1. **Understand**: Read the relevant files to understand the codebase structure",
        "2. **Plan**: Outline your approach before making changes",
        "3. **Execute**: Make changes incrementally, testing after each significant change",
        "4. **Verify**: Run tests/builds to ensure changes work correctly",
        "5. **Iterate**: If errors occur, analyze and fix them systematically",
        "",

        // ERROR RECOVERY - Self-Healing Mechanism
        "## Error Recovery",
        "When you encounter errors:",
        "- Read the full error message carefully",
        "- Identify the root cause (not just symptoms)",
        "- Fix the underlying issue, not just the immediate error",
        "- If a fix doesn't work after 3 attempts, explain the blocker and ask for guidance",
        "- Never silently ignore errors",
        "",

        // WORKSPACE
        "## Workspace",
        `Your working directory is: ${workspaceDir}`,
        "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
        "Agdi runs inside WebContainer - a browser-based Node.js runtime.",
        "",

        // AGDI SPECIFICS
        "## Agdi Architecture",
        "- AgdiCore: The central orchestration engine",
        "- Swarm: Multi-agent coordination for complex tasks",
        "- NodeZero: The primary execution node",
        "All file operations run in WebContainer, not the user's local filesystem.",
        "",
    ];

    // Add timezone if available
    if (userTimezone) {
        lines.push("## Current Date & Time", `Time zone: ${userTimezone}`, "");
    }

    // Add context files (like SOUL.md)
    if (contextFiles.length > 0) {
        lines.push(
            "# Project Context",
            "",
            "The following project context files have been loaded:",
            ""
        );
        for (const file of contextFiles) {
            lines.push(`## ${file.path}`, "", file.content, "");
        }
    }

    // Add extra system prompt (for subagents, etc.)
    if (extraSystemPrompt) {
        lines.push("## Additional Context", extraSystemPrompt, "");
    }

    // RUNTIME INFO
    lines.push(
        "## Runtime",
        "Runtime: AgdiCore | WebContainer | Zero-Trust Enabled",
        ""
    );

    return lines.filter(Boolean).join("\n");
}

/**
 * Build tool description lines for the system prompt
 */
function buildToolLines(toolNames: string[]): string[] {
    const toolDescriptions: Record<string, string> = {
        read: "Read file contents",
        write: "Create or overwrite files",
        edit: "Make precise edits to files",
        grep: "Search file contents for patterns",
        find: "Find files by glob pattern",
        ls: "List directory contents",
        exec: "Run shell commands (in WebContainer)",
        browser: "Control web browser for testing",
        web_search: "Search the web for information",
        web_fetch: "Fetch and extract content from a URL",
    };

    if (toolNames.length === 0) {
        return Object.entries(toolDescriptions).map(
            ([name, desc]) => `- ${name}: ${desc}`
        );
    }

    return toolNames
        .map(name => {
            const desc = toolDescriptions[name.toLowerCase()];
            return desc ? `- ${name}: ${desc}` : `- ${name}`;
        })
        .filter(Boolean);
}

// =============================================================================
// AGDI TOOL DEFINITIONS
// =============================================================================

/**
 * Tool definition interface (matches Agdi's existing tool types)
 */
export interface AgdiTool {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
    workspaceDir: string;
    permissionGate: PermissionGate;
    abortSignal?: AbortSignal;
}

export interface PermissionGate {
    check(action: string, target: string): Promise<{ allowed: boolean; reason?: string }>;
    requestConfirmation(action: string, target: string): Promise<boolean>;
}

export interface ToolResult {
    success: boolean;
    output?: string;
    error?: string;
}

/**
 * Create the full set of Agdi coding tools
 * Ported from createMoltbotCodingTools with Zero-Trust integration
 */
export function createAgdiCodingTools(options: {
    workspaceDir: string;
    permissionGate: PermissionGate;
    enabledTools?: string[];
}): AgdiTool[] {
    const { workspaceDir, permissionGate, enabledTools } = options;

    const allTools: AgdiTool[] = [
        createReadTool(workspaceDir, permissionGate),
        createWriteTool(workspaceDir, permissionGate),
        createEditTool(workspaceDir, permissionGate),
        createExecTool(workspaceDir, permissionGate),
        createGrepTool(workspaceDir, permissionGate),
        createFindTool(workspaceDir, permissionGate),
        createLsTool(workspaceDir, permissionGate),
    ];

    if (enabledTools && enabledTools.length > 0) {
        const enabledSet = new Set(enabledTools.map(t => t.toLowerCase()));
        return allTools.filter(tool => enabledSet.has(tool.name.toLowerCase()));
    }

    return allTools;
}

// =============================================================================
// INDIVIDUAL TOOL IMPLEMENTATIONS
// =============================================================================

function createReadTool(workspaceDir: string, gate: PermissionGate): AgdiTool {
    return {
        name: "read",
        description: "Read the contents of a file. Use this to understand existing code before making changes.",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file to read (relative to workspace)" },
                startLine: { type: "number", description: "Optional start line (1-indexed)" },
                endLine: { type: "number", description: "Optional end line (1-indexed)" },
            },
            required: ["path"],
        },
        async execute(args, context) {
            const path = args.path as string;
            const check = await gate.check("read", path);
            if (!check.allowed) {
                return { success: false, error: `Permission denied: ${check.reason}` };
            }

            // Delegate to WebContainer file system
            try {
                const { readFile } = await import('../../../lib/webcontainer');
                const content = await readFile(path);
                return { success: true, output: content };
            } catch (err) {
                return { success: false, error: `Failed to read ${path}: ${err}` };
            }
        },
    };
}

function createWriteTool(workspaceDir: string, gate: PermissionGate): AgdiTool {
    return {
        name: "write",
        description: "Create or overwrite a file with new content. Use for creating new files or completely replacing file contents.",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file to write (relative to workspace)" },
                content: { type: "string", description: "Content to write to the file" },
            },
            required: ["path", "content"],
        },
        async execute(args, context) {
            const path = args.path as string;
            const content = args.content as string;

            const check = await gate.check("write", path);
            if (!check.allowed) {
                return { success: false, error: `Permission denied: ${check.reason}` };
            }

            try {
                const { writeFile } = await import('../../../lib/webcontainer');
                await writeFile(path, content);
                return { success: true, output: `Successfully wrote to ${path}` };
            } catch (err) {
                return { success: false, error: `Failed to write ${path}: ${err}` };
            }
        },
    };
}

function createEditTool(workspaceDir: string, gate: PermissionGate): AgdiTool {
    return {
        name: "edit",
        description: "Make precise edits to a file by specifying the exact text to find and replace.",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the file to edit" },
                find: { type: "string", description: "Exact text to find (must match exactly)" },
                replace: { type: "string", description: "Text to replace the found text with" },
            },
            required: ["path", "find", "replace"],
        },
        async execute(args, context) {
            const path = args.path as string;
            const find = args.find as string;
            const replace = args.replace as string;

            const check = await gate.check("edit", path);
            if (!check.allowed) {
                return { success: false, error: `Permission denied: ${check.reason}` };
            }

            try {
                const { readFile, writeFile } = await import('../../../lib/webcontainer');
                const content = await readFile(path);

                if (!content.includes(find)) {
                    return {
                        success: false,
                        error: `Could not find the specified text in ${path}. Make sure the text matches exactly, including whitespace.`
                    };
                }

                const newContent = content.replace(find, replace);
                await writeFile(path, newContent);
                return { success: true, output: `Successfully edited ${path}` };
            } catch (err) {
                return { success: false, error: `Failed to edit ${path}: ${err}` };
            }
        },
    };
}

function createExecTool(workspaceDir: string, gate: PermissionGate): AgdiTool {
    return {
        name: "exec",
        description: "Run a shell command in WebContainer. Use for npm install, running tests, building projects, etc.",
        parameters: {
            type: "object",
            properties: {
                command: { type: "string", description: "The shell command to execute" },
                timeout: { type: "number", description: "Timeout in seconds (default: 30)" },
            },
            required: ["command"],
        },
        async execute(args, context) {
            const command = args.command as string;
            const timeout = (args.timeout as number) || 30;

            // CRITICAL: Dangerous commands require explicit confirmation
            const dangerousPatterns = [
                /rm\s+-rf/i,
                /rm\s+.*--no-preserve-root/i,
                /:(){ :|:& };:/,  // Fork bomb
                /mkfs/i,
                /dd\s+if=/i,
                />\s*\/dev/i,
            ];

            const isDangerous = dangerousPatterns.some(p => p.test(command));

            if (isDangerous) {
                const confirmed = await gate.requestConfirmation("exec_dangerous", command);
                if (!confirmed) {
                    return {
                        success: false,
                        error: "Dangerous command blocked by Zero-Trust policy. User confirmation required."
                    };
                }
            }

            const check = await gate.check("exec", command);
            if (!check.allowed) {
                return { success: false, error: `Permission denied: ${check.reason}` };
            }

            try {
                const { runCommand } = await import('../../../lib/webcontainer');
                const result = await runCommand(command, { timeout: timeout * 1000 });
                return { success: true, output: result };
            } catch (err) {
                return { success: false, error: `Command failed: ${err}` };
            }
        },
    };
}

function createGrepTool(workspaceDir: string, gate: PermissionGate): AgdiTool {
    return {
        name: "grep",
        description: "Search for patterns in file contents. Use to find code, imports, or usages.",
        parameters: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "Pattern to search for (regex supported)" },
                path: { type: "string", description: "Path to search in (file or directory)" },
                caseSensitive: { type: "boolean", description: "Case sensitive search (default: false)" },
            },
            required: ["pattern"],
        },
        async execute(args, context) {
            const check = await gate.check("grep", args.path as string || workspaceDir);
            if (!check.allowed) {
                return { success: false, error: `Permission denied: ${check.reason}` };
            }

            // Implementation would use WebContainer's file system
            return { success: true, output: "Grep results would appear here" };
        },
    };
}

function createFindTool(workspaceDir: string, gate: PermissionGate): AgdiTool {
    return {
        name: "find",
        description: "Find files matching a glob pattern.",
        parameters: {
            type: "object",
            properties: {
                pattern: { type: "string", description: "Glob pattern to match (e.g., '**/*.ts')" },
                path: { type: "string", description: "Directory to search in" },
            },
            required: ["pattern"],
        },
        async execute(args, context) {
            const check = await gate.check("find", args.path as string || workspaceDir);
            if (!check.allowed) {
                return { success: false, error: `Permission denied: ${check.reason}` };
            }

            return { success: true, output: "Find results would appear here" };
        },
    };
}

function createLsTool(workspaceDir: string, gate: PermissionGate): AgdiTool {
    return {
        name: "ls",
        description: "List directory contents.",
        parameters: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory path to list (default: current directory)" },
                recursive: { type: "boolean", description: "List recursively" },
            },
        },
        async execute(args, context) {
            const path = (args.path as string) || workspaceDir;
            const check = await gate.check("ls", path);
            if (!check.allowed) {
                return { success: false, error: `Permission denied: ${check.reason}` };
            }

            try {
                const { listFiles } = await import('../../../lib/webcontainer');
                const files = await listFiles(path);
                return { success: true, output: files.join('\n') };
            } catch (err) {
                return { success: false, error: `Failed to list ${path}: ${err}` };
            }
        },
    };
}

// =============================================================================
// ERROR RECOVERY ENGINE
// =============================================================================

export interface ErrorContext {
    command?: string;
    error: string;
    file?: string;
    attemptNumber: number;
}

/**
 * Analyze an error and suggest recovery strategies
 * Ported from MoltBot's self-healing mechanisms
 */
export function analyzeError(ctx: ErrorContext): {
    rootCause: string;
    suggestedFix: string;
    shouldRetry: boolean;
    confidence: 'high' | 'medium' | 'low';
} {
    const { error, command, file, attemptNumber } = ctx;
    const errorLower = error.toLowerCase();

    // Common error patterns and fixes
    const errorPatterns = [
        {
            pattern: /module not found|cannot find module/i,
            rootCause: "Missing npm package",
            suggestedFix: "Run 'npm install' to install missing dependencies",
            confidence: 'high' as const,
        },
        {
            pattern: /enoent|no such file or directory/i,
            rootCause: "File or directory does not exist",
            suggestedFix: "Check the file path and create the file/directory if needed",
            confidence: 'high' as const,
        },
        {
            pattern: /syntax error|unexpected token/i,
            rootCause: "JavaScript/TypeScript syntax error",
            suggestedFix: "Review recent changes for typos, missing brackets, or semicolons",
            confidence: 'medium' as const,
        },
        {
            pattern: /type error|is not assignable/i,
            rootCause: "TypeScript type mismatch",
            suggestedFix: "Check type definitions and ensure values match expected types",
            confidence: 'medium' as const,
        },
        {
            pattern: /permission denied|eacces/i,
            rootCause: "Permission issue",
            suggestedFix: "Check file permissions or use elevated access if needed",
            confidence: 'high' as const,
        },
        {
            pattern: /timeout|timed out/i,
            rootCause: "Operation timed out",
            suggestedFix: "Retry with a longer timeout or optimize the operation",
            confidence: 'medium' as const,
        },
        {
            pattern: /network|fetch|connection/i,
            rootCause: "Network connectivity issue",
            suggestedFix: "Check network connection and retry",
            confidence: 'low' as const,
        },
    ];

    for (const { pattern, rootCause, suggestedFix, confidence } of errorPatterns) {
        if (pattern.test(error)) {
            return {
                rootCause,
                suggestedFix,
                shouldRetry: attemptNumber < 3,
                confidence,
            };
        }
    }

    // Unknown error
    return {
        rootCause: "Unknown error",
        suggestedFix: "Review the error message and context for clues",
        shouldRetry: attemptNumber < 2,
        confidence: 'low',
    };
}

// =============================================================================
// CHAIN OF THOUGHT ENGINE
// =============================================================================

export interface PlanStep {
    description: string;
    tool?: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    result?: string;
}

export interface ExecutionPlan {
    goal: string;
    steps: PlanStep[];
    currentStep: number;
}

/**
 * Create an execution plan for a coding task
 */
export function createExecutionPlan(goal: string, analysis: string): ExecutionPlan {
    // Parse the analysis to extract steps
    // This is a simplified version - the full implementation would use LLM
    const steps: PlanStep[] = [
        { description: "Understand the current codebase structure", tool: "read", status: 'pending' },
        { description: "Identify files that need modification", tool: "find", status: 'pending' },
        { description: "Make the required changes", tool: "edit", status: 'pending' },
        { description: "Run tests to verify changes", tool: "exec", status: 'pending' },
    ];

    return {
        goal,
        steps,
        currentStep: 0,
    };
}

/**
 * Execute the next step in a plan
 */
export async function executeNextStep(
    plan: ExecutionPlan,
    tools: AgdiTool[],
    context: ToolContext
): Promise<{ completed: boolean; result?: string; error?: string }> {
    if (plan.currentStep >= plan.steps.length) {
        return { completed: true };
    }

    const step = plan.steps[plan.currentStep];
    if (!step) {
        return { completed: true };
    }

    step.status = 'in_progress';

    // Find the tool for this step
    const tool = tools.find(t => t.name === step.tool);
    if (!tool) {
        step.status = 'failed';
        return {
            completed: false,
            error: `Tool '${step.tool}' not available for step: ${step.description}`
        };
    }

    // Execute would be called by the LLM with proper arguments
    // This is just the framework
    step.status = 'completed';
    plan.currentStep++;

    return {
        completed: plan.currentStep >= plan.steps.length,
        result: `Step completed: ${step.description}`,
    };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    buildAgdiSystemPrompt,
    createAgdiCodingTools,
    analyzeError,
    createExecutionPlan,
    executeNextStep,
};
