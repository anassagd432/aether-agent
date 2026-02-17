/**
 * Agdi dev Mode - Default coding assistant
 * AI-powered coding mode with Action Plan execution
 * 
 * v2.4.0 - Conversation Memory update
 */

import { input, confirm, editor } from '@inquirer/prompts';
import chalk from 'chalk';
import { ui } from '../utils/ui.js';
import { createLLMProvider, ProjectManager, generateApp, type LLMProviderType } from '../core/index.js';
import { loadConfig } from '../utils/config.js';
import { writeProject } from '../utils/fs.js';
import { getActiveProvider, selectModel, PROVIDER_MODELS, type ProviderType } from './onboarding.js';
import { parseAndExecutePlan } from '../actions/plan-executor.js';
import { initSession, getEnvironment } from '../security/execution-env.js';
import { ensureTrusted } from '../security/workspace-trust.js';
import { logSessionStart, logSessionEnd } from '../security/audit-logger.js';
import { buildWorkspaceContext, formatContextForPrompt } from '../core/context-manager.js';
import { getStatus, getDiff, formatStatusForPrompt, formatDiffForPrompt, isGitRepo } from '../core/git-manager.js';
import { ConversationManager, getConversation, clearConversation } from '../core/conversation-manager.js';
import { handleFileEdit } from '../core/file-editor.js';
import { indexProject, loadIndex, isIndexStale, searchCodebase, getRelevantContext } from '../core/rag/index.js';
import { listTools, getToolDescriptions } from '../core/mcp/index.js';
import { runMultiAgentPipeline } from '../agents/index.js';
import { buildMemoryContext, getMemoryStats } from '../core/memory-store.js';
import { optimizePrompt } from '../core/token-optimizer.js';

// ==================== HELPERS ====================

/**
 * Multi-line input - allows pasting long prompts
 * Press Enter on empty line to submit
 */
async function collectMultiLineInput(message: string): Promise<string> {
    console.log(chalk.cyan.bold(message) + chalk.gray(' (paste text, press Enter on empty line to submit)'));

    const lines: string[] = [];

    while (true) {
        const line = await input({ message: chalk.gray('│ ') });

        // Empty line = submit (or first line is command)
        if (line.trim() === '') {
            if (lines.length > 0) break;
            continue; // Skip empty first lines
        }

        lines.push(line);

        // If first line is a slash command, submit immediately
        if (lines.length === 1 && line.trim().startsWith('/')) {
            break;
        }
    }

    return lines.join('\n').trim();
}

// ==================== STATE ====================

let multiAgentMode = false;

// ==================== SYSTEM PROMPTS ====================

const BASE_CHAT_PROMPT = `You are Agdi dev, an elite AI coding assistant. You help developers write code, debug issues, and build applications.

## Your Capabilities
- Write complete, production-ready code
- Debug and fix code issues  
- Explain code and architecture
- Answer coding questions
- Analyze git status and diffs
- Generate meaningful commit messages

## Response Style
- Be concise and direct
- Show code in proper markdown blocks
- Explain complex decisions briefly
- Ask clarifying questions when needed

## Code Quality
- Use TypeScript by default
- Follow modern best practices
- Include proper error handling
- Write self-documenting code`;

/**
 * Build context-aware system prompt
 */
function buildContextAwarePrompt(): string {
    const context = buildWorkspaceContext();
    const gitStatus = getStatus();
    context.gitStatus = formatStatusForPrompt(gitStatus);

    const contextSection = formatContextForPrompt(context);

    return `${BASE_CHAT_PROMPT}\n\n---\n\n${contextSection}`;
}

const BUILD_SYSTEM_PROMPT = `You are Agdi dev, an AI coding assistant that generates applications.

## CRITICAL: Output Format
When the user asks to build an app, do NOT print file contents in markdown blocks.

Instead, output a single JSON object with this exact structure:
{
  "projectName": "my-app",
  "actions": [
    { "type": "mkdir", "path": "src" },
    { "type": "writeFile", "path": "package.json", "content": "{...}" },
    { "type": "writeFile", "path": "src/index.ts", "content": "..." },
    { "type": "exec", "argv": ["pnpm", "install"], "cwd": "." },
    { "type": "exec", "argv": ["pnpm", "dev"], "cwd": "." }
  ],
  "nextSteps": "Open http://localhost:3000 to see your app"
}

## Action Types
- mkdir: { type: "mkdir", path: "relative/path" }
- writeFile: { type: "writeFile", path: "relative/path/file.ts", content: "file contents" }
- deleteFile: { type: "deleteFile", path: "relative/path/file.ts" }
- exec: { type: "exec", argv: ["command", "arg1", "arg2"], cwd: "." }

## Rules
1. All paths MUST be relative to workspace root (no leading /)
2. Use pnpm as package manager
3. Include exec steps for install/dev only if user requests running the app
4. Keep actions minimal (no redundant writes)
5. Create complete, production-ready code
6. Use TypeScript by default
7. Include proper error handling
8. For images, use placeholder URLs or instruct user to add images later
9. Output ONLY the JSON object, no extra text`;

