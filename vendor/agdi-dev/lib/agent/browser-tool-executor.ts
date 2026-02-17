/**
 * Browser Tool Executor
 * 
 * A browser-compatible tool executor that uses WebContainerService
 * instead of Node.js child_process for command execution.
 */

import type {
    ToolType,
    ToolCall,
    ToolResult,
    AgentConfig,
} from './types';
import { DEFAULT_AGENT_CONFIG } from './types';
import { WebContainerService } from '../webcontainer';
import { permissionManager, auditLogger } from '../security';
import { workspaceSession, listDir, readFile as wsReadFile, writeFile as wsWriteFile, setWebContainer, searchFiles } from '../workspace';
import { getAPIKey } from '../../components/APIKeySettings';

// ==================== EVENT TYPES ====================

export type ToolEventType = 'start' | 'output' | 'error' | 'complete' | 'permission_required';

export interface ToolEvent {
    type: ToolEventType;
    tool: ToolType;
    message: string;
    timestamp: number;
    permissionResult?: import('../security').PermissionResult;
}

export type ToolEventHandler = (event: ToolEvent) => void;

// Permission callback for UI integration
type PermissionCallback = (result: import('../security').PermissionResult) => Promise<boolean>;

// ==================== BROWSER TOOL EXECUTOR ====================

export class BrowserToolExecutor {
    private config: AgentConfig;
    private executionLog: Array<{ call: ToolCall; result: ToolResult; timestamp: number }> = [];
    private eventHandlers: ToolEventHandler[] = [];
    private fileSystem: Map<string, string> = new Map();
    private permissionCallback: PermissionCallback | null = null;
    // workspaceCwd now comes from WorkspaceSession
    private get workspaceCwd(): string {
        return workspaceSession.getCwd();
    }

    constructor(config: Partial<AgentConfig> = {}) {
        this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    }

    /**
     * Set permission callback for UI integration
     */
    setPermissionCallback(callback: PermissionCallback): void {
        this.permissionCallback = callback;
    }

    /**
     * Initialize workspace with a root path
     */
    initializeWorkspace(rootPath: string): void {
        // Default to pending; trust should be explicitly granted
        workspaceSession.initialize(rootPath, 'pending');
    }

    /**
     * Change workspace cwd (legacy compatibility)
     */
    setWorkspaceCwd(cwd: string): void {
        workspaceSession.changeCwd(cwd);
    }

    /**
     * Subscribe to tool execution events
     */
    onEvent(handler: ToolEventHandler): void {
        this.eventHandlers.push(handler);
    }

    /**
     * Emit a tool event
     */
    private emit(type: ToolEventType, tool: ToolType, message: string, permissionResult?: import('../security').PermissionResult): void {
        const event: ToolEvent = {
            type,
            tool,
            message,
            timestamp: Date.now(),
            permissionResult,
        };
        this.eventHandlers.forEach(handler => {
            try {
                handler(event);
            } catch (e) {
                console.error('Tool event handler error:', e);
            }
        });
    }

    /**
     * Execute a tool call
     */
    async execute(call: ToolCall): Promise<ToolResult> {
        const startTime = Date.now();
        this.emit('start', call.tool, `Executing ${call.tool}...`);

        let result: ToolResult;

        try {
            switch (call.tool) {
                case 'shell':
                    result = await this.runShell(
                        call.params.command as string
                    );
                    break;

                case 'file_read':
                    result = await this.readFile(call.params.path as string);
                    break;

                case 'file_write':
                    result = await this.writeFile(
                        call.params.path as string,
                        call.params.content as string
                    );
                    break;

                case 'npm_install':
                    result = await this.npmInstall(
                        call.params.packages as string[] | undefined
                    );
                    break;

                case 'npm_build':
                    result = await this.npmBuild();
                    break;

                case 'npm_test':
                    result = await this.npmTest();
                    break;

                case 'npm_dev':
                    result = await this.npmDev();
                    break;

                case 'lint':
                    result = await this.runLint();
                    break;

                // ===== NEW WORKSPACE TOOLS =====
                case 'list_dir':
                    result = await this.listDirectory(call.params.path as string || '.');
                    break;

                case 'get_cwd':
                    result = {
                        success: true,
                        output: workspaceSession.getCwd(),
                        duration: Date.now() - startTime,
                    };
                    break;

                case 'change_dir':
                    result = await this.changeDirectory(call.params.path as string);
                    break;

                case 'search_files':
                    result = await this.searchFilesInWorkspace(call.params.pattern as string);
                    break;

                case 'web_search':
                    result = await this.webSearch(call.params.query as string);
                    break;

                default:
                    result = {
                        success: false,
                        output: '',
                        error: `Unknown tool: ${call.tool}`,
                        duration: Date.now() - startTime,
                    };
            }
        } catch (error) {
            result = {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime,
            };
            this.emit('error', call.tool, result.error || 'Unknown error');
        }

        // Log execution
        this.executionLog.push({
            call,
            result,
            timestamp: Date.now(),
        });

        this.emit(
            result.success ? 'complete' : 'error',
            call.tool,
            result.success ? result.output.substring(0, 100) : (result.error || 'Failed')
        );

        return result;
    }

