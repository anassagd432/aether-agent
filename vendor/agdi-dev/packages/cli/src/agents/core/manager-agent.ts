/**
 * Manager Agent (Project Manager)
 * 
 * The orchestrating brain of the squad. Analyzes user prompts,
 * generates project specifications, and delegates tasks to workers.
 */

import { BaseAgent, SquadTask, AgentOutput, ProjectSpec, PageSpec, APIEndpointSpec, SquadRole, GeneratedFile } from './base-agent.js';
import type { ILLMProvider } from '../../core/types/index.js';
import { v4 as uuidv4 } from 'uuid';

// ==================== MANAGER SYSTEM PROMPT ====================

const MANAGER_SYSTEM_PROMPT = `You are the PROJECT MANAGER of an autonomous development team.
Your job is to analyze user requirements and create detailed specifications that your team can execute.

You have a team of specialists:
- **Frontend Agent**: Builds React/Next.js UI components
- **Backend Agent**: Creates APIs and database schemas  
- **QA Agent**: Tests the code and fixes build errors
- **DevOps Agent**: Deploys to production

Your responsibilities:
1. Parse the user's request into a formal project specification
2. Define the tech stack (default: Next.js + Tailwind + Prisma + SQLite)
   - If request is a SaaS (billing, orgs, multi-tenant, Stripe), use Postgres and include Stripe + auth.
3. List all pages/routes needed
4. List all API endpoints needed
5. Define the database schema
6. Create tasks for each agent
7. When the project is niche/industry-specific, consult the Public APIs list (https://github.com/public-apis/public-apis) and propose relevant third-party APIs in the spec

Always respond with a JSON specification in this format:
\`\`\`json
{
  "name": "project-name",
  "description": "Brief description",
  "type": "fullstack",
  "stack": {
    "frontend": ["next.js", "tailwind", "shadcn"],
    "backend": ["hono", "prisma"],
    "database": "sqlite"
  },
  "features": ["feature1", "feature2"],
  "pages": [
    {"route": "/", "name": "Home", "components": ["Hero", "Features"], "description": "Landing page"}
  ],
  "apiEndpoints": [
    {"method": "GET", "path": "/api/users", "description": "List users"}
  ],
  "dbSchema": "// Prisma schema here",
  "tasks": [
    {"title": "Create homepage", "assignee": "frontend", "priority": "high", "dependencies": []}
  ]
}
\`\`\`

Sources:
- If you reference any external APIs, datasets, or resources, list their URLs in a "Sources:" section at the end.

Be thorough. Think like a senior architect.`;

// ==================== MANAGER AGENT CLASS ====================

export class ManagerAgent extends BaseAgent {
    constructor(llm: ILLMProvider, options: { verbose?: boolean } = {}) {
        super('manager', '🧠 Manager', llm, options);
    }

    getSystemPrompt(): string {
        return MANAGER_SYSTEM_PROMPT;
    }

    /**
     * Analyze user request and generate project specification
     */
    async analyzeRequest(userPrompt: string): Promise<ProjectSpec> {
        this.log('Analyzing project requirements...');

        const response = await this.think(`
User Request: "${userPrompt}"

Create a complete project specification for this request.
Include all pages, API endpoints, and database models needed.
        `);

        const isSaas = /saas|stripe|billing|subscription|multi-tenant|tenant|org|organization/i.test(userPrompt);

        const fallbackSpec: ProjectSpec = {
            name: 'my-project',
            description: userPrompt,
            type: 'fullstack',
            stack: {
                frontend: ['next.js', 'tailwind', 'shadcn'],
                backend: ['hono', 'prisma'],
                database: isSaas ? 'postgres' : 'sqlite',
            },
            features: [],
            pages: [],
            apiEndpoints: [],
        };

        const spec = this.parseJSON<ProjectSpec>(response, fallbackSpec);

        if (isSaas) {
            spec.features = Array.from(new Set([...(spec.features || []), 'auth', 'billing', 'multi-tenant'])) as string[];
            spec.stack = spec.stack || {};
            spec.stack.database = spec.stack.database || 'postgres';
            spec.stack.frontend = spec.stack.frontend?.length ? spec.stack.frontend : ['next.js', 'tailwind', 'shadcn'];
            spec.stack.backend = spec.stack.backend?.length ? spec.stack.backend : ['hono', 'prisma'];

            if (!spec.pages || spec.pages.length === 0) {
                spec.pages = [
                    { route: '/', name: 'Landing', components: ['Hero', 'Features', 'CTA'], description: 'Marketing landing page' },
                    { route: '/dashboard', name: 'Dashboard', components: ['Stats', 'RecentActivity'], description: 'Main SaaS dashboard' },
                    { route: '/settings', name: 'Settings', components: ['Profile', 'Org', 'Billing'], description: 'Account and billing settings' },
                ];
            }

            if (!spec.apiEndpoints || spec.apiEndpoints.length === 0) {
                spec.apiEndpoints = [
                    { method: 'GET', path: '/api/health', description: 'Health check' },
                    { method: 'GET', path: '/api/orgs', description: 'List organizations' },
                    { method: 'POST', path: '/api/orgs', description: 'Create organization' },
                    { method: 'GET', path: '/api/billing/portal', description: 'Stripe customer portal' },
                    { method: 'POST', path: '/api/stripe/webhook', description: 'Stripe webhook handler' },
                ];
            }
        }

        this.log(`Project "${spec.name}" spec created with ${spec.pages?.length || 0} pages`, 'success');

        return spec;
    }