// ==================== MAIN ENTRY ====================

export async function startCodingMode(): Promise<void> {
    const activeConfig = getActiveProvider();

    if (!activeConfig) {
        console.log(chalk.red('❌ No API key configured. Run: agdi'));
        return;
    }

    const { provider, apiKey, model } = activeConfig;
    const config = loadConfig();

    // Initialize session with environment detection
    const env = initSession();

    // Note: Banner is shown in index.ts, session info box shown after trust prompt

    // Check and prompt for workspace trust if needed
    const isTrusted = await ensureTrusted(env.workspaceRoot);
    if (!isTrusted) {
        // User declined trust - exit
        ui.safeExit(0);
    }

    // Log session start
    logSessionStart(env.workspaceRoot, env.trustLevel);

    // Display session info
    ui.renderBox(
        'SESSION INFO',
        `Model:     ${chalk.cyan(model)}\nWorkspace: ${chalk.cyan(env.workspaceRoot)}\nContext:   ${isGitRepo() ? chalk.green('Git Repository') : chalk.gray('Local Folder')}`,
        'info'
    );

    console.log(chalk.gray('Commands: /status, /diff, /commit, /build, /help...'));
    ui.printIter();

    const pm = new ProjectManager();
    let llm = createLLMProvider(provider as LLMProviderType, { apiKey, model });

    // Initialize conversation with context-aware system prompt
    const conversation = getConversation();
    conversation.setSystemPrompt(buildContextAwarePrompt());

    // Main coding loop
    while (true) {
        try {
            const userInput = await collectMultiLineInput('👤 YOU ›');

            const trimmed = userInput.trim().toLowerCase();

            // Handle commands
            if (trimmed === '/exit' || trimmed === 'exit' || trimmed === 'quit') {
                logSessionEnd();
                console.log(chalk.gray('\n👋 Goodbye!\n'));
                break;
            }

            if (trimmed === '/help') {
                showHelp();
                continue;
            }

            if (trimmed === '/model' || trimmed === '/models') {
                await selectModel();
                // Refresh the LLM with new model
                const newConfig = getActiveProvider();
                if (newConfig) {
                    llm = createLLMProvider(newConfig.provider as LLMProviderType, {
                        apiKey: newConfig.apiKey,
                        model: newConfig.model,
                    });
                    console.log(chalk.gray(`Now using: ${chalk.cyan(newConfig.model)}\n`));
                }
                continue;
            }

            if (trimmed === '/chat') {
                console.log(chalk.gray('\nSwitching to chat mode. Type /code to return.\n'));
                await chatMode(llm);
                continue;
            }

            // ==================== CONVERSATION COMMANDS ====================

            if (trimmed === '/clear') {
                clearConversation();
                conversation.setSystemPrompt(buildContextAwarePrompt());
                console.log(chalk.green('\n✓ Conversation cleared.\n'));
                continue;
            }

            if (trimmed === '/history') {
                const messages = conversation.getMessages();
                if (messages.length === 0) {
                    console.log(chalk.gray('\n(no conversation history)\n'));
                } else {
                    console.log(chalk.cyan.bold('\n📜 Conversation History\n'));
                    console.log(chalk.gray(conversation.getSummary()));
                    console.log('');
                    for (const msg of messages.slice(-6)) {
                        const role = msg.role === 'user' ? chalk.green('You') : chalk.cyan('AI');
                        const preview = msg.content.slice(0, 80) + (msg.content.length > 80 ? '...' : '');
                        console.log(`  ${role}: ${chalk.gray(preview)}`);
                    }
                    console.log('');
                }
                continue;
            }

            // ==================== GIT COMMANDS ====================

            if (trimmed === '/status') {
                await handleGitStatus(llm);
                continue;
            }

            if (trimmed === '/diff') {
                await handleGitDiff(llm);
                continue;
            }

            if (trimmed === '/commit') {
                await handleGitCommit(llm);
                continue;
            }

            // ==================== EDIT COMMANDS ====================

            if (trimmed.startsWith('/edit ')) {
                const filePath = userInput.slice(6).trim();
                if (filePath) {
                    await handleFileEdit(filePath, llm);
                } else {
                    console.log(chalk.yellow('\nUsage: /edit <file>\n'));
                }
                continue;
            }

            // ==================== RAG COMMANDS ====================

            if (trimmed === '/index') {
                const spinner = ui.createSpinner('Indexing project...').start();
                try {
                    const index = indexProject(process.cwd());
                    spinner.succeed(`Indexed ${index.fileCount} files, ${index.chunkCount} chunks`);
                } catch (error) {
                    spinner.fail('Indexing failed: ' + (error instanceof Error ? error.message : String(error)));
                }
                continue;
            }

            if (trimmed.startsWith('/search ')) {
                const query = userInput.slice(8).trim();
                if (!query) {
                    console.log(chalk.yellow('\nUsage: /search <query>\n'));
                    continue;
                }
                const results = searchCodebase(process.cwd(), query, { limit: 8 });
                if (results.length === 0) {
                    console.log(chalk.gray('\nNo results found. Try /index first.\n'));
                } else {
                    console.log(chalk.cyan.bold('\n🔍 Search Results\n'));
                    for (const r of results) {
                        console.log(chalk.green(`  ${r.chunk.relativePath}:${r.chunk.startLine}`) + chalk.gray(` (${r.score.toFixed(2)})`));
                        if (r.highlights.length > 0) {
                            console.log(chalk.gray(`    ${r.highlights[0].slice(0, 60)}...`));
                        }
                    }
                    console.log('');
                }
                continue;
            }

            // ==================== MCP COMMANDS ====================

            if (trimmed === '/tools') {
                const tools = listTools();
                console.log(chalk.cyan.bold('\n🔧 Available Tools\n'));
                for (const tool of tools) {
                    console.log(chalk.green(`  ${tool.name}`) + chalk.gray(` [${tool.category}]`));
                    console.log(chalk.gray(`    ${tool.description}`));
                }
                console.log('');
                continue;
            }

            // ==================== AGENT COMMANDS ====================

            if (trimmed === '/agent') {
                multiAgentMode = !multiAgentMode;
                console.log(chalk.cyan(`\n🤖 Multi-agent mode: ${multiAgentMode ? chalk.green('ON') : chalk.gray('OFF')}\n`));
                if (multiAgentMode) {
                    console.log(chalk.gray('  Planner → Coder → Reviewer pipeline enabled\n'));
                }
                continue;
            }

            // ==================== MEMORY COMMANDS ====================

            if (trimmed === '/memory') {
                const stats = getMemoryStats();
                console.log(chalk.cyan.bold('\n🧠 Memory Stats\n'));
                console.log(chalk.gray(`  Total entries: ${stats.totalEntries}`));
                console.log(chalk.gray(`  Projects: ${stats.projectCount}`));
                console.log(chalk.gray(`  Preferences: ${stats.preferenceCount}`));
                for (const [type, count] of Object.entries(stats.byType)) {
                    console.log(chalk.gray(`  ${type}: ${count}`));
                }
                console.log('');
                continue;
            }

            // ==================== BUILD COMMANDS ====================

            if (trimmed.startsWith('/build ') || trimmed.startsWith('build ')) {
                const prompt = userInput.replace(/^\/?build\s+/i, '').trim();
                if (prompt) {
                    await buildAppWithPlan(prompt, llm);
                } else {
                    console.log(chalk.yellow('\nUsage: /build <description>\n'));
                }
                continue;
            }

            if (!userInput.trim()) {
                continue;
            }

            // Auto-detect if user wants to CREATE something (route to buildApp)
            const isGenerationRequest = /^(create|build|make|generate|design|implement)\s+(me\s+)?(a\s+|an\s+)?/i.test(userInput.trim());

            if (isGenerationRequest) {
                // User wants to create something - use action plan
                await buildAppWithPlan(userInput, llm);
                continue;
            }

            // Default: Chat/answer questions (no file creation)
            const spinner = ui.createSpinner('Thinking...').start();

            try {
                // Add user message to conversation
                conversation.addUserMessage(userInput);

                // Use multi-turn chat if available, otherwise fallback to generate
                let response;
                if (llm.chat) {
                    response = await llm.chat(conversation.getMessagesForAPI());
                } else {
                    const contextPrompt = buildContextAwarePrompt();
                    response = await llm.generate(userInput, contextPrompt);
                }

                // Add assistant response to conversation
                conversation.addAssistantMessage(response.text);

                spinner.stop();
                ui.printAIMessage(formatResponse(response.text));

            } catch (error) {
                spinner.fail('Error');
                handleError(error);
            }

        } catch (error) {
            // Handle Ctrl+C
            if ((error as Error).name === 'ExitPromptError') {
                logSessionEnd();
                console.log(chalk.gray('\n\n👋 Goodbye!\n'));
                ui.safeExit(0);
            }
            throw error;
        }
    }
}