    /**
     * Run a shell command in WebContainer
     * NOW WITH PERMISSION CHECKING
     */
    private async runShell(command: string): Promise<ToolResult> {
        const startTime = Date.now();

        // ==================== PERMISSION CHECK ====================
        const permResult = permissionManager.evaluate(command, this.workspaceCwd);

        if (!permResult.argv || permResult.argv.length === 0) {
            return {
                success: false,
                output: '',
                error: 'Failed to parse command',
                duration: Date.now() - startTime,
            };
        }

        if (permResult.decision === 'deny') {
            auditLogger.logResult(command, permResult.argv, false, Date.now() - startTime, '', 'Blocked by permission policy');
            return {
                success: false,
                output: '',
                error: `Command blocked: ${permResult.reason}`,
                duration: Date.now() - startTime,
            };
        }

        if (permResult.decision === 'prompt') {
            // Emit permission event for UI
            this.emit('permission_required', 'shell', command, permResult);

            // If callback is set, wait for user decision
            if (this.permissionCallback) {
                const approved = await this.permissionCallback(permResult);
                if (!approved) {
                    auditLogger.logResult(command, permResult.argv, false, Date.now() - startTime, '', 'Denied by user');
                    return {
                        success: false,
                        output: '',
                        error: 'Command denied by user',
                        duration: Date.now() - startTime,
                    };
                }
            } else {
                // No callback - deny by default for safety
                auditLogger.logResult(command, permResult.argv, false, Date.now() - startTime, '', 'No permission callback configured');
                return {
                    success: false,
                    output: '',
                    error: 'Permission required but no approval mechanism configured',
                    duration: Date.now() - startTime,
                };
            }
        }

        // ==================== EXECUTE COMMAND ====================
        try {
            const container = await WebContainerService.boot();

            // Parse command into args (use parsed argv from permission check)
            const cmd = permResult.argv[0];
            const args = permResult.argv.slice(1);

            this.emit('output', 'shell', `$ ${command}`);

            const process = await container.spawn(cmd, args);

            let output = '';
            process.output.pipeTo(
                new WritableStream({
                    write: (data) => {
                        output += data;
                        this.emit('output', 'shell', data);
                    },
                })
            );

            const exitCode = await process.exit;

            // Log result
            auditLogger.logResult(command, permResult.argv, exitCode === 0, Date.now() - startTime, output);

            return {
                success: exitCode === 0,
                output,
                exitCode,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            auditLogger.logResult(command, permResult.argv, false, Date.now() - startTime, '', errorMsg);

            return {
                success: false,
                output: '',
                error: errorMsg,
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Read file from virtual file system
     */
    private async readFile(path: string): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            const container = await WebContainerService.boot();
            const content = await container.fs.readFile(path, 'utf-8');

            return {
                success: true,
                output: content,
                duration: Date.now() - startTime,
                metadata: { path, size: content.length },
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'Failed to read file',
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Write file to WebContainer
     */
    private async writeFile(path: string, content: string): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            const container = await WebContainerService.boot();

            // Ensure directory exists
            const dir = path.split('/').slice(0, -1).join('/');
            if (dir) {
                try {
                    await container.fs.mkdir(dir, { recursive: true });
                } catch {
                    // Directory might already exist
                }
            }

            await container.fs.writeFile(path, content);
            this.fileSystem.set(path, content);

            this.emit('output', 'file_write', `Written ${content.length} bytes to ${path}`);

            return {
                success: true,
                output: `Written ${content.length} bytes to ${path}`,
                duration: Date.now() - startTime,
                metadata: { path, size: content.length },
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'Failed to write file',
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Run npm install
     */
    private async npmInstall(packages?: string[]): Promise<ToolResult> {
        const args = packages && packages.length > 0
            ? ['install', ...packages]
            : ['install'];

        this.emit('output', 'npm_install', `npm ${args.join(' ')}`);

        const startTime = Date.now();

        try {
            const exitCode = await WebContainerService.installDependencies(
                (log) => this.emit('output', 'npm_install', log)
            );

            return {
                success: exitCode === 0,
                output: exitCode === 0 ? 'Dependencies installed successfully' : 'npm install failed',
                exitCode,
                duration: Date.now() - startTime,
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'npm install failed',
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Run npm build
     */
    private async npmBuild(): Promise<ToolResult> {
        return this.runShell('npm run build');
    }

    /**
     * Run npm test
     */
    private async npmTest(): Promise<ToolResult> {
        return this.runShell('npm test');
    }

    /**
     * Start npm dev server
     */
    private async npmDev(): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            const url = await WebContainerService.startDevServer(
                (log) => this.emit('output', 'npm_dev', log)
            );

            return {
                success: true,
                output: `Dev server running at ${url}`,
                duration: Date.now() - startTime,
                metadata: { url },
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'Failed to start dev server',
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Run linter
     */
    private async runLint(): Promise<ToolResult> {
        return this.runShell('npm run lint');
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
     * Get virtual file system
     */
    getFileSystem(): Map<string, string> {
        return new Map(this.fileSystem);
    }

    // ==================== NEW WORKSPACE TOOLS ====================

    /**
     * List directory contents
     */
    private async listDirectory(path: string): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            const result = await listDir(path);

            if (!result.success) {
                return {
                    success: false,
                    output: '',
                    error: result.error || 'Failed to list directory',
                    duration: Date.now() - startTime,
                };
            }

            // Format output like ls
            const output = result.entries
                .map(e => `${e.type === 'directory' ? 'd' : '-'} ${e.name}`)
                .join('\n');

            return {
                success: true,
                output: output || '(empty directory)',
                duration: Date.now() - startTime,
                metadata: {
                    path: result.path,
                    count: result.entries.length,
                    entries: result.entries,
                },
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'List directory failed',
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Change directory with validation
     */
    private async changeDirectory(path: string): Promise<ToolResult> {
        const startTime = Date.now();

        const result = workspaceSession.changeCwd(path);

        if (!result.success) {
            // Log attempt
            auditLogger.log({
                type: 'tool_denied',
                command: `cd ${path}`,
                decision: 'deny',
                metadata: { error: result.error },
            });

            return {
                success: false,
                output: '',
                error: result.error || 'Cannot change to that directory',
                duration: Date.now() - startTime,
            };
        }

        this.emit('output', 'change_dir', `Changed directory: ${result.oldCwd} → ${result.newCwd}`);

        return {
            success: true,
            output: `Changed to: ${result.newCwd}`,
            duration: Date.now() - startTime,
            metadata: {
                oldCwd: result.oldCwd,
                newCwd: result.newCwd,
            },
        };
    }

    /**
     * Search files in workspace
     */
    private async searchFilesInWorkspace(pattern: string): Promise<ToolResult> {
        const startTime = Date.now();

        try {
            const results = await searchFiles(pattern);

            const output = results.length > 0
                ? results.map(e => e.path).join('\n')
                : 'No files found';

            return {
                success: true,
                output,
                duration: Date.now() - startTime,
                metadata: { count: results.length, pattern },
            };
        } catch (error) {
            return {
                success: false,
                output: '',
                error: error instanceof Error ? error.message : 'Search failed',
                duration: Date.now() - startTime,
            };
        }
    }

    /**
     * Search the web using Brave Search API
     */
    private async webSearch(query: string): Promise<ToolResult> {
        const startTime = Date.now();
        const apiKey = getAPIKey('bravesearch');

        if (!apiKey) {
            return {
                success: false,
                output: '',
                error: 'Web Search requires a Brave Search API key. Please configure it in Settings.',
                duration: Date.now() - startTime,
            };
        }
        
        try {
            this.emit('output', 'web_search', `Searching Brave for: "${query}"...`);

            const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip',
                    'X-Subscription-Token': apiKey
                }
            });

            if (!response.ok) {
                if (response.status === 401) throw new Error('Invalid Brave Search API key');
                if (response.status === 429) throw new Error('Brave Search rate limit exceeded');
                throw new Error(`Brave Search API failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            // Format results for the LLM
            const results = data.web?.results?.map((r: any) => 
                `[${r.title}](${r.url})\n${r.description}`
            ).join('\n\n') || 'No results found.';

            const output = `### Web Search Results for "${query}"\n\n${results}`;

            return {
                success: true,
                output,
                duration: Date.now() - startTime,
                metadata: { query, count: data.web?.results?.length || 0 }
            };

        } catch (error) {
             const errorMsg = error instanceof Error ? error.message : String(error);
             return {
                success: false,
                output: '',
                error: errorMsg,
                duration: Date.now() - startTime,
            };
        }
    }
}

// Export singleton
export const browserToolExecutor = new BrowserToolExecutor();
