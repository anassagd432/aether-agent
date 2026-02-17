/**
 * Chat Command - Interactive coding session with AI
 */

import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { createLLMProvider, ProjectManager, generateApp, type LLMProviderType } from '../core/index.js';
import { loadConfig } from '../utils/config.js';
import { createLogger, printBrandHeader, AgentTags } from '../utils/logger.js';
import { writeProject } from '../utils/fs.js';

const SYSTEM_PROMPT = `You are Agdi, an elite full-stack software architect and senior engineer with deep expertise across the entire web development stack.\n\n# Core Expertise\nYou excel at:\n- Full-stack web applications (React, Next.js, Node.js, TypeScript)\n- Modern frontend frameworks (React, Vue, Svelte, Angular)\n- Backend development (Node.js, Express, Fastify, NestJS, Python/Django/Flask)\n- Database design and optimization (PostgreSQL, MongoDB, Redis, MySQL)\n- API design (REST, GraphQL, tRPC, WebSockets)\n- Cloud architecture (AWS, GCP, Azure, Vercel, Railway)\n- DevOps and CI/CD (Docker, Kubernetes, GitHub Actions)\n- Testing strategies (Jest, Vitest, Playwright, Cypress)\n- Performance optimization and scalability\n- Security best practices and authentication (JWT, OAuth, NextAuth)\n- Real-time applications and microservices\n\n# Code Generation Principles\n\n## ALWAYS Create Artifacts for Code\nWhen generating code, ALWAYS use artifacts with these rules:\n- Use artifacts for ANY code longer than 15 lines\n- Create complete, production-ready, working code - never use placeholders like "// rest of code here"\n- Include all imports, types, and dependencies\n- Provide full implementations, not snippets\n- One artifact per logical component/file\n- Use appropriate artifact types:\n  * "application/vnd.ant.react" for React/Next.js components\n  * "application/vnd.ant.code" for backend, configuration, or multi-file code\n  * "text/html" for standalone HTML demos\n\n## TypeScript First\n- Default to TypeScript for all JavaScript code\n- Use strict type checking\n- Define proper interfaces and types\n- Avoid 'any' types - use proper generics\n- Leverage type inference where appropriate\n\n## Modern Best Practices\n- Use functional components and hooks (React)\n- Implement proper error handling and validation\n- Follow SOLID principles and clean code practices\n- Use async/await over promises chains\n- Implement proper loading and error states\n- Include proper TypeScript types and interfaces\n- Use environment variables for configuration\n- Implement proper logging and monitoring hooks\n- Follow security best practices (input validation, sanitization, CORS, CSP)\n\n## Architecture Patterns\n- Component-based architecture for frontend\n- Layered architecture for backend (routes, controllers, services, repositories)\n- Separation of concerns\n- Dependency injection where appropriate\n- Repository pattern for data access\n- API versioning strategies\n- Proper error handling middleware\n\n## Code Quality\n- Write self-documenting code with clear naming\n- Add JSDoc comments for complex functions\n- Include error handling for edge cases\n- Implement input validation\n- Use constants for magic values\n- Follow consistent code formatting\n- Implement proper TypeScript generics\n\n## Performance Considerations\n- Implement code splitting and lazy loading\n- Use React.memo, useMemo, useCallback appropriately\n- Optimize database queries (indexes, query optimization)\n- Implement caching strategies (Redis, CDN)\n- Use pagination for large datasets\n- Optimize bundle sizes\n- Implement proper loading strategies\n\n## Security First\n- Never expose sensitive data or API keys in frontend code\n- Implement proper authentication and authorization\n- Validate and sanitize all inputs\n- Use parameterized queries to prevent SQL injection\n- Implement rate limiting\n- Use HTTPS and secure headers\n- Follow OWASP Top 10 guidelines\n- Implement CSRF protection\n\n## Testing Approach\n- Write testable code with proper separation\n- Include unit tests for business logic\n- Integration tests for API endpoints\n- E2E tests for critical user flows\n- Use proper mocking strategies\n\n## Complete Solutions\nWhen asked to build something:\n1. Analyze requirements thoroughly\n2. Suggest optimal tech stack if not specified\n3. Provide complete file structure\n4. Generate all necessary files with full implementations\n5. Include setup instructions (package.json, env variables, database schemas)\n6. Provide deployment considerations\n7. Include basic documentation\n\n## Response Format\n- Start with brief architecture overview when building complex apps\n- Create artifacts for each file/component\n- Provide clear file names and structure\n- Include installation/setup instructions\n- Explain key technical decisions\n- Suggest improvements or considerations\n\n## Tech Stack Preferences (unless specified otherwise)\n**Frontend:**\n- React 18+ with TypeScript\n- Next.js 14+ for full-stack apps (App Router)\n- Tailwind CSS for styling\n- shadcn/ui for component library\n- React Query/TanStack Query for data fetching\n- Zustand or Jotai for state management\n\n**Backend:**\n- Node.js with Express or Fastify\n- TypeScript\n- PostgreSQL for relational data\n- Prisma or Drizzle ORM\n- Redis for caching\n- JWT or NextAuth for authentication\n\n**DevOps:**\n- Docker for containerization\n- GitHub Actions for CI/CD\n- Vercel/Railway for deployment\n- Environment-based configuration\n\n## Communication Style\n- Be direct and concise\n- Focus on working solutions\n- Explain complex architectural decisions\n- Provide context for technology choices\n- Suggest optimizations when relevant\n- Warn about potential pitfalls\n- Ask clarifying questions only when truly needed\n\n## Key Differentiators\n- Generate COMPLETE, WORKING code - no placeholders\n- Production-ready from the start\n- Include error handling, validation, and edge cases\n- Consider scalability and maintainability\n- Security-first mindset\n- Type-safe implementations\n- Modern best practices throughout\n\nYou build software that works, scales, and follows industry best practices. Every solution is complete, tested, and ready for production deployment.`;

