/**
 * Backend Agent
 * 
 * Specialist in server-side development.
 * Generates APIs, database schemas, and business logic.
 */

import { BaseAgent, SquadTask, AgentOutput, GeneratedFile, APIEndpointSpec, ProjectSpec } from './base-agent.js';
import type { ILLMProvider } from '../../core/types/index.js';
import { ui } from '../../utils/ui.js';

// ==================== BACKEND SYSTEM PROMPT ====================

const BACKEND_SYSTEM_PROMPT = `You are a SENIOR BACKEND DEVELOPER with expertise in:
- Node.js / Hono / Express
- TypeScript
- Prisma ORM
- PostgreSQL / SQLite
- REST API design
- Authentication (JWT, sessions)

Your responsibilities:
1. Design database schemas (Prisma)
2. Create API routes with proper validation
3. Implement business logic
4. Handle errors gracefully
5. Add security measures

Code Style:
- Use TypeScript strict mode
- Validate all inputs with Zod
- Return consistent JSON responses
- Add proper error handling
- Document with JSDoc comments

Output Format - Always include file paths:
\`\`\`typescript
// filepath: src/lib/db.ts
import { PrismaClient } from '@prisma/client';
// ... code
\`\`\`

Sources:
- If you reference any external APIs, datasets, or specs, list their URLs in a "Sources:" section at the end.

Make code production-ready. No placeholders.`;

// ==================== BACKEND AGENT CLASS ====================

export class BackendAgent extends BaseAgent {
    constructor(llm: ILLMProvider, options: { verbose?: boolean } = {}) {
        super('backend', '⚙️ Backend', llm, options);
    }

    getSystemPrompt(): string {
        return BACKEND_SYSTEM_PROMPT;
    }

    /**
     * Generate Prisma database schema
     */
    async generateSchema(spec: ProjectSpec): Promise<GeneratedFile[]> {
        this.log('Creating database schema...');

        const response = await this.think(`
Create a Prisma schema for this project:

Name: ${spec.name}
Description: ${spec.description}
Features: ${spec.features.join(', ')}
Database: ${spec.stack.database || 'sqlite'}

Requirements:
- Include all necessary models with relationships
- Add timestamps (createdAt, updatedAt)
- Use proper field types
- Add indexes for common queries
- Include sample seed data as comments
${ui.flags.saas ? '- Multi-tenant SaaS: include Tenant/Org, User, Membership, Subscription, Plan, and AuditLog models\n- Use Postgres and add @@index on tenantId/orgId fields\n- Include Stripe fields (customerId, subscriptionId, status)\n' : ''}
        `);

        const files = this.extractCodeBlocks(response);

        // Ensure schema file exists
        if (files.length === 0) {
            files.push({
                path: 'prisma/schema.prisma',
                content: response,
                action: 'create',
            });
        }

        this.log(`Generated database schema`, 'success');
        return files;
    }

    /**
     * Generate API endpoint
     */
    async generateEndpoint(endpoint: APIEndpointSpec): Promise<GeneratedFile[]> {
        this.log(`Creating API: ${endpoint.method} ${endpoint.path}`);

        const response = await this.think(`
Create a Next.js API route:

Method: ${endpoint.method}
Path: ${endpoint.path}
Description: ${endpoint.description}
${endpoint.requestBody ? `Request Body: ${endpoint.requestBody}` : ''}
${endpoint.responseBody ? `Response Body: ${endpoint.responseBody}` : ''}

Requirements:
- Use App Router route handlers (route.ts)
- Validate inputs with Zod
- Handle errors with proper status codes
- Return JSON responses
- Add authentication check if needed
${ui.flags.saas ? '- For SaaS: enforce tenant/org scoping and include Stripe portal/webhook helpers where relevant\n' : ''}
        `);

        const files = this.extractCodeBlocks(response);

        if (files.length === 0) {
            const base = ui.flags.saas ? 'app/api' : 'src/app/api';
            const routePath = endpoint.path.replace('/api', base);
            files.push({
                path: `${routePath}/route.ts`,
                content: response,
                action: 'create',
            });
        }

        this.log(`Generated API route`, 'success');
        return files;
    }

    /**
     * Generate project initialization files
     */
    async generateProjectSetup(spec: ProjectSpec): Promise<GeneratedFile[]> {
        this.log('Generating project structure...');

        const response = await this.think(`
Create the initial project setup files for:

Name: ${spec.name}
Type: ${spec.type}
Stack: ${JSON.stringify(spec.stack)}

Generate these files:
1. package.json with all dependencies
2. tsconfig.json with strict settings
3. tailwind.config.ts
4. next.config.mjs
5. .env.example with required variables
6. prisma/schema.prisma basic setup
7. lib/db.ts - Prisma client singleton
${ui.flags.saas ? '8. postcss.config.js\n9. app/globals.css\n10. app/layout.tsx (App Router layout)\n' : ''}
        `);

        const files = this.extractCodeBlocks(response);
        this.log(`Generated ${files.length} setup files`, 'success');
        return files;
    }

    /**
     * Generate database utilities
     */
    async generateDBUtils(): Promise<GeneratedFile[]> {
        this.log('Creating database utilities...');

        const response = await this.think(`
Create database utility files:

1. src/lib/db.ts - Prisma client singleton
2. src/lib/seed.ts - Database seed script
3. src/lib/types.ts - Shared TypeScript types from Prisma

Requirements:
- Handle connection pooling for serverless
- Export typed Prisma client
- Include error handling
        `);

        return this.extractCodeBlocks(response);
    }

    /**
     * Execute a backend task
     */
    async execute(task: SquadTask): Promise<AgentOutput> {
        this.log(`Executing: ${task.title}`);
        this.resetSources();

        let files: GeneratedFile[] = [];

        try {
            if (task.title.toLowerCase().includes('initialize') || task.title.toLowerCase().includes('setup')) {
                const spec = task.input?.spec as ProjectSpec || this.context?.projectSpec;
                if (spec) {
                    files = await this.generateProjectSetup(spec);
                } else {
                    throw new Error('No project spec provided for initialization');
                }
            } else if (task.title.toLowerCase().includes('schema') || task.title.toLowerCase().includes('database')) {
                const spec = task.input?.spec as ProjectSpec || this.context?.projectSpec;
                if (spec) {
                    files = await this.generateSchema(spec);
                    files.push(...await this.generateDBUtils());
                }
            } else if (task.input?.endpoint) {
                files = await this.generateEndpoint(task.input.endpoint as APIEndpointSpec);
            } else {
                // Generic API task
                const endpoint: APIEndpointSpec = {
                    method: 'GET',
                    path: `/api/${task.title.toLowerCase().replace(/\s+/g, '-')}`,
                    description: task.description,
                };
                files = await this.generateEndpoint(endpoint);
            }

            return {
                success: true,
                content: `Generated ${files.length} files`,
                files,
                nextSteps: files.map(f => `Created: ${f.path}`),
                sources: this.getSources(),
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`Task failed: ${errorMsg}`, 'error');

            return {
                success: false,
                content: errorMsg,
                errors: [errorMsg],
                sources: this.getSources(),
            };
        }
    }
}

export default BackendAgent;