// ==================== BUILD WITH ACTION PLAN ====================

/**
 * Build an application using Action Plan executor
 */
async function buildAppWithPlan(prompt: string, llm: ReturnType<typeof createLLMProvider>): Promise<void> {
    const spinner = ui.createSpinner('Generating action plan...').start();

    try {
        // Generate action plan from model
        const response = await llm.generate(prompt, BUILD_SYSTEM_PROMPT);
        spinner.stop();

        // Parse and execute the action plan
        const result = await parseAndExecutePlan(response.text);

        if (!result) {
            // Fallback: show raw response if no action plan
            console.log(chalk.yellow('\n⚠️  Model did not return an action plan. Showing response:\n'));
            console.log(formatResponse(response.text) + '\n');
        }

    } catch (error) {
        spinner.fail('Generation failed');
        handleError(error);
    }
}

// ==================== CHAT MODE ====================

/**
 * Simple chat mode (no code generation)
 */
async function chatMode(llm: ReturnType<typeof createLLMProvider>): Promise<void> {
    while (true) {
        try {
            const userInput = await input({
                message: chalk.blue('💬'),
            });

            if (userInput.toLowerCase() === '/code' || userInput.toLowerCase() === '/exit') {
                console.log(chalk.gray('\nBack to Agdi dev mode.\n'));
                return;
            }

            if (!userInput.trim()) continue;

            const spinner = ui.createSpinner('Thinking...').start();
            const response = await llm.generate(userInput, 'You are a helpful assistant. Be friendly and concise.');
            spinner.stop();
            ui.printAIMessage(response.text);

        } catch (error) {
            if ((error as Error).name === 'ExitPromptError') {
                return;
            }
            handleError(error);
        }
    }
}

