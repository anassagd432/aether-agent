/**
 * Action Plan Types
 * 
 * Structured action plan format for model output.
 */

// ==================== ACTION TYPES ====================

export type ActionType = 'mkdir' | 'writeFile' | 'deleteFile' | 'exec' | 'generateImage';

export interface MkdirAction {
    type: 'mkdir';
    path: string;
}

export interface WriteFileAction {
    type: 'writeFile';
    path: string;
    content: string;
}

export interface DeleteFileAction {
    type: 'deleteFile';
    path: string;
}

export interface ExecAction {
    type: 'exec';
    argv: string[];
    cwd?: string;
}

export interface GenerateImageAction {
    type: 'generateImage';
    prompt: string;
    savePath: string;
    style?: 'realistic' | 'artistic' | 'minimal' | 'tech';
}

export type Action = MkdirAction | WriteFileAction | DeleteFileAction | ExecAction | GenerateImageAction;

// ==================== ACTION PLAN ====================

export interface ActionPlan {
    projectName: string;
    actions: Action[];
    nextSteps?: string;
}

// ==================== EXECUTION RESULT ====================

export interface ActionResult {
    action: Action;
    success: boolean;
    error?: string;
    output?: string;
}

export interface PlanExecutionResult {
    success: boolean;
    results: ActionResult[];
    filesCreated: string[];
    commandsRun: string[];
    errors: string[];
}

// ==================== PLAN SUMMARY ====================

export interface PlanSummary {
    filesCreated: number;
    filesDeleted: number;
    dirsCreated: number;
    commandsToRun: number;
    domains: string[];
    ports: number[];
    riskTier: number;
}

/**
 * Summarize an action plan for display
 */
export function summarizePlan(plan: ActionPlan): PlanSummary {
    let filesCreated = 0;
    let filesDeleted = 0;
    let dirsCreated = 0;
    let commandsToRun = 0;
    const domains: string[] = [];
    const ports: number[] = [];
    let maxRiskTier = 0;

    for (const action of plan.actions) {
        switch (action.type) {
            case 'mkdir':
                dirsCreated++;
                maxRiskTier = Math.max(maxRiskTier, 1);
                break;
            case 'writeFile':
                filesCreated++;
                maxRiskTier = Math.max(maxRiskTier, 1);
                break;
            case 'deleteFile':
                filesDeleted++;
                maxRiskTier = Math.max(maxRiskTier, 1);
                break;
            case 'exec':
                commandsToRun++;
                // Check for package managers
                if (['npm', 'yarn', 'pnpm', 'pip'].includes(action.argv[0])) {
                    maxRiskTier = Math.max(maxRiskTier, 2);
                    if (['npm', 'yarn', 'pnpm'].includes(action.argv[0])) {
                        domains.push('registry.npmjs.org');
                    }
                    if (action.argv[0] === 'pip') {
                        domains.push('pypi.org');
                    }
                }
                // Check for dev server
                if (action.argv.includes('dev') || action.argv.includes('start')) {
                    ports.push(3000);
                }
                break;
        }
    }

    return {
        filesCreated,
        filesDeleted,
        dirsCreated,
        commandsToRun,
        domains: [...new Set(domains)],
        ports: [...new Set(ports)],
        riskTier: maxRiskTier,
    };
}

/**
 * Validate action structure strictly
 */
function validateAction(action: unknown): Action | null {
    if (!action || typeof action !== 'object') return null;

    const obj = action as Record<string, unknown>;
    const type = obj.type;

    // Strict type validation
    if (type === 'mkdir') {
        if (typeof obj.path !== 'string' || !obj.path) return null;
        // Block path traversal
        if (obj.path.includes('..') || obj.path.startsWith('/') || /^[A-Z]:/i.test(obj.path)) return null;
        return { type: 'mkdir', path: obj.path };
    }

    if (type === 'writeFile') {
        if (typeof obj.path !== 'string' || !obj.path) return null;
        if (typeof obj.content !== 'string') return null;
        // Block path traversal
        if (obj.path.includes('..') || obj.path.startsWith('/') || /^[A-Z]:/i.test(obj.path)) return null;
        return { type: 'writeFile', path: obj.path, content: obj.content };
    }

    if (type === 'deleteFile') {
        if (typeof obj.path !== 'string' || !obj.path) return null;
        if (obj.path.includes('..') || obj.path.startsWith('/') || /^[A-Z]:/i.test(obj.path)) return null;
        return { type: 'deleteFile', path: obj.path };
    }

    if (type === 'exec') {
        if (!Array.isArray(obj.argv) || obj.argv.length === 0) return null;
        // Validate all argv are strings
        if (!obj.argv.every((a: unknown) => typeof a === 'string')) return null;
        // Block dangerous commands
        const dangerous = ['sudo', 'su', 'rm -rf /', 'format', 'mkfs', 'dd', ':(){'];
        const cmdStr = obj.argv.join(' ').toLowerCase();
        if (dangerous.some(d => cmdStr.includes(d))) return null;
        return {
            type: 'exec',
            argv: obj.argv as string[],
            cwd: typeof obj.cwd === 'string' ? obj.cwd : undefined,
        };
    }

    if (type === 'generateImage') {
        if (typeof obj.prompt !== 'string' || !obj.prompt) return null;
        if (typeof obj.savePath !== 'string' || !obj.savePath) return null;
        // Block path traversal
        if (obj.savePath.includes('..') || obj.savePath.startsWith('/') || /^[A-Z]:/i.test(obj.savePath)) return null;
        const validStyles = ['realistic', 'artistic', 'minimal', 'tech'];
        const style = typeof obj.style === 'string' && validStyles.includes(obj.style)
            ? obj.style as 'realistic' | 'artistic' | 'minimal' | 'tech'
            : undefined;
        return { type: 'generateImage', prompt: obj.prompt, savePath: obj.savePath, style };
    }

    // Unknown action type
    return null;
}

/**
 * Parse action plan from model response with strict validation
 */
function debugWarn(message: string, error?: unknown) {
    if (process.env.AGDI_DEBUG === 'true') {
        console.warn(`[ActionPlan] ${message}`, error ?? '');
    }
}

export function parseActionPlan(response: string): ActionPlan | null {
    try {
        // Strip markdown code fences if present (handles ```json ... ``` wrapping)
        let cleanedResponse = response;

        // Pattern 1: ```json { ... } ```
        const fenceMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) {
            cleanedResponse = fenceMatch[1].trim();
        }

        // Find JSON object in response (greedy match for outermost braces)
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*"actions"[\s\S]*\}/);
        if (!jsonMatch) {
            return null;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Validate structure
        if (!parsed.actions || !Array.isArray(parsed.actions)) {
            return null;
        }

        // Validate each action strictly
        const validatedActions: Action[] = [];
        for (const action of parsed.actions) {
            const validated = validateAction(action);
            if (!validated) {
                console.warn(`Invalid action rejected: ${JSON.stringify(action).slice(0, 100)}`);
                continue; // Skip invalid actions
            }
            validatedActions.push(validated);
        }

        if (validatedActions.length === 0) {
            return null;
        }

        // Sanitize projectName
        const projectName = typeof parsed.projectName === 'string'
            ? parsed.projectName.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 50)
            : 'generated-app';

        return {
            projectName,
            actions: validatedActions,
            nextSteps: typeof parsed.nextSteps === 'string' ? parsed.nextSteps : undefined,
        };
    } catch (error) {
        debugWarn('Failed to parse action plan JSON', error);
        return null;
    }
}