    /**
     * Generate tasks from project specification
     */
    generateTasks(spec: ProjectSpec): SquadTask[] {
        const tasks: SquadTask[] = [];
        const timestamp = Date.now();

        // 1. Setup task (Backend first for types)
        tasks.push({
            id: uuidv4(),
            title: 'Initialize project structure',
            description: 'Create Next.js project with required dependencies',
            assignee: 'backend',
            priority: 'critical',
            state: 'pending',
            dependencies: [],
            createdAt: timestamp,
            retryCount: 0,
        });

        // 2. Database schema task
        tasks.push({
            id: uuidv4(),
            title: 'Create database schema',
            description: `Define Prisma schema for: ${spec.features.join(', ')}`,
            assignee: 'backend',
            priority: 'high',
            state: 'pending',
            dependencies: [tasks[0].id],
            input: { spec },
            createdAt: timestamp,
            retryCount: 0,
        });

        // 3. API endpoints tasks
        if (spec.apiEndpoints && spec.apiEndpoints.length > 0) {
            spec.apiEndpoints.forEach((endpoint, i) => {
                tasks.push({
                    id: uuidv4(),
                    title: `Create ${endpoint.method} ${endpoint.path}`,
                    description: endpoint.description,
                    assignee: 'backend',
                    priority: 'high',
                    state: 'pending',
                    dependencies: [tasks[1].id],
                    input: { endpoint },
                    createdAt: timestamp,
                    retryCount: 0,
                });
            });
        }

        // 4. Frontend component tasks
        const backendTaskIds = tasks.filter(t => t.assignee === 'backend').map(t => t.id);

        const sharedUiTaskId = uuidv4();
        tasks.push({
            id: sharedUiTaskId,
            title: 'Create shared UI components',
            description: 'Build reusable components: Button, Card, Input, etc.',
            assignee: 'frontend',
            priority: 'high',
            state: 'pending',
            dependencies: [tasks[0].id], // Just needs project setup
            createdAt: timestamp,
            retryCount: 0,
        });

        // 5. Page tasks
        if (spec.pages && spec.pages.length > 0) {
            spec.pages.forEach((page) => {
                tasks.push({
                    id: uuidv4(),
                    title: `Create ${page.name} page`,
                    description: `Route: ${page.route} - ${page.description}`,
                    assignee: 'frontend',
                    priority: 'medium',
                    state: 'pending',
                    dependencies: [tasks[0].id, sharedUiTaskId], // Run in parallel with backend
                    input: { page },
                    createdAt: timestamp,
                    retryCount: 0,
                });
            });
        }

        // 6. QA task (depends on all others)
        const allTaskIds = tasks.map(t => t.id);
        tasks.push({
            id: uuidv4(),
            title: 'Run build and tests',
            description: 'Execute npm build and fix any errors',
            assignee: 'qa',
            priority: 'critical',
            state: 'pending',
            dependencies: allTaskIds,
            createdAt: timestamp,
            retryCount: 0,
        });

        // 7. Deploy task
        tasks.push({
            id: uuidv4(),
            title: 'Deploy to production',
            description: 'Deploy the application to Vercel',
            assignee: 'devops',
            priority: 'medium',
            state: 'pending',
            dependencies: [tasks[tasks.length - 1].id], // Wait for QA
            createdAt: timestamp,
            retryCount: 0,
        });

        this.log(`Generated ${tasks.length} tasks for the team`, 'success');
        return tasks;
    }

    /**
     * Execute manager task (for orchestrator compatibility)
     */
    async execute(task: SquadTask): Promise<AgentOutput> {
        this.resetSources();
        const userPrompt = task.input?.prompt as string || task.description;

        const spec = await this.analyzeRequest(userPrompt);
        const tasks = this.generateTasks(spec);

        return {
            success: true,
            content: JSON.stringify({ spec, tasks }, null, 2),
            nextSteps: tasks.map(t => t.title),
            sources: this.getSources(),
        };
    }
}

export default ManagerAgent;
