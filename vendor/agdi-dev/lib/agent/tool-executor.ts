/**
 * Tool Executor (Browser-Safe Stub)
 * 
 * This is a browser-safe version that provides stub implementations.
 * For actual execution in the browser, use browser-tool-executor.ts instead.
 */

import type {
    ToolType,
    ToolCall,
    ToolResult,
    AgentConfig,
} from './types';
import { DEFAULT_AGENT_CONFIG } from './types';

// ==================== TOOL EXECUTOR CLASS ====================

export class ToolExecutor {
    private config: AgentConfig;
    private executionLog: Array<{ call: ToolCall; result: ToolResult; timestamp: number }> = [];

    constructor(config: Partial<AgentConfig> = {}) {
        this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    }

    /**
     * Execute a tool call and return the result
     * In browser, this returns a stub result directing to use BrowserToolExecutor
     */
    async execute(call: ToolCall): Promise<ToolResult> {
        const startTime = Date.now();

        // Browser stub - returns message to use BrowserToolExecutor
        const result: ToolResult = {
            success: false,
            output: '',
            error: `Tool "${call.tool}" requires BrowserToolExecutor in browser environment`,
            duration: Date.now() - startTime,
        };

        // Log execution
        this.executionLog.push({
            call,
            result,
            timestamp: Date.now(),
        });

        return result;
    }

    /**
     * Get execution log
     */
    getExecutionLog() {
        return [...this.executionLog];
    }

    /**
     * Clear execution log
     */
    clearExecutionLog() {
        this.executionLog = [];
    }

    /**
     * Get available tools
     */
    static getAvailableTools(): ToolType[] {
        return [
            'shell',
            'file_read',
            'file_write',
            'file_delete',
            'npm_install',
            'npm_build',
            'npm_test',
            'npm_dev',
            'lint',
            'search_files',
            'search_code',
            'web_search',
        ];
    }

    /**
     * Get tool description for LLM context
     */
    static getToolDescriptions(): Record<ToolType, string> {
        return {
            shell: 'Execute a shell command. Params: { command: string, cwd?: string }',
            file_read: 'Read file contents. Params: { path: string }',
            file_write: 'Write content to file. Params: { path: string, content: string }',
            file_delete: 'Delete a file. Params: { path: string }',
            npm_install: 'Install npm packages. Params: { cwd?: string, packages?: string[] }',
            npm_build: 'Run npm build. Params: { cwd?: string }',
            npm_test: 'Run npm test. Params: { cwd?: string }',
            npm_dev: 'Start dev server. Params: { cwd?: string }',
            lint: 'Run linter. Params: { cwd?: string }',
            search_files: 'Search files by glob pattern. Params: { pattern: string, cwd?: string }',
            search_code: 'Search code for pattern. Params: { query: string, cwd?: string }',
            web_search: 'Search the web for documentation or solutions. Params: { query: string }',
            llm_call: 'Call LLM for reasoning. Params: { prompt: string, systemPrompt?: string }',
            generate_code: 'Generate code using AI. Params: { description: string, language?: string }',
            list_dir: 'List directory contents. Params: { path: string }',
            get_cwd: 'Get current working directory. Params: {}',
            change_dir: 'Change current directory. Params: { path: string }',
        };
    }
}

// Export singleton for convenience
export const toolExecutor = new ToolExecutor();