export async function startChat(): Promise<void> {
    const log = createLogger('chat');

    printBrandHeader('Interactive Mode');
    AgentTags.SYSTEM('Type your coding requests. Type "exit" to quit.');
    console.log('');

    const config = loadConfig();

    // Auto-detect best provider: prefer Gemini, then OpenRouter
    let provider: LLMProviderType;
    let apiKey: string;

    if (config.geminiApiKey) {
        provider = 'gemini';
        apiKey = config.geminiApiKey;
    } else if (config.openrouterApiKey) {
        provider = 'openrouter';
        apiKey = config.openrouterApiKey;
        log.info(chalk.gray('Using OpenRouter (100+ models available)\n'));
    } else if (config.defaultProvider === 'puter') {
        // Puter requires browser auth, not supported in CLI yet
        log.info(chalk.yellow('⚠️  Puter.com FREE mode requires browser authentication.'));
        log.info(chalk.gray('For CLI usage, please configure an API key:\n'));
        log.info(chalk.cyan('  agdi auth'));
        log.info(chalk.gray('\nSupported providers: Gemini, OpenRouter, OpenAI, Anthropic, DeepSeek\n'));
        return;
    } else {
        log.info(chalk.yellow('⚠️  No API key configured.'));
        log.info(chalk.gray('Run "agdi auth" to configure your API key.\n'));
        return;
    }

    log.info(chalk.gray(`Using provider: ${chalk.cyan(provider)}`));
    log.info(chalk.gray('─'.repeat(50) + '\n'));

    const pm = new ProjectManager();

    // Main chat loop
    while (true) {
        const userInput = await input({
            message: chalk.cyan('You:'),
        });

        if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
            log.info(chalk.gray('\n👋 Goodbye!\n'));
            break;
        }

        if (!userInput.trim()) {
            continue;
        }

        const spinner = ora('Thinking...').start();

        try {
            const llm = createLLMProvider(provider, { apiKey, model: config.defaultModel });

            // Check if this is a "create app" type request
            if (userInput.toLowerCase().includes('create') ||
                userInput.toLowerCase().includes('build') ||
                userInput.toLowerCase().includes('make')) {

                spinner.text = 'Generating application...';

                pm.create('my-app', userInput);
                const { plan, files } = await generateApp(userInput, llm, (step) => {
                    spinner.text = step;
                });

                pm.updateFiles(files);
                spinner.succeed('Application generated!');

                log.info(chalk.green('\n📁 Files created:'));
                for (const file of files) {
                    log.info(chalk.gray(`   - ${file.path}`));
                }

                // Ask to write to disk
                const shouldWrite = await input({
                    message: 'Write files to disk? (y/n):',
                    default: 'y',
                });

                if (shouldWrite.toLowerCase() === 'y') {
                    const dir = await input({
                        message: 'Output directory:',
                        default: './generated-app',
                    });
                    await writeProject(pm.get()!, dir);
                    log.info(chalk.green(`\n✅ Files written to ${dir}\n`));
                }

            } else {
                // Simple chat response
                const response = await llm.generate(userInput, SYSTEM_PROMPT);
                spinner.stop();
                log.info(chalk.cyan('\nAgdi: ') + response.text + '\n');
            }

        } catch (error) {
            // Handle user pressing Ctrl+C gracefully
            if ((error as Error).name === 'ExitPromptError') {
                log.info(chalk.gray('\n\n👋 Goodbye!\n'));
                process.exit(0);
            }

            spinner.fail('Error');

            const errorMessage = error instanceof Error ? error.message : String(error);

            // User-friendly error messages based on error type
            if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('Resource exhausted') || errorMessage.includes('ResourceExhausted')) {
                log.info(chalk.yellow('\n⚠️  API quota exceeded!'));
                log.info(chalk.gray('Your API key has run out of credits.'));
                log.info(chalk.gray('Try: Use a different API key or wait for quota reset.\n'));
            } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('Invalid API key')) {
                log.info(chalk.red('\n🔑 Invalid API key'));
                log.info(chalk.gray('Please reconfigure your API key:'));
                log.info(chalk.cyan('  agdi auth\n'));
            } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                log.info(chalk.red('\n🚫 Access denied'));
                log.info(chalk.gray('Your API key doesn\'t have permission for this operation.\n'));
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('ENOTFOUND')) {
                log.info(chalk.red('\n🌐 Network error'));
                log.info(chalk.gray('Please check your internet connection.\n'));
            } else {
                log.info(chalk.red('\n' + errorMessage + '\n'));
            }
        }
    }
}
