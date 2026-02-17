/**
 * MCP Tool Registry - Model Context Protocol tool management
 * 
 * Provides a unified interface for LLM-callable tools.
 * Inspired by Anthropic's MCP specification.
 */

// ==================== TYPES ====================

export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required?: boolean;
    default?: unknown;
}

export interface ToolDefinition {
    name: string;
    description: string;
    category: 'filesystem' | 'git' | 'web' | 'code' | 'system';
    parameters: ToolParameter[];
    execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
    exitCode?: number;
    duration?: number;
    metadata?: Record<string, unknown>;
}

export interface ToolCall {
    tool: string;
    params: Record<string, unknown>;
    timeout?: number;
}

// ==================== TOOL REGISTRY ====================

const tools = new Map<string, ToolDefinition>();

function debugWarn(message: string, error?: unknown) {
    if (process.env.AGDI_DEBUG === 'true') {
        console.warn(`[MCP] ${message}`, error ?? '');
    }
}

/**
 * Register a tool
 */
export function registerTool(tool: ToolDefinition): void {
    tools.set(tool.name, tool);
}

/**
 * Get a tool by name
 */
export function getTool(name: string): ToolDefinition | undefined {
    return tools.get(name);
}

/**
 * List all registered tools
 */
export function listTools(): ToolDefinition[] {
    return Array.from(tools.values());
}

/**
 * List tools by category
 */
export function listToolsByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return listTools().filter(t => t.category === category);
}

/**
 * Execute a tool call
 */
export async function executeTool(call: ToolCall): Promise<ToolResult> {
    const tool = getTool(call.tool);

    if (!tool) {
        return {
            success: false,
            output: '',
            error: `Tool not found: ${call.tool}`,
        };
    }

    // Validate required parameters
    for (const param of tool.parameters) {
        if (param.required && !(param.name in call.params)) {
            return {
                success: false,
                output: '',
                error: `Missing required parameter: ${param.name}`,
            };
        }
    }

    try {
        const result = await tool.execute(call.params);
        return result;
    } catch (error) {
        debugWarn(`Tool execution failed: ${call.tool}`, error);
        return {
            success: false,
            output: '',
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Generate tool descriptions for LLM context
 */
export function getToolDescriptions(): string {
    const toolList = listTools();

    if (toolList.length === 0) {
        return '';
    }

    const parts: string[] = ['Available Tools:'];

    for (const tool of toolList) {
        parts.push(`\n- ${tool.name}: ${tool.description}`);
        if (tool.parameters.length > 0) {
            const params = tool.parameters.map(p =>
                `${p.name}${p.required ? '' : '?'}: ${p.type}`
            ).join(', ');
            parts.push(`  Params: (${params})`);
        }
    }

    parts.push('\nTo use a tool, respond with: <tool name="TOOL_NAME" param1="value1" />\n');

    return parts.join('\n');
}

/**
 * Parse tool calls from LLM response
 */
export function parseToolCalls(response: string): ToolCall[] {
    const calls: ToolCall[] = [];

    // Match <tool name="X" ... /> pattern
    const toolRegex = /<tool\s+name="([^"]+)"([^/]*)\/?>/g;

    let match;
    while ((match = toolRegex.exec(response)) !== null) {
        const name = match[1];
        const paramsStr = match[2];

        // Parse parameters
        const params: Record<string, unknown> = {};
        const paramRegex = /(\w+)="([^"]*)"/g;

        let paramMatch;
        while ((paramMatch = paramRegex.exec(paramsStr)) !== null) {
            const key = paramMatch[1];
            const value = paramMatch[2];

            // Try to parse as number or boolean
            if (value === 'true') params[key] = true;
            else if (value === 'false') params[key] = false;
            else if (/^\d+$/.test(value)) params[key] = parseInt(value, 10);
            else if (/^\d+\.\d+$/.test(value)) params[key] = parseFloat(value);
            else params[key] = value;
        }

        calls.push({ tool: name, params });
    }

    return calls;
}

// ==================== BUILT-IN TOOLS ====================

// Read file tool
registerTool({
    name: 'read_file',
    description: 'Read the contents of a file',
    category: 'filesystem',
    parameters: [
        { name: 'path', type: 'string', description: 'File path to read', required: true },
    ],
    execute: async (params) => {
        const { readFileSync } = await import('fs');
        const { resolve } = await import('path');

        try {
            const filePath = resolve(process.cwd(), params.path as string);
            if (!filePath.startsWith(process.cwd())) {
                return { success: false, output: '', error: 'Path outside workspace' };
            }
            const content = readFileSync(filePath, 'utf-8');
            return {
                success: true,
                output: content,
                metadata: {
                    lines: content.split('\n').length,
                    path: params.path,
                },
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: `Failed to read file: ${error}`,
            };
        }
    },
});

// List directory tool
registerTool({
    name: 'list_dir',
    description: 'List files in a directory',
    category: 'filesystem',
    parameters: [
        { name: 'path', type: 'string', description: 'Directory path', required: false, default: '.' },
    ],
    execute: async (params) => {
        const { readdirSync, statSync } = await import('fs');
        const { resolve, join } = await import('path');

        try {
            const dirPath = resolve(process.cwd(), (params.path as string) || '.');
            if (!dirPath.startsWith(process.cwd())) {
                return { success: false, output: '', error: 'Path outside workspace' };
            }
            const entries = readdirSync(dirPath);

            const files: string[] = [];
            const dirs: string[] = [];

            for (const entry of entries) {
                try {
                    const stat = statSync(join(dirPath, entry));
                    if (stat.isDirectory()) {
                        dirs.push(entry + '/');
                    } else {
                        files.push(entry);
                    }
                } catch (error) {
                    debugWarn(`Failed to stat entry in list_dir: ${entry}`, error);
                    files.push(entry);
                }
            }

            return {
                success: true,
                output: [...dirs, ...files].join('\n'),
                metadata: { dirs, files },
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: `Failed to list directory: ${error}`,
            };
        }
    },
});

// Search code tool (uses RAG)
registerTool({
    name: 'search_code',
    description: 'Search for code in the current project',
    category: 'code',
    parameters: [
        { name: 'query', type: 'string', description: 'Search query', required: true },
        { name: 'limit', type: 'number', description: 'Max results', required: false, default: 5 },
    ],
    execute: async (params) => {
        const { searchCodebase } = await import('../rag/index.js');

        const results = searchCodebase(
            process.cwd(),
            params.query as string,
            { limit: (params.limit as number) || 5 }
        );

        if (results.length === 0) {
            return {
                success: true,
                output: 'No results found',
                metadata: { results: [] },
            };
        }

        const output = results.map(r =>
            `${r.chunk.relativePath}:${r.chunk.startLine} (score: ${r.score.toFixed(2)})`
        ).join('\n');

        return {
            success: true,
            output,
            metadata: {
                results: results.map(r => ({
                    file: r.chunk.relativePath,
                    line: r.chunk.startLine,
                    content: r.chunk.content.slice(0, 200),
                })),
            },
        };
    },
});

// Run command tool
registerTool({
    name: 'run_command',
    description: 'Run a shell command (requires user approval)',
    category: 'system',
    parameters: [
        { name: 'command', type: 'string', description: 'Command to run', required: true },
    ],
    execute: async (params) => {
        // This is a placeholder - actual execution requires permission gate
        return {
            success: false,
            output: '',
            error: 'Shell commands require explicit user approval. Use /build or /exec instead.',
        };
    },
});