// ==================== GIT COMMAND HANDLERS ====================

/**
 * Handle /status command - AI analysis of git status
 */
async function handleGitStatus(llm: ReturnType<typeof createLLMProvider>): Promise<void> {
    if (!isGitRepo()) {
        console.log(chalk.yellow('\n⚠️  Not a git repository\n'));
        return;
    }

    const spinner = ui.createSpinner('Analyzing git status...').start();

    try {
        const status = getStatus();
        const statusText = formatStatusForPrompt(status);

        const prompt = `Analyze this git status and provide a brief summary of the current state of the repository. What's staged, unstaged, and what should be done next?

${statusText}`;

        const response = await llm.generate(prompt, BASE_CHAT_PROMPT);
        spinner.stop();

        console.log(chalk.cyan.bold('\n📊 Git Status Analysis\n'));
        console.log(chalk.gray(statusText));
        console.log(chalk.cyan('\n─── AI Analysis ───\n'));
        ui.printAIMessage(formatResponse(response.text));

    } catch (error) {
        spinner.fail('Error analyzing status');
        handleError(error);
    }
}

/**
 * Handle /diff command - AI explanation of current changes
 */
async function handleGitDiff(llm: ReturnType<typeof createLLMProvider>): Promise<void> {
    if (!isGitRepo()) {
        console.log(chalk.yellow('\n⚠️  Not a git repository\n'));
        return;
    }

    const spinner = ui.createSpinner('Analyzing changes...').start();

    try {
        // Get both staged and unstaged diffs
        const stagedDiff = getDiff(true);
        const unstagedDiff = getDiff(false);

        if (stagedDiff.files.length === 0 && unstagedDiff.files.length === 0) {
            spinner.stop();
            console.log(chalk.gray('\n(no changes to analyze)\n'));
            return;
        }

        let diffContext = '';
        if (stagedDiff.files.length > 0) {
            diffContext += '## Staged Changes\n' + formatDiffForPrompt(stagedDiff) + '\n\n';
        }
        if (unstagedDiff.files.length > 0) {
            diffContext += '## Unstaged Changes\n' + formatDiffForPrompt(unstagedDiff);
        }

        const prompt = `Explain these code changes. What are the key modifications and their purpose?

${diffContext}`;

        const response = await llm.generate(prompt, BASE_CHAT_PROMPT);
        spinner.stop();

        console.log(chalk.cyan.bold('\n🔍 Diff Analysis\n'));
        ui.printAIMessage(formatResponse(response.text));

    } catch (error) {
        spinner.fail('Error analyzing diff');
        handleError(error);
    }
}

/**
 * Handle /commit command - AI-generated commit message
 */
async function handleGitCommit(llm: ReturnType<typeof createLLMProvider>): Promise<void> {
    if (!isGitRepo()) {
        console.log(chalk.yellow('\n⚠️  Not a git repository\n'));
        return;
    }

    const status = getStatus();

    if (status.staged.length === 0) {
        console.log(chalk.yellow('\n⚠️  No staged changes. Stage some changes first with `git add`.\n'));
        return;
    }

    const spinner = ui.createSpinner('Generating commit message...').start();

    try {
        const stagedDiff = getDiff(true);
        const diffText = formatDiffForPrompt(stagedDiff);

        const prompt = `Generate a concise, conventional commit message for these staged changes. Use the format: type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Keep the message under 72 characters.
Return ONLY the commit message, nothing else.

Changes:
${diffText}`;

        const response = await llm.generate(prompt, 'You are a git commit message generator. Output ONLY the commit message, no explanation.');
        spinner.stop();

        const commitMessage = response.text.trim().split('\n')[0]; // Take first line only

        console.log(chalk.cyan.bold('\n💬 Generated Commit Message\n'));
        console.log(chalk.white(`  ${commitMessage}\n`));

        const shouldCommit = await confirm({
            message: 'Commit with this message?',
            default: true,
        });

        if (shouldCommit) {
            // Execute git commit
            const { execSync } = await import('child_process');
            const env = getEnvironment();

            try {
                execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
                    cwd: env.workspaceRoot,
                    stdio: 'inherit',
                });
                console.log(chalk.green('\n✓ Committed successfully!\n'));
            } catch (gitError) {
                console.log(chalk.red('\n✗ Commit failed. Check git output above.\n'));
            }
        } else {
            console.log(chalk.gray('\n👋 Commit cancelled.\n'));
        }

    } catch (error) {
        spinner.fail('Error generating commit');
        handleError(error);
    }
}

// ==================== HELPERS ====================

/**
 * Format code blocks in response
 */
function formatResponse(text: string): string {
    // Highlight code blocks
    return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
        const header = lang ? chalk.gray(`── ${lang} ──`) : chalk.gray('── code ──');
        return `\n${header}\n${chalk.white(code.trim())}\n${chalk.gray('────────')}\n`;
    });
}

/**
 * Show help
 */
function showHelp(): void {
    console.log(chalk.cyan.bold('\n📖 Commands\n'));

    console.log(chalk.cyan('  Git Commands:'));
    console.log(chalk.gray('  /status    ') + 'AI analysis of git status');
    console.log(chalk.gray('  /diff      ') + 'AI explanation of current changes');
    console.log(chalk.gray('  /commit    ') + 'Generate and run git commit');
    console.log('');

    console.log(chalk.cyan('  Build Commands:'));
    console.log(chalk.gray('  /build     ') + 'Generate and execute an application');
    console.log(chalk.gray('  /edit      ') + 'AI-powered surgical file editing');
    console.log('');

    console.log(chalk.cyan('  RAG Commands:'));
    console.log(chalk.gray('  /index     ') + 'Index current project for search');
    console.log(chalk.gray('  /search    ') + 'Semantic code search');
    console.log('');

    console.log(chalk.cyan('  Advanced:'));
    console.log(chalk.gray('  /tools     ') + 'List available MCP tools');
    console.log(chalk.gray('  /agent     ') + 'Toggle multi-agent mode');
    console.log(chalk.gray('  /memory    ') + 'Show memory stats');
    console.log('');

    console.log(chalk.cyan('  Conversation:'));
    console.log(chalk.gray('  /clear     ') + 'Clear conversation history');
    console.log(chalk.gray('  /history   ') + 'Show recent conversation');
    console.log('');

    console.log(chalk.cyan('  General:'));
    console.log(chalk.gray('  /model     ') + 'Change AI model');
    console.log(chalk.gray('  /chat      ') + 'Switch to chat mode');
    console.log(chalk.gray('  /help      ') + 'Show this help');
    console.log(chalk.gray('  /exit      ') + 'Exit Agdi');
    console.log(chalk.gray('\n  Or just type your coding question!\n'));
}

/**
 * Handle errors with friendly messages
 */
function handleError(error: unknown): void {
    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes('429') || msg.includes('quota')) {
        console.log(chalk.yellow('\n⚠️  Quota exceeded. Run /model to switch.\n'));
    } else if (msg.includes('401') || msg.includes('403')) {
        console.log(chalk.red('\n🔑 Invalid API key. Run: agdi auth\n'));
    } else {
        console.log(chalk.red('\n' + msg + '\n'));
    }
}
